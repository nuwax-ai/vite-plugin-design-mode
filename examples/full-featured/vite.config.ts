import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import appdevDesignMode from '../../packages/plugin/src/index';

export default defineConfig({
  plugins: [
    react(),
    // AppDev Design Mode 插件配置
    appdevDesignMode({
      enabled: true,
      enableInProduction: false,
      attributePrefix: 'design-mode',
      verbose: false, // 关闭详细日志避免频繁输出
      exclude: [
        'node_modules',
        '.git',
        'dist',
        'build',
        '**/*.test.{ts,tsx,js,jsx}',
        '**/*.spec.{ts,tsx,js,jsx}',
        '**/__tests__/**',
        '**/tests/**',
      ],
      include: [
        'src/**/*.{ts,tsx,js,jsx}',
      ],
    }),
  ],

  server: {
    port: 5177,
    host: true,
    open: false, // 不自动打开浏览器
  },

  build: {
    outDir: 'dist',
    sourcemap: true,
  },

  resolve: {
    alias: {
      '@': '/src',
    },
  },

  css: {
    devSourcemap: true,
  },
});