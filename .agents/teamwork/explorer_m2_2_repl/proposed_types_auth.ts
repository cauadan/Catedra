import { UserProfile, LoginInput, RegisterInput } from '@estudos/domain';

/**
 * Tipos e interfaces de autenticação do frontend (apps/web).
 * Alinhados com os esquemas e modelos do pacote @estudos/domain.
 */

export type User = UserProfile;
export type { LoginInput, RegisterInput };

export interface ApiErrorDetail {
  field?: string;
  message: string;
}

export interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: ApiErrorDetail[];
  };
}

export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginInput) => Promise<User>;
  register: (data: RegisterInput) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}
