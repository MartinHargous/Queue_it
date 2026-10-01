import { useEffect, useRef, useState } from 'react'
import { getSetlist, saveSetlist, deleteSetlist, listProjects } from '../lib/db.js'
import { buildTimeline, formatTime, moveItem } from '../lib/model.js'
import { t, tn, useLang } from '../lib/i18n.js'
import { Icon } from './icons.jsx'
import { Sheet } from './Sheet.jsx'
import { Stepper } from './Stepper.jsx'
import { SetlistPlayer } from './SetlistPlayer.jsx'

const songDuration = (p) => buildTimeline(p).duration || p.audio?.duration || 0

// Lista de reproducción: canciones en orden, se editan y se reproducen seguidas.
export function SetlistView({ id, goHome }) {
  useLang()
  const [list, setList] = useState(null)
  const [projects, setProjects] = useState(null) // id -> pista
  const [missing, setMissing] = useState(false)
  const [adding, setAdding] = useState(false)
  const [playFrom, setPlayFrom] = useState(null) // índice con el que se abre el reproductor
  const [confirm, setConfirm] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const saveTimer = useRef(null)

  useEffect(() => {
    let alive = true
    Promise.all([getSetlist(id), listProjects()]).then(([l, ps]) => {
      if (!alive) return
      if (!l) return setMissing(true)
      setProjects(new Map(ps.map((p) => [p.id, p])))
      setList(l)
    })
    return () => {
      alive = false
    }
  }, [id])

  // Guarda con un pequeño debounce (los cambios de orden llegan seguidos)
  const update = (fn) =>
    setList((prev) => {
      const next = fn(prev)
      clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => saveSetlist(next), 300)
      return next
    })
  useEffect(() => () => clearTimeout(saveTimer.current), [])

  if (missing) {
    return (
      <div className="screen">
        <div className="empty">
          <p className="empty-title">{t('Esta lista ya no existe')}</p>
          <button className="btn" onClick={goHome}>
            {t('Volver')}
          </button>
        </div>
      </div>
    )
  }
  if (!list || !projects) return <div className="screen" />

  // Las pistas eliminadas desaparecen de la lista sin romperla
  const items = list.items.map((pid, i) => ({ key: `${i}-${pid}`, i, project: projects.get(pid) })).filter((x) => x.project)
  const songs = items.map((x) => x.project)
  const total = songs.reduce((a, p) => a + songDuration(p), 0)

  return (
    <div className="screen">
      <header className="appbar">
        <button
          className="icon-btn"
          aria-label={t('Volver')}
          onClick={async () => {
            clearTimeout(saveTimer.current)
            await saveSetlist(list)
            goHome()
          }}
        >
          <Icon name="back" />
        </button>
        {editingName ? (
          <input
            className="title-input"
            autoFocus
            defaultValue={list.name}
            aria-label={t('Nombre de la lista')}
            onBlur={(e) => {
              const v = e.target.value.trim()
              if (v) update((l) => ({ ...l, name: v }))
              setEditingName(false)
            }}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
        ) : (
          <button className="title-btn" onClick={() => setEditingName(true)} aria-label={t('Cambiar nombre')}>
            {list.name}
          </button>
        )}
      </header>

      <main className="home-list stack setlist-main">
        <p className="muted setlist-summary">
          {songs.length} {tn(songs.length, 'canción', 'canciones')} · {formatTime(total)}
        </p>

        {items.length === 0 ? (
          <div className="empty small">
            <p className="empty-title">{t('Lista vacía')}</p>
            <p className="muted">{t('Agrega pistas para tocarlas una tras otra, con su cuenta inicial y sus colas.')}</p>
          </div>
        ) : (
          <ol className="setlist-items">
            {items.map((x, n) => (
              <li key={x.key} className="setlist-item">
                <button className="setlist-song" onClick={() => setPlayFrom(n)} aria-label={t('Reproducir desde {title}', { title: x.project.title })}>
                  <span className="setlist-num">{n + 1}</span>
                  <span className="project-main">
                    <span className="project-title">{x.project.title}</span>
                    <span className="project-meta">
                      {formatTime(songDuration(x.project))}
                      {x.project.countIn?.enabled ? ` · ${t('con cuenta')}` : ''}
                    </span>
                  </span>
                </button>
                <button className="icon-btn" disabled={n === 0} onClick={() => update((l) => ({ ...l, items: moveItem(l.items, x.i, -1) }))} aria-label={t('Subir')}>
                  <Icon name="up" />
                </button>
                <button
                  className="icon-btn"
                  disabled={n === items.length - 1}
                  onClick={() => update((l) => ({ ...l, items: moveItem(l.items, x.i, 1) }))}
                  aria-label={t('Bajar')}
                >
                  <Icon name="down" />
                </button>
                <button className="icon-btn" onClick={() => update((l) => ({ ...l, items: l.items.filter((_, k) => k !== x.i) }))} aria-label={t('Quitar de la lista')}>
                  <Icon name="close" />
                </button>
              </li>
            ))}
          </ol>
        )}

        <button className="btn btn-block" onClick={() => setAdding(true)}>
          <Icon name="plus" /> {t('Agregar canciones')}
        </button>

        <section className="group">
          <h3>{t('Reproducción')}</h3>
          <label className="toggle">
            <input type="checkbox" checked={list.autoAdvance} onChange={(e) => update((l) => ({ ...l, autoAdvance: e.target.checked }))} />
            <span>{t('Pasar sola a la siguiente canción')}</span>
          </label>
          {list.autoAdvance && (
            <Stepper label={t('Pausa entre canciones')} value={list.gap} min={0} max={60} suffix="s" onChange={(v) => update((l) => ({ ...l, gap: v }))} />
          )}
        </section>

        <section className="group">
          {confirm ? (
            <div className="grid-2">
              <button className="btn" onClick={() => setConfirm(false)}>
                {t('Cancelar')}
              </button>
              <button
                className="btn is-danger"
                onClick={async () => {
                  clearTimeout(saveTimer.current)
                  await deleteSetlist(list.id)
                  goHome()
                }}
              >
                {t('Sí, eliminar')}
              </button>
            </div>
          ) : (
            <button className="btn btn-ghost is-danger" onClick={() => setConfirm(true)}>
              {t('Eliminar esta lista')}
            </button>
          )}
          <p className="hint">{t('Eliminar la lista no borra las pistas.')}</p>
        </section>
      </main>

      <div className="bottom-action">
        <button className="btn btn-primary btn-block" onClick={() => setPlayFrom(0)} disabled={!songs.length}>
          <Icon name="play" fill size={20} /> {t('Reproducir lista')}
        </button>
      </div>

      {adding && (
        <AddSongsSheet
          projects={[...projects.values()]}
          onAdd={(ids) => {
            update((l) => ({ ...l, items: [...l.items, ...ids] }))
            setAdding(false)
          }}
          onClose={() => setAdding(false)}
        />
      )}

      {playFrom != null && <SetlistPlayer songs={songs} list={list} startIndex={playFrom} onClose={() => setPlayFrom(null)} />}
    </div>
  )
}

function AddSongsSheet({ projects, onAdd, onClose }) {
  const [picked, setPicked] = useState([]) // en el orden en que se tocan
  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  return (
    <Sheet
      title={t('Agregar canciones')}
      onClose={onClose}
      footer={
        <button className="btn btn-primary grow" disabled={!picked.length} onClick={() => onAdd(picked)}>
          {picked.length ? t('Agregar {n}', { n: picked.length }) : t('Elige canciones')}
        </button>
      }
    >
      {projects.length === 0 ? (
        <p className="muted">{t('Todavía no hay pistas')}</p>
      ) : (
        <ul className="pick-list">
          {projects.map((p) => {
            const n = picked.indexOf(p.id)
            return (
              <li key={p.id}>
                <button className={`pick-row${n >= 0 ? ' is-picked' : ''}`} onClick={() => toggle(p.id)} aria-pressed={n >= 0}>
                  <span className="pick-mark">{n >= 0 ? n + 1 : ''}</span>
                  <span className="project-title">{p.title}</span>
                  <span className="muted">{formatTime(songDuration(p))}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Sheet>
  )
}
