import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  Calendar,
  Clock,
  BookOpen,
  CheckCircle2,
  FileText,
  Edit3,
  Save,
  RotateCcw,
  Plus,
  Layers,
  Award,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';

export interface SessionDetailsModalProps {
  sessionId: string | null;
  onClose: () => void;
}

function formatDateBr(isoString: string): string {
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return isoString;
  }
}

function formatMinutes(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds)) return '0 min';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.round(seconds / 60);
  return `${mins} min`;
}

export function SessionDetailsModal({ sessionId, onClose }: SessionDetailsModalProps) {
  const queryClient = useQueryClient();
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesInput, setNotesInput] = useState('');

  const {
    data: sessionRes,
    isLoading,
    isError,
    refetch,
  } = useQuery<{ data: any }>({
    queryKey: ['study-session-details', sessionId],
    queryFn: () => apiFetch(`/api/study-sessions/${sessionId}`),
    enabled: Boolean(sessionId),
  });

  const session = sessionRes?.data ?? sessionRes ?? null;

  useEffect(() => {
    if (session) {
      const existingNotes = session.evaluation?.notes ?? '';
      setNotesInput(existingNotes);
      setIsEditingNotes(false);
    }
  }, [session]);

  const updateNotesMutation = useMutation({
    mutationFn: (newNotes: string) =>
      apiFetch(`/api/study-sessions/${sessionId}`, {
        method: 'PATCH',
        body: JSON.stringify({ notes: newNotes }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['study-session-details', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['study-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['planned-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['statistics'] });
      queryClient.invalidateQueries({ queryKey: ['observatory'] });
      setIsEditingNotes(false);
    },
  });

  if (!sessionId) return null;

  // Extração de métricas de blocos
  const blocks = session?.session_blocks || [];
  const metricsBlocks = session?.metrics?.blocks || [];

  const getMinutesForKind = (kind: string) => {
    // Procura primeiro nos blocos com métricas reais
    const matchedMetrics = metricsBlocks.filter((b: any) => b.kind === kind);
    if (matchedMetrics.length > 0) {
      const totalSec = matchedMetrics.reduce(
        (acc: number, curr: any) => acc + (curr.effectiveSeconds || 0),
        0
      );
      if (totalSec > 0) return formatMinutes(totalSec);
    }

    // Fallback para duração planejada dos blocos
    const matchedBlocks = blocks.filter((b: any) => b.kind === kind);
    if (matchedBlocks.length > 0) {
      const totalMin = matchedBlocks.reduce(
        (acc: number, curr: any) => acc + (curr.planned_minutes || 0),
        0
      );
      return `${totalMin} min`;
    }

    return '0 min';
  };

  const theoryMinutesStr = getMinutesForKind('NEW_CONTENT');
  const reviewMinutesStr = getMinutesForKind('REVIEW');
  const practiceMinutesStr = getMinutesForKind('PRACTICE');

  // Prática / Questões
  const practiceRecords = session?.practice_records || [];
  const totalQuestions = practiceRecords.reduce(
    (acc: number, r: any) => acc + (r.questions || 0),
    0
  );
  const totalCorrect = practiceRecords.reduce(
    (acc: number, r: any) => acc + (r.correct || 0),
    0
  );
  const accuracyPercent =
    totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : null;

  const plannedSeconds = session?.metrics?.plannedSeconds;
  const effectiveSeconds = session?.metrics?.effectiveSeconds;
  const effectiveness = session?.metrics?.effectiveness;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Cabeçalho do Modal */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Detalhes da Sessão</h3>
              <p className="text-xs text-slate-500">
                Resumo da execução, métricas e anotações pós-estudo
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition"
            title="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Corpo do Modal */}
        <div className="p-6 space-y-6 max-h-[calc(85vh-130px)] overflow-y-auto">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-slate-500">
              <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent mb-2" />
              <p>Carregando detalhes da sessão...</p>
            </div>
          ) : isError || !session ? (
            <div className="py-10 text-center text-sm text-slate-500">
              <p>Não foi possível carregar os detalhes desta sessão.</p>
              <button
                type="button"
                onClick={() => refetch()}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                Tentar novamente
              </button>
            </div>
          ) : (
            <>
              {/* Identificação */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{
                        backgroundColor: session.topic?.subject?.color || '#10B981',
                      }}
                    />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      {session.topic?.subject?.name || 'Matéria'}
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Concluída
                  </span>
                </div>

                <h4 className="text-lg font-bold text-slate-900 leading-snug">
                  {session.topic?.name || 'Assunto Geral'}
                </h4>

                <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500 border-t border-slate-200/60 pt-2.5">
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    {session.started_at ? formatDateBr(session.started_at) : 'Data indisponível'}
                  </span>
                  {session.ended_at && (
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-slate-400" />
                      Fim: {formatDateBr(session.ended_at)}
                    </span>
                  )}
                </div>
              </div>

              {/* Métricas Principais */}
              <div className="grid gap-3 sm:grid-cols-2">
                {/* Tempo Planejado vs Real */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 mb-2">
                    <Clock className="h-4 w-4 text-emerald-600" />
                    <span>Tempo de Estudo</span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <div>
                      <p className="text-xl font-black text-slate-900">
                        {effectiveSeconds != null
                          ? formatMinutes(effectiveSeconds)
                          : formatMinutes(plannedSeconds)}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Planejado: {plannedSeconds ? formatMinutes(plannedSeconds) : '—'}
                      </p>
                    </div>
                    {effectiveness != null && (
                      <div className="text-right">
                        <span className="inline-block rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs font-bold text-emerald-700">
                          {Math.round(effectiveness)}% Foco
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Questões e Aproveitamento */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 mb-2">
                    <Award className="h-4 w-4 text-indigo-600" />
                    <span>Aproveitamento em Questões</span>
                  </div>
                  {totalQuestions > 0 ? (
                    <div>
                      <div className="flex items-baseline gap-2">
                        <p className="text-xl font-black text-slate-900">
                          {totalCorrect} / {totalQuestions}
                        </p>
                        <span className="text-xs font-bold text-indigo-700">
                          ({accuracyPercent}% acerto)
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {totalQuestions - totalCorrect} erros registrados
                      </p>
                    </div>
                  ) : (
                    <div className="py-1">
                      <p className="text-xs text-slate-400 italic">
                        Nenhuma questão registrada nesta sessão.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Minutos Dedicados a Cada Etapa */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 mb-3">
                  <Layers className="h-4 w-4 text-emerald-600" />
                  <span>Distribuição por Etapa</span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-2.5 text-center">
                    <span className="text-[11px] font-semibold text-emerald-800 block">
                      Teoria Nova
                    </span>
                    <strong className="text-sm font-bold text-slate-900 mt-0.5 block">
                      {theoryMinutesStr}
                    </strong>
                  </div>

                  <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-2.5 text-center">
                    <span className="text-[11px] font-semibold text-blue-800 block">
                      Revisão
                    </span>
                    <strong className="text-sm font-bold text-slate-900 mt-0.5 block">
                      {reviewMinutesStr}
                    </strong>
                  </div>

                  <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-2.5 text-center">
                    <span className="text-[11px] font-semibold text-violet-800 block">
                      Prática
                    </span>
                    <strong className="text-sm font-bold text-slate-900 mt-0.5 block">
                      {practiceMinutesStr}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Secção Anotações da Sessão */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                    <FileText className="h-4 w-4 text-emerald-600" />
                    <span>Anotações da Sessão</span>
                  </div>

                  {!isEditingNotes && (
                    <button
                      type="button"
                      onClick={() => setIsEditingNotes(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>{session.evaluation?.notes ? 'Editar anotação' : 'Adicionar anotação'}</span>
                    </button>
                  )}
                </div>

                {isEditingNotes ? (
                  <div className="space-y-3">
                    <textarea
                      value={notesInput}
                      onChange={(e) => setNotesInput(e.target.value)}
                      rows={4}
                      placeholder="Escreva aqui suas impressões, dúvidas que surgiram ou pontos a reforçar nesta sessão..."
                      className="w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-800 placeholder-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                      autoFocus
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setNotesInput(session.evaluation?.notes || '');
                          setIsEditingNotes(false);
                        }}
                        disabled={updateNotesMutation.isPending}
                        className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => updateNotesMutation.mutate(notesInput)}
                        disabled={updateNotesMutation.isPending}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition disabled:opacity-50"
                      >
                        <Save className="h-3.5 w-3.5" />
                        <span>
                          {updateNotesMutation.isPending ? 'Salvando...' : 'Salvar Anotação'}
                        </span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {session.evaluation?.notes && session.evaluation.notes.trim() ? (
                      <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3.5 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                        {session.evaluation.notes}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-200 p-5 text-center">
                        <p className="text-xs text-slate-400 italic mb-2">
                          Sem anotações registradas.
                        </p>
                        <button
                          type="button"
                          onClick={() => setIsEditingNotes(true)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>Adicionar primeira nota</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Rodapé */}
        <div className="flex items-center justify-end border-t border-slate-100 bg-slate-50 px-6 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition shadow-sm"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
