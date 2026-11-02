'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { fetchApi } from '../lib/api';

export interface User {
  id: number;
  uuid: string;
  username: string;
  email: string;
  isAdmin: boolean;
  language: string;
  totpEnabled: boolean;
  emailVerifiedAt?: string | null;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (credentials: { username: string; password: string; totpToken?: string }) => Promise<any>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  login: async () => {},
  logout: async () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const res = await fetchApi<any>('/api/auth/me');
      const u = res?.data ?? res?.user ?? res;
      if (u && (u.id || u.username)) {
        setUser(u);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (credentials: { username: string; password: string; totpToken?: string }) => {
    const res = await fetchApi<any>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    const token = res?.data?.token ?? res?.token;
    if (token && typeof window !== 'undefined') {
      try {
        localStorage.setItem('obsidian_session_token', token);
        document.cookie = `session=${token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
      } catch {}
    }

    const u = res?.data?.user ?? res?.user ?? res?.data;
    if (u && (u.id || u.username)) {
      setUser(u);
    }
    return {
      requiresTotp: res?.data?.confirmationToken === 'totp_required' || res?.requiresTotp,
      ...res,
    };
  };

  const logout = async () => {
    try {
      await fetchApi('/api/auth/logout', { method: 'POST' });
    } finally {
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('obsidian_session_token');
          document.cookie = 'session=; path=/; max-age=0; SameSite=Lax';
        } catch {}
      }
      setUser(null);
      window.location.href = '/login';
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
