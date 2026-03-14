import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types/user';
import { revokeCurrentSession } from '../api/auth';
import { fetchCurrentUser } from '../api/user';
import {
  ACCESS_TOKEN_KEY,
  authPersistStorage,
  clearAuthStorage,
  getAuthStorageItem,
  AUTH_PERSIST_KEY,
  isEmergencyAccessToken,
} from '../utils/authStorage';

const PERMISSION_SYNC_DEDUPE_WINDOW_MS = 3000;
const inFlightPermissionSyncs = new Map<string, Promise<void>>();
const recentPermissionSyncAt = new Map<string, number>();

function resetPermissionSyncTracking(): void {
  inFlightPermissionSyncs.clear();
  recentPermissionSyncAt.clear();
}

export interface LogoutOptions {
  revokeSession?: boolean;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  permissions: string[];
  isLoading: boolean;
  login: (user: User) => void;
  logout: (options?: LogoutOptions) => Promise<void>;
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
      logout: async (options) => {
        const shouldRevokeSession = options?.revokeSession !== false;

        try {
          if (shouldRevokeSession) {
            await revokeCurrentSession();
          }
        } catch (error) {
          console.warn('[authStore] 服务端注销失败，继续清理本地会话:', error);
        } finally {
          resetPermissionSyncTracking();
          clearAuthStorage();
          set({ isAuthenticated: false, user: null, permissions: [] });
        }
      },
      setLoading: (isLoading) => set({ isLoading }),
      setPermissions: (permissions) => set({ permissions }),
      syncPermissions: async () => {
        const token = typeof window !== 'undefined' ? getAuthStorageItem(ACCESS_TOKEN_KEY)?.trim() : '';
        if (!token) {
          resetPermissionSyncTracking();
          set({ permissions: [] });
          return;
        }
        if (isEmergencyAccessToken(token)) {
          recentPermissionSyncAt.set(token, Date.now());
          set({ permissions: ['*'] });
          return;
        }

        const lastSyncedAt = recentPermissionSyncAt.get(token) ?? 0;
        if (lastSyncedAt > 0 && Date.now() - lastSyncedAt < PERMISSION_SYNC_DEDUPE_WINDOW_MS) {
          return;
        }

        const inFlightSync = inFlightPermissionSyncs.get(token);
        if (inFlightSync) {
          return inFlightSync;
        }

        let syncPromise: Promise<void> | null = null;
        syncPromise = (async () => {
          try {
            const me = await fetchCurrentUser();
            recentPermissionSyncAt.set(token, Date.now());
            set({ permissions: me.permissions ?? [] });
          } catch {
            recentPermissionSyncAt.delete(token);
            set({ permissions: [] });
          } finally {
            if (inFlightPermissionSyncs.get(token) === syncPromise) {
              inFlightPermissionSyncs.delete(token);
            }
          }
        })();

        inFlightPermissionSyncs.set(token, syncPromise);
        return syncPromise;
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
