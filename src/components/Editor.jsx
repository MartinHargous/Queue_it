import { useCallback, useEffect, useMemo, useState } from 'react'
import { useProject } from '../lib/useProject.js'
import { buildTimeline, cueTime, newCue, sortCues, formatTime } from '../lib/model.js'
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
import { StageView } from './StageView.jsx'

const TABS = [
  ['structure', 'Estructura'],
  ['cues', 'Cues'],
  ['settings', 'Ajustes'],
]

export function Editor({ id, goHome }) {
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
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [playing, player])

  useEffect(
    () => () => {
      player.stop()
      keepAwake(false)
    },
    [player],
  )

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

  const play = useCallback(async () => {
    if (player.playing) return stop()
    try {
      await resumeContext()
      setStatus('Preparando…')
      const res = await loadResources(project, { onStatus: setStatus })
      if (res.errors.length) setToast(`${res.errors.length} cue(s) no se pudieron preparar`)
      await player.play(project, timeline, res, startTime, () => {
        setPlaying(false)
        keepAwake(false)
      })
      setPlaying(true)
      keepAwake(true)
    } catch (err) {
      setToast(err.message || 'No se pudo reproducir')
    } finally {
      setStatus(null)
    }
  }, [project, timeline, startTime, stop, player])

  if (missing) {
    return (
      <div className="screen">
        <div className="empty">
          <p className="empty-title">Esta pista ya no existe</p>
          <button className="btn" onClick={goHome}>
            Volver a mis pistas
          </button>
        </div>
      </div>
    )
  }
  if (!project || !timeline) return <div className="screen" />

  const shownPos = playing ? pos : startTime
  const info = positionInfo(timeline, shownPos)
  const section = project.kind === 'metronome' ? project.sections[info.section] : null

  const markCue = () => {
    const i = Math.max(0, info.index)
    const b = timeline.beats[i]
    if (!b) return
    const cue = { ...newCue(b.bar, b.beat), text: '' }
    update((p) => ({ ...p, cues: [...p.cues, cue] }))
    setToast(`Cue marcado en c.${b.bar}:${b.beat}`)
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

  const cueList = sortCues(project.cues).map((c) => ({ ...c, t: cueTime(timeline, c) }))
  const lastBar = timeline.bars.at(-1)?.bar ?? 1

  return (
    <div className="screen editor">
      <header className="appbar">
        <button
          className="icon-btn"
          aria-label="Volver a mis pistas"
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
            aria-label="Nombre de la pista"
            onBlur={(e) => {
              const v = e.target.value.trim()
              if (v) update((p) => ({ ...p, title: v }))
              setEditingTitle(false)
            }}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
        ) : (
          <button className="title-btn" onClick={() => setEditingTitle(true)} aria-label="Cambiar nombre">
            {project.title}
          </button>
        )}
        <button className="icon-btn" aria-label="Exportar" onClick={() => setExporting(true)}>
          <Icon name="share" />
        </button>
      </header>

      <TrackMap project={project} timeline={timeline} getPos={getPos} playing={playing} onSeek={(t) => !playing && setStartTime(t)} />

      <nav className="tabs" role="tablist">
        {TABS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'is-active' : ''} onClick={() => setTab(k)}>
            {label}
            {k === 'cues' && project.cues.length > 0 && <span className="tab-count">{project.cues.length}</span>}
          </button>
        ))}
      </nav>

      <main className="panel">
        {tab === 'structure' && project.kind === 'metronome' && <SectionsPanel project={project} update={update} disabled={playing} />}
        {tab === 'structure' && project.kind === 'audio' && (
          <AudioPanel project={project} update={update} timeline={timeline} getPos={getPos} playing={playing} startTime={startTime} setStartTime={setStartTime} />
        )}
        {tab === 'cues' && (
          <CuesPanel
            cues={cueList}
            onAdd={() => {
              const b = info.index >= 0 ? timeline.beats[info.index] : timeline.beats[0]
              setEditingCue(newCue(b?.bar ?? 1, 1))
            }}
            onEdit={(c) => setEditingCue(project.cues.find((x) => x.id === c.id))}
          />
        )}
        {tab === 'settings' && (
          <SettingsPanel project={project} update={update} player={player} onBeforeDelete={discard} onDeleted={goHome} />
        )}
      </main>

      <footer className="transport">
        <div className="transport-pos" aria-live="off">
          <span className="pos-bar">
            {info.bar}
            <span className="pos-beat">.{Math.max(1, info.beat)}</span>
          </span>
          <span className="pos-meta">
            {section ? section.name : formatTime(shownPos)}
            {info.bpm ? `, ${Math.round(info.bpm)} bpm` : ''}
          </span>
        </div>
        <div className="transport-actions">
          <button className="icon-btn" onClick={markCue} aria-label="Marcar cue aquí" title="Marcar cue aquí">
            <Icon name="plus" />
          </button>
          <button className={`play-btn${playing ? ' is-playing' : ''}`} onClick={play} disabled={!!status} aria-label={playing ? 'Detener' : 'Reproducir'}>
            <Icon name={playing ? 'stop' : 'play'} fill size={30} />
          </button>
          <button className="icon-btn" onClick={() => setStage(true)} aria-label="Modo escenario" title="Modo escenario">
            <Icon name="stage" />
          </button>
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
          status={status}
          onToggle={play}
          onClose={() => setStage(false)}
        />
      )}
    </div>
  )
}
