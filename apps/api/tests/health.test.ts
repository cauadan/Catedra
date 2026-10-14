import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('Testes de Integridade da API (@estudos/api)', () => {
  it('deve responder 200 OK na rota /api/health com mensagem em português', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'ok');
    expect(response.body).toHaveProperty(
      'message',
      'Serviço da API operacional e em execução.'
    );
    expect(response.body).toHaveProperty('timestamp');
  });

  it('deve responder 404 NOT_FOUND para rotas inexistentes com formato padronizado em português', async () => {
    const response = await request(app).get('/api/rota-inexistente');
    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toHaveProperty('code', 'NOT_FOUND');
    expect(response.body.error.message).toContain('não encontrada');
  });
});
