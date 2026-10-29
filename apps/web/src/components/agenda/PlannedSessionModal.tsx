import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Calendar,
  Clock,
  Layers,
  BookOpen,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import {
  calculateBlockPreset,
  validatePlannedBlocks,
  PRIORITIES,
  ACTIVITY_TYPES,
  PRIORITY_LABELS,
  ACTIVITY_TYPE_LABELS,
  type BlockPreset,
  type PlannedSessionPriority,
  type PlannedActivityType,
} from '@estudos/domain';

export interface PlannedSessionPrefill {
  subjectId?: string;
  topicId?: string;
  stage?: 'PRACTICE' | 'REVIEW' | 'NEW_CONTENT';
  leaveScheduleEmpty?: boolean;
}

export interface PlannedSessionModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit' | 'reschedule';
  initialSession?: any | null;
  prefill?: PlannedSessionPrefill | null;
  subjects: Array<{ id: string; name: string; color: string; archived: boolean }>;
  topics: Array<{ id: string; subject_id: string; name: string; archived: boolean }>;
  userTimezone: string;
  defaultDate?: string; // YYYY-MM-DD
  onClose: () => void;
  onSubmit: (payload: any) => Promise<void>;
}

export function PlannedSessionModal({
  isOpen,
  mode,
  initialSession,
  prefill,
  subjects,
  topics,
  userTimezone,
  defaultDate,
  onClose,
  onSubmit,
}: PlannedSessionModalProps) {
  if (!isOpen) return null;

  // Filtrar apenas matérias e assuntos ativos (permitindo os atuais caso seja edição ou prefill)
  const activeSubjects = useMemo(() => {
    return subjects.filter(
      (s) =>
        !s.archived ||
        (initialSession && s.id === initialSession.subject_id) ||
        (prefill?.subjectId && s.id === prefill.subjectId)
    );
  }, [subjects, initialSession, prefill]);

  const [subjectId, setSubjectId] = useState(
    initialSession?.subject_id || prefill?.subjectId || (activeSubjects[0]?.id ?? '')
  );

  // Sincronizar subjectId caso as matérias carreguem de forma assíncrona ou o prefill mude
  useEffect(() => {
    if (prefill?.subjectId) {
      setSubjectId(prefill.subjectId);
    } else if (initialSession?.subject_id) {
      setSubjectId(initialSession.subject_id);
    } else if (!subjectId && activeSubjects.length > 0) {
      setSubjectId(activeSubjects[0].id);
    }
  }, [prefill?.subjectId, initialSession?.subject_id, activeSubjects]);

  const availableTopics = useMemo(() => {
    return topics.filter(
      (t) =>
        t.subject_id === subjectId &&
        (!t.archived ||
          (initialSession && t.id === initialSession.topic_id) ||
          (prefill?.topicId && t.id === prefill.topicId))
    );
  }, [topics, subjectId, initialSession, prefill]);

  const [topicId, setTopicId] = useState(
    initialSession?.topic_id || prefill?.topicId || (availableTopics[0]?.id ?? '')
  );

  // Garantir que topicId acompanhe a troca de subjectId ou prefill
  useEffect(() => {
    if (prefill?.topicId && availableTopics.some((t) => t.id === prefill.topicId)) {
      setTopicId(prefill.topicId);
    } else if (!availableTopics.some((t) => t.id === topicId)) {
      setTopicId(availableTopics[0]?.id ?? '');
    }
  }, [subjectId, availableTopics, prefill?.topicId]);

  // Horário local YYYY-MM-DDTHH:mm (aberto para preenchimento manual quando vem de prefill do Observatório)
  const defaultLocalTime = useMemo(() => {
    if (initialSession?.local_date && initialSession?.local_time) {
      return `${initialSession.local_date}T${initialSession.local_time}`;
    }
    if (prefill?.leaveScheduleEmpty) {
      return '';
    }
    const date = defaultDate || new Date().toISOString().slice(0, 10);
    return `${date}T09:00`;
  }, [initialSession, defaultDate, prefill?.leaveScheduleEmpty]);

  const [scheduledStartLocal, setScheduledStartLocal] = useState(defaultLocalTime);
  const [plannedMinutes, setPlannedMinutes] = useState<number>(
    initialSession?.planned_minutes || 60
  );
  const [priority, setPriority] = useState<PlannedSessionPriority>(
    initialSession?.priority || 'MEDIUM'
  );
  const [activityType, setActivityType] = useState<PlannedActivityType>(
    initialSession?.activity_type ||
      (prefill?.stage === 'PRACTICE'
        ? 'PRACTICE'
        : prefill?.stage === 'REVIEW'
        ? 'REVIEW'
        : 'THEORY')
  );
  const [notes, setNotes] = useState(initialSession?.notes || '');

  // Minutos de cada etapa
  const [reviewMin, setReviewMin] = useState<number>(0);
  const [newContentMin, setNewContentMin] = useState<number>(0);
  const [practiceMin, setPracticeMin] = useState<number>(0);

  const [selectedPreset, setSelectedPreset] = useState<BlockPreset | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Inicializar blocos ao abrir
  useEffect(() => {
    if (initialSession?.blocks && initialSession.blocks.length > 0) {
      let rev = 0,
        novo = 0,
        prat = 0;
      for (const b of initialSession.blocks) {
        if (b.kind === 'REVIEW') rev = b.planned_minutes;
        if (b.kind === 'NEW_CONTENT') novo = b.planned_minutes;
        if (b.kind === 'PRACTICE') prat = b.planned_minutes;
      }
      setReviewMin(rev);
      setNewContentMin(novo);
      setPracticeMin(prat);
    } else if (prefill?.stage === 'PRACTICE') {
      setSelectedPreset('PRACTICE_FOCUS');
      setActivityType('PRACTICE');
      setReviewMin(0);
      setNewContentMin(0);
      setPracticeMin(plannedMinutes);
    } else if (prefill?.stage === 'REVIEW') {
      setSelectedPreset(null);
      setActivityType('REVIEW');
      const rev = Math.round(plannedMinutes * 0.5);
      setReviewMin(rev);
      setNewContentMin(0);
      setPracticeMin(plannedMinutes - rev);
    } else {
      // Default: Balanced para 60 min
      applyPreset('BALANCED', plannedMinutes);
    }
  }, [initialSession, prefill?.stage]);

  function applyPreset(preset: BlockPreset, total: number) {
    setSelectedPreset(preset);
    const blocks = calculateBlockPreset(total, preset);
    let rev = 0,
      novo = 0,
      prat = 0;
    for (const b of blocks) {
      if (b.kind === 'REVIEW') rev = b.planned_minutes;
      if (b.kind === 'NEW_CONTENT') novo = b.planned_minutes;
      if (b.kind === 'PRACTICE') prat = b.planned_minutes;
    }
    setReviewMin(rev);
    setNewContentMin(novo);
    setPracticeMin(prat);
  }

  function handleDurationChange(mins: number) {
    const val = Math.max(5, Math.min(480, mins));
    setPlannedMinutes(val);
    if (prefill?.stage === 'PRACTICE' && reviewMin === 0 && newContentMin === 0) {
      setPracticeMin(val);
    } else if (selectedPreset) {
      applyPreset(selectedPreset, val);
    }
  }

  // Validação dinâmica da soma dos blocos
  const totalBlocksSum = reviewMin + newContentMin + practiceMin;
  const blocksDiff = totalBlocksSum - plannedMinutes;

  const validationState: 'yellow' | 'green' | 'red' =
    blocksDiff === 0 && totalBlocksSum >= 5
      ? 'green'
      : blocksDiff < 0
      ? 'yellow'
      : 'red';

  const isFormValid =
    validationState === 'green' &&
    subjectId &&
    topicId &&
    scheduledStartLocal &&
    plannedMinutes >= 5 &&
    plannedMinutes <= 480;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isFormValid || submitting) return;

    setErrorMsg('');
    setSubmitting(true);

    try {
      const activeBlocks = [
        { kind: 'REVIEW' as const, planned_minutes: reviewMin },
        { kind: 'NEW_CONTENT' as const, planned_minutes: newContentMin },
        { kind: 'PRACTICE' as const, planned_minutes: practiceMin },
      ].filter((b) => b.planned_minutes > 0);

      if (mode === 'create') {
        await onSubmit({
          subject_id: subjectId,
          topic_id: topicId,
          scheduled_start_local: scheduledStartLocal,
          planned_minutes: plannedMinutes,
          priority,
          activity_type: activityType,
          notes: notes.trim() ? notes.trim() : null,
          blocks: activeBlocks,
        });
      } else if (mode === 'edit') {
        await onSubmit({
          subject_id: subjectId,
          topic_id: topicId,
          priority,
          activity_type: activityType,
          notes: notes.trim() ? notes.trim() : null,
          planned_minutes: plannedMinutes,
          blocks: activeBlocks,
        });
      } else if (mode === 'reschedule') {
        await onSubmit({
          scheduled_start_local: scheduledStartLocal,
          planned_minutes: plannedMinutes,
          blocks: activeBlocks,
        });
      }

      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Ocorreu um erro ao processar o agendamento.');
    } finally {
      setSubmitting(false);
    }
  }

  const modalContent = (
    <div className="fixed inset-0 z-50 p-4 sm:p-6 overflow-y-auto flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl my-auto bg-white shadow-2xl border border-slate-200 p-6">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar modal"
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Cabeçalho Padronizado */}
        <div>
          <div className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold px-2.5 py-1 rounded-full w-fit mb-2">
            Planejamento de Estudo
          </div>
          <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
            Agendar Sessão de Estudo
          </h3>
          <p className="text-sm text-slate-500 mt-1 mb-6">
            Defina o horário e a distribuição das etapas de teoria, revisão e prática.
          </p>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMsg && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700 border border-red-200">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Seletores de Matéria e Assunto */}
          {mode !== 'reschedule' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Matéria
                </label>
                <select
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                  required
                >
                  {activeSubjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.archived ? '(Arquivada)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Assunto
                </label>
                <select
                  value={topicId}
                  onChange={(e) => setTopicId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                  required
                  disabled={availableTopics.length === 0}
                >
                  {availableTopics.length === 0 ? (
                    <option value="">Nenhum assunto ativo cadastrado</option>
                  ) : (
                    availableTopics.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} {t.archived ? '(Arquivado)' : ''}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-emerald-50 p-3 border border-emerald-200 text-xs text-emerald-900">
              <span className="font-semibold">Sessão a remarcar:</span>{' '}
              {initialSession?.subject?.name} — {initialSession?.topic?.name}
            </div>
          )}

          {/* Horário de Início */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Data e Horário de Início
            </label>
            {mode === 'edit' ? (
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                <span>
                  {initialSession?.local_date} às {initialSession?.local_time}
                </span>
                <span className="text-xs text-amber-600 font-medium italic">
                  Para alterar o horário, use o botão Remarcar.
                </span>
              </div>
            ) : (
              <input
                type="datetime-local"
                value={scheduledStartLocal}
                onChange={(e) => setScheduledStartLocal(e.target.value)}
                placeholder="Selecione data e horário"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                required
              />
            )}
          </div>

          {/* Duração e Atalhos Rápidos */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Duração Total da Sessão
              </label>
              <span className="text-xs font-bold text-emerald-700">
                {plannedMinutes} minutos
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="number"
                min={5}
                max={480}
                value={plannedMinutes}
                onChange={(e) => handleDurationChange(Number(e.target.value))}
                className="w-24 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 font-bold focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                required
              />

              <div className="flex flex-wrap gap-1">
                {[30, 45, 60, 90, 120].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => handleDurationChange(mins)}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                      plannedMinutes === mins
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {mins}m
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Presets de 1 Clique */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Presets de Distribuição de Etapas
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => applyPreset('BALANCED', plannedMinutes)}
                className={`rounded-xl border p-2.5 text-left transition ${
                  selectedPreset === 'BALANCED'
                    ? 'border-emerald-600 bg-emerald-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="text-xs font-bold text-slate-900">Equilibrado</div>
                <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  Revisão: 25% • Teoria Nova: 50% • Prática: 25%
                </div>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('PRACTICE_FOCUS', plannedMinutes)}
                className={`rounded-xl border p-2.5 text-left transition ${
                  selectedPreset === 'PRACTICE_FOCUS'
                    ? 'border-emerald-600 bg-emerald-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="text-xs font-bold text-slate-900">Foco em Prática</div>
                <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  Revisão: 20% • Prática: 80%
                </div>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('NEW_ONLY', plannedMinutes)}
                className={`rounded-xl border p-2.5 text-left transition ${
                  selectedPreset === 'NEW_ONLY'
                    ? 'border-emerald-600 bg-emerald-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="text-xs font-bold text-slate-900">Só Teoria Nova</div>
                <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  Teoria Nova: 100%
                </div>
              </button>
            </div>
          </div>

          {/* Construtor Manual de Etapas */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Revisão (min)
              </label>
              <input
                type="number"
                min={0}
                max={plannedMinutes}
                value={reviewMin}
                onChange={(e) => {
                  setSelectedPreset(null);
                  setReviewMin(Math.max(0, Number(e.target.value)));
                }}
                className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-sm text-slate-800 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Teoria Nova (min)
              </label>
              <input
                type="number"
                min={0}
                max={plannedMinutes}
                value={newContentMin}
                onChange={(e) => {
                  setSelectedPreset(null);
                  setNewContentMin(Math.max(0, Number(e.target.value)));
                }}
                className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-sm text-slate-800 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Prática (min)
              </label>
              <input
                type="number"
                min={0}
                max={plannedMinutes}
                value={practiceMin}
                onChange={(e) => {
                  setSelectedPreset(null);
                  setPracticeMin(Math.max(0, Number(e.target.value)));
                }}
                className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-sm text-slate-800 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>
          </div>

          {/* Barra de Validação Visual de Minutos */}
          <div
            className={`rounded-xl border p-3 flex items-center justify-between text-xs font-semibold ${
              validationState === 'green'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : validationState === 'yellow'
                ? 'bg-amber-50 text-amber-800 border-amber-300'
                : 'bg-red-50 text-red-800 border-red-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {validationState === 'green' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              )}
              <span>
                {validationState === 'green'
                  ? `Distribuição exata: ${totalBlocksSum} de ${plannedMinutes} min`
                  : validationState === 'yellow'
                  ? `Faltam ${Math.abs(blocksDiff)} min para atingir a meta da sessão (${totalBlocksSum}/${plannedMinutes} min)`
                  : `A soma das etapas excede a sessão em ${blocksDiff} min (${totalBlocksSum}/${plannedMinutes} min)`}
              </span>
            </div>
            <span>{Math.round((totalBlocksSum / plannedMinutes) * 100)}%</span>
          </div>

          {/* Prioridade e Tipo de Atividade */}
          {mode !== 'reschedule' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Prioridade
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as PlannedSessionPriority)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {PRIORITY_LABELS[p]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Tipo de Atividade
                </label>
                <select
                  value={activityType}
                  onChange={(e) => setActivityType(e.target.value as PlannedActivityType)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                >
                  {ACTIVITY_TYPES.map((a) => (
                    <option key={a} value={a}>
                      {ACTIVITY_TYPE_LABELS[a]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Notas */}
          {mode !== 'reschedule' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Notas / Metas Específicas da Sessão (Opcional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Resolver 15 exercícios da lista e revisar resumos..."
                rows={2}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600 resize-none"
              />
            </div>
          )}

          {/* Rodapé com Botões */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!isFormValid || submitting}
              className={`rounded-xl px-5 py-2 text-sm font-semibold text-white shadow-sm transition ${
                isFormValid && !submitting
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-slate-300 cursor-not-allowed'
              }`}
            >
              {submitting ? 'Salvando...' : mode === 'reschedule' ? 'Confirmar Remarcação' : 'Salvar Sessão'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (typeof document !== 'undefined' && document.body) {
    return createPortal(modalContent, document.body);
  }

  return modalContent;
}
