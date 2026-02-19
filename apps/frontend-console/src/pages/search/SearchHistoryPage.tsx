/**
 * 搜索历史页面
 * 
 * 提供查询历史记录管理功能：
 * - 历史记录列表（Ant Design Table）
 * - 重新执行查询
 * - 删除历史记录
 * - 清空所有历史
 * 
 * @requirements 9.2
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Typography,
  Popconfirm,
  message,
  Tooltip,
  Empty,
  Input,
} from 'antd';
import {
  DeleteOutlined,
  ClearOutlined,
  PlayCircleOutlined,
  ClockCircleOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import type { QueryHistory } from '@/types';

const { Text, Paragraph } = Typography;
const { Search } = Input;

// ============================================================================
// 模拟数据
// ============================================================================

const MOCK_HISTORY: QueryHistory[] = [
  {
    id: '1',
    query: 'level:ERROR AND service:order-service',
    filters: [
      { field: 'level', operator: 'eq', value: 'ERROR' },
      { field: 'service', operator: 'eq', value: 'order-service' },
    ],
    timeRange: { start: Date.now() - 3600000, end: Date.now() },
    resultCount: 156,
    executionTime: 234,
    executedAt: Date.now() - 300000,
  },
  {
    id: '2',
    query: '支付失败',
    filters: [],
    timeRange: { start: Date.now() - 86400000, end: Date.now() },
    resultCount: 42,
    executionTime: 189,
    executedAt: Date.now() - 1800000,
  },
  {
    id: '3',
    query: 'traceId:trace-001',
    filters: [{ field: 'traceId', operator: 'eq', value: 'trace-001' }],
    timeRange: { start: Date.now() - 7200000, end: Date.now() },
    resultCount: 23,
    executionTime: 156,
    executedAt: Date.now() - 3600000,
  },
  {
    id: '4',
    query: 'host:node-1 AND level:WARN',
    filters: [
      { field: 'host', operator: 'eq', value: 'node-1' },
      { field: 'level', operator: 'eq', value: 'WARN' },
    ],
    timeRange: { start: Date.now() - 14400000, end: Date.now() },
    resultCount: 89,
    executionTime: 312,
    executedAt: Date.now() - 7200000,
  },
  {
    id: '5',
    query: 'message:*timeout*',
    filters: [{ field: 'message', operator: 'contains', value: 'timeout' }],
    timeRange: { start: Date.now() - 86400000, end: Date.now() },
    resultCount: 67,
    executionTime: 278,
    executedAt: Date.now() - 86400000,
  },
];

// ============================================================================
// 辅助函数
// ============================================================================

/** 格式化时间 */
const formatTime = (ts: number) => dayjs(ts).format('YYYY-MM-DD HH:mm:ss');

/** 格式化相对时间 */
const formatRelativeTime = (ts: number) => {
  const diff = Date.now() - ts;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  return `${Math.floor(diff / 86400000)} 天前`;
};

/** 格式化执行时间 */
const formatExecutionTime = (ms: number) => {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

// ============================================================================
// 主组件
// ============================================================================

export const SearchHistoryPage: React.FC = () => {
  const [history, setHistory] = useState<QueryHistory[]>(MOCK_HISTORY);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // 过滤后的历史记录
  const filteredHistory = useMemo(() => {
    if (!searchText) return history;
    const lowerSearch = searchText.toLowerCase();
    return history.filter(item =>
      item.query.toLowerCase().includes(lowerSearch)
    );
  }, [history, searchText]);

  // 重新执行查询
  const handleRerun = useCallback((record: QueryHistory) => {
    message.info(`正在执行查询: ${record.query}`);
    // 实际实现中会跳转到实时搜索页面并执行查询
  }, []);

  // 删除单条记录
  const handleDelete = useCallback((id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id));
    message.success('已删除');
  }, []);

  // 批量删除
  const handleBatchDelete = useCallback(() => {
    setHistory(prev => prev.filter(item => !selectedRowKeys.includes(item.id)));
    setSelectedRowKeys([]);
    message.success(`已删除 ${selectedRowKeys.length} 条记录`);
  }, [selectedRowKeys]);

  // 清空所有历史
  const handleClearAll = useCallback(async () => {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      setHistory([]);
      setSelectedRowKeys([]);
      message.success('已清空所有历史记录');
    } finally {
      setLoading(false);
    }
  }, []);

  // 表格列定义
  const columns: ColumnsType<QueryHistory> = useMemo(() => [
    {
      title: '查询语句',
      dataIndex: 'query',
      key: 'query',
      ellipsis: true,
      render: (query: string) => (
        <Tooltip title={query}>
          <Text code style={{ fontSize: 13 }}>{query}</Text>
        </Tooltip>
      ),
    },
    {
      title: '过滤条件',
      dataIndex: 'filters',
      key: 'filters',
      width: 200,
      render: (filters: QueryHistory['filters']) => (
        <Space wrap size={[4, 4]}>
          {filters.length === 0 ? (
            <Text type="secondary">无</Text>
          ) : (
            filters.slice(0, 2).map((f, i) => (
              <Tag key={i} color="blue">
                {f.field}:{String(f.value).slice(0, 10)}
              </Tag>
            ))
          )}
          {filters.length > 2 && (
            <Tag>+{filters.length - 2}</Tag>
          )}
        </Space>
      ),
    },
    {
      title: '结果数',
      dataIndex: 'resultCount',
      key: 'resultCount',
      width: 100,
      align: 'right',
      render: (count: number) => (
        <Text strong>{count.toLocaleString()}</Text>
      ),
      sorter: (a, b) => a.resultCount - b.resultCount,
    },
    {
      title: '耗时',
      dataIndex: 'executionTime',
      key: 'executionTime',
      width: 100,
      align: 'right',
      render: (time: number) => (
        <Text type="secondary">{formatExecutionTime(time)}</Text>
      ),
      sorter: (a, b) => a.executionTime - b.executionTime,
    },
    {
      title: '执行时间',
      dataIndex: 'executedAt',
      key: 'executedAt',
      width: 160,
      render: (ts: number) => (
        <Tooltip title={formatTime(ts)}>
          <Space>
            <ClockCircleOutlined />
            <Text type="secondary">{formatRelativeTime(ts)}</Text>
          </Space>
        </Tooltip>
      ),
      sorter: (a, b) => a.executedAt - b.executedAt,
      defaultSortOrder: 'descend',
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space>
          <Tooltip title="重新执行">
            <Button
              type="link"
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() => handleRerun(record)}
            />
          </Tooltip>
          <Popconfirm
            title="确定删除此记录？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <Button
                type="link"
                size="small"
                danger
                icon={<DeleteOutlined />}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ], [handleRerun, handleDelete]);

  // 行选择配置
  const rowSelection = {
    selectedRowKeys,
    onChange: setSelectedRowKeys,
  };

  return (
    <div>
      {/* 页面标题 */}
      <div style={{ marginBottom: 16 }}>
        <Space align="center">
          <Typography.Title level={4} style={{ margin: 0 }}>
            <HistoryOutlined style={{ marginRight: 8 }} />
            搜索历史
          </Typography.Title>
          <Tag color="blue">日志检索</Tag>
        </Space>
        <Paragraph type="secondary" style={{ margin: 0 }}>
          查看和管理历史搜索记录
        </Paragraph>
      </div>

      {/* 操作栏 */}
      <Card style={{ marginBottom: 16 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <Search
              placeholder="搜索历史记录..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 300 }}
              allowClear
            />
            {selectedRowKeys.length > 0 && (
              <Popconfirm
                title={`确定删除选中的 ${selectedRowKeys.length} 条记录？`}
                onConfirm={handleBatchDelete}
                okText="确定"
                cancelText="取消"
              >
                <Button danger icon={<DeleteOutlined />}>
                  删除选中 ({selectedRowKeys.length})
                </Button>
              </Popconfirm>
            )}
          </Space>
          <Popconfirm
            title="确定清空所有历史记录？此操作不可恢复。"
            onConfirm={handleClearAll}
            okText="确定"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button
              danger
              icon={<ClearOutlined />}
              loading={loading}
              disabled={history.length === 0}
            >
              清空历史
            </Button>
          </Popconfirm>
        </Space>
      </Card>

      {/* 历史记录表格 */}
      <Card>
        {filteredHistory.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={searchText ? '没有匹配的记录' : '暂无搜索历史'}
          />
        ) : (
          <Table<QueryHistory>
            columns={columns}
            dataSource={filteredHistory}
            rowKey="id"
            rowSelection={rowSelection}
            loading={loading}
            pagination={{
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => `显示 ${range[0]}-${range[1]} 条，共 ${total} 条`,
            }}
            size="middle"
          />
        )}
      </Card>
    </div>
  );
};

export default SearchHistoryPage;
