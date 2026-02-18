/**
 * 日志相关类型定义
 */

import type { ID, Timestamp, PaginationParams } from './common';

// ============================================================================
// 日志级别
// ============================================================================

/**
 * 日志级别
 */
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

/**
 * 日志级别配置
 */
export const LOG_LEVEL_CONFIG: Record<LogLevel, { label: string; color: string; priority: number }> = {
  DEBUG: { label: '调试', color: 'text-gray-400', priority: 0 },
  INFO: { label: '信息', color: 'text-blue-400', priority: 1 },
  WARN: { label: '警告', color: 'text-yellow-400', priority: 2 },
  ERROR: { label: '错误', color: 'text-red-400', priority: 3 },
  FATAL: { label: '致命', color: 'text-red-600', priority: 4 },
};

// ============================================================================
// 日志条目
// ============================================================================

/**
 * 日志条目
 */
export interface LogEntry {
  id: ID;
  timestamp: Timestamp;
  level: LogLevel;
  service: string;
  message: string;
  host?: string;
  traceId?: string;
  spanId?: string;
  fields: Record<string, unknown>;
  raw: string;
  source?: string;
  tags?: string[];
}

/**
 * 日志条目摘要（用于列表显示）
 */
export interface LogEntrySummary {
  id: ID;
  timestamp: Timestamp;
  level: LogLevel;
  service: string;
  message: string;
}

// ============================================================================
// 日志查询
// ============================================================================

/**
 * 过滤操作符
 */
export type FilterOperator =
  | 'eq'      // 等于
  | 'ne'      // 不等于
  | 'gt'      // 大于
  | 'gte'     // 大于等于
  | 'lt'      // 小于
  | 'lte'     // 小于等于
  | 'in'      // 在列表中
  | 'nin'     // 不在列表中
  | 'contains'    // 包含
  | 'not_contains' // 不包含
  | 'starts_with'  // 以...开头
  | 'ends_with'    // 以...结尾
  | 'regex'        // 正则匹配
  | 'exists'       // 字段存在
  | 'not_exists';  // 字段不存在

/**
 * 日志过滤器
 */
export interface LogFilter {
  field: string;
  operator: FilterOperator;
  value: unknown;
}

/**
 * 时间范围
 */
export interface TimeRange {
  start: Timestamp;
  end: Timestamp;
  relative?: string;
}

/**
 * 日志查询参数
 */
export interface LogQuery extends PaginationParams {
  query: string;
  timeRange: TimeRange;
  filters: LogFilter[];
  sort?: {
    field: string;
    order: 'asc' | 'desc';
  };
}

/**
 * 日志搜索请求
 */
export interface LogSearchRequest extends LogQuery {
  highlight?: boolean;
  aggregations?: LogAggregation[];
}

/**
 * 日志搜索响应
 */
export interface LogSearchResponse {
  logs: LogEntry[];
  total: number;
  took: number;
  aggregations?: Record<string, AggregationResult>;
}

// ============================================================================
// 日志聚合
// ============================================================================

/**
 * 聚合类型
 */
export type AggregationType =
  | 'count'
  | 'sum'
  | 'avg'
  | 'min'
  | 'max'
  | 'terms'
  | 'histogram'
  | 'date_histogram'
  | 'percentiles';

/**
 * 日志聚合配置
 */
export interface LogAggregation {
  name: string;
  type: AggregationType;
  field: string;
  interval?: string;
  size?: number;
}

/**
 * 聚合结果
 */
export interface AggregationResult {
  buckets?: AggregationBucket[];
  value?: number;
  values?: Record<string, number>;
}

/**
 * 聚合桶
 */
export interface AggregationBucket {
  key: string | number;
  doc_count: number;
  [key: string]: unknown;
}

// ============================================================================
// 日志直方图
// ============================================================================

/**
 * 直方图数据点
 */
export interface HistogramDataPoint {
  timestamp: Timestamp;
  count: number;
  [key: string]: number;
}

/**
 * 直方图请求
 */
export interface HistogramRequest {
  query: string;
  timeRange: TimeRange;
  interval: string;
  filters?: LogFilter[];
  groupBy?: string;
}

// ============================================================================
// 保存的查询
// ============================================================================

/**
 * 保存的查询
 */
export interface SavedQuery {
  id: ID;
  name: string;
  description?: string;
  query: string;
  filters: LogFilter[];
  timeRange?: TimeRange;
  tags?: string[];
  isPublic: boolean;
  createdBy: ID;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastUsedAt?: Timestamp;
  useCount: number;
}

/**
 * 查询历史记录
 */
export interface QueryHistory {
  id: ID;
  query: string;
  filters: LogFilter[];
  timeRange: TimeRange;
  resultCount: number;
  executionTime: number;
  executedAt: Timestamp;
}

// ============================================================================
// 日志导出
// ============================================================================

/**
 * 导出格式
 */
export type ExportFormat = 'csv' | 'json' | 'excel';

/**
 * 导出请求
 */
export interface LogExportRequest {
  query: LogQuery;
  format: ExportFormat;
  columns?: string[];
  maxRows?: number;
}

/**
 * 导出任务状态
 */
export type ExportStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * 导出任务
 */
export interface ExportTask {
  id: ID;
  status: ExportStatus;
  format: ExportFormat;
  progress: number;
  totalRows: number;
  downloadUrl?: string;
  error?: string;
  createdAt: Timestamp;
  completedAt?: Timestamp;
}
