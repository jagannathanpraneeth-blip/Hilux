import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    testTimeout: 15000,
    hookTimeout: 15000,
    reporters: ['verbose'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['../packages/**/*.ts'],
      exclude: ['../packages/**/*.test.ts', '../packages/**/node_modules'],
    },
  },
  resolve: {
    alias: {
      // Allow imports without .js extension in tests
      '@hilux/shared': resolve(__dirname, '../packages/shared'),
      '@hilux/kernel': resolve(__dirname, '../packages/shared/kernel'),
    },
    extensions: ['.ts', '.js'],
  },
  esbuild: {
    target: 'node20',
  },
});
