/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useCallback } from 'react';
import api, { getStoredToken, persistStoredToken } from '../api.js';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return null;
    }

    try {
      const response = await api.get('/auth/me');
      setUser(response.data);
      return response.data;
    } catch {
      persistStoredToken(null);
      setUser(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadUser();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const login = useCallback(async (identifier, password, keepSignedIn) => {
    const response = await api.post('/auth/login', { identifier, password });
    persistStoredToken(response.data.token, keepSignedIn);
    setUser(response.data.user);
    return response.data.user;
  }, []);

  const register = useCallback(async (payload) => {
    const response = await api.post('/auth/register', payload);
    persistStoredToken(response.data.token);
    setUser(response.data.user);
    return response.data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      if (getStoredToken()) {
        await api.post('/auth/logout');
      }
    } catch {
      // ignore logout failures and clear local state
    } finally {
      persistStoredToken(null);
      setUser(null);
    }
  }, []);

  const value = useMemo(() => ({ user, isLoading, login, register, logout, loadUser }), [user, isLoading, login, register, logout, loadUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
