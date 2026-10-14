import { describe, it, expect } from 'vitest';
import React from 'react';
import { App } from '../src/App.js';

describe('Testes do Frontend Web (@estudos/web)', () => {
  it('deve exportar o componente App como uma função válida do React', () => {
    expect(typeof App).toBe('function');
  });

  it('deve instanciar o elemento App sem erros', () => {
    const element = React.createElement(App);
    expect(element).toBeDefined();
    expect(element.type).toBe(App);
  });
});
