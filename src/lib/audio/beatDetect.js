// Detección de pulso sin dependencias (corre en un Web Worker).
// 1) Envolvente de onsets por flujo espectral (log-magnitud, rectificado)
// 2) Tempo global por autocorrelación con prior log-normal centrado en 120 bpm
// 3) Seguimiento de beats por programación dinámica (Ellis, 2007)
// 4) Primer tiempo del compás estimado con la energía de graves en cada fase

const N_FFT = 1024
const HOP = 256

function fftInPlace(re, im) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      ;[re[i], re[j]] = [re[j], re[i]]
      ;[im[i], im[j]] = [im[j], im[i]]
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len
    const wr = Math.cos(ang)
    const wi = Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let cr = 1
      let ci = 0
      for (let k = 0; k < len / 2; k++) {
        const a = i + k
        const b = a + len / 2
        const tr = re[b] * cr - im[b] * ci
        const ti = re[b] * ci + im[b] * cr
        re[b] = re[a] - tr
        im[b] = im[a] - ti
        re[a] += tr
        im[a] += ti
        const ncr = cr * wr - ci * wi
        ci = cr * wi + ci * wr
        cr = ncr
      }
    }
  }
}

function downsample(x, sr) {
  const f = Math.max(1, Math.round(sr / 22050))
  if (f === 1) return { y: x, sr }
  const y = new Float32Array(Math.floor(x.length / f))
  for (let i = 0; i < y.length; i++) {
    let s = 0
    for (let k = 0; k < f; k++) s += x[i * f + k]
    y[i] = s / f
  }
  return { y, sr: sr / f }
}

function onsetEnvelope(y, sr, onProgress) {
  const pad = N_FFT / 2
  const frames = Math.max(1, Math.floor((y.length) / HOP))
  const win = new Float32Array(N_FFT)
  for (let i = 0; i < N_FFT; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N_FFT)
  const maxBin = Math.min(N_FFT / 2, Math.floor((8000 / sr) * N_FFT))
  const lowBin = Math.max(2, Math.floor((200 / sr) * N_FFT))
  const env = new Float32Array(frames)
  const low = new Float32Array(frames)
  let prev = new Float32Array(maxBin)
  const re = new Float32Array(N_FFT)
  const im = new Float32Array(N_FFT)
  for (let f = 0; f < frames; f++) {
    const start = f * HOP - pad
    for (let i = 0; i < N_FFT; i++) {
      const idx = start + i
      re[i] = idx >= 0 && idx < y.length ? y[idx] * win[i] : 0
      im[i] = 0
    }
    fftInPlace(re, im)
    const cur = new Float32Array(maxBin)
    let flux = 0
    let lflux = 0
    for (let k = 1; k < maxBin; k++) {
      const m = Math.log1p(100 * Math.hypot(re[k], im[k]))
      cur[k] = m
      const d = m - prev[k]
      if (d > 0) {
        flux += d
        if (k <= lowBin) lflux += d
      }
    }
    env[f] = flux
    low[f] = lflux
    prev = cur
    if (onProgress && f % 2000 === 0) onProgress(0.1 + 0.5 * (f / frames))
  }
  return { env: normalize(detrend(env, sr)), low: normalize(detrend(low, sr)) }
}

function detrend(env, sr) {
  // resta media móvil (~0.4 s) y rectifica
  const fps = sr / HOP
  const w = Math.max(1, Math.round(0.4 * fps))
  const out = new Float32Array(env.length)
  let acc = 0
  const q = []
  for (let i = 0; i < env.length; i++) {
    q.push(env[i])
    acc += env[i]
    if (q.length > w) acc -= q.shift()
    out[i] = Math.max(0, env[i] - acc / q.length)
  }
  return out
}

function normalize(x) {
  let m = 0
  for (const v of x) m += v
  m /= x.length || 1
  let sd = 0
  for (const v of x) sd += (v - m) ** 2
  sd = Math.sqrt(sd / (x.length || 1)) || 1
  const out = new Float32Array(x.length)
  for (let i = 0; i < x.length; i++) out[i] = x[i] / sd
  return out
}

function estimateTempo(env, fps) {
  const minLag = Math.floor((60 / 220) * fps)
  const maxLag = Math.ceil((60 / 45) * fps)
  let best = -Infinity
  let bestLag = Math.round((60 / 120) * fps)
  const ac = new Float32Array(maxLag + 2)
  for (let lag = minLag; lag <= maxLag + 1; lag++) {
    let s = 0
    for (let i = lag; i < env.length; i++) s += env[i] * env[i - lag]
    ac[lag] = s / (env.length - lag)
  }
  for (let lag = minLag; lag <= maxLag; lag++) {
    const bpm = (60 * fps) / lag
    const prior = Math.exp(-0.5 * (Math.log2(bpm / 120) / 1.0) ** 2)
    // refuerza con el armónico doble (compases con subdivisión clara)
    const harm = lag * 2 <= maxLag + 1 ? 0.5 * ac[lag * 2] : 0
    const score = (ac[lag] + harm) * prior
    if (score > best) {
      best = score
      bestLag = lag
    }
  }
  // interpolación parabólica
  const a = ac[bestLag - 1] ?? 0
  const b = ac[bestLag]
  const c = ac[bestLag + 1] ?? 0
  const den = a - 2 * b + c
  const shift = den !== 0 ? (0.5 * (a - c)) / den : 0
  const lag = bestLag + Math.max(-0.5, Math.min(0.5, shift))
  return (60 * fps) / lag
}

function trackBeats(env, fps, bpm, tightness = 100) {
  const period = (60 * fps) / bpm
  const radius = Math.round(period)
  const kernel = []
  for (let i = -radius; i <= radius; i++) kernel.push(Math.exp(-0.5 * ((i * 32) / period) ** 2))
  const n = env.length
  const local = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    let s = 0
    for (let k = 0; k < kernel.length; k++) {
      const j = i + k - radius
      if (j >= 0 && j < n) s += env[j] * kernel[k]
    }
    local[i] = s
  }
  const cum = new Float32Array(n)
  const back = new Int32Array(n).fill(-1)
  const lo = Math.round(period / 2)
  const hi = Math.round(period * 2)
  for (let i = 0; i < n; i++) {
    let best = -Infinity
    let arg = -1
    for (let p = i - hi; p <= i - lo; p++) {
      if (p < 0) continue
      const pen = -tightness * Math.log((i - p) / period) ** 2
      const v = cum[p] + pen
      if (v > best) {
        best = v
        arg = p
      }
    }
    cum[i] = local[i] + (arg >= 0 ? best : 0)
    back[i] = arg
  }
  // último beat: máximo local de cum sobre la mitad de la mediana de máximos
  const maxima = []
  for (let i = 1; i < n - 1; i++) if (cum[i] > cum[i - 1] && cum[i] >= cum[i + 1]) maxima.push(cum[i])
  maxima.sort((a, b) => a - b)
  const thr = 0.5 * (maxima[Math.floor(maxima.length / 2)] ?? 0)
  let last = n - 1
  for (let i = n - 2; i > 0; i--) {
    if (cum[i] > cum[i - 1] && cum[i] >= cum[i + 1] && cum[i] > thr) {
      last = i
      break
    }
  }
  const beats = []
  for (let i = last; i >= 0; i = back[i]) {
    beats.push(i)
    if (back[i] < 0) break
  }
  beats.reverse()
  // descarta beats débiles en los bordes (silencios iniciales/finales)
  const strength = beats.map((b) => local[b])
  const sorted = [...strength].sort((a, b) => a - b)
  const weak = 0.3 * (sorted[Math.floor(sorted.length / 2)] ?? 0)
  let s = 0
  let e = beats.length - 1
  while (s < e && strength[s] < weak) s++
  while (e > s && strength[e] < weak) e--
  return beats.slice(s, e + 1)
}

function estimateDownbeat(beatFrames, low, env, num) {
  let best = -Infinity
  let phase = 0
  for (let p = 0; p < num; p++) {
    let s = 0
    let c = 0
    for (let i = p; i < beatFrames.length; i += num) {
      const f = beatFrames[i]
      s += (low[f] ?? 0) * 2 + (env[f] ?? 0)
      c++
    }
    const v = c ? s / c : 0
    if (v > best) {
      best = v
      phase = p
    }
  }
  return phase
}

export function detectBeats(channelData, sampleRate, { num = 4, onProgress } = {}) {
  onProgress?.(0.02)
  const { y, sr } = downsample(channelData, sampleRate)
  const fps = sr / HOP
  const { env, low } = onsetEnvelope(y, sr, onProgress)
  onProgress?.(0.65)
  let bpm = estimateTempo(env, fps)
  onProgress?.(0.75)
  const frames = trackBeats(env, fps, bpm)
  onProgress?.(0.95)
  const beats = frames.map((f) => (f * HOP) / sr)
  if (beats.length > 4) {
    // tempo final = mediana de los intervalos detectados
    const iv = beats.slice(1).map((t, i) => t - beats[i]).sort((a, b) => a - b)
    bpm = 60 / iv[Math.floor(iv.length / 2)]
  }
  const downbeat = beats.length ? estimateDownbeat(frames, low, env, num) : 0
  onProgress?.(1)
  return { bpm, beats, downbeat, offset: beats[downbeat] ?? 0 }
}

// Primer tiempo del compás para pulsos calculados por otro detector (p. ej. essentia).
// Reutiliza la envolvente de graves de este módulo.
export function downbeatFromBeats(channelData, sampleRate, beats, num = 4) {
  if (!beats.length) return 0
  const { y, sr } = downsample(channelData, sampleRate)
  const { env, low } = onsetEnvelope(y, sr)
  const frames = beats.map((t) => Math.round((t * sr) / HOP))
  return estimateDownbeat(frames, low, env, num)
}
