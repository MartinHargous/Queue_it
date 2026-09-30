// meSpeak (eSpeak compilado a JS) corre dentro del worker para no bloquear la UI.
// Sin `window` meSpeak entra en modo "solo datos": justo lo que queremos (WAV en memoria).
import meSpeak from 'mespeak'
import config from 'mespeak/src/mespeak_config.json'
import es from 'mespeak/voices/es.json'
import esLa from 'mespeak/voices/es-la.json'

meSpeak.loadConfig(config)
meSpeak.loadVoice(esLa)
meSpeak.loadVoice(es)

self.onmessage = (e) => {
  const { id, text, voice, speed, pitch } = e.data
  try {
    const wav = meSpeak.speak(text, { rawdata: 'arraybuffer', voice, speed, pitch, amplitude: 120 })
    if (!wav) throw new Error('No se pudo sintetizar el texto')
    self.postMessage({ id, wav }, [wav])
  } catch (err) {
    self.postMessage({ id, error: String(err?.message || err) })
  }
}
