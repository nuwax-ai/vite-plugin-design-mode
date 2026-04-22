import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import appdevDesignMode from '../../packages/plugin/src/index';

export default defineConfig({
  plugins: [
    react(),
    appdevDesignMode({
      verbose: true,
      attributePrefix: 'data-appdev'
    })
  ]
});
