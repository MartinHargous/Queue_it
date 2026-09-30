import { useCallback, useEffect, useRef, useState } from 'react'
import { getProject, saveProject } from './db.js'

// Carga un proyecto y lo guarda automáticamente (con debounce) al cambiar.
export function useProject(id) {
  const [project, setProject] = useState(null)
  const [missing, setMissing] = useState(false)
  const latest = useRef(null)
  const timer = useRef(null)

  useEffect(() => {
    let alive = true
    getProject(id).then((p) => {
      if (!alive) return
      if (!p) setMissing(true)
      else {
        latest.current = p
        setProject(p)
      }
    })
    return () => {
      alive = false
    }
  }, [id])

  const flush = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = null
    if (latest.current) return saveProject(latest.current)
  }, [])

  // Descarta cualquier guardado pendiente (se usa justo antes de eliminar la pista)
  const discard = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = null
    latest.current = null
  }, [])

  const update = useCallback(
    (fn) => {
      setProject((prev) => {
        const next = typeof fn === 'function' ? fn(prev) : fn
        latest.current = next
        return next
      })
      clearTimeout(timer.current)
      timer.current = setTimeout(flush, 400)
    },
    [flush],
  )

  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && timer.current && flush()
    document.addEventListener('visibilitychange', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      if (timer.current) flush()
    }
  }, [flush])

  return { project, update, missing, flush, discard }
}
