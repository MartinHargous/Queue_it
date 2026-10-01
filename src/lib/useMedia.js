import { useSyncExternalStore } from 'react'

// true mientras la media query se cumple (p. ej. pantalla ancha de PC)
export function useMedia(query) {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query)
      m.addEventListener('change', cb)
      return () => m.removeEventListener('change', cb)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}
