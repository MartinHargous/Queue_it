import { useEffect, useState } from 'react'
import { Home } from './components/Home.jsx'
import { Editor } from './components/Editor.jsx'
import { SetlistView } from './components/SetlistView.jsx'
import { requestPersistence } from './lib/db.js'
import { installShortcuts } from './lib/shortcuts.js'

// Rutas por hash: #/, #/listas, #/p/<id> (pista) y #/l/<id> (lista). Así el botón atrás de Android funciona.
const parse = () => {
  const m = location.hash.match(/^#\/(p|l)\/(.+)$/)
  if (m) return { name: m[1] === 'p' ? 'editor' : 'setlist', id: decodeURIComponent(m[2]) }
  return { name: 'home', tab: location.hash === '#/listas' ? 'lists' : 'tracks' }
}

let cameFromHome = false

export default function App() {
  const [route, setRoute] = useState(parse)

  useEffect(() => {
    const on = () => setRoute(parse())
    window.addEventListener('hashchange', on)
    requestPersistence()
    const off = installShortcuts()
    return () => {
      window.removeEventListener('hashchange', on)
      off()
    }
  }, [])

  const back = (fallback) => () => {
    if (cameFromHome) history.back()
    else location.replace(fallback)
    cameFromHome = false
  }

  if (route.name === 'setlist') return <SetlistView key={route.id} id={route.id} goHome={back('#/listas')} />
  if (route.name === 'editor') {
    return (
      <Editor
        key={route.id}
        id={route.id}
        goHome={() => {
          if (cameFromHome) history.back()
          else location.replace('#/')
          cameFromHome = false
        }}
      />
    )
  }
  return (
    <Home
      tab={route.tab}
      setTab={(tab) => location.replace(tab === 'lists' ? '#/listas' : '#/')}
      go={(id) => {
        cameFromHome = true
        location.hash = `#/p/${encodeURIComponent(id)}`
      }}
      goList={(id) => {
        cameFromHome = true
        location.hash = `#/l/${encodeURIComponent(id)}`
      }}
    />
  )
}
