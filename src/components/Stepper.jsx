import { useState } from 'react'

// Control numérico grande para dedos: − valor +. El valor se puede tipear.
export function Stepper({ label, value, onChange, min = 1, max = 999, step = 1, suffix, disabled }) {
  const [draft, setDraft] = useState(null)
  const clamp = (v) => Math.min(max, Math.max(min, v))
  const commit = () => {
    const v = parseFloat(String(draft).replace(',', '.'))
    if (!Number.isNaN(v)) onChange(clamp(Math.round(v / step) * step))
    setDraft(null)
  }
  return (
    <div className={`stepper${disabled ? ' is-disabled' : ''}`}>
      {label && <span className="stepper-label">{label}</span>}
      <div className="stepper-row">
        <button type="button" disabled={disabled || value <= min} onClick={() => onChange(clamp(value - step))} aria-label={`Bajar ${label ?? ''}`}>
          −
        </button>
        <input
          inputMode="decimal"
          value={draft ?? value}
          disabled={disabled}
          aria-label={label}
          onFocus={(e) => {
            setDraft(String(value))
            requestAnimationFrame(() => e.target.select())
          }}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
        {suffix && <span className="stepper-suffix">{suffix}</span>}
        <button type="button" disabled={disabled || value >= max} onClick={() => onChange(clamp(value + step))} aria-label={`Subir ${label ?? ''}`}>
          +
        </button>
      </div>
    </div>
  )
}
