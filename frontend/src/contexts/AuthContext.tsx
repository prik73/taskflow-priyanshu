import { createContext, useCallback, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { User } from '../types';
import { logout as apiLogout } from '../api/auth';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
}

interface AuthContextValue extends AuthState {
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadStoredAuth(): AuthState {
  try {
    const raw = localStorage.getItem('user');
    const parsed = raw ? (JSON.parse(raw) as User) : null;
    // Guard against stale/malformed stored objects missing required fields
    const user = parsed?.id && parsed?.email ? parsed : null;
    if (!user) {
      localStorage.removeItem('user');
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    }
    return {
      user,
      accessToken: user ? localStorage.getItem('access_token') : null,
      refreshToken: user ? localStorage.getItem('refresh_token') : null,
    };
  } catch {
    localStorage.removeItem('user');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    return { user: null, accessToken: null, refreshToken: null };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(loadStoredAuth);

  const setAuth = useCallback((user: User, accessToken: string, refreshToken: string) => {
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);
    setState({ user, accessToken, refreshToken });
  }, []);

  const clearAuth = useCallback(() => {
    localStorage.removeItem('user');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setState({ user: null, accessToken: null, refreshToken: null });
  }, []);

  const logout = useCallback(async () => {
    const rt = state.refreshToken;
    clearAuth();
    if (rt) {
      try {
        await apiLogout(rt);
      } catch {
        // server-side revocation is best-effort
      }
    }
  }, [state.refreshToken, clearAuth]);

  return (
    <AuthContext.Provider value={{ ...state, setAuth, clearAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
