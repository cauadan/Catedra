import React from 'react';
import {
  Play,
  Pause,
  AlertTriangle,
  RotateCcw,
  CheckCircle,
  XCircle,
  Coffee,
  Clock,
  Sparkles,
} from 'lucide-react';
import {
  findActiveBlock,
  findNextBlock,
  deriveBlockState,
  calculateBlockTimes,
  calculateBlockProgress,
  calculateSessionMetrics,
  isBlockIncomplete,
  BLOCK_KIND_LABELS,
  type SessionBlockDTO,
  type BlockExecutionState,
} from '@estudos/domain';
import { formatDuration, formatPercent } from '../../lib/format';
import { toDomainEvents, type StudySessionView } from '../../lib/study-session-api';

export interface TimerDisplayProps {
  session: StudySessionView;
  referenceNow: Date;
  isPending: boolean;
  onPause: () => void;
  onResume: () => void;
  onDistractionStart: () => void;
  onDistractionEnd: () => void;
  onAdvanceStep: () => void;
  onFinishSession: () => void;
  onCancelSession: () => void;
}

export function TimerDisplay({
  session,
  referenceNow,
  isPending,
  onPause,
  onResume,
  onDistractionStart,
  onDistractionEnd,
  onAdvanceStep,
  onFinishSession,
  onCancelSession,
}: TimerDisplayProps) {
  const blocks: SessionBlockDTO[] = session.session_blocks.map((b) => ({
    id: b.id,
    kind: b.kind,
    planned_minutes: b.planned_minutes,
    position: b.position,
  }));

  const events = toDomainEvents(session.session_events);

  const activeBlock = findActiveBlock(blocks, events) || blocks[0];
  const nextBlock = findNextBlock(blocks, events);

  const activeBlockEvents = activeBlock
    ? events.filter((e) => e.block_id === activeBlock.id)
    : [];

  const state: BlockExecutionState = activeBlock
    ? deriveBlockState(activeBlockEvents)
    : 'NOT_STARTED';

  const blockTimes = activeBlock
    ? calculateBlockTimes(activeBlockEvents, referenceNow)
    : { totalSeconds: 0, pausedSeconds: 0, distractedRealtimeSeconds: 0, distractedDeclaredSeconds: 0, effectiveSeconds: 0 };

  const effectiveSeconds = blockTimes.effectiveSeconds;
  const rawPercent = activeBlock
    ? calculateBlockProgress(effectiveSeconds, activeBlock.planned_minutes)
    : 0;
  const percentComplete = isNaN(rawPercent) ? 0 : rawPercent;

  const sessionMetrics = calculateSessionMetrics(
    {
      status: session.status,
      started_at: new Date(session.started_at),
      ended_at: session.finished_at ? new Date(session.finished_at) : null,
      planned_start: session.planned_session?.scheduled_start
        ? new Date(session.planned_session.scheduled_start)
        : null,
    },
    blocks,
    events,
    referenceNow
  );

  const isIncomplete = activeBlock
    ? isBlockIncomplete(activeBlock, events, session.status, referenceNow)
    : false;

  // Rótulos e estilos visuais do estado do bloco ativo
  const stateConfig: Record<
    BlockExecutionState,
    { label: string; badgeColor: string; ringColor: string }
  > = {
    STUDYING: {
      label: 'Estudando',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      ringColor: 'ring-emerald-500/30 border-emerald-500',
    },
    PAUSED: {
      label: 'Pausado',
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
      ringColor: 'ring-amber-500/30 border-amber-500',
    },
    DISTRACTED: {
      label: 'Distraído',
      badgeColor: 'bg-red-100 text-red-800 border-red-200',
      ringColor: 'ring-red-500/30 border-red-500',
    },
    FINISHED: {
      label: 'Concluído',
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
      ringColor: 'ring-blue-500/30 border-blue-500',
    },
    NOT_STARTED: {
      label: 'Não Iniciado',
      badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
      ringColor: 'ring-slate-300 border-slate-300',
    },
  };

  const currentState = stateConfig[state] || stateConfig.NOT_STARTED;
  const kindLabel = activeBlock ? BLOCK_KIND_LABELS[activeBlock.kind] : '';
  const plannedSeconds = activeBlock ? activeBlock.planned_minutes * 60 : 0;

  return (
    <div className="space-y-6">
      {/* Alerta de Incomplete / Longo Intervalo sem registro */}
      {isIncomplete && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900 shadow-sm">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold">
              Atenção: Esta etapa possui um longo intervalo sem registro.
            </p>
            <p className="mt-0.5 text-xs text-amber-800 leading-relaxed">
              Se você se distraiu ou esqueceu o cronômetro ligado, declare os minutos
              de distração ao avançar ou concluir a etapa para manter suas estatísticas
              reais e consistentes.
            </p>
          </div>
        </div>
      )}

      {/* Cartão Principal do Timer */}
      <div
        className={`relative overflow-hidden rounded-3xl border bg-white p-6 md:p-8 shadow-sm transition-all ${currentState.ringColor} ring-2`}
        style={{
          borderTopWidth: '8px',
          borderTopColor: session.topic?.subject?.color || '#2563EB',
        }}
      >
        {/* Cabeçalho da Sessão */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 rounded-full shrink-0"
                style={{ backgroundColor: session.topic?.subject?.color || '#2563EB' }}
              />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {session.topic?.subject?.name || 'Matéria'}
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-slate-900 mt-1">
              {session.topic?.name || 'Sessão de Estudo'}
            </h2>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${currentState.badgeColor}`}
            >
              {currentState.label}
            </span>
            <span className="rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
              {kindLabel} ({activeBlock?.planned_minutes} min)
            </span>
          </div>
        </div>

        {/* Display Central do Tempo */}
        <div className="my-8 flex flex-col items-center justify-center text-center">
          <div className="text-5xl md:text-7xl font-mono font-black tracking-tight text-slate-900">
            {formatDuration(effectiveSeconds)}
          </div>
          <div className="mt-2 text-xs md:text-sm font-semibold text-slate-500">
            Meta da Etapa: {formatDuration(plannedSeconds)}
          </div>

          {/* Barra de Progresso da Etapa */}
          <div className="mt-6 w-full max-w-md">
            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100 p-0.5 border border-slate-200">
              <div
                className="h-full rounded-full bg-blue-600 transition-all duration-500"
                style={{ width: `${percentComplete}%` }}
              />
            </div>
            <div className="mt-1.5 flex justify-between text-[11px] font-medium text-slate-400">
              <span>00:00</span>
              <span>{Math.round(percentComplete)}%</span>
              <span>{formatDuration(plannedSeconds)}</span>
            </div>
          </div>
        </div>

        {/* Grid de Blocos da Sessão */}
        <div className="mb-8 pt-6 border-t border-slate-100">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
            Roteiro de Etapas da Sessão
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {blocks.map((b) => {
              const isActive = activeBlock?.id === b.id;
              const isPast = activeBlock ? b.position < activeBlock.position : false;

              return (
                <div
                  key={b.id}
                  className={`flex items-center justify-between rounded-xl border p-3 text-xs transition ${
                    isActive
                      ? 'border-blue-500 bg-blue-50/50 font-bold text-blue-900 ring-1 ring-blue-400'
                      : isPast
                      ? 'border-slate-200 bg-slate-50 text-slate-500 opacity-75'
                      : 'border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[10px] font-black text-slate-700">
                      {b.position}
                    </span>
                    <span>{BLOCK_KIND_LABELS[b.kind]}</span>
                  </div>
                  <span className="font-mono text-slate-500">{b.planned_minutes}m</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Controles Principais de Ação */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-6 border-t border-slate-100">
          {state === 'STUDYING' ? (
            <>
              <button
                type="button"
                onClick={onPause}
                disabled={isPending}
                className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-6 py-3.5 text-sm font-bold text-white shadow-md hover:bg-amber-600 transition disabled:opacity-50"
              >
                <Pause className="h-5 w-5 fill-current" />
                <span>Pausar</span>
              </button>
              <button
                type="button"
                onClick={onDistractionStart}
                disabled={isPending}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 border border-slate-200 px-5 py-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition disabled:opacity-50"
              >
                <Coffee className="h-5 w-5 text-slate-500" />
                <span>Distração</span>
              </button>
            </>
          ) : state === 'PAUSED' ? (
            <button
              type="button"
              onClick={onResume}
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-8 py-3.5 text-sm font-bold text-white shadow-md hover:bg-emerald-700 transition disabled:opacity-50"
            >
              <Play className="h-5 w-5 fill-current" />
              <span>Retomar</span>
            </button>
          ) : state === 'DISTRACTED' ? (
            <button
              type="button"
              onClick={onDistractionEnd}
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-8 py-3.5 text-sm font-bold text-white shadow-md hover:bg-emerald-700 transition disabled:opacity-50"
            >
              <Play className="h-5 w-5 fill-current" />
              <span>Retomar Foco</span>
            </button>
          ) : null}

          {/* Avançar Etapa (Apenas se houver próximo bloco) */}
          {nextBlock && (
            <button
              type="button"
              onClick={onAdvanceStep}
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-6 py-3.5 text-sm font-bold text-white shadow-md hover:bg-blue-700 transition disabled:opacity-50"
            >
              <RotateCcw className="h-5 w-5" />
              <span>Avançar Etapa</span>
            </button>
          )}

          {/* Concluir Estudo (Sempre disponível) */}
          <button
            type="button"
            onClick={onFinishSession}
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-2xl bg-emerald-700 px-6 py-3.5 text-sm font-bold text-white shadow-md hover:bg-emerald-800 transition disabled:opacity-50"
          >
            <CheckCircle className="h-5 w-5" />
            <span>Concluir Estudo</span>
          </button>

          {/* Cancelar Sessão */}
          <button
            type="button"
            onClick={onCancelSession}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-2xl px-4 py-3.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition disabled:opacity-50"
          >
            <XCircle className="h-4 w-4" />
            <span>Cancelar Sessão</span>
          </button>
        </div>
      </div>

      {/* Resumo Consolidado do Tempo em Tempo Real */}
      {sessionMetrics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm text-center">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Tempo Efetivo
            </span>
            <span className="text-xl font-mono font-black text-slate-900">
              {formatDuration(sessionMetrics.effectiveSeconds)}
            </span>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm text-center">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Tempo Total
            </span>
            <span className="text-xl font-mono font-black text-slate-900">
              {formatDuration(sessionMetrics.totalSeconds)}
            </span>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm text-center">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Efetividade (Foco)
            </span>
            <span className="text-xl font-black text-emerald-600">
              {formatPercent(sessionMetrics.effectiveness)}
            </span>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm text-center">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Aderência ao Plano
            </span>
            <span className="text-xl font-black text-blue-600">
              {formatPercent(sessionMetrics.adherence)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
