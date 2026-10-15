import React from 'react';
import { ClipboardCheck, ArrowRight } from 'lucide-react';

export interface PendingEvaluationBannerProps {
  onOpenEvaluation: () => void;
}

export function PendingEvaluationBanner({
  onOpenEvaluation,
}: PendingEvaluationBannerProps) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm">
            <ClipboardCheck className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-amber-900">
              Avaliação Pós-Sessão Pendente
            </h3>
            <p className="mt-1 text-sm text-amber-800 leading-relaxed max-w-xl">
              Você concluiu uma sessão de estudos que ainda não foi avaliada. Avalie sua
              compreensão, foco e exercícios para consolidar suas estatísticas e liberar
              o cronômetro para novos estudos.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenEvaluation}
          className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 transition shrink-0"
        >
          <span>Concluir Avaliação Pendente</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
