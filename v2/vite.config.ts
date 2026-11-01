import { defineConfig } from 'vite';

// Le jeu compilé va dans ../jeu-v2, servi tel quel par GitHub Pages.
export default defineConfig({
  base: './',
  build: { outDir: '../jeu-v2', emptyOutDir: true, assetsInlineLimit: 0, chunkSizeWarningLimit: 2000 },
});
