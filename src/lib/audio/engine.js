import { getContext, resumeContext, decodeBlob } from './context.js'
import { clickBuffer } from './clicks.js'
import { ttsBuffer } from './tts.js'
import { buildEvents, beatIndexAt, countInPlan } from '../model.js'
import { getBlob } from '../db.js'
import { cueVoice } from './voices.js'
import { t } from '../i18n.js'

const LOOKAHEAD = 1.5 // segundos programados por adelantado (tolera throttling en segundo plano)
const TICK_MS = 100

function createBuses(ctx, mix) {
  const master = ctx.createDynamicsCompressor()
  master.threshold.value = -3
  master.knee.value = 0
  master.ratio.value = 20
  master.attack.value = 0.002
  master.release.value = 0.1
  master.connect(ctx.destination)
  const mk = (g) => {
    const n = ctx.createGain()
    n.gain.value = g
    n.connect(master)
    return n
  }
  return { master, click: mk(mix.click), track: mk(mix.track), cue: mk(mix.cues) }
}

function scheduleEvent(ctx, buses, e, when, res) {
  let buffer = null
  let bus = null
  let gain = 1
  if (e.type === 'click') {
    buffer = clickBuffer(e.accent, ctx.sampleRate)
    bus = buses.click
  } else if (e.type === 'cue') {
    buffer = res.cueBuffers.get(e.cueId)
    bus = buses.cue
    gain = res.cueGain?.get(e.cueId) ?? 1
  }
  if (!buffer) return null
  const src = ctx.createBufferSource()
  src.buffer = buffer
  if (gain !== 1) {
    const g = ctx.createGain()
    g.gain.value = gain
    src.connect(g).connect(bus)
  } else src.connect(bus)
  src.when = Math.max(when, ctx.currentTime)
  src.start(src.when)
  return src
}

// Carga (decodifica/sintetiza) todo lo que necesita la reproducción o el render.
export async function loadResources(project, { onStatus } = {}) {
  const res = { track: null, cueBuffers: new Map(), cueGain: new Map(), errors: [] }
  if (project.kind === 'audio' && project.audio?.blobId) {
    onStatus?.(t('Cargando audio…'))
    const blob = await getBlob(project.audio.blobId)
    if (blob) res.track = await decodeBlob(project.audio.blobId, blob)
  }
  const speakable = project.cues.filter((c) => (c.kind === 'tts' && c.text.trim()) || (c.kind === 'voice' && c.blobId))
  let n = 0
  for (const c of speakable) {
    n++
    try {
      if (c.kind === 'tts') {
        onStatus?.(t('Preparando voz {n}/{total}…', { n, total: speakable.length }))
        res.cueBuffers.set(c.id, await ttsBuffer(c.text, cueVoice(project, c)))
      } else {
        const blob = await getBlob(c.blobId)
        if (blob) res.cueBuffers.set(c.id, await decodeBlob(c.blobId, blob))
      }
      res.cueGain.set(c.id, c.gain ?? 1)
    } catch (err) {
      res.errors.push({ cueId: c.id, message: err.message })
    }
  }
  onStatus?.(null)
  return res
}

export class Player {
  constructor() {
    this.playing = false
    this.nodes = new Set()
    this.timer = null
    this.from = 0
    this.ctxStart = 0
    this.onEnd = null
  }

  // opts.countIn: toca la cuenta inicial de la pista antes de empezar (no al saltar)
  async play(project, timeline, res, fromTime = 0, onEnd = null, opts = {}) {
    this.stop()
    this.ctx = await resumeContext()
    this.start(project, timeline, res, fromTime, onEnd, opts.countIn ? countInPlan(project, timeline, fromTime) : null)
  }

  // Parte sincrónica: no deja un instante sin reproducir (importante al saltar repetidamente)
  start(project, timeline, res, fromTime, onEnd, plan = null) {
    this.stop()
    this.onEnd = onEnd
    this.args = { project, timeline, res }
    const ctx = this.ctx
    this.buses = createBuses(ctx, project.mix)
    this.events = buildEvents(project, timeline)
    this.res = res
    this.from = fromTime
    this.lastPos = fromTime
    this.ctxStart = ctx.currentTime + 0.12 + (plan?.lead ?? 0)
    this.count = plan?.clicks.length ? plan.clicks : null
    for (const c of this.count ?? []) {
      const node = scheduleEvent(ctx, this.buses, { type: 'click', accent: c.accent }, this.ctxStart + (c.t - fromTime), res)
      if (node) {
        node.isCount = true
        this.nodes.add(node)
      }
    }
    let tail = 0.5
    for (const b of res.cueBuffers.values()) tail = Math.max(tail, b.duration + 0.1) // deja terminar el último cue
    this.end = Math.max(timeline.duration, res.track?.duration ?? 0) + tail
    this.idx = this.events.findIndex((e) => e.t >= fromTime - 0.001)
    if (this.idx < 0) this.idx = this.events.length
    if (res.track && fromTime < res.track.duration) {
      const src = ctx.createBufferSource()
      src.buffer = res.track
      src.connect(this.buses.track)
      src.start(this.ctxStart, fromTime)
      src.isTrack = true
      this.nodes.add(src)
    }
    this.playing = true
    this.tick()
    this.timer = setInterval(() => this.tick(), TICK_MS)
  }

  tick() {
    if (!this.playing) return
    const pos = this.position
    while (this.idx < this.events.length && this.events[this.idx].t < pos + LOOKAHEAD) {
      const e = this.events[this.idx++]
      const node = scheduleEvent(this.ctx, this.buses, e, this.ctxStart + (e.t - this.from), this.res)
      if (node) {
        this.nodes.add(node)
        node.onended = () => this.nodes.delete(node)
      }
    }
    if (pos > this.end) {
      this.stop()
      this.onEnd?.()
    }
  }

  // Aplica cambios del proyecto mientras suena (tempo, compases, cues, grilla) sin cortar:
  // cancela lo programado que todavía no sonó y reprograma desde el mismo punto.
  // mapTime(t) lleva un instante de la línea de tiempo vieja a la nueva (posición musical).
  update(project, timeline, res = this.res, mapTime = (t) => t) {
    if (!this.playing || !this.ctx) return
    const ctx = this.ctx
    const now = ctx.currentTime
    const counting = now < this.ctxStart // todavía suena la cuenta inicial
    for (const n of this.nodes) {
      if (n.isCount || n.isTrack || !(n.when > now + 0.005)) continue
      try {
        n.stop()
      } catch {
        /* ya detenido */
      }
      this.nodes.delete(n)
    }
    if (!counting) {
      const song = this.from + (now - this.ctxStart) // instante que se está programando ahora
      this.from = mapTime(song)
      this.ctxStart = now
      this.lastPos = this.from
    }
    this.args = { project, timeline, res }
    this.res = res
    this.events = buildEvents(project, timeline)
    this.idx = this.events.findIndex((e) => e.t > this.from + (counting ? -0.001 : 0.005))
    if (this.idx < 0) this.idx = this.events.length
    let tail = 0.5
    for (const b of res.cueBuffers.values()) tail = Math.max(tail, b.duration + 0.1)
    this.end = Math.max(timeline.duration, res.track?.duration ?? 0) + tail
    this.tick()
  }

  // Salta a otro instante sin volver a preparar los recursos
  seek(t) {
    if (!this.playing || !this.args) return
    const { project, timeline, res } = this.args
    this.start(project, timeline, res, Math.max(0, t), this.onEnd)
  }

  // Lo que suena ahora por el parlante. En Android `currentTime` avanza a saltos
  // (bloques de audio grandes), así que se interpola con el reloj de alta precisión:
  // getOutputTimestamp dice qué instante del contexto sonó en qué momento de performance.now().
  // Durante la cuenta inicial: { n, of } del pulso que suena; si no, null
  get countIn() {
    if (!this.playing || !this.count) return null
    const s = this.from + (this.ctx.currentTime - (this.ctx.outputLatency || this.ctx.baseLatency || 0) - this.ctxStart)
    if (s >= this.from) return null // ya entró la música
    let cur = null
    for (const c of this.count) if (c.t <= s + 0.02) cur = c
    return cur ? { n: cur.n, of: cur.of } : null
  }

  get position() {
    if (!this.playing || !this.ctx) return this.from
    let now
    const ts = this.ctx.getOutputTimestamp?.()
    if (ts?.performanceTime > 0 && ts.contextTime > 0) {
      now = ts.contextTime + (performance.now() - ts.performanceTime) / 1000
    } else {
      now = this.ctx.currentTime - (this.ctx.outputLatency || this.ctx.baseLatency || 0)
    }
    // Nunca antes del punto de partida (así adelantar varias veces seguidas avanza siempre)
    // y nunca hacia atrás por el ruido de la interpolación
    const p = this.from + Math.max(0, now - this.ctxStart)
    if (p > this.lastPos || p < this.lastPos - 0.25) this.lastPos = p
    return this.lastPos
  }

  setBusGain(name, value) {
    if (this.buses?.[name]) this.buses[name].gain.setTargetAtTime(value, this.ctx.currentTime, 0.02)
  }

  stop() {
    clearInterval(this.timer)
    this.timer = null
    for (const n of this.nodes) {
      try {
        n.stop()
      } catch {
        /* ya detenido */
      }
    }
    this.nodes.clear()
    this.buses?.master.disconnect()
    this.buses = null
    this.playing = false
  }
}

// Render completo a un AudioBuffer (para exportar)
export async function renderProject(project, timeline, res, { click = true, cues = true, track = true, countIn = false } = {}) {
  const sr = 44100
  const plan = countIn ? countInPlan(project, timeline, 0) : { clicks: [], lead: 0 }
  const lead = plan.lead // la cuenta inicial corre todo hacia adelante
  let tail = 0.4
  for (const b of res.cueBuffers.values()) tail = Math.max(tail, b.duration)
  const dur = lead + Math.max(timeline.duration + tail, track && res.track ? res.track.duration : 0)
  const ctx = new OfflineAudioContext(2, Math.ceil(dur * sr), sr)
  const buses = createBuses(ctx, project.mix)
  if (track && res.track) {
    const src = ctx.createBufferSource()
    src.buffer = res.track
    src.connect(buses.track)
    src.start(lead)
  }
  for (const c of plan.clicks) scheduleEvent(ctx, buses, { type: 'click', accent: c.accent }, lead + c.t, res)
  for (const e of buildEvents(project, timeline, { click, cues })) scheduleEvent(ctx, buses, e, lead + e.t, res)
  return ctx.startRendering()
}

// Estado musical en un instante (para la UI)
export function positionInfo(timeline, t) {
  const i = beatIndexAt(timeline, t)
  if (i < 0) return { bar: timeline.beats[0]?.bar ?? 1, beat: 0, num: timeline.beats[0]?.num ?? 4, section: 0, bpm: timeline.beats[0]?.bpm ?? 0, index: -1 }
  const b = timeline.beats[i]
  return { bar: b.bar, beat: b.beat, num: b.num, section: b.section, bpm: b.bpm, index: i }
}

export { getContext }
