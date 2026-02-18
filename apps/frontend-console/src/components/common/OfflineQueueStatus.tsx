/**
 * OfflineQueueStatus 组件
 * 
 * 离线队列状态组件，显示待同步的操作数量
 * 
 * @requirements 5.5
 */

import React from 'react';
import { Badge, Button, Popover, List, Typography, Empty, Space } from 'antd';
import { SyncOutlined, CloudUploadOutlined, DeleteOutlined } from '@ant-design/icons';

const { Text } = Typography;

/**
 * 队列项类型
 */
export interface QueueItem {
  id: string;
  type: string;
  description: string;
  timestamp: number;
}

/**
 * OfflineQueueStatus 组件属性
 */
export interface OfflineQueueStatusProps {
  /** 队列项列表 */
  items?: QueueItem[];
  /** 是否正在同步 */
  syncing?: boolean;
  /** 同步回调 */
  onSync?: () => void;
  /** 清空队列回调 */
  onClear?: () => void;
  /** 删除单项回调 */
  onRemove?: (id: string) => void;
  /** 自定义样式 */
  style?: React.CSSProperties;
}

/**
 * 离线队列状态组件
 */
export const OfflineQueueStatus: React.FC<OfflineQueueStatusProps> = ({
  items = [],
  syncing = false,
  onSync,
  onClear,
  onRemove,
  style,
}) => {
  const count = items.length;

  const content = (
    <div style={{ width: 300 }}>
      {count === 0 ? (
        <Empty description="暂无待同步操作" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <>
          <List
            size="small"
            dataSource={items.slice(0, 5)}
            renderItem={(item) => (
              <List.Item
                actions={onRemove ? [
                  <Button
                    key="delete"
                    type="text"
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={() => onRemove(item.id)}
                  />
                ] : undefined}
              >
                <List.Item.Meta
                  title={item.type}
                  description={
                    <Text type="secondary" ellipsis style={{ fontSize: 12 }}>
                      {item.description}
                    </Text>
                  }
                />
              </List.Item>
            )}
          />
          {count > 5 && (
            <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginTop: 8 }}>
              还有 {count - 5} 项待同步
            </Text>
          )}
          <Space style={{ width: '100%', justifyContent: 'flex-end', marginTop: 12 }}>
            {onClear && (
              <Button size="small" onClick={onClear}>
                清空队列
              </Button>
            )}
            {onSync && (
              <Button
                type="primary"
                size="small"
                icon={<SyncOutlined spin={syncing} />}
                loading={syncing}
                onClick={onSync}
              >
                立即同步
              </Button>
            )}
          </Space>
        </>
      )}
    </div>
  );

  return (
    <Popover
      content={content}
      title="离线队列"
      trigger="click"
      placement="bottomRight"
    >
      <Badge count={count} size="small" offset={[-2, 2]}>
        <Button
          type="text"
          icon={<CloudUploadOutlined />}
          style={style}
          aria-label={`离线队列，${count} 项待同步`}
        />
      </Badge>
    </Popover>
  );
};

export default OfflineQueueStatus;
