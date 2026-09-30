import { useState } from 'react'
import { newSection, uid } from '../lib/model.js'
import { Stepper } from './Stepper.jsx'
import { Icon } from './icons.jsx'
import { t } from '../lib/i18n.js'

const DENS = [2, 4, 8, 16]

export function SectionsPanel({ project, update, disabled }) {
  const [open, setOpen] = useState(project.sections[0]?.id ?? null)
  const sections = project.sections

  const setSection = (id, patch) =>
    update((p) => ({ ...p, sections: p.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)) }))

  const move = (i, d) =>
    update((p) => {
      const arr = [...p.sections]
      const j = i + d
      if (j < 0 || j >= arr.length) return p
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
      return { ...p, sections: arr }
    })

  const add = () => {
    const s = newSection(sections.at(-1), sections.length)
    update((p) => ({ ...p, sections: [...p.sections, s] }))
    setOpen(s.id)
  }
  const duplicate = (i) => {
    const s = { ...sections[i], id: uid(), name: `${sections[i].name} (${t('copia')})` }
    update((p) => ({ ...p, sections: [...p.sections.slice(0, i + 1), s, ...p.sections.slice(i + 1)] }))
    setOpen(s.id)
  }
  const remove = (id) => update((p) => ({ ...p, sections: p.sections.filter((s) => s.id !== id) }))

  const starts = sections.reduce((acc, s, i) => [...acc, i === 0 ? 1 : acc[i - 1] + sections[i - 1].bars], [])
  return (
    <div className="stack">
      {disabled && <p className="notice">{t('Detén la reproducción para editar la estructura.')}</p>}
      <ol className="section-list">
        {sections.map((s, i) => {
          const from = starts[i]
          const to = from + s.bars - 1
          const isOpen = open === s.id
          const tempo = s.bpmEnd && s.bpmEnd !== s.bpm ? `${s.bpm}→${s.bpmEnd}` : s.bpm
          return (
            <li key={s.id} className={`section${isOpen ? ' is-open' : ''}`}>
              <button className="section-head" onClick={() => setOpen(isOpen ? null : s.id)} aria-expanded={isOpen}>
                <span className="section-bars">
                  {from}
                  <span className="muted">–{to}</span>
                </span>
                <span className="section-name">{s.name}</span>
                <span className="section-meter">
                  {s.num}/{s.den}
                </span>
                <span className="section-tempo">{tempo}</span>
              </button>
              {isOpen && (
                <fieldset className="section-body" disabled={disabled}>
                  <label className="field">
                    <span>{t('Nombre')}</span>
                    <input value={s.name} onChange={(e) => setSection(s.id, { name: e.target.value })} />
                  </label>
                  <div className="grid-2">
                    <Stepper label={t('Compases')} value={s.bars} min={1} max={999} onChange={(v) => setSection(s.id, { bars: v })} />
                    <Stepper label={t('Tempo')} value={s.bpm} min={20} max={400} suffix="bpm" onChange={(v) => setSection(s.id, { bpm: v })} />
                  </div>
                  <div className="grid-2">
                    <Stepper label={t('Tiempos por compás')} value={s.num} min={1} max={32} onChange={(v) => setSection(s.id, { num: v })} />
                    <label className="field">
                      <span>{t('Figura del pulso')}</span>
                      <select value={s.den} onChange={(e) => setSection(s.id, { den: Number(e.target.value) })}>
                        {DENS.map((d) => (
                          <option key={d} value={d}>
                            {s.num}/{d}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={s.bpmEnd != null}
                      onChange={(e) => setSection(s.id, { bpmEnd: e.target.checked ? s.bpm + 10 : null })}
                    />
                    <span>{t('Cambio gradual de tempo (accel. / rit.)')}</span>
                  </label>
                  {s.bpmEnd != null && (
                    <Stepper label={t('Tempo al final')} value={s.bpmEnd} min={20} max={400} suffix="bpm" onChange={(v) => setSection(s.id, { bpmEnd: v })} />
                  )}
                  <div className="row-actions">
                    <button className="icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label={t('Subir sección')}>
                      <Icon name="up" />
                    </button>
                    <button className="icon-btn" onClick={() => move(i, 1)} disabled={i === sections.length - 1} aria-label={t('Bajar sección')}>
                      <Icon name="down" />
                    </button>
                    <button className="icon-btn" onClick={() => duplicate(i)} aria-label={t('Duplicar sección')}>
                      <Icon name="copy" />
                    </button>
                    <button className="icon-btn is-danger" onClick={() => remove(s.id)} disabled={sections.length === 1} aria-label={t('Eliminar sección')}>
                      <Icon name="trash" />
                    </button>
                  </div>
                </fieldset>
              )}
            </li>
          )
        })}
      </ol>
      <button className="btn btn-block" onClick={add} disabled={disabled}>
        <Icon name="plus" /> {t('Agregar sección')}
      </button>
      <p className="hint">{t('El tempo cuenta la figura del pulso: en 6/8 a 180 bpm suena cada corchea.')}</p>
    </div>
  )
}
