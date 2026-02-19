/**
 * 实时搜索页面
 * 
 * 提供日志实时检索功能：
 * - 搜索输入框（Ant Design Input.Search）
 * - 查询构建器
 * - 日志结果表格（Ant Design Table）
 * - 时间范围选择
 * - 日志详情抽屉
 * 
 * @requirements 9.2
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Card,
  Input,
  Table,
  Tag,
  Space,
  Button,
  DatePicker,
  Select,
  Drawer,
  Descriptions,
  Typography,
  Row,
  Col,
  Tooltip,
  message,
  Collapse,
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  DownloadOutlined,
  ExpandOutlined,
  FilterOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { QueryBuilder } from '@/components/search';
import type { 
  LogEntry, 
  LogLevel, 
  LogFilter, 
  TimeRange,
} from '@/types';

const { Search } = Input;
const { RangePicker } = DatePicker;
const { Text, Paragraph } = Typography;

// ============================================================================
// 类型定义
// ============================================================================

interface SearchState {
  query: string;
  filters: LogFilter[];
  timeRange: TimeRange;
  page: number;
  pageSize: number;
}

// ============================================================================
// 常量定义
// ============================================================================

/** 日志级别颜色映射 */
const LEVEL_COLORS: Record<LogLevel, string> = {
  DEBUG: 'default',
  INFO: 'blue',
  WARN: 'orange',
  ERROR: 'red',
  FATAL: 'magenta',
};

/** 时间范围快捷选项 */
const TIME_RANGE_OPTIONS = [
  { label: '最近 15 分钟', value: '15m' },
  { label: '最近 1 小时', value: '1h' },
  { label: '最近 4 小时', value: '4h' },
  { label: '最近 24 小时', value: '24h' },
  { label: '最近 7 天', value: '7d' },
  { label: '自定义', value: 'custom' },
];

/** 模拟日志数据 */
const MOCK_LOGS: LogEntry[] = [
  {
    id: '1',
    timestamp: Date.now() - 1000,
    level: 'INFO',
    service: 'api-gateway',
    message: '请求处理成功 GET /api/v1/users',
    host: 'node-1',
    traceId: 'trace-001',
    fields: { method: 'GET', path: '/api/v1/users', status: 200 },
    raw: '2024-01-01 10:00:00 INFO [api-gateway] 请求处理成功',
  },
  {
    id: '2',
    timestamp: Date.now() - 5000,
    level: 'WARN',
    service: 'user-service',
    message: '数据库连接池使用率超过 80%',
    host: 'node-2',
    traceId: 'trace-002',
    fields: { poolSize: 100, used: 85 },
    raw: '2024-01-01 09:59:55 WARN [user-service] 数据库连接池使用率超过 80%',
  },
  {
    id: '3',
    timestamp: Date.now() - 10000,
    level: 'ERROR',
    service: 'order-service',
    message: '订单创建失败: 库存不足',
    host: 'node-1',
    traceId: 'trace-003',
    spanId: 'span-001',
    fields: { orderId: 'ORD-123', productId: 'PROD-456', error: 'INSUFFICIENT_STOCK' },
    raw: '2024-01-01 09:59:50 ERROR [order-service] 订单创建失败: 库存不足',
  },
  {
    id: '4',
    timestamp: Date.now() - 15000,
    level: 'DEBUG',
    service: 'cache-service',
    message: '缓存命中 key=user:1001',
    host: 'node-3',
    fields: { key: 'user:1001', hit: true, ttl: 3600 },
    raw: '2024-01-01 09:59:45 DEBUG [cache-service] 缓存命中 key=user:1001',
  },
  {
    id: '5',
    timestamp: Date.now() - 20000,
    level: 'FATAL',
    service: 'payment-service',
    message: '支付网关连接失败，服务不可用',
    host: 'node-2',
    traceId: 'trace-004',
    fields: { gateway: 'stripe', error: 'CONNECTION_TIMEOUT' },
    raw: '2024-01-01 09:59:40 FATAL [payment-service] 支付网关连接失败',
  },
];

// ============================================================================
// 辅助函数
// ============================================================================

/** 格式化时间戳 */
const formatTimestamp = (ts: number) => dayjs(ts).format('YYYY-MM-DD HH:mm:ss.SSS');

/** 计算时间范围 */
const calculateTimeRange = (relative: string): TimeRange => {
  const now = Date.now();
  const units: Record<string, number> = {
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  const match = relative.match(/^(\d+)([mhd])$/);
  if (match && match[1] && match[2]) {
    const num = match[1];
    const unit = match[2];
    const multiplier = units[unit] ?? 60 * 60 * 1000;
    return {
      start: now - parseInt(num, 10) * multiplier,
      end: now,
      relative,
    };
  }
  return { start: now - 60 * 60 * 1000, end: now, relative: '1h' };
};

// ============================================================================
// 主组件
// ============================================================================

export const RealtimeSearchPage: React.FC = () => {
  // 搜索状态
  const [searchState, setSearchState] = useState<SearchState>({
    query: '',
    filters: [],
    timeRange: calculateTimeRange('1h'),
    page: 1,
    pageSize: 20,
  });

  // UI 状态
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>(MOCK_LOGS);
  const [total, setTotal] = useState(MOCK_LOGS.length);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showQueryBuilder, setShowQueryBuilder] = useState(false);
  const [timeRangeType, setTimeRangeType] = useState('1h');

  // 执行搜索
  const handleSearch = useCallback(async (query?: string) => {
    setLoading(true);
    try {
      // 模拟 API 调用
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const searchQuery = query ?? searchState.query;
      let filteredLogs = [...MOCK_LOGS];
      
      // 按查询词过滤
      if (searchQuery) {
        const lowerQuery = searchQuery.toLowerCase();
        filteredLogs = filteredLogs.filter(log =>
          log.message.toLowerCase().includes(lowerQuery) ||
          log.service.toLowerCase().includes(lowerQuery) ||
          log.raw.toLowerCase().includes(lowerQuery)
        );
      }
      
      // 按过滤条件过滤
      searchState.filters.forEach(filter => {
        filteredLogs = filteredLogs.filter(log => {
          const value = log[filter.field as keyof LogEntry];
          if (value === undefined) return filter.operator === 'not_exists';
          if (filter.operator === 'exists') return true;
          if (filter.operator === 'eq') return value === filter.value;
          if (filter.operator === 'ne') return value !== filter.value;
          if (filter.operator === 'contains') return String(value).includes(String(filter.value));
          return true;
        });
      });
      
      setLogs(filteredLogs);
      setTotal(filteredLogs.length);
      message.success(`找到 ${filteredLogs.length} 条日志`);
    } catch {
      message.error('搜索失败，请重试');
    } finally {
      setLoading(false);
    }
  }, [searchState]);

  // 刷新
  const handleRefresh = useCallback(() => {
    handleSearch();
  }, [handleSearch]);

  // 导出
  const handleExport = useCallback(() => {
    message.info('导出功能开发中...');
  }, []);

  // 查看日志详情
  const handleViewDetail = useCallback((log: LogEntry) => {
    setSelectedLog(log);
    setDrawerOpen(true);
  }, []);

  // 时间范围变化
  const handleTimeRangeChange = useCallback((value: string) => {
    setTimeRangeType(value);
    if (value !== 'custom') {
      setSearchState(prev => ({
        ...prev,
        timeRange: calculateTimeRange(value),
      }));
    }
  }, []);

  // 自定义时间范围变化
  const handleCustomTimeRange = useCallback((dates: [dayjs.Dayjs | null, dayjs.Dayjs | null] | null) => {
    if (dates && dates[0] && dates[1]) {
      setSearchState(prev => ({
        ...prev,
        timeRange: {
          start: dates[0]!.valueOf(),
          end: dates[1]!.valueOf(),
        },
      }));
    }
  }, []);

  // 过滤条件变化
  const handleFiltersChange = useCallback((filters: LogFilter[]) => {
    setSearchState(prev => ({ ...prev, filters }));
  }, []);

  // 表格列定义
  const columns: ColumnsType<LogEntry> = useMemo(() => [
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 180,
      render: (ts: number) => (
        <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>
          {formatTimestamp(ts)}
        </Text>
      ),
      sorter: (a, b) => a.timestamp - b.timestamp,
      defaultSortOrder: 'descend',
    },
    {
      title: '级别',
      dataIndex: 'level',
      key: 'level',
      width: 80,
      render: (level: LogLevel) => (
        <Tag color={LEVEL_COLORS[level]}>{level}</Tag>
      ),
      filters: [
        { text: 'DEBUG', value: 'DEBUG' },
        { text: 'INFO', value: 'INFO' },
        { text: 'WARN', value: 'WARN' },
        { text: 'ERROR', value: 'ERROR' },
        { text: 'FATAL', value: 'FATAL' },
      ],
      onFilter: (value, record) => record.level === value,
    },
    {
      title: '服务',
      dataIndex: 'service',
      key: 'service',
      width: 140,
      render: (service: string) => (
        <Tag>{service}</Tag>
      ),
    },
    {
      title: '消息',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true,
      render: (message: string, record) => (
        <Tooltip title="点击查看详情">
          <Text
            style={{ cursor: 'pointer' }}
            onClick={() => handleViewDetail(record)}
          >
            {message}
          </Text>
        </Tooltip>
      ),
    },
    {
      title: '主机',
      dataIndex: 'host',
      key: 'host',
      width: 100,
    },
    {
      title: '操作',
      key: 'actions',
      width: 80,
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          icon={<ExpandOutlined />}
          onClick={() => handleViewDetail(record)}
        >
          详情
        </Button>
      ),
    },
  ], [handleViewDetail]);

  return (
    <div>
      {/* 页面标题 */}
      <div style={{ marginBottom: 16 }}>
        <Space align="center">
          <Typography.Title level={4} style={{ margin: 0 }}>
            实时搜索
          </Typography.Title>
          <Tag color="blue">日志检索</Tag>
        </Space>
        <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
          实时日志检索和查询
        </Typography.Paragraph>
      </div>

      {/* 搜索区域 */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          {/* 搜索框 */}
          <Col flex="auto">
            <Search
              placeholder="输入搜索关键词，支持 Lucene 查询语法..."
              value={searchState.query}
              onChange={(e) => setSearchState(prev => ({ ...prev, query: e.target.value }))}
              onSearch={handleSearch}
              enterButton={<><SearchOutlined /> 搜索</>}
              size="large"
              loading={loading}
              allowClear
            />
          </Col>
          
          {/* 时间范围 */}
          <Col>
            <Space>
              <ClockCircleOutlined />
              <Select
                value={timeRangeType}
                onChange={handleTimeRangeChange}
                style={{ width: 140 }}
                size="large"
                options={TIME_RANGE_OPTIONS}
              />
              {timeRangeType === 'custom' && (
                <RangePicker
                  showTime
                  size="large"
                  onChange={handleCustomTimeRange}
                />
              )}
            </Space>
          </Col>
          
          {/* 操作按钮 */}
          <Col>
            <Space>
              <Tooltip title="高级过滤">
                <Button
                  icon={<FilterOutlined />}
                  onClick={() => setShowQueryBuilder(!showQueryBuilder)}
                  type={showQueryBuilder ? 'primary' : 'default'}
                  size="large"
                />
              </Tooltip>
              <Tooltip title="刷新">
                <Button
                  icon={<ReloadOutlined />}
                  onClick={handleRefresh}
                  loading={loading}
                  size="large"
                />
              </Tooltip>
              <Tooltip title="导出">
                <Button
                  icon={<DownloadOutlined />}
                  onClick={handleExport}
                  size="large"
                />
              </Tooltip>
            </Space>
          </Col>
        </Row>

        {/* 查询构建器 */}
        {showQueryBuilder && (
          <div style={{ marginTop: 16 }}>
            <QueryBuilder
              filters={searchState.filters}
              onFiltersChange={handleFiltersChange}
              onSearch={() => handleSearch()}
              loading={loading}
            />
          </div>
        )}
      </Card>

      {/* 结果表格 */}
      <Card>
        <Table<LogEntry>
          columns={columns}
          dataSource={logs}
          rowKey="id"
          loading={loading}
          pagination={{
            current: searchState.page,
            pageSize: searchState.pageSize,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `显示 ${range[0]}-${range[1]} 条，共 ${total} 条`,
            onChange: (page, pageSize) => setSearchState(prev => ({ ...prev, page, pageSize })),
          }}
          scroll={{ x: 1000 }}
          size="middle"
        />
      </Card>

      {/* 日志详情抽屉 */}
      <Drawer
        title="日志详情"
        placement="right"
        width={600}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      >
        {selectedLog && (
          <div>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="时间">
                {formatTimestamp(selectedLog.timestamp)}
              </Descriptions.Item>
              <Descriptions.Item label="级别">
                <Tag color={LEVEL_COLORS[selectedLog.level]}>{selectedLog.level}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="服务">
                {selectedLog.service}
              </Descriptions.Item>
              <Descriptions.Item label="主机">
                {selectedLog.host || '-'}
              </Descriptions.Item>
              {selectedLog.traceId && (
                <Descriptions.Item label="Trace ID">
                  <Text copyable>{selectedLog.traceId}</Text>
                </Descriptions.Item>
              )}
              {selectedLog.spanId && (
                <Descriptions.Item label="Span ID">
                  <Text copyable>{selectedLog.spanId}</Text>
                </Descriptions.Item>
              )}
              <Descriptions.Item label="消息">
                {selectedLog.message}
              </Descriptions.Item>
            </Descriptions>

            {/* 字段信息 */}
            {Object.keys(selectedLog.fields).length > 0 && (
              <Collapse
                style={{ marginTop: 16 }}
                defaultActiveKey={['fields']}
                items={[
                  {
                    key: 'fields',
                    label: '扩展字段',
                    children: (
                      <Descriptions column={1} size="small">
                        {Object.entries(selectedLog.fields).map(([key, value]) => (
                          <Descriptions.Item key={key} label={key}>
                            {JSON.stringify(value)}
                          </Descriptions.Item>
                        ))}
                      </Descriptions>
                    ),
                  },
                ]}
              />
            )}

            {/* 原始日志 */}
            <Collapse
              style={{ marginTop: 16 }}
              items={[
                {
                  key: 'raw',
                  label: '原始日志',
                  children: (
                    <Paragraph
                      code
                      copyable
                      style={{ 
                        whiteSpace: 'pre-wrap', 
                        wordBreak: 'break-all',
                        margin: 0,
                      }}
                    >
                      {selectedLog.raw}
                    </Paragraph>
                  ),
                },
              ]}
            />
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default RealtimeSearchPage;
