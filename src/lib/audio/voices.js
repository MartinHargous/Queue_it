// Idiomas de la voz sintética (nombres en su propio idioma) y variantes de timbre de eSpeak.
// Puro: lo usan la interfaz, el worker y model.js.
export const VOICES = [
  ['es-la', 'Español (Latinoamérica)'],
  ['es', 'Español (España)'],
  ['en/en-us', 'English (US)'],
  ['en/en', 'English (UK)'],
  ['pt', 'Português (Brasil)'],
  ['pt-pt', 'Português (Portugal)'],
  ['fr', 'Français'],
  ['it', 'Italiano'],
  ['de', 'Deutsch'],
  ['ca', 'Català'],
  ['nl', 'Nederlands'],
  ['pl', 'Polski'],
  ['sv', 'Svenska'],
]

// Las etiquetas se traducen en la interfaz con t()
export const VARIANTS = [
  ['', 'Original'],
  ['f2', 'Femenina 1'],
  ['f4', 'Femenina 2'],
  ['m3', 'Masculina 1'],
  ['m7', 'Masculina 2'],
]

// Voz del proyecto con el idioma propio del cue, si tiene uno
export function cueVoice(project, cue) {
  return cue?.voice ? { ...project.tts, voice: cue.voice } : project.tts
}
