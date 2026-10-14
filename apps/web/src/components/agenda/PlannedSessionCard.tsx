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
  onEdit?: (session: any) => void;
  onReschedule?: (session: any) => void;
  onSkip?: (session: any) => void;
  onDelete?: (session: any) => void;
}

export function PlannedSessionCard({
  session,
  isOverlapping = false,
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
      className={`relative rounded-xl border bg-white p-4 shadow-sm transition hover:shadow-md ${
        isOverlapping ? 'border-red-400 ring-1 ring-red-300' : 'border-slate-200'
      }`}
      style={{
        borderLeftWidth: '6px',
        borderLeftColor: session.subject.color || '#3B82F6',
      }}
    >
      {/* Cabeçalho do Card */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 text-slate-800">
          <Clock className="h-4 w-4 text-slate-500" />
          <span className="font-semibold text-base">{session.local_time}</span>
          <span className="text-xs font-medium text-slate-500">
            ({session.planned_minutes} min)
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {/* Badge Conflito de Horário */}
          {isOverlapping && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700"
              title="Esta sessão possui horário sobreposto a outra sessão planejada"
            >
              <AlertTriangle className="h-3 w-3" />
              Conflito
            </span>
          )}

          {/* Badge Remarcada */}
          {isRescheduled && (
            <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
              <RotateCcw className="h-3 w-3" />
              Remarcada
            </span>
          )}

          {/* Badge de Status */}
          <span
            className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
              statusStyles[session.status] || 'bg-slate-100 text-slate-600'
            }`}
          >
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Matéria e Assunto */}
      <div className="mb-2">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: session.subject.color }}
          />
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider truncate">
            {session.subject.name}
          </span>
          {isArchived && (
            <span className="text-xs text-amber-600 font-medium">(Arquivado)</span>
          )}
        </div>
        <h4 className="text-base font-bold text-slate-900 mt-0.5 leading-snug">
          {session.topic.name}
        </h4>
      </div>

      {/* Tags: Prioridade e Atividade */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <span
          className={`rounded-md border px-2 py-0.5 text-xs font-medium ${
            priorityStyles[session.priority] || priorityStyles.MEDIUM
          }`}
        >
          {priorityLabel}
        </span>
        <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700">
          <BookOpen className="h-3 w-3 text-slate-500" />
          {activityLabel}
        </span>
      </div>

      {/* Pílulas de Etapas (Blocks) */}
      {session.blocks && session.blocks.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 mb-3 pt-2 border-t border-slate-100">
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
                className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium ${
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
        <p className="text-xs text-slate-500 italic mb-3 line-clamp-2 bg-slate-50 p-1.5 rounded">
          "{session.notes}"
        </p>
      )}

      {/* Ações Rápidas (quando PLANNED) */}
      {isPlanned && (
        <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-100">
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(session)}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
              title="Editar sessão"
            >
              <Edit className="h-3.5 w-3.5" />
              Editar
            </button>
          )}

          {onReschedule && (
            <button
              type="button"
              onClick={() => onReschedule(session)}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-purple-600 hover:bg-purple-50 transition"
              title="Remarcar para outro horário"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Remarcar
            </button>
          )}

          {onSkip && (
            <button
              type="button"
              onClick={() => onSkip(session)}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-amber-600 hover:bg-amber-50 transition"
              title="Pular sessão"
            >
              <FastForward className="h-3.5 w-3.5" />
              Pular
            </button>
          )}

          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(session)}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition"
              title="Excluir sessão planejada"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Excluir
            </button>
          )}
        </div>
      )}
    </div>
  );
}
