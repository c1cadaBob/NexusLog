/**
 * 仪表板相关类型定义
 */

import type { ID, Timestamp } from './common';
import type { TimeRange } from './log';

// ============================================================================
// 仪表板
// ============================================================================

/**
 * 仪表板
 */
export interface Dashboard {
  id: ID;
  name: string;
  description?: string;
  layout: DashboardLayout;
  widgets: Widget[];
  variables: DashboardVariable[];
  timeRange?: TimeRange;
  refreshInterval?: number;
  tags?: string[];
  isPublic: boolean;
  isDefault: boolean;
  owner: ID;
  sharedWith: ID[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * 仪表板摘要
 */
export interface DashboardSummary {
  id: ID;
  name: string;
  description?: string;
  widgetCount: number;
  isPublic: boolean;
  isDefault: boolean;
  owner: ID;
  updatedAt: Timestamp;
}

/**
 * 创建仪表板请求
 */
export interface CreateDashboardRequest {
  name: string;
  description?: string;
  layout?: DashboardLayout;
  widgets?: Widget[];
  variables?: DashboardVariable[];
  timeRange?: TimeRange;
  refreshInterval?: number;
  tags?: string[];
  isPublic?: boolean;
}

/**
 * 更新仪表板请求
 */
export interface UpdateDashboardRequest {
  name?: string;
  description?: string;
  layout?: DashboardLayout;
  widgets?: Widget[];
  variables?: DashboardVariable[];
  timeRange?: TimeRange;
  refreshInterval?: number;
  tags?: string[];
  isPublic?: boolean;
  isDefault?: boolean;
}

// ============================================================================
// 仪表板布局
// ============================================================================

/**
 * 仪表板布局
 */
export interface DashboardLayout {
  columns: number;
  rowHeight: number;
  gap: number;
  isDraggable: boolean;
  isResizable: boolean;
}

/**
 * 默认布局配置
 */
export const DEFAULT_DASHBOARD_LAYOUT: DashboardLayout = {
  columns: 12,
  rowHeight: 80,
  gap: 16,
  isDraggable: true,
  isResizable: true,
};

// ============================================================================
// 仪表板变量
// ============================================================================

/**
 * 变量类型
 */
export type VariableType = 'query' | 'custom' | 'constant' | 'interval' | 'datasource';

/**
 * 仪表板变量
 */
export interface DashboardVariable {
  name: string;
  label: string;
  type: VariableType;
  query?: string;
  options?: string[];
  current: string | string[];
  multi: boolean;
  includeAll: boolean;
  allValue?: string;
  refresh: 'never' | 'on_load' | 'on_time_change';
}

// ============================================================================
// 组件
// ============================================================================

/**
 * 组件类型
 */
export type WidgetType =
  | 'stat'
  | 'gauge'
  | 'line_chart'
  | 'bar_chart'
  | 'pie_chart'
  | 'area_chart'
  | 'heatmap'
  | 'table'
  | 'logs'
  | 'alerts'
  | 'text'
  | 'iframe';

/**
 * 组件位置
 */
export interface WidgetPosition {
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
}

/**
 * 组件
 */
export interface Widget {
  id: ID;
  type: WidgetType;
  title: string;
  description?: string;
  position: WidgetPosition;
  config: WidgetConfig;
  datasource?: string;
}

/**
 * 组件配置
 */
export interface WidgetConfig {
  query?: string;
  timeRange?: TimeRange;
  refreshInterval?: number;
  [key: string]: unknown;
}

// ============================================================================
// 统计组件配置
// ============================================================================

/**
 * 统计组件配置
 */
export interface StatWidgetConfig extends WidgetConfig {
  unit?: string;
  decimals?: number;
  colorMode?: 'value' | 'background';
  thresholds?: Threshold[];
  sparkline?: boolean;
}

/**
 * 阈值
 */
export interface Threshold {
  value: number;
  color: string;
}

// ============================================================================
// 图表组件配置
// ============================================================================

/**
 * 图表组件配置
 */
export interface ChartWidgetConfig extends WidgetConfig {
  legend?: LegendConfig;
  xAxis?: AxisConfig;
  yAxis?: AxisConfig;
  series?: SeriesConfig[];
  tooltip?: TooltipConfig;
}

/**
 * 图例配置
 */
export interface LegendConfig {
  show: boolean;
  position: 'top' | 'bottom' | 'left' | 'right';
  mode: 'list' | 'table';
}

/**
 * 坐标轴配置
 */
export interface AxisConfig {
  show: boolean;
  label?: string;
  min?: number;
  max?: number;
  unit?: string;
  decimals?: number;
}

/**
 * 系列配置
 */
export interface SeriesConfig {
  name: string;
  field: string;
  color?: string;
  type?: 'line' | 'bar' | 'area';
  stack?: string;
}

/**
 * 提示框配置
 */
export interface TooltipConfig {
  show: boolean;
  mode: 'single' | 'all';
  sort: 'none' | 'asc' | 'desc';
}

// ============================================================================
// 表格组件配置
// ============================================================================

/**
 * 表格组件配置
 */
export interface TableWidgetConfig extends WidgetConfig {
  columns?: TableColumn[];
  pageSize?: number;
  showPagination?: boolean;
  sortable?: boolean;
  filterable?: boolean;
}

/**
 * 表格列配置
 */
export interface TableColumn {
  field: string;
  title: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  filterable?: boolean;
  format?: string;
  thresholds?: Threshold[];
}

// ============================================================================
// 日志组件配置
// ============================================================================

/**
 * 日志组件配置
 */
export interface LogsWidgetConfig extends WidgetConfig {
  showTime?: boolean;
  showLabels?: boolean;
  wrapLines?: boolean;
  sortOrder?: 'asc' | 'desc';
  deduplication?: 'none' | 'exact' | 'numbers' | 'signature';
}

// ============================================================================
// 文本组件配置
// ============================================================================

/**
 * 文本组件配置
 */
export interface TextWidgetConfig extends WidgetConfig {
  content: string;
  mode: 'markdown' | 'html';
}
