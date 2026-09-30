import { useEffect, useRef } from 'react'

// Botón que repite la acción mientras se mantiene presionado (adelantar/retroceder).
export function HoldButton({ onStep, disabled, className = 'icon-btn', children, ...rest }) {
  const timer = useRef(null)
  const stepRef = useRef(onStep)
  useEffect(() => {
    stepRef.current = onStep
  })

  const release = () => {
    clearTimeout(timer.current)
    timer.current = null
  }
  useEffect(() => release, [])

  const press = (e) => {
    if (disabled || e.button > 0) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    stepRef.current()
    const repeat = (delay) => {
      timer.current = setTimeout(() => {
        stepRef.current()
        repeat(Math.max(120, delay * 0.8)) // acelera mientras se mantiene
      }, delay)
    }
    repeat(450)
  }

  return (
    <button
      type="button"
      className={className}
      disabled={disabled}
      onPointerDown={press}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => e.detail === 0 && stepRef.current()} // teclado
      {...rest}
    >
      {children}
    </button>
  )
}
