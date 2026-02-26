import type { MenuSection } from '../types/navigation';

/**
 * 侧边栏菜单配置
 * 7 个分组、15 个一级菜单、所有子菜单项
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
          { icon: 'bar_chart', label: '聚合分析', path: '/analysis/aggregate' },
          { icon: 'monitoring', label: '异常检测', path: '/analysis/anomaly' },
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
      {
        icon: 'schema',
        label: '解析与字段',
        children: [
          { icon: 'swap_horiz', label: '字段映射', path: '/parsing/mapping' },
          { icon: 'code', label: '解析规则', path: '/parsing/rules' },
          { icon: 'visibility_off', label: '脱敏规则', path: '/parsing/masking' },
          { icon: 'menu_book', label: '字段字典', path: '/parsing/dictionary' },
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
          { icon: 'open_with', label: '扩缩容策略', path: '/performance/scaling' },
          { icon: 'sync_alt', label: '灾备状态', path: '/performance/dr' },
        ],
      },
    ],
  },
  {
    title: '可观测性扩展',
    items: [
      {
        icon: 'hub',
        label: '分布式追踪',
        children: [
          { icon: 'travel_explore', label: 'Trace 搜索', path: '/tracing/search' },
          { icon: 'account_tree', label: '调用链分析', path: '/tracing/analysis' },
          { icon: 'device_hub', label: '服务拓扑', path: '/tracing/topology' },
        ],
      },
      {
        icon: 'bar_chart',
        label: '报表中心',
        children: [
          { icon: 'description', label: '报表管理', path: '/reports/management' },
          { icon: 'schedule', label: '定时任务', path: '/reports/scheduled' },
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
          { icon: 'api', label: 'API 文档', path: '/integration/api' },
          { icon: 'webhook', label: 'Webhook', path: '/integration/webhook' },
          { icon: 'developer_mode', label: 'SDK 下载', path: '/integration/sdk' },
          { icon: 'store', label: '插件市场', path: '/integration/plugins' },
        ],
      },
    ],
  },
  {
    title: '系统配置',
    items: [
      {
        icon: 'savings',
        label: '成本管理',
        children: [
          { icon: 'pie_chart', label: '成本概览', path: '/cost/overview' },
          { icon: 'price_check', label: '预算告警', path: '/cost/budgets' },
          { icon: 'lightbulb', label: '优化建议', path: '/cost/optimization' },
        ],
      },
      {
        icon: 'settings',
        label: '系统设置',
        children: [
          { icon: 'tune', label: '系统参数', path: '/settings/parameters' },
          { icon: 'toggle_on', label: '全局配置', path: '/settings/global' },
          { icon: 'history', label: '配置版本', path: '/settings/versions' },
        ],
      },
      {
        icon: 'help_outline',
        label: '帮助中心',
        children: [
          { icon: 'terminal', label: '查询语法', path: '/help/syntax' },
          { icon: 'quiz', label: 'FAQ', path: '/help/faq' },
          { icon: 'confirmation_number', label: '工单入口', path: '/help/tickets' },
        ],
      },
    ],
  },
];
