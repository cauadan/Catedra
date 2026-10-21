import React from 'react';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Calendar,
  HelpCircle,
  Archive,
} from 'lucide-react';
import { GOAL_METRIC_LABELS, MIN_QUESTIONS, type GoalMetricDTO, type GoalStatus } from '@estudos/domain';

export function renderGoalStatusBadge(status: GoalStatus, questionsCount = 0) {
  switch (status) {
    case 'ACHIEVED':
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>Meta atingida</span>
        </span>
      );
    case 'IN_PROGRESS':
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
          <Clock className="h-3.5 w-3.5" />
          <span>Em andamento</span>
        </span>
      );
    case 'MISSED':
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
          <AlertCircle className="h-3.5 w-3.5" />
          <span>Não atingida no período</span>
        </span>
      );
    case 'UPCOMING':
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
          <Calendar className="h-3.5 w-3.5" />
          <span>Período futuro</span>
        </span>
      );
    case 'INSUFFICIENT_DATA':
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
          <HelpCircle className="h-3.5 w-3.5" />
          <span>{`Dados insuficientes (${questionsCount}/${MIN_QUESTIONS} questões)`}</span>
        </span>
      );
  }
}

export function renderArchivedScopeBadge(isArchived?: boolean, label = 'Arquivada') {
  if (!isArchived) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
      <Archive className="h-3 w-3" />
      <span>{label}</span>
    </span>
  );
}

export function formatGoalMetricLabel(metric: GoalMetricDTO): string {
  if (metric === 'TOPICS_COMPLETED') return 'Assuntos estudados';
  return GOAL_METRIC_LABELS[metric] || metric;
}

export function formatGoalValue(metric: GoalMetricDTO, value: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  if (metric === 'ACCURACY') return `${value.toFixed(1)}%`;
  if (metric === 'EFFECTIVE_MINUTES') return `${Math.round(value)} min`;
  return `${Math.round(value)}`;
}
