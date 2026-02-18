/**
 * API 相关类型定义
 */

import type { PaginationMeta } from './common';

// ============================================================================
// API 响应
// ============================================================================

/**
 * API 响应基类
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ResponseMeta;
}

/**
 * 分页响应
 */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: PaginationMeta;
}

/**
 * 响应元数据
 */
export interface ResponseMeta extends Partial<PaginationMeta> {
  requestId?: string;
  timestamp?: number;
  took?: number;
}

// ============================================================================
// API 错误
// ============================================================================

/**
 * API 错误
 */
export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
  field?: string;
  stack?: string;
}

/**
 * 验证错误
 */
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

/**
 * 错误代码
 */
export const ERROR_CODES = {
  // 通用错误
  UNKNOWN: 'UNKNOWN',
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  CANCELLED: 'CANCELLED',
  
  // 认证错误
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  
  // 资源错误
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  CONFLICT: 'CONFLICT',
  
  // 验证错误
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_FIELD: 'MISSING_FIELD',
  
  // 服务器错误
  SERVER_ERROR: 'SERVER_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  
  // 限流错误
  RATE_LIMITED: 'RATE_LIMITED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

// ============================================================================
// 请求配置
// ============================================================================

/**
 * 请求配置
 */
export interface RequestConfig extends RequestInit {
  params?: Record<string, unknown>;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

/**
 * 请求选项
 */
export interface RequestOptions {
  /** 是否显示加载状态 */
  showLoading?: boolean;
  /** 是否显示错误提示 */
  showError?: boolean;
  /** 错误提示消息 */
  errorMessage?: string;
  /** 成功提示消息 */
  successMessage?: string;
  /** 是否使用缓存 */
  useCache?: boolean;
  /** 缓存时间（毫秒） */
  cacheTime?: number;
}

// ============================================================================
// API 状态
// ============================================================================

/**
 * API 请求状态
 */
export interface ApiState<T = unknown> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
}

/**
 * API 请求钩子返回值
 */
export interface UseApiReturn<T, P extends unknown[]> extends ApiState<T> {
  execute: (...params: P) => Promise<T>;
  reset: () => void;
  setData: (data: T | null) => void;
}

// ============================================================================
// 批量操作
// ============================================================================

/**
 * 批量操作请求
 */
export interface BatchRequest<T = unknown> {
  ids: string[];
  action: string;
  data?: T;
}

/**
 * 批量操作结果
 */
export interface BatchResult {
  success: string[];
  failed: Array<{
    id: string;
    error: ApiError;
  }>;
  total: number;
  successCount: number;
  failedCount: number;
}

// ============================================================================
// WebSocket
// ============================================================================

/**
 * WebSocket 消息
 */
export interface WebSocketMessage<T = unknown> {
  type: string;
  data: T;
  timestamp: number;
}

/**
 * WebSocket 状态
 */
export type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

/**
 * WebSocket 配置
 */
export interface WebSocketConfig {
  url: string;
  reconnect?: boolean;
  reconnectAttempts?: number;
  reconnectDelay?: number;
  heartbeatInterval?: number;
}
