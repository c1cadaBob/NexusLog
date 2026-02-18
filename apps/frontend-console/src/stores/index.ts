/**
 * Zustand Stores 统一导出入口
 * 
 * 本模块导出所有 Zustand Store，用于替代 Context API
 * 
 * @module stores
 */

// ============================================================================
// Auth Store - 认证状态管理
// ============================================================================

export {
  useAuthStore,
  useCurrentUser,
  useIsAuthenticated,
  useAuthLoading,
  useAuthError,
  useAuthActions,
  type AuthStore,
  type AuthActions,
} from './useAuthStore';

// ============================================================================
// Theme Store - 主题状态管理
// ============================================================================

export {
  useThemeStore,
  useThemeMode,
  useIsDark,
  useDensity,
  useAntdTheme,
  useThemeColors,
  useThemeActions,
  type ThemeStore,
  type ThemeState,
  type ThemeActions,
} from './useThemeStore';

// ============================================================================
// Notification Store - 通知状态管理
// ============================================================================

export {
  useNotificationStore,
  useNotifications,
  useUnreadCount,
  useToast,
  useNotificationActions,
  useUnreadNotifications,
  useNotificationsByType,
  type NotificationStore,
  type NotificationState,
  type NotificationActions,
} from './useNotificationStore';

// ============================================================================
// Cache Store - 缓存状态管理
// ============================================================================

export {
  useCacheStore,
  useCacheSize,
  useCacheConfig,
  useCacheActions,
  type CacheStore,
  type CacheState,
  type CacheActions,
  type CacheEntry,
  type CacheConfig,
} from './useCacheStore';

// ============================================================================
// Offline Store - 离线状态管理
// ============================================================================

export {
  useOfflineStore,
  useIsOnline,
  useOfflineQueue,
  usePendingOperations,
  useFailedOperations,
  useIsSyncing,
  useOfflineActions,
  type OfflineStore,
  type OfflineState,
  type OfflineActions,
  type OfflineOperation,
  type OfflineOperationType,
  type OfflineOperationStatus,
} from './useOfflineStore';
