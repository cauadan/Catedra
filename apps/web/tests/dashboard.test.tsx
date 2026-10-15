import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Dashboard } from '../src/pages/Dashboard';

vi.mock('../src/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', name: 'Maria Silva', email: 'maria@example.com' },
    logout: vi.fn(),
  }),
}));

vi.mock('../src/contexts/RouterContext', () => ({
  useRouter: () => ({
    path: '/dashboard',
    navigate: vi.fn(),
  }),
}));

describe('Dashboard Component (@estudos/web)', () => {
  it('deve renderizar badges de status e link do cronômetro conforme o planejamento', () => {
    const html = renderToStaticMarkup(<Dashboard />);

    // Deve conter Concluído 2x nos módulos (Fase 2 e Fase 3)
    const matchesConcluido = html.match(/\bConcluído\b/g);
    expect(matchesConcluido).not.toBeNull();
    expect(matchesConcluido?.length).toBe(2);

    // Deve conter Ativo (Fases 4 e 5)
    expect(html).toContain('Ativo');

    // Deve conter referências às Fases futuras 6, 7 e 8
    expect(html).toContain('Fase 6');
    expect(html).toContain('Fase 7');
    expect(html).toContain('Fase 8');

    // Cronômetro de Estudo deve estar presente com seu rótulo
    expect(html).toContain('Cronômetro de Estudo');
  });
});
