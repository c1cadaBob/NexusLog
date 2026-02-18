/**
 * Hooks 统一导出入口
 * 
 * 本模块导出所有自定义 Hooks
 * 
 * @module hooks
 */

// ============================================================================
// API 相关 Hooks
// ============================================================================

export { useApi, type UseApiOptions } from './useApi';
export { useApiCache, type UseApiCacheOptions, type UseApiCacheReturn } from './useApiCache';
export { useMutation, type UseMutationOptions, type UseMutationReturn, type MutationType } from './useMutation';

// ============================================================================
// 数据相关 Hooks
// ============================================================================

export { useDashboardData, type UseDashboardDataReturn } from './useDashboardData';
export { useAutoSave, type UseAutoSaveOptions, type UseAutoSaveReturn } from './useAutoSave';
export { useDashboardLayout, type UseDashboardLayoutReturn, type DashboardLayoutConfig, type GridItem } from './useDashboardLayout';

// ============================================================================
// 存储相关 Hooks
// ============================================================================

export { useLocalStorage } from './useLocalStorage';
export { useSessionStorage } from './useSessionStorage';

// ============================================================================
// 离线相关 Hooks
// ============================================================================

export { useOfflineCache, type UseOfflineCacheOptions, type UseOfflineCacheReturn } from './useOfflineCache';
export { useOfflineQueue, type UseOfflineQueueOptions, type UseOfflineQueueReturn, type QueueStats } from './useOfflineQueue';
export { useOnlineStatus, type UseOnlineStatusOptions, type UseOnlineStatusReturn, type NetworkStatus } from './useOnlineStatus';


// ============================================================================
// UI 交互 Hooks
// ============================================================================

export { useDebounce } from './useDebounce';
export { useScrollPreservation, type UseScrollPreservationOptions } from './useScrollPreservation';
export { useFocusTrap, useRovingTabIndex, useFocusVisible, useArrowKeyNavigation, useAnnounce, type UseFocusTrapOptions, type UseFocusTrapReturn, type UseRovingTabIndexOptions, type UseRovingTabIndexReturn } from './useFocusManagement';
export { useIdleTimeout, type IdleTimeoutOptions, type IdleTimeoutState } from './useIdleTimeout';
export { useIntersectionObserver, type UseIntersectionObserverOptions, type UseIntersectionObserverReturn } from './useIntersectionObserver';
export { useKeyboardShortcuts, type UseKeyboardShortcutsOptions, type UseKeyboardShortcutsReturn, type KeyboardShortcut, formatKeyCombo } from './useKeyboardShortcuts';
export { usePullToRefresh, type UsePullToRefreshOptions, type UsePullToRefreshReturn } from './usePullToRefresh';
export { useSwipeGesture, type UseSwipeGestureOptions, type UseSwipeGestureReturn, type SwipeDirection } from './useSwipeGesture';

// ============================================================================
// 主题相关 Hooks
// ============================================================================

export { useThemeStyles, type ThemeStyles } from './useThemeStyles';

// ============================================================================
// 表单相关 Hooks
// ============================================================================

export { useSanitizedInput, type SanitizeInputOptions, type UseSanitizedInputReturn } from './useSanitizedInput';

// ============================================================================
// 路由相关 Hooks
// ============================================================================

export { useUrlSync, type UseUrlSyncOptions, type UseUrlSyncReturn, type FilterState, createDefaultSerializer } from './useUrlSync';
export { usePageTitle } from './usePageTitle';

// ============================================================================
// 性能优化 Hooks
// ============================================================================

export { useMemoizedValue, useMemoizedComputation, useShallowMemoizedValue, deepEqual, shallowEqual } from './useMemoizedValue';

// ============================================================================
// 监控相关 Hooks
// ============================================================================

export { useMonitoring, usePageTracking, useEventTracking, useErrorTracking, usePerformanceTracking, useMeasure } from './useMonitoring';

// ============================================================================
// 错误处理 Hooks
// ============================================================================

export { useErrorRecovery, type UseErrorRecoveryOptions, type UseErrorRecoveryReturn } from './useErrorRecovery';
