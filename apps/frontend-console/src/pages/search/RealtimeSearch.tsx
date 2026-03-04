import React, { useEffect, useMemo, useCallback, useState } from 'react';
import { Input, Button, Tag, Table, Drawer, Space, Tooltip, Descriptions, Divider, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useThemeStore } from '../../stores/themeStore';
import { usePreferencesStore } from '../../stores/preferencesStore';
import { COLORS } from '../../theme/tokens';
import ChartWrapper from '../../components/charts/ChartWrapper';
import type { EChartsCoreOption } from 'echarts/core';
import type { LogEntry } from '../../types/log';
import { queryRealtimeLogs } from '../../api/query';

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

/** 构建近 30 分钟直方图（使用当前查询结果统计） */
function buildHistogramData(logs: LogEntry[]) {
  const now = new Date();
  const buckets = new Map<string, { time: string; normal: number; error: number }>();
  for (let i = 29; i >= 0; i -= 1) {
    const tick = new Date(now.getTime() - i * 60000);
    tick.setSeconds(0, 0);
    const key = tick.toISOString().slice(0, 16);
    buckets.set(key, {
      time: tick.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      normal: 0,
      error: 0,
    });
  }

  logs.forEach((log) => {
    const ts = new Date(log.timestamp);
    if (Number.isNaN(ts.getTime())) {
      return;
    }
    ts.setSeconds(0, 0);
    const key = ts.toISOString().slice(0, 16);
    const bucket = buckets.get(key);
    if (!bucket) {
      return;
    }
    if (log.level === 'error') {
      bucket.error += 1;
      return;
    }
    bucket.normal += 1;
  });

  return Array.from(buckets.values());
}

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
  const [activeQuery, setActiveQuery] = useState('');
  const [isLive, setIsLive] = useState(true);

  // 日志详情抽屉
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);

  // 查询结果状态
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [queryTimeMS, setQueryTimeMS] = useState(0);
  const [queryTimedOut, setQueryTimedOut] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);

  // 分页（pageSize 持久化）
  const [currentPage, setCurrentPage] = useState(1);
  const storedPageSize = usePreferencesStore((s) => s.pageSizes['realtimeSearch'] ?? 20);
  const setStoredPageSize = usePreferencesStore((s) => s.setPageSize);
  const [pageSize, setPageSizeLocal] = useState(storedPageSize);
  const setPageSize = useCallback((size: number) => {
    setPageSizeLocal(size);
    setStoredPageSize('realtimeSearch', size);
  }, [setStoredPageSize]);

  const executeQuery = useCallback(async (options: {
    queryText: string;
    page: number;
    pageSize: number;
    silent?: boolean;
  }) => {
    setTableLoading(true);
    try {
      const now = new Date();
      const result = await queryRealtimeLogs({
        keywords: options.queryText,
        page: options.page,
        pageSize: options.pageSize,
        timeRange: {
          // 默认查询近 30 分钟，保证页面加载和刷新更可控。
          from: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
          to: now.toISOString(),
        },
      });
      setLogs(result.hits);
      setTotal(result.total);
      setCurrentPage(result.page);
      setQueryTimeMS(result.queryTimeMS);
      setQueryTimedOut(result.timedOut);
      if (result.timedOut && !options.silent) {
        message.warning('查询超时，结果可能不完整');
      }
    } catch (error) {
      if (!options.silent) {
        const readableError = error instanceof Error ? error.message : '查询失败，请稍后重试';
        message.error(readableError);
      }
    } finally {
      setTableLoading(false);
    }
  }, []);

  useEffect(() => {
    // 页面首次加载执行一次真实查询。
    void executeQuery({ queryText: '', page: 1, pageSize, silent: true });
  }, [executeQuery, pageSize]);

  useEffect(() => {
    // 实时模式下按 5 秒轮询当前条件。
    if (!isLive) {
      return () => undefined;
    }
    const timer = window.setInterval(() => {
      void executeQuery({
        queryText: activeQuery,
        page: 1,
        pageSize,
        silent: true,
      });
    }, 5000);
    return () => window.clearInterval(timer);
  }, [activeQuery, executeQuery, isLive, pageSize]);

  // 直方图数据
  const histogramData = useMemo(() => buildHistogramData(logs), [logs]);
  const totalEvents = useMemo(
    () => histogramData.reduce((sum, d) => sum + d.normal + d.error, 0),
    [histogramData],
  );

  // 打开日志详情
  const handleRowClick = useCallback((record: LogEntry) => {
    setSelectedLog(record);
    setDrawerOpen(true);
  }, []);

  // 执行检索（手动触发）
  const handleSearch = useCallback((value: string) => {
    const keyword = value.trim();
    setQuery(keyword);
    setActiveQuery(keyword);
    void executeQuery({
      queryText: keyword,
      page: 1,
      pageSize,
      silent: false,
    });
  }, [executeQuery, pageSize]);

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
            onSearch={handleSearch}
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
              onClick={() => handleSearch(q)}
            >
              {q}
            </Tag>
          ))}
        </div>
      </div>

      {/* 事件量直方图 */}
      <ChartWrapper
        title="事件量分布"
        subtitle={`最近 30 分钟（当前页）· 共 ${totalEvents.toLocaleString()} 条`}
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
              共 {total.toLocaleString()} 条结果 · 耗时 {queryTimeMS}ms
            </span>
            {queryTimedOut && <Tag color="warning" style={{ margin: 0 }}>查询超时</Tag>}
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
          dataSource={logs}
          columns={columns}
          rowKey="id"
          loading={tableLoading}
          size="small"
          pagination={{
            current: currentPage,
            pageSize,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
            pageSizeOptions: ['10', '20', '50', '100'],
            onChange: (page, size) => {
              setCurrentPage(page);
              setPageSize(size);
              void executeQuery({
                queryText: activeQuery,
                page,
                pageSize: size,
                silent: true,
              });
            },
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
