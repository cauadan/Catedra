import { ApiErrorDetail, ApiErrorEnvelope } from '../types/auth';

/**
 * Classe customizada de erro de API para capturar o envelope padronizado em português.
 */
export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: ApiErrorDetail[];

  constructor(
    message: string,
    status: number,
    code: string = 'API_ERROR',
    details?: ApiErrorDetail[]
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const AUTH_UNAUTHORIZED_EVENT = 'auth:unauthorized';

function handleGlobalUnauthorized(url: string): void {
  if (typeof window === 'undefined') return;

  // Ignora falhas de credenciais nas próprias rotas públicas de login/cadastro
  if (url.includes('/auth/login') || url.includes('/auth/register')) {
    return;
  }

  try {
    window.localStorage?.removeItem('user');
    window.sessionStorage?.removeItem('user');
  } catch {
    // Ignora bloqueios de storage do navegador
  }

  window.dispatchEvent(new CustomEvent(AUTH_UNAUTHORIZED_EVENT));

  const currentPath = window.location.hash.startsWith('#/')
    ? window.location.hash.slice(1)
    : window.location.pathname || '/';

  if (currentPath !== '/login' && currentPath !== '/register') {
    window.history.replaceState(null, '', '/login');
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
}

/**
 * Monta a URL completa tratando se a VITE_API_URL termina com ou sem /api
 */
function resolveUrl(endpoint: string): string {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const baseUrl = ((import.meta as any).env?.VITE_API_URL || '').trim().replace(/\/+$/, '');

  if (!baseUrl) {
    return cleanEndpoint.startsWith('/api/') || cleanEndpoint === '/api'
      ? cleanEndpoint
      : `/api${cleanEndpoint}`;
  }

  if (baseUrl.endsWith('/api')) {
    const route = cleanEndpoint.startsWith('/api/')
      ? cleanEndpoint.slice(4)
      : cleanEndpoint === '/api'
      ? ''
      : cleanEndpoint;
    return `${baseUrl}${route.startsWith('/') ? route : `/${route}`}`;
  }

  const route = cleanEndpoint.startsWith('/api/') || cleanEndpoint === '/api'
    ? cleanEndpoint
    : `/api${cleanEndpoint}`;

  return `${baseUrl}${route}`;
}

/**
 * Cliente HTTP base para comunicação com o backend (apps/api).
 * Envia credenciais httpOnly e intercepta 401 Unauthorized.
 */
export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = resolveUrl(endpoint);

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
      const data = (await response.json()) as ApiErrorEnvelope & { error?: any };
      if (typeof data?.error === 'string') {
        errorMessage = data.error;
        errorCode = response.status === 401 ? 'UNAUTHORIZED' : errorCode;
      } else if (data?.error) {
        errorMessage = data.error.message || errorMessage;
        errorCode = data.error.code || errorCode;
        errorDetails = data.error.details;
      }
    } catch {
      if (response.status === 401) {
        errorMessage = 'Sessão expirada ou não autorizado.';
        errorCode = 'UNAUTHORIZED';
      } else if (response.status === 404) {
        errorMessage = 'Recurso não encontrado.';
      } else if (response.status >= 500) {
        errorMessage = 'Erro interno do servidor. Tente novamente mais tarde.';
      }
    }

    if (response.status === 401) {
      handleGlobalUnauthorized(url);
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