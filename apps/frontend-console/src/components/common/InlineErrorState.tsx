import React from 'react';
import { Button, theme } from 'antd';

export interface InlineErrorStateProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionLoading?: boolean;
}

const InlineErrorState: React.FC<InlineErrorStateProps> = ({
  title = '加载失败',
  description,
  actionLabel = '重试',
  onAction,
  actionLoading = false,
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
        textAlign: 'center',
      }}
    >
      <span
        className="material-symbols-outlined"
        style={{ fontSize: 30, color: token.colorError }}
        aria-hidden="true"
      >
        error
      </span>
      <div style={{ fontSize: 15, fontWeight: 500, color: token.colorText }}>
        {title}
      </div>
      {description ? (
        <div
          style={{
            fontSize: 13,
            lineHeight: 1.6,
            color: token.colorTextSecondary,
            maxWidth: 520,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {description}
        </div>
      ) : null}
      {onAction ? (
        <Button size="small" onClick={onAction} loading={actionLoading}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
};

export default InlineErrorState;
