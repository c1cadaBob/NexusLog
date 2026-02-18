/**
 * 组件 Props 类型定义
 * 
 * 适配 Ant Design 5.x 组件接口
 */

import type { ReactNode } from 'react';
import type { TableProps as AntTableProps, TableColumnType } from 'antd';
import type { ComponentSize, SemanticColor, SortConfig, PaginationConfig, SelectionConfig } from './common';

// ============================================================================
// 基础组件 Props
// ============================================================================

/**
 * 基础组件 Props
 */
export interface BaseComponentProps {
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: React.CSSProperties;
  /** 子元素 */
  children?: ReactNode;
}

/**
 * 可禁用组件 Props
 */
export interface DisableableProps {
  /** 是否禁用 */
  disabled?: boolean;
}

/**
 * 可加载组件 Props
 */
export interface LoadableProps {
  /** 是否加载中 */
  loading?: boolean;
}

// ============================================================================
// 按钮 Props
// ============================================================================

/**
 * 按钮变体
 */
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'link';

/**
 * 按钮 Props
 */
export interface ButtonProps extends BaseComponentProps, DisableableProps, LoadableProps {
  /** 按钮变体 */
  variant?: ButtonVariant;
  /** 按钮尺寸 */
  size?: ComponentSize;
  /** 图标 */
  icon?: string;
  /** 图标位置 */
  iconPosition?: 'left' | 'right';
  /** 是否全宽 */
  fullWidth?: boolean;
  /** 按钮类型 */
  type?: 'button' | 'submit' | 'reset';
  /** 点击事件 */
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

// ============================================================================
// 输入框 Props
// ============================================================================

/**
 * 输入框类型
 */
export type InputType = 'text' | 'password' | 'email' | 'number' | 'tel' | 'url' | 'search';

/**
 * 输入框 Props
 */
export interface InputProps extends BaseComponentProps, DisableableProps {
  /** 输入框类型 */
  type?: InputType;
  /** 值 */
  value?: string | number;
  /** 默认值 */
  defaultValue?: string | number;
  /** 占位符 */
  placeholder?: string;
  /** 尺寸 */
  size?: ComponentSize;
  /** 前缀图标 */
  prefixIcon?: string;
  /** 后缀图标 */
  suffixIcon?: string;
  /** 前缀内容 */
  prefix?: ReactNode;
  /** 后缀内容 */
  suffix?: ReactNode;
  /** 是否只读 */
  readOnly?: boolean;
  /** 是否必填 */
  required?: boolean;
  /** 最大长度 */
  maxLength?: number;
  /** 是否显示清除按钮 */
  allowClear?: boolean;
  /** 是否有错误 */
  error?: boolean;
  /** 错误消息 */
  errorMessage?: string;
  /** 值变化回调 */
  onChange?: (value: string) => void;
  /** 失焦回调 */
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
  /** 聚焦回调 */
  onFocus?: (event: React.FocusEvent<HTMLInputElement>) => void;
  /** 按键回调 */
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  /** 回车回调 */
  onPressEnter?: () => void;
}

// ============================================================================
// 表单字段 Props
// ============================================================================

/**
 * 表单字段 Props
 */
export interface FormFieldProps extends BaseComponentProps {
  /** 字段名称 */
  name: string;
  /** 标签 */
  label?: string;
  /** 是否必填 */
  required?: boolean;
  /** 错误消息 */
  error?: string;
  /** 帮助文本 */
  help?: string;
  /** 标签位置 */
  labelPosition?: 'top' | 'left' | 'right';
  /** 标签宽度 */
  labelWidth?: number | string;
}

// ============================================================================
// 表格 Props（适配 Ant Design Table）
// ============================================================================

/**
 * 表格列定义
 * 
 * 适配 Ant Design Table 的 ColumnType 接口
 */
export interface TableColumn<T = unknown> {
  /** 列键 */
  key: string;
  /** 数据字段 */
  dataIndex?: keyof T | string;
  /** 列标题 */
  title: string;
  /** 列宽度 */
  width?: number | string;
  /** 最小宽度 */
  minWidth?: number;
  /** 对齐方式 */
  align?: 'left' | 'center' | 'right';
  /** 是否可排序 */
  sortable?: boolean;
  /** 是否可过滤 */
  filterable?: boolean;
  /** 是否固定 */
  fixed?: 'left' | 'right' | boolean;
  /** 是否可隐藏 */
  hideable?: boolean;
  /** 是否默认隐藏 */
  hidden?: boolean;
  /** 自定义渲染 */
  render?: (value: unknown, record: T, index: number) => ReactNode;
  /** 自定义排序函数 */
  sorter?: boolean | ((a: T, b: T) => number);
  /** 省略显示 */
  ellipsis?: boolean;
  /** 提示信息 */
  tooltip?: string;
}

/**
 * 将自定义 TableColumn 转换为 Ant Design ColumnType
 */
export type AntdColumnType<T> = TableColumnType<T>;

/**
 * 表格 Props
 */
export interface TableProps<T = unknown> extends BaseComponentProps, LoadableProps {
  /** 列定义 */
  columns: TableColumn<T>[];
  /** 数据源 */
  data: T[];
  /** 行键 */
  rowKey: keyof T | ((record: T) => string);
  /** 排序配置 */
  sort?: SortConfig;
  /** 分页配置 */
  pagination?: PaginationConfig | false;
  /** 选择配置 */
  selection?: SelectionConfig;
  /** 是否显示边框 */
  bordered?: boolean;
  /** 是否显示斑马纹 */
  striped?: boolean;
  /** 是否可悬停高亮 */
  hoverable?: boolean;
  /** 尺寸 */
  size?: 'small' | 'middle' | 'large';
  /** 空数据提示 */
  emptyText?: string;
  /** 行点击回调 */
  onRowClick?: (record: T, index: number) => void;
  /** 排序变化回调 */
  onSortChange?: (sort: SortConfig | null) => void;
  /** 滚动配置 */
  scroll?: AntTableProps<T>['scroll'];
}

// ============================================================================
// 卡片 Props
// ============================================================================

/**
 * 卡片 Props
 */
export interface CardProps extends BaseComponentProps {
  /** 标题 */
  title?: ReactNode;
  /** 副标题 */
  subtitle?: ReactNode;
  /** 额外内容（右上角） */
  extra?: ReactNode;
  /** 是否显示边框 */
  bordered?: boolean;
  /** 是否可悬停 */
  hoverable?: boolean;
  /** 内边距 */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** 头部内容 */
  header?: ReactNode;
  /** 底部内容 */
  footer?: ReactNode;
  /** 点击回调 */
  onClick?: () => void;
}

// ============================================================================
// 模态框 Props
// ============================================================================

/**
 * 模态框尺寸
 */
export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

/**
 * 模态框 Props
 */
export interface ModalProps extends BaseComponentProps {
  /** 是否打开 */
  open: boolean;
  /** 标题 */
  title?: ReactNode;
  /** 尺寸 */
  size?: ModalSize;
  /** 宽度（优先于 size） */
  width?: number | string;
  /** 底部内容 */
  footer?: ReactNode;
  /** 是否显示关闭按钮 */
  closable?: boolean;
  /** 是否点击遮罩关闭 */
  maskClosable?: boolean;
  /** 是否按 ESC 关闭 */
  escClosable?: boolean;
  /** 是否居中显示 */
  centered?: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 确认回调 */
  onConfirm?: () => void;
  /** 确认按钮文本 */
  confirmText?: string;
  /** 取消按钮文本 */
  cancelText?: string;
  /** 确认按钮加载状态 */
  confirmLoading?: boolean;
  /** 销毁时是否卸载子组件 */
  destroyOnClose?: boolean;
}

// ============================================================================
// 抽屉 Props
// ============================================================================

/**
 * 抽屉位置
 */
export type DrawerPlacement = 'left' | 'right' | 'top' | 'bottom';

/**
 * 抽屉 Props
 */
export interface DrawerProps extends BaseComponentProps {
  /** 是否打开 */
  open: boolean;
  /** 标题 */
  title?: ReactNode;
  /** 位置 */
  placement?: DrawerPlacement;
  /** 宽度（左右位置时） */
  width?: number | string;
  /** 高度（上下位置时） */
  height?: number | string;
  /** 底部内容 */
  footer?: ReactNode;
  /** 是否显示关闭按钮 */
  closable?: boolean;
  /** 是否点击遮罩关闭 */
  maskClosable?: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 销毁时是否卸载子组件 */
  destroyOnClose?: boolean;
}

// ============================================================================
// 图表 Props
// ============================================================================

/**
 * 图表基础 Props
 */
export interface ChartBaseProps extends BaseComponentProps, LoadableProps {
  /** 标题 */
  title?: string;
  /** 高度 */
  height?: number;
  /** 是否显示图例 */
  showLegend?: boolean;
  /** 是否显示工具提示 */
  showTooltip?: boolean;
  /** 错误信息 */
  error?: string;
  /** 空数据提示 */
  emptyText?: string;
  /** 主题模式 */
  theme?: 'dark' | 'light';
}

/**
 * 时间序列数据点
 */
export interface TimeSeriesDataPoint {
  timestamp: number;
  [key: string]: number;
}

/**
 * 折线图系列配置
 */
export interface LineSeriesConfig {
  dataKey: string;
  name: string;
  color: string;
  type?: 'line' | 'area';
  strokeWidth?: number;
  dot?: boolean;
}

/**
 * 折线图 Props
 */
export interface LineChartProps extends ChartBaseProps {
  /** 数据 */
  data: TimeSeriesDataPoint[];
  /** 系列配置 */
  series: LineSeriesConfig[];
  /** X 轴格式化函数 */
  xAxisFormatter?: (value: number) => string;
  /** Y 轴格式化函数 */
  yAxisFormatter?: (value: number) => string;
}

// ============================================================================
// 统计卡片 Props
// ============================================================================

/**
 * 趋势类型
 */
export type TrendType = 'up' | 'down' | 'neutral';

/**
 * 趋势配置
 */
export interface TrendConfig {
  value: string;
  type: TrendType;
  label?: string;
}

/**
 * 统计卡片 Props
 */
export interface StatCardProps extends BaseComponentProps {
  /** 标题 */
  title: string;
  /** 值 */
  value: string | number;
  /** 图标 */
  icon?: string;
  /** 颜色 */
  color?: SemanticColor;
  /** 趋势 */
  trend?: TrendConfig;
  /** 是否加载中 */
  loading?: boolean;
  /** 前缀 */
  prefix?: ReactNode;
  /** 后缀 */
  suffix?: ReactNode;
  /** 精度 */
  precision?: number;
  /** 点击回调 */
  onClick?: () => void;
}

// ============================================================================
// 上下文菜单 Props
// ============================================================================

/**
 * 上下文菜单项
 */
export interface ContextMenuItem {
  /** 唯一标识 */
  key: string;
  /** 显示标签 */
  label: string;
  /** 图标 */
  icon?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否危险操作 */
  danger?: boolean;
  /** 分隔线（在此项之前显示分隔线） */
  divider?: boolean;
  /** 子菜单 */
  children?: ContextMenuItem[];
  /** 点击回调 */
  onClick?: () => void;
}

/**
 * 上下文菜单位置
 */
export interface ContextMenuPosition {
  x: number;
  y: number;
}

/**
 * 上下文菜单 Props
 */
export interface ContextMenuProps extends BaseComponentProps {
  /** 是否打开 */
  open: boolean;
  /** 位置 */
  position: ContextMenuPosition;
  /** 菜单项 */
  items: ContextMenuItem[];
  /** 关闭回调 */
  onClose: () => void;
  /** 菜单项点击回调 */
  onItemClick?: (key: string, item: ContextMenuItem) => void;
}
