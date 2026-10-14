import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * Configuração do Vite para apps/web
 * Inclui proxy reverso para a API e suporte a HMR com aliases para o pacote domain.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@estudos/domain': path.resolve(__dirname, '../../packages/domain/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
