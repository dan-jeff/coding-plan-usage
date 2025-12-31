import { defineConfig } from 'vite';
import { builtinModules } from 'module';

export default defineConfig({
  resolve: {
    conditions: ['node'], // Force node resolution
    mainFields: ['module', 'main'], // Avoid browser field
  },
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
        // 'electron-store', // Bundled to fix ESM issue
        ...builtinModules,
        /^node:/, // Externalize node: protocol imports
      ],
      output: {
        entryFileNames: '[name].cjs', // Force .cjs extension
      },
    },
    minify: false, // Easier debugging
  },
});
