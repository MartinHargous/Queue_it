import { useEffect, useRef, useState } from 'react'
import { Sheet } from './Sheet.jsx'
import { Stepper } from './Stepper.jsx'
import { Icon } from './icons.jsx'
import { startRecording } from '../lib/audio/recorder.js'
import { ttsBuffer } from '../lib/audio/tts.js'
import { resumeContext, decodeBlob, forgetDecoded } from '../lib/audio/context.js'
import { getBlob, putBlob, deleteBlob } from '../lib/db.js'
import { VOICES, cueVoice } from '../lib/audio/voices.js'
import { uid, isTimeCue, cueTime, barBeatAt, formatTimePrecise } from '../lib/model.js'
import { t, useLang } from '../lib/i18n.js'

const ANCHORS = [
  ['time', 'Segundos fijos'],
  ['bar', 'Compás'],
]

const KINDS = [
  ['tts', 'Voz sintética'],
  ['voice', 'Grabación'],
  ['text', 'Solo texto'],
]

export function CueSheet({ cue, project, timeline, lastBar, currentTime = 0, isNew, onSave, onDelete, onClose }) {
  useLang()
  const [draft, setDraft] = useState(() => ({ ...cue, anchor: cue.anchor ?? 'bar' }))
  const [recording, setRecording] = useState(null)
  const [recSeconds, setRecSeconds] = useState(0)
  const [newBlob, setNewBlob] = useState(null)
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)
  const previewNode = useRef(null)

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }))
  const firstBar = timeline.bars[0]?.bar ?? 1
  const beatsInBar = timeline.bars.find((b) => b.bar === draft.bar)?.num ?? 4
  const byTime = isTimeCue(draft)
  const maxTime = Math.max(0, timeline.duration)
  const round = (x) => Math.round(Math.min(maxTime, Math.max(0, x)) * 10) / 10
  const timePos = byTime ? barBeatAt(timeline, draft.time ?? 0) : null

  // Al cambiar el anclaje conserva el instante donde suena el cue
  const setAnchor = (anchor) => {
    if (anchor === draft.anchor) return
    if (anchor === 'time') set({ anchor, time: round(cueTime(timeline, draft) ?? 0) })
    else set({ anchor, ...barBeatAt(timeline, draft.time ?? 0) })
  }

  useEffect(() => {
    if (!recording) return
    const t0 = Date.now()
    const i = setInterval(() => setRecSeconds((Date.now() - t0) / 1000), 200)
    return () => clearInterval(i)
  }, [recording])

  const recRef = useRef(null)
  useEffect(() => {
    recRef.current = recording
  }, [recording])
  useEffect(
    () => () => {
      previewNode.current?.stop?.()
      recRef.current?.stop() // libera el micrófono si se cierra grabando
    },
    [],
  )

  const toggleRecord = async () => {
    setError(null)
    if (recording) {
      const blob = await recording.stop()
      setRecording(null)
      setNewBlob(blob)
      return
    }
    try {
      setRecSeconds(0)
      setRecording(await startRecording())
    } catch {
      setError(t('No hay acceso al micrófono. Revisa los permisos del navegador.'))
    }
  }

  const preview = async () => {
    setError(null)
    try {
      const ctx = await resumeContext()
      let buf = null
      if (draft.kind === 'tts') {
        if (!draft.text.trim()) return setError(t('Escribe el texto que debe decir la voz.'))
        setBusy(t('Generando voz…'))
        buf = await ttsBuffer(draft.text, cueVoice(project, draft))
      } else if (draft.kind === 'voice') {
        if (newBlob) buf = await ctx.decodeAudioData(await newBlob.arrayBuffer())
        else if (draft.blobId) buf = await decodeBlob(draft.blobId, await getBlob(draft.blobId))
      }
      if (!buf) return
      previewNode.current?.stop?.()
      const src = ctx.createBufferSource()
      const g = ctx.createGain()
      g.gain.value = draft.gain ?? 1
      src.buffer = buf
      src.connect(g).connect(ctx.destination)
      src.start()
      previewNode.current = src
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(null)
    }
  }

  const save = async () => {
    let out = byTime
      ? { ...draft, time: round(draft.time ?? 0) }
      : { ...draft, bar: Math.min(draft.bar, lastBar), beat: Math.min(draft.beat, beatsInBar) }
    if (newBlob) {
      const id = uid()
      await putBlob(id, newBlob)
      if (out.blobId) {
        await deleteBlob(out.blobId)
        forgetDecoded(out.blobId)
      }
      out.blobId = id
    }
    if (out.kind !== 'voice' && out.blobId) {
      await deleteBlob(out.blobId)
      out.blobId = null
    }
    onSave(out)
  }

  const remove = async () => {
    if (cue.blobId) await deleteBlob(cue.blobId)
    onDelete(cue.id)
  }

  const hasAudio = !!newBlob || !!draft.blobId

  return (
    <Sheet
      title={isNew ? t('Nuevo cue') : t('Editar cue')}
      onClose={onClose}
      footer={
        <>
          {!isNew && (
            <button className="btn is-danger" onClick={remove}>
              <Icon name="trash" size={20} /> {t('Eliminar')}
            </button>
          )}
          <button className="btn btn-primary grow" onClick={save} disabled={!!recording}>
            {t('Guardar cue')}
          </button>
        </>
      }
    >
      <div className="segmented" role="radiogroup" aria-label={t('Anclar el cue a')}>
        {ANCHORS.map(([k, label]) => (
          <button key={k} role="radio" aria-checked={draft.anchor === k} className={draft.anchor === k ? 'is-active' : ''} onClick={() => setAnchor(k)}>
            {t(label)}
          </button>
        ))}
      </div>

      {byTime ? (
        <>
          <Stepper
            label={t('Posición')}
            value={round(draft.time ?? 0)}
            min={0}
            max={maxTime}
            step={0.1}
            suffix="s"
            onChange={(v) => set({ time: round(v) })}
          />
          <div className="cue-anchor-info">
            <span className="muted">
              {formatTimePrecise(draft.time ?? 0)} · {t('cae en')} c.{timePos.bar}:{timePos.beat}
            </span>
            <button className="btn" onClick={() => set({ time: round(currentTime) })}>
              {t('Usar cursor')} ({formatTimePrecise(currentTime)})
            </button>
          </div>
          <p className="hint">{t('No se mueve si cambias el tempo o la estructura.')}</p>
        </>
      ) : (
        <>
          <div className="grid-2">
            <Stepper label={t('Compás')} value={draft.bar} min={firstBar} max={lastBar} onChange={(v) => set({ bar: v })} />
            <Stepper label={t('Tiempo')} value={Math.min(draft.beat, beatsInBar)} min={1} max={beatsInBar} onChange={(v) => set({ beat: v })} />
          </div>
          <p className="hint">{t('Sigue al compás: si cambias el tempo, el cue se mueve con la música.')}</p>
        </>
      )}

      <div className="segmented" role="radiogroup" aria-label={t('Tipo de cue')}>
        {KINDS.map(([k, label]) => (
          <button key={k} role="radio" aria-checked={draft.kind === k} className={draft.kind === k ? 'is-active' : ''} onClick={() => set({ kind: k })}>
            {t(label)}
          </button>
        ))}
      </div>

      <label className="field">
        <span>{draft.kind === 'tts' ? t('Texto que dirá la voz') : t('Nota en la hoja')}</span>
        <textarea
          rows={2}
          value={draft.text}
          placeholder={draft.kind === 'tts' ? t('Coro en dos, uno, dos') : t('Entra el bajo')}
          onChange={(e) => set({ text: e.target.value })}
        />
      </label>

      {draft.kind === 'tts' && (
        <label className="field">
          <span>{t('Idioma de la voz')}</span>
          <select value={draft.voice ?? ''} onChange={(e) => set({ voice: e.target.value || null })}>
            <option value="">
              {t('Como en Ajustes')} ({VOICES.find(([v]) => v === project.tts.voice)?.[1] ?? project.tts.voice})
            </option>
            {VOICES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
      )}

      {draft.kind === 'voice' && (
        <div className="record">
          <button className={`record-btn${recording ? ' is-recording' : ''}`} onClick={toggleRecord} aria-label={recording ? t('Detener grabación') : t('Grabar')}>
            <Icon name={recording ? 'stop' : 'mic'} fill={!!recording} size={26} />
          </button>
          <span className="record-label">
            {recording ? t('Grabando {s} s', { s: recSeconds.toFixed(1) }) : hasAudio ? (newBlob ? t('Grabación nueva lista') : t('Grabación guardada')) : t('Toca para grabar')}
          </span>
        </div>
      )}

      {draft.kind !== 'text' && (
        <>
          <label className="field">
            <span>{t('Volumen del cue')}</span>
            <input type="range" min="0" max="1.5" step="0.05" value={draft.gain ?? 1} onChange={(e) => set({ gain: Number(e.target.value) })} />
          </label>
          <button className="btn btn-block" onClick={preview} disabled={!!busy || !!recording || (draft.kind === 'voice' && !hasAudio)}>
            <Icon name="play" fill size={18} /> {busy ?? t('Escuchar')}
          </button>
        </>
      )}
      {error && (
        <p className="notice is-error" role="alert">
          {error}
        </p>
      )}
    </Sheet>
  )
}
