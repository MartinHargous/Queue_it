import { useEffect, useRef } from 'react'
import { cueTime } from '../lib/model.js'

// Mapa de la pista completa: secciones a escala, cues y cursor. Tocar = ir a ese compás.
export function TrackMap({ project, timeline, getPos, onSeek }) {
  const head = useRef(null)
  const getPosRef = useRef(getPos)
  useEffect(() => {
    getPosRef.current = getPos
  })
  const dur = Math.max(timeline.duration, project.audio?.duration ?? 0) || 1

  useEffect(() => {
    let raf
    const loop = () => {
      if (head.current) head.current.style.left = `${Math.min(100, (getPosRef.current() / dur) * 100)}%`
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [dur])

  const blocks = []
  if (project.kind === 'metronome') {
    let start = 0
    project.sections.forEach((s, i) => {
      const next = timeline.bars.find((b) => b.section === i + 1)?.t ?? timeline.duration
      blocks.push({ id: s.id, name: s.name, left: (start / dur) * 100, width: ((next - start) / dur) * 100 })
      start = next
    })
  } else if (timeline.bars.length) {
    // Bloques de compases como referencia visual; el tamaño crece con el largo para que los números no se encimen
    const size = [4, 8, 16, 32, 64].find((n) => timeline.bars.length / n <= 10) ?? 128
    for (let i = 0; i < timeline.bars.length; i += size) {
      const a = timeline.bars[i]
      const b = timeline.bars[i + size]
      blocks.push({ id: a.bar, name: String(a.bar), left: (a.t / dur) * 100, width: (((b?.t ?? timeline.duration) - a.t) / dur) * 100 })
    }
  }

  const seek = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    const t = ((e.clientX - r.left) / r.width) * dur
    // Ajusta al inicio del compás más cercano (hacia atrás)
    let bar = timeline.bars[0]
    for (const b of timeline.bars) if (b.t <= t + 0.001) bar = b
    onSeek(bar ? bar.t : Math.max(0, t))
  }

  return (
    <div className="trackmap is-seekable" onClick={seek} role="presentation">
      {blocks.map((b) => (
        <span key={b.id} className="trackmap-block" style={{ left: `${b.left}%`, width: `${b.width}%` }}>
          <span>{b.name}</span>
        </span>
      ))}
      {project.cues.map((c) => {
        const t = cueTime(timeline, c)
        return t == null ? null : <i key={c.id} className="trackmap-cue" style={{ left: `${(t / dur) * 100}%` }} />
      })}
      <b ref={head} className="trackmap-head" />
    </div>
  )
}
