/**
 * ProtectedRoute 组件
 * 
 * 路由保护组件，用于保护需要认证才能访问的路由
 * 从 useAuthStore 获取认证状态，未认证时重定向到 /login
 * 
 * @requirements 3.5
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import { LoadingScreen } from '@/components/common/LoadingScreen';

/**
 * ProtectedRoute 组件属性
 */
export interface ProtectedRouteProps {
  /** 子组件 */
  children: React.ReactNode;
  /** 未认证时重定向的路径，默认为 /login */
  redirectTo?: string;
}

/**
 * 路由保护组件
 * 
 * 用于保护需要认证才能访问的路由：
 * - 从 Zustand useAuthStore 获取认证状态
 * - 未认证时重定向到登录页面
 * - 保存原始路径到 URL 参数，便于登录后恢复
 * - 加载中显示 LoadingScreen
 * 
 * @example
 * ```tsx
 * <Route path="/dashboard" element={
 *   <ProtectedRoute>
 *     <Dashboard />
 *   </ProtectedRoute>
 * } />
 * ```
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  redirectTo = '/login' 
}) => {
  // 从 Zustand Store 获取认证状态（替代 Context API）
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const isLoading = useAuthStore(state => state.isLoading);
  const location = useLocation();
  
  // 认证状态加载中，显示加载屏幕
  if (isLoading) {
    return <LoadingScreen message="正在验证身份..." />;
  }
  
  // 未认证，重定向到登录页面
  if (!isAuthenticated) {
    // 构建重定向 URL，保存当前路径用于登录后恢复
    const currentPath = location.pathname + location.search;
    const redirectUrl = `${redirectTo}?redirect=${encodeURIComponent(currentPath)}`;
    return <Navigate to={redirectUrl} replace />;
  }
  
  // 已认证，渲染子组件
  return <>{children}</>;
};

export default ProtectedRoute;
