import React from 'react';
import { RouterProvider, useRouter, Redirect } from './contexts/RouterContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { Shell } from './components/layout/Shell';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { Subjects } from './pages/Subjects';
import { Agenda } from './pages/Agenda';
import { Timer } from './pages/Timer';
import { Goals } from './pages/Goals';
import { Statistics } from './pages/Statistics';
import { Observatory } from './pages/Observatory';

export const defaultQueryClientOptions = {
  queries: {
    retry: (failureCount: number, error: any) => error?.status !== 401 && failureCount < 2,
    refetchOnWindowFocus: false,
  },
};

/**
 * Roteamento e orquestração de páginas do frontend.
 */
function AppRoutes() {
  const { path } = useRouter();
  const { isAuthenticated } = useAuth();

  // Rotas públicas de autenticação (redirecionam se já logado)
  if (path === '/login') {
    return isAuthenticated ? <Redirect to="/dashboard" /> : <Login />;
  }

  if (path === '/register') {
    return isAuthenticated ? <Redirect to="/dashboard" /> : <Register />;
  }

  // Rotas privadas protegidas pelo Shell e ProtectedRoute
  return (
    <ProtectedRoute>
      <Shell>
        {path === '/' || path === '/dashboard' ? (
          <Dashboard />
        ) : path === '/subjects' ? (
          <Subjects />
        ) : path === '/agenda' ? (
          <Agenda />
        ) : path === '/timer' ? (
          <Timer />
        ) : path === '/goals' ? (
          <Goals />
        ) : path === '/stats' ? (
          <Statistics />
        ) : path === '/observatory' || path === '/observatorio' ? (
          <Observatory />
        ) : (
          <Redirect to="/dashboard" />
        )}
      </Shell>
    </ProtectedRoute>
  );
}

/**
 * Componente raiz com Provedores de Roteamento e Autenticação.
 */
export function App() {
  return (
    <RouterProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </RouterProvider>
  );
}

export default App;
