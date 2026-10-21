import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Target,
  Plus,
  Copy,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Edit2,
  Check,
  X,
  Calendar,
  TrendingUp,
} from 'lucide-react';
import {
  addDaysToLocalDate,
  getPreviousGoalPeriodStart,
  normalizeGoalPeriodStart,
  utcToLocalDate,
  type GoalKindDTO,
  type GoalMetricDTO,
  type GoalPeriodDTO,
} from '@estudos/domain';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { api, ApiError } from '../lib/api';
import { formatDuration, formatPercent } from '../lib/format';
import {
  renderGoalStatusBadge,
  renderArchivedScopeBadge,
  formatGoalMetricLabel,
  formatGoalValue,
} from '../components/goals/GoalStatusBadge';

type GoalTab = 'DAY' | 'WEEK' | 'MONTH' | '30D';

export function Goals() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const timezone = user?.timezone || 'America/Sao_Paulo';
  const todayLocalDate = useMemo(() => utcToLocalDate(new Date(), timezone), [timezone]);

  const [activeTab, setActiveTab] = useState<GoalTab>('DAY');
  const [selectedDate, setSelectedDate] = useState<string>(todayLocalDate);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [infoMsg, setInfoMsg] = useState<string>('');

  // Modal de criação
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [formKind, setFormKind] = useState<GoalKindDTO>('EFFORT');
  const [formMetric, setFormMetric] = useState<GoalMetricDTO>('EFFECTIVE_MINUTES');
  const [formTargetValue, setFormTargetValue] = useState<string>('60');
  const [formSubjectId, setFormSubjectId] = useState<string>('');
  const [formTopicId, setFormTopicId] = useState<string>('');

  // Edição inline de target_value
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editingTargetValue, setEditingTargetValue] = useState<string>('');

  const activePeriod: GoalPeriodDTO = activeTab === '30D' ? 'MONTH' : activeTab;

  const { data: goalsResp } = useQuery<any>({
    queryKey: ['goals', activePeriod, selectedDate],
    queryFn: () => api.get(`/api/goals?period=${activePeriod}&date=${selectedDate}`),
    enabled: activeTab !== '30D',
  });

  const { data: stats30dResp } = useQuery<any>({
    queryKey: ['statistics', '30d', selectedDate],
    queryFn: () => api.get(`/api/statistics?range=30d&date=${selectedDate}`),
    enabled: activeTab === '30D',
  });

  const { data: subjects = [] } = useQuery<any[]>({
    queryKey: ['subjects', false],
    queryFn: () => api.get('/api/subjects?include_archived=false'),
  });

  const { data: topics = [] } = useQuery<any[]>({
    queryKey: ['topics', false],
    queryFn: () => api.get('/api/topics?include_archived=false'),
  });

  const goalsList: any[] = Array.isArray(goalsResp) ? goalsResp : goalsResp?.data ?? [];
  const stats30d = stats30dResp?.data ?? stats30dResp ?? null;

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['goals'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['statistics'] });
  };

  const createMutation = useMutation({
    mutationFn: (payload: any) => api.post('/api/goals', payload),
    onSuccess: () => {
      invalidateAll();
      setIsModalOpen(false);
      setErrorMsg('');
    },
    onError: (err: ApiError) => setErrorMsg(err.message),
  });

  const copyMutation = useMutation({
    mutationFn: (payload: { period: GoalPeriodDTO; target_date: string }) =>
      api.post('/api/goals/copy', payload),
    onSuccess: (res: any) => {
      invalidateAll();
      setErrorMsg('');
      const count = res?.copiedCount ?? 0;
      setInfoMsg(
        count > 0
          ? `${count} meta(s) copiada(s) do período anterior com sucesso.`
          : 'Nenhuma meta nova para copiar do período anterior.'
      );
    },
    onError: (err: ApiError) => setErrorMsg(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, target_value }: { id: string; target_value: number }) =>
      api.patch(`/api/goals/${id}`, { target_value }),
    onSuccess: () => {
      invalidateAll();
      setEditingGoalId(null);
      setErrorMsg('');
    },
    onError: (err: ApiError) => setErrorMsg(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/goals/${id}`),
    onSuccess: () => {
      invalidateAll();
      setErrorMsg('');
    },
    onError: (err: ApiError) => setErrorMsg(err.message),
  });

  const handleNavigatePeriod = (dir: -1 | 0 | 1) => {
    setErrorMsg('');
    setInfoMsg('');
    if (dir === 0) {
      setSelectedDate(todayLocalDate);
      return;
    }
    if (activeTab === 'DAY' || activeTab === '30D') {
      setSelectedDate((prev) => addDaysToLocalDate(prev, dir));
    } else if (activeTab === 'WEEK') {
      setSelectedDate((prev) => addDaysToLocalDate(prev, dir * 7));
    } else {
      const normalized = normalizeGoalPeriodStart(selectedDate, 'MONTH', 1);
      if (dir === -1) {
        setSelectedDate(getPreviousGoalPeriodStart(normalized, 'MONTH', 1));
      } else {
        const nextMonth = addDaysToLocalDate(normalized, 32);
        setSelectedDate(`${nextMonth.slice(0, 7)}-01`);
      }
    }
  };

  const handleOpenCreateModal = () => {
    setErrorMsg('');
    setFormKind('EFFORT');
    setFormMetric('EFFECTIVE_MINUTES');
    setFormTargetValue('60');
    setFormSubjectId('');
    setFormTopicId('');
    setIsModalOpen(true);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numericTarget = Number(formTargetValue);
    createMutation.mutate({
      kind: formKind,
      metric: formMetric,
      period: activePeriod,
      period_start_local_date: selectedDate,
      target_value: numericTarget,
      ...(formSubjectId ? { subject_id: formSubjectId } : {}),
      ...(formTopicId ? { topic_id: formTopicId } : {}),
    });
  };

  const filteredTopics = useMemo(() => {
    if (!formSubjectId) return topics;
    return topics.filter((t) => t.subject_id === formSubjectId);
  }, [topics, formSubjectId]);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Metas de Estudo</h1>
          <p className="text-sm text-slate-500">
            Defina metas de esforço e resultado com progresso calculado em tempo real.
          </p>
        </div>

        {activeTab !== '30D' && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => copyMutation.mutate({ period: activePeriod, target_date: selectedDate })}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <Copy className="h-4 w-4 text-slate-500" />
              <span>Copiar metas do período anterior</span>
            </button>
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              <span>Criar Meta</span>
            </button>
          </div>
        )}
      </div>

      {/* Abas */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'DAY', label: 'Metas Diárias' },
            { id: 'WEEK', label: 'Metas Semanais' },
            { id: 'MONTH', label: 'Metas Mensais' },
            { id: '30D', label: 'Visão de 30 Dias' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as GoalTab)}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Navegação de Período */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleNavigatePeriod(-1)}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <span className="inline-flex items-center gap-1">
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Anterior</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => handleNavigatePeriod(0)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100"
          >
            Atual ({selectedDate})
          </button>
          <button
            type="button"
            onClick={() => handleNavigatePeriod(1)}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <span className="inline-flex items-center gap-1">
              <span>Próximo</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700">
          {errorMsg}
        </div>
      )}

      {infoMsg && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs font-medium text-blue-700">
          {infoMsg}
        </div>
      )}

      {/* Conteúdo: Aba Visão de 30 Dias */}
      {activeTab === '30D' ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-slate-500">Consistência / Dias Estudados</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {stats30d?.overview?.activeDaysCount ?? 0} / {stats30d?.overview?.totalDaysInPeriod ?? 30} dias
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {formatPercent(
                  ((stats30d?.overview?.activeDaysCount ?? 0) /
                    Math.max(1, stats30d?.overview?.totalDaysInPeriod ?? 30)) *
                    100
                )}{' '}
                dos últimos 30 dias com estudo efetivo
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-slate-500">Tempo Efetivo (30 Dias)</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {formatDuration(stats30d?.overview?.effectiveSeconds ?? 0)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Planejado na agenda: {Math.round(stats30d?.overview?.agendaPlannedMinutes ?? 0)} min
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-slate-500">Questões & Taxa de Acerto</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {stats30d?.overview?.totalQuestions ?? 0} questões
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Aproveitamento geral: {formatPercent(stats30d?.overview?.accuracy ?? null)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-slate-500">Efetividade / Foco (30d)</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {formatPercent(stats30d?.overview?.effectiveness ?? null)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-slate-500">Aderência das Sessões (30d)</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {formatPercent(stats30d?.overview?.adherence ?? null)}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Evolução Diária nos Últimos 30 Dias (Minutos Efetivos vs Planejados)
              </h3>
            </div>
            <div className="overflow-x-auto">
              <BarChart
                width={720}
                height={240}
                data={stats30d?.dailySeries ?? []}
                margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="agendaPlannedMinutes" name="Planejado (min)" fill="#94A3B8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="effectiveMinutes" name="Efetivo (min)" fill="#2563EB" radius={[4, 4, 0, 0]} />
              </BarChart>
            </div>
          </div>
        </div>
      ) : goalsList.length === 0 ? (
        /* Estado Vazio */
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <Target className="h-6 w-6" />
          </div>
          <h2 className="mt-3 text-base font-bold text-slate-900">
            Nenhuma meta cadastrada para este período
          </h2>
          <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
            Você ainda não definiu metas para este período. Crie uma meta personalizada ou copie as
            metas ativas do período imediatamente anterior.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              <span>Criar Meta</span>
            </button>
            <button
              type="button"
              onClick={() => copyMutation.mutate({ period: activePeriod, target_date: selectedDate })}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Copy className="h-4 w-4" />
              <span>Copiar metas do período anterior</span>
            </button>
          </div>
        </div>
      ) : (
        /* Lista de Metas */
        <div className="grid gap-4 md:grid-cols-2">
          {goalsList.map((g) => {
            const isInsufficient = g.status === 'INSUFFICIENT_DATA';
            const barWidth =
              g.progress_percent !== null && g.progress_percent !== undefined
                ? Math.min(100, Math.max(0, g.progress_percent))
                : 0;

            return (
              <div
                key={g.id}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">
                          {formatGoalMetricLabel(g.metric)}
                        </span>
                        {renderArchivedScopeBadge(g.is_archived_scope, 'Arquivada')}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {g.topic_name
                          ? `${g.subject_name || 'Matéria'} • ${g.topic_name}`
                          : g.subject_name
                          ? g.subject_name
                          : 'Escopo Geral (Todas as matérias)'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {renderGoalStatusBadge(g.status, g.questions_count ?? 0)}
                    </div>
                  </div>

                  {/* Progresso numérico */}
                  <div className="mt-4 flex items-baseline justify-between text-xs">
                    <span className="font-semibold text-slate-700">
                      Atual: {formatGoalValue(g.metric, g.current_value)}
                    </span>
                    {editingGoalId === g.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={editingTargetValue}
                          onChange={(e) => setEditingTargetValue(e.target.value)}
                          className="w-20 rounded border border-slate-300 px-2 py-0.5 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            updateMutation.mutate({
                              id: g.id,
                              target_value: Number(editingTargetValue),
                            })
                          }
                          className="rounded bg-emerald-600 p-1 text-white"
                        >
                          <Check className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingGoalId(null)}
                          className="rounded bg-slate-200 p-1 text-slate-700"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-slate-500">
                        Alvo: {formatGoalValue(g.metric, g.target_value)}
                      </span>
                    )}
                  </div>

                  {/* Barra de progresso (oculta quando INSUFFICIENT_DATA para não exibir percentual enganoso) */}
                  {!isInsufficient && g.progress_percent !== null && (
                    <div className="mt-2">
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full transition-all ${
                            g.status === 'ACHIEVED' ? 'bg-emerald-500' : 'bg-blue-600'
                          }`}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingGoalId(g.id);
                      setEditingTargetValue(String(g.target_value));
                    }}
                    className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                    <span>Editar alvo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteMutation.mutate(g.id)}
                    className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Excluir</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Criar Meta */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 !mt-0 flex items-center justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="my-auto w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Nova Meta de Estudo</h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Tipo da Meta</label>
                <select
                  value={formKind}
                  onChange={(e) => {
                    const nextKind = e.target.value as GoalKindDTO;
                    setFormKind(nextKind);
                    setFormMetric(nextKind === 'RESULT' ? 'ACCURACY' : 'EFFECTIVE_MINUTES');
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                >
                  <option value="EFFORT">Esforço (Tempo, Questões, Assuntos, Revisões)</option>
                  <option value="RESULT">Resultado (Taxa de Acerto %)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Métrica</label>
                <select
                  value={formMetric}
                  onChange={(e) => setFormMetric(e.target.value as GoalMetricDTO)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                >
                  {formKind === 'EFFORT' ? (
                    <>
                      <option value="EFFECTIVE_MINUTES">Minutos efetivos</option>
                      <option value="QUESTIONS">Questões resolvidas</option>
                      <option value="TOPICS_COMPLETED">Assuntos estudados</option>
                      <option value="REVIEWS">Revisões concluídas</option>
                    </>
                  ) : (
                    <option value="ACCURACY">Taxa de acerto (%)</option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Valor Alvo</label>
                <input
                  type="number"
                  min={1}
                  max={formMetric === 'ACCURACY' ? 100 : undefined}
                  step={formMetric === 'ACCURACY' ? '0.1' : '1'}
                  value={formTargetValue}
                  onChange={(e) => setFormTargetValue(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Matéria (opcional)
                </label>
                <select
                  value={formSubjectId}
                  onChange={(e) => {
                    setFormSubjectId(e.target.value);
                    setFormTopicId('');
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                >
                  <option value="">Todas as matérias (Geral)</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Assunto (opcional)
                </label>
                <select
                  value={formTopicId}
                  onChange={(e) => setFormTopicId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                >
                  <option value="">Todos os assuntos</option>
                  {filteredTopics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  Salvar Meta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
