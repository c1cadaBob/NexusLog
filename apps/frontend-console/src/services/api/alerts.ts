/**
 * 告警 API 模块
 * 
 * 提供告警相关的 API 接口：
 * - list: 获取告警列表
 * - acknowledge: 确认告警
 * - resolve: 解决告警
 * - silence: 静默告警
 */

import { apiClient } from './client';
import type { 
  Alert, 
  AlertSummary,
  AlertStatus, 
  AlertSeverity,
  AlertRule,
  CreateAlertRuleRequest,
  SilencePolicy,
  CreateSilencePolicyRequest,
  NotificationChannel,
} from '../../types/alert';
import type { PaginatedResponse, BatchResult } from '../../types/api';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 告警列表查询参数
 */
export interface AlertListParams {
  status?: AlertStatus | AlertStatus[];
  severity?: AlertSeverity | AlertSeverity[];
  source?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  [key: string]: unknown;
}

/**
 * 告警规则列表查询参数
 */
export interface AlertRuleListParams {
  status?: 'enabled' | 'disabled' | 'error';
  search?: string;
  page?: number;
  pageSize?: number;
  [key: string]: unknown;
}

/**
 * 批量操作请求
 */
export interface BatchAlertRequest {
  ids: string[];
  comment?: string;
}

// ============================================================================
// API 接口
// ============================================================================

/**
 * 告警 API
 */
export const alertsApi = {
  // ==========================================================================
  // 告警管理
  // ==========================================================================

  /**
   * 获取告警列表
   * @param params - 查询参数
   * @returns 分页告警列表
   */
  list: (params?: AlertListParams): Promise<PaginatedResponse<AlertSummary>> => {
    return apiClient.get<PaginatedResponse<AlertSummary>>('/alerts', { params });
  },

  /**
   * 获取单个告警详情
   * @param id - 告警 ID
   * @returns 告警详情
   */
  getById: (id: string): Promise<Alert> => {
    return apiClient.get<Alert>(`/alerts/${id}`);
  },

  /**
   * 确认告警
   * @param id - 告警 ID
   * @param comment - 可选的备注
   * @returns 更新后的告警
   */
  acknowledge: (id: string, comment?: string): Promise<Alert> => {
    return apiClient.post<Alert>(`/alerts/${id}/acknowledge`, { comment });
  },

  /**
   * 批量确认告警
   * @param request - 批量请求
   * @returns 批量操作结果
   */
  batchAcknowledge: (request: BatchAlertRequest): Promise<BatchResult> => {
    return apiClient.post<BatchResult>('/alerts/batch/acknowledge', request);
  },

  /**
   * 解决告警
   * @param id - 告警 ID
   * @param comment - 可选的备注
   * @returns 更新后的告警
   */
  resolve: (id: string, comment?: string): Promise<Alert> => {
    return apiClient.post<Alert>(`/alerts/${id}/resolve`, { comment });
  },

  /**
   * 批量解决告警
   * @param request - 批量请求
   * @returns 批量操作结果
   */
  batchResolve: (request: BatchAlertRequest): Promise<BatchResult> => {
    return apiClient.post<BatchResult>('/alerts/batch/resolve', request);
  },

  /**
   * 静默告警
   * @param id - 告警 ID
   * @param duration - 静默时长（秒）
   * @param comment - 可选的备注
   * @returns 更新后的告警
   */
  silence: (id: string, duration: number, comment?: string): Promise<Alert> => {
    return apiClient.post<Alert>(`/alerts/${id}/silence`, { duration, comment });
  },

  /**
   * 取消静默
   * @param id - 告警 ID
   * @returns 更新后的告警
   */
  unsilence: (id: string): Promise<Alert> => {
    return apiClient.post<Alert>(`/alerts/${id}/unsilence`);
  },

  /**
   * 获取告警统计
   * @returns 告警统计数据
   */
  getStats: (): Promise<{
    total: number;
    active: number;
    acknowledged: number;
    resolved: number;
    silenced: number;
    bySeverity: Record<AlertSeverity, number>;
  }> => {
    return apiClient.get('/alerts/stats');
  },

  // ==========================================================================
  // 告警规则
  // ==========================================================================

  /**
   * 获取告警规则列表
   * @param params - 查询参数
   * @returns 分页规则列表
   */
  listRules: (params?: AlertRuleListParams): Promise<PaginatedResponse<AlertRule>> => {
    return apiClient.get<PaginatedResponse<AlertRule>>('/alerts/rules', { params });
  },

  /**
   * 获取单个告警规则
   * @param id - 规则 ID
   * @returns 告警规则
   */
  getRule: (id: string): Promise<AlertRule> => {
    return apiClient.get<AlertRule>(`/alerts/rules/${id}`);
  },

  /**
   * 创建告警规则
   * @param rule - 规则数据
   * @returns 创建的规则
   */
  createRule: (rule: CreateAlertRuleRequest): Promise<AlertRule> => {
    return apiClient.post<AlertRule>('/alerts/rules', rule);
  },

  /**
   * 更新告警规则
   * @param id - 规则 ID
   * @param rule - 更新数据
   * @returns 更新后的规则
   */
  updateRule: (id: string, rule: Partial<CreateAlertRuleRequest>): Promise<AlertRule> => {
    return apiClient.put<AlertRule>(`/alerts/rules/${id}`, rule);
  },

  /**
   * 删除告警规则
   * @param id - 规则 ID
   * @returns 空响应
   */
  deleteRule: (id: string): Promise<void> => {
    return apiClient.delete<void>(`/alerts/rules/${id}`);
  },

  /**
   * 启用告警规则
   * @param id - 规则 ID
   * @returns 更新后的规则
   */
  enableRule: (id: string): Promise<AlertRule> => {
    return apiClient.post<AlertRule>(`/alerts/rules/${id}/enable`);
  },

  /**
   * 禁用告警规则
   * @param id - 规则 ID
   * @returns 更新后的规则
   */
  disableRule: (id: string): Promise<AlertRule> => {
    return apiClient.post<AlertRule>(`/alerts/rules/${id}/disable`);
  },

  /**
   * 测试告警规则
   * @param rule - 规则数据
   * @returns 测试结果
   */
  testRule: (rule: CreateAlertRuleRequest): Promise<{
    triggered: boolean;
    matchCount: number;
    sampleMatches: unknown[];
  }> => {
    return apiClient.post('/alerts/rules/test', rule);
  },

  // ==========================================================================
  // 静默策略
  // ==========================================================================

  /**
   * 获取静默策略列表
   * @returns 静默策略数组
   */
  listSilencePolicies: (): Promise<SilencePolicy[]> => {
    return apiClient.get<SilencePolicy[]>('/alerts/silences');
  },

  /**
   * 创建静默策略
   * @param policy - 策略数据
   * @returns 创建的策略
   */
  createSilencePolicy: (policy: CreateSilencePolicyRequest): Promise<SilencePolicy> => {
    return apiClient.post<SilencePolicy>('/alerts/silences', policy);
  },

  /**
   * 更新静默策略
   * @param id - 策略 ID
   * @param policy - 更新数据
   * @returns 更新后的策略
   */
  updateSilencePolicy: (id: string, policy: Partial<CreateSilencePolicyRequest>): Promise<SilencePolicy> => {
    return apiClient.put<SilencePolicy>(`/alerts/silences/${id}`, policy);
  },

  /**
   * 删除静默策略
   * @param id - 策略 ID
   * @returns 空响应
   */
  deleteSilencePolicy: (id: string): Promise<void> => {
    return apiClient.delete<void>(`/alerts/silences/${id}`);
  },

  // ==========================================================================
  // 通知配置
  // ==========================================================================

  /**
   * 获取通知渠道列表
   * @returns 通知渠道数组
   */
  listNotificationChannels: (): Promise<NotificationChannel[]> => {
    return apiClient.get<NotificationChannel[]>('/alerts/notifications/channels');
  },

  /**
   * 创建通知渠道
   * @param channel - 渠道数据
   * @returns 创建的渠道
   */
  createNotificationChannel: (channel: Omit<NotificationChannel, 'id' | 'createdAt' | 'updatedAt'>): Promise<NotificationChannel> => {
    return apiClient.post<NotificationChannel>('/alerts/notifications/channels', channel);
  },

  /**
   * 测试通知渠道
   * @param id - 渠道 ID
   * @returns 测试结果
   */
  testNotificationChannel: (id: string): Promise<{ success: boolean; message: string }> => {
    return apiClient.post(`/alerts/notifications/channels/${id}/test`);
  },

  /**
   * 删除通知渠道
   * @param id - 渠道 ID
   * @returns 空响应
   */
  deleteNotificationChannel: (id: string): Promise<void> => {
    return apiClient.delete<void>(`/alerts/notifications/channels/${id}`);
  },
};

export default alertsApi;
