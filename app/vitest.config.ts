import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'virtual:pwa-register/react': new URL('./tests/mocks/virtual-pwa-register.ts', import.meta.url).pathname,
    },
  },
  test: { environment: 'jsdom', globals: true, setupFiles: ['./tests/setup.ts'] },
});
