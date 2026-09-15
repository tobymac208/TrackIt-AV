import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, AUTH_EXPIRED_EVENT, TOKEN_KEY } from './api/client';
import { can as canPermission } from './permissions';

const AuthContext = createContext(null);

function getTokenExpiresAt(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function clearStoredToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  const endSession = () => {
    clearStoredToken();
    setUser(null);
  };

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setReady(true);
      return;
    }

    const expiresAt = getTokenExpiresAt(token);
    if (!expiresAt || expiresAt <= Date.now()) {
      clearStoredToken();
      setReady(true);
      return;
    }

    api
      .me()
      .then(setUser)
      .catch(() => {
        clearStoredToken();
        setUser(null);
      })
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token || !user) return undefined;

    const expiresAt = getTokenExpiresAt(token);
    if (!expiresAt || expiresAt <= Date.now()) {
      endSession();
      return undefined;
    }

    const timeoutId = window.setTimeout(endSession, expiresAt - Date.now());
    return () => window.clearTimeout(timeoutId);
  }, [user]);

  useEffect(() => {
    const onExpired = () => {
      clearStoredToken();
      setUser(null);
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, []);

  const value = useMemo(
    () => ({
      user,
      ready,
      isAdmin: user?.role === 'admin',
      can: (resource, action) => canPermission(user, resource, action),
      applyAuthResult(result) {
        if (result?.token) localStorage.setItem(TOKEN_KEY, result.token);
        if (result?.user) setUser(result.user);
        return result;
      },
      async login(username, password) {
        const result = await api.login(username, password);
        if (result.requiresTotp) {
          return result;
        }
        localStorage.setItem(TOKEN_KEY, result.token);
        setUser(result.user);
        return result;
      },
      async completeTotpLogin(challengeToken, code) {
        const result = await api.loginTotp(challengeToken, code);
        localStorage.setItem(TOKEN_KEY, result.token);
        setUser(result.user);
        return result;
      },
      logout() {
        endSession();
      },
    }),
    [user, ready]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
