import type { KpiData, ServiceStatus, AuditLog } from '../types/dashboard';

/** Dashboard KPI 卡片静态数据 */
export const KPI_DATA: KpiData[] = [
  { title: '总日志量', value: '45.2M', trend: '+12.5%', trendType: 'up', trendLabel: '较昨日', icon: 'data_usage', color: 'primary' },
  { title: '错误率', value: '7.2%', trend: '-2.1%', trendType: 'down', trendLabel: '较昨日', icon: 'error', color: 'danger' },
  { title: '未处理告警', value: '12', trend: '+3', trendType: 'up', trendLabel: '较上周', icon: 'notifications_active', color: 'warning' },
  { title: '写入速率 (QPS)', value: '24.5k', trend: '〜 稳定', trendType: 'neutral', trendLabel: '峰值 28k', icon: 'speed', color: 'success' },
  { title: '存储使用率', value: '68%', trend: '+2.3%', trendType: 'up', trendLabel: '较上周', icon: 'hard_drive', color: 'info' },
  { title: '采集成功率', value: '99.98%', trend: '〜 健康', trendType: 'neutral', trendLabel: '0.02% 丢包', icon: 'check_circle', color: 'success' },
];

/** 异常服务排行 Top 5 */
export const SERVICE_STATUS_DATA: ServiceStatus[] = [
  { name: 'payment-service', errorRate: 15.2, status: 'critical' },
  { name: 'order-api', errorRate: 8.7, status: 'warning' },
  { name: 'user-service', errorRate: 3.1, status: 'warning' },
  { name: 'auth-service', errorRate: 1.5, status: 'healthy' },
  { name: 'notification-svc', errorRate: 0.8, status: 'healthy' },
];

/** 最近审计活动 */
export const AUDIT_LOG_DATA: AuditLog[] = [
  { time: '2 分钟前', user: 'admin', action: '更新了告警规则', target: 'high-error-rate', type: 'update' },
  { time: '15 分钟前', user: 'zhangsan', action: '创建了数据源', target: 'nginx-access-log', type: 'create' },
  { time: '1 小时前', user: 'lisi', action: '删除了过期索引', target: 'logs-2024-01', type: 'delete' },
  { time: '2 小时前', user: 'admin', action: '更新了系统参数', target: '日志保留天数', type: 'update' },
  { time: '3 小时前', user: 'wangwu', action: '创建了告警规则', target: 'cpu-threshold', type: 'create' },
];

/** 快速操作入口 */
export const QUICK_ACTIONS = [
  { icon: 'add_to_queue', label: '新建采集源', path: '/ingestion/wizard', color: 'primary' as const },
  { icon: 'notification_add', label: '新建告警规则', path: '/alerts/rules', color: 'warning' as const },
  { icon: 'database', label: '创建索引', path: '/storage/indices', color: 'success' as const },
  { icon: 'description', label: '生成报表', path: '/reports/management', color: 'info' as const },
];
