import { useState } from 'react'
import { Sheet } from './Sheet.jsx'
import { loadResources, renderProject } from '../lib/audio/engine.js'
import { encodeWav } from '../lib/audio/wav.js'
import { cheatSheetText } from '../lib/model.js'
import { shareOrDownload, downloadBlob, exportProjectFile, safeName } from '../lib/share.js'

export function ExportSheet({ project, timeline, onClose }) {
  const isAudio = project.kind === 'audio'
  const [opts, setOpts] = useState({ track: true, click: !isAudio || project.mix.clickOnAudio, cues: true })
  const [busy, setBusy] = useState(null)
  const [msg, setMsg] = useState(null)
  const [ready, setReady] = useState(null) // { blob, filename }
  const name = safeName(project.title)

  // Genera el archivo; luego el usuario elige compartir o guardar (Android exige
  // un toque reciente para abrir el menú de compartir, y el render puede tardar).
  const run = async (label, fn) => {
    setBusy(label)
    setMsg(null)
    setReady(null)
    try {
      setReady(await fn())
    } catch (err) {
      setMsg({ ok: false, text: err.message || 'No se pudo exportar.' })
    } finally {
      setBusy(null)
    }
  }

  const share = async () => {
    const r = await shareOrDownload(ready.blob, ready.filename)
    if (r === 'downloaded') setMsg({ ok: true, text: 'Archivo guardado en Descargas.' })
  }
  const save = () => {
    downloadBlob(ready.blob, ready.filename)
    setMsg({ ok: true, text: 'Archivo guardado en Descargas.' })
  }

  const exportAudio = () =>
    run('Renderizando audio…', async () => {
      const res = await loadResources(project, { onStatus: (s) => s && setBusy(s) })
      setBusy('Renderizando audio…')
      const mixProject = { ...project, mix: { ...project.mix, clickOnAudio: opts.click } }
      const buf = await renderProject(mixProject, timeline, res, opts)
      setBusy('Codificando WAV…')
      return { blob: encodeWav(buf), filename: `${name}.wav` }
    })

  const exportSheet = () =>
    run('Preparando hoja…', async () => ({ blob: new Blob([cheatSheetText(project, timeline)], { type: 'text/plain' }), filename: `${name}_hoja.txt` }))

  const exportBackup = () => run('Empaquetando proyecto…', async () => ({ blob: await exportProjectFile(project), filename: `${name}.queueit.json` }))

  const nothing = !opts.click && !opts.cues && !(isAudio && opts.track)

  return (
    <Sheet title="Exportar" onClose={onClose}>
      <section className="group">
        <h3>Audio WAV</h3>
        {isAudio && <Check label="Pista de audio" checked={opts.track} onChange={(v) => setOpts({ ...opts, track: v })} />}
        <Check label="Click" checked={opts.click} onChange={(v) => setOpts({ ...opts, click: v })} />
        <Check label="Cues de voz" checked={opts.cues} onChange={(v) => setOpts({ ...opts, cues: v })} />
        <button className="btn btn-primary btn-block" onClick={exportAudio} disabled={!!busy || nothing}>
          Exportar audio
        </button>
      </section>
      <section className="group">
        <h3>Otros formatos</h3>
        <button className="btn btn-block" onClick={exportSheet} disabled={!!busy}>
          Hoja de cues (.txt)
        </button>
        <button className="btn btn-block" onClick={exportBackup} disabled={!!busy}>
          Respaldo del proyecto (.json)
        </button>
        <p className="hint">El respaldo incluye los audios y se puede importar en otro teléfono.</p>
      </section>
      {busy && (
        <p className="notice" role="status">
          {busy}
        </p>
      )}
      {ready && (
        <div className="ready">
          <p className="ready-name">
            {ready.filename} <span className="muted">{(ready.blob.size / 1048576).toFixed(1)} MB</span>
          </p>
          <div className="grid-2">
            <button className="btn btn-primary" onClick={share}>
              Compartir
            </button>
            <button className="btn" onClick={save}>
              Guardar
            </button>
          </div>
        </div>
      )}
      {msg && (
        <p className={`notice${msg.ok ? '' : ' is-error'}`} role="status">
          {msg.text}
        </p>
      )}
    </Sheet>
  )
}

function Check({ label, checked, onChange }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  )
}
