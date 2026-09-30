import { useEffect, useRef } from 'react'
import { t } from '../lib/i18n.js'

const WINDOW = 8 // segundos visibles
const LEAD = 0.25 // posición del cursor dentro de la ventana

// Forma de onda con la grilla de pulsos. Arrastra para moverte cuando está detenido.
export function Waveform({ peaks, timeline, getPos, playing, onScrub }) {
  const canvas = useRef(null)
  const drag = useRef(null)
  const getPosRef = useRef(getPos)
  useEffect(() => {
    getPosRef.current = getPos
  })

  useEffect(() => {
    const cv = canvas.current
    if (!cv || !peaks) return
    let raf
    let lastPos = null
    // Colores y tamaño se leen una vez (leer el layout en cada cuadro fuerza recalcular la página)
    const css = getComputedStyle(cv)
    const col = (n) => css.getPropertyValue(n).trim()
    const colors = { wave: col('--wave'), amber: col('--amber'), grid: col('--grid'), text: col('--text') }
    let w = cv.clientWidth
    let h = cv.clientHeight
    const ro = new ResizeObserver(() => {
      w = cv.clientWidth
      h = cv.clientHeight
      lastPos = null
    })
    ro.observe(cv)
    const g = cv.getContext('2d')
    const { peaks: pk, perSecond } = peaks
    const beats = timeline.beats

    const draw = () => {
      raf = requestAnimationFrame(draw)
      const pos = getPosRef.current()
      if (pos === lastPos || !w) return
      lastPos = pos
      const dpr = window.devicePixelRatio || 1
      if (cv.width !== Math.round(w * dpr)) cv.width = Math.round(w * dpr)
      if (cv.height !== Math.round(h * dpr)) cv.height = Math.round(h * dpr)
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, w, h)
      const t0 = pos - WINDOW * LEAD
      const pxPerSec = w / WINDOW
      const mid = h / 2
      // forma de onda: el máximo de todos los picos que caen en cada columna
      // (tomar uno solo hace que la onda "tiemble" al desplazarse)
      const perPx = perSecond / pxPerSec
      g.fillStyle = colors.wave
      g.beginPath()
      for (let x = 0; x < w; x++) {
        const i0 = Math.floor((t0 + x / pxPerSec) * perSecond)
        const i1 = Math.max(i0 + 1, Math.floor(i0 + perPx))
        if (i1 <= 0 || i0 >= pk.length) continue
        let m = 0
        for (let i = Math.max(0, i0); i < Math.min(pk.length, i1); i++) if (pk[i] > m) m = pk[i]
        const a = Math.max(0.5, m * (h * 0.46))
        g.rect(x, mid - a, 1, a * 2)
      }
      g.fill()
      // grilla: solo los pulsos visibles (búsqueda binaria)
      let lo = 0
      let hi = beats.length
      while (lo < hi) {
        const m = (lo + hi) >> 1
        if (beats[m].t < t0) lo = m + 1
        else hi = m
      }
      g.font = '600 13px "Barlow Condensed", sans-serif'
      for (let k = lo; k < beats.length && beats[k].t <= t0 + WINDOW; k++) {
        const b = beats[k]
        const x = (b.t - t0) * pxPerSec
        const down = b.beat === 1
        g.fillStyle = down ? colors.amber : colors.grid
        g.fillRect(x - (down ? 1 : 0.5), 0, down ? 2 : 1, h)
        if (down) g.fillText(String(b.bar), x + 4, 14)
      }
      // cursor
      const cx = Math.round(WINDOW * LEAD * pxPerSec)
      g.fillStyle = colors.text
      g.fillRect(cx - 1, 0, 2, h)
    }
    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [peaks, timeline])

  const onDown = (e) => {
    if (playing) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, pos: getPos() }
  }
  const onMove = (e) => {
    if (!drag.current) return
    const w = canvas.current.clientWidth
    const dt = ((drag.current.x - e.clientX) / w) * WINDOW
    onScrub(Math.max(0, drag.current.pos + dt))
  }
  const onUp = () => (drag.current = null)

  return (
    <canvas
      ref={canvas}
      className={`waveform${playing ? '' : ' is-draggable'}`}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      aria-label={t('Forma de onda con la grilla de pulsos. Arrastra para moverte.')}
      role="img"
    />
  )
}
