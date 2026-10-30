import path from 'node:path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
  },
  resolve: {
    alias: {
      '#plugins': path.resolve(__dirname, 'src/plugins'),
      '#util': path.resolve(__dirname, 'src/util'),
    },
  },
});
