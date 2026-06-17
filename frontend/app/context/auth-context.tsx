'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '@/app/lib/types';
import { authAPI, API_BASE_URL } from '@/app/lib/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<any>;
  selectTenant: (tempToken: string, tenantId: number | null) => Promise<User>;
  logout: () => void;
  loading: boolean;
  isAdmin: boolean;
  isCompanyAdmin: boolean;
  refreshUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for stored auth on mount
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);

    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Đăng nhập thất bại');
    }

    const data = await response.json();
    
    if (data.require_tenant_selection) {
      return data;
    }
    
    localStorage.setItem('token', data.access_token);
    localStorage.setItem('user', JSON.stringify(data.user));
    
    setToken(data.access_token);
    setUser(data.user);

    return data.user;
  };

  const selectTenant = async (tempToken: string, tenantId: number | null) => {
    const response = await fetch(`${API_BASE_URL}/api/auth/login/select-tenant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ temp_token: tempToken, tenant_id: tenantId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Lựa chọn Workspace thất bại');
    }

    const data = await response.json();
    
    localStorage.setItem('token', data.access_token);
    localStorage.setItem('user', JSON.stringify(data.user));
    
    setToken(data.access_token);
    setUser(data.user);

    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  const refreshUser = (updatedUser: User) => {
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  const isAdmin = user?.role?.level === 0 && (user?.tenant_id === null || user?.tenant_id === undefined);
  const isCompanyAdmin = (user?.role?.level === 0 || user?.role?.level === 1)
                         && user?.tenant_id !== null
                         && user?.tenant_id !== undefined;

  return (
    <AuthContext.Provider value={{ user, token, login, selectTenant, logout, loading, isAdmin, isCompanyAdmin, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
