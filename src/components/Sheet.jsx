import { useEffect, useRef } from 'react'
import { Icon } from './icons.jsx'

// Hoja inferior modal. En Android el botón "atrás" la cierra: cada hoja abierta
// ocupa una entrada del historial, compartida si se abre una hoja justo tras otra.
let openCount = 0

export function Sheet({ title, onClose, children, footer }) {
  const ref = useRef(null)
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })
  useEffect(() => {
    openCount++
    if (!history.state?.sheet) history.pushState({ sheet: true }, '')
    const onPop = () => {
      if (!history.state?.sheet) closeRef.current()
    }
    const onKey = (e) => e.key === 'Escape' && closeRef.current()
    window.addEventListener('popstate', onPop)
    window.addEventListener('keydown', onKey)
    ref.current?.focus()
    return () => {
      openCount--
      window.removeEventListener('popstate', onPop)
      window.removeEventListener('keydown', onKey)
      setTimeout(() => {
        if (openCount === 0 && history.state?.sheet) history.back()
      }, 0)
    }
  }, [])
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} ref={ref} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <header className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar">
            <Icon name="close" />
          </button>
        </header>
        <div className="sheet-body">{children}</div>
        {footer && <footer className="sheet-foot">{footer}</footer>}
      </div>
    </div>
  )
}
