import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',
    
    // Test file glob patterns
    include: ['test/**/*.test.ts', 'test/**/*.spec.ts'],
    
    // Coverage
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'test/',
        'dist/',
        'examples/',
        '**/*.d.ts',
        '**/*.config.*',
      ],
    },
    
    // Globals
    globals: true,
    
    // Timeout
    testTimeout: 10000,
    
    // Setup files
    setupFiles: [],
  },
  
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});

