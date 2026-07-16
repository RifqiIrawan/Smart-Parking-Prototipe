import React, { createContext, useContext, useState } from 'react';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isAuthenticated: false,
  setAuth: () => {},
  logout: () => {} });

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem('sp_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem('sp_token')
  );

  const setAuth = (user: User, token: string) => {
    setUser(user);
    setToken(token);
    localStorage.setItem('sp_user', JSON.stringify(user));
    localStorage.setItem('sp_token', token);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('sp_user');
    localStorage.removeItem('sp_token');
  };

  return (
    <AuthContext.Provider
      value={{ user, token, isAuthenticated: !!token && !!user, setAuth, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
