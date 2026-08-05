import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

const TOKEN_KEY = 'serumah_token';
const USER_KEY = 'serumah_user';

export interface AuthUser {
  id: string;
  email: string;
}

export type AuthStage = 'checking' | 'anonymous' | 'no-profile' | 'no-rumah' | 'ready';

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  hasProfile: boolean;
  hasRumah: boolean;
  stage: AuthStage;
  loading: boolean;
  hydrate: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  setSession: (token: string, user: AuthUser, hasProfile: boolean, hasRumah: boolean) => Promise<void>;
  setOnboarding: (hasProfile: boolean, hasRumah: boolean) => void;
  clear: () => Promise<void>;
}

async function readSecure<T>(key: string): Promise<T | null> {
  const raw = await SecureStore.getItemAsync(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function writeSecure(key: string, value: unknown): Promise<void> {
  await SecureStore.setItemAsync(key, JSON.stringify(value));
}

function resolveStage(token: string | null, hasProfile: boolean, hasRumah: boolean): AuthStage {
  if (!token) return 'anonymous';
  if (!hasProfile) return 'no-profile';
  if (!hasRumah) return 'no-rumah';
  return 'ready';
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  hasProfile: false,
  hasRumah: false,
  stage: 'checking',
  loading: false,

  login: async (email, password) => {
    const { apiLogin, apiMe } = await import('@/features/auth/api/auth');
    set({ loading: true });
    try {
      const session = await apiLogin(email, password);
      const me = await apiMe();
      const hasProfile = me.anggota != null;
      const hasRumah = (me.anggota?.rumahId ?? null) != null;
      await useAuthStore.getState().setSession(session.token, session.user, hasProfile, hasRumah);
    } finally {
      set({ loading: false });
    }
  },

  register: async (email, password) => {
    const { apiRegister } = await import('@/features/auth/api/auth');
    set({ loading: true });
    try {
      const session = await apiRegister(email, password);
      await useAuthStore.getState().setSession(session.token, session.user, false, false);
    } finally {
      set({ loading: false });
    }
  },

  hydrate: async () => {
    try {
      const [token, user, hasProfile, hasRumah] = await Promise.all([
        SecureStore.getItemAsync(TOKEN_KEY),
        readSecure<AuthUser>(USER_KEY),
        readSecure<boolean>('serumah_has_profile'),
        readSecure<boolean>('serumah_has_rumah'),
      ]);
      set({
        token,
        user,
        hasProfile: hasProfile ?? false,
        hasRumah: hasRumah ?? false,
        stage: resolveStage(token, hasProfile ?? false, hasRumah ?? false),
      });
    } catch {
      set({ stage: 'anonymous' });
    }
  },

  setSession: async (token, user, hasProfile, hasRumah) => {
    await Promise.all([
      SecureStore.setItemAsync(TOKEN_KEY, token),
      writeSecure(USER_KEY, user),
      writeSecure('serumah_has_profile', hasProfile),
      writeSecure('serumah_has_rumah', hasRumah),
    ]);
    set({
      token,
      user,
      hasProfile,
      hasRumah,
      stage: resolveStage(token, hasProfile, hasRumah),
    });
  },

  setOnboarding: (hasProfile, hasRumah) => {
    void Promise.all([
      writeSecure('serumah_has_profile', hasProfile),
      writeSecure('serumah_has_rumah', hasRumah),
    ]);
    set((s) => ({
      hasProfile,
      hasRumah,
      stage: resolveStage(s.token, hasProfile, hasRumah),
    }));
  },

  clear: async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(TOKEN_KEY),
      SecureStore.deleteItemAsync(USER_KEY),
      SecureStore.deleteItemAsync('serumah_has_profile'),
      SecureStore.deleteItemAsync('serumah_has_rumah'),
    ]);
    set({ token: null, user: null, hasProfile: false, hasRumah: false, stage: 'anonymous' });
  },
}));
