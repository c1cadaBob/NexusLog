import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getRuntimeConfig } from '../../config/runtime-config';
import { useAuthStore } from '../../stores/authStore';
import LoadingScreen from '../layout/LoadingScreen';
import {
  ACCESS_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  TOKEN_EXPIRES_AT_KEY,
  clearAuthStorage,
  getAuthStorageItem,
  persistRefreshedAuthSession,
} from '../../utils/authStorage';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const TOKEN_EXPIRY_SKEW_MS = 5000;
const MAX_FRONTEND_TOKEN_TTL_SECONDS = 6 * 60 * 60;
const TENANT_ID_KEY = 'nexuslog-tenant-id';

interface TokenValidationResult {
  isValid: boolean;
  reason: 'ok' | 'missing_token' | 'missing_expiry' | 'invalid_expiry' | 'expired';
}

interface RuntimeConfigWithTenant {
  apiBaseUrl: string;
  tenantId?: string;
  tenantID?: string;
}

interface ApiSuccessEnvelope<TData> {
  code: string;
  message: string;
  request_id?: string;
  data?: TData;
  meta?: Record<string, unknown>;
}

interface ApiErrorEnvelope {
  code?: string;
  message?: string;
  request_id?: string;
  details?: Record<string, unknown>;
}

interface RefreshResponseData {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

function normalizeApiBaseUrl(rawBaseUrl: string): string {
  const normalized = (rawBaseUrl || '/api/v1').trim();
  if (!normalized) {
    return '/api/v1';
  }
  return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
}

function buildRefreshUrl(apiBaseUrl: string): string {
  return `${normalizeApiBaseUrl(apiBaseUrl)}/auth/refresh`;
}

function resolveTenantId(config: RuntimeConfigWithTenant): string {
  const localTenant = window.localStorage.getItem(TENANT_ID_KEY)?.trim();
  if (localTenant) {
    return localTenant;
  }
  return (config.tenantId ?? config.tenantID ?? '').trim();
}

function resolveTokenTtlSeconds(expiresIn: number): number {
  const normalizedExpiresIn =
    Number.isFinite(expiresIn) && expiresIn > 0
      ? Math.floor(expiresIn)
      : MAX_FRONTEND_TOKEN_TTL_SECONDS;
  return Math.min(normalizedExpiresIn, MAX_FRONTEND_TOKEN_TTL_SECONDS);
}

function getStoredExpiryMs(): number | null {
  try {
    const raw = getAuthStorageItem(TOKEN_EXPIRES_AT_KEY)?.trim();
    if (!raw) {
      return null;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return NaN;
    }
    return parsed;
  } catch (error) {
    console.warn('[ProtectedRoute] 读取 token 过期时间失败:', error);
    return NaN;
  }
}

function validateToken(nowMs: number): TokenValidationResult {
  try {
    const accessToken = getAuthStorageItem(ACCESS_TOKEN_KEY)?.trim();
    if (!accessToken) {
      return { isValid: false, reason: 'missing_token' };
    }

    const expiresAtMs = getStoredExpiryMs();
    if (expiresAtMs === null) {
      return { isValid: false, reason: 'missing_expiry' };
    }
    if (!Number.isFinite(expiresAtMs)) {
      return { isValid: false, reason: 'invalid_expiry' };
    }
    if (nowMs + TOKEN_EXPIRY_SKEW_MS >= expiresAtMs) {
      return { isValid: false, reason: 'expired' };
    }

    return { isValid: true, reason: 'ok' };
  } catch (error) {
    console.warn('[ProtectedRoute] 校验 token 失败:', error);
    return { isValid: false, reason: 'missing_token' };
  }
}

async function refreshAccessToken(refreshToken: string): Promise<boolean> {
  const runtimeConfig = getRuntimeConfig() as RuntimeConfigWithTenant;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const tenantId = resolveTenantId(runtimeConfig);
  if (tenantId) {
    headers['X-Tenant-ID'] = tenantId;
  }

  try {
    const response = await fetch(buildRefreshUrl(runtimeConfig.apiBaseUrl || '/api/v1'), {
      method: 'POST',
      headers,
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    const responseBody = (await response.json().catch(() => null)) as
      | ApiSuccessEnvelope<RefreshResponseData>
      | ApiErrorEnvelope
      | null;
    const refreshData = responseBody && 'data' in responseBody ? responseBody.data : undefined;

    if (!response.ok || !refreshData?.access_token || !refreshData.refresh_token) {
      return false;
    }

    persistRefreshedAuthSession({
      accessToken: refreshData.access_token,
      refreshToken: refreshData.refresh_token,
      expiresAtMs: Date.now() + resolveTokenTtlSeconds(refreshData.expires_in) * 1000,
    });
    return true;
  } catch (error) {
    console.warn('[ProtectedRoute] 刷新 access token 失败:', error);
    return false;
  }
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const logout = useAuthStore((state) => state.logout);
  const location = useLocation();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const hasCleanedRef = useRef(false);
  const refreshAttemptKeyRef = useRef('');

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 5000);
    return () => window.clearInterval(timer);
  }, []);

  const tokenValidation = useMemo(() => validateToken(nowMs), [nowMs]);
  const refreshToken = getAuthStorageItem(REFRESH_TOKEN_KEY)?.trim() ?? '';
  const shouldAttemptRefresh = isAuthenticated && !tokenValidation.isValid && Boolean(refreshToken);
  const requiresRedirect = !isAuthenticated || (!tokenValidation.isValid && !shouldAttemptRefresh && !isRefreshing);

  useEffect(() => {
    if (!shouldAttemptRefresh) {
      refreshAttemptKeyRef.current = '';
      if (isRefreshing) {
        setIsRefreshing(false);
      }
      if (tokenValidation.isValid) {
        hasCleanedRef.current = false;
      }
      return;
    }

    const attemptKey = `${tokenValidation.reason}:${refreshToken}`;
    if (refreshAttemptKeyRef.current === attemptKey) {
      return;
    }

    refreshAttemptKeyRef.current = attemptKey;
    let cancelled = false;
    setIsRefreshing(true);

    void refreshAccessToken(refreshToken).then((refreshed) => {
      if (cancelled) {
        return;
      }

      setIsRefreshing(false);
      if (refreshed) {
        hasCleanedRef.current = false;
        refreshAttemptKeyRef.current = '';
        setNowMs(Date.now());
        return;
      }

      hasCleanedRef.current = true;
      clearAuthStorage();
      logout();
    });

    return () => {
      cancelled = true;
    };
  }, [shouldAttemptRefresh, tokenValidation.reason, tokenValidation.isValid, refreshToken, isRefreshing, logout]);

  useEffect(() => {
    if (tokenValidation.isValid || isRefreshing || shouldAttemptRefresh) {
      if (tokenValidation.isValid) {
        hasCleanedRef.current = false;
      }
      return;
    }
    if (hasCleanedRef.current) {
      return;
    }

    hasCleanedRef.current = true;
    clearAuthStorage();
    if (isAuthenticated) {
      logout();
    }
  }, [tokenValidation.isValid, isRefreshing, shouldAttemptRefresh, isAuthenticated, logout]);

  if (isAuthenticated && !tokenValidation.isValid && (shouldAttemptRefresh || isRefreshing)) {
    return <LoadingScreen />;
  }

  if (requiresRedirect) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
