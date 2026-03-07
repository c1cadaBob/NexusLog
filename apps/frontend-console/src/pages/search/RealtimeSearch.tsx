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
const DEFAULT_LOOKBACK_WINDOW_MS = 30 * 60 * 1000;
const EXTENDED_LOOKBACK_WINDOW_MS = 24 * 60 * 60 * 1000;

function formatLookbackWindow(windowMS: number): string {
  if (windowMS >= EXTENDED_LOOKBACK_WINDOW_MS) {
    return '最近 24 小时';
  }
  return '最近 30 分钟';
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
  const [lookbackWindowMS, setLookbackWindowMS] = useState(DEFAULT_LOOKBACK_WINDOW_MS);
  const [isUsingExtendedWindow, setIsUsingExtendedWindow] = useState(false);

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
    recordHistory?: boolean;
    lookbackWindowMS?: number;
    allowAutoWindowFallback?: boolean;
  }) => {
    setTableLoading(true);
    const requestedWindowMS = options.lookbackWindowMS ?? DEFAULT_LOOKBACK_WINDOW_MS;
    try {
      const runWithWindow = async (windowMS: number) => {
        const now = new Date();
        return queryRealtimeLogs({
          keywords: options.queryText,
          page: options.page,
          pageSize: options.pageSize,
          filters: {
            level: levelFilter || undefined,
            service: sourceFilter || undefined,
          },
          timeRange: {
            from: new Date(now.getTime() - windowMS).toISOString(),
            to: now.toISOString(),
          },
          recordHistory: options.recordHistory,
        });
      };

      let usedWindowMS = requestedWindowMS;
      let result = await runWithWindow(usedWindowMS);

      const shouldAutoFallback =
        options.allowAutoWindowFallback !== false &&
        usedWindowMS === DEFAULT_LOOKBACK_WINDOW_MS &&
        options.page === 1 &&
        !options.queryText.trim() &&
        result.total === 0;

      if (shouldAutoFallback) {
        usedWindowMS = EXTENDED_LOOKBACK_WINDOW_MS;
        result = await runWithWindow(usedWindowMS);
        setLookbackWindowMS(EXTENDED_LOOKBACK_WINDOW_MS);
        setIsUsingExtendedWindow(true);
        if (!options.silent) {
          message.info('近 30 分钟暂无日志，已自动扩展到最近 24 小时');
        }
      } else {
        setLookbackWindowMS(usedWindowMS);
        setIsUsingExtendedWindow(usedWindowMS > DEFAULT_LOOKBACK_WINDOW_MS);
      }

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
  }, [levelFilter, sourceFilter]);

  useEffect(() => {
    // 页面首次加载执行一次真实查询。
    void executeQuery({
      queryText: '',
      page: 1,
      pageSize,
      silent: true,
      lookbackWindowMS,
      allowAutoWindowFallback: true,
    });
  }, [executeQuery, pageSize, lookbackWindowMS]);

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
        lookbackWindowMS,
        allowAutoWindowFallback: false,
      });
    }, 5000);
    return () => window.clearInterval(timer);
  }, [activeQuery, executeQuery, isLive, lookbackWindowMS, pageSize]);

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
      lookbackWindowMS,
      allowAutoWindowFallback: true,
    });
    navigate(location.pathname, { replace: true, state: null });
  }, [executeQuery, location.pathname, location.state, lookbackWindowMS, navigate, pageSize]);

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
      lookbackWindowMS,
      allowAutoWindowFallback: false,
    });
  }, [levelFilter, sourceFilter, executeQuery, activeQuery, pageSize, lookbackWindowMS]);

  // 直方图数据
  const histogramData = useMemo(() => buildHistogramData(logs), [logs]);
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
  const lookbackWindowLabel = useMemo(() => formatLookbackWindow(lookbackWindowMS), [lookbackWindowMS]);

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
      lookbackWindowMS,
      allowAutoWindowFallback: true,
    });
  }, [executeQuery, lookbackWindowMS, pageSize]);

  // 执行检索（仅手动点击执行/回车时写入历史）
  const handleSearch = useCallback((value: string) => {
    runSearch(value, true);
  }, [runSearch]);

  const resetToRealtimeWindow = useCallback(() => {
    setLookbackWindowMS(DEFAULT_LOOKBACK_WINDOW_MS);
    setIsUsingExtendedWindow(false);
    void executeQuery({
      queryText: activeQuery,
      page: 1,
      pageSize,
      silent: false,
      lookbackWindowMS: DEFAULT_LOOKBACK_WINDOW_MS,
      allowAutoWindowFallback: false,
    });
  }, [activeQuery, executeQuery, pageSize]);

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

  const selectedFields = selectedLog?.fields;
  const drawerEventID = toDisplayText(selectedFields?.event_id ?? selectedLog?.id);
  const drawerLevel = toDisplayText(selectedFields?.level ?? selectedLog?.level);
  const drawerTimestamp = toDisplayText(selectedFields?.timestamp ?? selectedLog?.timestamp ?? selectedFields?.collect_time);
  const drawerMessage = toDisplayText(selectedLog?.message ?? selectedFields?.message);
  const drawerSource = toDisplayText(selectedFields?.source ?? selectedFields?.source_path ?? selectedFields?.source_internal);
  const drawerService = toDisplayText(selectedFields?.service_name ?? selectedLog?.service);
  const drawerRawLog = selectedLog?.rawLog ?? selectedFields?.raw_message ?? selectedFields?.raw_log ?? drawerMessage;

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
        subtitle={`${lookbackWindowLabel}（当前页）· 共 ${totalEvents.toLocaleString()} 条`}
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
            {isUsingExtendedWindow && (
              <Tag color="processing" style={{ margin: 0 }}>
                当前窗口：最近 24 小时
              </Tag>
            )}
            {isUsingExtendedWindow && (
              <Button size="small" onClick={resetToRealtimeWindow}>
                切回 30 分钟
              </Button>
            )}
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
                lookbackWindowMS,
                allowAutoWindowFallback: false,
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
            {/* 五层字段详情 */}
            <Collapse
              defaultActiveKey={['raw', 'event', 'transport', 'ingest', 'governance']}
              items={[
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
                      className="p-3 rounded font-mono text-xs leading-relaxed whitespace-pre-wrap break-all"
                      style={{ backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.04)', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}
                    >
                      {(() => {
                        const raw = drawerRawLog;
                        if (raw == null || raw === '') return '—';
                        return typeof raw === 'string' ? raw : JSON.stringify(raw);
                      })()}
                    </div>
                  ),
                },
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
                        <span className="font-mono text-xs">
                          {drawerTimestamp}
                        </span>
                      </Descriptions.Item>
                      <Descriptions.Item label="message">
                        <span className="text-xs">{drawerMessage}</span>
                      </Descriptions.Item>
                      <Descriptions.Item label="source" span={2}>
                        <span className="text-xs">{drawerSource}</span>
                      </Descriptions.Item>
                    </Descriptions>
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
              ]}
            />

            {/* 标签 */}
            <Divider orientation="left" orientationMargin={0} style={{ margin: '16px 0 12px' }}>
              <span className="flex items-center gap-1 text-xs">
                <span className="material-symbols-outlined text-sm">label</span>
                标签
              </span>
            </Divider>
            <div className="flex flex-wrap gap-2">
              <Tag>service={drawerService}</Tag>
              <Tag>level={drawerLevel}</Tag>
              {selectedFields?.host != null && <Tag>host={toDisplayText(selectedFields.host)}</Tag>}
              {selectedFields?.env != null && <Tag color="cyan">env={toDisplayText(selectedFields.env)}</Tag>}
              {selectedFields?.region != null && <Tag>region={toDisplayText(selectedFields.region)}</Tag>}
              {selectedFields?.method != null && <Tag>method={toDisplayText(selectedFields.method)}</Tag>}
              {selectedFields?.statusCode != null && <Tag color={Number(selectedFields.statusCode) >= 500 ? 'error' : Number(selectedFields.statusCode) >= 400 ? 'warning' : 'success'}>status={toDisplayText(selectedFields.statusCode)}</Tag>}
              {selectedFields?.traceId != null && <Tag color="purple">trace={toDisplayText(selectedFields.traceId)}</Tag>}
              {selectedFields?.spanId != null && <Tag color="purple">span={toDisplayText(selectedFields.spanId)}</Tag>}
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
                  {toDisplayText(selectedFields?.traceId, '-')}
                </Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="Span ID">
                <Typography.Text copyable style={{ fontSize: 12, fontFamily: 'var(--font-mono, monospace)' }}>
                  {toDisplayText(selectedFields?.spanId, '-')}
                </Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="User-Agent">
                <span className="font-mono text-xs">{toDisplayText(selectedFields?.userAgent, '-')}</span>
              </Descriptions.Item>
            </Descriptions>

          </div>
        )}
      </Drawer>
    </div>
  );
};

export default RealtimeSearch;
