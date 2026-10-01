import { useState } from 'react'
import { deleteProject } from '../lib/db.js'
import { ttsBuffer } from '../lib/audio/tts.js'
import { resumeContext } from '../lib/audio/context.js'
import { VOICES, VARIANTS } from '../lib/audio/voices.js'
import { t, useLang } from '../lib/i18n.js'
import { countInSettings, autoCountIn } from '../lib/model.js'
import { Stepper } from './Stepper.jsx'

// Frase de prueba en el idioma de la voz elegida
const SAMPLE = { es: 'Coro en dos. Uno, dos.', en: 'Chorus in two. One, two.', pt: 'Refrão em dois. Um, dois.', fr: 'Refrain dans deux. Un, deux.', it: 'Ritornello tra due. Uno, due.', de: 'Refrain in zwei. Eins, zwei.' }
const sampleFor = (voice) => SAMPLE[voice.split('/').pop().slice(0, 2)] ?? SAMPLE.en

export function SettingsPanel({ project, update, timeline, player, onBeforeDelete, onDeleted }) {
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
        <Slider label={t('Colas')} value={mix.cues} onChange={(v) => setMix('cues', v)} />
      </section>

      <CountInGroup project={project} update={update} timeline={timeline} />

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
        <p className="hint">{t('La voz se genera en el teléfono (eSpeak), funciona sin internet y se incluye al exportar. Cada cola puede usar otro idioma.')}</p>
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

// Cuenta inicial ("partida por metrónomo") antes de que empiece la canción
function CountInGroup({ project, update, timeline }) {
  const ci = countInSettings(project)
  const auto = autoCountIn(timeline, 0)
  const set = (patch) => update((p) => ({ ...p, countIn: { ...countInSettings(p), ...patch } }))
  return (
    <section className="group">
      <h3>{t('Cuenta inicial')}</h3>
      <label className="toggle">
        <input type="checkbox" checked={ci.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
        <span>{t('Contar con el metrónomo antes de empezar')}</span>
      </label>
      {ci.enabled && (
        <>
          <Stepper label={t('Compases de cuenta')} value={ci.bars} min={1} max={4} onChange={(v) => set({ bars: v })} />
          <div className="segmented" role="radiogroup" aria-label={t('Tempo de la cuenta')}>
            {[
              ['auto', 'Automática'],
              ['manual', 'Manual'],
            ].map(([k, label]) => (
              <button key={k} role="radio" aria-checked={ci.mode === k} className={ci.mode === k ? 'is-active' : ''} onClick={() => set({ mode: k })}>
                {t(label)}
              </button>
            ))}
          </div>
          {ci.mode === 'auto' ? (
            <p className="hint">
              {auto
                ? t('Usa el tempo y el compás de la pista ({num} tiempos a {bpm} bpm) y entra a tiempo con la música.', {
                    num: auto.num,
                    bpm: Math.round(auto.bpm * 10) / 10,
                  })
                : t('Todavía no hay tempo en la pista: se usa el manual.')}
            </p>
          ) : (
            <>
              <div className="grid-2">
                <Stepper label={t('Tempo')} value={ci.bpm} min={30} max={300} suffix="bpm" onChange={(v) => set({ bpm: v })} />
                <Stepper label={t('Tiempos por compás')} value={ci.num} min={1} max={16} onChange={(v) => set({ num: v })} />
              </div>
              {auto && (
                <button className="btn btn-ghost" onClick={() => set({ bpm: Math.round(auto.bpm), num: auto.num })}>
                  {t('Copiar lo detectado ({num}/4, {bpm} bpm)', { num: auto.num, bpm: Math.round(auto.bpm) })}
                </button>
              )}
            </>
          )}
        </>
      )}
    </section>
  )
}
