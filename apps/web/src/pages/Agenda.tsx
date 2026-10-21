import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Calendar as CalendarIcon,
  Plus,
  RefreshCw,
  AlertCircle,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from '../contexts/RouterContext';
import { api, ApiError } from '../lib/api';
import { startStudySession } from '../lib/study-session-api';
import { utcToLocalDate, addDaysToLocalDate } from '@estudos/domain';
import { AgendaHeader } from '../components/agenda/AgendaHeader';
import { AgendaSummaryCards } from '../components/agenda/AgendaSummaryCards';
import { PlannedSessionCard } from '../components/agenda/PlannedSessionCard';
import { PlannedSessionModal } from '../components/agenda/PlannedSessionModal';

const DIAS_CURTOS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

export function Agenda() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { navigate } = useRouter();
  const timezone = user?.timezone || 'America/Sao_Paulo';

  // "Hoje" no fuso do usuário
  const todayLocalDate = useMemo(() => {
    return utcToLocalDate(new Date(), timezone);
  }, [timezone]);

  const [view, setView] = useState<'day' | 'week'>('week');
  const [currentDate, setCurrentDate] = useState<string>(todayLocalDate);

  // Modal State
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    mode: 'create' | 'edit' | 'reschedule';
    session?: any | null;
  }>({
    isOpen: false,
    mode: 'create',
    session: null,
  });

  // Modal de confirmação para ações destrutivas (Pular / Excluir)
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    confirmColor?: string;
    onConfirm: () => void;
  } | null>(null);

  // Modal de conflito (sessão ativa ou avaliação pendente)
  const [conflictDialog, setConflictDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    actionLabel?: string;
    onAction?: () => void;
  } | null>(null);

  const [errorBanner, setErrorBanner] = useState<string>('');

  // 1. Busca de sessões planejadas da API
  const {
    data: agendaData,
    isLoading: loadingSessions,
    isError: errorSessions,
    refetch: refetchSessions,
  } = useQuery<any>({
    queryKey: ['planned-sessions', view, currentDate],
    queryFn: () =>
      api.get(`/api/planned-sessions?view=${view}&date=${currentDate}`),
  });

  // 2. Busca de matérias e tópicos para os seletores
  const { data: subjects = [] } = useQuery<any[]>({
    queryKey: ['subjects', 'all'],
    queryFn: () => api.get('/api/subjects?include_archived=true'),
  });

  const { data: topics = [] } = useQuery<any[]>({
    queryKey: ['topics', 'all'],
    queryFn: () => api.get('/api/topics?include_archived=true'),
  });

  // Mutações
  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/api/planned-sessions', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planned-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      queryClient.invalidateQueries({ queryKey: ['statistics'] });
      setErrorBanner('');
    },
    onError: (err: ApiError) => setErrorBanner(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.patch(`/api/planned-sessions/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planned-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      queryClient.invalidateQueries({ queryKey: ['statistics'] });
      setErrorBanner('');
    },
    onError: (err: ApiError) => setErrorBanner(err.message),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'SKIPPED' }) =>
      api.patch(`/api/planned-sessions/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planned-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      queryClient.invalidateQueries({ queryKey: ['statistics'] });
      setErrorBanner('');
    },
    onError: (err: ApiError) => setErrorBanner(err.message),
  });

  const rescheduleMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.post(`/api/planned-sessions/${id}/reschedule`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planned-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      queryClient.invalidateQueries({ queryKey: ['statistics'] });
      setErrorBanner('');
    },
    onError: (err: ApiError) => setErrorBanner(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/planned-sessions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planned-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      queryClient.invalidateQueries({ queryKey: ['statistics'] });
      setErrorBanner('');
    },
    onError: (err: ApiError) => setErrorBanner(err.message),
  });

  const startStudyMutation = useMutation({
    mutationFn: (plannedSessionId: string) =>
      startStudySession({ planned_session_id: plannedSessionId }),
    onSuccess: () => {
      navigate('/timer');
    },
    onError: (err: ApiError) => {
      if (
        err.code === 'ACTIVE_SESSION_EXISTS' ||
        err.code === 'PENDING_EVALUATION_EXISTS'
      ) {
        setConflictDialog({
          isOpen: true,
          title: 'Sessão em Andamento ou Pendente',
          message: err.message,
          actionLabel: 'Ir para o Cronômetro',
          onAction: () => {
            setConflictDialog(null);
            navigate('/timer');
          },
        });
      } else if (err.code === 'PLANNED_SESSION_NOT_AVAILABLE') {
        setErrorBanner(err.message);
        queryClient.invalidateQueries({ queryKey: ['planned-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      queryClient.invalidateQueries({ queryKey: ['statistics'] });
      } else {
        setErrorBanner(err.message);
      }
    },
  });

  const handleStartStudy = (session: any) => {
    startStudyMutation.mutate(session.id);
  };

  // Navegação Temporal
  const handleNavigate = (step: -1 | 1 | 0) => {
    if (step === 0) {
      setCurrentDate(todayLocalDate);
    } else {
      const daysToAdd = view === 'day' ? step * 1 : step * 7;
      setCurrentDate((prev) => addDaysToLocalDate(prev, daysToAdd));
    }
  };

  const rawSessionsList: any[] = agendaData?.sessions || [];
  const sessions = useMemo(() => {
    return rawSessionsList.filter((s) => s.status !== 'RESCHEDULED');
  }, [rawSessionsList]);
  const overlappingIds: string[] = agendaData?.overlapping_ids || [];
  const summary = agendaData?.summary || {
    totalPlannedMinutes: 0,
    plannedCount: 0,
    doneCount: 0,
    activeAndDoneCount: 0,
    minutesByKind: { REVIEW: 0, NEW_CONTENT: 0, PRACTICE: 0 },
  };

  // Submissão do modal (criação, edição ou remarcação)
  const handleModalSubmit = async (payload: any) => {
    if (modalState.mode === 'create') {
      await createMutation.mutateAsync(payload);
    } else if (modalState.mode === 'edit' && modalState.session) {
      await updateMutation.mutateAsync({ id: modalState.session.id, data: payload });
    } else if (modalState.mode === 'reschedule' && modalState.session) {
      await rescheduleMutation.mutateAsync({
        id: modalState.session.id,
        data: payload,
      });
    }
  };

  // Ações rápidas dos cards
  const handleEdit = (session: any) => {
    setModalState({ isOpen: true, mode: 'edit', session });
  };

  const handleReschedule = (session: any) => {
    setModalState({ isOpen: true, mode: 'reschedule', session });
  };

  const handleSkip = (session: any) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Pular Sessão de Estudo?',
      message: `Tem certeza que deseja marcar a sessão "${session.topic.name}" como PULADA (SKIPPED)?`,
      confirmLabel: 'Sim, Pular Sessão',
      confirmColor: 'bg-amber-600 hover:bg-amber-700',
      onConfirm: async () => {
        setConfirmDialog(null);
        await statusMutation.mutateAsync({ id: session.id, status: 'SKIPPED' });
      },
    });
  };

  const handleDelete = (session: any) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Excluir Sessão Planejada?',
      message: `Tem certeza que deseja remover o agendamento de "${session.topic.name}"? Esta ação é definitiva.`,
      confirmLabel: 'Excluir Permanentemente',
      confirmColor: 'bg-red-600 hover:bg-red-700',
      onConfirm: async () => {
        setConfirmDialog(null);
        await deleteMutation.mutateAsync(session.id);
      },
    });
  };

  // Agrupamento de sessões por dia na visão semanal
  const weekDays: string[] = agendaData?.days || [];
  const sessionsByDay = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const s of sessions) {
      const list = map.get(s.local_date) || [];
      list.push(s);
      map.set(s.local_date, list);
    }
    return map;
  }, [sessions]);

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Agenda */}
      <AgendaHeader
        view={view}
        currentDate={currentDate}
        timezone={timezone}
        onViewChange={(newView) => setView(newView)}
        onNavigate={handleNavigate}
        onNewSession={() =>
          setModalState({ isOpen: true, mode: 'create', session: null })
        }
      />

      {/* Banner de Erro Global */}
      {errorBanner && (
        <div className="flex items-center justify-between rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span>{errorBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorBanner('')}
            className="text-xs font-semibold text-red-800 hover:underline"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Cards de Métricas Consolidadas */}
      <AgendaSummaryCards summary={summary} loading={loadingSessions} />

      {/* Conteúdo Principal: Estado de Carregamento, Erro ou Grade */}
      {loadingSessions ? (
        <div className="flex flex-col items-center justify-center p-16 rounded-2xl border border-slate-200 bg-white">
          <RefreshCw className="h-8 w-8 text-blue-600 animate-spin mb-3" />
          <p className="text-sm font-medium text-slate-600">
            Carregando agenda de estudos...
          </p>
        </div>
      ) : errorSessions ? (
        <div className="flex flex-col items-center justify-center p-16 rounded-2xl border border-red-200 bg-red-50 text-center">
          <AlertCircle className="h-10 w-10 text-red-600 mb-3" />
          <h3 className="text-base font-bold text-red-900 mb-1">
            Não foi possível carregar a agenda
          </h3>
          <p className="text-sm text-red-700 mb-4 max-w-md">
            Ocorreu uma falha ao conectar com o servidor. Verifique sua conexão e tente novamente.
          </p>
          <button
            type="button"
            onClick={() => refetchSessions()}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition"
          >
            Tentar Novamente
          </button>
        </div>
      ) : view === 'day' ? (
        /* ================= VISÃO DIÁRIA ================= */
        <div className="space-y-4">
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 rounded-2xl border border-dashed border-slate-300 bg-white text-center">
              <CalendarIcon className="h-12 w-12 text-slate-300 mb-3" />
              <h3 className="text-base font-bold text-slate-800 mb-1">
                Nenhum estudo planejado para este dia
              </h3>
              <p className="text-sm text-slate-500 mb-4 max-w-sm">
                Organize seu tempo e defina suas sessões para manter a constância e o foco.
              </p>
              <button
                type="button"
                onClick={() =>
                  setModalState({ isOpen: true, mode: 'create', session: null })
                }
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition"
              >
                <Plus className="h-4 w-4" />
                Agendar Primeiro Estudo
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sessions.map((session) => (
                <PlannedSessionCard
                  key={session.id}
                  session={session}
                  isOverlapping={overlappingIds.includes(session.id)}
                  onStartStudy={handleStartStudy}
                  onEdit={handleEdit}
                  onReschedule={handleReschedule}
                  onSkip={handleSkip}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ================= VISÃO SEMANAL (Seg a Dom) ================= */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          {weekDays.map((dayStr, index) => {
            const daySessions = sessionsByDay.get(dayStr) || [];
            const isToday = dayStr === todayLocalDate;
            const [, m, d] = dayStr.split('-').map(Number);

            return (
              <div
                key={dayStr}
                className={`flex flex-col rounded-2xl border p-3 min-h-[350px] min-w-0 overflow-hidden transition ${
                  isToday
                    ? 'border-blue-400 bg-blue-50/20 ring-1 ring-blue-300'
                    : 'border-slate-200 bg-slate-50/50'
                }`}
              >
                {/* Cabeçalho da Coluna do Dia */}
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200">
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                      {DIAS_CURTOS[index]}
                    </span>
                    <span
                      className={`text-sm font-black ${
                        isToday ? 'text-blue-600' : 'text-slate-800'
                      }`}
                    >
                      {d}/{m}
                    </span>
                  </div>

                  {isToday && (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                      Hoje
                    </span>
                  )}
                </div>

                {/* Lista de Sessões do Dia */}
                <div className="flex-1 space-y-2.5 overflow-y-auto">
                  {daySessions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full py-8 text-center text-slate-400">
                      <Clock className="h-5 w-5 mb-1 opacity-40" />
                      <span className="text-xs">Livre</span>
                    </div>
                  ) : (
                    daySessions.map((session) => (
                      <PlannedSessionCard
                        key={session.id}
                        session={session}
                        isOverlapping={overlappingIds.includes(session.id)}
                        onStartStudy={handleStartStudy}
                        onEdit={handleEdit}
                        onReschedule={handleReschedule}
                        onSkip={handleSkip}
                        onDelete={handleDelete}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Agendamento, Edição e Remarcação */}
      <PlannedSessionModal
        isOpen={modalState.isOpen}
        mode={modalState.mode}
        initialSession={modalState.session}
        subjects={subjects}
        topics={topics}
        userTimezone={timezone}
        defaultDate={currentDate}
        onClose={() =>
          setModalState({ isOpen: false, mode: 'create', session: null })
        }
        onSubmit={handleModalSubmit}
      />

      {/* Modal de Confirmação para Ações Destrutivas */}
      {confirmDialog && confirmDialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              {confirmDialog.title}
            </h3>
            <p className="text-sm text-slate-600 mb-6">{confirmDialog.message}</p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDialog.onConfirm}
                className={`rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition ${
                  confirmDialog.confirmColor || 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Conflito de Sessão Ativa / Avaliação Pendente */}
      {conflictDialog && conflictDialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              {conflictDialog.title}
            </h3>
            <p className="text-sm text-slate-600 mb-6">{conflictDialog.message}</p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConflictDialog(null)}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition"
              >
                Fechar
              </button>
              {conflictDialog.actionLabel && conflictDialog.onAction && (
                <button
                  type="button"
                  onClick={conflictDialog.onAction}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition"
                >
                  {conflictDialog.actionLabel}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
