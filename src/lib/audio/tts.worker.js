// meSpeak (eSpeak compilado a JS) corre dentro del worker para no bloquear la UI.
// Sin `window` meSpeak entra en modo "solo datos": justo lo que queremos (WAV en memoria).
// Cada idioma se carga recién cuando se usa (el inglés pesa ~115 kB).
import meSpeak from 'mespeak'
import config from 'mespeak/src/mespeak_config.json'

const LOADERS = {
  'es-la': () => import('mespeak/voices/es-la.json'),
  es: () => import('mespeak/voices/es.json'),
  'en/en-us': () => import('mespeak/voices/en/en-us.json'),
  'en/en': () => import('mespeak/voices/en/en.json'),
  pt: () => import('mespeak/voices/pt.json'),
  'pt-pt': () => import('mespeak/voices/pt-pt.json'),
  fr: () => import('mespeak/voices/fr.json'),
  it: () => import('mespeak/voices/it.json'),
  de: () => import('mespeak/voices/de.json'),
  ca: () => import('mespeak/voices/ca.json'),
  nl: () => import('mespeak/voices/nl.json'),
  pl: () => import('mespeak/voices/pl.json'),
  sv: () => import('mespeak/voices/sv.json'),
}

meSpeak.loadConfig(config)
const loaded = new Map()
function ensureVoice(id) {
  if (!LOADERS[id]) id = 'es-la'
  if (!loaded.has(id)) loaded.set(id, LOADERS[id]().then((m) => meSpeak.loadVoice(m.default ?? m)))
  return loaded.get(id).then(() => id)
}

// Los mensajes se atienden en orden: meSpeak no es reentrante
let queue = Promise.resolve()
self.onmessage = (e) => {
  queue = queue.then(() => handle(e.data))
}

async function handle({ id, text, voice, variant, speed, pitch }) {
  try {
    const v = await ensureVoice(voice)
    const wav = meSpeak.speak(text, { rawdata: 'arraybuffer', voice: v, variant: variant || undefined, speed, pitch, amplitude: 120 })
    if (!wav) throw new Error('No se pudo sintetizar el texto')
    self.postMessage({ id, wav }, [wav])
  } catch (err) {
    self.postMessage({ id, error: String(err?.message || err) })
  }
}
