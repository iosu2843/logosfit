import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/logosfit/' : '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@core': fileURLToPath(new URL('../../../packages/core/src/index.ts', import.meta.url)),
      '@ui/theme': fileURLToPath(new URL('../../../packages/ui/theme.ts', import.meta.url)),
    },
  },
}));
