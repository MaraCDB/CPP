# Cuore di Bosco — Calendario prenotazioni

App React mobile-first per gestire le prenotazioni di un B&B a 2 camere.

## Stato

- ✅ **Piano A** — Scaffolding + UI completa con localStorage
- ⏳ Piano B — Integrazione Google Sheets + sync
- ⏳ Piano C — PWA + deploy GitHub Pages

## Sviluppo

```bash
npm install
npm run dev      # http://localhost:5173
npm run test     # Vitest (18 test)
npm run build    # produce dist/
```

## Tech stack

- Vite 8 · React 19 · TypeScript 6
- Tailwind 3 + CSS custom tokens (tema chiaro/scuro/auto)
- Zustand 5 con persist localStorage
- Vitest 4 + React Testing Library

## Riferimenti

- Design: [../docs/superpowers/specs/2026-04-14-calendario-bb-design.md](../docs/superpowers/specs/2026-04-14-calendario-bb-design.md)
- Piano implementazione: [../docs/superpowers/plans/2026-04-14-piano-A-scaffolding-mvp-locale.md](../docs/superpowers/plans/2026-04-14-piano-A-scaffolding-mvp-locale.md)
- Prototipo HTML originale: [../prototipo-calendario.html](../prototipo-calendario.html)
