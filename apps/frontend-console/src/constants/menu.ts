import type { MenuSection } from '../types/navigation';

/**
 * 菜单展示配置
 * - 仅负责图标、标签和路由组织
 * - 页面访问授权统一由 routeAuthorization.ts 判定
 * 图标使用 Google Material Symbols 名称
 */
export const MENU_SECTIONS: MenuSection[] = [
  {
    title: '监控与检索',
    items: [
      { icon: 'dashboard', label: '概览', path: '/' },
    ],
  },
  {
    title: '日志检索',
    items: [
      {
        icon: 'manage_search',
        label: '日志检索',
        children: [
          { icon: 'search', label: '实时检索', path: '/search/realtime' },
          { icon: 'history', label: '查询历史', path: '/search/history' },
          { icon: 'bookmark', label: '收藏查询', path: '/search/saved' },
        ],
      },
      {
        icon: 'analytics',
        label: '日志分析',
        children: [
          { icon: 'hub', label: '聚类分析', path: '/analysis/clustering' },
        ],
      },
      {
        icon: 'notifications_active',
        label: '告警中心',
        children: [
          { icon: 'list', label: '告警列表', path: '/alerts/list' },
          { icon: 'rule', label: '告警规则', path: '/alerts/rules' },
          { icon: 'forward_to_inbox', label: '通知配置', path: '/alerts/notifications' },
          { icon: 'do_not_disturb_on', label: '静默策略', path: '/alerts/silence' },
        ],
      },
      {
        icon: 'assignment',
        label: '事件管理',
        children: [
          { icon: 'local_fire_department', label: '事件列表', path: '/incidents/list' },
          { icon: 'timeline', label: '全流程时间线', path: '/incidents/timeline' },
          { icon: 'biotech', label: '根因分析', path: '/incidents/analysis' },
          { icon: 'timer', label: 'SLA 监控', path: '/incidents/sla' },
          { icon: 'archive', label: '归档管理', path: '/incidents/archive' },
        ],
      },
    ],
  },
  {
    title: '数据接入',
    items: [
      {
        icon: 'input',
        label: '采集与接入',
        children: [
          { icon: 'dns', label: '采集源管理', path: '/ingestion/sources' },
          { icon: 'smart_toy', label: 'Agent 管理', path: '/ingestion/agents' },
          { icon: 'assistant_navigation', label: '接入向导', path: '/ingestion/wizard' },
          { icon: 'monitor_heart', label: '数据源状态', path: '/ingestion/status' },
        ],
      },
    ],
  },
  {
    title: '存储与性能',
    items: [
      {
        icon: 'storage',
        label: '索引与存储',
        children: [
          { icon: 'table_chart', label: '索引管理', path: '/storage/indices' },
          { icon: 'update', label: '生命周期 ILM', path: '/storage/ilm' },
          { icon: 'backup', label: '备份与恢复', path: '/storage/backup' },
          { icon: 'hard_drive', label: '容量监控', path: '/storage/capacity' },
        ],
      },
      {
        icon: 'speed',
        label: '性能与高可用',
        children: [
          { icon: 'trending_up', label: '性能监控', path: '/performance/monitoring' },
          { icon: 'health_and_safety', label: '健康检查', path: '/performance/health' },
        ],
      },
    ],
  },
  {
    title: '可观测性扩展',
    items: [
      {
        icon: 'bar_chart',
        label: '报表中心',
        children: [
          { icon: 'description', label: '报表管理', path: '/reports/management' },
          { icon: 'download', label: '下载记录', path: '/reports/downloads' },
        ],
      },
    ],
  },
  {
    title: '平台与管理',
    items: [
      {
        icon: 'admin_panel_settings',
        label: '安全与审计',
        children: [
          { icon: 'people', label: '用户管理', path: '/security/users' },
          { icon: 'shield', label: '角色权限', path: '/security/roles' },
          { icon: 'receipt_long', label: '审计日志', path: '/security/audit' },
          { icon: 'policy', label: '登录策略', path: '/security/login-policy' },
        ],
      },
      {
        icon: 'extension',
        label: '集成与开放平台',
        children: [
          { icon: 'webhook', label: 'Webhook', path: '/integration/webhook' },
        ],
      },
    ],
  },
  {
    title: '系统配置',
    items: [
      {
        icon: 'help_outline',
        label: '帮助中心',
        children: [
          { icon: 'quiz', label: 'FAQ', path: '/help/faq' },
        ],
      },
    ],
  },
];
