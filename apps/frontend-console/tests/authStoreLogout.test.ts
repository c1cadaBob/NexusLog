/* @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../src/stores/authStore';
import {
  ACCESS_TOKEN_KEY,
  AUTH_PERSIST_KEY,
  REFRESH_TOKEN_KEY,
  TOKEN_EXPIRES_AT_KEY,
  clearAuthStorage,
  persistAuthSession,
} from '../src/utils/authStorage';

vi.mock('../src/config/runtime-config', () => ({
  getRuntimeConfig: () => ({
    apiBaseUrl: '/api/v1',
    tenantId: '11111111-1111-1111-1111-111111111111',
  }),
}));

describe('authStore logout', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          code: 'OK',
          message: 'success',
          data: { logged_out: true },
        }),
      }),
    );

    window.localStorage.clear();
    window.sessionStorage.clear();
    clearAuthStorage();
    useAuthStore.setState({
      isAuthenticated: false,
      user: null,
      permissions: [],
      capabilities: [],
      scopes: [],
      entitlements: [],
      featureFlags: [],
      authzEpoch: 0,
      actorFlags: {
        reserved: false,
        interactive_login_allowed: false,
        system_subject: false,
      },
      authzReady: false,
      authzSourceToken: null,
      isLoading: false,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearAuthStorage();
    useAuthStore.setState({
      isAuthenticated: false,
      user: null,
      permissions: [],
      capabilities: [],
      scopes: [],
      entitlements: [],
      featureFlags: [],
      authzEpoch: 0,
      actorFlags: {
        reserved: false,
        interactive_login_allowed: false,
        system_subject: false,
      },
      authzReady: false,
      authzSourceToken: null,
      isLoading: false,
    });
  });

  it('calls backend logout and clears local auth state for user-initiated logout', async () => {
    persistAuthSession({
      accessToken: 'access-token-123',
      refreshToken: 'refresh-token-456',
      expiresAtMs: Date.now() + 60_000,
      remember: true,
    });
    window.localStorage.setItem('nexuslog-tenant-id', '11111111-1111-1111-1111-111111111111');
    useAuthStore.setState({
      isAuthenticated: true,
      user: {
        id: '20000000-0000-0000-0000-000000000001',
        username: 'sys-superadmin',
        email: 'superadmin@nexuslog.dev',
        role: 'admin',
      },
      permissions: ['*'],
      capabilities: ['*'],
      scopes: ['system', 'all_tenants', 'tenant_group', 'tenant', 'owned', 'resource', 'self'],
      entitlements: [],
      featureFlags: [],
      authzEpoch: 0,
      actorFlags: {
        reserved: false,
        interactive_login_allowed: true,
        system_subject: false,
      },
      authzReady: true,
      authzSourceToken: 'access-token-123',
      isLoading: false,
    });

    await useAuthStore.getState().logout();

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/auth/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer access-token-123',
        'X-Tenant-ID': '11111111-1111-1111-1111-111111111111',
      },
      body: JSON.stringify({ refresh_token: 'refresh-token-456' }),
    });

    expect(window.localStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
    expect(window.localStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
    expect(window.localStorage.getItem(TOKEN_EXPIRES_AT_KEY)).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();

    const persistedAuth = window.localStorage.getItem(AUTH_PERSIST_KEY);
    expect(persistedAuth).toBeTruthy();
    expect(JSON.parse(persistedAuth ?? '{}')).toMatchObject({
      state: {
        isAuthenticated: false,
        user: null,
      },
    });
  });

  it('skips backend revocation when logout is explicitly local-only', async () => {
    persistAuthSession({
      accessToken: 'expired-access-token',
      refreshToken: 'expired-refresh-token',
      expiresAtMs: Date.now() - 60_000,
      remember: false,
    });
    useAuthStore.setState({
      isAuthenticated: true,
      user: {
        id: '20000000-0000-0000-0000-000000000001',
        username: 'sys-superadmin',
        email: 'superadmin@nexuslog.dev',
        role: 'admin',
      },
      permissions: ['*'],
      capabilities: ['*'],
      scopes: ['system', 'all_tenants', 'tenant_group', 'tenant', 'owned', 'resource', 'self'],
      entitlements: [],
      featureFlags: [],
      authzEpoch: 0,
      actorFlags: {
        reserved: false,
        interactive_login_allowed: true,
        system_subject: false,
      },
      authzReady: true,
      authzSourceToken: 'expired-access-token',
      isLoading: false,
    });

    await useAuthStore.getState().logout({ revokeSession: false });

    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
    expect(window.sessionStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});
