import { useState } from 'react'
import { deleteProject } from '../lib/db.js'
import { ttsBuffer } from '../lib/audio/tts.js'
import { resumeContext } from '../lib/audio/context.js'
import { VOICES, VARIANTS } from '../lib/audio/voices.js'
import { t, useLang } from '../lib/i18n.js'

// Frase de prueba en el idioma de la voz elegida
const SAMPLE = { es: 'Coro en dos. Uno, dos.', en: 'Chorus in two. One, two.', pt: 'Refrão em dois. Um, dois.', fr: 'Refrain dans deux. Un, deux.', it: 'Ritornello tra due. Uno, due.', de: 'Refrain in zwei. Eins, zwei.' }
const sampleFor = (voice) => SAMPLE[voice.split('/').pop().slice(0, 2)] ?? SAMPLE.en

export function SettingsPanel({ project, update, player, onBeforeDelete, onDeleted }) {
  useLang()
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
      const buf = await ttsBuffer(sampleFor(tts.voice), tts)
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
        <h3>{t('Mezcla')}</h3>
        <Slider label={t('Click')} value={mix.click} onChange={(v) => setMix('click', v)} />
        {project.kind === 'audio' && (
          <>
            <Slider label={t('Pista de audio')} value={mix.track} onChange={(v) => setMix('track', v)} />
            <label className="toggle">
              <input type="checkbox" checked={mix.clickOnAudio} onChange={(e) => setMix('clickOnAudio', e.target.checked)} />
              <span>{t('Sonar el click encima del audio')}</span>
            </label>
          </>
        )}
        <Slider label={t('Cues')} value={mix.cues} onChange={(v) => setMix('cues', v)} />
      </section>

      <section className="group">
        <h3>{t('Voz sintética')}</h3>
        <label className="field">
          <span>{t('Idioma de la voz')}</span>
          <select value={tts.voice} onChange={(e) => setTts({ voice: e.target.value })}>
            {VOICES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t('Timbre')}</span>
          <select value={tts.variant ?? ''} onChange={(e) => setTts({ variant: e.target.value })}>
            {VARIANTS.map(([v, l]) => (
              <option key={v} value={v}>
                {t(l)}
              </option>
            ))}
          </select>
        </label>
        <Slider label={`${t('Velocidad')} ${tts.speed}`} value={tts.speed} min={100} max={240} step={5} onChange={(v) => setTts({ speed: v })} />
        <Slider label={`${t('Tono')} ${tts.pitch}`} value={tts.pitch} min={0} max={99} step={1} onChange={(v) => setTts({ pitch: v })} />
        <button className="btn btn-block" onClick={testVoice} disabled={testing}>
          {testing ? t('Generando…') : t('Probar voz')}
        </button>
        <p className="hint">{t('La voz se genera en el teléfono (eSpeak), funciona sin internet y se incluye al exportar. Cada cue puede usar otro idioma.')}</p>
      </section>

      <section className="group">
        <h3>{t('Acerca de')}</h3>
        <p className="hint">
          {t('Queue it es software libre (AGPL-3.0).')}{' '}
          <a className="link" href="https://github.com/MartinHargous/Queue_it" target="_blank" rel="noopener noreferrer">
            {t('Código fuente')}
          </a>
        </p>
      </section>

      <section className="group">
        <h3>{t('Pista')}</h3>
        {confirm ? (
          <div className="grid-2">
            <button className="btn" onClick={() => setConfirm(false)}>
              {t('Cancelar')}
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
              {t('Sí, eliminar')}
            </button>
          </div>
        ) : (
          <button className="btn btn-ghost is-danger" onClick={() => setConfirm(true)}>
            {t('Eliminar esta pista')}
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
