import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, Persona } from '../types';
import { loginApi, registerApi, extractApiError } from '../services/api';

export const PRESET_PERSONAS: Record<'user1' | 'user2' | 'admin', Persona> = {
  user1: {
    id: 'user1',
    name: 'John Doe',
    email: 'user@example.com',
    password: 'securepass',
    role: 'member',
    avatarColor: 'from-blue-500 to-indigo-600',
  },
  user2: {
    id: 'user2',
    name: 'Alice Smith',
    email: 'alice@example.com',
    password: 'securepass',
    role: 'member',
    avatarColor: 'from-emerald-500 to-teal-600',
  },
  admin: {
    id: 'admin',
    name: 'System Admin',
    email: 'admin@reserve.local',
    password: 'AdminPassword123!',
    role: 'admin',
    avatarColor: 'from-purple-500 to-violet-600',
  },
};

export interface SessionState {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  error: string | null;
}

interface AuthContextType {
  sessions: Record<'user1' | 'user2' | 'admin', SessionState>;
  activePersonaId: 'user1' | 'user2' | 'admin';
  setActivePersonaId: (id: 'user1' | 'user2' | 'admin') => void;
  loginPersona: (personaId: 'user1' | 'user2' | 'admin') => Promise<void>;
  logoutPersona: (personaId: 'user1' | 'user2' | 'admin') => void;
  loginCustom: (personaId: 'user1' | 'user2' | 'admin', email: string, pass: string) => Promise<void>;
  registerCustom: (
    personaId: 'user1' | 'user2' | 'admin',
    name: string,
    email: string,
    pass: string,
    phone?: string
  ) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sessions, setSessions] = useState<Record<'user1' | 'user2' | 'admin', SessionState>>({
    user1: { token: null, user: null, isLoading: false, error: null },
    user2: { token: null, user: null, isLoading: false, error: null },
    admin: { token: null, user: null, isLoading: false, error: null },
  });

  const [activePersonaId, setActivePersonaId] = useState<'user1' | 'user2' | 'admin'>('user1');

  const setSessionState = (
    personaId: 'user1' | 'user2' | 'admin',
    patch: Partial<SessionState>
  ) => {
    setSessions((prev) => ({
      ...prev,
      [personaId]: { ...prev[personaId], ...patch },
    }));
  };

  const loginPersona = useCallback(async (personaId: 'user1' | 'user2' | 'admin') => {
    const persona = PRESET_PERSONAS[personaId];
    setSessionState(personaId, { isLoading: true, error: null });

    try {
      let tokens;
      try {
        tokens = await loginApi(persona.email, persona.password);
      } catch (loginErr) {
        // If user2 doesn't exist yet, auto-register them
        if (personaId === 'user2') {
          tokens = await registerApi(persona.name, persona.email, persona.password, '+1987654321');
        } else {
          throw loginErr;
        }
      }

      setSessions((prev) => ({
        ...prev,
        [personaId]: {
          token: tokens.accessToken,
          user: tokens.user,
          isLoading: false,
          error: null,
        },
      }));
    } catch (err) {
      const { message } = extractApiError(err);
      setSessions((prev) => ({
        ...prev,
        [personaId]: {
          ...prev[personaId],
          isLoading: false,
          error: message,
        },
      }));
    }
  }, []);

  const logoutPersona = useCallback((personaId: 'user1' | 'user2' | 'admin') => {
    setSessions((prev) => ({
      ...prev,
      [personaId]: {
        token: null,
        user: null,
        isLoading: false,
        error: null,
      },
    }));
  }, []);

  const loginCustom = useCallback(
    async (personaId: 'user1' | 'user2' | 'admin', email: string, pass: string) => {
      setSessionState(personaId, { isLoading: true, error: null });
      try {
        const tokens = await loginApi(email, pass);
        setSessions((prev) => ({
          ...prev,
          [personaId]: {
            token: tokens.accessToken,
            user: tokens.user,
            isLoading: false,
            error: null,
          },
        }));
      } catch (err) {
        const { message } = extractApiError(err);
        setSessions((prev) => ({
          ...prev,
          [personaId]: {
            ...prev[personaId],
            isLoading: false,
            error: message,
          },
        }));
        throw err;
      }
    },
    []
  );

  const registerCustom = useCallback(
    async (
      personaId: 'user1' | 'user2' | 'admin',
      name: string,
      email: string,
      pass: string,
      phone?: string
    ) => {
      setSessionState(personaId, { isLoading: true, error: null });
      try {
        const tokens = await registerApi(name, email, pass, phone);
        setSessions((prev) => ({
          ...prev,
          [personaId]: {
            token: tokens.accessToken,
            user: tokens.user,
            isLoading: false,
            error: null,
          },
        }));
      } catch (err) {
        const { message } = extractApiError(err);
        setSessions((prev) => ({
          ...prev,
          [personaId]: {
            ...prev[personaId],
            isLoading: false,
            error: message,
          },
        }));
        throw err;
      }
    },
    []
  );

  // Auto-login all preset personas on mount for seamless instant demo experience!
  useEffect(() => {
    loginPersona('user1');
    loginPersona('user2');
    loginPersona('admin');
  }, [loginPersona]);

  return (
    <AuthContext.Provider
      value={{
        sessions,
        activePersonaId,
        setActivePersonaId,
        loginPersona,
        logoutPersona,
        loginCustom,
        registerCustom,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
