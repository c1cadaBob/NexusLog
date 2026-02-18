/**
 * HTTP 客户端包装器
 * 
 * 提供统一的 HTTP 请求接口，包含：
 * - 认证令牌自动注入
 * - 请求超时和中止控制
 * - 请求/响应拦截器
 * - 错误处理
 */

import type { ApiError, RequestConfig } from '../../types/api';
import { ERROR_CODES } from '../../types/api';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 请求拦截器
 */
export type RequestInterceptor = (config: RequestConfig) => RequestConfig | Promise<RequestConfig>;

/**
 * 响应拦截器
 */
export type ResponseInterceptor<T = unknown> = (response: T) => T | Promise<T>;

/**
 * 错误拦截器
 */
export type ErrorInterceptor = (error: ApiError) => ApiError | Promise<ApiError>;

/**
 * 拦截器集合
 */
interface Interceptors {
  request: RequestInterceptor[];
  response: ResponseInterceptor[];
  error: ErrorInterceptor[];
}

/**
 * API 客户端配置
 */
export interface ApiClientConfig {
  /** 基础 URL */
  baseURL: string;
  /** 默认超时时间（毫秒） */
  timeout?: number;
  /** 默认请求头 */
  headers?: Record<string, string>;
  /** 获取认证令牌的函数 */
  getToken?: () => string | null;
}

// ============================================================================
// 常量
// ============================================================================

const DEFAULT_TIMEOUT = 30000; // 30 秒
const DEFAULT_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
};

// ============================================================================
// API 客户端类
// ============================================================================

/**
 * HTTP API 客户端
 * 
 * @example
 * ```typescript
 * const client = new ApiClient({
 *   baseURL: '/api',
 *   timeout: 10000,
 *   getToken: () => localStorage.getItem('auth_token'),
 * });
 * 
 * // 添加请求拦截器
 * client.addRequestInterceptor((config) => {
 *   console.log('Request:', config);
 *   return config;
 * });
 * 
 * // 发起请求
 * const data = await client.get<User>('/users/1');
 * ```
 */
export class ApiClient {
  private baseURL: string;
  private timeout: number;
  private defaultHeaders: Record<string, string>;
  private getToken: () => string | null;
  private interceptors: Interceptors;

  constructor(config: ApiClientConfig) {
    this.baseURL = config.baseURL;
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT;
    this.defaultHeaders = { ...DEFAULT_HEADERS, ...config.headers };
    this.getToken = config.getToken ?? (() => null);
    this.interceptors = {
      request: [],
      response: [],
      error: [],
    };
  }

  // ==========================================================================
  // 拦截器管理
  // ==========================================================================

  /**
   * 添加请求拦截器
   * @param interceptor - 请求拦截器函数
   * @returns 移除拦截器的函数
   */
  addRequestInterceptor(interceptor: RequestInterceptor): () => void {
    this.interceptors.request.push(interceptor);
    return () => {
      const index = this.interceptors.request.indexOf(interceptor);
      if (index !== -1) {
        this.interceptors.request.splice(index, 1);
      }
    };
  }

  /**
   * 添加响应拦截器
   * @param interceptor - 响应拦截器函数
   * @returns 移除拦截器的函数
   */
  addResponseInterceptor<T>(interceptor: ResponseInterceptor<T>): () => void {
    this.interceptors.response.push(interceptor as ResponseInterceptor);
    return () => {
      const index = this.interceptors.response.indexOf(interceptor as ResponseInterceptor);
      if (index !== -1) {
        this.interceptors.response.splice(index, 1);
      }
    };
  }

  /**
   * 添加错误拦截器
   * @param interceptor - 错误拦截器函数
   * @returns 移除拦截器的函数
   */
  addErrorInterceptor(interceptor: ErrorInterceptor): () => void {
    this.interceptors.error.push(interceptor);
    return () => {
      const index = this.interceptors.error.indexOf(interceptor);
      if (index !== -1) {
        this.interceptors.error.splice(index, 1);
      }
    };
  }

  // ==========================================================================
  // 核心请求方法
  // ==========================================================================

  /**
   * 执行 HTTP 请求
   * @param endpoint - API 端点
   * @param config - 请求配置
   * @returns 响应数据
   */
  private async request<T>(endpoint: string, config: RequestConfig = {}): Promise<T> {
    // 应用请求拦截器
    let processedConfig = { ...config };
    for (const interceptor of this.interceptors.request) {
      processedConfig = await interceptor(processedConfig);
    }

    const { params, timeout = this.timeout, ...fetchConfig } = processedConfig;

    // 构建 URL
    const url = this.buildUrl(endpoint, params);

    // 构建请求头
    const headers = this.buildHeaders(fetchConfig.headers);

    // 创建中止控制器
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...fetchConfig,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // 处理响应
      const data = await this.handleResponse<T>(response);

      // 应用响应拦截器
      let processedData: T = data;
      for (const interceptor of this.interceptors.response) {
        processedData = await interceptor(processedData) as T;
      }

      return processedData;
    } catch (error) {
      clearTimeout(timeoutId);

      // 转换为 ApiError
      const apiError = this.normalizeError(error);

      // 应用错误拦截器
      let processedError = apiError;
      for (const interceptor of this.interceptors.error) {
        processedError = await interceptor(processedError);
      }

      throw processedError;
    }
  }

  /**
   * 构建完整 URL
   */
  private buildUrl(endpoint: string, params?: Record<string, unknown>): string {
    // 处理相对路径和绝对路径
    let url: URL;
    if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
      url = new URL(endpoint);
    } else {
      // 确保 baseURL 和 endpoint 正确拼接
      const base = this.baseURL.endsWith('/') ? this.baseURL.slice(0, -1) : this.baseURL;
      const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
      url = new URL(`${base}${path}`, window.location.origin);
    }

    // 添加查询参数
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            value.forEach((v) => url.searchParams.append(key, String(v)));
          } else {
            url.searchParams.append(key, String(value));
          }
        }
      });
    }

    return url.toString();
  }

  /**
   * 构建请求头
   */
  private buildHeaders(customHeaders?: HeadersInit): Headers {
    const headers = new Headers(this.defaultHeaders);

    // 添加认证令牌
    const token = this.getToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    // 合并自定义请求头
    if (customHeaders) {
      if (customHeaders instanceof Headers) {
        customHeaders.forEach((value, key) => headers.set(key, value));
      } else if (Array.isArray(customHeaders)) {
        customHeaders.forEach(([key, value]) => headers.set(key, value));
      } else {
        Object.entries(customHeaders).forEach(([key, value]) => headers.set(key, value));
      }
    }

    return headers;
  }

  /**
   * 处理响应
   */
  private async handleResponse<T>(response: Response): Promise<T> {
    // 检查响应状态
    if (!response.ok) {
      const error = await this.parseErrorResponse(response);
      throw error;
    }

    // 检查是否有响应体
    const contentType = response.headers.get('Content-Type');
    if (!contentType || response.status === 204) {
      return undefined as unknown as T;
    }

    // 解析响应体
    if (contentType.includes('application/json')) {
      return response.json();
    }

    if (contentType.includes('text/')) {
      return response.text() as unknown as T;
    }

    // 返回 Blob 用于文件下载
    return response.blob() as unknown as T;
  }

  /**
   * 解析错误响应
   */
  private async parseErrorResponse(response: Response): Promise<ApiError> {
    const status = response.status;
    let errorData: Partial<ApiError> = {};

    try {
      const contentType = response.headers.get('Content-Type');
      if (contentType?.includes('application/json')) {
        errorData = await response.json();
      }
    } catch {
      // 忽略解析错误
    }

    // 根据状态码映射错误代码
    const code = this.mapStatusToErrorCode(status);

    return {
      code: errorData.code || code,
      message: errorData.message || response.statusText || '请求失败',
      details: errorData.details,
    };
  }

  /**
   * 将 HTTP 状态码映射为错误代码
   */
  private mapStatusToErrorCode(status: number): string {
    switch (status) {
      case 400:
        return ERROR_CODES.INVALID_INPUT;
      case 401:
        return ERROR_CODES.UNAUTHORIZED;
      case 403:
        return ERROR_CODES.FORBIDDEN;
      case 404:
        return ERROR_CODES.NOT_FOUND;
      case 409:
        return ERROR_CODES.CONFLICT;
      case 429:
        return ERROR_CODES.RATE_LIMITED;
      case 500:
        return ERROR_CODES.SERVER_ERROR;
      case 503:
        return ERROR_CODES.SERVICE_UNAVAILABLE;
      default:
        return `HTTP_${status}`;
    }
  }

  /**
   * 规范化错误
   */
  private normalizeError(error: unknown): ApiError {
    // 已经是 ApiError
    if (this.isApiError(error)) {
      return error;
    }

    // AbortError（超时或取消）
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return {
          code: ERROR_CODES.TIMEOUT,
          message: '请求超时',
        };
      }

      // 网络错误
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        return {
          code: ERROR_CODES.NETWORK_ERROR,
          message: '网络连接失败',
        };
      }

      return {
        code: ERROR_CODES.UNKNOWN,
        message: error.message,
        details: error,
      };
    }

    return {
      code: ERROR_CODES.UNKNOWN,
      message: '未知错误',
      details: error,
    };
  }

  /**
   * 检查是否为 ApiError
   */
  private isApiError(error: unknown): error is ApiError {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      'message' in error
    );
  }

  // ==========================================================================
  // HTTP 方法
  // ==========================================================================

  /**
   * GET 请求
   */
  async get<T>(endpoint: string, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, { ...config, method: 'GET' });
  }

  /**
   * POST 请求
   */
  async post<T>(endpoint: string, data?: unknown, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'POST',
      body: data !== undefined ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * PUT 请求
   */
  async put<T>(endpoint: string, data?: unknown, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'PUT',
      body: data !== undefined ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * PATCH 请求
   */
  async patch<T>(endpoint: string, data?: unknown, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'PATCH',
      body: data !== undefined ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * DELETE 请求
   */
  async delete<T>(endpoint: string, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, { ...config, method: 'DELETE' });
  }

  // ==========================================================================
  // 工具方法
  // ==========================================================================

  /**
   * 设置基础 URL
   */
  setBaseURL(baseURL: string): void {
    this.baseURL = baseURL;
  }

  /**
   * 设置默认超时时间
   */
  setTimeout(timeout: number): void {
    this.timeout = timeout;
  }

  /**
   * 设置默认请求头
   */
  setHeader(key: string, value: string): void {
    this.defaultHeaders[key] = value;
  }

  /**
   * 移除默认请求头
   */
  removeHeader(key: string): void {
    delete this.defaultHeaders[key];
  }

  /**
   * 设置获取令牌的函数
   */
  setTokenGetter(getter: () => string | null): void {
    this.getToken = getter;
  }
}

// ============================================================================
// 默认客户端实例
// ============================================================================

/**
 * 获取认证令牌
 */
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const token = localStorage.getItem('nexuslog-auth-token');
    return token ? JSON.parse(token) : null;
  } catch {
    return null;
  }
}

/**
 * 默认 API 客户端实例
 */
export const apiClient = new ApiClient({
  baseURL: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) || '/api',
  timeout: DEFAULT_TIMEOUT,
  getToken: getAuthToken,
});

// 添加默认的请求日志拦截器（仅开发环境）
if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
  apiClient.addRequestInterceptor((config) => {
    console.log('[API Request]', config.method || 'GET', config);
    return config;
  });

  apiClient.addResponseInterceptor((response) => {
    console.log('[API Response]', response);
    return response;
  });

  apiClient.addErrorInterceptor((error) => {
    console.error('[API Error]', error);
    return error;
  });
}

export default apiClient;
