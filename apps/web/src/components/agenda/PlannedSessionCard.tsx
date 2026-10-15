import React from 'react';
import {
  Clock,
  AlertTriangle,
  RotateCcw,
  Edit,
  FastForward,
  Trash2,
  Tag,
  BookOpen,
  Play,
} from 'lucide-react';
import {
  PRIORITY_LABELS,
  ACTIVITY_TYPE_LABELS,
  PLANNED_SESSION_STATUS_LABELS,
  BLOCK_KIND_LABELS,
  type PlannedSessionPriority,
  type PlannedActivityType,
} from '@estudos/domain';

export interface PlannedSessionCardProps {
  session: {
    id: string;
    subject_id: string;
    topic_id: string;
    scheduled_start: string;
    planned_minutes: number;
    priority: string;
    activity_type: string | null;
    notes: string | null;
    status: 'PLANNED' | 'DONE' | 'SKIPPED' | 'RESCHEDULED';
    rescheduled_from_id: string | null;
    local_date: string;
    local_time: string;
    actual_effective_seconds?: number | null;
    actual_total_seconds?: number | null;
    subject: {
      id: string;
      name: string;
      color: string;
      archived: boolean;
    };
    topic: {
      id: string;
      name: string;
      archived: boolean;
    };
    blocks: Array<{
      id?: string;
      kind: 'REVIEW' | 'NEW_CONTENT' | 'PRACTICE';
      planned_minutes: number;
      position: number;
    }>;
  };
  isOverlapping?: boolean;
  onStartStudy?: (session: any) => void;
  onEdit?: (session: any) => void;
  onReschedule?: (session: any) => void;
  onSkip?: (session: any) => void;
  onDelete?: (session: any) => void;
}

export function PlannedSessionCard({
  session,
  isOverlapping = false,
  onStartStudy,
  onEdit,
  onReschedule,
  onSkip,
  onDelete,
}: PlannedSessionCardProps) {
  const isPlanned = session.status === 'PLANNED';
  const isArchived = session.subject.archived || session.topic.archived;
  const isRescheduled = Boolean(session.rescheduled_from_id);

  const priorityLabel =
    PRIORITY_LABELS[session.priority as PlannedSessionPriority] || session.priority;
  const activityLabel = session.activity_type
    ? ACTIVITY_TYPE_LABELS[session.activity_type as PlannedActivityType] || session.activity_type
    : 'Geral';
  const statusLabel =
    PLANNED_SESSION_STATUS_LABELS[session.status] || session.status;

  const priorityStyles: Record<string, string> = {
    HIGH: 'bg-red-50 text-red-700 border-red-200',
    MEDIUM: 'bg-amber-50 text-amber-700 border-amber-200',
    LOW: 'bg-slate-50 text-slate-700 border-slate-200',
  };

  const statusStyles: Record<string, string> = {
    PLANNED: 'bg-blue-50 text-blue-700 border-blue-200',
    DONE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    SKIPPED: 'bg-slate-100 text-slate-600 border-slate-300',
    RESCHEDULED: 'bg-purple-50 text-purple-700 border-purple-200',
  };

  return (
    <div
      className={`relative rounded-xl border bg-white p-3.5 shadow-sm transition hover:shadow-md min-w-0 overflow-hidden ${
        isOverlapping ? 'border-red-400 ring-1 ring-red-300' : 'border-slate-200'
      }`}
      style={{
        borderLeftWidth: '5px',
        borderLeftColor: session.subject.color || '#3B82F6',
      }}
    >
      {/* Cabeçalho do Card */}
      <div className="flex items-start justify-between gap-2 mb-1.5 min-w-0">
        <div className="flex items-center gap-1.5 text-slate-800 shrink-0">
          <Clock className="h-4 w-4 text-slate-500 shrink-0" />
          <span className="font-semibold text-sm">{session.local_time}</span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap justify-end shrink-0">
          {/* Badge Conflito de Horário */}
          {isOverlapping && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700 shrink-0"
              title="Esta sessão possui horário sobreposto a outra sessão planejada"
            >
              <AlertTriangle className="h-3 w-3 shrink-0" />
              Conflito
            </span>
          )}

          {/* Badge Remarcada */}
          {isRescheduled && (
            <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-[11px] font-medium text-purple-700 shrink-0">
              <RotateCcw className="h-3 w-3 shrink-0" />
              Remarcada
            </span>
          )}

          {/* Badge de Status */}
          <span
            className={`rounded-full border px-2 py-0.5 text-[11px] font-medium shrink-0 whitespace-nowrap ${
              statusStyles[session.status] || 'bg-slate-100 text-slate-600'
            }`}
          >
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Duração Planejada / Realizada */}
      <div className="text-xs font-medium text-slate-500 mb-2 min-w-0">
        {session.status === 'DONE' ? (
          <span className="truncate block">
            Planejado: {session.planned_minutes} min • Realizado:{' '}
            {session.actual_effective_seconds != null
              ? session.actual_effective_seconds < 60
                ? `${session.actual_effective_seconds}s`
                : `${Math.round(session.actual_effective_seconds / 60)} min`
              : `${session.planned_minutes} min`}
          </span>
        ) : (
          <span>Planejado: {session.planned_minutes} min</span>
        )}
      </div>

      {/* Matéria e Assunto */}
      <div className="mb-2 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
            style={{ backgroundColor: session.subject.color }}
          />
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider truncate">
            {session.subject.name}
          </span>
          {isArchived && (
            <span className="text-xs text-amber-600 font-medium shrink-0">(Arquivado)</span>
          )}
        </div>
        <h4 className="text-sm font-bold text-slate-900 mt-0.5 leading-snug break-words line-clamp-2">
          {session.topic.name}
        </h4>
      </div>

      {/* Tags: Prioridade e Atividade */}
      <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
        <span
          className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${
            priorityStyles[session.priority] || priorityStyles.MEDIUM
          }`}
        >
          {priorityLabel}
        </span>
        <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-700">
          <BookOpen className="h-3 w-3 text-slate-500 shrink-0" />
          {activityLabel}
        </span>
      </div>

      {/* Pílulas de Etapas (Blocks) */}
      {session.blocks && session.blocks.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 mb-2.5 pt-2 border-t border-slate-100">
          {session.blocks.map((block, idx) => {
            const kindColors: Record<string, string> = {
              REVIEW: 'bg-blue-50 text-blue-700 border-blue-200',
              NEW_CONTENT: 'bg-emerald-50 text-emerald-700 border-emerald-200',
              PRACTICE: 'bg-violet-50 text-violet-700 border-violet-200',
            };
            const label =
              block.kind === 'REVIEW'
                ? 'Rev'
                : block.kind === 'NEW_CONTENT'
                ? 'Novo'
                : 'Prát';

            return (
              <span
                key={block.id || idx}
                className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${
                  kindColors[block.kind] || 'bg-slate-50 text-slate-700'
                }`}
                title={`${BLOCK_KIND_LABELS[block.kind]}: ${block.planned_minutes} min`}
              >
                {label} {block.planned_minutes}m
              </span>
            );
          })}
        </div>
      )}

      {/* Notas adicionais */}
      {session.notes && (
        <p className="text-xs text-slate-500 italic mb-2.5 line-clamp-2 bg-slate-50 p-1.5 rounded break-words">
          "{session.notes}"
        </p>
      )}

      {/* Ações Rápidas */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 pt-2 border-t border-slate-100 min-w-0">
        {isPlanned ? (
          <>
            <div>
              {onStartStudy && (
                <button
                  type="button"
                  onClick={() => onStartStudy(session)}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition"
                  title="Iniciar Sessão de Estudo"
                >
                  <Play className="h-3.5 w-3.5 fill-current shrink-0" />
                  Iniciar Estudo
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-1">
              {onEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(session)}
                  className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
                  title="Editar sessão"
                >
                  <Edit className="h-3.5 w-3.5 shrink-0" />
                  Editar
                </button>
              )}
              {onReschedule && (
                <button
                  type="button"
                  onClick={() => onReschedule(session)}
                  className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs font-medium text-purple-600 hover:bg-purple-50 transition"
                  title="Remarcar para outro horário"
                >
                  <RotateCcw className="h-3.5 w-3.5 shrink-0" />
                  Remarcar
                </button>
              )}
              {onSkip && (
                <button
                  type="button"
                  onClick={() => onSkip(session)}
                  className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs font-medium text-amber-600 hover:bg-amber-50 transition"
                  title="Pular sessão"
                >
                  <FastForward className="h-3.5 w-3.5 shrink-0" />
                  Pular
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(session)}
                  className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition"
                  title="Excluir sessão planejada"
                >
                  <Trash2 className="h-3.5 w-3.5 shrink-0" />
                  Excluir
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-end w-full">
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(session)}
                className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs font-medium text-slate-400 hover:text-red-600 hover:bg-red-50 transition ml-auto"
                title="Excluir sessão da agenda"
              >
                <Trash2 className="h-3.5 w-3.5 shrink-0" />
                Excluir
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
