import { openDB } from 'idb'

const dbp = openDB('queue-it', 2, {
  upgrade(db, oldVersion) {
    if (oldVersion < 1) {
      db.createObjectStore('projects', { keyPath: 'id' })
      db.createObjectStore('blobs')
      db.createObjectStore('tts')
    }
    if (oldVersion < 2) db.createObjectStore('setlists', { keyPath: 'id' }) // listas de reproducción
  },
})

export async function listProjects() {
  const all = await (await dbp).getAll('projects')
  return all.sort((a, b) => b.updatedAt - a.updatedAt)
}
export const getProject = async (id) => (await dbp).get('projects', id)
export const saveProject = async (p) => (await dbp).put('projects', { ...p, updatedAt: Date.now() })

export async function deleteProject(p) {
  const db = await dbp
  const tx = db.transaction(['projects', 'blobs'], 'readwrite')
  for (const id of projectBlobIds(p)) tx.objectStore('blobs').delete(id)
  tx.objectStore('projects').delete(p.id)
  await tx.done
}

export function projectBlobIds(p) {
  const ids = []
  if (p.audio?.blobId) ids.push(p.audio.blobId)
  for (const c of p.cues) if (c.blobId) ids.push(c.blobId)
  return ids
}

export async function listSetlists() {
  const all = await (await dbp).getAll('setlists')
  return all.sort((a, b) => b.updatedAt - a.updatedAt)
}
export const getSetlist = async (id) => (await dbp).get('setlists', id)
export const saveSetlist = async (l) => (await dbp).put('setlists', { ...l, updatedAt: Date.now() })
export const deleteSetlist = async (id) => (await dbp).delete('setlists', id)

export const getBlob = async (id) => (await dbp).get('blobs', id)
export const putBlob = async (id, blob) => (await dbp).put('blobs', blob, id)
export const deleteBlob = async (id) => (await dbp).delete('blobs', id)

export const getTts = async (key) => (await dbp).get('tts', key)
export const putTts = async (key, wav) => (await dbp).put('tts', wav, key)

// Pide al navegador no borrar los datos por presión de espacio
export async function requestPersistence() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist()
  } catch {
    /* no soportado */
  }
}
