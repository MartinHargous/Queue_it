// AudioBuffer -> Blob WAV PCM 16 bits
export function encodeWav(buffer) {
  const ch = buffer.numberOfChannels
  const sr = buffer.sampleRate
  const len = buffer.length
  const bytes = 44 + len * ch * 2
  const out = new ArrayBuffer(bytes)
  const v = new DataView(out)
  const str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)))
  str(0, 'RIFF')
  v.setUint32(4, bytes - 8, true)
  str(8, 'WAVE')
  str(12, 'fmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true)
  v.setUint16(22, ch, true)
  v.setUint32(24, sr, true)
  v.setUint32(28, sr * ch * 2, true)
  v.setUint16(32, ch * 2, true)
  v.setUint16(34, 16, true)
  str(36, 'data')
  v.setUint32(40, len * ch * 2, true)
  const chans = Array.from({ length: ch }, (_, i) => buffer.getChannelData(i))
  let o = 44
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < ch; c++) {
      const s = Math.max(-1, Math.min(1, chans[c][i]))
      v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true)
      o += 2
    }
  }
  return new Blob([out], { type: 'audio/wav' })
}
