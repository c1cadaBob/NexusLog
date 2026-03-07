import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types/user';
import { fetchCurrentUser } from '../api/user';
import { authPersistStorage, clearAuthStorage, getAuthStorageItem, AUTH_PERSIST_KEY, isEmergencyAccessToken } from '../utils/authStorage';

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  permissions: string[];
  isLoading: boolean;
  login: (user: User) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  setPermissions: (permissions: string[]) => void;
  /** Fetch current user permissions (call after login or on app load when authenticated) */
  syncPermissions: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      user: null,
      permissions: [],
      isLoading: false,
      login: (user) => set({ isAuthenticated: true, user, isLoading: false }),
      logout: () => {
        clearAuthStorage();
        set({ isAuthenticated: false, user: null, permissions: [] });
      },
      setLoading: (isLoading) => set({ isLoading }),
      setPermissions: (permissions) => set({ permissions }),
      syncPermissions: async () => {
        const token = typeof window !== 'undefined' ? getAuthStorageItem('nexuslog-access-token')?.trim() : '';
        if (!token) {
          set({ permissions: [] });
          return;
        }
        if (isEmergencyAccessToken(token)) {
          set({ permissions: ['*'] });
          return;
        }
        try {
          const me = await fetchCurrentUser();
          set({ permissions: me.permissions ?? [] });
        } catch {
          set({ permissions: [] });
        }
      },
    }),
    {
      name: AUTH_PERSIST_KEY,
      storage: authPersistStorage,
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
      }),
    },
  ),
);
