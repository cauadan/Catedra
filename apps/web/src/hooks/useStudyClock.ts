import { useState, useEffect } from 'react';

/**
 * Hook de relógio sincronizado com o servidor.
 * Atualiza o estado a cada 1 segundo adicionando o offset medido com relação ao servidor.
 */
export function useStudyClock(clockOffsetMs: number = 0): Date {
  const [clock, setClock] = useState<Date>(() => new Date(Date.now() + clockOffsetMs));

  useEffect(() => {
    // Atualização imediata ao mudar o offset
    setClock(new Date(Date.now() + clockOffsetMs));

    const interval = setInterval(() => {
      setClock(new Date(Date.now() + clockOffsetMs));
    }, 1000);

    return () => clearInterval(interval);
  }, [clockOffsetMs]);

  return clock;
}
