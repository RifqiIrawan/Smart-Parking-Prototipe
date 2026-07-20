import React, { createContext, useContext, useState, useEffect } from 'react';
import apiClient, { logoutApi } from '../api/client';

interface User {
  id: string;
  name: string;
  email: string;
  role_id: number;
  role_name: string;
  location_id: string | null;
  location_name: string;
  location_code: string;
  is_active: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isSuperAdmin: boolean;
  locationLabel: string;  // "Gedung Pusat (PST)" or "Semua Lokasi"
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user,  setUser]  = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));

  useEffect(() => {
    if (token) {
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      // Reload user info
      apiClient.get('/me').then(r => setUser(r.data.data)).catch(() => logout());
    }
  }, [token]);

  const login = async (email: string, password: string) => {
    const res = await apiClient.post('/login', { email, password });
    const { token: t, refresh_token, user: u } = res.data.data;
    localStorage.setItem('token', t);
    localStorage.setItem('refresh_token', refresh_token);
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${t}`;
    setToken(t);
    setUser(u);
  };

  const logout = () => {
    const refreshToken = localStorage.getItem('refresh_token') || undefined;
    logoutApi(refreshToken).catch(() => { /* best-effort: still clear local session */ });
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    delete apiClient.defaults.headers.common['Authorization'];
    setToken(null);
    setUser(null);
  };

  // admin has the same full access as super_admin
  const isSuperAdmin = user?.role_name === 'super_admin' || user?.role_name === 'admin';

  const locationLabel = isSuperAdmin
    ? 'Semua Lokasi'
    : user?.location_name
      ? `${user.location_name}${user.location_code ? ` (${user.location_code})` : ''}`
      : 'Lokasi tidak diset';

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isSuperAdmin, locationLabel }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
