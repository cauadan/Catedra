import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Compass,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Play,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Clock,
  Target,
  BarChart2,
  ShieldAlert,
  Sparkles,
  BookOpen,
  Info,
  X,
} from 'lucide-react';
import {
  MIN_QUESTIONS,
  WEAK_THRESHOLD,
  STRONG_THRESHOLD,
  NEGLECT_DAYS,
  LOW_UNDERSTANDING_THRESHOLD,
  addDaysToLocalDate,
  utcToLocalDate,
} from '@estudos/domain';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from '../contexts/RouterContext';
import { apiFetch } from '../lib/api';

function getTodayIso(timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function formatDateBr(isoDate: string | null | undefined): string {
  if (!isoDate) return '—';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function formatDayMonth(isoDate: string | null | undefined): string {
  if (!isoDate) return '—';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}`;
}

function formatPercent(val: number | null | undefined): string {
  if (val === null || val === undefined || Number.isNaN(val)) return '—';
  return `${Number(val).toFixed(1).replace(/\.0$/, '')}%`;
}

function formatMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || Number.isNaN(minutes)) return '0 min';
  return `${Math.round(minutes)} min`;
}

function formatDelta(val: number | null | undefined, suffix = ''): string {
  if (val === null || val === undefined || Number.isNaN(val)) return '—';
  const rounded = Number(val).toFixed(1).replace(/\.0$/, '');
  const sign = Number(val) > 0 ? '+' : '';
  return `${sign}${rounded}${suffix}`;
}

export function Observatory() {
  const { user } = useAuth();
  const { navigate } = useRouter();
  const timezone = user?.timezone || 'America/Sao_Paulo';
  const todayIso = useMemo(() => getTodayIso(timezone), [timezone]);

  const [referenceDate, setReferenceDate] = useState<string>(todayIso);

  const {
    data: obsRes,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<{ data: any }>({
    queryKey: ['observatory', referenceDate],
    queryFn: () => apiFetch(`/api/observatory?date=${referenceDate}`),
  });

  const obs = obsRes?.data ?? obsRes ?? null;

  const isCurrentWeek = Boolean(obs?.isCurrentWeek) || referenceDate >= todayIso;
  const isPartialWeek = Boolean(obs?.isPartialWeek);
  const elapsedDaysCount = obs?.elapsedDaysCount ?? 7;

  const handleNavigateWeek = (step: -1 | 1 | 0) => {
    if (step === 0) {
      setReferenceDate(todayIso);
    } else {
      setReferenceDate((prev) => addDaysToLocalDate(prev, step * 7));
    }
  };

  const selectedWeek = obs?.selectedWeek ?? obs?.weekComparison?.selectedWeek ?? null;
  const previousWeek = obs?.previousWeek ?? obs?.weekComparison?.previousWeek ?? null;
  const comparison = obs?.comparison ?? obs?.weekComparison ?? null;
  const pauseAndDistraction = obs?.pauseAndDistractionAnalysis ?? null;
  const topicClassification = obs?.topicClassification ?? {
    weak: [],
    regular: [],
    strong: [],
    insufficient: [],
  };
  const neglectedSubjects: any[] = obs?.neglectedSubjects ?? [];
  const rawInsights: any[] = obs?.insightsAndRecommendations ?? [];

  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem('estudos:observatory:dismissed');
        return stored ? JSON.parse(stored) : [];
      }
    } catch {
      // ignore storage errors
    }
    return [];
  });

  const handleDismissItem = (id: string) => {
    setDismissedIds((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem('estudos:observatory:dismissed', JSON.stringify(next));
        }
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  const insights = useMemo(
    () => rawInsights.filter((ins: any) => !dismissedIds.includes(ins.id)),
    [rawInsights, dismissedIds]
  );

  const hasAnyData = Boolean(
    obs?.hasAnyData ||
      (selectedWeek &&
        (selectedWeek.effectiveSeconds > 0 ||
          selectedWeek.effectiveMinutes > 0 ||
          selectedWeek.agendaPlannedMinutes > 0 ||
          selectedWeek.totalQuestions > 0)) ||
      (previousWeek &&
        (previousWeek.effectiveSeconds > 0 ||
          previousWeek.effectiveMinutes > 0 ||
          previousWeek.totalQuestions > 0)) ||
      (topicClassification.weak && topicClassification.weak.length > 0) ||
      (topicClassification.regular && topicClassification.regular.length > 0) ||
      (topicClassification.strong && topicClassification.strong.length > 0) ||
      (topicClassification.insufficient && topicClassification.insufficient.length > 0) ||
      (obs?.subjectClassification && obs.subjectClassification.length > 0)
  );

  // Revisões e práticas recomendadas: tópicos fracos (revisão + prática) e regulares (mais prática)
  const recommendationsList = useMemo(() => {
    const list = [
      ...(topicClassification.weak || []).map((t: any) => ({ ...t, kind: 'WEAK' })),
      ...(topicClassification.regular || []).map((t: any) => ({ ...t, kind: 'REGULAR' })),
    ].filter((t: any) => !dismissedIds.includes(`rec:${t.topicId}`));
    return list.sort((a, b) => {
      const sa = a.classification?.finalScore ?? 0;
      const sb = b.classification?.finalScore ?? 0;
      return sa - sb;
    });
  }, [topicClassification, dismissedIds]);

  const windowEndDayMonth = formatDayMonth(
    obs?.classificationWindow?.windowEndLocalDate || referenceDate
  );

  return (
    <div className="space-y-6">
      {/* Cabeçalho Superior e Seletor de Semana */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700">
              <Compass className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Observatório Semanal</h1>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Diagnóstico abrangente, foco e recomendações consolidadas baseadas no seu histórico.
          </p>
        </div>

        {/* Seletor de Semana */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleNavigateWeek(-1)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Semana Anterior</span>
          </button>
          <button
            type="button"
            onClick={() => handleNavigateWeek(0)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Semana Atual
          </button>
          <button
            type="button"
            onClick={() => handleNavigateWeek(1)}
            disabled={isCurrentWeek}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span>Avançar Semana</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Banner de Semana Parcial */}
      {isPartialWeek && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
          <Info className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>
            {`Comparando os ${elapsedDaysCount} primeiros dias desta semana com os mesmos ${elapsedDaysCount} dias da semana anterior`}
          </span>
        </div>
      )}

      {isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          Carregando dados do observatório...
        </div>
      ) : (isError || Boolean(error)) && !obs ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-8 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-rose-600" />
          <h3 className="mt-3 text-base font-bold text-slate-900">
            Não foi possível carregar o observatório
          </h3>
          <p className="mt-1 text-xs text-slate-600">
            {(error as any)?.message ||
              'Ocorreu um erro ao buscar os dados do observatório semanal.'}
          </p>
          <button
            type="button"
            onClick={() => refetch?.()}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
          >
            Tentar Novamente
          </button>
        </div>
      ) : !hasAnyData ? (
        /* Estado Vazio Amigável */
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <Compass className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-bold text-slate-900">
            Nenhuma atividade registrada para esta semana
          </h3>
          <p className="mx-auto mt-1 max-w-md text-xs text-slate-500 leading-relaxed">
            Você ainda não possui sessões de estudo concluídas ou planejamentos registrados neste período. Comece planejando suas atividades na agenda ou iniciando uma sessão agora!
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/agenda')}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700"
            >
              <Calendar className="h-4 w-4" />
              <span>Planejar na Agenda</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/timer')}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <Play className="h-4 w-4 text-emerald-600" />
              <span>Iniciar Estudo Agora</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Seção 1: Comparativo Semana Selecionada vs. Semana Anterior */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Comparativo Semana Selecionada vs. Semana Anterior
                </h2>
                <p className="text-xs text-slate-500">
                  Evolução do tempo efetivo, foco e aderência em relação aos mesmos dias da semana anterior.
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {/* Card 1: Tempo Efetivo */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                <p className="text-[11px] font-semibold text-slate-500">Tempo Efetivo Estudado</p>
                <p className="mt-1 text-xl font-bold text-emerald-700">
                  {formatMinutes(selectedWeek?.effectiveMinutes)}
                </p>
                <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Anterior: {formatMinutes(previousWeek?.effectiveMinutes)}</span>
                  <span className="font-semibold text-slate-700">
                    {formatDelta(
                      comparison?.effectiveMinutesDelta ?? comparison?.deltaEffectiveMinutes,
                      ' min'
                    )}
                  </span>
                </div>
              </div>

              {/* Card 2: Foco / Efetividade */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                <p className="text-[11px] font-semibold text-slate-500">Efetividade / Foco</p>
                <p className="mt-1 text-xl font-bold text-slate-900">
                  {formatPercent(selectedWeek?.effectiveness)}
                </p>
                <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Anterior: {formatPercent(previousWeek?.effectiveness)}</span>
                  <span className="font-semibold text-slate-700">
                    {formatDelta(
                      comparison?.effectivenessDelta ?? comparison?.deltaEffectivenessPoints,
                      '%'
                    )}
                  </span>
                </div>
              </div>

              {/* Card 3: Aderência */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                <p className="text-[11px] font-semibold text-slate-500">Aderência às Sessões</p>
                <p className="mt-1 text-xl font-bold text-slate-900">
                  {formatPercent(selectedWeek?.adherence)}
                </p>
                <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Anterior: {formatPercent(previousWeek?.adherence)}</span>
                  <span className="font-semibold text-slate-700">
                    {formatDelta(
                      comparison?.adherenceDelta ?? comparison?.deltaAdherencePoints,
                      '%'
                    )}
                  </span>
                </div>
              </div>

              {/* Card 4: Questões e Taxa de Acerto */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                <p className="text-[11px] font-semibold text-slate-500">Questões e Acerto</p>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-xl font-bold text-slate-900">
                    {selectedWeek?.totalQuestions ?? 0}
                  </span>
                  <span className="text-xs font-semibold text-emerald-700">
                    ({formatPercent(selectedWeek?.accuracy)})
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Anterior: {formatPercent(previousWeek?.accuracy)}</span>
                  <span className="font-semibold text-slate-700">
                    {formatDelta(
                      comparison?.accuracyDelta ?? comparison?.deltaAccuracyPoints,
                      '%'
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Seção 2: Análise de Foco, Pausas e Distrações */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-bold text-slate-900">
              Análise de Foco, Pausas e Distrações
            </h2>
            <p className="text-xs text-slate-500">
              Detalhamento de interrupções, pausas e distrações ocorridas durante o cronômetro.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                <p className="text-[11px] font-semibold text-slate-500">Tempo Líquido Efetivo</p>
                <p className="mt-1 text-lg font-bold text-emerald-700">
                  {formatMinutes(
                    pauseAndDistraction?.effectiveMinutes ??
                      (pauseAndDistraction?.effectiveSeconds
                        ? pauseAndDistraction.effectiveSeconds / 60
                        : 0)
                  )}
                </p>
                <p className="mt-0.5 text-[10px] text-slate-400">
                  Foco: {formatPercent(pauseAndDistraction?.effectiveness)}
                </p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                <p className="text-[11px] font-semibold text-slate-500">Tempo em Pausa</p>
                <p className="mt-1 text-lg font-bold text-slate-900">
                  {formatMinutes(
                    pauseAndDistraction?.pausedMinutes ??
                      (pauseAndDistraction?.pausedSeconds
                        ? pauseAndDistraction.pausedSeconds / 60
                        : 0)
                  )}
                </p>
                <p className="mt-0.5 text-[10px] text-slate-400">
                  {pauseAndDistraction?.pausedSharePercent !== null &&
                  pauseAndDistraction?.pausedSharePercent !== undefined
                    ? `${formatPercent(pauseAndDistraction.pausedSharePercent)} do tempo bruto`
                    : 'Pausas voluntárias'}
                </p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                <p className="text-[11px] font-semibold text-slate-500">Tempo em Distração</p>
                <p className="mt-1 text-lg font-bold text-amber-700">
                  {formatMinutes(
                    pauseAndDistraction?.totalDistractedMinutes ??
                      (pauseAndDistraction?.totalDistractedSeconds
                        ? pauseAndDistraction.totalDistractedSeconds / 60
                        : 0)
                  )}
                </p>
                <p className="mt-0.5 text-[10px] text-slate-400">
                  {pauseAndDistraction?.distractedSharePercent !== null &&
                  pauseAndDistraction?.distractedSharePercent !== undefined
                    ? `${formatPercent(pauseAndDistraction.distractedSharePercent)} do tempo bruto`
                    : 'Tempo real + pós-sessão'}
                </p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                <p className="text-[11px] font-semibold text-slate-500">Tempo Bruto Total</p>
                <p className="mt-1 text-lg font-bold text-slate-900">
                  {formatMinutes(
                    pauseAndDistraction?.totalSessionSeconds
                      ? pauseAndDistraction.totalSessionSeconds / 60
                      : 0
                  )}
                </p>
                <p className="mt-0.5 text-[10px] text-slate-400">Duração total das sessões</p>
              </div>
            </div>

            {/* Destaque de matéria ou dia com maior distração se houver */}
            {(pauseAndDistraction?.highestDistractionSubject ||
              pauseAndDistraction?.highestDistractionDay) && (
              <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg bg-amber-50/60 p-2.5 text-xs text-amber-900 border border-amber-200/60">
                {pauseAndDistraction.highestDistractionSubject && (
                  <span>
                    Maior índice de distração na matéria:{' '}
                    <strong>{pauseAndDistraction.highestDistractionSubject.subjectName}</strong> (
                    {formatPercent(
                      pauseAndDistraction.highestDistractionSubject.distractionRatePercent
                    )}
                    )
                  </span>
                )}
                {pauseAndDistraction.highestDistractionDay && (
                  <span>
                    • Dia com maior distração:{' '}
                    <strong>{formatDateBr(pauseAndDistraction.highestDistractionDay.date)}</strong>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Seção 3: Classificação de Assuntos (30 dias até DD/MM) */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  {`Classificação de Assuntos (30 dias até ${windowEndDayMonth})`}
                </h2>
                <p className="text-xs text-slate-500">
                  Agrupamento dos assuntos ativos por desempenho consolidado (70% acurácia + 30% entendimento).
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {/* Pontos Fracos */}
              <div className="rounded-xl border border-rose-200 bg-rose-50/30 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-rose-900">
                    Pontos Fracos ({topicClassification.weak?.length || 0})
                  </h3>
                  <span className="text-[10px] text-rose-700">&lt; {WEAK_THRESHOLD}</span>
                </div>
                {(!topicClassification.weak || topicClassification.weak.length === 0) ? (
                  <p className="mt-2 text-xs text-slate-500">Nenhum ponto fraco identificado.</p>
                ) : (
                  <div className="mt-2.5 space-y-2">
                    {topicClassification.weak.map((item: any) => (
                      <div
                        key={item.topicId}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white p-2.5 border border-rose-100 shadow-sm"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: item.subjectColor || '#EF4444' }}
                            />
                            <span className="text-xs font-bold text-slate-900">
                              {item.topicName}
                            </span>
                            <span className="text-[10px] text-slate-500">({item.subjectName})</span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px]">
                            <span className="font-semibold text-rose-700">
                              Nota: {item.classification?.displayScore ?? '—'}
                            </span>
                            {item.classification?.lowUnderstandingSignal && (
                              <span className="rounded bg-rose-100 px-1.5 py-0.5 font-semibold text-rose-800">
                                Baixo entendimento
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => navigate('/agenda')}
                          className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-rose-700"
                        >
                          <span>Agendar Revisão</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Regulares */}
              <div className="rounded-xl border border-amber-200 bg-amber-50/30 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-amber-900">
                    Regulares ({topicClassification.regular?.length || 0})
                  </h3>
                  <span className="text-[10px] text-amber-700">
                    {WEAK_THRESHOLD} a &lt; {STRONG_THRESHOLD}
                  </span>
                </div>
                {(!topicClassification.regular || topicClassification.regular.length === 0) ? (
                  <p className="mt-2 text-xs text-slate-500">Nenhum assunto regular.</p>
                ) : (
                  <div className="mt-2.5 space-y-2">
                    {topicClassification.regular.map((item: any) => (
                      <div
                        key={item.topicId}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white p-2.5 border border-amber-100 shadow-sm"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: item.subjectColor || '#F59E0B' }}
                            />
                            <span className="text-xs font-bold text-slate-900">
                              {item.topicName}
                            </span>
                            <span className="text-[10px] text-slate-500">({item.subjectName})</span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px]">
                            <span className="font-semibold text-amber-700">
                              Nota: {item.classification?.displayScore ?? '—'}
                            </span>
                            {item.classification?.lowUnderstandingSignal && (
                              <span className="rounded bg-rose-100 px-1.5 py-0.5 font-semibold text-rose-800">
                                Baixo entendimento
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => navigate('/agenda')}
                          className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-amber-700"
                        >
                          <span>Agendar Prática</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pontos Fortes */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-emerald-900">
                    Pontos Fortes ({topicClassification.strong?.length || 0})
                  </h3>
                  <span className="text-[10px] text-emerald-700">&ge; {STRONG_THRESHOLD}</span>
                </div>
                {(!topicClassification.strong || topicClassification.strong.length === 0) ? (
                  <p className="mt-2 text-xs text-slate-500">Nenhum ponto forte consolidado.</p>
                ) : (
                  <div className="mt-2.5 space-y-2">
                    {topicClassification.strong.map((item: any) => (
                      <div
                        key={item.topicId}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white p-2.5 border border-emerald-100 shadow-sm"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: item.subjectColor || '#10B981' }}
                            />
                            <span className="text-xs font-bold text-slate-900">
                              {item.topicName}
                            </span>
                            <span className="text-[10px] text-slate-500">({item.subjectName})</span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px]">
                            <span className="font-semibold text-emerald-700">
                              Nota: {item.classification?.displayScore ?? '—'}
                            </span>
                          </div>
                        </div>
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                          {item.classification?.recommendedActionLabel || 'Manter manutenção'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Dados Insuficientes */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-800">
                    Dados Insuficientes ({topicClassification.insufficient?.length || 0})
                  </h3>
                  <span className="text-[10px] text-slate-500">&lt; {MIN_QUESTIONS} questões</span>
                </div>
                {(!topicClassification.insufficient || topicClassification.insufficient.length === 0) ? (
                  <p className="mt-2 text-xs text-slate-500">
                    Todos os assuntos ativos possuem amostra suficiente.
                  </p>
                ) : (
                  <div className="mt-2.5 space-y-2">
                    {topicClassification.insufficient.map((item: any) => (
                      <div
                        key={item.topicId}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white p-2.5 border border-slate-200 shadow-sm"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: item.subjectColor || '#64748B' }}
                            />
                            <span className="text-xs font-bold text-slate-900">
                              {item.topicName}
                            </span>
                            <span className="text-[10px] text-slate-500">({item.subjectName})</span>
                          </div>
                          <div className="mt-1 text-[10px] text-slate-500">
                            {`Amostra: ${item.classification?.questionsInWindow ?? 0}/${MIN_QUESTIONS} questões`}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => navigate('/agenda')}
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-slate-900"
                        >
                          <span>Resolver Questões</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Seção 4: Revisões e Práticas Recomendadas */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Revisões e Práticas Recomendadas
                </h2>
                <p className="text-xs text-slate-500">
                  Assuntos que demandam atenção imediata para recuperação teórica ou reforço prático.
                </p>
              </div>
            </div>

            {recommendationsList.length === 0 ? (
              <p className="mt-3 text-xs text-slate-500">
                Nenhuma recomendação de revisão ou prática no momento.
              </p>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {recommendationsList.map((item: any) => {
                  const level = item.classification?.level ?? item.classification?.classification;
                  const isWeak = item.kind === 'WEAK' || level === 'WEAK';
                  return (
                    <div
                      key={item.topicId}
                      className="flex flex-col justify-between rounded-xl border border-slate-200 p-4"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: item.subjectColor || '#3B82F6' }}
                            />
                            <h3 className="text-xs font-bold text-slate-900">{item.topicName}</h3>
                          </div>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
                              isWeak
                                ? 'bg-rose-50 text-rose-800 border-rose-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}
                          >
                            {item.classification?.recommendedActionLabel ||
                              (isWeak ? 'Revisão + prática' : 'Mais prática')}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500">
                          Matéria: {item.subjectName} • Nota consolidada:{' '}
                          <strong>{item.classification?.displayScore ?? '—'}</strong>
                        </p>
                        {item.classification?.lowUnderstandingSignal && (
                          <div className="mt-2">
                            <span className="inline-flex items-center gap-1 rounded bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-800">
                              <AlertCircle className="h-3 w-3" />
                              Baixo entendimento
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="mt-3 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleDismissItem(`rec:${item.topicId}`)}
                          title="Dispensar recomendação"
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                        >
                          <X className="h-3.5 w-3.5" />
                          <span>Dispensar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate('/agenda')}
                          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white shadow-sm ${
                            isWeak
                              ? 'bg-rose-600 hover:bg-rose-700'
                              : 'bg-amber-600 hover:bg-amber-700'
                          }`}
                        >
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{isWeak ? 'Agendar Revisão' : 'Agendar Prática'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Seção 5: Matérias Negligenciadas & Alertas Acionáveis */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Matérias Negligenciadas */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Matérias Negligenciadas</h2>
                  <p className="text-xs text-slate-500">
                    Matérias ativas sem estudo registrado há mais de {NEGLECT_DAYS} dias.
                  </p>
                </div>
              </div>

              {neglectedSubjects.length === 0 ? (
                <p className="mt-3 text-xs text-slate-500">
                  Nenhuma matéria negligenciada identificada. Bom trabalho!
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {neglectedSubjects.map((sub: any) => (
                    <div
                      key={sub.subjectId}
                      className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/40 p-3"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: sub.subjectColor || '#F59E0B' }}
                        />
                        <div>
                          <p className="text-xs font-bold text-slate-900">{sub.subjectName}</p>
                          <p className="text-[10px] text-slate-500">
                            {sub.daysSinceLastStudy !== null && sub.daysSinceLastStudy !== undefined
                              ? `Último estudo há ${sub.daysSinceLastStudy} dias`
                              : 'Sem estudo registrado nos últimos 30 dias'}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate('/agenda')}
                        className="rounded-lg bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-700"
                      >
                        Agendar Estudo
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Alertas e Recomendações Acionáveis */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Alertas e Recomendações Acionáveis
                  </h2>
                  <p className="text-xs text-slate-500">
                    Diagnósticos automáticos acompanhados de evidências empíricas.
                  </p>
                </div>
              </div>

              {insights.length === 0 ? (
                <p className="mt-3 text-xs text-slate-500">
                  Nenhum alerta crítico ativo no momento.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {insights.map((insight: any) => (
                    <div
                      key={insight.id}
                      className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                insight.severity === 'HIGH'
                                  ? 'bg-rose-100 text-rose-800'
                                  : insight.severity === 'MEDIUM'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {insight.severity}
                            </span>
                            <h3 className="text-xs font-bold text-slate-900">{insight.title}</h3>
                          </div>
                          <p className="mt-1 text-[11px] text-slate-600">
                            {insight.message || insight.description}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => navigate(insight.actionPath || '/agenda')}
                            className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                          >
                            {insight.actionLabel || insight.recommendedActionLabel || 'Agendar'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDismissItem(insight.id)}
                            title="Dispensar alerta"
                            aria-label="Dispensar alerta"
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                          >
                            <X className="h-3.5 w-3.5" />
                            <span>Dispensar</span>
                          </button>
                        </div>
                      </div>

                      {insight.evidence && insight.evidence.length > 0 && (
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {insight.evidence.map((ev: any, idx: number) => (
                            <span
                              key={idx}
                              className="rounded-full bg-white px-2 py-0.5 text-[10px] text-slate-600 border border-slate-200"
                            >
                              {ev.label}: {ev.value} (limite: {ev.threshold})
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
