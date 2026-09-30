import { useState } from 'react'
import { deleteProject } from '../lib/db.js'
import { ttsBuffer } from '../lib/audio/tts.js'
import { resumeContext } from '../lib/audio/context.js'

const VOICES = [
  ['es-la', 'Español latinoamericano'],
  ['es', 'Español de España'],
]

export function SettingsPanel({ project, update, player, onBeforeDelete, onDeleted }) {
  const [confirm, setConfirm] = useState(false)
  const [testing, setTesting] = useState(false)
  const mix = project.mix
  const tts = project.tts

  const setMix = (k, v) => {
    update((p) => ({ ...p, mix: { ...p.mix, [k]: v } }))
    const bus = { click: 'click', track: 'track', cues: 'cue' }[k]
    if (bus) player.setBusGain(bus, v)
  }
  const setTts = (patch) => update((p) => ({ ...p, tts: { ...p.tts, ...patch } }))

  const testVoice = async () => {
    setTesting(true)
    try {
      const ctx = await resumeContext()
      const buf = await ttsBuffer('Coro en dos. Uno, dos.', tts)
      const src = ctx.createBufferSource()
      src.buffer = buf
      src.connect(ctx.destination)
      src.start()
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="stack">
      <section className="group">
        <h3>Mezcla</h3>
        <Slider label="Click" value={mix.click} onChange={(v) => setMix('click', v)} />
        {project.kind === 'audio' && (
          <>
            <Slider label="Pista de audio" value={mix.track} onChange={(v) => setMix('track', v)} />
            <label className="toggle">
              <input type="checkbox" checked={mix.clickOnAudio} onChange={(e) => setMix('clickOnAudio', e.target.checked)} />
              <span>Sonar el click encima del audio</span>
            </label>
          </>
        )}
        <Slider label="Cues" value={mix.cues} onChange={(v) => setMix('cues', v)} />
      </section>

      <section className="group">
        <h3>Voz sintética</h3>
        <label className="field">
          <span>Variante</span>
          <select value={tts.voice} onChange={(e) => setTts({ voice: e.target.value })}>
            {VOICES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <Slider label={`Velocidad ${tts.speed}`} value={tts.speed} min={100} max={240} step={5} onChange={(v) => setTts({ speed: v })} />
        <Slider label={`Tono ${tts.pitch}`} value={tts.pitch} min={0} max={99} step={1} onChange={(v) => setTts({ pitch: v })} />
        <button className="btn btn-block" onClick={testVoice} disabled={testing}>
          {testing ? 'Generando…' : 'Probar voz'}
        </button>
        <p className="hint">La voz se genera en el teléfono (eSpeak), funciona sin internet y se incluye al exportar.</p>
      </section>

      <section className="group">
        <h3>Acerca de</h3>
        <p className="hint">
          Queue it es software libre (AGPL-3.0).{' '}
          <a className="link" href="https://github.com/MartinHargous/Queue_it" target="_blank" rel="noopener noreferrer">
            Código fuente
          </a>
        </p>
      </section>

      <section className="group">
        <h3>Pista</h3>
        {confirm ? (
          <div className="grid-2">
            <button className="btn" onClick={() => setConfirm(false)}>
              Cancelar
            </button>
            <button
              className="btn is-danger"
              onClick={async () => {
                player.stop()
                onBeforeDelete?.()
                await deleteProject(project)
                onDeleted()
              }}
            >
              Sí, eliminar
            </button>
          </div>
        ) : (
          <button className="btn btn-ghost is-danger" onClick={() => setConfirm(true)}>
            Eliminar esta pista
          </button>
        )}
      </section>
    </div>
  )
}

function Slider({ label, value, onChange, min = 0, max = 1.5, step = 0.05 }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  )
}
