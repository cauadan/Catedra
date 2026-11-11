import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import { User, LoginInput, RegisterInput, AuthContextType } from '../types/auth';
import { api, AUTH_UNAUTHORIZED_EVENT, setAuthToken } from '../lib/api';
import { detectBrowserTimezone } from '../lib/timezone';

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const authGenRef = useRef(0);

  const fetchCurrentUser = useCallback(async () => {
    const gen = ++authGenRef.current;
    try {
      const response = await api.get<{ user: User }>('/api/auth/me');
      if (gen === authGenRef.current) {
        setUser(response?.user ?? null);
      }
    } catch {
      if (gen === authGenRef.current) {
        setUser(null);
      }
    } finally {
      if (gen === authGenRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onUnauthorized = () => {
      authGenRef.current++;
      setUser(null);
      setIsLoading(false);
    };
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, onUnauthorized);
    return () => {
      window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, onUnauthorized);
    };
  }, []);

  const login = useCallback(async (credentials: LoginInput): Promise<User> => {
    authGenRef.current++;
    const response = await api.post<{ user: User; token?: string }>('/api/auth/login', credentials);
    if (response.token) {
      setAuthToken(response.token);
    }
    setUser(response.user);
    setIsLoading(false);
    return response.user;
  }, []);

  const register = useCallback(async (data: RegisterInput): Promise<User> => {
    authGenRef.current++;
    const payload: RegisterInput = {
      ...data,
      timezone: data.timezone || detectBrowserTimezone(),
    };

    const response = await api.post<{ user: User; token?: string }>('/api/auth/register', payload);
    if (response.token) {
      setAuthToken(response.token);
    }
    setUser(response.user);
    setIsLoading(false);
    return response.user;
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    authGenRef.current++;
    try {
      await api.post('/api/auth/logout');
    } catch (error) {
      // Mesmo se falhar a requisição, limpa a sessão local
      console.warn('Erro ao encerrar sessão no servidor:', error);
    } finally {
      setAuthToken(null);
      setUser(null);
    }
  }, []);

  const refreshUser = useCallback(async (): Promise<void> => {
    await fetchCurrentUser();
  }, [fetchCurrentUser]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: Boolean(user),
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  }
  return context;
}
