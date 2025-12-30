import { defineConfig } from 'vite';
import { builtinModules } from 'module';

export default defineConfig({
  build: {
    target: 'node18',
    outDir: 'dist-electron',
    emptyOutDir: true,
    lib: {
      entry: {
        main: 'electron/main.ts',
      },
      formats: ['cjs'],
    },
    rollupOptions: {
      external: [
        'electron',
        'electron-store', // Treat as external
        ...builtinModules,
      ],
      output: {
        entryFileNames: '[name].cjs', // Force .cjs extension
      },
    },
    minify: false, // Easier debugging
  },
});
