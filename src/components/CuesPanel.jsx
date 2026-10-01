import { Icon } from './icons.jsx'
import { formatTime } from '../lib/model.js'
import { t } from '../lib/i18n.js'

const KIND_ICON = { tts: 'voice', voice: 'mic', text: 'text' }
const KIND_LABEL = { tts: 'Voz sintética', voice: 'Grabación', text: 'Solo texto' }

export function CuesPanel({ cues, onAdd, onEdit }) {
  return (
    <div className="stack">
      {cues.length === 0 ? (
        <div className="empty small">
          <p className="empty-title">{t('Sin colas todavía')}</p>
          <p className="muted">{t('Una cola es un aviso en un momento de la pista: una voz que dice «coro», una grabación tuya o una nota para la hoja.')}</p>
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
                <span className="cue-kind" title={t(KIND_LABEL[c.kind])}>
                  <Icon name={KIND_ICON[c.kind]} size={20} title={t(KIND_LABEL[c.kind])} />
                </span>
                <span className="cue-text">{c.text || <span className="muted">{c.kind === 'voice' ? t('Grabación sin nota') : t('Sin texto')}</span>}</span>
                <span className="cue-time" title={c.anchor === 'time' ? t('Fija en segundos') : t('Anclada al compás')}>
                  {c.t == null ? t('fuera') : formatTime(c.t)}
                  {c.anchor !== 'time' && <span className="cue-anchor-tag">{t('compás')}</span>}
                  {c.kind === 'tts' && c.voice && <span className="cue-anchor-tag">{c.voice.split('/').pop()}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button className="btn btn-block" onClick={onAdd}>
        <Icon name="plus" /> {t('Agregar cola')}
      </button>
    </div>
  )
}
