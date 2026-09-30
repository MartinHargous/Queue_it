import { Icon } from './icons.jsx'
import { formatTime } from '../lib/model.js'

const KIND_ICON = { tts: 'voice', voice: 'mic', text: 'text' }
const KIND_LABEL = { tts: 'Voz sintética', voice: 'Grabación', text: 'Solo texto' }

export function CuesPanel({ cues, onAdd, onEdit }) {
  return (
    <div className="stack">
      {cues.length === 0 ? (
        <div className="empty small">
          <p className="empty-title">Sin cues todavía</p>
          <p className="muted">Un cue es un aviso en un momento de la pista: una voz que dice «coro», una grabación tuya o una nota para la hoja.</p>
        </div>
      ) : (
        <ul className="cue-list">
          {cues.map((c) => (
            <li key={c.id}>
              <button className={`cue-row${c.t == null ? ' is-out' : ''}`} onClick={() => onEdit(c)}>
                <span className="cue-pos">
                  {c.pos.bar}
                  <span className="muted">:{c.pos.beat}</span>
                </span>
                <span className="cue-kind" title={KIND_LABEL[c.kind]}>
                  <Icon name={KIND_ICON[c.kind]} size={20} title={KIND_LABEL[c.kind]} />
                </span>
                <span className="cue-text">{c.text || <span className="muted">{c.kind === 'voice' ? 'Grabación sin nota' : 'Sin texto'}</span>}</span>
                <span className="cue-time" title={c.anchor === 'time' ? 'Fijo en segundos' : 'Anclado al compás'}>
                  {c.t == null ? 'fuera' : formatTime(c.t)}
                  {c.anchor !== 'time' && <span className="cue-anchor-tag">compás</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button className="btn btn-block" onClick={onAdd}>
        <Icon name="plus" /> Agregar cue
      </button>
    </div>
  )
}
