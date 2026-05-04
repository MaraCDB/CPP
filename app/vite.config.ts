import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/CPP/',   // GitHub Pages path: https://maracdb.github.io/CPP/
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
      includeAssets: ['favicon.svg', 'icon.svg'],
      manifest: {
        name: 'Cuore di Bosco — Calendario',
        short_name: 'Cuore di Bosco',
        description: 'Calendario prenotazioni del B&B Cuore di Bosco',
        theme_color: '#2E8F5C',
        background_color: '#FAF8F5',
        display: 'standalone',
        orientation: 'portrait',
        lang: 'it',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
