# Queue it

PWA para músicos (React + Vite, sin backend). La arquitectura está en `ARCHITECTURE.md`.

## Protocolo obligatorio de ramas, commits y PRs

Sigue `CONTRIBUTING.md` siempre:

- Tipos: `FEAT` (funcionalidad nueva), `FIX` (corrección de error), `UPDATE` (cambio o mejora de algo existente).
- Rama: `feat/…`, `fix/…` o `update/…` desde `main`, una por cambio.
- Commit y título de PR: `TIPO: Resumen en imperativo`.
- Cada commit y cada PR deben ser atómicos y autocontenidos: un solo tema, y por sí solos pasan `npm run lint`, `npm test` y `npm run build`.

## Comprobaciones

```bash
npm run lint && npm test && npm run build
```

Los textos de la interfaz pasan por `t('texto en español')` y necesitan su traducción en `src/lib/i18n/en.js` y `pt.js`.
