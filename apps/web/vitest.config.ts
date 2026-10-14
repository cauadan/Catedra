import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * Configuração do Vitest para apps/web
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@estudos/domain': path.resolve(__dirname, '../../packages/domain/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['tests/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
  },
});
