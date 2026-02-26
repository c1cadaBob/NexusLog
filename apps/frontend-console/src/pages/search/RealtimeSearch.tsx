import React, { useState, useMemo, useCallback } from 'react';
import { Input, Button, Tag, Table, Drawer, Space, Tooltip, Descriptions, Divider, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useThemeStore } from '../../stores/themeStore';
import { usePreferencesStore } from '../../stores/preferencesStore';
import { COLORS } from '../../theme/tokens';
import ChartWrapper from '../../components/charts/ChartWrapper';
import type { EChartsCoreOption } from 'echarts/core';
import type { LogEntry } from '../../types/log';

// ============================================================================
// 模拟数据
// ============================================================================

/** 最近查询标签 */
const RECENT_QUERIES = [
  'level:error AND service:payment',
  'status:500',
  'service:order-api',
  'message:"timeout"',
  'level:warn',
];

/** 生成直方图数据（最近 30 分钟，每分钟一个桶） */
function generateHistogramData() {
  const now = new Date();
  return Array.from({ length: 30 }, (_, i) => {
    const t = new Date(now.getTime() - (29 - i) * 60000);
    return {
      time: t.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      normal: Math.floor(80 + Math.random() * 200),
      error: Math.floor(2 + Math.random() * 30),
    };
  });
}

/** 模拟日志数据 */
const MOCK_LOGS: LogEntry[] = Array.from({ length: 50 }, (_, i) => {
  const levels: LogEntry['level'][] = ['info', 'warn', 'error', 'debug'];
  const services = ['payment-service', 'order-api', 'user-service', 'auth-service', 'gateway'];
  const messages = [
    'Request processed successfully',
    'Connection timeout after 30s',
    'Failed to authenticate user',
    'Database query took 2.3s',
    'Rate limit exceeded for client',
    'Cache miss for key user:1234',
    'Retry attempt 3/5 for upstream',
    'Health check passed',
    'Memory usage above threshold',
    'New deployment detected v2.1.0',
  ];
  const envs = ['production', 'staging', 'development'];
  const regions = ['cn-east-1', 'cn-north-2', 'cn-south-1'];
  const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
  const paths = ['/api/v1/orders', '/api/v1/users', '/api/v1/payments', '/api/v1/auth/login', '/health'];
  const level = levels[Math.floor(Math.random() * levels.length)];
  const ts = new Date(Date.now() - i * 12000);
  const statusCode = level === 'error' ? [500, 502, 503][Math.floor(Math.random() * 3)] : level === 'warn' ? [429, 408, 404][Math.floor(Math.random() * 3)] : [200, 201, 204][Math.floor(Math.random() * 3)];
  return {
    id: `log-${String(i + 1).padStart(4, '0')}`,
    timestamp: ts.toISOString(),
    level,
    service: services[Math.floor(Math.random() * services.length)],
    message: messages[Math.floor(Math.random() * messages.length)],
    rawLog: `${ts.toISOString()} [${level.toUpperCase()}] [${services[Math.floor(Math.random() * services.length)]}] ${messages[Math.floor(Math.random() * messages.length)]} | traceId=trace-${crypto.randomUUID().slice(0, 8)} spanId=span-${crypto.randomUUID().slice(0, 6)} host=node-${String(Math.floor(Math.random() * 5) + 1).padStart(2, '0')} env=${envs[Math.floor(Math.random() * envs.length)]} method=${methods[Math.floor(Math.random() * methods.length)]} path=${paths[Math.floor(Math.random() * paths.length)]} status=${statusCode} duration=${(Math.random() * 3000).toFixed(0)}ms clientIp=10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
    fields: {
      host: `node-${String(Math.floor(Math.random() * 5) + 1).padStart(2, '0')}`,
      traceId: `trace-${crypto.randomUUID().slice(0, 8)}`,
      spanId: `span-${crypto.randomUUID().slice(0, 6)}`,
      statusCode,
      duration: `${(Math.random() * 3000).toFixed(0)}ms`,
      method: methods[Math.floor(Math.random() * methods.length)],
      path: paths[Math.floor(Math.random() * paths.length)],
      env: envs[Math.floor(Math.random() * envs.length)],
      region: regions[Math.floor(Math.random() * regions.length)],
      clientIp: `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
      userAgent: 'Mozilla/5.0 (compatible; NexusLog/2.1)',
      requestSize: `${Math.floor(Math.random() * 5000)}B`,
      responseSize: `${Math.floor(Math.random() * 50000)}B`,
    },
  };
});

// ============================================================================
// 级别颜色映射
// ============================================================================
const LEVEL_CONFIG: Record<string, { color: string; tagColor: string }> = {
  error: { color: COLORS.danger, tagColor: 'error' },
  warn: { color: COLORS.warning, tagColor: 'warning' },
  info: { color: COLORS.info, tagColor: 'processing' },
  debug: { color: COLORS.purple, tagColor: 'purple' },
};

// ============================================================================
// RealtimeSearch 主组件
// ============================================================================
const RealtimeSearch: React.FC = () => {
  const isDark = useThemeStore((s) => s.isDark);

  // 查询状态
  const [query, setQuery] = useState('');
  const [isLive, setIsLive] = useState(true);

  // 日志详情抽屉
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);

  // 分页（pageSize 持久化）
  const [currentPage, setCurrentPage] = useState(1);
  const storedPageSize = usePreferencesStore((s) => s.pageSizes['realtimeSearch'] ?? 20);
  const setStoredPageSize = usePreferencesStore((s) => s.setPageSize);
  const [pageSize, setPageSizeLocal] = useState(storedPageSize);
  const setPageSize = useCallback((size: number) => {
    setPageSizeLocal(size);
    setStoredPageSize('realtimeSearch', size);
  }, [setStoredPageSize]);

  // 直方图数据
  const histogramData = useMemo(() => generateHistogramData(), []);
  const totalEvents = useMemo(
    () => histogramData.reduce((sum, d) => sum + d.normal + d.error, 0),
    [histogramData],
  );

  // 打开日志详情
  const handleRowClick = useCallback((record: LogEntry) => {
    setSelectedLog(record);
    setDrawerOpen(true);
  }, []);

  // 直方图 ECharts 配置
  const histogramOption: EChartsCoreOption = useMemo(() => ({
    grid: { top: 24, right: 16, bottom: 24, left: 48 },
    legend: {
      show: true,
      top: 0,
      right: 0,
      textStyle: { fontSize: 10, color: isDark ? '#94a3b8' : '#475569' },
      itemWidth: 10,
      itemHeight: 10,
    },
    xAxis: {
      type: 'category',
      data: histogramData.map((d) => d.time),
      axisLabel: { fontSize: 10 },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' } },
    },
    series: [
      {
        name: '正常',
        type: 'bar',
        stack: 'total',
        data: histogramData.map((d) => d.normal),
        itemStyle: { color: COLORS.primary, borderRadius: [0, 0, 0, 0] },
        barMaxWidth: 20,
      },
      {
        name: '错误',
        type: 'bar',
        stack: 'total',
        data: histogramData.map((d) => d.error),
        itemStyle: { color: COLORS.danger, borderRadius: [2, 2, 0, 0] },
        barMaxWidth: 20,
      },
    ],
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
    },
  }), [histogramData, isDark]);

  // 表格列定义
  const columns: ColumnsType<LogEntry> = useMemo(() => [
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 180,
      render: (v: string) => (
        <span className="text-sm font-mono opacity-70">
          {new Date(v).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
        </span>
      ),
    },
    {
      title: '级别',
      dataIndex: 'level',
      key: 'level',
      width: 80,
      render: (v: string) => {
        const cfg = LEVEL_CONFIG[v] || LEVEL_CONFIG.info;
        return <Tag color={cfg.tagColor} style={{ margin: 0, fontSize: 12 }}>{v.toUpperCase()}</Tag>;
      },
    },
    {
      title: '服务',
      dataIndex: 'service',
      key: 'service',
      width: 150,
      render: (v: string) => <span className="text-sm font-medium">{v}</span>,
    },
    {
      title: '消息',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true,
      render: (v: string) => <span className="text-sm">{v}</span>,
    },
  ], []);

  return (
    <div className="flex flex-col gap-4">
      {/* 查询栏 */}
      <div className="flex flex-col gap-3">
        <div className="flex gap-2 items-center flex-wrap">
          <Input.Search
            placeholder='输入查询语句，例如: level:error AND service:"payment-service"'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            enterButton={
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">play_arrow</span>
                执行
              </span>
            }
            onSearch={() => {}}
            style={{ flex: 1, minWidth: 300 }}
            allowClear
          />
          <Tooltip title="保存查询">
            <Button icon={<span className="material-symbols-outlined text-sm">bookmark_add</span>} />
          </Tooltip>
          <Button type="link" size="small">
            <span className="flex items-center gap-1 text-xs">
              <span className="material-symbols-outlined text-sm">help_outline</span>
              语法指南
            </span>
          </Button>
        </div>
        {/* 最近查询标签 */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs opacity-50">最近查询:</span>
          {RECENT_QUERIES.map((q) => (
            <Tag
              key={q}
              className="cursor-pointer"
              style={{ fontSize: 11, margin: 0 }}
              onClick={() => setQuery(q)}
            >
              {q}
            </Tag>
          ))}
        </div>
      </div>

      {/* 事件量直方图 */}
      <ChartWrapper
        title="事件量分布"
        subtitle={`最近 30 分钟 · 共 ${totalEvents.toLocaleString()} 条`}
        option={histogramOption}
        height={160}
      />

      {/* 日志结果表格 */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <Button
              size="small"
              type={isLive ? 'primary' : 'default'}
              onClick={() => setIsLive(!isLive)}
              icon={
                <span className="material-symbols-outlined text-sm">
                  {isLive ? 'pause' : 'play_arrow'}
                </span>
              }
            >
              {isLive ? '实时' : '已暂停'}
            </Button>
            <span className="text-xs opacity-50">
              共 {MOCK_LOGS.length} 条结果
            </span>
          </div>
          <Space size="small">
            <Tooltip title="列设置">
              <Button size="small" icon={<span className="material-symbols-outlined text-sm">view_column</span>} />
            </Tooltip>
            <Tooltip title="下载">
              <Button size="small" icon={<span className="material-symbols-outlined text-sm">download</span>} />
            </Tooltip>
          </Space>
        </div>

        <Table<LogEntry>
          dataSource={MOCK_LOGS}
          columns={columns}
          rowKey="id"
          size="small"
          pagination={{
            current: currentPage,
            pageSize,
            total: MOCK_LOGS.length,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
            pageSizeOptions: ['10', '20', '50', '100'],
            onChange: (page, size) => { setCurrentPage(page); setPageSize(size); },
            position: ['bottomLeft'],
          }}
          onRow={(record) => ({
            onClick: () => handleRowClick(record),
            style: { cursor: 'pointer' },
          })}
          scroll={{ x: 600 }}
        />
      </div>

      {/* 日志详情抽屉 */}
      <Drawer
        title={
          selectedLog ? (
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base" style={{ color: LEVEL_CONFIG[selectedLog.level]?.color }}>
                {selectedLog.level === 'error' ? 'error' : selectedLog.level === 'warn' ? 'warning' : 'info'}
              </span>
              <span>日志详情</span>
              <Tag color={LEVEL_CONFIG[selectedLog.level]?.tagColor || 'default'} style={{ margin: 0 }}>
                {selectedLog.level.toUpperCase()}
              </Tag>
            </div>
          ) : '日志详情'
        }
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={640}
        footer={
          <div className="flex items-center justify-between">
            <Space>
              <Button
                type="primary"
                ghost
                icon={<span className="material-symbols-outlined text-sm">manage_search</span>}
              >
                查看上下文
              </Button>
              <Button
                type="primary"
                ghost
                icon={<span className="material-symbols-outlined text-sm">timeline</span>}
              >
                跳转至 Trace
              </Button>
            </Space>
            <Space>
              <Tooltip title="复制为 JSON">
                <Button icon={<span className="material-symbols-outlined text-sm">data_object</span>} />
              </Tooltip>
              <Tooltip title="添加到收藏查询">
                <Button icon={<span className="material-symbols-outlined text-sm">bookmark_add</span>} />
              </Tooltip>
              <Tooltip title="创建告警规则">
                <Button icon={<span className="material-symbols-outlined text-sm">notification_add</span>} />
              </Tooltip>
            </Space>
          </div>
        }
      >
        {selectedLog && (
          <div className="flex flex-col gap-0">
            {/* 基础信息 */}
            <Divider orientation="left" orientationMargin={0} style={{ margin: '0 0 12px' }}>
              <span className="flex items-center gap-1 text-xs">
                <span className="material-symbols-outlined text-sm">info</span>
                基础信息
              </span>
            </Divider>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="日志 ID" span={2}>
                <Typography.Text copyable style={{ fontSize: 12, fontFamily: 'var(--font-mono, monospace)' }}>
                  {selectedLog.id}
                </Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="时间戳">
                <span className="font-mono text-xs">
                  {new Date(selectedLog.timestamp).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="级别">
                <Tag color={LEVEL_CONFIG[selectedLog.level]?.tagColor || 'default'} style={{ margin: 0 }}>
                  {selectedLog.level.toUpperCase()}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="服务名称">
                <Tag color="blue" style={{ margin: 0 }}>{selectedLog.service}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="主机">
                <span className="font-mono text-xs">{String(selectedLog.fields?.host ?? '-')}</span>
              </Descriptions.Item>
              <Descriptions.Item label="环境">
                <Tag color="cyan" style={{ margin: 0 }}>{String(selectedLog.fields?.env ?? '-')}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="区域">
                <span className="text-xs">{String(selectedLog.fields?.region ?? '-')}</span>
              </Descriptions.Item>
            </Descriptions>

            {/* 请求信息 */}
            <Divider orientation="left" orientationMargin={0} style={{ margin: '16px 0 12px' }}>
              <span className="flex items-center gap-1 text-xs">
                <span className="material-symbols-outlined text-sm">http</span>
                请求信息
              </span>
            </Divider>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="HTTP 方法">
                <Tag
                  color={
                    String(selectedLog.fields?.method) === 'GET' ? 'green'
                    : String(selectedLog.fields?.method) === 'POST' ? 'blue'
                    : String(selectedLog.fields?.method) === 'DELETE' ? 'red'
                    : 'orange'
                  }
                  style={{ margin: 0 }}
                >
                  {String(selectedLog.fields?.method ?? '-')}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="状态码">
                <Tag
                  color={Number(selectedLog.fields?.statusCode) >= 500 ? 'error' : Number(selectedLog.fields?.statusCode) >= 400 ? 'warning' : 'success'}
                  style={{ margin: 0 }}
                >
                  {String(selectedLog.fields?.statusCode ?? '-')}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="请求路径" span={2}>
                <span className="font-mono text-xs">{String(selectedLog.fields?.path ?? '-')}</span>
              </Descriptions.Item>
              <Descriptions.Item label="耗时">
                <span className="font-mono text-xs" style={{ color: parseInt(String(selectedLog.fields?.duration)) > 1000 ? COLORS.danger : parseInt(String(selectedLog.fields?.duration)) > 500 ? COLORS.warning : COLORS.success }}>
                  {String(selectedLog.fields?.duration ?? '-')}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="客户端 IP">
                <span className="font-mono text-xs">{String(selectedLog.fields?.clientIp ?? '-')}</span>
              </Descriptions.Item>
              <Descriptions.Item label="请求大小">
                <span className="text-xs">{String(selectedLog.fields?.requestSize ?? '-')}</span>
              </Descriptions.Item>
              <Descriptions.Item label="响应大小">
                <span className="text-xs">{String(selectedLog.fields?.responseSize ?? '-')}</span>
              </Descriptions.Item>
            </Descriptions>

            {/* 消息内容 */}
            <Divider orientation="left" orientationMargin={0} style={{ margin: '16px 0 12px' }}>
              <span className="flex items-center gap-1 text-xs">
                <span className="material-symbols-outlined text-sm">chat</span>
                消息内容
              </span>
            </Divider>
            <div
              className="p-3 rounded text-xs font-mono whitespace-pre-wrap break-all leading-relaxed"
              style={{ backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.04)', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}
            >
              {selectedLog.message}
            </div>

            {/* 标签 */}
            <Divider orientation="left" orientationMargin={0} style={{ margin: '16px 0 12px' }}>
              <span className="flex items-center gap-1 text-xs">
                <span className="material-symbols-outlined text-sm">label</span>
                标签
              </span>
            </Divider>
            <div className="flex flex-wrap gap-2">
              <Tag>service={selectedLog.service}</Tag>
              <Tag>level={selectedLog.level}</Tag>
              {selectedLog.fields?.host != null && <Tag>host={String(selectedLog.fields.host)}</Tag>}
              {selectedLog.fields?.env != null && <Tag color="cyan">env={String(selectedLog.fields.env)}</Tag>}
              {selectedLog.fields?.region != null && <Tag>region={String(selectedLog.fields.region)}</Tag>}
              {selectedLog.fields?.method != null && <Tag>method={String(selectedLog.fields.method)}</Tag>}
              {selectedLog.fields?.statusCode != null && <Tag color={Number(selectedLog.fields.statusCode) >= 500 ? 'error' : Number(selectedLog.fields.statusCode) >= 400 ? 'warning' : 'success'}>status={String(selectedLog.fields.statusCode)}</Tag>}
              {selectedLog.fields?.traceId != null && <Tag color="purple">trace={String(selectedLog.fields.traceId)}</Tag>}
              {selectedLog.fields?.spanId != null && <Tag color="purple">span={String(selectedLog.fields.spanId)}</Tag>}
            </div>

            {/* 追踪信息 */}
            <Divider orientation="left" orientationMargin={0} style={{ margin: '16px 0 12px' }}>
              <span className="flex items-center gap-1 text-xs">
                <span className="material-symbols-outlined text-sm">link</span>
                追踪信息
              </span>
            </Divider>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Trace ID">
                <Typography.Text copyable style={{ fontSize: 12, fontFamily: 'var(--font-mono, monospace)' }}>
                  {String(selectedLog.fields?.traceId ?? '-')}
                </Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="Span ID">
                <Typography.Text copyable style={{ fontSize: 12, fontFamily: 'var(--font-mono, monospace)' }}>
                  {String(selectedLog.fields?.spanId ?? '-')}
                </Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="User-Agent">
                <span className="font-mono text-xs">{String(selectedLog.fields?.userAgent ?? '-')}</span>
              </Descriptions.Item>
            </Descriptions>

            {/* 结构化字段 */}
            <Divider orientation="left" orientationMargin={0} style={{ margin: '16px 0 12px' }}>
              <span className="flex items-center gap-1 text-xs">
                <span className="material-symbols-outlined text-sm">data_object</span>
                结构化字段
              </span>
            </Divider>
            <div style={{ position: 'relative' }}>
              <Tooltip title="复制 JSON">
                <Button
                  size="small"
                  type="default"
                  style={{ position: 'absolute', top: 8, right: 8, zIndex: 1 }}
                  icon={<span className="material-symbols-outlined text-sm">content_copy</span>}
                  onClick={() => {
                    const json = JSON.stringify(selectedLog.fields ?? {}, null, 2);
                    navigator.clipboard.writeText(json).then(() => message.success('已复制 JSON'));
                  }}
                >
                  复制 JSON
                </Button>
              </Tooltip>
              <div
                className="p-3 rounded font-mono text-xs leading-relaxed whitespace-pre-wrap break-all"
                style={{
                  backgroundColor: isDark ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.04)',
                  border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                  maxHeight: 300,
                  overflow: 'auto',
                }}
              >
                {JSON.stringify(selectedLog.fields ?? {}, null, 2)}
              </div>
            </div>

            {/* 原始日志 */}
            {selectedLog.rawLog && (
              <>
                <Divider orientation="left" orientationMargin={0} style={{ margin: '16px 0 12px' }}>
                  <span className="flex items-center gap-1 text-xs">
                    <span className="material-symbols-outlined text-sm">article</span>
                    原始日志
                  </span>
                </Divider>
                <div style={{ position: 'relative' }}>
                  <Tooltip title="复制原始日志">
                    <Button
                      size="small"
                      type="default"
                      style={{ position: 'absolute', top: 8, right: 8, zIndex: 1 }}
                      icon={<span className="material-symbols-outlined text-sm">content_copy</span>}
                      onClick={() => {
                        navigator.clipboard.writeText(selectedLog.rawLog!).then(() => message.success('已复制原始日志'));
                      }}
                    >
                      复制
                    </Button>
                  </Tooltip>
                  <div
                    className="p-3 rounded font-mono text-xs leading-relaxed whitespace-pre-wrap break-all"
                    style={{
                      backgroundColor: isDark ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.04)',
                      border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                      maxHeight: 300,
                      overflow: 'auto',
                    }}
                  >
                    {selectedLog.rawLog}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default RealtimeSearch;
