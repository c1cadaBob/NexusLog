/**
 * Dashboard 数据管理 Hook
 * 
 * 提供 Dashboard 页面的数据管理功能：
 * - WebSocket 实时数据订阅
 * - 自动刷新控制
 * - 数据状态管理
 * 
 * 注意：此 Hook 使用 Zustand Store 而非 Context API
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { wsClient } from '../services/websocket';
import { useLocalStorage } from './useLocalStorage';
import { useScrollPreservation } from './useScrollPreservation';
import { 
  KPI_DATA, 
  TOP_SERVICES, 
  RECENT_AUDITS,
  DEFAULT_REFRESH_INTERVAL,
  REFRESH_INTERVAL_STORAGE_KEY,
} from '../constants';
import type { KpiData, ServiceStatus, AuditLog } from '../types';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * Dashboard 数据
 */
export interface DashboardData {
  kpiData: KpiData[];
  topServices: ServiceStatus[];
  recentAudits: AuditLog[];
  lastUpdated: number;
}

/**
 * 刷新配置
 */
export interface RefreshConfig {
  enabled: boolean;
  interval: number; // 毫秒
}

/**
 * Hook 返回值
 */
export interface UseDashboardDataReturn {
  /** Dashboard 数据 */
  data: DashboardData;
  /** 是否正在加载 */
  isLoading: boolean;
  /** WebSocket 是否已连接 */
  wsConnected: boolean;
  /** 刷新配置 */
  refreshConfig: RefreshConfig;
  /** 刷新倒计时（秒） */
  countdown: number;
  /** 手动刷新 */
  refresh: () => Promise<void>;
  /** 切换自动刷新 */
  toggleAutoRefresh: () => void;
  /** 设置刷新间隔 */
  setRefreshInterval: (interval: number) => void;
}

// ============================================================================
// 常量导出
// ============================================================================

export { DEFAULT_REFRESH_INTERVAL };

/** 可用的刷新间隔选项 */
export const REFRESH_INTERVAL_OPTIONS = [
  { label: '关闭', value: 0 },
  { label: '5秒', value: 5000 },
  { label: '10秒', value: 10000 },
  { label: '30秒', value: 30000 },
  { label: '1分钟', value: 60000 },
  { label: '5分钟', value: 300000 },
];

// ============================================================================
// Hook 实现
// ============================================================================

/**
 * Dashboard 数据管理 Hook
 * 
 * @example
 * ```tsx
 * const {
 *   data,
 *   isLoading,
 *   wsConnected,
 *   refreshConfig,
 *   countdown,
 *   refresh,
 *   toggleAutoRefresh,
 *   setRefreshInterval,
 * } = useDashboardData();
 * ```
 */
export function useDashboardData(): UseDashboardDataReturn {
  // 从 localStorage 读取保存的刷新间隔
  const { value: savedInterval, setValue: setSavedInterval } = useLocalStorage<number>(
    REFRESH_INTERVAL_STORAGE_KEY,
    DEFAULT_REFRESH_INTERVAL
  );
  
  // 状态
  const [data, setData] = useState<DashboardData>({
    kpiData: KPI_DATA,
    topServices: TOP_SERVICES,
    recentAudits: RECENT_AUDITS,
    lastUpdated: Date.now(),
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [countdown, setCountdown] = useState(0);
  
  const [refreshConfig, setRefreshConfig] = useState<RefreshConfig>({
    enabled: savedInterval > 0,
    interval: savedInterval,
  });

  // Refs
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 滚动位置保留
  const { withScrollPreservation } = useScrollPreservation();

  // ==========================================================================
  // 数据刷新
  // ==========================================================================

  /**
   * 内部刷新数据逻辑
   */
  const doRefresh = useCallback(async () => {
    // 模拟数据更新（实际应用中应调用 API）
    // 这里模拟一些数据变化以展示刷新效果
    setData(prev => ({
      ...prev,
      kpiData: prev.kpiData.map(kpi => {
        // 模拟数值微小变化
        if (kpi.icon === 'data_usage') {
          const currentValue = parseFloat(kpi.value);
          const newValue = currentValue + (Math.random() - 0.5) * 0.5;
          return { ...kpi, value: `${newValue.toFixed(1)}M` };
        }
        if (kpi.icon === 'speed') {
          const currentValue = parseFloat(kpi.value);
          const newValue = currentValue + (Math.random() - 0.5) * 2;
          return { ...kpi, value: `${newValue.toFixed(1)}k` };
        }
        return kpi;
      }),
      lastUpdated: Date.now(),
    }));
    
    // 重置倒计时
    if (refreshConfig.enabled && refreshConfig.interval > 0) {
      setCountdown(refreshConfig.interval / 1000);
    }
  }, [refreshConfig.enabled, refreshConfig.interval]);

  /**
   * 刷新数据（带滚动位置保留）
   * 数据刷新时保留用户当前滚动位置
   */
  const refresh = useCallback(async () => {
    setIsLoading(true);
    
    try {
      // 使用 withScrollPreservation 包装刷新操作
      // 自动保存刷新前的滚动位置，刷新后恢复
      await withScrollPreservation(doRefresh);
    } catch (error) {
      console.error('刷新数据失败:', error);
    } finally {
      setIsLoading(false);
    }
  }, [withScrollPreservation, doRefresh]);

  // ==========================================================================
  // 自动刷新控制
  // ==========================================================================

  /**
   * 启动自动刷新
   */
  const startAutoRefresh = useCallback(() => {
    // 清除现有定时器
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
    }

    if (refreshConfig.enabled && refreshConfig.interval > 0) {
      // 设置刷新定时器
      refreshTimerRef.current = setInterval(() => {
        refresh();
      }, refreshConfig.interval);

      // 设置倒计时定时器
      setCountdown(refreshConfig.interval / 1000);
      countdownTimerRef.current = setInterval(() => {
        setCountdown(prev => (prev > 0 ? prev - 1 : refreshConfig.interval / 1000));
      }, 1000);
    }
  }, [refreshConfig.enabled, refreshConfig.interval, refresh]);

  /**
   * 停止自动刷新
   */
  const stopAutoRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setCountdown(0);
  }, []);

  /**
   * 切换自动刷新
   */
  const toggleAutoRefresh = useCallback(() => {
    setRefreshConfig(prev => ({
      ...prev,
      enabled: !prev.enabled,
    }));
  }, []);

  /**
   * 设置刷新间隔
   */
  const setRefreshInterval = useCallback((interval: number) => {
    // 保存到 localStorage
    setSavedInterval(interval);
    setRefreshConfig(prev => ({
      ...prev,
      interval,
      enabled: interval > 0,
    }));
  }, [setSavedInterval]);

  // ==========================================================================
  // WebSocket 连接
  // ==========================================================================

  useEffect(() => {
    // 订阅 WebSocket 消息
    const unsubscribeKpi = wsClient.subscribe<KpiData[]>('dashboard:kpi', (newData) => {
      setData(prev => ({
        ...prev,
        kpiData: newData,
        lastUpdated: Date.now(),
      }));
    });

    const unsubscribeServices = wsClient.subscribe<ServiceStatus[]>('dashboard:services', (newData) => {
      setData(prev => ({
        ...prev,
        topServices: newData,
        lastUpdated: Date.now(),
      }));
    });

    const unsubscribeAudits = wsClient.subscribe<AuditLog[]>('dashboard:audits', (newData) => {
      setData(prev => ({
        ...prev,
        recentAudits: newData,
        lastUpdated: Date.now(),
      }));
    });

    // 检查 WebSocket 连接状态
    setWsConnected(wsClient.isConnected());

    // 尝试连接 WebSocket
    if (!wsClient.isConnected()) {
      wsClient.connect().then(() => {
        setWsConnected(true);
        // 订阅仪表板数据
        wsClient.send('subscribe', { 
          channels: ['dashboard:kpi', 'dashboard:services', 'dashboard:audits'] 
        });
      }).catch(() => {
        setWsConnected(false);
      });
    }

    return () => {
      unsubscribeKpi();
      unsubscribeServices();
      unsubscribeAudits();
    };
  }, []);

  // ==========================================================================
  // 自动刷新效果
  // ==========================================================================

  useEffect(() => {
    if (refreshConfig.enabled && refreshConfig.interval > 0) {
      startAutoRefresh();
    } else {
      stopAutoRefresh();
    }

    return () => {
      stopAutoRefresh();
    };
  }, [refreshConfig.enabled, refreshConfig.interval, startAutoRefresh, stopAutoRefresh]);

  // 页面可见性变化时暂停/恢复自动刷新
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopAutoRefresh();
      } else if (refreshConfig.enabled && refreshConfig.interval > 0) {
        startAutoRefresh();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshConfig.enabled, refreshConfig.interval, startAutoRefresh, stopAutoRefresh]);

  // ==========================================================================
  // 返回值
  // ==========================================================================

  return {
    data,
    isLoading,
    wsConnected,
    refreshConfig,
    countdown,
    refresh,
    toggleAutoRefresh,
    setRefreshInterval,
  };
}

export default useDashboardData;
