/**
 * 通用类型定义
 * 定义应用中通用的基础类型
 */

// ============================================================================
// 基础类型
// ============================================================================

/**
 * 可空类型
 */
export type Nullable<T> = T | null;

/**
 * 可选类型
 */
export type Optional<T> = T | undefined;

/**
 * 深度部分类型
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * 记录类型
 */
export type RecordOf<T> = Record<string, T>;

// ============================================================================
// ID 类型
// ============================================================================

/**
 * 唯一标识符
 */
export type ID = string;

/**
 * 时间戳（毫秒）
 */
export type Timestamp = number;

// ============================================================================
// 状态类型
// ============================================================================

/**
 * 加载状态
 */
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

/**
 * 排序方向
 */
export type SortDirection = 'asc' | 'desc';

/**
 * 排序配置
 */
export interface SortConfig {
  field: string;
  direction: SortDirection;
}

// ============================================================================
// 分页类型
// ============================================================================

/**
 * 分页参数
 */
export interface PaginationParams {
  page: number;
  pageSize: number;
}

/**
 * 分页配置
 */
export interface PaginationConfig extends PaginationParams {
  total: number;
  onChange: (page: number, pageSize: number) => void;
}

/**
 * 分页响应元数据
 */
export interface PaginationMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
}

// ============================================================================
// 选择类型
// ============================================================================

/**
 * 选择模式
 */
export type SelectionMode = 'single' | 'multiple';

/**
 * 选择配置
 */
export interface SelectionConfig<T = string> {
  selectedKeys: Set<T>;
  onChange: (keys: Set<T>) => void;
  mode: SelectionMode;
}

// ============================================================================
// 选项类型
// ============================================================================

/**
 * 下拉选项
 */
export interface SelectOption<T = string> {
  label: string;
  value: T;
  disabled?: boolean;
  description?: string;
  icon?: string;
}

/**
 * 分组选项
 */
export interface GroupedOptions<T = string> {
  label: string;
  options: SelectOption<T>[];
}

// ============================================================================
// 颜色类型
// ============================================================================

/**
 * 语义颜色
 */
export type SemanticColor = 'primary' | 'success' | 'warning' | 'danger' | 'info';

/**
 * 状态颜色
 */
export type StatusColor = 'critical' | 'high' | 'medium' | 'low' | 'healthy';

// ============================================================================
// 尺寸类型
// ============================================================================

/**
 * 组件尺寸
 */
export type ComponentSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/**
 * 间距尺寸
 */
export type SpacingSize = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
