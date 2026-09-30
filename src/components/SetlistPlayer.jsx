import { useCallback, useEffect, useRef, useState } from 'react'
import { buildTimeline, cueTime, cueBarBeat, sortCues, skipTarget } from '../lib/model.js'
import { Player, loadResources } from '../lib/audio/engine.js'
import { resumeContext } from '../lib/audio/context.js'
import { keepAwake } from '../lib/wakeLock.js'
import { t } from '../lib/i18n.js'
import { StageView } from './StageView.jsx'

// Prepara una canción (línea de tiempo, voces y audio decodificado)
async function prepare(project, onStatus) {
  const timeline = buildTimeline(project)
  const res = await loadResources(project, { onStatus })
  const cues = sortCues(project.cues, timeline).map((c) => ({ ...c, t: cueTime(timeline, c), pos: cueBarBeat(timeline, c) }))
  return { project, timeline, res, cues }
}

// Reproduce una lista canción tras canción en modo escenario.
export function SetlistPlayer({ songs, list, startIndex = 0, onClose }) {
  const [player] = useState(() => new Player())
  const [index, setIndex] = useState(startIndex)
  const [song, setSong] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [pos, setPos] = useState(0)
  const [count, setCount] = useState(null)
  const [status, setStatus] = useState(null)
  const [waiting, setWaiting] = useState(null) // segundos que faltan para la siguiente canción
  const cache = useRef(new Map()) // índice -> promesa de canción preparada
  const gapTimer = useRef(null)
  const alive = useRef(true)
  const endRef = useRef(null) // qué hacer al terminar una canción (siempre la versión más reciente)

  const load = useCallback(
    (i, onStatus) => {
      if (!cache.current.has(i)) {
        const p = prepare(songs[i], onStatus).catch((err) => {
          cache.current.delete(i)
          throw err
        })
        cache.current.set(i, p)
      }
      return cache.current.get(i)
    },
    [songs],
  )

  const cancelGap = () => {
    clearInterval(gapTimer.current)
    gapTimer.current = null
    setWaiting(null)
  }

  // Empieza la canción i (con su cuenta inicial) y deja preparada la siguiente
  const start = useCallback(
    async (i, from = 0) => {
      cancelGap()
      player.stop()
      setPlaying(false)
      setIndex(i)
      setPos(from)
      try {
        await resumeContext()
        setStatus(t('Preparando…'))
        const s = await load(i, setStatus)
        if (!alive.current) return
        setSong(s)
        setStatus(null)
        await player.play(s.project, s.timeline, s.res, from, () => endRef.current?.(i), { countIn: true })
        setPlaying(true)
        keepAwake(true)
        if (i + 1 < songs.length) load(i + 1).catch(() => {}) // en segundo plano
        for (const k of cache.current.keys()) if (k < i - 1) cache.current.delete(k) // libera memoria
      } catch (err) {
        setStatus(err.message || t('No se pudo reproducir'))
      }
    },
    [player, load, songs.length],
  )

  function onSongEnd(i) {
    setPlaying(false)
    setPos(0)
    if (!list.autoAdvance || i + 1 >= songs.length) {
      keepAwake(false)
      return
    }
    let left = list.gap
    if (left <= 0) return start(i + 1)
    setWaiting(left)
    gapTimer.current = setInterval(() => {
      left--
      if (left <= 0) start(i + 1)
      else setWaiting(left)
    }, 1000)
  }

  useEffect(() => {
    endRef.current = onSongEnd
  })

  // Carga la primera canción al abrir (sin sonar hasta tocar play)
  useEffect(() => {
    alive.current = true
    load(startIndex, setStatus)
      .then((s) => {
        if (!alive.current) return
        setSong(s)
        setStatus(null)
      })
      .catch((err) => setStatus(err.message))
    return () => {
      alive.current = false
      clearInterval(gapTimer.current)
      player.stop()
      keepAwake(false)
    }
  }, [load, player, startIndex])

  // Posición y cuenta inicial en pantalla
  useEffect(() => {
    if (!playing) return
    let raf
    let last = 0
    const loop = (ts) => {
      if (ts - last > 66) {
        last = ts
        setPos(player.position)
        const c = player.countIn
        setCount((prev) => (prev?.n === c?.n && !prev === !c ? prev : c))
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      setCount(null)
    }
  }, [playing, player])

  const toggle = () => {
    if (player.playing) {
      const p = player.position
      player.stop()
      setPlaying(false)
      setPos(p)
      keepAwake(false)
    } else if (waiting != null) start(index + 1)
    else start(index, song && pos < song.timeline.duration - 0.05 ? pos : 0)
  }

  const skip = (dir) => {
    if (!song) return
    const to = skipTarget(song.timeline, player.playing ? player.position : pos, dir)
    if (player.playing) player.seek(to)
    setPos(to)
  }

  const goSong = (i) => {
    if (i < 0 || i >= songs.length) return
    const wasPlaying = player.playing || waiting != null
    cancelGap()
    player.stop()
    setPlaying(false)
    if (wasPlaying) return start(i)
    setIndex(i)
    setPos(0)
    setSong(null)
    setStatus(t('Preparando…'))
    load(i, setStatus)
      .then((s) => {
        if (!alive.current) return
        setSong(s)
        setStatus(null)
      })
      .catch((err) => setStatus(err.message))
  }

  const current = song?.project ?? songs[index]
  const timeline = song?.timeline ?? { beats: [], bars: [], duration: 0 }
  return (
    <StageView
      project={current}
      timeline={timeline}
      cues={song?.cues ?? []}
      pos={pos}
      playing={playing}
      status={waiting != null ? t('Siguiente canción en {n} s', { n: waiting }) : status}
      countIn={count}
      setlist={{
        index,
        total: songs.length,
        next: songs[index + 1]?.title ?? null,
        onPrev: () => goSong(pos > 3 ? index : index - 1),
        onNext: () => goSong(index + 1),
      }}
      controlsDisabled={!song}
      onToggle={toggle}
      onSkip={skip}
      onClose={onClose}
    />
  )
}
