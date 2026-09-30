// Idioma de la interfaz. Las claves son el texto en español: si falta una
// traducción se muestra el español, así nunca aparece una clave vacía.
import { useSyncExternalStore } from 'react'
import en from './i18n/en.js'
import pt from './i18n/pt.js'

export const LANGS = [
  ['es', 'Español'],
  ['en', 'English'],
  ['pt', 'Português'],
]

const DICTS = { es: {}, en, pt }
const KEY = 'queueit.lang'

function initial() {
  try {
    const saved = globalThis.localStorage?.getItem(KEY)
    if (saved && DICTS[saved]) return saved
  } catch {
    /* sin almacenamiento */
  }
  const nav = globalThis.navigator?.language?.slice(0, 2)
  return DICTS[nav] ? nav : 'es'
}

let lang = initial()
const listeners = new Set()
if (globalThis.document) document.documentElement.lang = lang

export const getLang = () => lang

export function setLang(l) {
  if (!DICTS[l] || l === lang) return
  lang = l
  try {
    localStorage.setItem(KEY, l)
  } catch {
    /* sin almacenamiento */
  }
  document.documentElement.lang = l
  listeners.forEach((f) => f())
}

// t('Cue marcado en {t}', { t: '0:05' })
export function t(key, vars) {
  let s = DICTS[lang][key] ?? key
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m))
  return s
}

// Plural simple: tn(n, 'sección', 'secciones')
export const tn = (n, one, many) => t(n === 1 ? one : many)

const subscribe = (f) => {
  listeners.add(f)
  return () => listeners.delete(f)
}

// Vuelve a dibujar el componente cuando cambia el idioma
export function useLang() {
  return useSyncExternalStore(subscribe, getLang, getLang)
}
