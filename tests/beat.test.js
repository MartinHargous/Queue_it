// Regresión del detector de pulso sobre música SIN batería (arpegio de guitarra sintético).
// Usa el mismo essentia.js que la app y la misma función de primer tiempo (downbeatFromBeats).
import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { downbeatFromBeats, meterFromBeats } from '../src/lib/audio/beatDetect.js'
import { song } from './meter-fixtures.js'

const require = createRequire(import.meta.url)
const SR = 44100

// PRNG determinista para que el test no sea aleatorio
function rng(seed) {
  let s = seed >>> 0
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32)
}

// Arpegio de cuerda punteada en corcheas; el tiempo 1 de cada compás suena más fuerte.
function guitar({ bpm, bars, num = 4, startAt = 0.6 }) {
  const rand = rng(7)
  const beat = 60 / bpm
  const y = new Float32Array(Math.ceil((startAt + bars * num * beat + 2) * SR))
  const truth = []
  const chord = [110, 165, 220, 277]
  for (let b = 0; b < bars * num; b++) {
    const t = startAt + b * beat
    truth.push(t)
    for (let k = 0; k < 2; k++) {
      const f = chord[(b * 2 + k) % 4] * (k ? 2 : 1)
      const amp = b % num === 0 && k === 0 ? 1 : 0.6
      const i0 = Math.floor((t + (k * beat) / 2) * SR)
      const len = Math.floor(1.2 * SR)
      const ph = [0, 1, 2, 3, 4, 5].map(() => rand() * 6.28)
      for (let n = 0; n < len && i0 + n < y.length; n++) {
        const tt = n / SR
        let v = 0
        for (let h = 1; h <= 6; h++) v += ([1, 0.5, 0.33, 0.25, 0.18, 0.12][h - 1]) * Math.sin(2 * Math.PI * f * h * tt + ph[h - 1]) * Math.exp(-tt * 2.2 * (1 + 0.4 * h))
        y[i0 + n] += amp * v * Math.min(1, tt / 0.004)
      }
    }
  }
  let peak = 0
  for (const v of y) peak = Math.max(peak, Math.abs(v))
  for (let i = 0; i < y.length; i++) y[i] = (y[i] / peak) * 0.8
  return { y, truth }
}

// F-measure de pulsos con tolerancia ±70 ms (criterio habitual en MIR)
function fMeasure(est, truth, tol = 0.07) {
  const used = new Set()
  let hit = 0
  for (const t of truth) {
    let best = -1
    let bd = tol
    est.forEach((e, i) => {
      const d = Math.abs(e - t)
      if (d <= bd && !used.has(i)) { bd = d; best = i }
    })
    if (best >= 0) { used.add(best); hit++ }
  }
  const p = hit / Math.max(1, est.length)
  const r = hit / truth.length
  return p + r ? (2 * p * r) / (p + r) : 0
}

let essentia
before(async () => {
  const { Essentia, EssentiaWASM } = require('essentia.js')
  await new Promise((r) => setTimeout(r, 300)) // el WASM se inicia de forma asíncrona
  essentia = new Essentia(EssentiaWASM)
})

function detect(y, method) {
  const vec = essentia.arrayToVector(y)
  try {
    const r = essentia.RhythmExtractor2013(vec, 208, method, 40)
    const beats = Array.from(essentia.vectorToArray(r.ticks))
    r.ticks.delete()
    return { beats, bpm: r.bpm }
  } finally {
    vec.delete()
  }
}

test('música sin batería: essentia (degara) acierta tempo y pulsos', () => {
  const { y, truth } = guitar({ bpm: 92, bars: 16 })
  const r = detect(y, 'degara')
  assert.ok(Math.abs(r.bpm - 92) < 1.5, `bpm ${r.bpm}`)
  assert.ok(fMeasure(r.beats, truth) >= 0.9, `F ${fMeasure(r.beats, truth)}`)
})

test('el primer tiempo del compás cae en el acento', () => {
  const { y } = guitar({ bpm: 92, bars: 16 })
  const { beats } = detect(y, 'degara')
  const down = downbeatFromBeats(y, SR, beats, 4)
  // el acento está en el primer pulso detectado y cada 4: la fase correcta es 0
  assert.equal(down, 0)
})

// Compás: antes siempre quedaba en 4/4. Música sin batería en 3/4 y 4/4.
const meterCases = [
  { bpm: 120, num: 3, style: 'oompah' },
  { bpm: 90, num: 3, style: 'oompah' },
  { bpm: 76, num: 3, style: 'arp' },
  { bpm: 120, num: 4, style: 'oompah' },
  { bpm: 100, num: 4, style: 'arp' },
]
for (const c of meterCases) {
  test(`detecta el compás ${c.num}/4 (${c.style}, ${c.bpm} bpm) y su primer tiempo`, () => {
    const { y, downbeats } = song(c)
    const { beats } = detect(y, 'degara')
    const m = meterFromBeats(y, SR, beats)
    assert.equal(m.num, c.num)
    const marked = beats.filter((b, i) => i % m.num === m.downbeat && b > downbeats[0] - 0.1 && b < downbeats.at(-1) + 0.1)
    const hits = marked.filter((b) => downbeats.some((d) => Math.abs(d - b) < 0.07)).length
    assert.ok(hits >= marked.length - 1, `primer tiempo ${hits}/${marked.length}`)
  })
}
