import React, { ReactNode } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Redirect } from '../../contexts/RouterContext';

interface ProtectedRouteProps {
  children: ReactNode;
}

/**
 * Componente de proteção de rotas privadas.
 * Redireciona usuários não autenticados para a tela de login (/login).
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="text-sm font-medium text-slate-600">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  return <>{children}</>;
}
