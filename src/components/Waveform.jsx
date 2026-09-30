import { useEffect, useRef } from 'react'

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
    let lastW = 0
    const css = getComputedStyle(cv)
    const col = (n) => css.getPropertyValue(n).trim()
    const draw = () => {
      const pos = getPosRef.current()
      const dpr = window.devicePixelRatio || 1
      const w = cv.clientWidth
      const h = cv.clientHeight
      if (pos !== lastPos || w !== lastW) {
        lastPos = pos
        lastW = w
        if (cv.width !== w * dpr) cv.width = w * dpr
        if (cv.height !== h * dpr) cv.height = h * dpr
        const g = cv.getContext('2d')
        g.setTransform(dpr, 0, 0, dpr, 0, 0)
        g.clearRect(0, 0, w, h)
        const t0 = pos - WINDOW * LEAD
        const pxPerSec = w / WINDOW
        // forma de onda
        g.fillStyle = col('--wave')
        const { peaks: pk, perSecond } = peaks
        const mid = h / 2
        for (let x = 0; x < w; x++) {
          const t = t0 + x / pxPerSec
          const i = Math.floor(t * perSecond)
          if (i < 0 || i >= pk.length) continue
          const a = pk[i] * (h * 0.46)
          g.fillRect(x, mid - a, 1, a * 2 || 1)
        }
        // grilla
        for (const b of timeline.beats) {
          if (b.t < t0 || b.t > t0 + WINDOW) continue
          const x = Math.round((b.t - t0) * pxPerSec) + 0.5
          const down = b.beat === 1
          g.fillStyle = down ? col('--amber') : col('--grid')
          g.fillRect(x - (down ? 1 : 0.5), 0, down ? 2 : 1, h)
          if (down) {
            g.font = '600 13px "Barlow Condensed", sans-serif'
            g.fillText(String(b.bar), x + 4, 14)
          }
        }
        // cursor
        const cx = Math.round(WINDOW * LEAD * pxPerSec)
        g.fillStyle = col('--text')
        g.fillRect(cx - 1, 0, 2, h)
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
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
      aria-label="Forma de onda con la grilla de pulsos. Arrastra para moverte."
      role="img"
    />
  )
}
