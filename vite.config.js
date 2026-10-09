import { defineConfig } from 'vite';

export default defineConfig({
  // Relative paths, so the build runs from any folder or a GitHub Pages subpath.
  base: './',
  server: {
    port: 5173,
    host: true,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
