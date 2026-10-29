import React, { useState, useMemo } from 'react';
import { Play, Clock, Plus, Trash2, Sliders } from 'lucide-react';
import {
  calculateBlockPreset,
  validatePlannedBlocks,
  BLOCK_KIND_LABELS,
  BLOCK_KINDS,
  type BlockPreset,
  type BlockKindDTO,
} from '@estudos/domain';
import type { StartStudySessionPayload } from '../../lib/study-session-api';

export interface AdHocSessionFormProps {
  subjects: any[];
  topics: any[];
  isPending: boolean;
  onSubmit: (payload: StartStudySessionPayload) => void;
}

interface EditableStage {
  id: string;
  kind: BlockKindDTO;
  planned_minutes: number;
}

export function AdHocSessionForm({
  subjects,
  topics,
  isPending,
  onSubmit,
}: AdHocSessionFormProps) {
  // Matérias e assuntos ativos (não arquivados)
  const activeSubjects = useMemo(() => subjects.filter((s) => !s.archived), [subjects]);
  const activeTopics = useMemo(() => topics.filter((t) => !t.archived), [topics]);

  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(
    activeSubjects[0]?.id || ''
  );

  const availableTopics = useMemo(() => {
    return activeTopics.filter((t) => t.subject_id === selectedSubjectId);
  }, [activeTopics, selectedSubjectId]);

  const [selectedTopicId, setSelectedTopicId] = useState<string>(
    availableTopics[0]?.id || ''
  );

  const [stages, setStages] = useState<EditableStage[]>([
    { id: '1', kind: 'REVIEW', planned_minutes: 10 },
    { id: '2', kind: 'NEW_CONTENT', planned_minutes: 35 },
    { id: '3', kind: 'PRACTICE', planned_minutes: 15 },
  ]);
  const [activePreset, setActivePreset] = useState<BlockPreset | null>('BALANCED');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Ao trocar de matéria, atualiza o assunto padrão
  const handleSubjectChange = (subjectId: string) => {
    setSelectedSubjectId(subjectId);
    const related = activeTopics.filter((t) => t.subject_id === subjectId);
    setSelectedTopicId(related[0]?.id || '');
  };

  // Soma automática dos minutos de todas as etapas
  const totalMinutes = useMemo(() => {
    return stages.reduce((acc, s) => acc + (Number(s.planned_minutes) || 0), 0);
  }, [stages]);

  // Aplicar preset ou duração rápida
  const applyPreset = (duration: number, preset: BlockPreset) => {
    try {
      const generated = calculateBlockPreset(duration, preset);
      setStages(
        generated.map((b, idx) => ({
          id: String(idx + 1),
          kind: b.kind as BlockKindDTO,
          planned_minutes: b.planned_minutes,
        }))
      );
      setActivePreset(preset);
      setErrorMsg('');
    } catch {
      // Falha silenciosa
    }
  };

  // Alterar minutos de uma etapa
  const handleMinutesChange = (id: string, rawVal: string) => {
    setActivePreset(null);
    const cleaned = rawVal.replace(/^0+(?=\d)/, '');
    const num = cleaned === '' ? 0 : parseInt(cleaned, 10);
    setStages((prev) =>
      prev.map((s) => (s.id === id ? { ...s, planned_minutes: isNaN(num) ? 0 : num } : s))
    );
  };

  // Alterar tipo da etapa
  const handleKindChange = (id: string, kind: BlockKindDTO) => {
    setActivePreset(null);
    setStages((prev) => prev.map((s) => (s.id === id ? { ...s, kind } : s)));
  };

  // Remover etapa
  const handleRemoveStage = (id: string) => {
    setActivePreset(null);
    setStages((prev) => prev.filter((s) => s.id !== id));
  };

  // Adicionar nova etapa
  const handleAddStage = () => {
    setActivePreset(null);
    setStages((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        kind: 'PRACTICE',
        planned_minutes: 15,
      },
    ]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTopicId) {
      setErrorMsg('Selecione um assunto válido.');
      return;
    }

    const validStages = stages.filter((s) => s.planned_minutes > 0);
    if (validStages.length === 0) {
      setErrorMsg('Informe ao menos uma etapa com duração maior que 0 minutos.');
      return;
    }

    if (totalMinutes < 1 || totalMinutes > 480) {
      setErrorMsg('A duração total deve estar entre 1 e 480 minutos.');
      return;
    }

    const validation = validatePlannedBlocks(
      totalMinutes,
      validStages.map((s, idx) => ({
        kind: s.kind,
        planned_minutes: s.planned_minutes,
        position: idx + 1,
      })),
      1
    );

    if (!validation.ok) {
      setErrorMsg(validation.message);
      return;
    }

    setErrorMsg('');
    onSubmit({
      topic_id: selectedTopicId,
      blocks: validStages.map((b) => ({
        kind: b.kind,
        planned_minutes: b.planned_minutes,
      })),
    });
  };

  const quickDurations = [30, 45, 60, 90, 120];

  return (
    <div className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
      <div className="mb-6 flex items-center gap-3 pb-4 border-b border-slate-100">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700">
          <Clock className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Iniciar Estudo Avulso</h2>
          <p className="text-xs text-slate-500">
            Configure seu estudo imediato escolhendo a matéria e editando livremente o tempo de cada etapa.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-6 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Seleção de Matéria e Assunto */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="adhoc-subject"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Matéria
            </label>
            <select
              id="adhoc-subject"
              value={selectedSubjectId}
              onChange={(e) => handleSubjectChange(e.target.value)}
              disabled={isPending}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            >
              {activeSubjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="adhoc-topic"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Assunto
            </label>
            <select
              id="adhoc-topic"
              value={selectedTopicId}
              onChange={(e) => setSelectedTopicId(e.target.value)}
              disabled={isPending || availableTopics.length === 0}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600 disabled:bg-slate-50"
            >
              {availableTopics.length === 0 ? (
                <option value="">Nenhum assunto disponível</option>
              ) : (
                availableTopics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        {/* Atalhos de Duração Rápida e Presets */}
        <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Atalhos de Divisão Rápida
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {quickDurations.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => applyPreset(m, activePreset || 'BALANCED')}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                    totalMinutes === m
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {m} min
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {[
              {
                id: 'BALANCED' as const,
                title: 'Equilibrado',
                desc: 'Revisão + Teoria Nova + Prática',
              },
              {
                id: 'PRACTICE_FOCUS' as const,
                title: 'Foco em Prática',
                desc: 'Revisão + Prática Intensiva',
              },
              {
                id: 'NEW_ONLY' as const,
                title: 'Teoria Nova',
                desc: '100% Teoria e Conteúdo',
              },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(totalMinutes >= 5 ? totalMinutes : 60, p.id)}
                className={`rounded-xl border p-2.5 text-left transition ${
                  activePreset === p.id
                    ? 'border-emerald-600 bg-emerald-50 ring-1 ring-emerald-500'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <p className="text-xs font-bold text-slate-900">{p.title}</p>
                <p className="text-[11px] text-slate-500">{p.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Edição Livre das Etapas */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-semibold text-slate-700">
              Etapas do Estudo (Minutos por Etapa)
            </label>
            <span className="text-xs font-bold text-emerald-700">
              Duração Total Calculada: {totalMinutes} min
            </span>
          </div>

          <div className="space-y-2.5">
            {stages.map((stage, idx) => (
              <div
                key={stage.id}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/50 p-2.5"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700 shrink-0">
                  {idx + 1}
                </span>

                <select
                  value={stage.kind}
                  onChange={(e) => handleKindChange(stage.id, e.target.value as BlockKindDTO)}
                  disabled={isPending}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-900 focus:border-blue-500 focus:outline-none"
                >
                  {BLOCK_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {BLOCK_KIND_LABELS[k]}
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-1.5 ml-auto">
                  <input
                    type="number"
                    min="0"
                    max="480"
                    placeholder="0"
                    value={stage.planned_minutes === 0 ? '' : stage.planned_minutes}
                    onChange={(e) => handleMinutesChange(stage.id, e.target.value)}
                    onFocus={(e) => e.target.select()}
                    disabled={isPending}
                    className="w-16 rounded-lg border border-slate-300 bg-white px-2 py-1 text-center text-xs font-bold text-slate-900 focus:border-blue-500 focus:outline-none"
                  />
                  <span className="text-xs text-slate-500 font-medium">min</span>
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveStage(stage.id)}
                  disabled={isPending || stages.length <= 1}
                  className="rounded p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 transition"
                  title="Remover etapa"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={handleAddStage}
              disabled={isPending}
              className="inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 transition"
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar Etapa
            </button>
          </div>
        </div>

        {/* Botão de Envio */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isPending || !selectedTopicId || totalMinutes < 1}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3.5 text-sm font-bold text-white shadow-md hover:bg-emerald-700 transition disabled:opacity-50"
          >
            <Play className="h-4 w-4 fill-current" />
            <span>{isPending ? 'Iniciando...' : `Iniciar Estudo (${totalMinutes} min)`}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
