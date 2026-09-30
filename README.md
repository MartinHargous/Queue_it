# Queue it

Guías de click y cues de voz para músicos. PWA para Android, sin cuenta, sin backend y 100 % offline.

- Metrónomo por secciones con tempo, compás y accelerando/ritardando propios.
- Pistas desde un audio con detección de pulso en el teléfono (essentia.js, también en música sin batería) y ajuste manual de la grilla.
- Cues anclados a compás y tiempo: voz sintética, grabación propia o nota de texto.
- Modo escenario con números grandes.
- Exporta a WAV, hoja de cues (.txt) y respaldo del proyecto (.json).

## Usar

Abre la app publicada en Chrome para Android, luego menú → **Instalar app**. Desde ahí funciona sin conexión.

## Desarrollar

```bash
npm install
npm run dev
npm run build && npm run preview
```

Arquitectura, stack y decisiones de diseño: [ARCHITECTURE.md](./ARCHITECTURE.md).

Licencia: [AGPL-3.0-or-later](./LICENSE). La detección de pulso usa essentia.js (AGPL-3.0) y la voz usa meSpeak (GPL); detalles en [ARCHITECTURE.md](./ARCHITECTURE.md#licencias).
