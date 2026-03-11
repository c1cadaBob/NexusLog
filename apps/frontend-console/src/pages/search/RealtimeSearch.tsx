import React, { useEffect, useMemo, useCallback, useState, useRef } from 'react';
import { Input, Button, Tag, Table, Drawer, Space, Tooltip, Descriptions, Divider, Typography, message, Select, Collapse } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useLocation, useNavigate } from 'react-router-dom';
import { useThemeStore } from '../../stores/themeStore';
import { usePreferencesStore } from '../../stores/preferencesStore';
import { COLORS } from '../../theme/tokens';
import ChartWrapper from '../../components/charts/ChartWrapper';
import type { EChartsCoreOption } from 'echarts/core';
import type { LogEntry } from '../../types/log';
import { queryRealtimeLogs } from '../../api/query';
import { aggregateRealtimeDisplayLogs, summarizeImageAggregation } from './realtimeLogAggregation';

// ============================================================================
// 本地 UI 辅助数据
// ============================================================================

/** 最近查询建议标签，仅用于快速填充查询条件，不是日志列表数据源 */
const RECENT_QUERIES = [
  'level:error AND service:payment',
  'status:500',
  'service:order-api',
  'message:"timeout"',
  'level:warn',
];
const HISTOGRAM_WINDOW_MS = 30 * 60 * 1000;
const HISTOGRAM_PAGE_SIZE = 200;

function buildRealtimeTableTimeRange() {
  return {
    from: '',
    to: new Date().toISOString(),
  };
}

function buildHistogramTimeRange() {
  const now = new Date();
  return {
    from: new Date(now.getTime() - HISTOGRAM_WINDOW_MS).toISOString(),
    to: now.toISOString(),
  };
}

function toDisplayText(value: unknown, fallback = '—'): string {
  if (value == null) {
    return fallback;
  }
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized || fallback;
  }
  return String(value);
}

function formatDetailValue(value: unknown, fallback = '—'): string {
  if (value == null || value === '') {
    return fallback;
  }
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized || fallback;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

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

interface RealtimeNavigationState {
  autoRun?: boolean;
  presetQuery?: string;
}

// ============================================================================
// RealtimeSearch 主组件
// ============================================================================
const RealtimeSearch: React.FC = () => {
  const isDark = useThemeStore((s) => s.isDark);
  const location = useLocation();
  const navigate = useNavigate();

  // 查询状态
  const [query, setQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [isLive, setIsLive] = useState(true);

  // 筛选器
  const [levelFilter, setLevelFilter] = useState<string>('');
  const [sourceFilter, setSourceFilter] = useState<string>('');

  // 日志详情抽屉
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);

  // 查询结果状态
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [queryTimeMS, setQueryTimeMS] = useState(0);
  const [queryTimedOut, setQueryTimedOut] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const [histogramLogs, setHistogramLogs] = useState<LogEntry[]>([]);

  // 分页（pageSize 持久化）
  const [currentPage, setCurrentPage] = useState(1);
  const storedPageSize = usePreferencesStore((s) => s.pageSizes['realtimeSearch'] ?? 20);
  const setStoredPageSize = usePreferencesStore((s) => s.setPageSize);
  const [pageSize, setPageSizeLocal] = useState(storedPageSize);
  const setPageSize = useCallback((size: number) => {
    setPageSizeLocal(size);
    setStoredPageSize('realtimeSearch', size);
  }, [setStoredPageSize]);
  const latestQueryRequestRef = useRef(0);
  const initialQueryTriggeredRef = useRef(false);

  const executeQuery = useCallback(async (options: {
    queryText: string;
    page: number;
    pageSize: number;
    silent?: boolean;
    recordHistory?: boolean;
  }) => {
    const requestID = latestQueryRequestRef.current + 1;
    latestQueryRequestRef.current = requestID;
    setTableLoading(true);
    try {
      const filters = {
        level: levelFilter || undefined,
        service: sourceFilter || undefined,
      };
      const realtimeTableTimeRange = buildRealtimeTableTimeRange();
      const histogramTimeRange = buildHistogramTimeRange();
      const [result, histogramResult] = await Promise.all([
        queryRealtimeLogs({
          keywords: options.queryText,
          page: options.page,
          pageSize: options.pageSize,
          filters,
          timeRange: realtimeTableTimeRange,
          recordHistory: options.recordHistory,
        }),
        queryRealtimeLogs({
          keywords: options.queryText,
          page: 1,
          pageSize: HISTOGRAM_PAGE_SIZE,
          filters,
          timeRange: histogramTimeRange,
          recordHistory: false,
        }),
      ]);

      if (requestID !== latestQueryRequestRef.current) {
        return;
      }

      setLogs(result.hits);
      setHistogramLogs(histogramResult.hits);
      setTotal(result.total);
      setCurrentPage(result.page);
      setQueryTimeMS(result.queryTimeMS);
      setQueryTimedOut(result.timedOut);
      if (result.timedOut && !options.silent) {
        message.warning('查询超时，结果可能不完整');
      }
    } catch (error) {
      if (requestID !== latestQueryRequestRef.current) {
        return;
      }
      if (!options.silent) {
        const readableError = error instanceof Error ? error.message : '查询失败，请稍后重试';
        message.error(readableError);
      }
    } finally {
      if (requestID === latestQueryRequestRef.current) {
        setTableLoading(false);
      }
    }
  }, [levelFilter, sourceFilter]);

  useEffect(() => {
    if (initialQueryTriggeredRef.current) {
      return;
    }
    initialQueryTriggeredRef.current = true;
    void executeQuery({
      queryText: '',
      page: 1,
      pageSize,
      silent: true,
    });
  }, [executeQuery, pageSize]);

  useEffect(() => {
    // 实时模式下按 5 秒轮询当前条件。
    if (!isLive) {
      return () => undefined;
    }
    const timer = window.setInterval(() => {
      void executeQuery({
        queryText: activeQuery,
        page: currentPage,
        pageSize,
        silent: true,
      });
    }, 5000);
    return () => window.clearInterval(timer);
  }, [activeQuery, currentPage, executeQuery, isLive, pageSize]);

  useEffect(() => {
    const state = (location.state as RealtimeNavigationState | null) ?? null;
    const presetQuery = state?.presetQuery?.trim() ?? '';
    if (!state?.autoRun || !presetQuery) {
      return;
    }
    setQuery(presetQuery);
    setActiveQuery(presetQuery);
    void executeQuery({
      queryText: presetQuery,
      page: 1,
      pageSize,
      silent: false,
    });
    navigate(location.pathname, { replace: true, state: null });
  }, [executeQuery, location.pathname, location.state, navigate, pageSize]);

  // 筛选器变化时重新执行查询（跳过首次挂载，避免与初始查询重复）
  const filterEffectMounted = useRef(false);
  useEffect(() => {
    if (!filterEffectMounted.current) {
      filterEffectMounted.current = true;
      return;
    }
    void executeQuery({
      queryText: activeQuery,
      page: 1,
      pageSize,
      silent: true,
    });
  }, [levelFilter, sourceFilter, executeQuery, activeQuery, pageSize]);

  // 直方图数据
  const histogramData = useMemo(() => buildHistogramData(histogramLogs), [histogramLogs]);
  const displayLogs = useMemo(() => aggregateRealtimeDisplayLogs(logs), [logs]);
  const imageAggregationSummary = useMemo(() => summarizeImageAggregation(displayLogs), [displayLogs]);
  const uniqueSources = useMemo(() => {
    const seen = new Set<string>();
    logs.forEach((log) => {
      const s = log.service?.trim();
      if (s) seen.add(s);
    });
    return Array.from(seen).sort();
  }, [logs]);
  const totalEvents = useMemo(
    () => histogramData.reduce((sum, d) => sum + d.normal + d.error, 0),
    [histogramData],
  );

  // 打开日志详情
  const handleRowClick = useCallback((record: LogEntry) => {
    setSelectedLog(record);
    setDrawerOpen(true);
  }, []);

  const runSearch = useCallback((value: string, recordHistory: boolean) => {
    const keyword = value.trim();
    setQuery(keyword);
    setActiveQuery(keyword);
    void executeQuery({
      queryText: keyword,
      page: 1,
      pageSize,
      silent: false,
      recordHistory,
    });
  }, [executeQuery, pageSize]);

  // 执行检索（仅手动点击执行/回车时写入历史）
  const handleSearch = useCallback((value: string) => {
    runSearch(value, true);
  }, [runSearch]);

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
      title: '主机',
      dataIndex: 'host',
      key: 'host',
      width: 180,
      ellipsis: true,
      render: (v: string) => {
        const displayValue = toDisplayText(v);
        if (displayValue === '—') {
          return <span className="text-sm opacity-50">—</span>;
        }
        return (
          <Tooltip title={displayValue}>
            <span className="text-sm font-mono">{displayValue}</span>
          </Tooltip>
        );
      },
    },
    {
      title: '主机IP',
      dataIndex: 'hostIp',
      key: 'hostIp',
      width: 160,
      ellipsis: true,
      render: (v: string) => {
        const displayValue = toDisplayText(v);
        if (displayValue === '—') {
          return <span className="text-sm opacity-50">—</span>;
        }
        return (
          <Tooltip title={displayValue}>
            <span className="text-sm font-mono">{displayValue}</span>
          </Tooltip>
        );
      },
    },
    {
      title: '消息',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true,
      render: (v: string, record) => {
        if (!record.aggregated) {
          return <span className="text-sm">{v}</span>;
        }
        return (
          <div className="flex items-center gap-2 min-w-0">
            <Tag color="blue" style={{ margin: 0 }}>聚合 {record.aggregated.count}</Tag>
            <Tooltip title={record.aggregated.samplePaths.join('\n') || v}>
              <span className="text-sm truncate">{v}</span>
            </Tooltip>
          </div>
        );
      },
    },
  ], []);

  const copyToClipboard = useCallback(async (content: string, successText: string) => {
    const normalized = content.trim();
    if (!normalized || normalized === '—') {
      message.warning('没有可复制的内容');
      return;
    }
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(normalized);
      } else if (typeof document !== 'undefined') {
        const textarea = document.createElement('textarea');
        textarea.value = normalized;
        textarea.setAttribute('readonly', 'true');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      message.success(successText);
    } catch {
      message.error('复制失败，请检查浏览器权限');
    }
  }, []);

  const selectedFields = selectedLog?.fields;
  const selectedAggregation = selectedLog?.aggregated;
  const drawerEventID = toDisplayText(selectedFields?.event_id ?? selectedLog?.id);
  const drawerLevel = toDisplayText(selectedFields?.level ?? selectedLog?.level);
  const drawerTimestamp = toDisplayText(selectedFields?.timestamp ?? selectedLog?.timestamp ?? selectedFields?.collect_time);
  const drawerMessage = toDisplayText(selectedLog?.message ?? selectedFields?.message);
  const drawerSource = toDisplayText(selectedFields?.source ?? selectedFields?.source_path ?? selectedFields?.source_internal);
  const drawerService = toDisplayText(selectedLog?.service ?? selectedFields?.service_name ?? selectedFields?.service);
  const drawerHost = toDisplayText(selectedLog?.host ?? selectedFields?.host ?? selectedFields?.server_id);
  const drawerHostIP = toDisplayText(selectedLog?.hostIp ?? selectedFields?.host_ip, '—');
  const drawerRawLog = selectedLog?.rawLog ?? selectedFields?.raw_message ?? selectedFields?.raw_log ?? drawerMessage;
  const drawerTraceId = toDisplayText(selectedFields?.traceId, '—');
  const drawerSpanId = toDisplayText(selectedFields?.spanId, '—');
  const drawerMethod = toDisplayText(selectedFields?.method, '—');
  const drawerStatusCode = toDisplayText(selectedFields?.statusCode, '—');
  const drawerUserAgent = toDisplayText(selectedFields?.userAgent, '—');
  const drawerRawContent = formatDetailValue(drawerRawLog);
  const drawerFieldsJson = useMemo(() => {
    if (!selectedFields) {
      return '—';
    }
    return formatDetailValue(
      Object.fromEntries(Object.entries(selectedFields).sort(([left], [right]) => left.localeCompare(right))),
    );
  }, [selectedFields]);
  const drawerPayloadJson = useMemo(() => {
    if (!selectedLog) {
      return '—';
    }
    return formatDetailValue({
      id: selectedLog.id,
      timestamp: selectedLog.timestamp,
      level: selectedLog.level,
      service: selectedLog.service,
      host: selectedLog.host,
      hostIp: selectedLog.hostIp,
      message: selectedLog.message,
      rawLog: selectedLog.rawLog ?? null,
      aggregated: selectedAggregation ?? null,
      fields: selectedFields ?? {},
    });
  }, [selectedAggregation, selectedFields, selectedLog]);
  const drawerSummaryItems = useMemo(() => {
    const items = [
      { key: 'event-id', label: '事件 ID', value: drawerEventID, mono: true, copyable: true },
      { key: 'timestamp', label: '时间', value: drawerTimestamp, mono: true, copyable: true },
      { key: 'service', label: '服务', value: drawerService, mono: false, copyable: false },
      { key: 'host', label: '主机', value: drawerHost, mono: true, copyable: true },
      { key: 'host-ip', label: '主机 IP', value: drawerHostIP, mono: true, copyable: drawerHostIP !== '—' },
      { key: 'source', label: '来源', value: drawerSource, mono: true, copyable: true },
      { key: 'trace', label: 'Trace ID', value: drawerTraceId, mono: true, copyable: drawerTraceId !== '—' },
    ];
    if (selectedAggregation) {
      items.push({
        key: 'aggregation',
        label: '图片聚合',
        value: `${selectedAggregation.count} 条已折叠`,
        mono: false,
        copyable: false,
      });
    }
    return items;
  }, [drawerEventID, drawerHost, drawerHostIP, drawerService, drawerSource, drawerTimestamp, drawerTraceId, selectedAggregation]);

  return (
    <div className="flex flex-col gap-4">
      {/* 查询栏 */}
      <div className="flex flex-col gap-3">
        <div className="flex gap-2 items-center flex-wrap">
          <Input.Search
            id="realtime-query-input"
            name="realtime-query"
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
              onClick={() => runSearch(q, false)}
            >
              {q}
            </Tag>
          ))}
        </div>

        {/* 级别 / 来源筛选 */}
        <Space wrap>
          <Select
            placeholder="级别"
            allowClear
            value={levelFilter || undefined}
            onChange={(v) => setLevelFilter(v ?? '')}
            style={{ minWidth: 120 }}
            options={[
              { value: '', label: 'ALL' },
              { value: 'debug', label: 'DEBUG' },
              { value: 'info', label: 'INFO' },
              { value: 'warn', label: 'WARN' },
              { value: 'error', label: 'ERROR' },
              { value: 'fatal', label: 'FATAL' },
            ]}
          />
          <Select
            placeholder="来源/服务"
            allowClear
            showSearch
            value={sourceFilter || undefined}
            onChange={(v) => setSourceFilter(v ?? '')}
            style={{ minWidth: 180 }}
            optionFilterProp="label"
            options={[
              { value: '', label: 'ALL' },
              ...uniqueSources.map((s) => ({ value: s, label: s })),
            ]}
          />
        </Space>
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
              共 {total.toLocaleString()} 条结果 · 耗时 {queryTimeMS}ms
            </span>
            {imageAggregationSummary.hiddenRows > 0 && (
              <Tag color="blue" style={{ margin: 0 }}>
                本页已聚合 {imageAggregationSummary.groupedRows} 组图片日志，折叠 {imageAggregationSummary.hiddenRows} 条
              </Tag>
            )}
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
          dataSource={displayLogs}
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
          scroll={{ x: 980 }}
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
        width={760}
        styles={{ body: { paddingTop: 12, paddingBottom: 12 } }}
        footer={selectedLog ? (
          <div className="flex items-center justify-end gap-2 flex-wrap">
            <Button
              icon={<span className="material-symbols-outlined text-sm">data_object</span>}
              onClick={() => void copyToClipboard(drawerFieldsJson, '已复制字段 JSON')}
            >
              字段 JSON
            </Button>
            <Button
              type="primary"
              ghost
              icon={<span className="material-symbols-outlined text-sm">content_copy</span>}
              onClick={() => void copyToClipboard(drawerPayloadJson, '已复制完整载荷')}
            >
              完整载荷
            </Button>
          </div>
        ) : null}
      >
        {selectedLog && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {drawerSummaryItems.map((item) => (
                <div
                  key={item.key}
                  className="rounded-lg p-3"
                  style={{
                    backgroundColor: isDark ? 'rgba(15,23,42,0.65)' : 'rgba(248,250,252,0.95)',
                    border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                  }}
                >
                  <div className="text-[11px] uppercase tracking-wide opacity-50 mb-1">{item.label}</div>
                  <Typography.Text
                    copyable={item.copyable ? { text: item.value } : false}
                    style={{
                      fontSize: 12,
                      display: 'block',
                      lineHeight: 1.6,
                      wordBreak: 'break-all',
                      fontFamily: item.mono ? 'var(--font-mono, monospace)' : 'inherit',
                    }}
                  >
                    {item.value}
                  </Typography.Text>
                </div>
              ))}
            </div>

            <div
              className="rounded-lg p-3"
              style={{
                backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.03)',
                border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
              }}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[11px] uppercase tracking-wide opacity-50">消息</span>
                <Space size="small">
                  <Tooltip title="复制消息">
                    <Button
                      size="small"
                      icon={<span className="material-symbols-outlined text-sm">content_copy</span>}
                      onClick={() => void copyToClipboard(drawerMessage, '已复制日志消息')}
                    />
                  </Tooltip>
                  <Tooltip title="复制原始日志">
                    <Button
                      size="small"
                      icon={<span className="material-symbols-outlined text-sm">article</span>}
                      onClick={() => void copyToClipboard(drawerRawContent, '已复制原始日志')}
                    />
                  </Tooltip>
                </Space>
              </div>
              <Typography.Paragraph
                className="!mb-0 text-sm leading-6 whitespace-pre-wrap break-all"
                ellipsis={{ rows: 6, expandable: true, symbol: '展开' }}
              >
                {drawerMessage}
              </Typography.Paragraph>
            </div>

            <div className="flex flex-wrap gap-2">
              <Tag>service={drawerService}</Tag>
              <Tag>level={drawerLevel}</Tag>
              {drawerHost !== '—' && <Tag>host={drawerHost}</Tag>}
              {drawerHostIP !== '—' && <Tag>host_ip={drawerHostIP}</Tag>}
              {selectedFields?.env != null && <Tag color="cyan">env={toDisplayText(selectedFields.env)}</Tag>}
              {selectedFields?.region != null && <Tag>region={toDisplayText(selectedFields.region)}</Tag>}
              {selectedFields?.method != null && <Tag>method={toDisplayText(selectedFields.method)}</Tag>}
              {selectedFields?.statusCode != null && <Tag color={Number(selectedFields.statusCode) >= 500 ? 'error' : Number(selectedFields.statusCode) >= 400 ? 'warning' : 'success'}>status={toDisplayText(selectedFields.statusCode)}</Tag>}
              {selectedFields?.traceId != null && <Tag color="purple">trace={toDisplayText(selectedFields.traceId)}</Tag>}
              {selectedFields?.spanId != null && <Tag color="purple">span={toDisplayText(selectedFields.spanId)}</Tag>}
            </div>

            <Collapse
              defaultActiveKey={['event']}
              items={[
                {
                  key: 'event',
                  label: (
                    <span className="flex items-center gap-1 text-xs">
                      <span className="material-symbols-outlined text-sm">event</span>
                      事件层 (Event Layer)
                    </span>
                  ),
                  children: (
                    <Descriptions column={2} size="small" bordered>
                      <Descriptions.Item label="event_id">
                        <Typography.Text copyable style={{ fontSize: 12, fontFamily: 'var(--font-mono, monospace)' }}>
                          {drawerEventID}
                        </Typography.Text>
                      </Descriptions.Item>
                      <Descriptions.Item label="level">
                        <Tag color={LEVEL_CONFIG[selectedLog.level]?.tagColor || 'default'} style={{ margin: 0 }}>
                          {drawerLevel.toUpperCase()}
                        </Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="timestamp">
                        <span className="font-mono text-xs">{drawerTimestamp}</span>
                      </Descriptions.Item>
                      <Descriptions.Item label="service_name">
                        <span className="text-xs">{drawerService}</span>
                      </Descriptions.Item>
                      <Descriptions.Item label="host">
                        <span className="font-mono text-xs">{drawerHost}</span>
                      </Descriptions.Item>
                      <Descriptions.Item label="host_ip">
                        <span className="font-mono text-xs">{drawerHostIP}</span>
                      </Descriptions.Item>
                      {selectedAggregation && (
                        <Descriptions.Item label="image_aggregation" span={2}>
                          <span className="text-xs">{selectedAggregation.summary}</span>
                        </Descriptions.Item>
                      )}
                      <Descriptions.Item label="message" span={2}>
                        <Typography.Paragraph className="!mb-0 text-xs whitespace-pre-wrap break-all">
                          {drawerMessage}
                        </Typography.Paragraph>
                      </Descriptions.Item>
                      <Descriptions.Item label="source" span={2}>
                        <Typography.Text copyable style={{ fontSize: 12, fontFamily: 'var(--font-mono, monospace)' }}>
                          {drawerSource}
                        </Typography.Text>
                      </Descriptions.Item>
                    </Descriptions>
                  ),
                },
                ...(selectedAggregation ? [{
                  key: 'aggregation',
                  label: (
                    <span className="flex items-center gap-1 text-xs">
                      <span className="material-symbols-outlined text-sm">stacked_email</span>
                      图片聚合清单 (Aggregated Image Logs)
                    </span>
                  ),
                  children: (
                    <div className="flex flex-col gap-2">
                      <div className="text-xs opacity-70">{selectedAggregation.summary}</div>
                      <div
                        className="p-3 rounded font-mono text-xs leading-relaxed whitespace-pre-wrap break-all max-h-72 overflow-auto"
                        style={{ backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.04)', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}
                      >
                        {selectedAggregation.entries.map((entry, entryIndex) => `${entryIndex + 1}. ${entry.rawLog ?? entry.message}`).join('\n')}
                      </div>
                    </div>
                  ),
                }] : []),
                {
                  key: 'raw',
                  label: (
                    <span className="flex items-center gap-1 text-xs">
                      <span className="material-symbols-outlined text-sm">article</span>
                      原始层 (Raw Layer)
                    </span>
                  ),
                  children: (
                    <div
                      className="p-3 rounded font-mono text-xs leading-relaxed whitespace-pre-wrap break-all max-h-80 overflow-auto"
                      style={{ backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.04)', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}
                    >
                      {drawerRawContent}
                    </div>
                  ),
                },
                {
                  key: 'transport',
                  label: (
                    <span className="flex items-center gap-1 text-xs">
                      <span className="material-symbols-outlined text-sm">swap_horiz</span>
                      传输层 (Transport Layer)
                    </span>
                  ),
                  children: (
                    <Descriptions column={2} size="small" bordered>
                      <Descriptions.Item label="agent_id">
                        <span className="font-mono text-xs">{toDisplayText(selectedFields?.agent_id)}</span>
                      </Descriptions.Item>
                      <Descriptions.Item label="batch_id">
                        <span className="font-mono text-xs">{toDisplayText(selectedFields?.batch_id)}</span>
                      </Descriptions.Item>
                      <Descriptions.Item label="collect_time">
                        <span className="font-mono text-xs">{toDisplayText(selectedFields?.collect_time ?? selectedLog?.timestamp)}</span>
                      </Descriptions.Item>
                      <Descriptions.Item label="sequence">
                        <span className="font-mono text-xs">{toDisplayText(selectedFields?.sequence)}</span>
                      </Descriptions.Item>
                    </Descriptions>
                  ),
                },
                {
                  key: 'ingest',
                  label: (
                    <span className="flex items-center gap-1 text-xs">
                      <span className="material-symbols-outlined text-sm">input</span>
                      接入层 (Ingest Layer)
                    </span>
                  ),
                  children: (
                    <Descriptions column={2} size="small" bordered>
                      <Descriptions.Item label="ingested_at">
                        <span className="font-mono text-xs">{toDisplayText(selectedFields?.ingested_at)}</span>
                      </Descriptions.Item>
                      <Descriptions.Item label="schema_version">
                        <span className="font-mono text-xs">{toDisplayText(selectedFields?.schema_version)}</span>
                      </Descriptions.Item>
                      <Descriptions.Item label="pipeline_version">
                        <span className="font-mono text-xs">{toDisplayText(selectedFields?.pipeline_version)}</span>
                      </Descriptions.Item>
                    </Descriptions>
                  ),
                },
                {
                  key: 'governance',
                  label: (
                    <span className="flex items-center gap-1 text-xs">
                      <span className="material-symbols-outlined text-sm">admin_panel_settings</span>
                      治理层 (Governance Layer)
                    </span>
                  ),
                  children: (
                    <Descriptions column={2} size="small" bordered>
                      <Descriptions.Item label="tenant_id">
                        <span className="font-mono text-xs">{toDisplayText(selectedFields?.tenant_id)}</span>
                      </Descriptions.Item>
                      <Descriptions.Item label="retention_policy">
                        <span className="font-mono text-xs">{toDisplayText(selectedFields?.retention_policy)}</span>
                      </Descriptions.Item>
                      <Descriptions.Item label="pii_masked">
                        <span className="font-mono text-xs">{toDisplayText(selectedFields?.pii_masked)}</span>
                      </Descriptions.Item>
                    </Descriptions>
                  ),
                },
                {
                  key: 'payload',
                  label: (
                    <span className="flex items-center gap-1 text-xs">
                      <span className="material-symbols-outlined text-sm">data_object</span>
                      完整载荷 (Full Payload)
                    </span>
                  ),
                  children: (
                    <div
                      className="p-3 rounded font-mono text-xs leading-relaxed whitespace-pre-wrap break-all max-h-96 overflow-auto"
                      style={{ backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.04)', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}
                    >
                      {drawerPayloadJson}
                    </div>
                  ),
                },
              ]}
            />

            <Divider orientation="left" orientationMargin={0} style={{ margin: '8px 0 12px' }}>
              <span className="flex items-center gap-1 text-xs">
                <span className="material-symbols-outlined text-sm">link</span>
                追踪信息
              </span>
            </Divider>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Trace ID">
                <Typography.Text copyable={drawerTraceId !== '—'} style={{ fontSize: 12, fontFamily: 'var(--font-mono, monospace)' }}>
                  {drawerTraceId}
                </Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="Span ID">
                <Typography.Text copyable={drawerSpanId !== '—'} style={{ fontSize: 12, fontFamily: 'var(--font-mono, monospace)' }}>
                  {drawerSpanId}
                </Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="Method / Status">
                <span className="font-mono text-xs">
                  {[drawerMethod !== '—' ? drawerMethod : '', drawerStatusCode !== '—' ? drawerStatusCode : ''].filter(Boolean).join(' / ') || '—'}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="User-Agent">
                <span className="font-mono text-xs break-all">{drawerUserAgent}</span>
              </Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default RealtimeSearch;
