/**
 * WebSocket 客户端
 * 
 * 提供 WebSocket 连接管理，包含：
 * - 连接/断开连接
 * - 消息处理和订阅系统
 * - 带指数退避的自动重连
 * - 心跳检测
 */

import type { WebSocketMessage, WebSocketStatus, WebSocketConfig } from '../types/api';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 消息处理器
 */
export type MessageHandler<T = unknown> = (data: T) => void;

/**
 * 状态变更处理器
 */
export type StatusHandler = (status: WebSocketStatus) => void;

/**
 * 错误处理器
 */
export type ErrorHandler = (error: Event | Error) => void;

/**
 * WebSocket 客户端配置
 */
export interface WebSocketClientConfig extends WebSocketConfig {
  /** 获取认证令牌的函数 */
  getToken?: () => string | null;
  /** 状态变更回调 */
  onStatusChange?: StatusHandler;
  /** 错误回调 */
  onError?: ErrorHandler;
}

// ============================================================================
// 常量
// ============================================================================

const DEFAULT_RECONNECT_ATTEMPTS = 5;
const DEFAULT_RECONNECT_DELAY = 1000; // 1 秒
const DEFAULT_HEARTBEAT_INTERVAL = 30000; // 30 秒
const MAX_RECONNECT_DELAY = 30000; // 最大重连延迟 30 秒

// ============================================================================
// WebSocket 客户端类
// ============================================================================

/**
 * WebSocket 客户端
 * 
 * @example
 * ```typescript
 * const wsClient = new WebSocketClient({
 *   url: 'ws://localhost:8080/ws',
 *   reconnect: true,
 *   reconnectAttempts: 5,
 *   getToken: () => localStorage.getItem('auth_token'),
 * });
 * 
 * // 连接
 * await wsClient.connect();
 * 
 * // 订阅消息
 * const unsubscribe = wsClient.subscribe('logs', (data) => {
 *   console.log('New log:', data);
 * });
 * 
 * // 发送消息
 * wsClient.send('subscribe', { channel: 'logs' });
 * 
 * // 取消订阅
 * unsubscribe();
 * 
 * // 断开连接
 * wsClient.disconnect();
 * ```
 */
export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnect: boolean;
  private reconnectAttempts: number;
  private maxReconnectAttempts: number;
  private reconnectDelay: number;
  private heartbeatInterval: number;
  private getToken: () => string | null;
  private onStatusChange?: StatusHandler;
  private onError?: ErrorHandler;

  private status: WebSocketStatus = 'disconnected';
  private listeners: Map<string, Set<MessageHandler>> = new Map();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isManualDisconnect = false;

  constructor(config: WebSocketClientConfig) {
    this.url = config.url;
    this.reconnect = config.reconnect ?? true;
    this.maxReconnectAttempts = config.reconnectAttempts ?? DEFAULT_RECONNECT_ATTEMPTS;
    this.reconnectAttempts = 0;
    this.reconnectDelay = config.reconnectDelay ?? DEFAULT_RECONNECT_DELAY;
    this.heartbeatInterval = config.heartbeatInterval ?? DEFAULT_HEARTBEAT_INTERVAL;
    this.getToken = config.getToken ?? (() => null);
    this.onStatusChange = config.onStatusChange;
    this.onError = config.onError;
  }

  // ==========================================================================
  // 连接管理
  // ==========================================================================

  /**
   * 连接到 WebSocket 服务器
   * @returns Promise，连接成功时 resolve
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      this.isManualDisconnect = false;
      this.setStatus('connecting');

      try {
        // 构建带认证的 URL
        const url = this.buildUrl();
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          console.log('[WebSocket] 已连接');
          this.reconnectAttempts = 0;
          this.setStatus('connected');
          this.startHeartbeat();
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event);
        };

        this.ws.onerror = (error) => {
          console.error('[WebSocket] 错误:', error);
          this.setStatus('error');
          this.onError?.(error);
          reject(error);
        };

        this.ws.onclose = (event) => {
          console.log('[WebSocket] 已断开:', event.code, event.reason);
          this.stopHeartbeat();
          this.setStatus('disconnected');
          
          if (!this.isManualDisconnect) {
            this.attemptReconnect();
          }
        };
      } catch (error) {
        this.setStatus('error');
        reject(error);
      }
    });
  }

  /**
   * 断开 WebSocket 连接
   */
  disconnect(): void {
    this.isManualDisconnect = true;
    this.stopHeartbeat();
    this.clearReconnectTimer();
    
    if (this.ws) {
      this.ws.close(1000, '手动断开');
      this.ws = null;
    }
    
    this.setStatus('disconnected');
  }

  /**
   * 重新连接
   */
  reconnectNow(): Promise<void> {
    this.disconnect();
    this.isManualDisconnect = false;
    this.reconnectAttempts = 0;
    return this.connect();
  }

  // ==========================================================================
  // 消息处理
  // ==========================================================================

  /**
   * 订阅消息类型
   * @param type - 消息类型
   * @param handler - 消息处理器
   * @returns 取消订阅的函数
   */
  subscribe<T = unknown>(type: string, handler: MessageHandler<T>): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(handler as MessageHandler);

    return () => {
      this.listeners.get(type)?.delete(handler as MessageHandler);
      if (this.listeners.get(type)?.size === 0) {
        this.listeners.delete(type);
      }
    };
  }

  /**
   * 发送消息
   * @param type - 消息类型
   * @param data - 消息数据
   * @returns 是否发送成功
   */
  send<T = unknown>(type: string, data?: T): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[WebSocket] 无法发送消息：未连接');
      return false;
    }

    const message: WebSocketMessage<T | undefined> = {
      type,
      data,
      timestamp: Date.now(),
    };

    try {
      this.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('[WebSocket] 发送错误:', error);
      return false;
    }
  }

  // ==========================================================================
  // 状态查询
  // ==========================================================================

  /**
   * 获取当前连接状态
   */
  getStatus(): WebSocketStatus {
    return this.status;
  }

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.status === 'connected' && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * 获取当前重连尝试次数
   */
  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  /**
   * 获取最大重连尝试次数
   */
  getMaxReconnectAttempts(): number {
    return this.maxReconnectAttempts;
  }

  // ==========================================================================
  // 私有方法
  // ==========================================================================

  /**
   * 构建带认证的 URL
   */
  private buildUrl(): string {
    const token = this.getToken();
    if (!token) {
      return this.url;
    }

    const url = new URL(this.url);
    url.searchParams.set('token', token);
    return url.toString();
  }

  /**
   * 设置状态
   */
  private setStatus(status: WebSocketStatus): void {
    if (this.status !== status) {
      this.status = status;
      this.onStatusChange?.(status);
    }
  }

  /**
   * 处理接收到的消息
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      
      // 处理心跳响应
      if (message.type === 'pong') {
        return;
      }

      // 分发消息给订阅者
      const handlers = this.listeners.get(message.type);
      if (handlers) {
        handlers.forEach(handler => {
          try {
            handler(message.data);
          } catch (error) {
            console.error('[WebSocket] 处理器错误:', error);
          }
        });
      }

      // 分发给通配符订阅者
      const wildcardHandlers = this.listeners.get('*');
      if (wildcardHandlers) {
        wildcardHandlers.forEach(handler => {
          try {
            handler(message);
          } catch (error) {
            console.error('[WebSocket] 通配符处理器错误:', error);
          }
        });
      }
    } catch (error) {
      console.error('[WebSocket] 消息解析错误:', error);
    }
  }

  /**
   * 尝试重连
   */
  private attemptReconnect(): void {
    if (!this.reconnect || this.isManualDisconnect) {
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[WebSocket] 已达到最大重连次数');
      this.setStatus('error');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.calculateReconnectDelay();
    
    console.log(`[WebSocket] ${delay}ms 后重连 (尝试 ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(() => {
        // 错误已在 connect 中处理
      });
    }, delay);
  }

  /**
   * 计算重连延迟（指数退避）
   * @returns 延迟时间（毫秒）
   */
  calculateReconnectDelay(): number {
    // 指数退避：delay * 2^(attempts - 1)
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    // 添加随机抖动（±10%）
    const jitter = delay * 0.1 * (Math.random() * 2 - 1);
    // 限制最大延迟
    return Math.min(delay + jitter, MAX_RECONNECT_DELAY);
  }

  /**
   * 清除重连定时器
   */
  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * 启动心跳
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatTimer = setInterval(() => {
      this.send('ping');
    }, this.heartbeatInterval);
  }

  /**
   * 停止心跳
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
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
 * 默认 WebSocket 客户端实例
 */
export const wsClient = new WebSocketClient({
  url: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_WS_URL) || 'ws://localhost:8080/ws',
  reconnect: true,
  reconnectAttempts: DEFAULT_RECONNECT_ATTEMPTS,
  reconnectDelay: DEFAULT_RECONNECT_DELAY,
  heartbeatInterval: DEFAULT_HEARTBEAT_INTERVAL,
  getToken: getAuthToken,
  onStatusChange: (status) => {
    console.log('[WebSocket] 状态变更:', status);
  },
  onError: (error) => {
    console.error('[WebSocket] 错误:', error);
  },
});

export default wsClient;
