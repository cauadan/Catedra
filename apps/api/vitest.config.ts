import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Configuração do Vitest para o backend (@estudos/api)
 * O alias aponta para o código-fonte do domain (mesma estratégia de apps/web).
 */
export default defineConfig({
  resolve: {
    alias: {
      '@estudos/domain': path.resolve(__dirname, '../../packages/domain/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 20000,
    hookTimeout: 20000,
  }
});
