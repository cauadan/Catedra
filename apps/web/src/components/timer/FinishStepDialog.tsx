import React, { useState, useEffect } from 'react';
import { AlertCircle, Clock } from 'lucide-react';

export interface FinishStepDialogProps {
  isOpen: boolean;
  mode: 'advance' | 'finish';
  isPending: boolean;
  errorMessage?: string;
  onConfirm: (declaredMinutes?: number) => void;
  onCancel: () => void;
}

export function FinishStepDialog({
  isOpen,
  mode,
  isPending,
  errorMessage,
  onConfirm,
  onCancel,
}: FinishStepDialogProps) {
  const [declaredMinutes, setDeclaredMinutes] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setDeclaredMinutes('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const minutes = declaredMinutes.trim() ? parseInt(declaredMinutes.trim(), 10) : undefined;
    onConfirm(minutes);
  };

  const title = mode === 'advance' ? 'Avançar Etapa' : 'Concluir Estudo';
  const confirmText = mode === 'advance' ? 'Avançar Etapa' : 'Concluir Estudo';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        </div>

        {errorMessage && (
          <div className="mb-4 flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="declared_minutes"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Distração não cronometrada nesta etapa (minutos - opcional):
            </label>
            <input
              id="declared_minutes"
              type="number"
              min="1"
              step="1"
              placeholder="Ex: 5"
              value={declaredMinutes}
              onChange={(e) => setDeclaredMinutes(e.target.value)}
              disabled={isPending}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100"
            />
            <p className="mt-1 text-xs text-slate-500">
              Se você se ausentou, conversou ou utilizou redes sociais sem pausar o
              cronômetro, informe os minutos aproximados para deduzir do tempo líquido.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onCancel}
              disabled={isPending}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition disabled:opacity-50"
            >
              {isPending ? 'Salvando...' : confirmText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
