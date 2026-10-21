export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'DOMAIN_RULE_VIOLATION'
  | 'INTERNAL_ERROR'
  | 'BAD_REQUEST'
  | 'ACTIVE_SESSION_EXISTS'
  | 'PENDING_EVALUATION_EXISTS'
  | 'PLANNED_SESSION_NOT_AVAILABLE'
  | 'SESSION_NOT_IN_PROGRESS'
  | 'INVALID_TRANSITION'
  | 'BLOCK_NOT_ACTIVE'
  | 'LAST_BLOCK'
  | 'SESSION_NOT_FINISHED'
  | 'EVALUATION_ALREADY_EXISTS'
  | 'DECLARED_DISTRACTION_EXCEEDED'
  | 'TOPIC_ARCHIVED'
  | 'GOAL_ALREADY_EXISTS'
  | 'ARCHIVED_SCOPE'
  | 'UNPROCESSABLE_ENTITY';

export interface ApiErrorDetail {
  field?: string;
  message: string;
}

export interface ApiErrorEnvelope {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: ApiErrorDetail[];
  };
}

/**
 * Formata um envelope de erro padronizado em português conforme especificado no PROJECT.md.
 */
export function formatErrorResponse(
  code: ApiErrorCode,
  message: string,
  details?: ApiErrorDetail[]
): ApiErrorEnvelope {
  const envelope: ApiErrorEnvelope = {
    error: {
      code,
      message,
    },
  };

  if (details && details.length > 0) {
    envelope.error.details = details;
  }

  return envelope;
}
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: ApiErrorCode | 'BAD_REQUEST',
    message: string,
    public readonly details?: ApiErrorDetail[]
  ) {
    super(message);
    this.name = 'AppError';
  }
}
