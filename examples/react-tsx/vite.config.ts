import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import appdevDesignMode from '../../packages/plugin/src/index';

export default defineConfig({
  plugins: [
    react(),
    appdevDesignMode({
      enabled: true,
      verbose: true,
      attributePrefix: 'data-source',
      exclude: ['node_modules'],
      include: ['**/*.{tsx,ts,jsx,js}'],
    }),
  ],
});
