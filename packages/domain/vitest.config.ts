import { defineConfig } from 'vitest/config';

/**
 * Configuração do Vitest para o pacote @estudos/domain
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts']
  }
});
