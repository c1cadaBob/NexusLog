/**
 * 仪表板 API 模块
 * 
 * 提供仪表板相关的 API 接口：
 * - list: 获取仪表板列表
 * - getById: 获取单个仪表板
 * - create: 创建仪表板
 * - update: 更新仪表板
 * - delete: 删除仪表板
 */

import { apiClient } from './client';
import type { 
  Dashboard, 
  DashboardSummary,
  CreateDashboardRequest,
  UpdateDashboardRequest,
  Widget,
} from '../../types/dashboard';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 仪表板列表查询参数
 */
export interface DashboardListParams {
  search?: string;
  tags?: string[];
  isPublic?: boolean;
  page?: number;
  pageSize?: number;
  [key: string]: unknown;
}

/**
 * 仪表板分享请求
 */
export interface ShareDashboardRequest {
  userIds: string[];
  permission: 'view' | 'edit';
}

/**
 * 仪表板克隆请求
 */
export interface CloneDashboardRequest {
  name: string;
  description?: string;
}

/**
 * 组件数据请求
 */
export interface WidgetDataRequest {
  dashboardId: string;
  widgetId: string;
  timeRange?: {
    start: number;
    end: number;
  };
  variables?: Record<string, string>;
}

// ============================================================================
// API 接口
// ============================================================================

/**
 * 仪表板 API
 */
export const dashboardApi = {
  // ==========================================================================
  // 仪表板 CRUD
  // ==========================================================================

  /**
   * 获取仪表板列表
   * @param params - 查询参数
   * @returns 仪表板摘要数组
   */
  list: (params?: DashboardListParams): Promise<DashboardSummary[]> => {
    return apiClient.get<DashboardSummary[]>('/dashboards', { params });
  },

  /**
   * 获取单个仪表板
   * @param id - 仪表板 ID
   * @returns 仪表板详情
   */
  getById: (id: string): Promise<Dashboard> => {
    return apiClient.get<Dashboard>(`/dashboards/${id}`);
  },

  /**
   * 创建仪表板
   * @param dashboard - 仪表板数据
   * @returns 创建的仪表板
   */
  create: (dashboard: CreateDashboardRequest): Promise<Dashboard> => {
    return apiClient.post<Dashboard>('/dashboards', dashboard);
  },

  /**
   * 更新仪表板
   * @param id - 仪表板 ID
   * @param dashboard - 更新数据
   * @returns 更新后的仪表板
   */
  update: (id: string, dashboard: UpdateDashboardRequest): Promise<Dashboard> => {
    return apiClient.put<Dashboard>(`/dashboards/${id}`, dashboard);
  },

  /**
   * 删除仪表板
   * @param id - 仪表板 ID
   * @returns 空响应
   */
  delete: (id: string): Promise<void> => {
    return apiClient.delete<void>(`/dashboards/${id}`);
  },

  // ==========================================================================
  // 仪表板操作
  // ==========================================================================

  /**
   * 克隆仪表板
   * @param id - 源仪表板 ID
   * @param request - 克隆请求
   * @returns 克隆的仪表板
   */
  clone: (id: string, request: CloneDashboardRequest): Promise<Dashboard> => {
    return apiClient.post<Dashboard>(`/dashboards/${id}/clone`, request);
  },

  /**
   * 分享仪表板
   * @param id - 仪表板 ID
   * @param request - 分享请求
   * @returns 更新后的仪表板
   */
  share: (id: string, request: ShareDashboardRequest): Promise<Dashboard> => {
    return apiClient.post<Dashboard>(`/dashboards/${id}/share`, request);
  },

  /**
   * 取消分享
   * @param id - 仪表板 ID
   * @param userId - 用户 ID
   * @returns 更新后的仪表板
   */
  unshare: (id: string, userId: string): Promise<Dashboard> => {
    return apiClient.delete<Dashboard>(`/dashboards/${id}/share/${userId}`);
  },

  /**
   * 设为默认仪表板
   * @param id - 仪表板 ID
   * @returns 更新后的仪表板
   */
  setDefault: (id: string): Promise<Dashboard> => {
    return apiClient.post<Dashboard>(`/dashboards/${id}/default`);
  },

  /**
   * 获取默认仪表板
   * @returns 默认仪表板
   */
  getDefault: (): Promise<Dashboard | null> => {
    return apiClient.get<Dashboard | null>('/dashboards/default');
  },

  /**
   * 导出仪表板
   * @param id - 仪表板 ID
   * @returns 仪表板 JSON 数据
   */
  export: (id: string): Promise<Dashboard> => {
    return apiClient.get<Dashboard>(`/dashboards/${id}/export`);
  },

  /**
   * 导入仪表板
   * @param dashboard - 仪表板数据
   * @returns 导入的仪表板
   */
  import: (dashboard: Dashboard): Promise<Dashboard> => {
    return apiClient.post<Dashboard>('/dashboards/import', dashboard);
  },

  // ==========================================================================
  // 组件管理
  // ==========================================================================

  /**
   * 添加组件
   * @param dashboardId - 仪表板 ID
   * @param widget - 组件数据
   * @returns 更新后的仪表板
   */
  addWidget: (dashboardId: string, widget: Omit<Widget, 'id'>): Promise<Dashboard> => {
    return apiClient.post<Dashboard>(`/dashboards/${dashboardId}/widgets`, widget);
  },

  /**
   * 更新组件
   * @param dashboardId - 仪表板 ID
   * @param widgetId - 组件 ID
   * @param widget - 更新数据
   * @returns 更新后的仪表板
   */
  updateWidget: (dashboardId: string, widgetId: string, widget: Partial<Widget>): Promise<Dashboard> => {
    return apiClient.put<Dashboard>(`/dashboards/${dashboardId}/widgets/${widgetId}`, widget);
  },

  /**
   * 删除组件
   * @param dashboardId - 仪表板 ID
   * @param widgetId - 组件 ID
   * @returns 更新后的仪表板
   */
  deleteWidget: (dashboardId: string, widgetId: string): Promise<Dashboard> => {
    return apiClient.delete<Dashboard>(`/dashboards/${dashboardId}/widgets/${widgetId}`);
  },

  /**
   * 更新组件布局
   * @param dashboardId - 仪表板 ID
   * @param layouts - 组件布局数组
   * @returns 更新后的仪表板
   */
  updateWidgetLayouts: (
    dashboardId: string, 
    layouts: Array<{ id: string; position: Widget['position'] }>
  ): Promise<Dashboard> => {
    return apiClient.put<Dashboard>(`/dashboards/${dashboardId}/layouts`, { layouts });
  },

  /**
   * 获取组件数据
   * @param request - 数据请求
   * @returns 组件数据
   */
  getWidgetData: <T = unknown>(request: WidgetDataRequest): Promise<T> => {
    const { dashboardId, widgetId, ...params } = request;
    return apiClient.get<T>(`/dashboards/${dashboardId}/widgets/${widgetId}/data`, { params });
  },

  // ==========================================================================
  // 仪表板模板
  // ==========================================================================

  /**
   * 获取仪表板模板列表
   * @returns 模板数组
   */
  listTemplates: (): Promise<DashboardSummary[]> => {
    return apiClient.get<DashboardSummary[]>('/dashboards/templates');
  },

  /**
   * 从模板创建仪表板
   * @param templateId - 模板 ID
   * @param name - 仪表板名称
   * @returns 创建的仪表板
   */
  createFromTemplate: (templateId: string, name: string): Promise<Dashboard> => {
    return apiClient.post<Dashboard>(`/dashboards/templates/${templateId}/create`, { name });
  },
};

export default dashboardApi;
