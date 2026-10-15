import { api } from './api';
import type {
  SessionEventTypeDTO,
  SessionEventDTO,
  BlockKindDTO,
  StudySessionStatusDTO,
  UnderstandingLevelDTO,
  FocusLevelDTO,
  DifficultyLevelDTO,
} from '@estudos/domain';

export interface ApiSessionBlock {
  id: string;
  study_session_id: string;
  kind: BlockKindDTO;
  planned_minutes: number;
  position: number;
  created_at: string;
}

export interface ApiSessionEvent {
  id: string;
  study_session_id?: string;
  block_id: string | null;
  type: SessionEventTypeDTO;
  occurred_at: string;
  declared_seconds?: number | null;
  created_at?: string;
  payload?: any;
}

export interface ApiSessionEvaluation {
  id: string;
  study_session_id: string;
  understanding: UnderstandingLevelDTO;
  focus: FocusLevelDTO;
  difficulty: DifficultyLevelDTO;
  notes: string | null;
  created_at: string;
}

export interface ApiPracticeRecord {
  id: string;
  user_id: string;
  topic_id: string;
  block_id: string | null;
  study_session_id: string | null;
  questions: number;
  correct: number;
  accuracy: number | null;
  created_at: string;
  topic?: {
    id: string;
    name: string;
  };
}

export interface StudySessionView {
  id: string;
  user_id: string;
  topic_id: string | null;
  planned_session_id: string | null;
  started_at: string;
  finished_at: string | null;
  status: StudySessionStatusDTO;
  created_at: string;
  updated_at: string;
  topic?: {
    id: string;
    name: string;
    subject: {
      id: string;
      name: string;
      color: string;
    };
  } | null;
  planned_session?: any | null;
  session_blocks: ApiSessionBlock[];
  session_events: ApiSessionEvent[];
  evaluation?: ApiSessionEvaluation | null;
  practice_records?: ApiPracticeRecord[];
}

export interface StartStudySessionPayload {
  planned_session_id?: string;
  topic_id?: string;
  blocks?: Array<{
    kind: BlockKindDTO;
    planned_minutes: number;
  }>;
}

export interface SubmitEvaluationPayload {
  understanding: UnderstandingLevelDTO;
  focus: FocusLevelDTO;
  difficulty: DifficultyLevelDTO;
  notes?: string;
  practice_records?: Array<{
    topic_id: string;
    block_id?: string;
    questions: number;
    correct: number;
  }>;
}

export async function fetchActiveSession(): Promise<{
  data: StudySessionView | null;
  server_now: string;
}> {
  return api.get<{ data: StudySessionView | null; server_now: string }>(
    '/api/study-sessions/active'
  );
}

export async function fetchPendingEvaluation(): Promise<{
  data: StudySessionView | null;
}> {
  return api.get<{ data: StudySessionView | null }>(
    '/api/study-sessions/pending-evaluation'
  );
}

export async function startStudySession(
  body: StartStudySessionPayload
): Promise<{ data: StudySessionView }> {
  return api.post<{ data: StudySessionView }>('/api/study-sessions', body);
}

export async function postSessionEvent(
  id: string,
  type: 'PAUSE' | 'RESUME' | 'DISTRACTION_START' | 'DISTRACTION_END'
): Promise<{ data: StudySessionView }> {
  return api.post<{ data: StudySessionView }>(`/api/study-sessions/${id}/events`, {
    type,
  });
}

export async function finishBlock(
  id: string,
  blockId: string,
  declared_minutes?: number
): Promise<{ data: StudySessionView }> {
  return api.post<{ data: StudySessionView }>(
    `/api/study-sessions/${id}/blocks/${blockId}/finish`,
    { declared_minutes }
  );
}

export async function finishSession(
  id: string,
  declared_minutes?: number
): Promise<{ data: StudySessionView }> {
  return api.post<{ data: StudySessionView }>(
    `/api/study-sessions/${id}/finish`,
    { declared_minutes }
  );
}

export async function cancelSession(id: string): Promise<{ data: StudySessionView }> {
  return api.post<{ data: StudySessionView }>(`/api/study-sessions/${id}/cancel`);
}

export async function updateSessionBlocks(
  id: string,
  blocks: Array<{ id: string; planned_minutes: number }>
): Promise<{ data: StudySessionView }> {
  return api.patch<{ data: StudySessionView }>(
    `/api/study-sessions/${id}/blocks`,
    { blocks }
  );
}

export async function submitEvaluation(
  id: string,
  body: SubmitEvaluationPayload
): Promise<{ data: StudySessionView }> {
  return api.post<{ data: StudySessionView }>(
    `/api/study-sessions/${id}/evaluation`,
    body
  );
}

/**
 * Calcula o deslocamento (offset em milissegundos) entre o relógio do servidor e o do navegador:
 * offset = server_now - client_now
 */
export function computeClockOffsetMs(
  serverNowIso: string,
  clientNowMs: number
): number {
  return new Date(serverNowIso).getTime() - clientNowMs;
}

/**
 * Converte eventos da API (com occurred_at ou created_at ISO string) para o formato puro de DTOs do domínio (Date).
 */
export function toDomainEvents(events: ApiSessionEvent[]): SessionEventDTO[] {
  return events.map((event) => {
    const rawDate = event.occurred_at || event.created_at;
    const dateObj = rawDate ? new Date(rawDate) : new Date();
    const validDate = isNaN(dateObj.getTime()) ? new Date() : dateObj;
    return {
      type: event.type,
      block_id: event.block_id,
      occurred_at: validDate,
      declared_seconds: event.declared_seconds ?? event.payload?.declared_seconds ?? null,
    };
  });
}
