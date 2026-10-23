import { useEffect, useState } from 'react';
import { api, setUnauthorizedHandler } from './api';
import { Landing } from './components/Landing';
import { ToastProvider } from './components/Toasts';
import { Workspace } from './components/Workspace';

type AuthState = 'loading' | 'out' | 'in';

export function App() {
  const [auth, setAuth] = useState<AuthState>('loading');

  useEffect(() => {
    setUnauthorizedHandler(() => setAuth('out'));
    api
      .session()
      .then((s) => setAuth(s.authenticated ? 'in' : 'out'))
      .catch(() => setAuth('out'));
  }, []);

  return (
    <ToastProvider>
      {auth === 'loading' ? null : auth === 'out' ? (
        <Landing onLogin={() => setAuth('in')} />
      ) : (
        <Workspace onLogout={() => setAuth('out')} />
      )}
    </ToastProvider>
  );
}
