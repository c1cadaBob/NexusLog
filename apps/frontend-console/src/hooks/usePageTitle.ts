/**
 * usePageTitle Hook
 * 
 * 管理页面标题，支持组件卸载时恢复原标题
 * 
 * @module hooks/usePageTitle
 */

import { useEffect, useRef } from 'react';

/**
 * 设置页面标题的 Hook
 * 
 * @param title - 要设置的页面标题
 */
export function usePageTitle(title: string): void {
  const previousTitleRef = useRef<string>(document.title);

  useEffect(() => {
    const previousTitle = previousTitleRef.current;
    document.title = title;

    return () => {
      document.title = previousTitle;
    };
  }, [title]);
}

export default usePageTitle;
