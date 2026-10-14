// HTTP API Client for Opaque-box E2E testing
// Supports session cookie persistence, multi-user isolation, and domain helpers

export interface ApiResponse<T = any> {
  status: number;
  statusText: string;
  headers: Headers;
  data: T;
  rawText: string;
  cookies: Record<string, string>;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  queryParams?: Record<string, string | number | boolean | undefined>;
}

export interface UserRegistration {
  name: string;
  email: string;
  password: string;
  timezone?: string;
}

export interface UserLogin {
  email: string;
  password: string;
}

export interface UserResponse {
  id: string;
  name: string;
  email: string;
  timezone: string;
  week_starts_on: string;
}

export interface SubjectPayload {
  name: string;
  color: string;
}

export interface SubjectUpdatePayload {
  name?: string;
  color?: string;
  archived?: boolean;
}

export interface SubjectResponse {
  id: string;
  user_id?: string;
  name: string;
  color: string;
  archived: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface TopicPayload {
  subject_id: string;
  name: string;
  parent_id?: string | null;
}

export interface TopicUpdatePayload {
  name?: string;
  subject_id?: string;
  parent_id?: string | null;
  archived?: boolean;
}

export interface TopicResponse {
  id: string;
  user_id?: string;
  subject_id: string;
  parent_id: string | null;
  name: string;
  archived: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Array<{ field?: string; message: string }>;
  };
}

export class ApiClient {
  public baseUrl: string;
  private cookies: Map<string, string> = new Map();

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || process.env.API_URL || 'http://localhost:3001';
    // Remove trailing slash if present
    if (this.baseUrl.endsWith('/')) {
      this.baseUrl = this.baseUrl.slice(0, -1);
    }
  }

  /**
   * Set a cookie manually
   */
  public setCookie(name: string, value: string): void {
    this.cookies.set(name, value);
  }

  /**
   * Get value of a cookie
   */
  public getCookie(name: string): string | undefined {
    return this.cookies.get(name);
  }

  /**
   * Get all cookies as an object
   */
  public getCookies(): Record<string, string> {
    const obj: Record<string, string> = {};
    for (const [key, val] of this.cookies.entries()) {
      obj[key] = val;
    }
    return obj;
  }

  /**
   * Clear all stored cookies
   */
  public clearCookies(): void {
    this.cookies.clear();
  }

  /**
   * Parse Set-Cookie headers and update cookie store
   */
  private processResponseCookies(headers: Headers): void {
    // Node fetch might have getSetCookie() or 'set-cookie' header
    let cookieHeaders: string[] = [];
    if (typeof (headers as any).getSetCookie === 'function') {
      cookieHeaders = (headers as any).getSetCookie();
    } else {
      const singleHeader = headers.get('set-cookie');
      if (singleHeader) {
        cookieHeaders = [singleHeader];
      }
    }

    for (const header of cookieHeaders) {
      // Form: name=value; Path=/; HttpOnly...
      const parts = header.split(';');
      const firstPart = parts[0]?.trim();
      if (firstPart) {
        const eqIdx = firstPart.indexOf('=');
        if (eqIdx > 0) {
          const key = firstPart.substring(0, eqIdx).trim();
          const val = firstPart.substring(eqIdx + 1).trim();
          this.cookies.set(key, val);
        }
      }
    }
  }

  /**
   * Build Cookie header string from stored cookies
   */
  private buildCookieHeader(): string {
    const pairs: string[] = [];
    for (const [key, val] of this.cookies.entries()) {
      pairs.push(`${key}=${val}`);
    }
    return pairs.join('; ');
  }

  /**
   * Generic HTTP request
   */
  public async request<T = any>(path: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    const { method = 'GET', headers = {}, body, queryParams } = options;

    let urlStr = path.startsWith('http') ? path : `${this.baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;

    if (queryParams) {
      const url = new URL(urlStr);
      for (const [key, val] of Object.entries(queryParams)) {
        if (val !== undefined && val !== null) {
          url.searchParams.set(key, String(val));
        }
      }
      urlStr = url.toString();
    }

    const reqHeaders: Record<string, string> = { ...headers };

    // Attach stored cookies
    const cookieHeader = this.buildCookieHeader();
    if (cookieHeader) {
      reqHeaders['Cookie'] = cookieHeader;
    }

    let requestBody: string | undefined = undefined;
    if (body !== undefined && body !== null) {
      if (typeof body === 'object') {
        reqHeaders['Content-Type'] = 'application/json';
        requestBody = JSON.stringify(body);
      } else {
        requestBody = String(body);
      }
    }

    let response: Response;
    try {
      response = await fetch(urlStr, {
        method,
        headers: reqHeaders,
        body: requestBody,
      });
    } catch (err: any) {
      throw new Error(`Failed to connect to ${urlStr}: ${err?.message || err}`);
    }

    this.processResponseCookies(response.headers);

    const rawText = await response.text();
    let data: any = null;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json') && rawText) {
      try {
        data = JSON.parse(rawText);
      } catch {
        data = rawText;
      }
    } else {
      data = rawText;
    }

    return {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data: data as T,
      rawText,
      cookies: this.getCookies(),
    };
  }

  public async get<T = any>(path: string, queryParams?: Record<string, any>, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>(path, { method: 'GET', queryParams, headers });
  }

  public async post<T = any>(path: string, body?: any, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>(path, { method: 'POST', body, headers });
  }

  public async patch<T = any>(path: string, body?: any, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>(path, { method: 'PATCH', body, headers });
  }

  public async put<T = any>(path: string, body?: any, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>(path, { method: 'PUT', body, headers });
  }

  public async delete<T = any>(path: string, body?: any, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>(path, { method: 'DELETE', body, headers });
  }

  // --- Auth Domain Helpers ---

  public async register(user: UserRegistration): Promise<ApiResponse<{ user: UserResponse }>> {
    return this.post('/api/auth/register', user);
  }

  public async login(creds: UserLogin): Promise<ApiResponse<{ user: UserResponse }>> {
    return this.post('/api/auth/login', creds);
  }

  public async logout(): Promise<ApiResponse<{ success: boolean }>> {
    return this.post('/api/auth/logout');
  }

  public async me(): Promise<ApiResponse<{ user: UserResponse }>> {
    return this.get('/api/auth/me');
  }

  // --- Subjects Domain Helpers ---

  public async getSubjects(params?: { include_archived?: boolean }): Promise<ApiResponse<SubjectResponse[]>> {
    return this.get('/api/subjects', params);
  }

  public async createSubject(body: SubjectPayload): Promise<ApiResponse<SubjectResponse>> {
    return this.post('/api/subjects', body);
  }

  public async updateSubject(id: string, body: SubjectUpdatePayload): Promise<ApiResponse<SubjectResponse>> {
    return this.patch(`/api/subjects/${id}`, body);
  }

  public async deleteSubject(id: string): Promise<ApiResponse<void>> {
    return this.delete(`/api/subjects/${id}`);
  }

  // --- Topics Domain Helpers ---

  public async getTopics(params?: { subject_id?: string; include_archived?: boolean }): Promise<ApiResponse<TopicResponse[]>> {
    return this.get('/api/topics', params);
  }

  public async createTopic(body: TopicPayload): Promise<ApiResponse<TopicResponse>> {
    return this.post('/api/topics', body);
  }

  public async updateTopic(id: string, body: TopicUpdatePayload): Promise<ApiResponse<TopicResponse>> {
    return this.patch(`/api/topics/${id}`, body);
  }

  public async deleteTopic(id: string): Promise<ApiResponse<void>> {
    return this.delete(`/api/topics/${id}`);
  }

  /**
   * Check if API server is accessible
   */
  public async isHealthy(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/auth/me`, { method: 'GET' });
      // If we get 401 or 200, the server is running and responding!
      return res.status === 401 || res.status === 200;
    } catch {
      return false;
    }
  }
}
