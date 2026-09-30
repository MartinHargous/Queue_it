// Sonidos de click sintetizados (sin samples externos): 1 fuerte, 2 secundario, 3 normal
const cache = new Map()

export function clickBuffer(accent, sampleRate = 44100) {
  const key = `${accent}@${sampleRate}`
  if (cache.has(key)) return cache.get(key)
  const len = Math.floor(sampleRate * 0.06)
  const buf = new AudioBuffer({ length: len, sampleRate, numberOfChannels: 1 })
  const d = buf.getChannelData(0)
  const freq = accent === 1 ? 1880 : accent === 2 ? 1500 : 1250
  const amp = accent === 1 ? 1 : accent === 2 ? 0.8 : 0.62
  for (let i = 0; i < len; i++) {
    const t = i / sampleRate
    const env = Math.exp(-t * 90)
    const tone = Math.sin(2 * Math.PI * freq * t) * 0.8 + Math.sin(2 * Math.PI * freq * 2.01 * t) * 0.2
    const attack = Math.min(1, i / 24)
    d[i] = amp * attack * env * tone
  }
  cache.set(key, buf)
  return buf
}
