let ctx = null

// Un solo AudioContext para toda la app. Se crea/reanuda dentro de un gesto del usuario.
export function getContext() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    ctx = new AC({ latencyHint: 'playback' })
  }
  return ctx
}

export async function resumeContext() {
  const c = getContext()
  if (c.state !== 'running') await c.resume()
  return c
}

// Caché LRU: un audio decodificado ocupa ~10 MB por minuto (estéreo, 44,1 kHz).
// Sin límite, abrir varias pistas llena la memoria del teléfono.
const MAX_DECODED = 6
const decodeCache = new Map()

export async function decodeBlob(key, blob) {
  if (key && decodeCache.has(key)) {
    const hit = decodeCache.get(key)
    decodeCache.delete(key)
    decodeCache.set(key, hit) // lo marca como el más reciente
    return hit
  }
  const buf = await getContext().decodeAudioData(await blob.arrayBuffer())
  if (key) {
    decodeCache.set(key, buf)
    while (decodeCache.size > MAX_DECODED) decodeCache.delete(decodeCache.keys().next().value)
  }
  return buf
}

export function forgetDecoded(key) {
  decodeCache.delete(key)
}
