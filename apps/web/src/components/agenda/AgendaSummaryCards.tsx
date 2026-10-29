import React from 'react';
import { Clock, CheckCircle2, PieChart } from 'lucide-react';
import { type PlannedPeriodSummary } from '@estudos/domain';

interface AgendaSummaryCardsProps {
  summary: PlannedPeriodSummary;
  loading?: boolean;
}

function formatMinutes(minutes: number): string {
  if (minutes <= 0) return '0 min';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

export function AgendaSummaryCards({ summary, loading = false }: AgendaSummaryCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-slate-100 border border-slate-200" />
        ))}
      </div>
    );
  }

  const reviewMin = summary.minutesByKind?.REVIEW || 0;
  const newContentMin = summary.minutesByKind?.NEW_CONTENT || 0;
  const practiceMin = summary.minutesByKind?.PRACTICE || 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {/* Card 1: Carga Planejada */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Carga Planejada
          </span>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {formatMinutes(summary.totalPlannedMinutes)}
          </div>
          <span className="text-xs text-slate-500 mt-0.5 block">
            {summary.totalPlannedMinutes} minutos no total
          </span>
        </div>
        <div className="h-12 w-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
          <Clock className="h-6 w-6" />
        </div>
      </div>

      {/* Card 2: Sessões Planejadas e Concluídas */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Sessões
          </span>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {summary.activeAndDoneCount}{' '}
            <span className="text-sm font-normal text-slate-500">ativas</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
            <span className="text-blue-600 font-medium">{summary.plannedCount} planejadas</span>
            <span>•</span>
            <span className="text-emerald-600 font-medium">{summary.doneCount} concluídas</span>
          </div>
        </div>
        <div className="h-12 w-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
          <CheckCircle2 className="h-6 w-6" />
        </div>
      </div>

      {/* Card 3: Distribuição por Etapa */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex items-center justify-between gap-2">
        <div className="w-full min-w-0">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Distribuição por Etapa
          </span>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 border border-blue-200">
              <span>Revisão:</span>
              <strong>{reviewMin}m</strong>
            </span>
            <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 border border-emerald-200">
              <span>Teoria Nova:</span>
              <strong>{newContentMin}m</strong>
            </span>
            <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700 border border-violet-200">
              <span>Prática:</span>
              <strong>{practiceMin}m</strong>
            </span>
          </div>
        </div>
        <div className="h-12 w-12 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
          <PieChart className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}
