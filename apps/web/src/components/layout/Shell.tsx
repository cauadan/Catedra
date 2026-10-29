import React, { useState, ReactNode } from 'react';
import {
  LayoutDashboard,
  Layers,
  Calendar,
  Clock,
  Target,
  BarChart2,
  Compass,
  CheckSquare,
  LogOut,
  Menu,
  X,
  GraduationCap,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter, Link } from '../../contexts/RouterContext';

interface ShellProps {
  children: ReactNode;
}

export const navigationItems = [
  { id: 'dashboard', path: '/dashboard', label: 'Painel', icon: LayoutDashboard },
  { id: 'subjects', path: '/subjects', label: 'Matérias e Assuntos', icon: Layers, isPhase2: true },
  { id: 'agenda', path: '/agenda', label: 'Agenda e Planejamento', icon: Calendar },
  { id: 'timer', path: '/timer', label: 'Cronômetro de Estudo', icon: Clock },
  { id: 'goals', path: '/goals', label: 'Metas de Estudo', icon: Target },
  { id: 'stats', path: '/stats', label: 'Desempenho e Estatísticas', icon: BarChart2 },
  { id: 'observatory', path: '/observatory', label: 'Observatório Semanal', icon: Compass },
  { id: 'questions', path: '/questions', label: 'Prática de Questões', icon: CheckSquare },
];

export function Shell({ children }: ShellProps) {
  const { user, logout } = useAuth();
  const { path } = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const normalizedPath =
    path === '/' ? '/dashboard' : path === '/observatorio' ? '/observatory' : path;
  const currentItem =
    navigationItems.find((item) => item.path === normalizedPath) || navigationItems[0];

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      setIsLoggingOut(false);
    }
  };

  const userInitials = user?.name
    ? user.name
        .split(' ')
        .slice(0, 2)
        .map((n) => n[0]?.toUpperCase())
        .join('')
    : 'U';

  const NavContent = (
    <div className="flex h-full flex-col justify-between">
      <div>
        {/* Logotipo e Identificação */}
        <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-200">
            <img src="/logo.jpg" alt="Cátedra" className="h-full w-full rounded-xl object-cover" />
          </div>
          <div>
            <h1 className="text-sm font-bold leading-tight text-slate-900">
              Plataforma de Estudos
            </h1>
            <p className="text-xs text-slate-500">Gestão & Aprendizado</p>
          </div>
        </div>

        {/* Links de Navegação */}
        <nav className="space-y-1 p-3">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = normalizedPath === item.path;

            return (
              <Link
                key={item.id}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`group flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm font-semibold'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`h-4 w-4 transition-colors ${
                      isActive ? 'text-emerald-700' : 'text-slate-400 group-hover:text-slate-600'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Cartão de Perfil do Usuário e Logout */}
      <div className="border-t border-slate-200 p-4">
        <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 font-semibold text-xs text-white">
            {userInitials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-slate-900">{user?.name || 'Estudante'}</p>
            <p className="truncate text-[11px] text-slate-500">{user?.email}</p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-colors disabled:opacity-50"
        >
          <LogOut className="h-3.5 w-3.5" />
          {isLoggingOut ? 'Saindo...' : 'Encerrar Sessão'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 antialiased">
      {/* Gaveta com Overlay (Visível em todas as telas quando aberta) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative flex w-72 max-w-[80vw] flex-col bg-white shadow-xl">
            <div className="absolute right-2 top-3">
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                aria-label="Fechar menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {NavContent}
          </div>
        </div>
      )}

      {/* Conteúdo Principal */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Cabeçalho Superior */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 md:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
              aria-label="Abrir menu de navegação"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <h2 className="text-lg font-bold text-slate-900 leading-tight">
              <div className="flex items-center gap-2.5">
                <img src="/logo.jpg" alt="Cátedra" className="h-8 w-8 rounded-lg border border-slate-200 object-cover shadow-sm" />
                <span>{currentItem.label}</span>
              </div>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-semibold text-slate-800">{user?.name}</span>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 font-semibold text-xs border border-emerald-200">
              {userInitials}
            </div>
          </div>
        </header>

        {/* Área de Visualização com Scroll */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
