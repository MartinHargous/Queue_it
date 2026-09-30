// essentia.js exige 44,1 kHz mono. Android suele decodificar a 48 kHz, así que se remuestrea
// con OfflineAudioContext (filtro de calidad del navegador) y se mezcla a mono.
const ESSENTIA_RATE = 44100

async function toMono44k(audioBuffer) {
  if (audioBuffer.sampleRate === ESSENTIA_RATE && audioBuffer.numberOfChannels === 1) {
    return audioBuffer.getChannelData(0).slice()
  }
  const len = Math.ceil(audioBuffer.duration * ESSENTIA_RATE)
  const ctx = new OfflineAudioContext(1, len, ESSENTIA_RATE)
  const src = ctx.createBufferSource()
  src.buffer = audioBuffer
  src.connect(ctx.destination) // la mezcla estéreo → mono la hace el navegador
  src.start()
  const out = await ctx.startRendering()
  return out.getChannelData(0).slice()
}

// Lanza la detección de pulso en un worker con el audio ya decodificado.
// method: 'degara' (rápido, por defecto) | 'multifeature' (más lento; no siempre mejor).
// onProgress(valor, etiqueta): valor 0–1, o -1 cuando no se puede medir el avance.
export async function detectInWorker(audioBuffer, { num = 4, method = 'degara', onProgress } = {}) {
  const mono = await toMono44k(audioBuffer)
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./beat.worker.js', import.meta.url), { type: 'module' })
    worker.onmessage = (e) => {
      if (e.data.type === 'progress') onProgress?.(e.data.value, e.data.label)
      else {
        worker.terminate()
        if (e.data.type === 'done') resolve(e.data.result)
        else reject(new Error(e.data.message))
      }
    }
    worker.onerror = (e) => {
      worker.terminate()
      reject(new Error(e.message || 'No se pudo iniciar el detector'))
    }
    worker.postMessage({ channelData: mono, sampleRate: ESSENTIA_RATE, num, method }, [mono.buffer])
  })
}

// Corrige errores de octava del tempo detectado
export function halveBeats(grid) {
  const keep = grid.downbeat % 2
  const beats = grid.beats.filter((_, i) => i % 2 === keep)
  return { ...grid, beats, bpm: grid.bpm / 2, downbeat: Math.floor(grid.downbeat / 2) }
}

export function doubleBeats(grid) {
  const beats = []
  grid.beats.forEach((t, i) => {
    beats.push(t)
    const next = grid.beats[i + 1]
    if (next != null) beats.push((t + next) / 2)
  })
  return { ...grid, beats, bpm: grid.bpm * 2, downbeat: grid.downbeat * 2 }
}

// Picos para dibujar la forma de onda
export function computePeaks(audioBuffer, perSecond = 200) {
  const d = audioBuffer.getChannelData(0)
  const step = Math.max(1, Math.floor(audioBuffer.sampleRate / perSecond))
  const n = Math.ceil(d.length / step)
  const peaks = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    let m = 0
    const end = Math.min(d.length, (i + 1) * step)
    for (let k = i * step; k < end; k++) {
      const v = Math.abs(d[k])
      if (v > m) m = v
    }
    peaks[i] = m
  }
  return { peaks, perSecond: audioBuffer.sampleRate / step }
}
