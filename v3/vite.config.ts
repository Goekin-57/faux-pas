import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build` produit ../jeu-v3/index.html autonome (jeu jouable en un seul fichier, publié sur GitHub Pages).
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: { target: 'es2020', chunkSizeWarningLimit: 4000, outDir: '../jeu-v3', emptyOutDir: true },
  server: { host: true }
});
