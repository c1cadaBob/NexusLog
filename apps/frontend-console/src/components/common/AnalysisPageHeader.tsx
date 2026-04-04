import React from 'react';
import { Tag, Typography } from 'antd';

const { Text } = Typography;

export interface AnalysisPageHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  statusTag?: React.ReactNode;
  lastUpdatedAt?: Date | null;
  showRetainedResultTag?: boolean;
  fallbackLabel?: string | null;
  actions?: React.ReactNode;
}

const AnalysisPageHeader: React.FC<AnalysisPageHeaderProps> = ({
  title,
  subtitle,
  statusTag,
  lastUpdatedAt,
  showRetainedResultTag = false,
  fallbackLabel,
  actions,
}) => {
  return (
    <div className="flex items-start justify-between flex-wrap gap-3">
      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-xl font-bold m-0">{title}</h2>
          {statusTag}
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {subtitle ? <span className="text-xs opacity-55">{subtitle}</span> : null}
          {lastUpdatedAt ? (
            <Text type="secondary" style={{ fontSize: 12 }}>
              最近更新：{lastUpdatedAt.toLocaleString('zh-CN')}
            </Text>
          ) : null}
          {showRetainedResultTag ? <Tag color="warning" style={{ margin: 0 }}>接口异常时保留上次成功结果</Tag> : null}
          {fallbackLabel ? <Tag color="gold" style={{ margin: 0 }}>{fallbackLabel}</Tag> : null}
        </div>
      </div>
      {actions ? <div className="flex items-center flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
};

export default AnalysisPageHeader;
