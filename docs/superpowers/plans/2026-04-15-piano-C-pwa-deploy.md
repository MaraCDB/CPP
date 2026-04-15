# Piano C — PWA + Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Trasformare l'app in una PWA installabile sul telefono (come un'app nativa), con service worker per cache offline dell'app shell, e deployarla su GitHub Pages con URL pubblico.

**Prereq:** Piano B completato al tag `v0.2.0-piano-B`.

---

## Phase 1 — Manifest + icone

### Task 1.1: Install `vite-plugin-pwa`

- [ ] `cd app && npm install -D vite-plugin-pwa`
- [ ] Commit `chore: add vite-plugin-pwa`

### Task 1.2: Configure Vite PWA plugin

**Files:**
- Modify: `app/vite.config.ts`

- [ ] Replace config:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/cuore-di-bosco-calendario/',   // cambierà in Phase 3 in base al repo name
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // cache delle chiamate API Google Sheets/Drive NON è opportuna (dati sensibili
        // e sempre freschi). Cache solo app shell.
        navigateFallbackDenylist: [/^\/api/, /googleapis\.com/, /accounts\.google\.com/],
      },
      manifest: {
        name: 'Cuore di Bosco — Calendario',
        short_name: 'Cuore di Bosco',
        description: 'Calendario prenotazioni del B&B Cuore di Bosco',
        theme_color: '#2E8F5C',
        background_color: '#FAF8F5',
        display: 'standalone',
        orientation: 'portrait',
        lang: 'it',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
```

- [ ] Commit `feat(pwa): configure vite-plugin-pwa with manifest`

### Task 1.3: Crea icone (192px, 512px)

Due opzioni — scegliere **A** se vuoi un logo semplice, **B** se preferisci il logo del sito vetrina.

**A) Icone generate inline (bastano per iniziare):**

Crea `app/public/icon.svg` con:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#E8528B"/>
      <stop offset="1" stop-color="#5B6FD6"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#g)"/>
  <text x="256" y="340" font-size="280" text-anchor="middle" font-family="system-ui">🏡</text>
</svg>
```

Poi converti in PNG 192 e 512:
```bash
cd app/public
# Se hai ImageMagick:
magick icon.svg -resize 192x192 icon-192.png
magick icon.svg -resize 512x512 icon-512.png
```

Se non hai ImageMagick: apri `icon.svg` nel browser, fa screenshot, ridimensiona online (es. [squoosh.app](https://squoosh.app)) a 192 e 512 px.

**B)** Riusa il logo del sito `cuore-di-bosco` già presente in `d:/Workspace/cuore-di-bosco/public/`.

- [ ] Commit `feat(pwa): app icons`

### Task 1.4: favicon

- [ ] Copia `icon-192.png` come `app/public/favicon.svg` (o `favicon.png`) per coerenza con il tag `<link rel="icon">` in index.html.
- [ ] Commit `feat(pwa): favicon`

---

## Phase 2 — Update UX install

### Task 2.1: Install prompt

**Files:**
- Create: `src/components/InstallPrompt.tsx`

- [ ] Implementazione:

```tsx
import { useEffect, useState } from 'react';

export const InstallPrompt = () => {
  const [prompt, setPrompt] = useState<any>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const h = (e: Event) => {
      e.preventDefault();
      setPrompt(e);
      // mostra il banner solo al secondo uso (semplice euristica)
      const visits = Number(localStorage.getItem('cdb_visits') || '0') + 1;
      localStorage.setItem('cdb_visits', String(visits));
      if (visits >= 2) setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);

  if (!visible || !prompt) return null;
  return (
    <div className="px-4 py-3 flex items-center gap-3" style={{ background:'var(--surface-2)', borderBottom:'1px solid var(--line)' }}>
      <div className="text-sm flex-1">📱 Installa l'app sul telefono per aprirla come una normale app</div>
      <button className="btn btn-ghost" onClick={() => setVisible(false)}>Più tardi</button>
      <button className="btn btn-primary" onClick={() => { void prompt.prompt(); setVisible(false); }}>Installa</button>
    </div>
  );
};
```

Aggiungilo in `App.tsx` sopra `<Home />` e `<CalendarPage />` (rendering condizionato può andare solo quando user è loggato, ma per ora mettilo senza gate così è visibile).

- [ ] Commit `feat(pwa): install prompt for 2nd visit`

---

## Phase 3 — Deploy GitHub Pages

### Task 3.1: Crea repo GitHub

> **Manuale, ~2 minuti.**

- [ ] Su [github.com](https://github.com) crea un nuovo repo pubblico chiamato `cuore-di-bosco-calendario` (o nome a scelta — aggiorna `base` in vite.config.ts di conseguenza)
- [ ] Da CLI in locale:
```bash
cd d:/Workspace/CPP
git remote add origin https://github.com/<tuo-username>/cuore-di-bosco-calendario.git
git branch -M main    # GitHub usa main di default, rinomino da master
git push -u origin main
git push --tags
```

### Task 3.2: GitHub Actions workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] Content:

```yaml
name: Deploy
on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: app
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: app/package-lock.json
      - run: npm ci
      - run: npm run build
        env:
          VITE_GOOGLE_CLIENT_ID: ${{ secrets.VITE_GOOGLE_CLIENT_ID }}
      - uses: actions/configure-pages@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: app/dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] Commit `ci: deploy to GitHub Pages on push to main`

### Task 3.3: Configure GitHub Pages + Secret

> **Manuale nell'interfaccia GitHub.**

- [ ] Repo → Settings → Pages → Source: **GitHub Actions**
- [ ] Repo → Settings → Secrets and variables → Actions → New repository secret
  - Name: `VITE_GOOGLE_CLIENT_ID`
  - Value: (stesso valore del `.env.local`)
- [ ] Aggiungi l'URL di produzione (`https://<user>.github.io/cuore-di-bosco-calendario/`) alle "Origini JavaScript autorizzate" nel Google Cloud Console (Phase 0 Piano B, Step 4.5)

### Task 3.4: Primo push e verifica

- [ ] `git push` — parte il workflow
- [ ] Vai su repo → Actions: controlla che build + deploy siano verdi
- [ ] Apri `https://<user>.github.io/cuore-di-bosco-calendario/` → l'app carica
- [ ] Dal telefono apri stesso URL → click menu browser → "Installa app" / "Aggiungi a Home" → icona appare sulla home

### Task 3.5: Verifica PWA installata

- [ ] Chiudi tutti i browser sul telefono
- [ ] Tocca l'icona dalla home → si apre a tutto schermo (senza barra browser)
- [ ] Metti telefono in modalità aereo → apri l'app → si apre (dati in cache IDB)
- [ ] Modifica qualcosa → vedi indicatore 🔴 offline + badge coda
- [ ] Torna online → sync automatico

### Task 3.6: Tag

- [ ] ```bash
git tag -a v1.0.0-piano-C -m "Piano C: PWA installable + GitHub Pages deploy"
git push --tags
```

---

## Definition of Done — Piano C

✅ App installabile come PWA dal browser mobile (iOS Safari + Android Chrome)
✅ Icona apre a tutto schermo (display:standalone)
✅ Theme color verde nella status bar
✅ Service worker cachea app shell (funziona offline sul ri-avvio)
✅ Banner "installa" al secondo uso
✅ Deploy automatico ad ogni push su main
✅ URL pubblico GitHub Pages funzionante
✅ Google OAuth autorizzato anche per il dominio di produzione
✅ Tag `v1.0.0-piano-C`

---

# 🎉 Piano completo (A+B+C)

Dopo Piano C, l'app è **feature-complete** per il tuo uso come B&B owner di Cuore di Bosco:

- ✅ Calendario visuale mobile-first con 4 viste
- ✅ Gestione prenotazioni con stati + anticipi + contatti
- ✅ Chiusure struttura
- ✅ Promemoria rapidi
- ✅ Sync tra tutti i tuoi dispositivi via Google Sheets
- ✅ Condivisione read-only con la famiglia
- ✅ Tema chiaro/scuro/auto
- ✅ Installabile come app nativa
- ✅ Funzionante offline (lettura sempre, scrittura in coda)
