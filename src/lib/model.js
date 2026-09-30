// Modelo de datos y cálculo de la línea de tiempo.
// Todo aquí es puro (sin DOM ni Web Audio) para poder probarlo en Node.

export const uid = () =>
  (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36))

export const SCHEMA_VERSION = 1

export function newSection(prev, index = 0) {
  return {
    id: uid(),
    name: index === 0 ? 'Intro' : `Sección ${index + 1}`,
    bars: prev?.bars ?? 4,
    bpm: prev?.bpmEnd ?? prev?.bpm ?? 100,
    bpmEnd: null, // si tiene valor: cambio gradual lineal hasta este tempo
    num: prev?.num ?? 4,
    den: prev?.den ?? 4,
  }
}

export function newProject(kind) {
  const now = Date.now()
  return {
    id: uid(),
    schema: SCHEMA_VERSION,
    kind, // 'metronome' | 'audio'
    title: kind === 'audio' ? 'Pista desde audio' : 'Pista con metrónomo',
    createdAt: now,
    updatedAt: now,
    sections: kind === 'metronome' ? [newSection()] : [],
    audio: null, // { blobId, name, mime, duration }
    grid: null, // { mode: 'detected'|'fixed', bpm, offset, num, beats: number[], downbeat, nudge }
    cues: [],
    mix: { click: 0.8, track: 1, cues: 1, clickOnAudio: false },
    tts: { voice: 'es-la', speed: 160, pitch: 45 },
  }
}

// anchor: 'time' = fijo en segundos (no se mueve si cambia el tempo)
//         'bar'  = anclado a compás:tiempo (sigue a la estructura). Cues sin `anchor` son 'bar'.
export function newCue(bar = 1, beat = 1) {
  return { id: uid(), anchor: 'bar', time: null, bar, beat, kind: 'tts', text: '', blobId: null, gain: 1 }
}

export function newTimeCue(time = 0) {
  return { ...newCue(), anchor: 'time', time: Math.max(0, Math.round(time * 10) / 10) }
}

export const isTimeCue = (cue) => cue.anchor === 'time'

export function newGrid({ bpm = 120, offset = 0, beats = [], downbeat = 0, num = 4 } = {}) {
  return { mode: beats.length ? 'detected' : 'fixed', bpm, offset, num, beats, downbeat, nudge: 0 }
}

// Acentos: 1 = tiempo fuerte, 2 = acento secundario (compases compuestos), 3 = tiempo normal
function accentFor(beatInBar, num, den) {
  if (beatInBar === 1) return 1
  if (den === 8 && num > 3 && num % 3 === 0 && (beatInBar - 1) % 3 === 0) return 2
  return 3
}

// Devuelve { beats, bars, duration } con tiempos absolutos en segundos.
// beats[i] = { t, bar, beat, num, section, accent }
// bars[n]  = { bar, t, section, num, bpm }
export function buildTimeline(project) {
  if (project.kind === 'metronome') return metronomeTimeline(project.sections)
  return gridTimeline(project.grid, project.audio?.duration ?? 0)
}

function metronomeTimeline(sections) {
  const beats = []
  const bars = []
  let t = 0
  let bar = 1
  sections.forEach((s, si) => {
    const total = s.bars * s.num
    let i = 0
    for (let b = 0; b < s.bars; b++) {
      const barBpm = bpmAt(s, i, total)
      bars.push({ bar, t, section: si, num: s.num, den: s.den, bpm: barBpm })
      for (let k = 1; k <= s.num; k++) {
        const bpm = bpmAt(s, i, total)
        beats.push({ t, bar, beat: k, num: s.num, section: si, accent: accentFor(k, s.num, s.den), bpm })
        t += 60 / bpm
        i++
      }
      bar++
    }
  })
  return { beats, bars, duration: t }
}

function bpmAt(s, i, total) {
  if (!s.bpmEnd || s.bpmEnd === s.bpm || total <= 1) return s.bpm
  return s.bpm + (s.bpmEnd - s.bpm) * (i / (total - 1))
}

function gridTimeline(grid, duration) {
  const beats = []
  const bars = []
  if (!grid) return { beats, bars, duration }
  const num = grid.num || 4
  let times
  if (grid.mode === 'detected' && grid.beats?.length) {
    times = grid.beats.map((t) => t + (grid.nudge || 0))
  } else {
    const step = 60 / grid.bpm
    times = []
    const start = (grid.offset || 0) + (grid.nudge || 0)
    for (let t = start; t < duration; t += step) times.push(t)
  }
  const down = grid.mode === 'detected' ? grid.downbeat || 0 : 0
  times.forEach((t, i) => {
    if (t < 0 || (duration && t > duration)) return
    const rel = i - down
    const bar = Math.floor(rel / num) + 1 // anacrusa => compás 0
    const beat = (((rel % num) + num) % num) + 1
    const prev = times[i - 1]
    const next = times[i + 1]
    const period = next != null ? next - t : prev != null ? t - prev : 60 / (grid.bpm || 120)
    const b = { t, bar, beat, num, section: 0, accent: beat === 1 ? 1 : 3, bpm: 60 / period }
    beats.push(b)
    if (beat === 1 || bars.length === 0) {
      if (!bars.length || bars[bars.length - 1].bar !== bar) bars.push({ bar, t, section: 0, num, den: 4, bpm: b.bpm })
    }
  })
  return { beats, bars, duration }
}

export function cueTime(timeline, cue) {
  if (isTimeCue(cue)) {
    const t = cue.time ?? 0
    return t >= 0 && t <= timeline.duration + 0.001 ? t : null
  }
  const b = timeline.beats.find((x) => x.bar === cue.bar && x.beat === cue.beat)
  return b ? b.t : null
}

// Busca el beat vigente en un tiempo t (búsqueda binaria)
export function beatIndexAt(timeline, t) {
  const bs = timeline.beats
  let lo = 0
  let hi = bs.length - 1
  if (!bs.length || t < bs[0].t) return -1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (bs[mid].t <= t) lo = mid
    else hi = mid - 1
  }
  return lo
}

export function barStartTime(timeline, bar) {
  const b = timeline.bars.find((x) => x.bar === bar)
  return b ? b.t : 0
}

// Compás y tiempo en que cae un instante (para mostrar cues fijos en segundos)
export function barBeatAt(timeline, t) {
  const i = beatIndexAt(timeline, t)
  const b = timeline.beats[Math.max(0, i)]
  return b ? { bar: b.bar, beat: i < 0 ? 1 : b.beat } : { bar: 1, beat: 1 }
}

// Compás:tiempo en que suena un cue, sea cual sea su anclaje
export function cueBarBeat(timeline, cue) {
  if (!isTimeCue(cue)) return { bar: cue.bar, beat: cue.beat }
  return barBeatAt(timeline, cue.time ?? 0)
}

// Destino de los botones de adelantar/retroceder: inicio del compás siguiente o anterior.
// Retroceder dentro del primer medio segundo de un compás salta al anterior (se puede tocar varias veces).
export function skipTarget(timeline, t, dir) {
  const starts = timeline.bars.map((b) => b.t)
  if (starts[0] > 0.001) starts.unshift(0)
  if (!starts.length) return Math.max(0, t + dir * 5)
  if (dir > 0) {
    const next = starts.find((s) => s > t + 0.05)
    return next ?? t
  }
  let prev = 0
  for (const s of starts) if (s < t - 0.5) prev = s
  return prev
}

export function sortCues(cues, timeline) {
  if (!timeline) return [...cues].sort((a, b) => a.bar - b.bar || a.beat - b.beat)
  const key = (c) => cueTime(timeline, c) ?? Infinity
  return [...cues].sort((a, b) => key(a) - key(b))
}

export function formatTimePrecise(s) {
  if (!isFinite(s) || s < 0) s = 0
  const m = Math.floor(s / 60)
  const sec = (s - m * 60).toFixed(1).padStart(4, '0')
  return `${m}:${sec}`
}

// Eventos compartidos por el reproductor en vivo y el render offline
export function buildEvents(project, timeline, { click = true, cues = true } = {}) {
  const events = []
  const wantClick = click && (project.kind === 'metronome' || project.mix.clickOnAudio)
  if (wantClick) for (const b of timeline.beats) events.push({ t: b.t, type: 'click', accent: b.accent })
  if (cues) {
    for (const c of project.cues) {
      if (c.kind === 'text') continue
      const t = cueTime(timeline, c)
      if (t != null) events.push({ t, type: 'cue', cueId: c.id })
    }
  }
  events.sort((a, b) => a.t - b.t)
  return events
}

export function formatTime(s) {
  if (!isFinite(s) || s < 0) s = 0
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

export function cheatSheetText(project, timeline) {
  const lines = [project.title, '']
  const cues = sortCues(project.cues, timeline).map((c) => ({ ...c, pos: cueBarBeat(timeline, c), t: cueTime(timeline, c) }))
  if (project.kind === 'metronome') {
    let bar = 1
    project.sections.forEach((s) => {
      const end = bar + s.bars - 1
      const tempo = s.bpmEnd && s.bpmEnd !== s.bpm ? `${s.bpm}→${s.bpmEnd}` : `${s.bpm}`
      lines.push(`[${s.name}]  compases ${bar}–${end}  ·  ${s.num}/${s.den}  ·  ${tempo} bpm`)
      cues
        .filter((c) => c.t != null && c.pos.bar >= bar && c.pos.bar <= end)
        .forEach((c) => lines.push(`   c.${c.pos.bar}:${c.pos.beat}  (${formatTime(c.t)})  ${c.text || '(grabación)'}`))
      bar = end + 1
    })
  } else {
    const g = project.grid
    if (g) lines.push(`Tempo aprox. ${Math.round(g.bpm)} bpm  ·  ${g.num}/4`, '')
    cues.filter((c) => c.t != null).forEach((c) => {
      lines.push(`c.${c.pos.bar}:${c.pos.beat}  (${formatTime(c.t)})  ${c.text || '(grabación)'}`)
    })
  }
  lines.push('', `Duración ${formatTime(timeline.duration)}  ·  hecho con Queue it`)
  return lines.join('\n')
}
