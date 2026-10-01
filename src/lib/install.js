// Instalación como app. Chrome/Edge en Android y PC disparan `beforeinstallprompt` cuando
// la página es instalable, pero muchas veces no muestran su aviso solos: lo guardamos y
// ofrecemos un botón propio. iPhone/iPad (Safari) no tiene ese evento: ahí se explican los pasos.
import { useSyncExternalStore } from 'react'

let deferred = null
let installed = false
const listeners = new Set()
const emit = () => listeners.forEach((f) => f())

const standalone = () =>
  globalThis.matchMedia?.('(display-mode: standalone)').matches || globalThis.navigator?.standalone === true

if (globalThis.window) {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault() // lo mostramos nosotros, cuando el usuario toca el botón
    deferred = e
    emit()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    installed = true
    emit()
  })
}

const isIOS = () => /iphone|ipad|ipod/i.test(globalThis.navigator?.userAgent ?? '') || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

function snapshot() {
  if (installed || standalone()) return 'installed'
  if (deferred) return 'prompt'
  if (isIOS()) return 'ios'
  return 'none'
}

const subscribe = (f) => {
  listeners.add(f)
  return () => listeners.delete(f)
}

// 'prompt' (se puede instalar con un toque) | 'ios' (pasos manuales) | 'installed' | 'none'
export function useInstallState() {
  return useSyncExternalStore(subscribe, snapshot, () => 'none')
}

export async function promptInstall() {
  if (!deferred) return false
  const e = deferred
  deferred = null
  emit()
  await e.prompt()
  const { outcome } = await e.userChoice
  return outcome === 'accepted'
}
