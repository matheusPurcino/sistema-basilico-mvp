import { builtinModules } from 'node:module';
import { defineConfig } from 'vite';

/**
 * Build do processo principal e do preload do Electron em CommonJS (.cjs),
 * independente do `"type": "module"` do package.json.
 */
export default defineConfig({
  build: {
    outDir: 'dist-electron',
    emptyOutDir: true,
    target: 'node22',
    minify: false,
    sourcemap: true,
    lib: {
      entry: {
        main: 'electron/main.ts',
        preload: 'electron/preload.ts',
      },
      formats: ['cjs'],
      fileName: (_formato, nome) => `${nome}.cjs`,
    },
    rollupOptions: {
      external: ['electron', ...builtinModules, ...builtinModules.map((m) => `node:${m}`)],
    },
  },
});
