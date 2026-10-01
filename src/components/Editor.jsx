import { useCallback, useEffect, useMemo, useState } from 'react'
import { useProject } from '../lib/useProject.js'
import { buildTimeline, cueTime, cueBarBeat, newTimeCue, sortCues, formatTime, formatTimePrecise, skipTarget, mapMusicalTime } from '../lib/model.js'
import { Player, loadResources, positionInfo } from '../lib/audio/engine.js'
import { resumeContext } from '../lib/audio/context.js'
import { keepAwake } from '../lib/wakeLock.js'
import { Icon } from './icons.jsx'
import { SectionsPanel } from './SectionsPanel.jsx'
import { AudioPanel } from './AudioPanel.jsx'
import { CuesPanel } from './CuesPanel.jsx'
import { CueSheet } from './CueSheet.jsx'
import { SettingsPanel } from './SettingsPanel.jsx'
import { ExportSheet } from './ExportSheet.jsx'
import { TrackMap } from './TrackMap.jsx'
import { HoldButton } from './HoldButton.jsx'
import { StageView } from './StageView.jsx'
import { t, useLang } from '../lib/i18n.js'
import { useMedia } from '../lib/useMedia.js'

const TABS = [
  ['structure', 'Estructura'],
  ['cues', 'Colas'],
  ['settings', 'Ajustes'],
]

export function Editor({ id, goHome }) {
  useLang()
  const wide = useMedia('(min-width: 900px)')
  const xwide = useMedia('(min-width: 1280px)')
  const cols = xwide ? 3 : wide ? 2 : 1
  const { project, update, missing, flush, discard } = useProject(id)
  const [tab, setTab] = useState('structure')
  const [playing, setPlaying] = useState(false)
  const [status, setStatus] = useState(null)
  const [pos, setPos] = useState(0)
  const [startTime, setStartTime] = useState(0)
  const [editingCue, setEditingCue] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [stage, setStage] = useState(false)
  const [toast, setToast] = useState(null)
  const [editingTitle, setEditingTitle] = useState(false)
  const [scrub, setScrub] = useState(null) // posición mientras se arrastra la barra
  const [count, setCount] = useState(null) // pulso de la cuenta inicial que está sonando
  const [player] = useState(() => new Player())

  const timeline = useMemo(() => (project ? buildTimeline(project) : null), [project])

  const getPos = useCallback(() => (player.playing ? player.position : startTime), [startTime, player])

  // Refresca la posición en pantalla ~15 veces por segundo mientras suena
  useEffect(() => {
    if (!playing) return
    let raf
    let last = 0
    const loop = (ts) => {
      if (ts - last > 66) {
        last = ts
        setPos(player.position)
        const c = player.countIn
        setCount((prev) => (prev?.n === c?.n && !prev === !c ? prev : c))
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      setCount(null)
    }
  }, [playing, player])

  useEffect(
    () => () => {
      player.stop()
      keepAwake(false)
    },
    [player],
  )

  // Cambios mientras suena (tempo, compases, cues, grilla): se aplican al instante, sin pausar.
  // En el metrónomo se conserva el compás y el tiempo; en audio, el segundo de la canción.
  useEffect(() => {
    const prev = player.args
    if (!playing || !player.playing || !prev || prev.project === project || !timeline) return
    const map = project.kind === 'metronome' ? (t) => mapMusicalTime(prev.timeline, timeline, t) : (t) => t
    player.update(project, timeline, prev.res, map)
    // evita mostrar un cuadro con el segundo viejo sobre la grilla nueva
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza con el reproductor (sistema externo)
    setPos(player.position)
    // Un cue nuevo o una voz distinta necesitan preparar su audio (las voces quedan en caché)
    if (prev.project.cues === project.cues && prev.project.tts === project.tts) return
    let alive = true
    loadResources(project)
      .then((res) => {
        if (alive && player.playing && player.args?.project === project) player.update(project, timeline, res)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [project, timeline, playing, player])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2200)
    return () => clearTimeout(t)
  }, [toast])

  const stop = useCallback(() => {
    player.stop()
    setPlaying(false)
    keepAwake(false)
  }, [player])

  // Pausa: detiene y deja el cursor donde iba, para retomar desde ahí
  const pause = useCallback(() => {
    const t = player.position
    stop()
    setStartTime(Math.max(0, t))
    setPos(Math.max(0, t))
  }, [player, stop])

  const endTime = project && timeline ? Math.max(timeline.duration, project.audio?.duration ?? 0) : 0

  const seek = useCallback(
    (t) => {
      const to = Math.min(Math.max(0, t), endTime)
      if (player.playing) {
        player.seek(to)
        setPos(to)
      } else setStartTime(to)
    },
    [player, endTime],
  )

  const skip = (dir) => seek(skipTarget(timeline, getPos(), dir))

  const play = useCallback(async () => {
    if (player.playing) return pause()
    try {
      await resumeContext()
      setStatus(t('Preparando…'))
      const res = await loadResources(project, { onStatus: setStatus })
      if (res.errors.length) setToast(t('{n} cola(s) no se pudieron preparar', { n: res.errors.length }))
      const from = startTime >= endTime - 0.05 ? 0 : startTime // al final, vuelve a empezar
      if (from !== startTime) setStartTime(from)
      await player.play(
        project,
        timeline,
        res,
        from,
        () => {
          setPlaying(false)
          setStartTime(0)
          keepAwake(false)
        },
        { countIn: true },
      )
      setPlaying(true)
      keepAwake(true)
    } catch (err) {
      setToast(err.message || t('No se pudo reproducir'))
    } finally {
      setStatus(null)
    }
  }, [project, timeline, startTime, endTime, pause, player])

  if (missing) {
    return (
      <div className="screen">
        <div className="empty">
          <p className="empty-title">{t('Esta pista ya no existe')}</p>
          <button className="btn" onClick={goHome}>
            {t('Volver a mis pistas')}
          </button>
        </div>
      </div>
    )
  }
  if (!project || !timeline) return <div className="screen" />

  const shownPos = playing ? pos : startTime
  const info = positionInfo(timeline, shownPos)
  const section = project.kind === 'metronome' ? project.sections[info.section] : null

  // Marca un cue en el instante exacto (fijo en segundos, no se mueve si cambia el tempo)
  const markCue = () => {
    const cue = newTimeCue(playing ? player.position : startTime)
    update((p) => ({ ...p, cues: [...p.cues, cue] }))
    setToast(t('Cola marcada en {t}', { t: `${formatTimePrecise(cue.time)} (${t('c.')}${info.bar}:${Math.max(1, info.beat)})` }))
  }

  const saveCue = (cue) => {
    update((p) => {
      const exists = p.cues.some((c) => c.id === cue.id)
      return { ...p, cues: exists ? p.cues.map((c) => (c.id === cue.id ? cue : c)) : [...p.cues, cue] }
    })
    setEditingCue(null)
  }
  const deleteCue = (id) => {
    update((p) => ({ ...p, cues: p.cues.filter((c) => c.id !== id) }))
    setEditingCue(null)
  }

  const cueList = sortCues(project.cues, timeline).map((c) => ({ ...c, t: cueTime(timeline, c), pos: cueBarBeat(timeline, c) }))

  const panels = {
    structure:
      project.kind === 'metronome' ? (
        <SectionsPanel project={project} update={update} />
      ) : (
        <AudioPanel project={project} update={update} timeline={timeline} getPos={getPos} playing={playing} startTime={startTime} setStartTime={setStartTime} />
      ),
    cues: (
      <CuesPanel cues={cueList} onAdd={() => setEditingCue(newTimeCue(shownPos))} onEdit={(c) => setEditingCue(project.cues.find((x) => x.id === c.id))} />
    ),
    settings: <SettingsPanel project={project} update={update} timeline={timeline} player={player} onBeforeDelete={discard} onDeleted={goHome} />,
  }
  const sideTab = tab === 'settings' ? 'settings' : 'cues'
  const lastBar = timeline.bars.at(-1)?.bar ?? 1

  return (
    <div className="screen editor">
      <header className="appbar">
        <button
          className="icon-btn"
          aria-label={t('Volver a mis pistas')}
          onClick={async () => {
            stop()
            await flush()
            goHome()
          }}
        >
          <Icon name="back" />
        </button>
        {editingTitle ? (
          <input
            className="title-input"
            autoFocus
            defaultValue={project.title}
            aria-label={t('Nombre de la pista')}
            onBlur={(e) => {
              const v = e.target.value.trim()
              if (v) update((p) => ({ ...p, title: v }))
              setEditingTitle(false)
            }}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
        ) : (
          <button className="title-btn" onClick={() => setEditingTitle(true)} aria-label={t('Cambiar nombre')}>
            {project.title}
          </button>
        )}
        <button className="icon-btn" aria-label={t('Exportar')} onClick={() => setExporting(true)}>
          <Icon name="share" />
        </button>
      </header>

      <TrackMap project={project} timeline={timeline} getPos={getPos} onSeek={seek} />

      {cols === 1 ? (
        <>
          <nav className="tabs" role="tablist">
            {TABS.map(([k, label]) => (
              <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'is-active' : ''} onClick={() => setTab(k)}>
                {t(label)}
                {k === 'cues' && project.cues.length > 0 && <span className="tab-count">{project.cues.length}</span>}
              </button>
            ))}
          </nav>
          <main className="panel">{panels[tab]}</main>
        </>
      ) : (
        // PC: los paneles lado a lado. Con dos columnas, Cues y Ajustes comparten la derecha.
        <main className={`editor-cols cols-${cols}`}>
          <section className="col" aria-label={t('Estructura')}>
            <h2 className="col-title">{t('Estructura')}</h2>
            {panels.structure}
          </section>
          {cols === 3 ? (
            <>
              <section className="col" aria-label={t('Colas')}>
                <h2 className="col-title">
                  {t('Colas')} {project.cues.length > 0 && <span className="tab-count">{project.cues.length}</span>}
                </h2>
                {panels.cues}
              </section>
              <section className="col" aria-label={t('Ajustes')}>
                <h2 className="col-title">{t('Ajustes')}</h2>
                {panels.settings}
              </section>
            </>
          ) : (
            <section className="col">
              <nav className="tabs" role="tablist">
                {TABS.slice(1).map(([k, label]) => (
                  <button key={k} role="tab" aria-selected={sideTab === k} className={sideTab === k ? 'is-active' : ''} onClick={() => setTab(k)}>
                    {t(label)}
                    {k === 'cues' && project.cues.length > 0 && <span className="tab-count">{project.cues.length}</span>}
                  </button>
                ))}
              </nav>
              <div className="col-body">{panels[sideTab]}</div>
            </section>
          )}
        </main>
      )}

      <footer className="transport">
        <div className="transport-seek">
          <span className="seek-time">{formatTime(scrub ?? shownPos)}</span>
          <input
            type="range"
            className="seek"
            min={0}
            max={endTime || 1}
            step={0.1}
            value={Math.min(scrub ?? shownPos, endTime)}
            style={{ '--p': `${(Math.min(scrub ?? shownPos, endTime) / (endTime || 1)) * 100}%` }}
            disabled={!!status}
            aria-label={t('Posición en la pista')}
            onChange={(e) => {
              const t = Number(e.target.value)
              if (playing) setScrub(t) // sonando: salta al soltar
              else seek(t)
            }}
            onPointerUp={() => {
              if (scrub != null) seek(scrub)
              setScrub(null)
            }}
            onKeyUp={() => {
              if (scrub != null) seek(scrub)
              setScrub(null)
            }}
          />
          <span className="seek-time">{formatTime(endTime)}</span>
        </div>
        <div className="transport-row">
          <div className="transport-pos" aria-live="off">
            {count ? (
              <>
                <span className="pos-bar is-count">{count.n}</span>
                <span className="pos-meta">{t('Cuenta inicial')}</span>
              </>
            ) : (
              <>
                <span className="pos-bar">
                  {info.bar}
                  <span className="pos-beat">.{Math.max(1, info.beat)}</span>
                </span>
                <span className="pos-meta">
                  {section ? section.name : formatTime(shownPos)}
                  {info.bpm ? `, ${Math.round(info.bpm)} bpm` : ''}
                </span>
              </>
            )}
          </div>
          <div className="transport-actions">
            <button className="icon-btn" data-shortcut="mark" onClick={markCue} aria-label={t('Marcar cola aquí')} title={`${t('Marcar cola aquí')} (M)`}>
              <Icon name="plus" />
            </button>
            <HoldButton data-shortcut="back" onStep={() => skip(-1)} disabled={!!status} aria-label={t('Retroceder un compás (mantén para seguir)')} title={`${t('Retroceder (mantén presionado)')} (←)`}>
              <Icon name="rew" fill />
            </HoldButton>
            <button className={`play-btn${playing ? ' is-playing' : ''}`} data-shortcut="play" onClick={play} disabled={!!status} aria-label={playing ? t('Pausar') : t('Reproducir')} title={`${playing ? t('Pausar') : t('Reproducir')} (${t('espacio')})`}>
              <Icon name={playing ? 'pause' : 'play'} fill size={26} />
            </button>
            <HoldButton data-shortcut="fwd" onStep={() => skip(1)} disabled={!!status} aria-label={t('Adelantar un compás (mantén para seguir)')} title={`${t('Adelantar (mantén presionado)')} (→)`}>
              <Icon name="fwd" fill />
            </HoldButton>
            <button className="icon-btn" onClick={() => setStage(true)} aria-label={t('Modo escenario')} title={t('Modo escenario')}>
              <Icon name="stage" />
            </button>
          </div>
        </div>
        {status && <div className="transport-status">{status}</div>}
      </footer>

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}

      {editingCue && (
        <CueSheet
          cue={editingCue}
          project={project}
          timeline={timeline}
          lastBar={lastBar}
          currentTime={shownPos}
          isNew={!project.cues.some((c) => c.id === editingCue.id)}
          onSave={saveCue}
          onDelete={deleteCue}
          onClose={() => setEditingCue(null)}
        />
      )}
      {exporting && <ExportSheet project={project} timeline={timeline} onClose={() => setExporting(false)} />}
      {stage && (
        <StageView
          project={project}
          timeline={timeline}
          cues={cueList}
          pos={shownPos}
          playing={playing}
          countIn={count}
          status={status}
          onToggle={play}
          onSkip={skip}
          onClose={() => setStage(false)}
        />
      )}
    </div>
  )
}
