import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types/user';

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  login: (user: User) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      user: null,
      isLoading: false,
      login: (user) => set({ isAuthenticated: true, user, isLoading: false }),
      logout: () => set({ isAuthenticated: false, user: null }),
      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: 'nexuslog-auth',
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
      }),
    },
  ),
);
