import { t } from '../i18n.js'
import { getContext } from './context.js'
import { getTts, putTts } from '../db.js'

let worker = null
let seq = 0
const pending = new Map()
const memory = new Map()

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL('./tts.worker.js', import.meta.url), { type: 'module' })
    worker.onmessage = (e) => {
      const p = pending.get(e.data.id)
      if (!p) return
      pending.delete(e.data.id)
      if (e.data.error) p.reject(new Error(t(e.data.error)))
      else p.resolve(e.data.wav)
    }
  }
  return worker
}

function synthWav(text, settings) {
  return new Promise((resolve, reject) => {
    const id = ++seq
    pending.set(id, { resolve, reject })
    getWorker().postMessage({ id, text, voice: settings.voice, variant: settings.variant || '', speed: settings.speed, pitch: settings.pitch })
  })
}

export const ttsKey = (text, s) => `${s.voice}${s.variant ? '+' + s.variant : ''}|${s.speed}|${s.pitch}|${text.trim()}`

// Devuelve un AudioBuffer con la voz sintetizada. Cachea en memoria e IndexedDB.
export async function ttsBuffer(text, settings) {
  const key = ttsKey(text, settings)
  if (memory.has(key)) return memory.get(key)
  let wav = await getTts(key)
  if (!wav) {
    wav = await synthWav(text.trim(), settings)
    await putTts(key, wav.slice(0))
  }
  const buf = polish(await getContext().decodeAudioData(wav.slice(0)))
  memory.set(key, buf)
  return buf
}

// Recorta el silencio del principio (la voz cae justo en su lugar) y del final,
// y lleva el pico a un nivel parejo para que todas las frases suenen igual de fuerte.
// Un filtro suave quita parte del zumbido agudo típico de eSpeak.
export function polish(buf) {
  const data = buf.getChannelData(0)
  const sr = buf.sampleRate
  const th = 0.02
  let start = 0
  while (start < data.length && Math.abs(data[start]) < th) start++
  let end = data.length - 1
  while (end > start && Math.abs(data[end]) < th) end--
  if (end <= start) return buf
  start = Math.max(0, start - Math.round(sr * 0.004))
  end = Math.min(data.length - 1, end + Math.round(sr * 0.08))
  let peak = 0
  for (let i = start; i <= end; i++) peak = Math.max(peak, Math.abs(data[i]))
  const gain = peak > 0 ? 0.9 / peak : 1
  const fade = Math.round(sr * 0.003)
  const len = end - start + 1
  const out = getContext().createBuffer(1, len, sr)
  const o = out.getChannelData(0)
  const a = Math.exp((-2 * Math.PI * 6500) / sr) // pasa bajos de un polo a ~6,5 kHz
  let y = 0
  for (let i = 0; i < len; i++) {
    y = (1 - a) * data[start + i] + a * y
    const env = Math.min(1, i / fade, (len - 1 - i) / fade)
    o[i] = y * gain * env
  }
  return out
}
