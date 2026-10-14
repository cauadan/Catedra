import { ApiErrorDetail, ApiErrorEnvelope } from '../types/auth';

/**
 * Classe customizada de erro de API para capturar o envelope padronizado em português.
 */
export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: ApiErrorDetail[];

  constructor(message: string, status: number, code: string = 'API_ERROR', details?: ApiErrorDetail[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * Cliente HTTP base para comunicação com o backend (apps/api).
 * Garante envio e recepção de cookies httpOnly via credentials: 'include'.
 */
export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  const headers = new Headers(options.headers || {});
  if (options.body && typeof options.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    let errorMessage = 'Ocorreu um erro na requisição.';
    let errorCode = 'REQUEST_ERROR';
    let errorDetails: ApiErrorDetail[] | undefined;

    try {
      const data = (await response.json()) as ApiErrorEnvelope;
      if (data?.error) {
        errorMessage = data.error.message || errorMessage;
        errorCode = data.error.code || errorCode;
        errorDetails = data.error.details;
      }
    } catch {
      if (response.status === 401) {
        errorMessage = 'Sessão expirada ou não autorizado.';
      } else if (response.status === 404) {
        errorMessage = 'Recurso não encontrado.';
      } else if (response.status >= 500) {
        errorMessage = 'Erro interno do servidor. Tente novamente mais tarde.';
      }
    }

    throw new ApiError(errorMessage, response.status, errorCode, errorDetails);
  }

  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return undefined as unknown as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  get: <T>(url: string, options?: RequestInit) =>
    apiFetch<T>(url, { ...options, method: 'GET' }),

  post: <T>(url: string, body?: unknown, options?: RequestInit) =>
    apiFetch<T>(url, {
      ...options,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(url: string, body?: unknown, options?: RequestInit) =>
    apiFetch<T>(url, {
      ...options,
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(url: string, options?: RequestInit) =>
    apiFetch<T>(url, { ...options, method: 'DELETE' }),
};
