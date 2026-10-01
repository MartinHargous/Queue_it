import { positionInfo } from '../lib/audio/engine.js'
import { Icon } from './icons.jsx'
import { HoldButton } from './HoldButton.jsx'
import { t } from '../lib/i18n.js'

// Vista de escenario: números grandes, legibles a un metro del atril.
// setlist (opcional): { index, total, next, onPrev, onNext } para las listas de reproducción
export function StageView({ project, timeline, cues, pos, playing, status, countIn, setlist, controlsDisabled, onToggle, onSkip, onClose }) {
  const busy = controlsDisabled ?? !!status
  const info = positionInfo(timeline, pos)
  const section = project.kind === 'metronome' ? project.sections[info.section] : null
  const placed = cues.filter((c) => c.t != null)
  const current = [...placed].reverse().find((c) => c.t <= pos + 0.05 && pos - c.t < 6)
  const next = placed.find((c) => c.t > pos + 0.05)
  const barsToNext = next ? next.pos.bar - info.bar : null

  return (
    <div className="stage" role="dialog" aria-label={t('Modo escenario')}>
      <button className="icon-btn stage-close" onClick={onClose} aria-label={t('Salir del modo escenario')}>
        <Icon name="close" />
      </button>
      <div className="stage-top">
        {setlist && (
          <span className="stage-setlist">
            {setlist.index + 1}/{setlist.total} · {setlist.next ? `${t('Sigue')}: ${setlist.next}` : t('Última canción')}
          </span>
        )}
        <span>{setlist ? project.title : (section?.name ?? project.title)}</span>
        <span>
          {setlist && section ? `${section.name} · ` : ''}
          {info.num}/{section?.den ?? 4}, {Math.round(info.bpm || 0)} bpm
        </span>
      </div>
      <div className={`stage-bar${countIn ? ' is-count' : ''}`} aria-live="off">
        {countIn ? countIn.n : info.bar}
      </div>
      <div className="stage-beats" aria-hidden="true">
        {Array.from({ length: countIn ? countIn.of : info.num }, (_, i) => (
          <span key={i} className={`dot${i === 0 ? ' is-down' : ''}${playing && (countIn ? countIn.n : info.beat) === i + 1 ? ' is-on' : ''}`} />
        ))}
      </div>
      <div className="stage-cue">{current ? current.text || '♪' : ''}</div>
      <div className="stage-next">
        {next ? (
          <>
            <span className="muted">{barsToNext <= 0 ? t('Ahora') : barsToNext === 1 ? t('En 1 compás') : t('En {n} compases', { n: barsToNext })}</span>
            <span>
              c.{next.pos.bar} {next.text}
            </span>
          </>
        ) : (
          <span className="muted">{t('Sin más cues')}</span>
        )}
      </div>
      <div className={`stage-controls${setlist ? ' has-setlist' : ''}`}>
        {setlist && (
          <button className="icon-btn" onClick={setlist.onPrev} disabled={busy} aria-label={t('Canción anterior')}>
            <Icon name="prev" fill size={26} />
          </button>
        )}
        <HoldButton data-shortcut="back" onStep={() => onSkip(-1)} disabled={busy} aria-label={t('Retroceder un compás (mantén para seguir)')}>
          <Icon name="rew" fill size={30} />
        </HoldButton>
        <button data-shortcut="play" className={`play-btn stage-play${playing ? ' is-playing' : ''}`} onClick={onToggle} disabled={busy} aria-label={playing ? t('Pausar') : t('Reproducir')}>
          <Icon name={playing ? 'pause' : 'play'} fill size={40} />
        </button>
        <HoldButton data-shortcut="fwd" onStep={() => onSkip(1)} disabled={busy} aria-label={t('Adelantar un compás (mantén para seguir)')}>
          <Icon name="fwd" fill size={30} />
        </HoldButton>
        {setlist && (
          <button className="icon-btn" onClick={setlist.onNext} disabled={busy || !setlist.next} aria-label={t('Canción siguiente')}>
            <Icon name="next" fill size={26} />
          </button>
        )}
      </div>
      {status && <p className="muted">{status}</p>}
    </div>
  )
}
