import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'

// ESpeak.js (meSpeak) trae comentarios en Latin-1; Rolldown exige UTF-8.
const mespeakLatin1 = () => ({
  name: 'mespeak-latin1',
  enforce: 'pre',
  load(id) {
    if (id.replace(/\\/g, '/').endsWith('mespeak/src/ESpeak.js')) return readFileSync(id, 'latin1')
  },
})

// base: './' permite publicar en GitHub Pages bajo /Queue_it/ sin cambiar nada
export default defineConfig({
  base: './',
  plugins: [
    mespeakLatin1(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: 'Queue it',
        short_name: 'Queue it',
        description: 'Guías de click y cues de voz para músicos. Funciona sin internet.',
        lang: 'es',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#1a1917',
        theme_color: '#1a1917',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precachea todo, incluido el motor de voz (~5 MB), para funcionar 100% offline
        globPatterns: ['**/*.{js,css,html,svg,png,woff,woff2,json}'],
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
        navigateFallback: 'index.html',
      },
    }),
  ],
  worker: { format: 'es', plugins: () => [mespeakLatin1()] },
  optimizeDeps: { exclude: ['mespeak'] },
})
