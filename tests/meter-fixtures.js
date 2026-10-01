// Música sintética SIN batería para probar la detección de compás.
export const SR = 44100

function rng(seed) {
  let s = seed >>> 0
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32)
}

// Nota tipo piano/guitarra: armónicos con caída exponencial
function pluck(y, t0, f, amp, rand, dur = 1.4) {
  const i0 = Math.floor(t0 * SR)
  const len = Math.floor(dur * SR)
  const ph = [0, 1, 2, 3, 4].map(() => rand() * 6.28)
  for (let n = 0; n < len && i0 + n < y.length; n++) {
    const tt = n / SR
    let v = 0
    for (let h = 1; h <= 5; h++) v += [1, 0.45, 0.3, 0.2, 0.12][h - 1] * Math.sin(2 * Math.PI * f * h * tt + ph[h - 1]) * Math.exp(-tt * 2.5 * (1 + 0.3 * h))
    y[i0 + n] += amp * v * Math.min(1, tt / 0.004)
  }
}

const PROG = [
  [110, 220, 277, 330], // A
  [146.8, 293.7, 370, 440], // D
  [123.5, 246.9, 311, 370], // B
  [164.8, 329.6, 415, 494], // E
]

// style 'oompah': bajo en el 1 y acorde en los demás tiempos (vals / balada)
// style 'arp': arpegio parejo, sin acentos; solo cambia el acorde en cada compás
export function song({ bpm, num, bars = 16, style = 'oompah', startAt = 0.5, seed = 3 }) {
  const rand = rng(seed)
  const beat = 60 / bpm
  const y = new Float32Array(Math.ceil((startAt + bars * num * beat + 2) * SR))
  const downbeats = []
  for (let bar = 0; bar < bars; bar++) {
    const ch = PROG[bar % PROG.length]
    for (let k = 0; k < num; k++) {
      const t = startAt + (bar * num + k) * beat
      if (k === 0) downbeats.push(t)
      if (style === 'oompah') {
        if (k === 0 || (num === 4 && k === 2)) pluck(y, t, ch[0] / (k === 0 ? 1 : 1.5), 1, rand, 1.8)
        else for (const f of ch.slice(1)) pluck(y, t, f, 0.35, rand, 0.6)
      } else {
        pluck(y, t, ch[(k % 3) + 1], 0.6, rand, 0.9)
        if (k === 0) pluck(y, t, ch[0], 0.6, rand, 1.8)
      }
    }
  }
  let peak = 0
  for (const v of y) peak = Math.max(peak, Math.abs(v))
  for (let i = 0; i < y.length; i++) y[i] = (y[i] / peak) * 0.8
  return { y, downbeats }
}
