import { defineWorkspace } from 'vitest/config';

/**
 * Configuração de Workspaces do Vitest para execução centralizada de testes unitários
 * e de integração dos pacotes do monorepo.
 */
export default defineWorkspace([
  'packages/domain/vitest.config.ts',
  'apps/api/vitest.config.ts',
  'apps/web/vitest.config.ts'
]);
