import React from 'react';
import { Tag } from 'antd';
import type { QueryCleanupState } from './queryCleanupState';

interface QueryCleanupPreviewContentProps {
  cleanupState: QueryCleanupState;
  intro?: React.ReactNode;
  showFilterCountTag?: boolean;
  showSourceQuery?: boolean;
  sourceQueryLabel?: string;
  sourceQuery?: string;
  cleanedQueryLabel?: string;
  rootClassName?: string;
  secondaryTextClassName?: string;
}

const QueryCleanupPreviewContent: React.FC<QueryCleanupPreviewContentProps> = ({
  cleanupState,
  intro,
  showFilterCountTag = cleanupState.filterCount > 0,
  showSourceQuery = true,
  sourceQueryLabel = '原始查询',
  sourceQuery,
  cleanedQueryLabel = '收藏后写入',
  rootClassName = 'flex flex-col gap-3',
  secondaryTextClassName = 'text-xs opacity-60',
}) => (
  <div className={rootClassName}>
    {intro && <div className="text-sm opacity-80">{intro}</div>}
    <div className="flex gap-2 flex-wrap">
      {cleanupState.strippedTimeRange && <Tag color="warning" style={{ margin: 0 }}>将移除历史时间范围</Tag>}
      {showFilterCountTag && cleanupState.filterCount > 0 && (
        <Tag color="blue" style={{ margin: 0 }}>保留 {cleanupState.filterCount} 个筛选条件</Tag>
      )}
    </div>
    {cleanupState.previewFilters.length > 0 && (
      <div className="flex flex-col gap-1">
        <div className={secondaryTextClassName}>保留筛选</div>
        <div className="flex gap-2 flex-wrap">
          {cleanupState.previewFilters.map((filter) => (
            <Tag key={filter.key} color="blue" style={{ margin: 0 }}>
              {filter.label}: {filter.value}
            </Tag>
          ))}
        </div>
      </div>
    )}
    {showSourceQuery && (
      <div className="flex flex-col gap-1">
        <div className={secondaryTextClassName}>{sourceQueryLabel}</div>
        <div className="font-mono text-sm p-2 rounded break-all" style={{ backgroundColor: 'rgba(0,0,0,0.04)' }}>
          {sourceQuery ?? cleanupState.rawQuery}
        </div>
      </div>
    )}
    <div className="flex flex-col gap-1">
      <div className={secondaryTextClassName}>{cleanedQueryLabel}</div>
      <div className="font-mono text-sm p-2 rounded break-all" style={{ backgroundColor: 'rgba(0,0,0,0.06)' }}>
        {cleanupState.cleanedQuery}
      </div>
    </div>
  </div>
);

export default QueryCleanupPreviewContent;
