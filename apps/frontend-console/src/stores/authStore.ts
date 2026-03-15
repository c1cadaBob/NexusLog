import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types/user';
import type { AuthorizationSnapshot } from '../types/authz';
import {
  EMPTY_AUTHORIZATION_STATE,
  normalizeActorFlags,
} from '../types/authz';
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

const AUTHORIZATION_SYNC_DEDUPE_WINDOW_MS = 3000;
const ALL_AUTHORIZATION_SCOPES = ['system', 'all_tenants', 'tenant_group', 'tenant', 'owned', 'resource', 'self'];
const inFlightAuthorizationSyncs = new Map<string, Promise<void>>();
const recentAuthorizationSyncAt = new Map<string, number>();

function resetAuthorizationSyncTracking(): void {
  inFlightAuthorizationSyncs.clear();
  recentAuthorizationSyncAt.clear();
}

function resolveAccessToken(): string {
  return typeof window !== 'undefined' ? getAuthStorageItem(ACCESS_TOKEN_KEY)?.trim() ?? '' : '';
}

function buildEmergencyAuthorizationSnapshot(): AuthorizationSnapshot {
  return {
    permissions: ['*'],
    capabilities: ['*'],
    scopes: [...ALL_AUTHORIZATION_SCOPES],
    entitlements: [],
    featureFlags: [],
    authzEpoch: 0,
    actorFlags: normalizeActorFlags({
      reserved: false,
      interactive_login_allowed: true,
      system_subject: false,
    }),
  };
}

export interface LogoutOptions {
  revokeSession?: boolean;
}

export interface AuthorizationContextInput extends Partial<AuthorizationSnapshot> {
  authzSourceToken?: string | null;
}

export interface AuthState extends AuthorizationSnapshot {
  isAuthenticated: boolean;
  user: User | null;
  authzReady: boolean;
  authzSourceToken: string | null;
  isLoading: boolean;
  login: (user: User) => void;
  logout: (options?: LogoutOptions) => Promise<void>;
  setLoading: (loading: boolean) => void;
  setPermissions: (permissions: string[]) => void;
  setAuthorizationContext: (context: AuthorizationContextInput) => void;
  clearAuthorizationContext: () => void;
  syncPermissions: () => Promise<void>;
  syncAuthorizationContext: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      user: null,
      ...EMPTY_AUTHORIZATION_STATE,
      authzSourceToken: null,
      isLoading: false,
      login: (user) =>
        set({
          isAuthenticated: true,
          user,
          isLoading: false,
          ...EMPTY_AUTHORIZATION_STATE,
          authzSourceToken: null,
        }),
      logout: async (options) => {
        const shouldRevokeSession = options?.revokeSession !== false;

        try {
          if (shouldRevokeSession) {
            await revokeCurrentSession();
          }
        } catch (error) {
          console.warn('[authStore] 服务端注销失败，继续清理本地会话:', error);
        } finally {
          resetAuthorizationSyncTracking();
          clearAuthStorage();
          set({
            isAuthenticated: false,
            user: null,
            ...EMPTY_AUTHORIZATION_STATE,
            authzSourceToken: null,
          });
        }
      },
      setLoading: (isLoading) => set({ isLoading }),
      setPermissions: (permissions) => {
        const normalizedPermissions = Array.from(new Set(permissions.map((permission) => permission.trim()).filter(Boolean)));
        const token = resolveAccessToken();
        const hasWildcard = normalizedPermissions.includes('*');

        set({
          permissions: normalizedPermissions,
          capabilities: hasWildcard ? ['*'] : get().capabilities,
          scopes: hasWildcard ? [...ALL_AUTHORIZATION_SCOPES] : get().scopes,
          entitlements: get().entitlements,
          featureFlags: get().featureFlags,
          authzEpoch: get().authzEpoch,
          actorFlags: hasWildcard
            ? normalizeActorFlags({ reserved: false, interactive_login_allowed: true, system_subject: false })
            : get().actorFlags,
          authzReady: true,
          authzSourceToken: token || get().authzSourceToken,
        });
      },
      setAuthorizationContext: (context) => {
        const token = context.authzSourceToken === undefined ? resolveAccessToken() : context.authzSourceToken;
        set({
          permissions: context.permissions ?? [],
          capabilities: context.capabilities ?? [],
          scopes: context.scopes ?? [],
          entitlements: context.entitlements ?? [],
          featureFlags: context.featureFlags ?? [],
          authzEpoch: context.authzEpoch ?? 0,
          actorFlags: normalizeActorFlags(context.actorFlags),
          authzReady: true,
          authzSourceToken: token || null,
        });
      },
      clearAuthorizationContext: () =>
        set({
          ...EMPTY_AUTHORIZATION_STATE,
          authzSourceToken: null,
        }),
      syncPermissions: async () => get().syncAuthorizationContext(),
      syncAuthorizationContext: async () => {
        const token = resolveAccessToken();
        if (!token) {
          resetAuthorizationSyncTracking();
          get().clearAuthorizationContext();
          return;
        }
        if (isEmergencyAccessToken(token)) {
          recentAuthorizationSyncAt.set(token, Date.now());
          get().setAuthorizationContext({
            ...buildEmergencyAuthorizationSnapshot(),
            authzSourceToken: token,
          });
          return;
        }

        const lastSyncedAt = recentAuthorizationSyncAt.get(token) ?? 0;
        if (lastSyncedAt > 0 && Date.now() - lastSyncedAt < AUTHORIZATION_SYNC_DEDUPE_WINDOW_MS) {
          return;
        }

        const inFlightSync = inFlightAuthorizationSyncs.get(token);
        if (inFlightSync) {
          return inFlightSync;
        }

        let syncPromise: Promise<void> | null = null;
        syncPromise = (async () => {
          try {
            const me = await fetchCurrentUser();
            recentAuthorizationSyncAt.set(token, Date.now());
            get().setAuthorizationContext({
              permissions: me.permissions ?? [],
              capabilities: me.capabilities ?? [],
              scopes: me.scopes ?? [],
              entitlements: me.entitlements ?? [],
              featureFlags: me.feature_flags ?? [],
              authzEpoch: me.authz_epoch ?? 0,
              actorFlags: me.actor_flags,
              authzSourceToken: token,
            });
          } catch (error) {
            recentAuthorizationSyncAt.delete(token);
            get().clearAuthorizationContext();
            throw error;
          } finally {
            if (inFlightAuthorizationSyncs.get(token) === syncPromise) {
              inFlightAuthorizationSyncs.delete(token);
            }
          }
        })();

        inFlightAuthorizationSyncs.set(token, syncPromise);
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
