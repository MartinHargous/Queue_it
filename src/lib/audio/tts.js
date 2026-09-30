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
      if (e.data.error) p.reject(new Error(e.data.error))
      else p.resolve(e.data.wav)
    }
  }
  return worker
}

function synthWav(text, settings) {
  return new Promise((resolve, reject) => {
    const id = ++seq
    pending.set(id, { resolve, reject })
    getWorker().postMessage({ id, text, voice: settings.voice, speed: settings.speed, pitch: settings.pitch })
  })
}

export const ttsKey = (text, s) => `${s.voice}|${s.speed}|${s.pitch}|${text.trim()}`

// Devuelve un AudioBuffer con la voz sintetizada. Cachea en memoria e IndexedDB.
export async function ttsBuffer(text, settings) {
  const key = ttsKey(text, settings)
  if (memory.has(key)) return memory.get(key)
  let wav = await getTts(key)
  if (!wav) {
    wav = await synthWav(text.trim(), settings)
    await putTts(key, wav.slice(0))
  }
  const buf = await getContext().decodeAudioData(wav.slice(0))
  memory.set(key, buf)
  return buf
}
