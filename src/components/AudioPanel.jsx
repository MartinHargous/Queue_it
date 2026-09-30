import { memo, useEffect, useRef, useState } from 'react'
import { getBlob } from '../lib/db.js'
import { decodeBlob } from '../lib/audio/context.js'
import { detectInWorker, halveBeats, doubleBeats, computePeaks } from '../lib/audio/beat.js'
import { newGrid, formatTime } from '../lib/model.js'
import { Stepper } from './Stepper.jsx'
import { Waveform } from './Waveform.jsx'
import { t, useLang } from '../lib/i18n.js'

// memo: no se vuelve a dibujar ~15 veces por segundo mientras suena (la posición la lee cada hijo)
export const AudioPanel = memo(function AudioPanel({ project, update, timeline, getPos, playing, startTime, setStartTime }) {
  useLang()
  const [buffer, setBuffer] = useState(null)
  const [peaks, setPeaks] = useState(null)
  const [progress, setProgress] = useState(null) // null = sin tarea, -1 = sin avance medible, 0–1 = avance
  const [stage, setStage] = useState('')
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)
  const taps = useRef([])
  const grid = project.grid
  const audio = project.audio

  useEffect(() => {
    let alive = true
    if (!audio?.blobId) return
    getBlob(audio.blobId)
      .then((b) => decodeBlob(audio.blobId, b))
      .then((buf) => {
        if (!alive) return
        setBuffer(buf)
        setPeaks(computePeaks(buf))
      })
      .catch(() => alive && setError(t('No se pudo abrir el audio guardado.')))
    return () => {
      alive = false
    }
  }, [audio?.blobId])

  const setGrid = (patch) => update((p) => ({ ...p, grid: { ...p.grid, ...patch } }))

  // method: 'degara' (rápido) | 'multifeature' (alternativo, más lento: sirve de segunda opinión)
  const detect = async (method = 'degara') => {
    if (!buffer) return
    setError(null)
    setInfo(null)
    setStage(t('Preparando el audio…'))
    setProgress(-1)
    try {
      const r = await detectInWorker(buffer, {
        num: grid?.num ?? 4,
        method,
        onProgress: (v, label) => {
          setProgress(v)
          if (label) setStage(t(label))
        },
      })
      if (!r.beats.length) throw new Error(t('No se encontró un pulso claro. Usa tempo fijo.'))
      if (r.engine === 'basic') setInfo(t('No se pudo cargar el detector avanzado; se usó el básico. Revisa el resultado.'))
      update((p) => ({ ...p, grid: newGrid({ bpm: r.bpm, offset: r.offset, beats: r.beats, downbeat: r.downbeat, num: p.grid?.num ?? 4 }) }))
    } catch (err) {
      setError(err.message)
    } finally {
      setProgress(null)
    }
  }

  const manual = () => update((p) => ({ ...p, grid: newGrid({ bpm: 120, offset: 0 }) }))

  const tap = () => {
    const now = performance.now()
    taps.current = [...taps.current.filter((t) => now - t < 3000), now].slice(-8)
    if (taps.current.length >= 3) {
      const iv = taps.current.slice(1).map((t, i) => t - taps.current[i])
      const avg = iv.reduce((a, b) => a + b, 0) / iv.length
      setGrid({ bpm: Math.round((60000 / avg) * 2) / 2 })
    }
  }

  // Mueve el primer tiempo del compás un pulso hacia atrás o adelante
  const shiftDownbeat = (d) => {
    if (grid.mode === 'detected') {
      const n = grid.beats.length
      setGrid({ downbeat: (((grid.downbeat + d) % n) + n) % n })
    } else setGrid({ offset: Math.max(0, grid.offset + (d * 60) / grid.bpm) })
  }

  // Fija el compás 1 en el pulso más cercano al cursor
  const downbeatHere = () => {
    const t = getPos()
    if (grid.mode === 'detected') {
      let best = 0
      grid.beats.forEach((b, i) => {
        if (Math.abs(b - t) < Math.abs(grid.beats[best] - t)) best = i
      })
      setGrid({ downbeat: best })
    } else setGrid({ offset: Math.max(0, t - (grid.nudge || 0)) })
  }

  if (!audio) return <p className="notice is-error">{t('Esta pista no tiene audio.')}</p>

  return (
    <div className="stack">
      <div className="audio-file">
        <span className="audio-name">{audio.name}</span>
        <span className="muted">{formatTime(audio.duration)}</span>
      </div>

      {peaks && (
        <Waveform peaks={peaks} timeline={timeline} getPos={getPos} playing={playing} onScrub={(t) => setStartTime(Math.min(t, audio.duration))} />
      )}
      {!playing && peaks && <p className="hint">{t('Arrastra la onda para moverte. Cursor en {t}.', { t: formatTime(startTime) })}</p>}

      {progress != null && (
        <div
          className={`progress${progress < 0 ? ' is-indeterminate' : ''}`}
          role="progressbar"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow={progress < 0 ? undefined : Math.round(progress * 100)}
          aria-label={stage}
        >
          <span style={progress < 0 ? undefined : { width: `${progress * 100}%` }} />
          <em>{stage}</em>
        </div>
      )}
      {error && (
        <p className="notice is-error" role="alert">
          {error}
        </p>
      )}
      {info && (
        <p className="notice" role="status">
          {info}
        </p>
      )}

      {!grid && progress == null && (
        <div className="stack">
          <button className="btn btn-primary btn-block" onClick={() => detect('degara')} disabled={!buffer}>
            {t('Detectar pulso')}
          </button>
          <button className="btn btn-block" onClick={() => detect('multifeature')} disabled={!buffer}>
            {t('Probar otro método (más lento)')}
          </button>
          <button className="btn btn-block" onClick={manual}>
            {t('Poner el tempo a mano')}
          </button>
          <p className="hint">{t('Se hace en el teléfono, sin internet, y funciona con o sin batería. Si la canción tiene un tempo muy irregular, usa el tempo a mano.')}</p>
        </div>
      )}

      {grid && progress == null && (
        <div className="stack">
          <div className="bpm-readout">
            <span className="bpm-value">{Math.round(grid.bpm * 10) / 10}</span>
            <span className="muted">bpm</span>
          </div>

          <div className="segmented" role="radiogroup" aria-label={t('Modo de grilla')}>
            <button
              role="radio"
              aria-checked={grid.mode === 'detected'}
              className={grid.mode === 'detected' ? 'is-active' : ''}
              disabled={!grid.beats.length}
              onClick={() => setGrid({ mode: 'detected' })}
            >
              {t('Seguir el pulso detectado')}
            </button>
            <button role="radio" aria-checked={grid.mode === 'fixed'} className={grid.mode === 'fixed' ? 'is-active' : ''} onClick={() => setGrid({ mode: 'fixed', offset: grid.mode === 'detected' ? grid.beats[grid.downbeat] ?? 0 : grid.offset })}>
              {t('Tempo fijo')}
            </button>
          </div>

          {grid.mode === 'detected' ? (
            <div className="grid-2">
              <button className="btn" onClick={() => update((p) => ({ ...p, grid: halveBeats(p.grid) }))}>
                {t('½× tempo')}
              </button>
              <button className="btn" onClick={() => update((p) => ({ ...p, grid: doubleBeats(p.grid) }))}>
                {t('2× tempo')}
              </button>
            </div>
          ) : (
            <div className="grid-2 align-end">
              <Stepper label={t('Tempo')} value={grid.bpm} min={20} max={400} step={0.5} suffix="bpm" onChange={(v) => setGrid({ bpm: v })} />
              <button className="btn tap-btn" onClick={tap}>
                {t('Tap')}
              </button>
            </div>
          )}

          <div className="grid-2">
            <Stepper label={t('Tiempos por compás')} value={grid.num} min={1} max={16} onChange={(v) => setGrid({ num: v })} />
            <Stepper label={t('Ajuste fino')} value={Math.round((grid.nudge || 0) * 1000)} min={-300} max={300} step={5} suffix="ms" onChange={(v) => setGrid({ nudge: v / 1000 })} />
          </div>

          <div className="field">
            <span>{t('Primer tiempo del compás')}</span>
            <div className="grid-3">
              <button className="btn" onClick={() => shiftDownbeat(-1)} aria-label={t('Un pulso antes')}>
                {t('− 1 pulso')}
              </button>
              <button className="btn" onClick={downbeatHere} disabled={playing}>
                {t('Aquí')}
              </button>
              <button className="btn" onClick={() => shiftDownbeat(1)} aria-label={t('Un pulso después')}>
                {t('+ 1 pulso')}
              </button>
            </div>
          </div>

          <div className="grid-2">
            <button className="btn btn-ghost" onClick={() => detect('degara')} disabled={!buffer}>
              {t('Volver a detectar')}
            </button>
            <button className="btn btn-ghost" onClick={() => detect('multifeature')} disabled={!buffer}>
              {t('Otro método')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
})
