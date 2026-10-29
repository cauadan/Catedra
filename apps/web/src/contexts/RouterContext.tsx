import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';

export interface RouterContextType {
  path: string;
  search: string;
  state: any;
  navigate: (to: string, options?: { replace?: boolean; state?: any }) => void;
}

const RouterContext = createContext<RouterContextType | null>(null);

/**
 * Normaliza o caminho atual considerando suporte transparente para pathname e hash,
 * removendo a query string de `path` para preservar a correspondência exata das rotas.
 */
function getCurrentPath(): string {
  if (typeof window === 'undefined') return '/';
  if (window.location.hash.startsWith('#/')) {
    const rawHash = window.location.hash.slice(1);
    return rawHash.split('?')[0] || '/';
  }
  return window.location.pathname || '/';
}

function getCurrentSearch(): string {
  if (typeof window === 'undefined') return '';
  if (window.location.hash.startsWith('#/')) {
    const qIdx = window.location.hash.indexOf('?');
    return qIdx !== -1 ? window.location.hash.slice(qIdx) : window.location.search || '';
  }
  return window.location.search || '';
}

function getCurrentState(): any {
  if (typeof window === 'undefined') return null;
  return window.history.state ?? null;
}

export function RouterProvider({ children }: { children: ReactNode }) {
  const [path, setPath] = useState<string>(getCurrentPath);
  const [search, setSearch] = useState<string>(getCurrentSearch);
  const [state, setState] = useState<any>(getCurrentState);

  useEffect(() => {
    const handleLocationChange = () => {
      setPath(getCurrentPath());
      setSearch(getCurrentSearch());
      setState(getCurrentState());
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  const navigate = useCallback((to: string, options?: { replace?: boolean; state?: any }) => {
    const target = to.startsWith('/') ? to : `/${to}`;
    const nextState = options?.state ?? null;

    if (options?.replace) {
      window.history.replaceState(nextState, '', target);
    } else {
      window.history.pushState(nextState, '', target);
    }

    const qIdx = target.indexOf('?');
    const cleanPath = qIdx !== -1 ? target.slice(0, qIdx) || '/' : target;
    const cleanSearch = qIdx !== -1 ? target.slice(qIdx) : '';

    setPath(cleanPath);
    setSearch(cleanSearch);
    setState(nextState);
    window.scrollTo(0, 0);
  }, []);

  return (
    <RouterContext.Provider value={{ path, search, state, navigate }}>
      {children}
    </RouterContext.Provider>
  );
}

export function useRouter(): RouterContextType {
  const context = useContext(RouterContext);
  if (!context) {
    throw new Error('useRouter deve ser utilizado dentro de um RouterProvider');
  }
  return context;
}

export function Link({
  to,
  children,
  className,
  onClick,
  ...props
}: {
  to: string;
  children: ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  [key: string]: any;
}) {
  const { navigate } = useRouter();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (onClick) {
      onClick(e);
    }

    // Não intercepta se tecla modificadora estiver pressionada (permite abrir em nova aba)
    if (!e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
      e.preventDefault();
      navigate(to);
    }
  };

  return (
    <a href={to} onClick={handleClick} className={className} {...props}>
      {children}
    </a>
  );
}

export function Redirect({ to }: { to: string }) {
  const { navigate } = useRouter();

  useEffect(() => {
    navigate(to, { replace: true });
  }, [navigate, to]);

  return null;
}
