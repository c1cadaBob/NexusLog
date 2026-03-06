export interface MenuItem {
  icon: string;
  label: string;
  path?: string;
  children?: MenuItem[];
  badge?: number;
  /** Required permission(s) - user must have any of these. '*' grants all. */
  requiredPermission?: string | string[];
}

export interface MenuSection {
  title: string;
  items: MenuItem[];
}
