import { positionInfo } from '../lib/audio/engine.js'
import { Icon } from './icons.jsx'

// Vista de escenario: números grandes, legibles a un metro del atril.
export function StageView({ project, timeline, cues, pos, playing, status, onToggle, onClose }) {
  const info = positionInfo(timeline, pos)
  const section = project.kind === 'metronome' ? project.sections[info.section] : null
  const placed = cues.filter((c) => c.t != null)
  const current = [...placed].reverse().find((c) => c.t <= pos + 0.05 && pos - c.t < 6)
  const next = placed.find((c) => c.t > pos + 0.05)
  const barsToNext = next ? next.bar - info.bar : null

  return (
    <div className="stage" role="dialog" aria-label="Modo escenario">
      <button className="icon-btn stage-close" onClick={onClose} aria-label="Salir del modo escenario">
        <Icon name="close" />
      </button>
      <div className="stage-top">
        <span>{section?.name ?? project.title}</span>
        <span>
          {info.num}/{section?.den ?? 4}, {Math.round(info.bpm || 0)} bpm
        </span>
      </div>
      <div className="stage-bar" aria-live="off">
        {info.bar}
      </div>
      <div className="stage-beats" aria-hidden="true">
        {Array.from({ length: info.num }, (_, i) => (
          <span key={i} className={`dot${i === 0 ? ' is-down' : ''}${playing && info.beat === i + 1 ? ' is-on' : ''}`} />
        ))}
      </div>
      <div className="stage-cue">{current ? current.text || '♪' : ''}</div>
      <div className="stage-next">
        {next ? (
          <>
            <span className="muted">{barsToNext <= 0 ? 'Ahora' : barsToNext === 1 ? 'En 1 compás' : `En ${barsToNext} compases`}</span>
            <span>
              c.{next.bar} {next.text}
            </span>
          </>
        ) : (
          <span className="muted">Sin más cues</span>
        )}
      </div>
      <button className={`play-btn stage-play${playing ? ' is-playing' : ''}`} onClick={onToggle} disabled={!!status} aria-label={playing ? 'Detener' : 'Reproducir'}>
        <Icon name={playing ? 'stop' : 'play'} fill size={40} />
      </button>
      {status && <p className="muted">{status}</p>}
    </div>
  )
}
