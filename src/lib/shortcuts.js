// Atajos de teclado para PC: espacio = reproducir/pausar, ← → = compás anterior/siguiente,
// M = marcar cue. Pulsan el botón visible correspondiente (el del modo escenario si está abierto),
// así respetan exactamente la misma lógica y el mismo estado deshabilitado que la interfaz.
const KEYS = { ' ': 'play', ArrowLeft: 'back', ArrowRight: 'fwd', m: 'mark', M: 'mark' }

export function installShortcuts() {
  const onKey = (e) => {
    const action = KEYS[e.key]
    if (!action || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return
    const el = e.target
    if (el.closest?.('input, textarea, select, [contenteditable]') || document.querySelector('.sheet-backdrop')) return
    const scope = document.querySelector('.stage') ?? document
    const btn = scope.querySelector(`[data-shortcut="${action}"]`)
    if (!btn || btn.disabled) return
    e.preventDefault()
    btn.click()
  }
  window.addEventListener('keydown', onKey)
  return () => window.removeEventListener('keydown', onKey)
}
