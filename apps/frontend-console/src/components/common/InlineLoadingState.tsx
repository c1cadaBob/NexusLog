import React from 'react';
import { Spin, theme } from 'antd';

export interface InlineLoadingStateProps {
  tip?: string;
  size?: 'small' | 'default' | 'large';
}

const InlineLoadingState: React.FC<InlineLoadingStateProps> = ({
  tip = '加载中...',
  size = 'default',
}) => {
  const { token } = theme.useToken();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
      }}
    >
      <Spin size={size} />
      {tip ? (
        <span style={{ fontSize: 14, color: token.colorTextSecondary }}>
          {tip}
        </span>
      ) : null}
    </div>
  );
};

export default InlineLoadingState;
