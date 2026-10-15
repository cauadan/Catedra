import React, { useState, useMemo } from 'react';
import { Play, Sparkles, Clock, Layers, BookOpen, Sliders } from 'lucide-react';
import {
  calculateBlockPreset,
  validatePlannedBlocks,
  BLOCK_KIND_LABELS,
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

  const [totalMinutes, setTotalMinutes] = useState<number>(60);
  const [preset, setPreset] = useState<BlockPreset>('BALANCED');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Ao trocar de matéria, atualiza o assunto padrão
  const handleSubjectChange = (subjectId: string) => {
    setSelectedSubjectId(subjectId);
    const related = activeTopics.filter((t) => t.subject_id === subjectId);
    setSelectedTopicId(related[0]?.id || '');
  };

  // Cálculo automático das etapas baseado no preset
  const calculatedBlocks = useMemo(() => {
    try {
      const blocks = calculateBlockPreset(totalMinutes, preset);
      return blocks;
    } catch {
      return [];
    }
  }, [totalMinutes, preset]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTopicId) {
      setErrorMsg('Selecione um assunto válido.');
      return;
    }

    if (totalMinutes < 5 || totalMinutes > 480) {
      setErrorMsg('A duração total deve estar entre 5 e 480 minutos.');
      return;
    }

    const validation = validatePlannedBlocks(totalMinutes, calculatedBlocks);
    if (!validation.ok) {
      setErrorMsg(validation.message);
      return;
    }

    setErrorMsg('');
    onSubmit({
      topic_id: selectedTopicId,
      blocks: calculatedBlocks.map((b) => ({
        kind: b.kind as BlockKindDTO,
        planned_minutes: b.planned_minutes,
      })),
    });
  };

  const quickDurations = [30, 45, 60, 90, 120];

  return (
    <div className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
      <div className="mb-6 flex items-center gap-3 pb-4 border-b border-slate-100">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
          <Clock className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Iniciar Estudo Avulso</h2>
          <p className="text-xs text-slate-500">
            Configure seu estudo imediato escolhendo a matéria e o roteiro por etapas.
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
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50"
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

        {/* Duração Total com Atalhos Rápidos */}
        <div>
          <label
            htmlFor="adhoc-duration"
            className="block text-xs font-semibold text-slate-700 mb-1.5"
          >
            Duração Total (Minutos)
          </label>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <input
              id="adhoc-duration"
              type="number"
              min="5"
              max="480"
              value={totalMinutes}
              onChange={(e) => setTotalMinutes(Math.max(5, parseInt(e.target.value, 10) || 5))}
              disabled={isPending}
              className="w-full sm:w-32 rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <div className="flex items-center gap-1.5 flex-wrap">
              {quickDurations.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setTotalMinutes(m)}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                    totalMinutes === m
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {m} min
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Seleção de Preset de Divisão */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Modelo de Divisão por Etapas (Preset)
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {[
              {
                id: 'BALANCED' as const,
                title: 'Equilibrado',
                desc: 'Revisão + Conteúdo + Prática',
              },
              {
                id: 'PRACTICE_FOCUS' as const,
                title: 'Foco em Prática',
                desc: 'Revisão + Prática Intensiva',
              },
              {
                id: 'NEW_ONLY' as const,
                title: 'Conteúdo Novo',
                desc: '100% Teoria e Conteúdo Novo',
              },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPreset(p.id)}
                className={`rounded-2xl border p-3.5 text-left transition ${
                  preset === p.id
                    ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-500'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <p className="text-sm font-bold text-slate-900">{p.title}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{p.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Pré-visualização do Roteiro Gerado */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
            Roteiro Gerado Automaticamente
          </p>
          <div className="flex flex-wrap gap-2">
            {calculatedBlocks.map((b, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-2xs"
              >
                <span className="h-2 w-2 rounded-full bg-blue-600" />
                <span>{BLOCK_KIND_LABELS[b.kind as BlockKindDTO]}</span>
                <span className="font-mono text-slate-500">({b.planned_minutes} min)</span>
              </span>
            ))}
          </div>
        </div>

        {/* Botão de Envio */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isPending || !selectedTopicId}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3.5 text-sm font-bold text-white shadow-md hover:bg-emerald-700 transition disabled:opacity-50"
          >
            <Play className="h-4 w-4 fill-current" />
            <span>{isPending ? 'Iniciando...' : 'Iniciar Sessão de Estudo'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
