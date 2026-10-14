import { describe, it, expect } from 'vitest';
import React from 'react';
import { Agenda } from '../src/pages/Agenda';

describe('Agenda Page Component (@estudos/web)', () => {
  it('deve exportar a página Agenda como função React válida', () => {
    expect(typeof Agenda).toBe('function');
  });

  it('deve instanciar o elemento da Agenda sem erros de compilação ou de import', () => {
    const element = React.createElement(Agenda);
    expect(element).toBeDefined();
    expect(element.type).toBe(Agenda);
  });
});
