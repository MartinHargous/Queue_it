// Detección de pulso en un Web Worker.
// Motor principal: essentia.js (WASM, funciona sin conexión). Si no carga o falla,
// se usa el detector propio de beatDetect.js, que es más simple.
import { detectBeats, meterFromBeats } from './beatDetect.js'

let essentiaPromise = null

function loadEssentia() {
  if (!essentiaPromise) {
    essentiaPromise = (async () => {
      const [wasmMod, coreMod] = await Promise.all([
        import('essentia.js/dist/essentia-wasm.es.js'),
        import('essentia.js/dist/essentia.js-core.es.js'),
      ])
      const wasm = wasmMod.EssentiaWASM
      // No se hace `await wasm`: es un objeto de Emscripten con `then` y podría no resolver.
      // Se espera a que el runtime exponga EssentiaJS.
      const t0 = Date.now()
      while (typeof wasm.EssentiaJS !== 'function') {
        if (Date.now() - t0 > 20000) throw new Error('essentia no inició a tiempo')
        await new Promise((r) => setTimeout(r, 25))
      }
      return new coreMod.default(wasm)
    })().catch((err) => {
      essentiaPromise = null // permite reintentar
      throw err
    })
  }
  return essentiaPromise
}

// Tempo a mostrar: el que estima essentia, salvo que se aleje mucho de lo que muestran
// los pulsos (error de octava o pulsos perdidos); ahí manda la mediana de los intervalos.
function pickBpm(beats, essentiaBpm) {
  if (beats.length < 5) return essentiaBpm
  const iv = beats.slice(1).map((t, i) => t - beats[i]).sort((a, b) => a - b)
  const med = 60 / iv[Math.floor(iv.length / 2)]
  return essentiaBpm > 0 && Math.abs(essentiaBpm - med) / med < 0.03 ? essentiaBpm : med
}

// `method`: 'degara' (rápido) o 'multifeature' (más lento, combina varias señales)
async function detectWithEssentia(signal, method) {
  const essentia = await loadEssentia()
  const vec = essentia.arrayToVector(signal)
  let ticksVec = null
  try {
    const r = essentia.RhythmExtractor2013(vec, 208, method, 40)
    ticksVec = r.ticks
    const beats = Array.from(essentia.vectorToArray(ticksVec))
    return { beats, bpm: r.bpm, confidence: r.confidence ?? 0 }
  } finally {
    vec.delete()
    ticksVec?.delete?.()
  }
}

self.onmessage = async (e) => {
  const { channelData, sampleRate, num, method = 'degara' } = e.data
  const post = (m) => self.postMessage(m)
  try {
    post({ type: 'progress', value: 0.05, label: 'Cargando el detector…' })
    let result
    try {
      post({ type: 'progress', value: -1, label: 'Analizando el ritmo…' })
      const r = await detectWithEssentia(channelData, method)
      if (r.beats.length < 4) throw new Error('essentia no encontró pulsos')
      post({ type: 'progress', value: -1, label: 'Buscando el compás y el primer tiempo…' })
      const meter = meterFromBeats(channelData, sampleRate, r.beats, num) // num null = estimarlo
      const downbeat = meter.downbeat
      result = {
        beats: r.beats,
        bpm: pickBpm(r.beats, r.bpm),
        num: meter.num,
        downbeat,
        offset: r.beats[downbeat] ?? 0,
        engine: 'essentia',
        method,
      }
    } catch (err) {
      console.warn('essentia no disponible, se usa el detector básico:', err)
      post({ type: 'progress', value: 0.1, label: 'Analizando el ritmo…' })
      const r = detectBeats(channelData, sampleRate, {
        num,
        onProgress: (p) => post({ type: 'progress', value: p, label: 'Analizando el ritmo…' }),
      })
      result = { ...r, engine: 'basic', method: 'basic' }
    }
    post({ type: 'done', result })
  } catch (err) {
    post({ type: 'error', message: String(err?.message || err) })
  }
}
