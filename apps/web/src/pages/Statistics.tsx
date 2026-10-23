import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart2,
  Clock,
  Target,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Info,
  Calendar,
  Play,
  Archive,
  AlertCircle,
  Filter,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  MIN_QUESTIONS,
  WEAK_THRESHOLD,
  STRONG_THRESHOLD,
} from '@estudos/domain';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from '../contexts/RouterContext';
import { apiFetch } from '../lib/api';

type StatisticsRange = 'day' | 'week' | 'month' | '30d';

interface SubjectOption {
  id: string;
  name: string;
  color: string;
  archived: boolean;
}

interface TopicOption {
  id: string;
  subject_id: string;
  name: string;
  archived: boolean;
}

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

function shiftLocalDate(localDate: string, deltaDays: number): string {
  const [y, m, d] = localDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays, 12, 0, 0));
  return dt.toISOString().slice(0, 10);
}

function formatDateBr(isoDate: string): string {
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function formatPercent(val: number | null | undefined): string {
  if (val === null || val === undefined || Number.isNaN(val)) return '—';
  return `${Number(val).toFixed(1).replace(/\.0$/, '')}%`;
}

function formatMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || Number.isNaN(minutes)) return '0 min';
  const rounded = Math.round(minutes);
  return `${rounded} min`;
}

function formatDayMonthBr(isoDate: string | undefined | null): string {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}`;
}

function formatClassificationTooltip(classification: any): string {
  if (!classification || !classification.weightsUsed) return '';
  if (classification.usedFallback) {
    return `${Math.round(classification.weightsUsed.accuracy * 100)}% acerto (sem autoavaliação)`;
  }
  const accPct = Math.round(classification.weightsUsed.accuracy * 100);
  const undPct = Math.round(classification.weightsUsed.understanding * 100);
  return `${accPct}% acerto + ${undPct}% entendimento`;
}

function renderClassificationCell(classification: any) {
  if (!classification) {
    return <span className="text-slate-400">—</span>;
  }

  const level = classification.level ?? classification.classification;
  const tooltip = formatClassificationTooltip(classification);

  if (level === 'INSUFFICIENT_DATA') {
    const qInWindow = classification.questionsInWindow ?? 0;
    return (
      <div className="space-y-1">
        <span
          title={tooltip}
          className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 border border-amber-200"
        >
          {`Dados insuficientes (${qInWindow}/${MIN_QUESTIONS} questões)`}
        </span>
        {classification.recommendedActionLabel && (
          <p className="text-[10px] text-slate-500">
            Ação: <span className="font-medium text-slate-700">{classification.recommendedActionLabel}</span>
          </p>
        )}
      </div>
    );
  }

  const badgeStyle =
    level === 'STRONG'
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
      : level === 'REGULAR'
        ? 'bg-amber-50 text-amber-800 border-amber-200'
        : 'bg-rose-50 text-rose-800 border-rose-200';

  return (
    <div className="space-y-1" title={tooltip}>
      <div className="flex flex-wrap items-center gap-1.5">
        {classification.displayScore !== null && (
          <span className="font-bold text-slate-900">
            {classification.displayScore}
          </span>
        )}
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badgeStyle}`}
        >
          {classification.label}
        </span>
      </div>
      <p className="text-[10px] text-slate-500">
        {classification.recommendedActionLabel} • <span className="text-slate-400">{tooltip}</span>
      </p>
    </div>
  );
}

export function Statistics() {
  const { user } = useAuth();
  const { navigate } = useRouter();
  const timezone = user?.timezone || 'America/Sao_Paulo';

  const [range, setRange] = useState<StatisticsRange>('week');
  const [referenceDate, setReferenceDate] = useState<string>(() => getTodayIso(timezone));
  const [filterSubjectId, setFilterSubjectId] = useState<string>('');
  const [filterTopicId, setFilterTopicId] = useState<string>('');

  const { data: statsRes, isLoading, isError, error, refetch } = useQuery<{ data: any }>({
    queryKey: ['statistics', range, referenceDate, filterSubjectId, filterTopicId],
    queryFn: () => {
      const params = new URLSearchParams({
        range,
        date: referenceDate,
      });
      if (filterSubjectId) params.set('subject_id', filterSubjectId);
      if (filterTopicId) params.set('topic_id', filterTopicId);
      return apiFetch(`/api/statistics?${params.toString()}`);
    },
  });

  const { data: subjectsRes } = useQuery<any>({
    queryKey: ['subjects', 'all-for-stats'],
    queryFn: () => apiFetch('/api/subjects?include_archived=true'),
  });

  const { data: topicsRes } = useQuery<any>({
    queryKey: ['topics', 'all-for-stats'],
    queryFn: () => apiFetch('/api/topics?include_archived=true'),
  });

  const subjects: SubjectOption[] = useMemo(() => {
    if (!subjectsRes) return [];
    return Array.isArray(subjectsRes) ? subjectsRes : subjectsRes.data || [];
  }, [subjectsRes]);

  const topics: TopicOption[] = useMemo(() => {
    if (!topicsRes) return [];
    const list: TopicOption[] = Array.isArray(topicsRes) ? topicsRes : topicsRes.data || [];
    if (!filterSubjectId) return list;
    return list.filter((t) => t.subject_id === filterSubjectId);
  }, [topicsRes, filterSubjectId]);

  const stats = statsRes?.data ?? statsRes ?? null;
  const overview = stats?.overview ?? null;
  const formulas = stats?.formulaMetadata ?? null;
  const bySubject: any[] = stats?.bySubject ?? [];
  const byTopic: any[] = stats?.byTopic ?? [];
  const dailySeries: any[] = stats?.dailySeries ?? [];

  const isEmptyState =
    overview &&
    overview.completedSessionsCount === 0 &&
    overview.agendaPlannedMinutes === 0 &&
    overview.totalQuestions === 0;

  const handleNavigatePeriod = (dir: -1 | 1) => {
    const step = range === 'day' ? 1 : range === 'week' ? 7 : 30;
    setReferenceDate((prev) => shiftLocalDate(prev, dir * step));
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Desempenho e Estatísticas</h1>
          <p className="mt-1 text-sm text-slate-600">
            Indicadores explicáveis com fórmulas transparentes sobre o seu tempo efetivo, aderência e resolução de questões.
          </p>
        </div>
      </div>

      {/* Seletor de Período e Filtros */}
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { id: 'day', label: 'Hoje' },
              { id: 'week', label: 'Esta Semana' },
              { id: '30d', label: 'Últimos 30 Dias' },
              { id: 'month', label: 'Este Mês' },
            ] as const
          ).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setRange(p.id)}
              className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
                range === p.id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Navegação de Data e Filtros de Matéria/Assunto */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1">
            <button
              type="button"
              onClick={() => handleNavigatePeriod(-1)}
              className="rounded p-1 text-slate-600 hover:bg-white hover:text-slate-900"
              title="Período anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setReferenceDate(getTodayIso(timezone))}
              className="px-2 text-xs font-semibold text-slate-700 hover:text-blue-600"
            >
              {stats
                ? `${formatDateBr(stats.startLocalDate)} – ${formatDateBr(stats.endLocalDate)}`
                : formatDateBr(referenceDate)}
            </button>
            <button
              type="button"
              onClick={() => handleNavigatePeriod(1)}
              className="rounded p-1 text-slate-600 hover:bg-white hover:text-slate-900"
              title="Próximo período"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              aria-label="Filtrar por Matéria"
              value={filterSubjectId}
              onChange={(e) => {
                setFilterSubjectId(e.target.value);
                setFilterTopicId('');
              }}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-blue-500 focus:outline-none"
            >
              <option value="">Todas as matérias</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.archived ? '(Arquivada)' : ''}
                </option>
              ))}
            </select>

            <select
              aria-label="Filtrar por Assunto"
              value={filterTopicId}
              onChange={(e) => setFilterTopicId(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-blue-500 focus:outline-none"
            >
              <option value="">Todos os assuntos</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.archived ? '(Arquivado)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          Carregando estatísticas do período...
        </div>
      ) : isEmptyState ? (
        /* Estado Vazio */
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <BarChart2 className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-bold text-slate-900">
            Nenhuma atividade registrada neste período
          </h3>
          <p className="mx-auto mt-1 max-w-md text-xs text-slate-500 leading-relaxed">
            Você ainda não possui sessões concluídas, blocos planejados na agenda ou questões resolvidas para o filtro selecionado.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/agenda')}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Calendar className="h-4 w-4 text-blue-600" />
              <span>Planejar na Agenda</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/timer')}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              <Play className="h-4 w-4" />
              <span>Iniciar Estudo Agora</span>
            </button>
          </div>
        </div>
      ) : overview ? (
        <>
          {/* Cards de Indicadores Explicáveis */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* 1. Carga Planejada na Agenda */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500">Carga Planejada na Agenda</p>
                <Calendar className="h-4 w-4 text-slate-400" />
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {formatMinutes(overview.agendaPlannedMinutes)}
              </p>
              <p className="mt-2 text-[11px] text-slate-500">
                Soma das sessões planejadas (PLANNED ou DONE) na agenda do período.
              </p>
            </div>

            {/* 2. Tempo Efetivo Estudado */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500">Tempo Efetivo Estudado</p>
                <Clock className="h-4 w-4 text-blue-600" />
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {formatMinutes(overview.effectiveMinutes)}
              </p>
              <p className="mt-2 text-[11px] text-slate-500">
                {overview.completedSessionsCount} sessões concluídas ({overview.effectiveSeconds}s líquidos sem pausas/distrações).
              </p>
            </div>

            {/* 3. Efetividade / Foco */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500">Efetividade / Foco</p>
                <Info className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {formatPercent(overview.effectiveness)}
              </p>
              {formulas?.effectiveness && (
                <div className="mt-2 rounded-lg bg-slate-50 p-2 text-[11px] text-slate-600">
                  <p className="font-semibold text-slate-700">{formulas.effectiveness.formula}</p>
                  <p className="mt-0.5">
                    {formulas.effectiveness.numeratorValue}s / {formulas.effectiveness.denominatorValue}s
                  </p>
                </div>
              )}
            </div>

            {/* 4. Aderência das Sessões Concluídas */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500">
                  Aderência das Sessões Concluídas
                </p>
                <Target className="h-4 w-4 text-indigo-600" />
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {formatPercent(overview.adherence)}
              </p>
              {formulas?.adherence && (
                <div className="mt-2 rounded-lg bg-slate-50 p-2 text-[11px] text-slate-600">
                  <p className="font-semibold text-slate-700">{formulas.adherence.formula}</p>
                  <p className="mt-0.5">
                    {formulas.adherence.numeratorValue}s efetivos / {formulas.adherence.denominatorValue}s planejados nos blocos
                  </p>
                </div>
              )}
            </div>

            {/* 5. Questões & Taxa de Acerto */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500">Questões e Taxa de Acerto</p>
                <CheckCircle2 className="h-4 w-4 text-amber-600" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <p className="text-2xl font-bold text-slate-900">
                  {formatPercent(overview.accuracy)}
                </p>
                <span className="text-xs font-medium text-slate-500">
                  ({overview.totalCorrect}/{overview.totalQuestions} acertos)
                </span>
              </div>
              {overview.totalQuestions > 0 && overview.totalQuestions < MIN_QUESTIONS && (
                <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 border border-amber-200">
                  <AlertCircle className="h-3 w-3" />
                  Amostra em formação ({overview.totalQuestions}/{MIN_QUESTIONS} questões)
                </p>
              )}
              {formulas?.accuracy && (
                <p className="mt-1.5 text-[11px] text-slate-500">{formulas.accuracy.formula}</p>
              )}
            </div>

            {/* 6. Consistência no Período */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500">Consistência no Período</p>
                <BarChart2 className="h-4 w-4 text-teal-600" />
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {overview.activeDaysCount} / {overview.totalDaysInPeriod} dias
              </p>
              {formulas?.consistency && (
                <p className="mt-2 text-[11px] text-slate-500">{formulas.consistency.formula}</p>
              )}
            </div>
          </div>

          {/* Gráfico de Série Diária */}
          {dailySeries.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900">
                Evolução Diária (Minutos Efetivos vs. Planejados na Agenda)
              </h3>
              <div className="mt-4 overflow-x-auto">
                <BarChart
                  width={760}
                  height={240}
                  data={dailySeries.map((d) => ({
                    ...d,
                    EffectiveMinRounded: Math.round(d.effectiveMinutes),
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar
                    dataKey="EffectiveMinRounded"
                    name="Minutos Efetivos"
                    fill="#2563EB"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="agendaPlannedMinutes"
                    name="Planejado na Agenda (min)"
                    fill="#94A3B8"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </div>
            </div>
          )}

          {/* Tabela Por Matéria */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-sm font-bold text-slate-900">Desempenho por Matéria</h3>
              <p className="text-[11px] text-slate-500">
                Faixas (mín. {MIN_QUESTIONS} questões): Ponto fraco (&lt; {WEAK_THRESHOLD}), Regular (de {WEAK_THRESHOLD} a menos de {STRONG_THRESHOLD}), Ponto forte (&ge; {STRONG_THRESHOLD})
              </p>
            </div>
            {bySubject.length === 0 ? (
              <p className="mt-3 text-xs text-slate-500">
                Nenhuma matéria com estudo registrado neste período.
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="pb-2 font-semibold">Matéria</th>
                      <th className="pb-2 font-semibold">Tempo Efetivo</th>
                      <th className="pb-2 font-semibold">Agenda</th>
                      <th className="pb-2 font-semibold">Sessões</th>
                      <th className="pb-2 font-semibold">Questões (Acertos/Erros)</th>
                      <th className="pb-2 font-semibold">Taxa de Acerto</th>
                      <th className="pb-2 font-semibold">
                        {`Classificação (30 dias até ${formatDayMonthBr(stats?.classificationWindow?.windowEndLocalDate || stats?.endLocalDate)})`}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {bySubject.map((row) => (
                      <tr key={row.subjectId} className="hover:bg-slate-50">
                        <td className="py-2.5 font-medium text-slate-900">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: row.subjectColor || '#3B82F6' }}
                            />
                            <span>{row.subjectName}</span>
                            {row.archived && (
                              <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                                <Archive className="h-2.5 w-2.5" />
                                Arquivado
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 text-slate-700">{formatMinutes(row.effectiveMinutes)}</td>
                        <td className="py-2.5 text-slate-600">
                          {formatMinutes(row.agendaPlannedMinutes)}
                        </td>
                        <td className="py-2.5 text-slate-600">{row.completedSessionsCount}</td>
                        <td className="py-2.5 text-slate-700">
                          {row.totalQuestions} ({row.totalCorrect}C / {row.totalErrors}E)
                        </td>
                        <td className="py-2.5">
                          <span className="font-semibold text-slate-900">
                            {formatPercent(row.accuracy)}
                          </span>
                        </td>
                        <td className="py-2.5">
                          {renderClassificationCell(row.classification)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Tabela Por Assunto */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-sm font-bold text-slate-900">Desempenho por Assunto</h3>
              <p className="text-[11px] text-slate-500">
                Faixas (mín. {MIN_QUESTIONS} questões): Ponto fraco (&lt; {WEAK_THRESHOLD}), Regular (de {WEAK_THRESHOLD} a menos de {STRONG_THRESHOLD}), Ponto forte (&ge; {STRONG_THRESHOLD})
              </p>
            </div>
            {byTopic.length === 0 ? (
              <p className="mt-3 text-xs text-slate-500">
                Nenhum assunto com estudo ou questões registradas neste período.
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="pb-2 font-semibold">Assunto</th>
                      <th className="pb-2 font-semibold">Matéria</th>
                      <th className="pb-2 font-semibold">Tempo Efetivo</th>
                      <th className="pb-2 font-semibold">Sessões</th>
                      <th className="pb-2 font-semibold">Questões (Acertos/Erros)</th>
                      <th className="pb-2 font-semibold">Taxa de Acerto</th>
                      <th className="pb-2 font-semibold">
                        {`Classificação (30 dias até ${formatDayMonthBr(stats?.classificationWindow?.windowEndLocalDate || stats?.endLocalDate)})`}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {byTopic.map((row) => (
                      <tr key={row.topicId} className="hover:bg-slate-50">
                        <td className="py-2.5 font-medium text-slate-900">
                          <div className="flex items-center gap-2">
                            <span>{row.topicName}</span>
                            {row.archived && (
                              <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                                <Archive className="h-2.5 w-2.5" />
                                Arquivado
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 text-slate-600">{row.subjectName}</td>
                        <td className="py-2.5 text-slate-700">{formatMinutes(row.effectiveMinutes)}</td>
                        <td className="py-2.5 text-slate-600">{row.completedSessionsCount}</td>
                        <td className="py-2.5 text-slate-700">
                          {row.totalQuestions} ({row.totalCorrect}C / {row.totalErrors}E)
                        </td>
                        <td className="py-2.5">
                          <span className="font-semibold text-slate-900">
                            {formatPercent(row.accuracy)}
                          </span>
                        </td>
                        <td className="py-2.5">
                          {renderClassificationCell(row.classification)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-8 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-rose-600" />
          <h3 className="mt-3 text-base font-bold text-slate-900">
            Não foi possível carregar as estatísticas
          </h3>
          <p className="mt-1 text-xs text-slate-600">
            {(isError && (error as any)?.message) ||
              'Ocorreu um erro ao buscar os dados do período selecionado.'}
          </p>
          <button
            type="button"
            onClick={() => refetch?.()}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            Tentar Novamente
          </button>
        </div>
      )}
    </div>
  );
}
