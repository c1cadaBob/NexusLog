/**
 * 导航相关类型定义
 */

// ============================================================================
// 菜单项
// ============================================================================

/**
 * 菜单项
 */
export interface MenuItem {
  /** 图标名称 (Material Symbols) */
  icon: string;
  /** 显示标签 */
  label: string;
  /** 路由路径 */
  path?: string;
  /** 子菜单项 */
  children?: MenuItem[];
  /** 徽章数量 */
  badge?: number;
  /** 计数（兼容旧代码） */
  count?: number;
  /** 徽章颜色 */
  badgeColor?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否隐藏 */
  hidden?: boolean;
  /** 所需权限 */
  permissions?: string[];
  /** 是否在新窗口打开 */
  external?: boolean;
  /** 外部链接 URL */
  externalUrl?: string;
}

/**
 * 菜单分组
 */
export interface MenuSection {
  /** 分组标题 */
  title: string;
  /** 分组内的菜单项 */
  items: MenuItem[];
  /** 是否默认折叠 */
  collapsed?: boolean;
  /** 是否隐藏 */
  hidden?: boolean;
}

// ============================================================================
// 面包屑
// ============================================================================

/**
 * 面包屑项
 */
export interface BreadcrumbItem {
  /** 显示标签 */
  label: string;
  /** 路由路径 */
  path?: string;
  /** 图标 */
  icon?: string;
}

// ============================================================================
// 标签页
// ============================================================================

/**
 * 标签页项
 */
export interface TabItem {
  /** 唯一标识 */
  key: string;
  /** 显示标签 */
  label: string;
  /** 图标 */
  icon?: string;
  /** 是否可关闭 */
  closable?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 徽章数量 */
  badge?: number;
}

// ============================================================================
// 路由
// ============================================================================

/**
 * 路由配置
 */
export interface RouteConfig {
  /** 路由路径 */
  path: string;
  /** 页面标题 */
  title: string;
  /** 页面图标 */
  icon?: string;
  /** 组件 */
  component: React.ComponentType;
  /** 子路由 */
  children?: RouteConfig[];
  /** 是否需要认证 */
  requireAuth?: boolean;
  /** 所需权限 */
  permissions?: string[];
  /** 是否精确匹配 */
  exact?: boolean;
  /** 重定向路径 */
  redirect?: string;
  /** 布局类型 */
  layout?: 'default' | 'blank' | 'auth';
}

// ============================================================================
// 侧边栏
// ============================================================================

/**
 * 侧边栏状态
 */
export interface SidebarState {
  /** 是否折叠 */
  collapsed: boolean;
  /** 展开的菜单项 */
  expandedKeys: string[];
  /** 当前选中的菜单项 */
  selectedKey: string;
}

/**
 * 侧边栏配置
 */
export interface SidebarConfig {
  /** 宽度（展开时） */
  width: number;
  /** 宽度（折叠时） */
  collapsedWidth: number;
  /** 是否可折叠 */
  collapsible: boolean;
  /** 是否显示 Logo */
  showLogo: boolean;
  /** 是否显示用户信息 */
  showUser: boolean;
}

/**
 * 默认侧边栏配置
 */
export const DEFAULT_SIDEBAR_CONFIG: SidebarConfig = {
  width: 260,
  collapsedWidth: 64,
  collapsible: true,
  showLogo: true,
  showUser: false,
};
