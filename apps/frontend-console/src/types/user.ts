/**
 * 用户和认证相关类型定义
 */

import type { ID, Timestamp } from './common';
import type { ThemeMode, DensityMode } from './theme';

// ============================================================================
// 用户角色
// ============================================================================

/**
 * 用户角色类型
 */
export type UserRole = 'admin' | 'user' | 'viewer' | 'operator';

/**
 * 权限类型
 */
export type Permission =
  | 'read'
  | 'write'
  | 'delete'
  | 'admin'
  | 'manage_users'
  | 'manage_roles'
  | 'manage_alerts'
  | 'manage_sources'
  | 'view_audit'
  | 'export_data';

/**
 * 角色定义
 */
export interface Role {
  id: ID;
  name: string;
  description: string;
  permissions: Permission[];
  isSystem: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================================
// 用户偏好设置
// ============================================================================

/**
 * 用户偏好设置
 */
export interface UserPreferences {
  /** 主题模式 */
  theme: ThemeMode;
  /** 视觉密度 */
  density: DensityMode;
  /** 语言 */
  language: string;
  /** 时区 */
  timezone: string;
  /** 默认时间范围 */
  defaultTimeRange: string;
  /** 每页显示数量 */
  pageSize: number;
  /** 是否启用通知 */
  notificationsEnabled: boolean;
  /** 是否启用声音 */
  soundEnabled: boolean;
  /** 自动刷新间隔（秒） */
  autoRefreshInterval: number;
  /** 日期格式 */
  dateFormat: string;
  /** 时间格式 */
  timeFormat: string;
}

/**
 * 默认用户偏好设置
 */
export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  theme: 'dark',
  density: 'comfortable',
  language: 'zh-CN',
  timezone: 'Asia/Shanghai',
  defaultTimeRange: 'last-1h',
  pageSize: 20,
  notificationsEnabled: true,
  soundEnabled: false,
  autoRefreshInterval: 30,
  dateFormat: 'YYYY-MM-DD',
  timeFormat: 'HH:mm:ss',
};

// ============================================================================
// 用户
// ============================================================================

/**
 * 用户信息
 */
export interface User {
  id: ID;
  username: string;
  email: string;
  displayName: string;
  avatar?: string;
  role: UserRole;
  roles: Role[];
  permissions: Permission[];
  preferences: UserPreferences;
  isActive: boolean;
  lastLoginAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * 用户简要信息（用于列表显示）
 */
export interface UserSummary {
  id: ID;
  username: string;
  displayName: string;
  avatar?: string;
  role: UserRole;
  isActive: boolean;
}

/**
 * 创建用户请求
 */
export interface CreateUserRequest {
  username: string;
  email: string;
  displayName: string;
  password: string;
  role: UserRole;
  roleIds?: ID[];
}

/**
 * 更新用户请求
 */
export interface UpdateUserRequest {
  email?: string;
  displayName?: string;
  avatar?: string;
  role?: UserRole;
  roleIds?: ID[];
  isActive?: boolean;
  preferences?: Partial<UserPreferences>;
}

// ============================================================================
// 认证
// ============================================================================

/**
 * 登录凭证
 */
export interface LoginCredentials {
  username: string;
  password: string;
  rememberMe?: boolean;
}

/**
 * 登录响应
 */
export interface LoginResponse {
  token: string;
  refreshToken: string;
  expiresIn: number;
  user: User;
}

/**
 * 令牌刷新响应
 */
export interface RefreshTokenResponse {
  token: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * 认证状态
 */
export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// ============================================================================
// 会话
// ============================================================================

/**
 * 会话信息
 */
export interface Session {
  id: ID;
  userId: ID;
  userAgent: string;
  ipAddress: string;
  createdAt: Timestamp;
  lastActiveAt: Timestamp;
  expiresAt: Timestamp;
  isCurrent: boolean;
}
