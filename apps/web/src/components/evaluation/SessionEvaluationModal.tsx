import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  Plus,
  Trash2,
  Sparkles,
  BarChart2,
  Calendar,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import {
  calculateAccuracy,
  calculateAggregateAccuracy,
  calculateSessionMetrics,
  type UnderstandingLevelDTO,
  type FocusLevelDTO,
  type DifficultyLevelDTO,
  type SessionBlockDTO,
} from '@estudos/domain';
import { formatDuration, formatPercent } from '../../lib/format';
import {
  toDomainEvents,
  type StudySessionView,
  type SubmitEvaluationPayload,
} from '../../lib/study-session-api';

export interface SessionEvaluationModalProps {
  isOpen: boolean;
  session: StudySessionView;
  topics: any[];
  isPending: boolean;
  onSubmit: (payload: SubmitEvaluationPayload) => Promise<void>;
  onFinishedSuccess: () => void;
}

export function SessionEvaluationModal({
  isOpen,
  session,
  topics,
  isPending,
  onSubmit,
  onFinishedSuccess,
}: SessionEvaluationModalProps) {
  const activeTopics = useMemo(() => topics.filter((t) => !t.archived), [topics]);

  const defaultTopicId = session.topic_id || activeTopics[0]?.id || '';

  const [understanding, setUnderstanding] = useState<UnderstandingLevelDTO>('GOOD');
  const [focus, setFocus] = useState<FocusLevelDTO>('HIGH');
  const [difficulty, setDifficulty] = useState<DifficultyLevelDTO>('NORMAL');
  const [notes, setNotes] = useState<string>('');

  const [practiceRows, setPracticeRows] = useState<
    Array<{ topic_id: string; questions: number; correct: number }>
  >([{ topic_id: defaultTopicId, questions: 0, correct: 0 }]);

  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  if (!isOpen) return null;

  const handleAddPracticeRow = () => {
    setPracticeRows((prev) => [
      ...prev,
      { topic_id: activeTopics[0]?.id || defaultTopicId, questions: 0, correct: 0 },
    ]);
  };

  const handleRemovePracticeRow = (index: number) => {
    setPracticeRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRowChange = (
    index: number,
    field: 'topic_id' | 'questions' | 'correct',
    value: string | number
  ) => {
    setPracticeRows((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // Cálculo consolidado de aproveitamento geral
  const aggregateAccuracy = useMemo(() => {
    return calculateAggregateAccuracy(practiceRows);
  }, [practiceRows]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    // Validação de acertos <= questões
    for (let i = 0; i < practiceRows.length; i++) {
      const row = practiceRows[i];
      if (row.questions > 0 && row.correct > row.questions) {
        setErrorMsg('O número de acertos não pode ser maior do que o total de questões resolvidas.');
        return;
      }
    }

    // Filtrar questões zeradas
    const validPractice = practiceRows
      .filter((r) => r.questions > 0)
      .map((r) => ({
        topic_id: r.topic_id,
        questions: r.questions,
        correct: r.correct,
      }));

    try {
      await onSubmit({
        understanding,
        focus,
        difficulty,
        notes: notes.trim() || undefined,
        practice_records: validPractice,
      });
      setIsSubmitted(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao salvar a avaliação.');
    }
  };

  // Métricas finais para tela de resumo
  const finalMetrics = useMemo(() => {
    const blocks: SessionBlockDTO[] = session.session_blocks.map((b) => ({
      id: b.id,
      kind: b.kind,
      planned_minutes: b.planned_minutes,
      position: b.position,
    }));
    const events = toDomainEvents(session.session_events);
    return calculateSessionMetrics(
      {
        status: 'FINISHED',
        started_at: new Date(session.started_at),
        ended_at: session.finished_at ? new Date(session.finished_at) : new Date(),
        planned_start: session.planned_session?.scheduled_start
          ? new Date(session.planned_session.scheduled_start)
          : null,
      },
      blocks,
      events,
      new Date()
    );
  }, [session]);

  return (
    <div className="fixed inset-0 z-50 !m-0 !mt-0 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-slate-900/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl my-auto bg-white p-6 md:p-8 border border-slate-200">
        {!isSubmitted ? (
          <div>
            {/* Cabeçalho do Modal */}
            <div className="mb-6 flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                  Sessão Concluída
                </span>
                <h3 className="text-xl md:text-2xl font-black text-slate-900 mt-2">
                  Avaliação Pós-Sessão
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Assunto: <span className="font-semibold text-slate-700">{session.topic?.name || 'Geral'}</span>
                </p>
              </div>
            </div>

            {errorMsg && (
              <div className="mb-6 flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* 1. Nível de Entendimento */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Nível de Compreensão (Autoavaliação)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { value: 'NONE' as const, label: 'Não entendi', sub: 'Preciso recomeçar' },
                    { value: 'PARTIAL' as const, label: 'Parcial', sub: 'Conceitos gerais' },
                    { value: 'GOOD' as const, label: 'Entendi bem', sub: 'Bom domínio' },
                    { value: 'MASTERED' as const, label: 'Dominei', sub: 'Pronto p/ provas' },
                  ].map((chip) => (
                    <button
                      key={chip.value}
                      type="button"
                      onClick={() => setUnderstanding(chip.value)}
                      className={`rounded-2xl border p-3 text-left transition ${
                        understanding === chip.value
                          ? 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-500 font-bold'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="text-xs font-semibold text-slate-900">{chip.label}</div>
                      <div className="text-[10px] text-slate-500">{chip.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Foco e Dificuldade */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Foco e Concentração
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { value: 'LOW' as const, label: 'Baixo' },
                      { value: 'MEDIUM' as const, label: 'Médio' },
                      { value: 'HIGH' as const, label: 'Alto' },
                    ].map((chip) => (
                      <button
                        key={chip.value}
                        type="button"
                        onClick={() => setFocus(chip.value)}
                        className={`rounded-xl border py-2 text-center text-xs font-semibold transition ${
                          focus === chip.value
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-500'
                            : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Nível de Dificuldade
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { value: 'EASY' as const, label: 'Fácil' },
                      { value: 'NORMAL' as const, label: 'Normal' },
                      { value: 'HARD' as const, label: 'Difícil' },
                    ].map((chip) => (
                      <button
                        key={chip.value}
                        type="button"
                        onClick={() => setDifficulty(chip.value)}
                        className={`rounded-xl border py-2 text-center text-xs font-semibold transition ${
                          difficulty === chip.value
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500'
                            : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 3. Registros de Prática (Questões) */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                    Registro de Exercícios e Prática
                  </label>
                  <span className="text-[11px] text-slate-400">
                    Linhas com 0 questões serão descartadas automaticamente.
                  </span>
                </div>

                <div className="space-y-3">
                  {practiceRows.map((row, idx) => {
                    const rowAcc = calculateAccuracy(row.correct, row.questions);
                    return (
                      <div
                        key={idx}
                        className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/50 p-3"
                      >
                        {/* Seletor de Assunto */}
                        <div className="flex-1 min-w-[160px]">
                          <select
                            value={row.topic_id}
                            onChange={(e) => handleRowChange(idx, 'topic_id', e.target.value)}
                            disabled={isPending}
                            className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-emerald-600 focus:outline-none"
                          >
                            {activeTopics.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Total de Questões */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-slate-500">Qtd:</span>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={row.questions === 0 ? '' : row.questions}
                            placeholder="0"
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => {
                              const clean = e.target.value.replace(/^0+(?=\d)/, '');
                              const num = clean === '' ? 0 : parseInt(clean, 10);
                              handleRowChange(idx, 'questions', isNaN(num) ? 0 : Math.max(0, num));
                            }}
                            disabled={isPending}
                            className="w-16 rounded-xl border border-slate-300 bg-white px-2 py-1 text-center text-xs text-slate-800"
                          />
                        </div>

                        {/* Acertos */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-slate-500">Acertos:</span>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={row.correct === 0 ? '' : row.correct}
                            placeholder="0"
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => {
                              const clean = e.target.value.replace(/^0+(?=\d)/, '');
                              const num = clean === '' ? 0 : parseInt(clean, 10);
                              handleRowChange(idx, 'correct', isNaN(num) ? 0 : Math.max(0, num));
                            }}
                            disabled={isPending}
                            className="w-16 rounded-xl border border-slate-300 bg-white px-2 py-1 text-center text-xs text-slate-800"
                          />
                        </div>

                        {/* Aproveitamento da Linha */}
                        <div className="w-20 text-right text-xs font-mono font-bold text-slate-700">
                          {formatPercent(rowAcc)}
                        </div>

                        {/* Remover Linha */}
                        {practiceRows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemovePracticeRow(idx)}
                            disabled={isPending}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                            title="Remover linha"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Rodapé da Prática */}
                <div className="mt-3 flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={handleAddPracticeRow}
                    disabled={isPending}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Adicionar outro assunto</span>
                  </button>

                  <div className="text-xs font-semibold text-slate-600">
                    Aproveitamento Geral:{' '}
                    <span className="font-mono font-bold text-emerald-700 text-sm">
                      {formatPercent(aggregateAccuracy.accuracy)}
                    </span>
                  </div>
                </div>
              </div>

              {/* 4. Observações Opcionais */}
              <div>
                <label
                  htmlFor="eval-notes"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
                >
                  Observações e Anotações (Opcional - máx. 1000 caracteres)
                </label>
                <textarea
                  id="eval-notes"
                  rows={3}
                  maxLength={1000}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={isPending}
                  placeholder="Registre o que aprendeu, dúvidas pendentes ou pontos para a próxima revisão..."
                  className="w-full rounded-2xl border border-slate-300 p-3 text-xs text-slate-800 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                />
              </div>

              {/* Ação de Submissão */}
              <div className="pt-2 border-t border-slate-100 flex justify-end">
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-md hover:bg-emerald-700 transition disabled:opacity-50"
                >
                  {isPending ? 'Salvando Avaliação...' : 'Salvar Avaliação e Concluir'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* ================= TELA DE RESUMO PÓS-AVALIAÇÃO ================= */
          <div className="text-center py-4 space-y-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-600 shadow-sm">
              <CheckCircle2 className="h-8 w-8" />
            </div>

            <div>
              <h3 className="text-2xl font-black text-slate-900">
                Sessão Concluída e Avaliada!
              </h3>
              <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                Seus registros de foco, tempo e aproveitamento foram consolidados no banco de dados.
              </p>
            </div>

            {/* Painel de Métricas da Sessão */}
            {finalMetrics && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-6 text-left">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                    Tempo Efetivo
                  </span>
                  <span className="text-lg font-mono font-black text-slate-900">
                    {formatDuration(finalMetrics.effectiveSeconds)}
                  </span>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                    Foco / Efetividade
                  </span>
                  <span className="text-lg font-black text-emerald-600">
                    {formatPercent(finalMetrics.effectiveness)}
                  </span>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                    Aderência
                  </span>
                  <span className="text-lg font-black text-blue-600">
                    {formatPercent(finalMetrics.adherence)}
                  </span>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                    Exercícios
                  </span>
                  <span className="text-lg font-black text-purple-600">
                    {formatPercent(aggregateAccuracy.accuracy)}
                  </span>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={onFinishedSuccess}
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-8 py-3.5 text-sm font-bold text-white shadow-md hover:bg-emerald-700 transition"
            >
              <Calendar className="h-4 w-4" />
              <span>Ir para a Agenda</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
