import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/** 认证 token 本地存储键 */
const ACCESS_TOKEN_KEY = 'nexuslog-access-token';
const REFRESH_TOKEN_KEY = 'nexuslog-refresh-token';
const TOKEN_EXPIRES_AT_KEY = 'nexuslog-token-expires-at';

/** 过期判断冗余时间：避免边界时刻请求被后端判定已过期 */
const TOKEN_EXPIRY_SKEW_MS = 5000;

/** token 校验结果 */
interface TokenValidationResult {
  isValid: boolean;
  reason: 'ok' | 'missing_token' | 'missing_expiry' | 'invalid_expiry' | 'expired';
}

/** 读取本地 access token 到期时间（毫秒时间戳） */
function getStoredExpiryMs(): number | null {
  try {
    const raw = window.localStorage.getItem(TOKEN_EXPIRES_AT_KEY)?.trim();
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

/** 校验当前会话 token 是否可用于受保护路由 */
function validateToken(nowMs: number): TokenValidationResult {
  try {
    const accessToken = window.localStorage.getItem(ACCESS_TOKEN_KEY)?.trim();
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

/** 清理认证相关本地缓存，避免过期会话残留 */
function clearAuthStorage(): void {
  try {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    window.localStorage.removeItem(TOKEN_EXPIRES_AT_KEY);
  } catch (error) {
    console.warn('[ProtectedRoute] 清理认证缓存失败:', error);
  }
}

/** 路由守卫：未认证或 token 无效时重定向到登录页 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);
  const location = useLocation();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const hasCleanedRef = useRef(false);

  // 定时刷新当前时间，确保 token 到期后可以自动触发守卫重算
  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 5000);
    return () => window.clearInterval(timer);
  }, []);

  // 根据当前时间与本地缓存动态判断 token 是否有效
  const tokenValidation = useMemo(() => validateToken(nowMs), [nowMs]);
  const requiresRedirect = !isAuthenticated || !tokenValidation.isValid;

  useEffect(() => {
    // 当 token 无效时执行一次清理，防止状态残留导致反复重定向
    if (tokenValidation.isValid) {
      hasCleanedRef.current = false;
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
  }, [tokenValidation.isValid, isAuthenticated, logout]);

  if (requiresRedirect) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
