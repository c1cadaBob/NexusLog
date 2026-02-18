/**
 * 缓存状态管理 Store
 * 
 * 使用 Zustand 替代 CacheContext，管理应用缓存
 * 
 * @module stores/useCacheStore
 */

import { create } from 'zustand';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 缓存条目
 */
export interface CacheEntry<T = unknown> {
  /** 缓存键 */
  key: string;
  /** 缓存数据 */
  data: T;
  /** 创建时间戳 */
  createdAt: number;
  /** 过期时间戳 */
  expiresAt: number;
  /** 标签（用于批量失效） */
  tags?: string[];
}

/**
 * 缓存配置
 */
export interface CacheConfig {
  /** 默认过期时间（毫秒） */
  defaultTTL: number;
  /** 最大缓存条目数 */
  maxEntries: number;
  /** 是否启用持久化 */
  persistEnabled: boolean;
}

/**
 * 缓存状态接口
 */
export interface CacheState {
  /** 缓存数据 */
  cache: Map<string, CacheEntry>;
  /** 缓存配置 */
  config: CacheConfig;
}

/**
 * 缓存操作接口
 */
export interface CacheActions {
  /** 获取缓存 */
  get: <T>(key: string) => T | null;
  /** 设置缓存 */
  set: <T>(key: string, data: T, ttl?: number, tags?: string[]) => void;
  /** 检查缓存是否存在且有效 */
  has: (key: string) => boolean;
  /** 删除缓存 */
  remove: (key: string) => void;
  /** 按标签删除缓存 */
  removeByTag: (tag: string) => void;
  /** 按标签失效缓存（别名） */
  invalidateByTag: (tag: string) => void;
  /** 按前缀失效缓存 */
  invalidateByPrefix: (prefix: string) => void;
  /** 清除所有缓存 */
  clear: () => void;
  /** 清除过期缓存 */
  clearExpired: () => void;
  /** 更新配置 */
  updateConfig: (config: Partial<CacheConfig>) => void;
  /** 获取缓存统计 */
  getStats: () => { size: number; hitRate: number };
}

/**
 * 完整的缓存 Store 类型
 */
export type CacheStore = CacheState & CacheActions;

// ============================================================================
// 默认配置
// ============================================================================

const DEFAULT_CONFIG: CacheConfig = {
  defaultTTL: 5 * 60 * 1000, // 5 分钟
  maxEntries: 1000,
  persistEnabled: false,
};

// ============================================================================
// 缓存统计
// ============================================================================

let cacheHits = 0;
let cacheMisses = 0;

// ============================================================================
// Store 实现
// ============================================================================

/**
 * 缓存状态管理 Store
 * 
 * @example
 * ```tsx
 * const { get, set, remove, clear } = useCacheStore();
 * 
 * // 设置缓存
 * set('user-profile', userData, 10 * 60 * 1000); // 10 分钟过期
 * 
 * // 获取缓存
 * const cached = get<UserProfile>('user-profile');
 * 
 * // 按标签设置和删除
 * set('dashboard-data', data, undefined, ['dashboard']);
 * removeByTag('dashboard');
 * ```
 */
export const useCacheStore = create<CacheStore>()((set, get) => ({
  // 初始状态
  cache: new Map(),
  config: DEFAULT_CONFIG,

  /**
   * 获取缓存
   */
  get: <T>(key: string): T | null => {
    const entry = get().cache.get(key);
    
    if (!entry) {
      cacheMisses++;
      return null;
    }
    
    // 检查是否过期
    if (Date.now() > entry.expiresAt) {
      get().remove(key);
      cacheMisses++;
      return null;
    }
    
    cacheHits++;
    return entry.data as T;
  },

  /**
   * 设置缓存
   */
  set: <T>(key: string, data: T, ttl?: number, tags?: string[]) => {
    const config = get().config;
    const now = Date.now();
    
    const entry: CacheEntry<T> = {
      key,
      data,
      createdAt: now,
      expiresAt: now + (ttl ?? config.defaultTTL),
      tags,
    };
    
    set(state => {
      const newCache = new Map(state.cache);
      newCache.set(key, entry as CacheEntry);
      
      // 如果超过最大条目数，删除最旧的条目
      if (newCache.size > config.maxEntries) {
        const oldestKey = newCache.keys().next().value;
        if (oldestKey) {
          newCache.delete(oldestKey);
        }
      }
      
      return { cache: newCache };
    });
  },

  /**
   * 检查缓存是否存在且有效
   */
  has: (key: string): boolean => {
    const entry = get().cache.get(key);
    
    if (!entry) {
      return false;
    }
    
    // 检查是否过期
    if (Date.now() > entry.expiresAt) {
      get().remove(key);
      return false;
    }
    
    return true;
  },

  /**
   * 删除缓存
   */
  remove: (key: string) => {
    set(state => {
      const newCache = new Map(state.cache);
      newCache.delete(key);
      return { cache: newCache };
    });
  },

  /**
   * 按标签删除缓存
   */
  removeByTag: (tag: string) => {
    set(state => {
      const newCache = new Map(state.cache);
      
      for (const [key, entry] of newCache) {
        if (entry.tags?.includes(tag)) {
          newCache.delete(key);
        }
      }
      
      return { cache: newCache };
    });
  },

  /**
   * 按标签失效缓存（别名）
   */
  invalidateByTag: (tag: string) => {
    get().removeByTag(tag);
  },

  /**
   * 按前缀失效缓存
   */
  invalidateByPrefix: (prefix: string) => {
    set(state => {
      const newCache = new Map(state.cache);
      
      for (const key of newCache.keys()) {
        if (key.startsWith(prefix)) {
          newCache.delete(key);
        }
      }
      
      return { cache: newCache };
    });
  },

  /**
   * 清除所有缓存
   */
  clear: () => {
    set({ cache: new Map() });
    cacheHits = 0;
    cacheMisses = 0;
  },

  /**
   * 清除过期缓存
   */
  clearExpired: () => {
    const now = Date.now();
    
    set(state => {
      const newCache = new Map(state.cache);
      
      for (const [key, entry] of newCache) {
        if (now > entry.expiresAt) {
          newCache.delete(key);
        }
      }
      
      return { cache: newCache };
    });
  },

  /**
   * 更新配置
   */
  updateConfig: (config: Partial<CacheConfig>) => {
    set(state => ({
      config: { ...state.config, ...config },
    }));
  },

  /**
   * 获取缓存统计
   */
  getStats: () => {
    const total = cacheHits + cacheMisses;
    return {
      size: get().cache.size,
      hitRate: total > 0 ? cacheHits / total : 0,
    };
  },
}));

// ============================================================================
// 选择器 Hooks
// ============================================================================

/**
 * 获取缓存大小
 */
export const useCacheSize = () => useCacheStore(state => state.cache.size);

/**
 * 获取缓存配置
 */
export const useCacheConfig = () => useCacheStore(state => state.config);

/**
 * 获取缓存操作
 */
export const useCacheActions = () => useCacheStore(state => ({
  get: state.get,
  set: state.set,
  has: state.has,
  remove: state.remove,
  removeByTag: state.removeByTag,
  clear: state.clear,
  clearExpired: state.clearExpired,
}));
