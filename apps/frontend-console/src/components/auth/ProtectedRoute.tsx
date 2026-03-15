import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getRuntimeConfig } from '../../config/runtime-config';
import { evaluateRouteAccess } from '../../auth/routeAuthorization';
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

const AccessDeniedView: React.FC = () => (
  <div
    style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      background: 'var(--ant-color-bg-layout, #f5f5f5)',
    }}
  >
    <div
      role="alert"
      style={{
        maxWidth: 420,
        width: '100%',
        padding: 24,
        borderRadius: 16,
        background: 'var(--ant-color-bg-container, #ffffff)',
        boxShadow: '0 12px 32px rgba(15, 23, 42, 0.12)',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 48, lineHeight: 1, marginBottom: 12 }}>🔒</div>
      <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>无权访问当前页面</div>
      <div style={{ color: 'var(--ant-color-text-secondary, #64748b)', lineHeight: 1.6 }}>
        当前账号已登录，但不具备此页面的访问能力。请返回有权限的页面，或联系管理员调整授权。
      </div>
    </div>
  </div>
);

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const permissions = useAuthStore((state) => state.permissions);
  const capabilities = useAuthStore((state) => state.capabilities);
  const authzReady = useAuthStore((state) => state.authzReady);
  const authzSourceToken = useAuthStore((state) => state.authzSourceToken);
  const syncAuthorizationContext = useAuthStore((state) => state.syncAuthorizationContext);
  const logout = useAuthStore((state) => state.logout);
  const location = useLocation();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const hasCleanedRef = useRef(false);
  const isMountedRef = useRef(false);
  const refreshAttemptKeyRef = useRef('');

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 5000);
    return () => window.clearInterval(timer);
  }, []);

  const tokenValidation = useMemo(() => validateToken(nowMs), [nowMs]);
  const currentAccessToken = getAuthStorageItem(ACCESS_TOKEN_KEY)?.trim() ?? '';
  const refreshToken = getAuthStorageItem(REFRESH_TOKEN_KEY)?.trim() ?? '';
  const shouldAttemptRefresh = isAuthenticated && !tokenValidation.isValid && Boolean(refreshToken);
  const requiresRedirect = !isAuthenticated || (!tokenValidation.isValid && !shouldAttemptRefresh && !isRefreshing);
  const needsAuthorizationSync =
    isAuthenticated && tokenValidation.isValid && Boolean(currentAccessToken) && authzSourceToken !== currentAccessToken;

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
    setIsRefreshing(true);

    void refreshAccessToken(refreshToken).then((refreshed) => {
      if (!isMountedRef.current || refreshAttemptKeyRef.current !== attemptKey) {
        return;
      }

      refreshAttemptKeyRef.current = '';
      setIsRefreshing(false);
      if (refreshed) {
        hasCleanedRef.current = false;
        setNowMs(Date.now());
        return;
      }

      hasCleanedRef.current = true;
      clearAuthStorage();
      void logout({ revokeSession: false });
    });
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
      void logout({ revokeSession: false });
    }
  }, [tokenValidation.isValid, isRefreshing, shouldAttemptRefresh, isAuthenticated, logout]);

  useEffect(() => {
    if (!needsAuthorizationSync) {
      setIsAuthorizing(false);
      return;
    }

    let cancelled = false;
    setIsAuthorizing(true);

    void syncAuthorizationContext()
      .catch((error) => {
        if (cancelled || hasCleanedRef.current) {
          return;
        }
        console.warn('[ProtectedRoute] 同步授权上下文失败，清理本地会话:', error);
        hasCleanedRef.current = true;
        clearAuthStorage();
        void logout({ revokeSession: false });
      })
      .finally(() => {
        if (!cancelled && isMountedRef.current) {
          setIsAuthorizing(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [needsAuthorizationSync, syncAuthorizationContext, logout]);

  const routeAccess = useMemo(() => {
    if (!authzReady) {
      return { allowed: true };
    }
    return evaluateRouteAccess(location.pathname, { permissions, capabilities });
  }, [authzReady, location.pathname, permissions, capabilities]);

  const isAuthorizationPending = isAuthenticated && tokenValidation.isValid && (needsAuthorizationSync || isAuthorizing || !authzReady);

  if (isAuthenticated && !tokenValidation.isValid && (shouldAttemptRefresh || isRefreshing)) {
    return <LoadingScreen />;
  }

  if (isAuthorizationPending) {
    return <LoadingScreen />;
  }

  if (requiresRedirect) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!routeAccess.allowed) {
    if (routeAccess.fallbackPath && routeAccess.fallbackPath !== location.pathname) {
      return <Navigate to={routeAccess.fallbackPath} replace />;
    }
    return <AccessDeniedView />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
