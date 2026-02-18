/**
 * 菜单配置常量
 * 
 * 定义侧边栏导航菜单结构，包含 15 个路由模块
 */

import type { MenuProps } from 'antd';
import type { ReactNode } from 'react';

/**
 * 菜单项类型
 */
export type MenuItem = Required<MenuProps>['items'][number];

/**
 * 菜单配置项接口
 */
export interface MenuConfig {
  key: string;
  label: string;
  labelEn: string;
  icon?: string;
  path?: string;
  children?: MenuConfig[];
  hidden?: boolean;
}

/**
 * 侧边栏菜单配置
 * 
 * 包含 15 个路由模块 + Dashboard 首页
 */
export const menuConfig: MenuConfig[] = [
  // Dashboard 首页
  {
    key: 'dashboard',
    label: '仪表盘',
    labelEn: 'Dashboard',
    icon: 'DashboardOutlined',
    path: '/dashboard',
  },
  
  // 1. 日志检索模块
  {
    key: 'search',
    label: '日志检索',
    labelEn: 'Log Search',
    icon: 'SearchOutlined',
    children: [
      {
        key: 'search-realtime',
        label: '实时搜索',
        labelEn: 'Realtime Search',
        path: '/search/realtime',
      },
      {
        key: 'search-history',
        label: '搜索历史',
        labelEn: 'Search History',
        path: '/search/history',
      },
      {
        key: 'search-saved',
        label: '保存的查询',
        labelEn: 'Saved Queries',
        path: '/search/saved',
      },
    ],
  },
  
  // 2. 日志分析模块
  {
    key: 'analysis',
    label: '日志分析',
    labelEn: 'Log Analysis',
    icon: 'LineChartOutlined',
    children: [
      {
        key: 'analysis-aggregate',
        label: '聚合分析',
        labelEn: 'Aggregate Analysis',
        path: '/analysis/aggregate',
      },
      {
        key: 'analysis-anomaly',
        label: '异常检测',
        labelEn: 'Anomaly Detection',
        path: '/analysis/anomaly',
      },
      {
        key: 'analysis-clustering',
        label: '日志聚类',
        labelEn: 'Log Clustering',
        path: '/analysis/clustering',
      },
    ],
  },
  
  // 3. 告警中心模块
  {
    key: 'alerts',
    label: '告警中心',
    labelEn: 'Alert Center',
    icon: 'AlertOutlined',
    children: [
      {
        key: 'alerts-list',
        label: '告警列表',
        labelEn: 'Alert List',
        path: '/alerts/list',
      },
      {
        key: 'alerts-rules',
        label: '告警规则',
        labelEn: 'Alert Rules',
        path: '/alerts/rules',
      },
      {
        key: 'alerts-notification',
        label: '通知配置',
        labelEn: 'Notification Config',
        path: '/alerts/notification',
      },
      {
        key: 'alerts-silence',
        label: '静默策略',
        labelEn: 'Silence Policy',
        path: '/alerts/silence',
      },
    ],
  },
  
  // 4. 采集接入模块
  {
    key: 'ingestion',
    label: '采集接入',
    labelEn: 'Data Ingestion',
    icon: 'CloudUploadOutlined',
    children: [
      {
        key: 'ingestion-sources',
        label: '数据源管理',
        labelEn: 'Source Management',
        path: '/ingestion/sources',
      },
      {
        key: 'ingestion-agents',
        label: 'Agent 管理',
        labelEn: 'Agent Management',
        path: '/ingestion/agents',
      },
      {
        key: 'ingestion-wizard',
        label: '接入向导',
        labelEn: 'Access Wizard',
        path: '/ingestion/wizard',
      },
      {
        key: 'ingestion-status',
        label: '数据源状态',
        labelEn: 'Source Status',
        path: '/ingestion/status',
      },
    ],
  },
  
  // 5. 解析字段模块
  {
    key: 'parsing',
    label: '解析字段',
    labelEn: 'Field Parsing',
    icon: 'PartitionOutlined',
    children: [
      {
        key: 'parsing-mapping',
        label: '字段映射',
        labelEn: 'Field Mapping',
        path: '/parsing/mapping',
      },
      {
        key: 'parsing-rules',
        label: '解析规则',
        labelEn: 'Parsing Rules',
        path: '/parsing/rules',
      },
      {
        key: 'parsing-masking',
        label: '脱敏规则',
        labelEn: 'Masking Rules',
        path: '/parsing/masking',
      },
      {
        key: 'parsing-dictionary',
        label: '字段字典',
        labelEn: 'Field Dictionary',
        path: '/parsing/dictionary',
      },
    ],
  },
  
  // 6. 索引存储模块
  {
    key: 'storage',
    label: '索引存储',
    labelEn: 'Index Storage',
    icon: 'DatabaseOutlined',
    children: [
      {
        key: 'storage-index',
        label: '索引管理',
        labelEn: 'Index Management',
        path: '/storage/index',
      },
      {
        key: 'storage-lifecycle',
        label: '生命周期策略',
        labelEn: 'Lifecycle Policy',
        path: '/storage/lifecycle',
      },
      {
        key: 'storage-backup',
        label: '备份恢复',
        labelEn: 'Backup Recovery',
        path: '/storage/backup',
      },
      {
        key: 'storage-capacity',
        label: '容量监控',
        labelEn: 'Capacity Monitoring',
        path: '/storage/capacity',
      },
    ],
  },
  
  // 7. 性能高可用模块
  {
    key: 'performance',
    label: '性能高可用',
    labelEn: 'Performance & HA',
    icon: 'ThunderboltOutlined',
    children: [
      {
        key: 'performance-monitoring',
        label: '性能监控',
        labelEn: 'Performance Monitoring',
        path: '/performance/monitoring',
      },
      {
        key: 'performance-health',
        label: '健康检查',
        labelEn: 'Health Check',
        path: '/performance/health',
      },
      {
        key: 'performance-scaling',
        label: '自动扩缩容',
        labelEn: 'Auto Scaling',
        path: '/performance/scaling',
      },
      {
        key: 'performance-disaster',
        label: '灾备管理',
        labelEn: 'Disaster Recovery',
        path: '/performance/disaster',
      },
    ],
  },
  
  // 8. 分布式追踪模块
  {
    key: 'tracing',
    label: '分布式追踪',
    labelEn: 'Distributed Tracing',
    icon: 'ApartmentOutlined',
    children: [
      {
        key: 'tracing-search',
        label: '链路搜索',
        labelEn: 'Trace Search',
        path: '/tracing/search',
      },
      {
        key: 'tracing-analysis',
        label: '链路分析',
        labelEn: 'Trace Analysis',
        path: '/tracing/analysis',
      },
      {
        key: 'tracing-topology',
        label: '服务拓扑',
        labelEn: 'Service Topology',
        path: '/tracing/topology',
      },
    ],
  },
  
  // 9. 报表中心模块
  {
    key: 'reports',
    label: '报表中心',
    labelEn: 'Report Center',
    icon: 'FileTextOutlined',
    children: [
      {
        key: 'reports-management',
        label: '报表管理',
        labelEn: 'Report Management',
        path: '/reports/management',
      },
      {
        key: 'reports-scheduled',
        label: '定时任务',
        labelEn: 'Scheduled Tasks',
        path: '/reports/scheduled',
      },
      {
        key: 'reports-downloads',
        label: '下载记录',
        labelEn: 'Download Records',
        path: '/reports/downloads',
      },
    ],
  },
  
  // 10. 安全审计模块
  {
    key: 'security',
    label: '安全审计',
    labelEn: 'Security Audit',
    icon: 'SafetyOutlined',
    children: [
      {
        key: 'security-users',
        label: '用户管理',
        labelEn: 'User Management',
        path: '/security/users',
      },
      {
        key: 'security-roles',
        label: '角色权限',
        labelEn: 'Role Permissions',
        path: '/security/roles',
      },
      {
        key: 'security-audit',
        label: '审计日志',
        labelEn: 'Audit Logs',
        path: '/security/audit',
      },
      {
        key: 'security-login',
        label: '登录策略',
        labelEn: 'Login Policy',
        path: '/security/login',
      },
    ],
  },
  
  // 11. 集成平台模块
  {
    key: 'integration',
    label: '集成平台',
    labelEn: 'Integration Platform',
    icon: 'ApiOutlined',
    children: [
      {
        key: 'integration-api',
        label: 'API 文档',
        labelEn: 'API Docs',
        path: '/integration/api',
      },
      {
        key: 'integration-webhook',
        label: 'Webhook 管理',
        labelEn: 'Webhook Management',
        path: '/integration/webhook',
      },
      {
        key: 'integration-sdk',
        label: 'SDK 下载',
        labelEn: 'SDK Download',
        path: '/integration/sdk',
      },
      {
        key: 'integration-plugins',
        label: '插件市场',
        labelEn: 'Plugin Market',
        path: '/integration/plugins',
      },
    ],
  },
  
  // 12. 成本管理模块
  {
    key: 'cost',
    label: '成本管理',
    labelEn: 'Cost Management',
    icon: 'DollarOutlined',
    children: [
      {
        key: 'cost-overview',
        label: '成本概览',
        labelEn: 'Cost Overview',
        path: '/cost/overview',
      },
      {
        key: 'cost-budget',
        label: '预算告警',
        labelEn: 'Budget Alerts',
        path: '/cost/budget',
      },
      {
        key: 'cost-optimization',
        label: '优化建议',
        labelEn: 'Optimization Suggestions',
        path: '/cost/optimization',
      },
    ],
  },
  
  // 13. 系统设置模块
  {
    key: 'settings',
    label: '系统设置',
    labelEn: 'System Settings',
    icon: 'SettingOutlined',
    children: [
      {
        key: 'settings-parameters',
        label: '系统参数',
        labelEn: 'System Parameters',
        path: '/settings/parameters',
      },
      {
        key: 'settings-global',
        label: '全局配置',
        labelEn: 'Global Config',
        path: '/settings/global',
      },
      {
        key: 'settings-versions',
        label: '配置版本',
        labelEn: 'Config Versions',
        path: '/settings/versions',
      },
    ],
  },
  
  // 14. 帮助中心模块
  {
    key: 'help',
    label: '帮助中心',
    labelEn: 'Help Center',
    icon: 'QuestionCircleOutlined',
    children: [
      {
        key: 'help-syntax',
        label: '查询语法',
        labelEn: 'Query Syntax',
        path: '/help/syntax',
      },
      {
        key: 'help-faq',
        label: '常见问题',
        labelEn: 'FAQ',
        path: '/help/faq',
      },
      {
        key: 'help-ticket',
        label: '工单入口',
        labelEn: 'Ticket Portal',
        path: '/help/ticket',
      },
    ],
  },
];

/**
 * 认证模块菜单配置（不在侧边栏显示）
 */
export const authMenuConfig: MenuConfig[] = [
  {
    key: 'auth',
    label: '认证',
    labelEn: 'Authentication',
    hidden: true,
    children: [
      {
        key: 'auth-login',
        label: '登录',
        labelEn: 'Login',
        path: '/login',
      },
      {
        key: 'auth-register',
        label: '注册',
        labelEn: 'Register',
        path: '/register',
      },
      {
        key: 'auth-forgot-password',
        label: '忘记密码',
        labelEn: 'Forgot Password',
        path: '/forgot-password',
      },
      {
        key: 'auth-sso',
        label: 'SSO 登录',
        labelEn: 'SSO Login',
        path: '/sso',
      },
    ],
  },
];

/**
 * 所有路由模块名称列表（用于属性测试验证）
 */
export const ROUTE_MODULES = [
  'dashboard',
  'search',
  'analysis',
  'alerts',
  'ingestion',
  'parsing',
  'storage',
  'performance',
  'tracing',
  'reports',
  'security',
  'integration',
  'cost',
  'settings',
  'help',
  'auth',
] as const;

export type RouteModule = typeof ROUTE_MODULES[number];

/**
 * 公开路由路径列表（无需认证）
 */
export const PUBLIC_ROUTES = [
  '/login',
  '/register',
  '/forgot-password',
  '/sso',
] as const;

/**
 * 默认首页路径
 */
export const DEFAULT_ROUTE = '/dashboard';

/**
 * 404 回退路径
 */
export const FALLBACK_ROUTE = '/dashboard';

/**
 * 根据路径获取菜单项 key
 * 
 * @param path - 路由路径
 * @returns 菜单项 key，如果未找到则返回 undefined
 */
export function getMenuKeyByPath(path: string): string | undefined {
  const findKey = (items: MenuConfig[]): string | undefined => {
    for (const item of items) {
      if (item.path === path) {
        return item.key;
      }
      if (item.children) {
        const found = findKey(item.children);
        if (found) return found;
      }
    }
    return undefined;
  };
  
  return findKey([...menuConfig, ...authMenuConfig]);
}

/**
 * 根据路径获取父级菜单 key 列表（用于展开菜单）
 * 
 * @param path - 路由路径
 * @returns 父级菜单 key 列表
 */
export function getParentKeys(path: string): string[] {
  const parents: string[] = [];
  
  const findParents = (items: MenuConfig[], parentKey?: string): boolean => {
    for (const item of items) {
      if (item.path === path) {
        if (parentKey) parents.push(parentKey);
        return true;
      }
      if (item.children) {
        if (findParents(item.children, item.key)) {
          if (parentKey) parents.push(parentKey);
          return true;
        }
      }
    }
    return false;
  };
  
  findParents(menuConfig);
  return parents.reverse();
}

/**
 * 检查路径是否为公开路由
 * 
 * @param path - 路由路径
 * @returns 是否为公开路由
 */
export function isPublicRoute(path: string): boolean {
  return PUBLIC_ROUTES.some(route => path.startsWith(route));
}

/**
 * 获取面包屑导航数据
 * 
 * @param path - 当前路由路径
 * @returns 面包屑项数组
 */
export function getBreadcrumbs(path: string): Array<{ key: string; label: string; path?: string }> {
  const breadcrumbs: Array<{ key: string; label: string; path?: string }> = [];
  
  const findBreadcrumbs = (items: MenuConfig[]): boolean => {
    for (const item of items) {
      if (item.path === path) {
        breadcrumbs.push({ key: item.key, label: item.label, path: item.path });
        return true;
      }
      if (item.children) {
        if (findBreadcrumbs(item.children)) {
          breadcrumbs.unshift({ key: item.key, label: item.label, path: item.path });
          return true;
        }
      }
    }
    return false;
  };
  
  findBreadcrumbs(menuConfig);
  return breadcrumbs;
}

