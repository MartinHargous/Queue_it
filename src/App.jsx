import { useEffect, useState } from 'react'
import { Home } from './components/Home.jsx'
import { Editor } from './components/Editor.jsx'
import { requestPersistence } from './lib/db.js'

// Rutas por hash: #/  y  #/p/<id>. Así el botón atrás de Android funciona.
const parse = () => {
  const m = location.hash.match(/^#\/p\/(.+)$/)
  return m ? { name: 'editor', id: decodeURIComponent(m[1]) } : { name: 'home' }
}

let cameFromHome = false

export default function App() {
  const [route, setRoute] = useState(parse)

  useEffect(() => {
    const on = () => setRoute(parse())
    window.addEventListener('hashchange', on)
    requestPersistence()
    return () => window.removeEventListener('hashchange', on)
  }, [])

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
      go={(id) => {
        cameFromHome = true
        location.hash = `#/p/${encodeURIComponent(id)}`
      }}
    />
  )
}
