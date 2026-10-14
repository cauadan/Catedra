import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { User, LoginInput, RegisterInput, AuthContextType } from '../types/auth';
import { api, ApiError } from '../lib/api';
import { detectBrowserTimezone } from '../lib/timezone';

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchCurrentUser = useCallback(async () => {
    try {
      const response = await api.get<{ user: User }>('/api/auth/me');
      setUser(response.user);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setUser(null);
      } else {
        // Erro de rede ou indisponibilidade temporária
        setUser(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  const login = useCallback(async (credentials: LoginInput): Promise<User> => {
    const response = await api.post<{ user: User }>('/api/auth/login', credentials);
    setUser(response.user);
    return response.user;
  }, []);

  const register = useCallback(async (data: RegisterInput): Promise<User> => {
    const payload: RegisterInput = {
      ...data,
      timezone: data.timezone || detectBrowserTimezone(),
    };

    const response = await api.post<{ user: User }>('/api/auth/register', payload);
    setUser(response.user);
    return response.user;
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await api.post('/api/auth/logout');
    } catch (error) {
      // Mesmo se falhar a requisição, limpa a sessão local
      console.warn('Erro ao encerrar sessão no servidor:', error);
    } finally {
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
        isAuthenticated: !!user,
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
