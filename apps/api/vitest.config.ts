import { defineConfig } from 'vitest/config';

/**
 * Configuração do Vitest para o backend (@estudos/api)
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts']
  }
});
