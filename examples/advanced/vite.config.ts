import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import appdevDesignMode from '../../packages/plugin/src/index';

export default defineConfig({
  plugins: [
    react(),
    // 高级配置示例
    appdevDesignMode({
      enabled: true,
      enableInProduction: false, // 只在开发环境启用
      attributePrefix: 'design-mode', // 自定义属性前缀
      verbose: true, // 详细日志输出
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
        'components/**/*.{ts,tsx,js,jsx}',
        'pages/**/*.{ts,tsx,js,jsx}',
        '!**/node_modules/**',
      ],
    }),
  ],

  // 高级Vite配置
  server: {
    port: 5174, // 使用不同端口避免冲突
    host: true,
    open: true,
    cors: true,
    fs: {
      allow: ['..', '../../src'], // Allow serving the plugin source
    },
  },

  build: {
    outDir: 'dist',
    sourcemap: true,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          state: ['zustand'],
        },
      },
    },
  },

  resolve: {
    alias: {
      '@': '/src',
      '@components': '/src/components',
      '@pages': '/src/pages',
      '@utils': '/src/utils',
    },
  },

  css: {
    modules: {
      localsConvention: 'camelCaseOnly',
    },
  },

  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'zustand'],
  },
});
