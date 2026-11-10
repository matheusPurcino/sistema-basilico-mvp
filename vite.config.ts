import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// `base: './'` permite abrir o bundle tanto via HTTP (Vercel/Render/GitHub Pages)
// quanto via file:// dentro do Electron.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1500,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['src/domain/**/*.ts', 'src/application/**/*.ts', 'src/infrastructure/**/*.ts'],
      exclude: [
        'src/**/index.ts',
        'src/domain/entities/ValueObjects.ts',
        'src/infrastructure/persistence/sqljsLoader.ts',
      ],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 70,
      },
    },
  },
});
