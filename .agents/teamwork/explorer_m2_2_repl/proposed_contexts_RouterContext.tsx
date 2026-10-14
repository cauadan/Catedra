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
  navigate: (to: string, options?: { replace?: boolean }) => void;
}

const RouterContext = createContext<RouterContextType | null>(null);

/**
 * Normaliza o caminho atual considerando suporte transparente para pathname e hash.
 */
function getCurrentPath(): string {
  if (typeof window === 'undefined') return '/';
  if (window.location.hash.startsWith('#/')) {
    return window.location.hash.slice(1);
  }
  return window.location.pathname || '/';
}

export function RouterProvider({ children }: { children: ReactNode }) {
  const [path, setPath] = useState<string>(getCurrentPath);

  useEffect(() => {
    const handleLocationChange = () => {
      setPath(getCurrentPath());
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  const navigate = useCallback((to: string, options?: { replace?: boolean }) => {
    const target = to.startsWith('/') ? to : `/${to}`;

    if (options?.replace) {
      window.history.replaceState(null, '', target);
    } else {
      window.history.pushState(null, '', target);
    }

    setPath(target);
    window.scrollTo(0, 0);
  }, []);

  return (
    <RouterContext.Provider value={{ path, navigate }}>
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
