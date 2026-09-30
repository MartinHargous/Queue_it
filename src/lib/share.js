import { getBlob, putBlob, saveProject, projectBlobIds } from './db.js'
import { uid, SCHEMA_VERSION } from './model.js'

export function safeName(s) {
  return (s || 'pista').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'pista'
}

// Comparte con el menú nativo de Android; si no se puede, descarga.
export async function shareOrDownload(blob, filename) {
  const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename })
      return 'shared'
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled'
    }
  }
  downloadBlob(blob, filename)
  return 'downloaded'
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

const toB64 = (buf) => {
  const bytes = new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}
const fromB64 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))

// Respaldo completo: proyecto + audios embebidos en un JSON
export async function exportProjectFile(project) {
  const blobs = {}
  for (const id of projectBlobIds(project)) {
    const b = await getBlob(id)
    if (b) blobs[id] = { type: b.type, data: toB64(await b.arrayBuffer()) }
  }
  const payload = { format: 'queue-it', schema: SCHEMA_VERSION, project, blobs }
  return new Blob([JSON.stringify(payload)], { type: 'application/json' })
}

export async function importProjectFile(file) {
  const data = JSON.parse(await file.text())
  if (data?.format !== 'queue-it' || !data.project) throw new Error('El archivo no es un proyecto de Queue it.')
  const map = {}
  for (const [oldId, b] of Object.entries(data.blobs || {})) {
    const id = uid()
    map[oldId] = id
    await putBlob(id, new Blob([fromB64(b.data)], { type: b.type }))
  }
  const p = structuredClone(data.project)
  p.id = uid()
  if (p.audio?.blobId) p.audio.blobId = map[p.audio.blobId] ?? null
  p.cues = p.cues.map((c) => ({ ...c, blobId: c.blobId ? map[c.blobId] ?? null : null }))
  await saveProject(p)
  return p
}
