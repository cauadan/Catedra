import { describe, it, expect } from 'vitest';
import React from 'react';
import { detectBrowserTimezone, formatTimezoneLabel } from '../src/lib/timezone';
import { navigationItems } from '../src/components/layout/Shell';

describe('Testes do Frontend Web: Autenticação e Shell (@estudos/web)', () => {
  it('deve detectar o fuso horário ou retornar America/Sao_Paulo por padrão', () => {
    const tz = detectBrowserTimezone();
    expect(typeof tz).toBe('string');
    expect(tz.length).toBeGreaterThan(0);
  });

  it('deve formatar adequadamente o rótulo do fuso horário em português', () => {
    const formattedSp = formatTimezoneLabel('America/Sao_Paulo');
    expect(formattedSp).toContain('Horário de Brasília');

    const formattedOther = formatTimezoneLabel('UTC');
    expect(formattedOther).toBe('UTC');
  });

  it('deve conter todos os 7 módulos de navegação obrigatórios no Shell', () => {
    const expectedModules = [
      'Painel',
      'Matérias e Assuntos',
      'Agenda e Planejamento',
      'Cronômetro de Estudo',
      'Metas de Estudo',
      'Desempenho e Estatísticas',
      'Observatório Semanal',
    ];

    const labels = navigationItems.map((item) => item.label);
    expectedModules.forEach((expected) => {
      expect(labels).toContain(expected);
    });

    const subjectsItem = navigationItems.find((item) => item.id === 'subjects');
    expect(subjectsItem).toBeDefined();
    expect(subjectsItem?.path).toBe('/subjects');
    expect(subjectsItem?.isPhase2).toBe(true);
  });
});
