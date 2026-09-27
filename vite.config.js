import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths, so the build works at https://tomisvibing.github.io/settlr/ or any other path.
  base: './',
  // Readable stack traces in crash reports. The source is public on GitHub anyway.
  build: { sourcemap: true },
});
