import { useEffect, useRef, useState } from 'react'
import { listProjects, saveProject, putBlob, listSetlists, saveSetlist } from '../lib/db.js'
import { newProject, newSetlist, buildTimeline, formatTime, uid } from '../lib/model.js'
import { importProjectFile } from '../lib/share.js'
import { useInstallState, promptInstall } from '../lib/install.js'
import { decodeBlob } from '../lib/audio/context.js'
import { Sheet } from './Sheet.jsx'
import { Icon } from './icons.jsx'
import { t, tn, useLang, setLang, LANGS } from '../lib/i18n.js'

export function Home({ go, goList, tab = 'tracks', setTab }) {
  const lang = useLang()
  const [projects, setProjects] = useState(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(null)
  const audioInput = useRef(null)
  const importInput = useRef(null)

  const [setlists, setSetlists] = useState(null)
  const install = useInstallState()
  const [hideInstall, setHideInstall] = useState(() => {
    try {
      return localStorage.getItem('queueit.installHint') === 'hidden'
    } catch {
      return false
    }
  })
  const dismissInstall = () => {
    setHideInstall(true)
    try {
      localStorage.setItem('queueit.installHint', 'hidden')
    } catch {
      /* sin almacenamiento */
    }
  }

  useEffect(() => {
    listProjects().then(setProjects)
    listSetlists().then(setSetlists)
  }, [])

  const createSetlist = async () => {
    const l = newSetlist(t('Lista {n}', { n: (setlists?.length ?? 0) + 1 }))
    await saveSetlist(l)
    goList(l.id)
  }

  const createMetronome = async () => {
    const p = newProject('metronome')
    await saveProject(p)
    go(p.id)
  }

  const createFromAudio = async (file) => {
    if (!file) return
    setCreating(false)
    setBusy(t('Leyendo audio…'))
    setError(null)
    try {
      const blobId = uid()
      const buf = await decodeBlob(blobId, file)
      await putBlob(blobId, file)
      const p = newProject('audio')
      p.title = file.name.replace(/\.[^.]+$/, '')
      p.audio = { blobId, name: file.name, mime: file.type, duration: buf.duration }
      await saveProject(p)
      go(p.id)
    } catch {
      setError(t('No se pudo leer ese archivo. Prueba con MP3, WAV, M4A u OGG.'))
    } finally {
      setBusy(null)
    }
  }

  const importFile = async (file) => {
    if (!file) return
    setCreating(false)
    setBusy(t('Importando proyecto…'))
    try {
      const p = await importProjectFile(file)
      go(p.id)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="screen">
      <header className="appbar home-bar">
        <h1 className="wordmark">
          <img src="favicon.svg" alt="" width="34" height="34" />
          Queue it
        </h1>
        {install === 'prompt' && hideInstall && (
          <button className="icon-btn install-mini" onClick={promptInstall} aria-label={t('Instalar app')} title={t('Instalar app')}>
            <Icon name="download" />
          </button>
        )}
        <div className="lang-picker" role="radiogroup" aria-label={t('Idioma')}>
          {LANGS.map(([code, name]) => (
            <button key={code} role="radio" aria-checked={lang === code} className={lang === code ? 'is-active' : ''} onClick={() => setLang(code)} title={name}>
              {code.toUpperCase()}
            </button>
          ))}
        </div>
      </header>

      {!hideInstall && (install === 'prompt' || install === 'ios') && (
        <div className="install-banner" role="region" aria-label={t('Instalar app')}>
          <img src="favicon.svg" alt="" width="40" height="40" />
          <div className="install-text">
            <strong>{t('Instala Queue it')}</strong>
            <span className="muted">
              {install === 'ios'
                ? t('En Safari toca Compartir y luego «Agregar a inicio».')
                : t('Se abre como una app, a pantalla completa y sin internet.')}
            </span>
          </div>
          {install === 'prompt' && (
            <button className="btn btn-primary" onClick={promptInstall}>
              {t('Instalar')}
            </button>
          )}
          <button className="icon-btn" onClick={dismissInstall} aria-label={t('Cerrar')}>
            <Icon name="close" />
          </button>
        </div>
      )}

      <nav className="tabs" role="tablist">
        {[
          ['tracks', 'Pistas'],
          ['lists', 'Listas'],
        ].map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'is-active' : ''} onClick={() => setTab(k)}>
            {t(label)}
            {k === 'lists' && setlists?.length > 0 && <span className="tab-count">{setlists.length}</span>}
          </button>
        ))}
      </nav>

      {tab === 'lists' ? (
        <main className="home-list">
          {setlists && setlists.length === 0 && (
            <div className="empty">
              <p className="empty-title">{t('Sin listas todavía')}</p>
              <p className="muted">{t('Una lista junta varias pistas en orden para tocarlas seguidas, por ejemplo el repertorio de un show.')}</p>
            </div>
          )}
          <ul className="project-list">
            {setlists?.map((l) => (
              <li key={l.id}>
                <button className="project-row" onClick={() => goList(l.id)}>
                  <span className="project-kind" aria-hidden="true">
                    <Icon name="list" />
                  </span>
                  <span className="project-main">
                    <span className="project-title">{l.name}</span>
                    <span className="project-meta">
                      {l.items.length} {tn(l.items.length, 'canción', 'canciones')}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </main>
      ) : (
      <main className="home-list">
        {error && (
          <p className="notice is-error" role="alert">
            {error}
          </p>
        )}
        {projects && projects.length === 0 && (
          <div className="empty">
            <p className="empty-title">{t('Todavía no hay pistas')}</p>
            <p className="muted">{t('Arma una guía con metrónomo por secciones o sube un audio y marca dónde entra cada parte.')}</p>
          </div>
        )}
        <ul className="project-list">
          {projects?.map((p) => (
            <li key={p.id}>
              <button className="project-row" onClick={() => go(p.id)}>
                <span className="project-kind" aria-hidden="true">
                  <Icon name={p.kind === 'audio' ? 'wave' : 'metro'} />
                </span>
                <span className="project-main">
                  <span className="project-title">{p.title}</span>
                  <span className="project-meta">
                    {p.kind === 'audio' ? t('Audio') : `${p.sections.length} ${tn(p.sections.length, 'sección', 'secciones')}`}
                    {', '}
                    {p.cues.length} {p.cues.length === 1 ? 'cue' : 'cues'}
                  </span>
                </span>
                <span className="project-dur">{formatTime(buildTimeline(p).duration || p.audio?.duration || 0)}</span>
              </button>
            </li>
          ))}
        </ul>
      </main>
      )}

      <div className="bottom-action">
        {tab === 'lists' ? (
          <button className="btn btn-primary btn-block" onClick={createSetlist}>
            <Icon name="plus" /> {t('Nueva lista')}
          </button>
        ) : (
          <button className="btn btn-primary btn-block" onClick={() => setCreating(true)} disabled={!!busy}>
            <Icon name="plus" /> {busy ?? t('Nueva pista')}
          </button>
        )}
      </div>

      <input ref={audioInput} type="file" accept="audio/*" hidden onChange={(e) => { createFromAudio(e.target.files[0]); e.target.value = '' }} />
      <input ref={importInput} type="file" accept=".json,application/json" hidden onChange={(e) => { importFile(e.target.files[0]); e.target.value = '' }} />

      {creating && (
        <Sheet title={t('Nueva pista')} onClose={() => setCreating(false)}>
          <div className="choice-list">
            <button className="choice" onClick={createMetronome}>
              <Icon name="metro" size={28} />
              <span>
                <strong>{t('Metrónomo')}</strong>
                <span className="muted">{t('Secciones con su propio tempo y compás')}</span>
              </span>
            </button>
            <button className="choice" onClick={() => audioInput.current.click()}>
              <Icon name="wave" size={28} />
              <span>
                <strong>{t('Desde un audio')}</strong>
                <span className="muted">{t('Sube una pista y detecta el pulso')}</span>
              </span>
            </button>
            <button className="choice" onClick={() => importInput.current.click()}>
              <Icon name="file" size={28} />
              <span>
                <strong>{t('Importar respaldo')}</strong>
                <span className="muted">{t('Un archivo .json exportado desde Queue it')}</span>
              </span>
            </button>
          </div>
        </Sheet>
      )}
    </div>
  )
}
