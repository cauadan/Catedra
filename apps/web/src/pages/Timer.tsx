import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { useRouter } from '../contexts/RouterContext';
import { api, ApiError } from '../lib/api';
import {
  fetchActiveSession,
  fetchPendingEvaluation,
  startStudySession,
  postSessionEvent,
  finishBlock,
  finishSession,
  cancelSession,
  submitEvaluation,
  computeClockOffsetMs,
  type StudySessionView,
  type StartStudySessionPayload,
  type SubmitEvaluationPayload,
} from '../lib/study-session-api';
import { useStudyClock } from '../hooks/useStudyClock';
import { TimerDisplay } from '../components/timer/TimerDisplay';
import { FinishStepDialog } from '../components/timer/FinishStepDialog';
import { PendingEvaluationBanner } from '../components/timer/PendingEvaluationBanner';
import { AdHocSessionForm } from '../components/timer/AdHocSessionForm';
import { SessionEvaluationModal } from '../components/evaluation/SessionEvaluationModal';
import { findActiveBlock, type SessionBlockDTO } from '@estudos/domain';
import { toDomainEvents } from '../lib/study-session-api';

export function Timer() {
  const queryClient = useQueryClient();
  const { navigate } = useRouter();

  const [clockOffsetMs, setClockOffsetMs] = useState<number>(0);
  const synchronizedClock = useStudyClock(clockOffsetMs);

  const [finishDialog, setFinishDialog] = useState<{
    isOpen: boolean;
    mode: 'advance' | 'finish';
    errorMessage?: string;
  }>({
    isOpen: false,
    mode: 'advance',
  });

  const [evaluationModalOpen, setEvaluationModalOpen] = useState<boolean>(false);
  const [evaluatingSession, setEvaluatingSession] = useState<StudySessionView | null>(null);

  // 1. Consulta da Sessão Ativa
  const {
    data: activeData,
    isLoading: loadingActive,
    refetch: refetchActive,
  } = useQuery({
    queryKey: ['study-session', 'active'],
    queryFn: fetchActiveSession,
    refetchInterval: 10000,
  });

  // Atualização do offset de sincronização do relógio com o servidor
  useEffect(() => {
    if (activeData?.server_now) {
      const offset = computeClockOffsetMs(activeData.server_now, Date.now());
      setClockOffsetMs(offset);
    }
  }, [activeData?.server_now]);

  // 2. Consulta de Avaliação Pendente
  const {
    data: pendingData,
    isLoading: loadingPending,
    refetch: refetchPending,
  } = useQuery({
    queryKey: ['study-session', 'pending-evaluation'],
    queryFn: fetchPendingEvaluation,
  });

  // 3. Matérias e Assuntos para o formulário avulso e modal de avaliação
  const { data: subjects = [] } = useQuery<any[]>({
    queryKey: ['subjects', 'all'],
    queryFn: () => api.get('/api/subjects?include_archived=true'),
  });

  const { data: topics = [] } = useQuery<any[]>({
    queryKey: ['topics', 'all'],
    queryFn: () => api.get('/api/topics?include_archived=true'),
  });

  const activeSession: StudySessionView | null = activeData?.data || null;
  const pendingSession: StudySessionView | null = pendingData?.data || null;

  // Invalidação centralizada de queries de sessão
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['study-session'] });
  };

  // Mutações de Eventos do Timer
  const eventMutation = useMutation({
    mutationFn: (type: 'PAUSE' | 'RESUME' | 'DISTRACTION_START' | 'DISTRACTION_END') => {
      if (!activeSession) throw new Error('Nenhuma sessão ativa.');
      return postSessionEvent(activeSession.id, type);
    },
    onSuccess: () => invalidateAll(),
    onError: (err: ApiError) => {
      if (err.status === 409) invalidateAll();
    },
  });

  // Mutação de Avançar Etapa
  const advanceMutation = useMutation({
    mutationFn: ({
      blockId,
      declaredMinutes,
    }: {
      blockId: string;
      declaredMinutes?: number;
    }) => {
      if (!activeSession) throw new Error('Nenhuma sessão ativa.');
      return finishBlock(activeSession.id, blockId, declaredMinutes);
    },
    onSuccess: () => {
      setFinishDialog({ isOpen: false, mode: 'advance' });
      invalidateAll();
    },
    onError: (err: ApiError) => {
      if (err.status === 409) {
        setFinishDialog({ isOpen: false, mode: 'advance' });
        invalidateAll();
      } else {
        setFinishDialog((prev) => ({ ...prev, errorMessage: err.message }));
      }
    },
  });

  // Mutação de Concluir Sessão
  const finishMutation = useMutation({
    mutationFn: (declaredMinutes?: number) => {
      if (!activeSession) throw new Error('Nenhuma sessão ativa.');
      return finishSession(activeSession.id, declaredMinutes);
    },
    onSuccess: (res) => {
      setFinishDialog({ isOpen: false, mode: 'finish' });
      invalidateAll();
      setEvaluatingSession(res.data);
      setEvaluationModalOpen(true);
    },
    onError: (err: ApiError) => {
      if (err.status === 409) {
        setFinishDialog({ isOpen: false, mode: 'finish' });
        invalidateAll();
      } else {
        setFinishDialog((prev) => ({ ...prev, errorMessage: err.message }));
      }
    },
  });

  // Mutação de Cancelar Sessão
  const cancelMutation = useMutation({
    mutationFn: () => {
      if (!activeSession) throw new Error('Nenhuma sessão ativa.');
      return cancelSession(activeSession.id);
    },
    onSuccess: () => invalidateAll(),
    onError: (err: ApiError) => {
      if (err.status === 409) invalidateAll();
    },
  });

  // Mutação de Criação Avulsa
  const createAdHocMutation = useMutation({
    mutationFn: (payload: StartStudySessionPayload) => startStudySession(payload),
    onSuccess: () => invalidateAll(),
    onError: (err: ApiError) => {
      if (err.status === 409) invalidateAll();
    },
  });

  // Mutação de Avaliação Pós-Sessão
  const evaluateMutation = useMutation({
    mutationFn: (payload: SubmitEvaluationPayload) => {
      const targetSession = evaluatingSession || pendingSession;
      if (!targetSession) throw new Error('Nenhuma sessão para avaliar.');
      return submitEvaluation(targetSession.id, payload);
    },
    onSuccess: () => invalidateAll(),
  });

  // Handlers dos botões do TimerDisplay
  const handleAdvanceStepClick = () => {
    setFinishDialog({ isOpen: true, mode: 'advance', errorMessage: undefined });
  };

  const handleFinishSessionClick = () => {
    setFinishDialog({ isOpen: true, mode: 'finish', errorMessage: undefined });
  };

  const handleConfirmFinishDialog = (declaredMinutes?: number) => {
    if (finishDialog.mode === 'advance') {
      if (!activeSession) return;
      const blocks: SessionBlockDTO[] = activeSession.session_blocks.map((b) => ({
        id: b.id,
        kind: b.kind,
        planned_minutes: b.planned_minutes,
        position: b.position,
      }));
      const events = toDomainEvents(activeSession.session_events);
      const activeBlock = findActiveBlock(blocks, events);
      if (activeBlock) {
        advanceMutation.mutate({ blockId: activeBlock.id, declaredMinutes });
      }
    } else {
      finishMutation.mutate(declaredMinutes);
    }
  };

  const handleCancelSessionClick = () => {
    if (
      window.confirm(
        'Tem certeza que deseja cancelar esta sessão de estudo? As métricas não serão computadas.'
      )
    ) {
      cancelMutation.mutate();
    }
  };

  const isPendingAny =
    eventMutation.isPending ||
    advanceMutation.isPending ||
    finishMutation.isPending ||
    cancelMutation.isPending ||
    createAdHocMutation.isPending;

  if (loadingActive || loadingPending) {
    return (
      <div className="flex flex-col items-center justify-center p-16 rounded-3xl border border-slate-200 bg-white">
        <RefreshCw className="h-8 w-8 text-blue-600 animate-spin mb-3" />
        <p className="text-sm font-medium text-slate-600">
          Carregando status do cronômetro de estudo...
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-8">
        {/* 1. Cenário: Sessão Ativa em Andamento */}
        {activeSession ? (
          <TimerDisplay
            session={activeSession}
            referenceNow={synchronizedClock}
            isPending={isPendingAny}
            onPause={() => eventMutation.mutate('PAUSE')}
            onResume={() => eventMutation.mutate('RESUME')}
            onDistractionStart={() => eventMutation.mutate('DISTRACTION_START')}
            onDistractionEnd={() => eventMutation.mutate('DISTRACTION_END')}
            onAdvanceStep={handleAdvanceStepClick}
            onFinishSession={handleFinishSessionClick}
            onCancelSession={handleCancelSessionClick}
          />
        ) : pendingSession ? (
          /* 2. Cenário: Nenhuma Sessão Ativa, mas Há Avaliação Pendente */
          <PendingEvaluationBanner
            onOpenEvaluation={() => {
              setEvaluatingSession(pendingSession);
              setEvaluationModalOpen(true);
            }}
          />
        ) : (
          /* 3. Cenário: Livre — Formulário de Estudo Avulso */
          <AdHocSessionForm
            subjects={subjects}
            topics={topics}
            isPending={createAdHocMutation.isPending}
            onSubmit={(payload) => createAdHocMutation.mutate(payload)}
          />
        )}
      </div>

      {/* Diálogo de Avanço de Etapa / Conclusão de Sessão com Distração Opcional */}
      <FinishStepDialog
        isOpen={finishDialog.isOpen}
        mode={finishDialog.mode}
        isPending={advanceMutation.isPending || finishMutation.isPending}
        errorMessage={finishDialog.errorMessage}
        onConfirm={handleConfirmFinishDialog}
        onCancel={() => setFinishDialog({ isOpen: false, mode: 'advance' })}
      />

      {/* Modal de Avaliação Pós-Sessão */}
      {(evaluatingSession || pendingSession) && (
        <SessionEvaluationModal
          isOpen={evaluationModalOpen}
          session={evaluatingSession || pendingSession!}
          topics={topics}
          isPending={evaluateMutation.isPending}
          onSubmit={async (payload) => {
            await evaluateMutation.mutateAsync(payload);
          }}
          onFinishedSuccess={() => {
            setEvaluationModalOpen(false);
            setEvaluatingSession(null);
            navigate('/agenda');
          }}
        />
      )}
    </>
  );
}
