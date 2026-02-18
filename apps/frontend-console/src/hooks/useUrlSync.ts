/**
 * useUrlSync Hook - URL 查询参数与过滤器状态同步
 * 
 * 实现过滤器状态与 URL 查询参数的双向同步
 * 
 * @module hooks/useUrlSync
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';

// ============================================================================
// 类型定义
// ============================================================================

export type FilterValue = string | number | boolean | string[] | null | undefined;
export type FilterState = Record<string, FilterValue>;

export interface SerializerConfig<T extends FilterState> {
  serialize: (state: T) => Record<string, string>;
  deserialize: (params: URLSearchParams) => Partial<T>;
}

export interface UseUrlSyncOptions<T extends FilterState> {
  defaultState: T;
  serializer?: SerializerConfig<T>;
  replaceState?: boolean;
  debounceMs?: number;
}

export interface UseUrlSyncReturn<T extends FilterState> {
  filters: T;
  setFilter: <K extends keyof T>(key: K, value: T[K]) => void;
  setFilters: (updates: Partial<T>) => void;
  resetFilters: () => void;
  syncFromUrl: () => void;
  syncToUrl: () => void;
}


// ============================================================================
// 默认序列化器
// ============================================================================

export function createDefaultSerializer<T extends FilterState>(defaultState: T): SerializerConfig<T> {
  return {
    serialize: (state: T): Record<string, string> => {
      const params: Record<string, string> = {};
      for (const [key, value] of Object.entries(state)) {
        if (value === defaultState[key]) continue;
        if (value === null || value === undefined || value === '') continue;
        if (Array.isArray(value)) { if (value.length > 0) params[key] = value.join(','); }
        else if (typeof value === 'boolean') params[key] = value ? 'true' : 'false';
        else if (typeof value === 'number') params[key] = String(value);
        else params[key] = String(value);
      }
      return params;
    },
    deserialize: (searchParams: URLSearchParams): Partial<T> => {
      const result: Partial<T> = {};
      for (const key of Object.keys(defaultState)) {
        const value = searchParams.get(key);
        if (value === null) continue;
        const defaultValue = defaultState[key];
        if (Array.isArray(defaultValue)) result[key as keyof T] = value.split(',').filter(v => v !== '') as T[keyof T];
        else if (typeof defaultValue === 'boolean') result[key as keyof T] = (value === 'true') as T[keyof T];
        else if (typeof defaultValue === 'number') { const num = Number(value); if (!isNaN(num)) result[key as keyof T] = num as T[keyof T]; }
        else result[key as keyof T] = value as T[keyof T];
      }
      return result;
    },
  };
}


// ============================================================================
// Hook 实现
// ============================================================================

export function useUrlSync<T extends FilterState>(options: UseUrlSyncOptions<T>): UseUrlSyncReturn<T> {
  const { defaultState, serializer, replaceState = false, debounceMs = 0 } = options;
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  
  const effectiveSerializer = useMemo(() => serializer || createDefaultSerializer(defaultState), [serializer, defaultState]);
  
  const getStateFromUrl = useCallback((): T => {
    const parsed = effectiveSerializer.deserialize(searchParams);
    return { ...defaultState, ...parsed };
  }, [searchParams, effectiveSerializer, defaultState]);
  
  const [filters, setFiltersState] = useState<T>(getStateFromUrl);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSyncingFromUrlRef = useRef(false);
  const prevSearchRef = useRef(location.search);
  
  const syncToUrl = useCallback(() => {
    if (isSyncingFromUrlRef.current) return;
    const params = effectiveSerializer.serialize(filters);
    const newSearchParams = new URLSearchParams(params);
    const currentSearch = searchParams.toString();
    const newSearch = newSearchParams.toString();
    if (currentSearch !== newSearch) setSearchParams(newSearchParams, { replace: replaceState });
  }, [filters, effectiveSerializer, searchParams, setSearchParams, replaceState]);
  
  const syncFromUrl = useCallback(() => {
    isSyncingFromUrlRef.current = true;
    const newState = getStateFromUrl();
    setFiltersState(newState);
    setTimeout(() => { isSyncingFromUrlRef.current = false; }, 0);
  }, [getStateFromUrl]);
  
  const setFilter = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setFiltersState(prev => ({ ...prev, [key]: value }));
  }, []);
  
  const setFilters = useCallback((updates: Partial<T>) => {
    setFiltersState(prev => ({ ...prev, ...updates }));
  }, []);
  
  const resetFilters = useCallback(() => { setFiltersState(defaultState); }, [defaultState]);
  
  useEffect(() => {
    if (location.search !== prevSearchRef.current) {
      prevSearchRef.current = location.search;
      syncFromUrl();
    }
  }, [location.search, syncFromUrl]);
  
  useEffect(() => {
    if (isSyncingFromUrlRef.current) return;
    if (debounceMs > 0) {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => { syncToUrl(); }, debounceMs);
    } else { syncToUrl(); }
    return () => { if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current); };
  }, [filters, syncToUrl, debounceMs]);
  
  return { filters, setFilter, setFilters, resetFilters, syncFromUrl, syncToUrl };
}

export default useUrlSync;
