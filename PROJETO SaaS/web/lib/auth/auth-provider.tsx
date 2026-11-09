'use client';

import React, { createContext, useContext, useState } from 'react';

interface AuthContextValue {
  user: { name: string; email: string } | null;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<{ name: string; email: string } | null>({
    name: 'Fábio Coelho',
    email: 'fb.coelho@hotmail.com',
  });

  const login = () => setUser({ name: 'Fábio Coelho', email: 'fb.coelho@hotmail.com' });
  const logout = () => setUser(null);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  return value || {
    user: { name: 'Fábio Coelho', email: 'fb.coelho@hotmail.com' },
    login: () => {},
    logout: () => {},
  };
}
