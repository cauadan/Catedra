import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Layers,
  Calendar,
  Clock,
  Target,
  BarChart2,
  Compass,
  Play,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { MIN_QUESTIONS } from '@estudos/domain';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from '../contexts/RouterContext';
import { apiFetch } from '../lib/api';
import { renderGoalStatusBadge, formatGoalMetricLabel } from '../components/goals/GoalStatusBadge';

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
  return `${Math.round(minutes)} min`;
}

const METRIC_LABELS: Record<string, string> = {
  EFFECTIVE_MINUTES: 'Minutos efetivos estudados',
  QUESTIONS: 'Questões resolvidas',
  TOPICS_COMPLETED: 'Assuntos estudados',
  REVIEWS: 'Blocos de revisão concluídos',
  ACCURACY: 'Taxa de acerto (%)',
};

const PLATFORM_MODULES = [
  {
    id: 'subjects',
    path: '/subjects',
    label: 'Matérias e Assuntos',
    description: 'Estruturação hierárquica em árvore, matérias coloridas e tópicos recursivos.',
    icon: Layers,
  },
  {
    id: 'agenda',
    path: '/agenda',
    label: 'Agenda e Planejamento',
    description: 'Planejamento semanal de sessões com fuso horário e início na segunda-feira.',
    icon: Calendar,
  },
  {
    id: 'timer',
    path: '/timer',
    label: 'Cronômetro de Estudo',
    description: 'Registro de tempo líquido, pausas e cálculo de foco e aproveitamento.',
    icon: Clock,
  },
  {
    id: 'goals',
    path: '/goals',
    label: 'Metas de Estudo',
    description: 'Definição e acompanhamento de metas de horas e questões resolvidas.',
    icon: Target,
  },
  {
    id: 'stats',
    path: '/stats',
    label: 'Desempenho e Estatísticas',
    description: 'Classificação de matérias (Forte, Regular, Fraco) e análise de notas.',
    icon: BarChart2,
  },
  {
    id: 'observatory',
    path: '/observatory',
    label: 'Observatório Semanal',
    description: 'Relatório consolidado e insights sobre hábitos e evolução de estudos.',
    icon: Compass,
  },
];

function renderSubjectClassificationBadge(classification: any) {
  if (!classification) return null;
  if (classification.level === 'STRONG') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
        <span>{classification.label}</span>
        {classification.displayScore !== null && (
          <span>({classification.displayScore})</span>
        )}
      </span>
    );
  }
  if (classification.level === 'REGULAR') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
        <span>{classification.label}</span>
        {classification.displayScore !== null && (
          <span>({classification.displayScore})</span>
        )}
      </span>
    );
  }
  if (classification.level === 'WEAK') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-800">
        <span>{classification.label}</span>
        {classification.displayScore !== null && (
          <span>({classification.displayScore})</span>
        )}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
      <span>{`Dados insuficientes (${classification.questionsInWindow ?? 0}/${MIN_QUESTIONS} questões)`}</span>
    </span>
  );
}

export function Dashboard() {
  const { user } = useAuth();
  const { navigate } = useRouter();
  const queryClient = useQueryClient();
  const timezone = user?.timezone || 'America/Sao_Paulo';
  const todayIso = getTodayIso(timezone);

  const { data: dashRes, isLoading } = useQuery<{ data: any }>({
    queryKey: ['dashboard', todayIso],
    queryFn: () => apiFetch(`/dashboard?date=${todayIso}`),
  });

  const startPlannedSessionMutation = useMutation({
    mutationFn: (plannedSessionId: string) =>
      apiFetch('/study-sessions', {
        method: 'POST',
        body: JSON.stringify({ planned_session_id: plannedSessionId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-study-session'] });
      queryClient.invalidateQueries({ queryKey: ['planned-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      queryClient.invalidateQueries({ queryKey: ['statistics'] });
      navigate('/timer');
    },
  });

  const dash = dashRes?.data ?? null;

  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        Carregando o seu painel analítico...
      </div>
    );
  }

  if (!dash) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        Não foi possível carregar os dados do painel.
      </div>
    );
  }

  const today = dash.today;
  const activeSession = dash.activeSession;
  const pendingEvaluation = dash.pendingEvaluation;
  const nextSession = today?.nextSession ?? null;
  const goals: any[] = dash.goals ?? [];
  const weekSummary = dash.weekSummary;
  const rolling30Days = dash.rolling30Days;
  const subjectProgress: any[] = dash.subjectProgress ?? [];
  const classificationSummary = dash.classificationSummary ?? null;

  return (
    <div className="space-y-6">
      {/* Banner de Boas-Vindas quando usuário novo ainda não possui dados */}
      {!dash.hasAnyStudyData && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 p-6 text-white shadow-lg shadow-emerald-500/10 md:p-8">
          <div className="relative z-10 max-w-2xl">
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Bem-vindo ao seu Painel de Estudos</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              Olá, {user?.name || 'Estudante'}!
            </h1>
            <p className="mt-2 text-sm text-emerald-50 leading-relaxed">
              Você ainda não possui sessões concluídas, metas ou planejamentos registrados. Comece cadastrando suas matérias ou planejando a semana na agenda!
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/subjects')}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-emerald-900 shadow-sm hover:bg-emerald-50"
              >
                <Layers className="h-4 w-4 text-emerald-600" />
                <span>Cadastrar Matérias</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/agenda')}
                className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-4 py-2.5 text-xs font-bold text-white backdrop-blur-sm hover:bg-white/20"
              >
                <Calendar className="h-4 w-4" />
                <span>Planejar Agenda</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/timer')}
                className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-4 py-2.5 text-xs font-bold text-white backdrop-blur-sm hover:bg-white/20"
              >
                <Play className="h-4 w-4" />
                <span>Iniciar Estudo Avulso</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Cabeçalho */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Olá, {user?.name || 'Estudante'}!
          </h1>
          <p className="text-xs text-slate-500">
            Resumo analítico do seu estudo em {formatDateBr(dash.referenceDate)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/goals')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Target className="h-4 w-4 text-blue-600" />
            <span>Metas</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/stats')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <BarChart2 className="h-4 w-4 text-emerald-600" />
            <span>Estatísticas Completas</span>
          </button>
        </div>
      </div>

      {/* Card de Ação Imediata: "O que estudar agora?" */}
      <div className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 via-white to-indigo-50 p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold text-blue-800">
              <Clock className="h-3.5 w-3.5" />
              O que estudar agora?
            </span>

            {activeSession ? (
              <div className="mt-2">
                <h2 className="text-base font-bold text-slate-900">
                  Sessão em andamento: {activeSession.subject_name}
                  {activeSession.topic_name ? ` — ${activeSession.topic_name}` : ''}
                </h2>
                <p className="mt-0.5 text-xs text-slate-600">
                  Você tem um cronômetro aberto agora. Retome de onde parou!
                </p>
              </div>
            ) : pendingEvaluation ? (
              <div className="mt-2">
                <h2 className="text-base font-bold text-slate-900">
                  Avaliação Pós-Sessão Pendente: {pendingEvaluation.subject_name}
                </h2>
                <p className="mt-0.5 text-xs text-slate-600">
                  Registre sua compreensão e questões antes de abrir uma nova sessão.
                </p>
              </div>
            ) : nextSession ? (
              <div className="mt-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: nextSession.subject_color || '#3B82F6' }}
                  />
                  <h2 className="text-base font-bold text-slate-900">
                    {nextSession.subject_name}
                    {nextSession.topic_name ? ` — ${nextSession.topic_name}` : ''}
                  </h2>
                  {nextSession.isLate && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-800 border border-rose-200">
                      <AlertCircle className="h-3 w-3" />
                      Em atraso
                    </span>
                  )}
                  {nextSession.isFutureDay && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 border border-slate-200">
                      Agendada para {formatDateBr(nextSession.localDate)}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  Horário previsto: <strong>{nextSession.localTime}</strong> • Duração planejada:{' '}
                  <strong>{nextSession.planned_minutes} min</strong>
                </p>
              </div>
            ) : (
              <div className="mt-2">
                <h2 className="text-base font-bold text-slate-900">
                  Nenhuma sessão pendente na agenda de hoje
                </h2>
                <p className="mt-0.5 text-xs text-slate-600">
                  Você pode iniciar uma sessão avulsa ou planejar novos blocos na agenda.
                </p>
              </div>
            )}
          </div>

          <div className="shrink-0">
            {activeSession ? (
              <button
                type="button"
                onClick={() => navigate('/timer')}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700"
              >
                <Play className="h-4 w-4" />
                <span>Retomar Cronômetro</span>
              </button>
            ) : pendingEvaluation ? (
              <button
                type="button"
                onClick={() => navigate('/timer')}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-amber-700"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Concluir Avaliação Pendente</span>
              </button>
            ) : nextSession ? (
              <button
                type="button"
                onClick={() => startPlannedSessionMutation.mutate(nextSession.id)}
                disabled={startPlannedSessionMutation.isPending}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
              >
                <Play className="h-4 w-4" />
                <span>Iniciar Estudo</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigate('/timer')}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-slate-800"
              >
                <Play className="h-4 w-4" />
                <span>Iniciar Estudo Avulso</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Comparativo de Hoje */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-500">Planejado na Agenda Hoje</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {formatMinutes(today?.agendaPlannedMinutes)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Blocos PLANNED ou DONE para hoje
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-500">Tempo Efetivo Estudado Hoje</p>
          <p className="mt-2 text-2xl font-bold text-blue-600">
            {formatMinutes(today?.effectiveMinutes)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Foco hoje: {formatPercent(today?.effectiveness)}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-500">Aderência das Sessões Hoje</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {formatPercent(today?.adherence)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Efetivo vs. blocos das sessões concluídas
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-500">Questões Resolvidas Hoje</p>
          <div className="mt-2 flex items-baseline gap-2">
            <p className="text-2xl font-bold text-slate-900">{today?.questions ?? 0}</p>
            <span className="text-xs font-semibold text-emerald-700">
              ({formatPercent(today?.accuracy)} acerto)
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            {today?.correct ?? 0} corretas hoje
          </p>
        </div>
      </div>

      {/* Metas Ativas e Resumo da Semana / 30 Dias */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Metas Ativas */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Metas Ativas</h3>
            <button
              type="button"
              onClick={() => navigate('/goals')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              <span>Ver todas</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {goals.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-slate-200 p-6 text-center">
              <p className="text-xs text-slate-500">
                Nenhuma meta cadastrada para os períodos atuais.
              </p>
              <button
                type="button"
                onClick={() => navigate('/goals')}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
              >
                <Target className="h-3.5 w-3.5" />
                <span>Criar Meta</span>
              </button>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {goals.slice(0, 5).map((g) => (
                <div
                  key={g.id}
                  className="rounded-xl border border-slate-100 bg-slate-50/70 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-slate-900">
                        {formatGoalMetricLabel(g.metric)}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {g.subject_name ? `Matéria: ${g.subject_name}` : 'Escopo Geral'}
                        {g.topic_name ? ` • ${g.topic_name}` : ''}
                      </p>
                    </div>
                    {renderGoalStatusBadge(g.status, g.questions_count)}
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-600">
                    <span>
                      Atual: <strong>{Math.round(g.current_value * 10) / 10}</strong> / Alvo:{' '}
                      <strong>{g.target_value}</strong>
                    </span>
                    {g.progress_percent !== null && (
                      <span className="font-semibold text-slate-800">
                        {Math.round(g.progress_percent)}%
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Resumo Semanal e Últimos 30 Dias */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">
              Resumo da Semana e Últimos 30 Dias
            </h3>
            <button
              type="button"
              onClick={() => navigate('/stats')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              <span>Detalhes</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="font-semibold text-slate-500">Esta Semana (Seg–Dom)</p>
              <p className="mt-1 text-lg font-bold text-slate-900">
                {formatMinutes(weekSummary?.overview?.effectiveMinutes)}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Consistência: {weekSummary?.overview?.activeDaysCount ?? 0}/7 dias •{' '}
                {weekSummary?.overview?.totalQuestions ?? 0} questões
              </p>
            </div>

            <div className="rounded-lg bg-slate-50 p-3">
              <p className="font-semibold text-slate-500">Últimos 30 Dias</p>
              <p className="mt-1 text-lg font-bold text-slate-900">
                {formatMinutes(rolling30Days?.effectiveMinutes)}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Consistência: {rolling30Days?.activeDaysCount ?? 0}/30 dias •{' '}
                {rolling30Days?.totalQuestions ?? 0} questões
              </p>
            </div>
          </div>

          {weekSummary?.dailySeries && weekSummary.dailySeries.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <BarChart
                width={380}
                height={150}
                data={weekSummary.dailySeries.map((d: any) => ({
                  date: d.date.slice(5),
                  minutos: Math.round(d.effectiveMinutes),
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="minutos" name="Minutos Efetivos" fill="#2563EB" radius={[4, 4, 0, 0]} />
              </BarChart>
            </div>
          )}
        </div>
      </div>

      {/* Progresso por Matéria com Classificação 70/30 */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Progresso por Matéria (Últimos 30 Dias)
            </h3>
            <p className="text-xs text-slate-500">
              Tempo líquido estudado, volume de questões e classificação consolidada por matéria ativa.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            {classificationSummary && (
              <>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 font-semibold text-emerald-800 border border-emerald-200">
                  Fortes: {classificationSummary.strongCount}
                </span>
                <span className="rounded-full bg-amber-50 px-2.5 py-0.5 font-semibold text-amber-800 border border-amber-200">
                  Regulares: {classificationSummary.regularCount}
                </span>
                <span className="rounded-full bg-rose-50 px-2.5 py-0.5 font-semibold text-rose-800 border border-rose-200">
                  Fracos: {classificationSummary.weakCount}
                </span>
              </>
            )}
            <BookOpen className="h-4 w-4 text-slate-400" />
          </div>
        </div>

        {subjectProgress.length === 0 ? (
          <p className="mt-3 text-xs text-slate-500">
            Nenhuma matéria com estudo registrado nos últimos 30 dias.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {subjectProgress.map((subj) => (
              <div
                key={subj.subjectId}
                className="flex flex-col justify-between rounded-xl border border-slate-200 p-3.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: subj.subjectColor || '#3B82F6' }}
                    />
                    <span className="font-semibold text-xs text-slate-900 truncate">
                      {subj.subjectName}
                    </span>
                  </div>
                  {renderSubjectClassificationBadge(subj.classification)}
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
                  <span>
                    Tempo: <strong className="text-slate-900">{formatMinutes(subj.effectiveMinutes)}</strong>
                  </span>
                  <span>
                    Questões: <strong className="text-slate-900">{subj.totalQuestions}</strong>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Módulos da Plataforma */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Módulos da Plataforma</h2>
          <span className="text-xs text-slate-500">Navegação e Planejamento</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PLATFORM_MODULES.map((m) => {
            const Icon = m.icon;
            return (
              <div
                key={m.id}
                onClick={() => navigate(m.path)}
                className="group relative flex cursor-pointer flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
              >
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                      Disponível
                    </span>
                  </div>
                  <h3 className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                    {m.label}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                    {m.description}
                  </p>
                </div>

                <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-blue-600 group-hover:translate-x-0.5 transition-transform">
                  <span>Acessar</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
