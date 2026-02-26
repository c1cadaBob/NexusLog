export interface MenuItem {
  icon: string;
  label: string;
  path?: string;
  children?: MenuItem[];
  badge?: number;
}

export interface MenuSection {
  title: string;
  items: MenuItem[];
}
