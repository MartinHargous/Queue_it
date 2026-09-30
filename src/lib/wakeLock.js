let lock = null
let wanted = false

export async function keepAwake(on) {
  wanted = on
  try {
    if (on && !lock && 'wakeLock' in navigator) {
      lock = await navigator.wakeLock.request('screen')
      lock.addEventListener('release', () => (lock = null))
    } else if (!on && lock) {
      await lock.release()
      lock = null
    }
  } catch {
    /* sin permiso o no soportado */
  }
}

// El wake lock se pierde al cambiar de app; se vuelve a pedir al regresar
document.addEventListener('visibilitychange', () => {
  if (wanted && document.visibilityState === 'visible') keepAwake(true)
})
