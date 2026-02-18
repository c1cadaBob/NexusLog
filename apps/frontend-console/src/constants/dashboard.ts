/**
 * Dashboard 相关常量
 */

import type { KpiData, ServiceStatus, AuditLog } from '../types';

// ============================================================================
// KPI 数据
// ============================================================================

/**
 * 默认 KPI 数据
 */
export const KPI_DATA: KpiData[] = [
  { 
    title: '总日志量', 
    value: '45.2M', 
    trend: '12%', 
    trendType: 'up', 
    trendLabel: 'vs 上周期', 
    icon: 'data_usage', 
    color: 'primary' 
  },
  { 
    title: '错误率', 
    value: '7.2%', 
    trend: '2.1%', 
    trendType: 'down', 
    trendLabel: '需关注', 
    icon: 'error', 
    color: 'danger' 
  },
  { 
    title: '未处理告警', 
    value: '12', 
    trend: '+3 新增', 
    trendType: 'neutral', 
    trendLabel: '自登录', 
    icon: 'notifications_active', 
    color: 'warning' 
  },
  { 
    title: '写入速率 (QPS)', 
    value: '24.5k', 
    trend: '稳定', 
    trendType: 'up', 
    trendLabel: '峰值 28k', 
    icon: 'speed', 
    color: 'info' 
  },
  { 
    title: '存储使用率', 
    value: '68%', 
    trend: '', 
    trendType: 'neutral', 
    trendLabel: '', 
    icon: 'hard_drive', 
    color: 'primary' 
  },
  { 
    title: '采集成功率', 
    value: '99.98%', 
    trend: '健康', 
    trendType: 'up', 
    trendLabel: '0.02% 丢包', 
    icon: 'check_circle', 
    color: 'success' 
  },
];

// ============================================================================
// 服务状态
// ============================================================================

/**
 * 默认服务状态数据
 */
export const TOP_SERVICES: ServiceStatus[] = [
  { name: 'auth-service', errorRate: 2401, status: 'critical' },
  { name: 'payment-gateway', errorRate: 1120, status: 'critical' },
  { name: 'inventory-api', errorRate: 856, status: 'warning' },
];

// ============================================================================
// 审计日志
// ============================================================================

/**
 * 默认审计日志数据
 */
export const RECENT_AUDITS: AuditLog[] = [
  { 
    time: '14:28', 
    user: 'admin', 
    action: '更新了', 
    target: '生命周期策略', 
    type: 'update' 
  },
  { 
    time: '13:15', 
    user: 'system', 
    action: '系统自动创建了新索引', 
    target: 'logs-prod-2023.10.27', 
    type: 'create' 
  },
];

// ============================================================================
// 刷新配置
// ============================================================================

/** 默认刷新间隔（毫秒） */
export const DEFAULT_REFRESH_INTERVAL = 30000;

/** 可用的刷新间隔选项 */
export const REFRESH_INTERVAL_OPTIONS = [
  { label: '关闭', value: 0 },
  { label: '5秒', value: 5000 },
  { label: '10秒', value: 10000 },
  { label: '30秒', value: 30000 },
  { label: '1分钟', value: 60000 },
  { label: '5分钟', value: 300000 },
];

/** localStorage 键名 */
export const REFRESH_INTERVAL_STORAGE_KEY = 'dashboard-refresh-interval';
