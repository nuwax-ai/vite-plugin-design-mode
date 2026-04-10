import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'VitePluginAppDevDesignMode',
      fileName: (format) => `index.${format}.js`
    },
    rollupOptions: {
      external: [
        'vite', 
        '@babel/core', 
        '@babel/traverse', 
        '@babel/types',
        '@babel/standalone', // External dependency; do not bundle
        'url',
        'path',
        'fs',
        'http'
      ],
      output: {
        globals: {
          vite: 'vite',
          '@babel/core': 'Babel',
          '@babel/traverse': 'traverse',
          '@babel/types': 'types'
        }
      }
    }
  },
  test: {
    environment: 'node'
  }
});
