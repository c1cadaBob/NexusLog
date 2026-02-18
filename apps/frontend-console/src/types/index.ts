/**
 * 类型定义统一导出
 * 
 * 本模块导出应用中所有的 TypeScript 类型定义
 */

// ============================================================================
// 通用类型
// ============================================================================
export type {
  Nullable,
  Optional,
  DeepPartial,
  RecordOf,
  ID,
  Timestamp,
  LoadingState,
  SortDirection,
  SortConfig,
  PaginationParams,
  PaginationConfig,
  PaginationMeta,
  SelectionMode,
  SelectionConfig,
  SelectOption,
  GroupedOptions,
  SemanticColor,
  StatusColor,
  ComponentSize,
  SpacingSize,
} from './common';

// ============================================================================
// 用户和认证类型
// ============================================================================
export type {
  UserRole,
  Permission,
  Role,
  UserPreferences,
  User,
  UserSummary,
  CreateUserRequest,
  UpdateUserRequest,
  LoginCredentials,
  LoginResponse,
  RefreshTokenResponse,
  AuthState,
  Session,
} from './user';

export { DEFAULT_USER_PREFERENCES } from './user';

// ============================================================================
// 主题类型
// ============================================================================
export type {
  ThemeMode,
  DensityMode,
  ThemeColors,
  ThemeTypography,
  ThemeSpacing,
  Theme,
  CustomTheme,
  ThemeContextValue,
} from './theme';

export {
  DARK_THEME_COLORS,
  LIGHT_THEME_COLORS,
  HIGH_CONTRAST_THEME_COLORS,
  DEFAULT_TYPOGRAPHY,
  COMFORTABLE_SPACING,
  COMPACT_SPACING,
  SPACIOUS_SPACING,
} from './theme';

// ============================================================================
// 日志类型
// ============================================================================
export type {
  LogLevel,
  LogEntry,
  LogEntrySummary,
  FilterOperator,
  LogFilter,
  TimeRange,
  LogQuery,
  LogSearchRequest,
  LogSearchResponse,
  AggregationType,
  LogAggregation,
  AggregationResult,
  AggregationBucket,
  HistogramDataPoint,
  HistogramRequest,
  SavedQuery,
  QueryHistory,
  ExportFormat,
  LogExportRequest,
  ExportStatus,
  ExportTask,
} from './log';

export { LOG_LEVEL_CONFIG } from './log';

// ============================================================================
// 告警类型
// ============================================================================
export type {
  AlertSeverity,
  AlertStatus,
  Alert,
  AlertSummary,
  RuleStatus,
  ConditionOperator,
  AlertCondition,
  AlertRule,
  CreateAlertRuleRequest,
  AlertActionType,
  AlertAction,
  AlertActionConfig,
  EmailActionConfig,
  WebhookActionConfig,
  SlackActionConfig,
  SilenceMatcher,
  SilencePolicy,
  CreateSilencePolicyRequest,
  NotificationChannel,
  NotificationPolicy,
} from './alert';

export { ALERT_SEVERITY_CONFIG, ALERT_STATUS_CONFIG } from './alert';

// ============================================================================
// 仪表板类型
// ============================================================================
export type {
  Dashboard,
  DashboardSummary,
  CreateDashboardRequest,
  UpdateDashboardRequest,
  DashboardLayout,
  VariableType,
  DashboardVariable,
  WidgetType,
  WidgetPosition,
  Widget,
  WidgetConfig,
  StatWidgetConfig,
  Threshold,
  ChartWidgetConfig,
  LegendConfig,
  AxisConfig,
  SeriesConfig,
  TooltipConfig,
  TableWidgetConfig,
  TableColumn as DashboardTableColumn,
  LogsWidgetConfig,
  TextWidgetConfig,
} from './dashboard';

export { DEFAULT_DASHBOARD_LAYOUT } from './dashboard';

// ============================================================================
// API 类型
// ============================================================================
export type {
  ApiResponse,
  PaginatedResponse,
  ResponseMeta,
  ApiError,
  ValidationError,
  ErrorCode,
  RequestConfig,
  RequestOptions,
  ApiState,
  UseApiReturn,
  BatchRequest,
  BatchResult,
  WebSocketMessage,
  WebSocketStatus,
  WebSocketConfig,
} from './api';

export { ERROR_CODES } from './api';

// ============================================================================
// 通知类型
// ============================================================================
export type {
  NotificationType,
  NotificationAction,
  Notification,
  CreateNotificationParams,
  ToastPosition,
  ToastConfig,
  NotificationContextValue,
  NotificationFilter,
} from './notification';

export { NOTIFICATION_TYPE_CONFIG, DEFAULT_TOAST_CONFIG } from './notification';

// ============================================================================
// 导航类型
// ============================================================================
export type {
  MenuItem,
  MenuSection,
  BreadcrumbItem,
  TabItem,
  RouteConfig,
  SidebarState,
  SidebarConfig,
} from './navigation';

export { DEFAULT_SIDEBAR_CONFIG } from './navigation';

// ============================================================================
// 组件 Props 类型
// ============================================================================
export type {
  BaseComponentProps,
  DisableableProps,
  LoadableProps,
  ButtonVariant,
  ButtonProps,
  InputType,
  InputProps,
  FormFieldProps,
  TableColumn,
  AntdColumnType,
  TableProps,
  CardProps,
  ModalSize,
  ModalProps,
  DrawerPlacement,
  DrawerProps,
  ChartBaseProps,
  TimeSeriesDataPoint,
  LineSeriesConfig,
  LineChartProps,
  TrendType,
  TrendConfig,
  StatCardProps,
  ContextMenuItem,
  ContextMenuPosition,
  ContextMenuProps,
} from './components';

// ============================================================================
// 兼容旧类型（从原 types.ts 迁移）
// ============================================================================

/**
 * KPI 数据（兼容旧代码）
 */
export interface KpiData {
  title: string;
  value: string;
  trend: string;
  trendType: 'up' | 'down' | 'neutral';
  trendLabel: string;
  icon: string;
  color: 'primary' | 'danger' | 'warning' | 'info' | 'success';
}

/**
 * 服务状态（兼容旧代码）
 */
export interface ServiceStatus {
  name: string;
  errorRate: number;
  status: 'critical' | 'warning' | 'healthy';
}

/**
 * 审计日志（兼容旧代码）
 */
export interface AuditLog {
  time: string;
  user: string;
  action: string;
  target: string;
  type: 'update' | 'create' | 'delete';
}

/**
 * 架构层（兼容旧代码）
 */
export interface ArchitectureLayer {
  layer: string;
  tech: string;
  version: string;
  function: string;
  new: boolean;
  incremental: boolean;
  impact: string;
  related: string;
}
