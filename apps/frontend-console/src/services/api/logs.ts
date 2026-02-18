/**
 * 日志 API 模块
 * 
 * 提供日志相关的 API 接口：
 * - search: 搜索日志
 * - getById: 获取单条日志
 * - export: 导出日志
 * - histogram: 获取日志直方图
 */

import { apiClient } from './client';
import type { 
  LogEntry, 
  LogSearchRequest,
  LogSearchResponse,
  HistogramRequest,
  HistogramDataPoint,
  SavedQuery,
  QueryHistory,
  LogExportRequest,
  ExportTask,
} from '../../types/log';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 日志上下文请求
 */
export interface LogContextRequest {
  logId: string;
  before?: number;
  after?: number;
}

/**
 * 日志上下文响应
 */
export interface LogContextResponse {
  before: LogEntry[];
  current: LogEntry;
  after: LogEntry[];
}

/**
 * 字段值请求
 */
export interface FieldValuesRequest {
  field: string;
  query?: string;
  limit?: number;
  [key: string]: unknown;
}

// ============================================================================
// API 接口
// ============================================================================

/**
 * 日志 API
 */
export const logsApi = {
  /**
   * 搜索日志
   * @param request - 搜索请求
   * @returns 搜索响应
   */
  search: (request: LogSearchRequest): Promise<LogSearchResponse> => {
    return apiClient.post<LogSearchResponse>('/logs/search', request);
  },

  /**
   * 获取单条日志
   * @param id - 日志 ID
   * @returns 日志条目
   */
  getById: (id: string): Promise<LogEntry> => {
    return apiClient.get<LogEntry>(`/logs/${id}`);
  },

  /**
   * 获取日志上下文
   * @param request - 上下文请求
   * @returns 上下文响应
   */
  getContext: (request: LogContextRequest): Promise<LogContextResponse> => {
    const { logId, before = 10, after = 10 } = request;
    return apiClient.get<LogContextResponse>(`/logs/${logId}/context`, {
      params: { before, after },
    });
  },

  /**
   * 导出日志
   * @param request - 导出请求
   * @returns 导出任务
   */
  export: (request: LogExportRequest): Promise<ExportTask> => {
    return apiClient.post<ExportTask>('/logs/export', request);
  },

  /**
   * 获取导出任务状态
   * @param taskId - 任务 ID
   * @returns 导出任务
   */
  getExportTask: (taskId: string): Promise<ExportTask> => {
    return apiClient.get<ExportTask>(`/logs/export/${taskId}`);
  },

  /**
   * 下载导出文件
   * @param taskId - 任务 ID
   * @returns 文件 Blob
   */
  downloadExport: (taskId: string): Promise<Blob> => {
    return apiClient.get<Blob>(`/logs/export/${taskId}/download`, {
      headers: { Accept: 'application/octet-stream' },
    });
  },

  /**
   * 获取日志直方图
   * @param request - 直方图请求
   * @returns 直方图数据点数组
   */
  histogram: (request: HistogramRequest): Promise<HistogramDataPoint[]> => {
    return apiClient.post<HistogramDataPoint[]>('/logs/histogram', request);
  },

  /**
   * 获取字段值列表
   * @param request - 字段值请求
   * @returns 字段值数组
   */
  getFieldValues: (request: FieldValuesRequest): Promise<string[]> => {
    return apiClient.get<string[]>('/logs/fields/values', {
      params: request,
    });
  },

  /**
   * 获取可用字段列表
   * @returns 字段名数组
   */
  getFields: (): Promise<string[]> => {
    return apiClient.get<string[]>('/logs/fields');
  },

  // ==========================================================================
  // 保存的查询
  // ==========================================================================

  /**
   * 获取保存的查询列表
   * @returns 保存的查询数组
   */
  getSavedQueries: (): Promise<SavedQuery[]> => {
    return apiClient.get<SavedQuery[]>('/logs/queries/saved');
  },

  /**
   * 创建保存的查询
   * @param query - 查询数据
   * @returns 创建的查询
   */
  createSavedQuery: (query: Omit<SavedQuery, 'id' | 'createdAt' | 'updatedAt' | 'lastUsedAt' | 'useCount' | 'createdBy'>): Promise<SavedQuery> => {
    return apiClient.post<SavedQuery>('/logs/queries/saved', query);
  },

  /**
   * 更新保存的查询
   * @param id - 查询 ID
   * @param query - 更新数据
   * @returns 更新后的查询
   */
  updateSavedQuery: (id: string, query: Partial<SavedQuery>): Promise<SavedQuery> => {
    return apiClient.put<SavedQuery>(`/logs/queries/saved/${id}`, query);
  },

  /**
   * 删除保存的查询
   * @param id - 查询 ID
   * @returns 空响应
   */
  deleteSavedQuery: (id: string): Promise<void> => {
    return apiClient.delete<void>(`/logs/queries/saved/${id}`);
  },

  // ==========================================================================
  // 查询历史
  // ==========================================================================

  /**
   * 获取查询历史
   * @param limit - 限制数量
   * @returns 查询历史数组
   */
  getQueryHistory: (limit?: number): Promise<QueryHistory[]> => {
    return apiClient.get<QueryHistory[]>('/logs/queries/history', {
      params: { limit },
    });
  },

  /**
   * 清除查询历史
   * @returns 空响应
   */
  clearQueryHistory: (): Promise<void> => {
    return apiClient.delete<void>('/logs/queries/history');
  },
};

export default logsApi;
