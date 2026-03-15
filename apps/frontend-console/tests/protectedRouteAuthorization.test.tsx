/* @vitest-environment jsdom */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProtectedRoute from '../src/components/auth/ProtectedRoute';
import { useAuthStore } from '../src/stores/authStore';
import {
  ACCESS_TOKEN_KEY,
  AUTH_PERSIST_KEY,
  REFRESH_TOKEN_KEY,
  TOKEN_EXPIRES_AT_KEY,
  clearAuthStorage,
} from '../src/utils/authStorage';

vi.mock('../src/config/runtime-config', () => ({
  getRuntimeConfig: () => ({
    apiBaseUrl: '/api/v1',
    tenantId: '11111111-1111-1111-1111-111111111111',
  }),
}));

describe('ProtectedRoute authorization fallback', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());

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

  it('redirects to the first accessible page when current route is denied', async () => {
    const accessToken = 'valid-access-token';
    const refreshToken = 'valid-refresh-token';
    window.localStorage.setItem('nexuslog-auth-storage-scope', 'local');
    window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    window.localStorage.setItem(TOKEN_EXPIRES_AT_KEY, String(Date.now() + 60_000));
    window.localStorage.setItem(
      AUTH_PERSIST_KEY,
      JSON.stringify({
        state: {
          isAuthenticated: true,
          user: {
            id: '11111111-1111-1111-1111-111111111111',
            username: 'viewer-user',
          },
        },
        version: 0,
      }),
    );

    useAuthStore.setState({
      isAuthenticated: true,
      user: {
        id: '11111111-1111-1111-1111-111111111111',
        username: 'viewer-user',
        email: 'viewer@example.com',
        role: 'viewer',
      },
      permissions: ['logs:read'],
      capabilities: ['log.query.read'],
      scopes: ['tenant'],
      entitlements: [],
      featureFlags: [],
      authzEpoch: 1,
      actorFlags: {
        reserved: false,
        interactive_login_allowed: true,
        system_subject: false,
      },
      authzReady: true,
      authzSourceToken: accessToken,
      isLoading: false,
    });

    render(
      <MemoryRouter initialEntries={['/security/users']}>
        <Routes>
          <Route path="/login" element={<div>login-page</div>} />
          <Route
            path="/search/realtime"
            element={
              <ProtectedRoute>
                <div>search-page</div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/security/users"
            element={
              <ProtectedRoute>
                <div>user-page</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('search-page')).toBeTruthy();
    });

    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
