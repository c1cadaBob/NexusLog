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
    tenantId: '00000000-0000-0000-0000-000000000001',
  }),
}));

describe('ProtectedRoute refresh failure handling', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: vi.fn().mockRejectedValue(new Error('invalid json body')),
      }),
    );

    window.localStorage.clear();
    window.sessionStorage.clear();
    clearAuthStorage();
    useAuthStore.setState({
      isAuthenticated: false,
      user: null,
      permissions: [],
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
      isLoading: false,
    });
  });

  it('redirects to login and clears persisted auth when refresh fails under StrictMode', async () => {
    window.localStorage.setItem('nexuslog-auth-storage-scope', 'local');
    window.localStorage.setItem(ACCESS_TOKEN_KEY, 'expired-access-token');
    window.localStorage.setItem(REFRESH_TOKEN_KEY, 'bad-refresh-token');
    window.localStorage.setItem(TOKEN_EXPIRES_AT_KEY, String(Date.now() - 60_000));
    window.localStorage.setItem(
      AUTH_PERSIST_KEY,
      JSON.stringify({
        state: {
          isAuthenticated: true,
          user: {
            id: '11111111-1111-1111-1111-111111111111',
            username: 'demo',
          },
        },
        version: 0,
      }),
    );

    useAuthStore.setState({
      isAuthenticated: true,
      user: {
        id: '11111111-1111-1111-1111-111111111111',
        username: 'demo',
        email: 'demo@example.com',
        role: 'admin',
      },
      permissions: [],
      isLoading: false,
    });

    render(
      <React.StrictMode>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="/login" element={<div>login-page</div>} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <div>protected-page</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      </React.StrictMode>,
    );

    await waitFor(() => {
      expect(screen.getByText('login-page')).toBeTruthy();
    });

    await waitFor(() => {
      expect(window.localStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
      expect(window.localStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
      expect(window.localStorage.getItem(TOKEN_EXPIRES_AT_KEY)).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    const persistedAuth = window.localStorage.getItem(AUTH_PERSIST_KEY);
    expect(persistedAuth).toBeTruthy();
    expect(JSON.parse(persistedAuth ?? '{}')).toMatchObject({
      state: {
        isAuthenticated: false,
        user: null,
      },
    });
  });
});
