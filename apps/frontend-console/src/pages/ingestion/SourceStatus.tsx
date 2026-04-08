import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, App, Button, Card, Descriptions, Dropdown, Empty, Input, Modal, Select, Space, Spin, Statistic, Table, Tag, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import ChartWrapper from '../../components/charts/ChartWrapper';
import { fetchPullSourceStatus, runPullTask, type PullSourceRuntimeStatusItem, type PullSourceStatusResponse } from '../../api/ingest';
import { hasAnyCapability } from '../../auth/routeAuthorization';
import PullPackageHistoryDrawer from './PullPackageHistoryDrawer';
import PullTaskHistoryDrawer from './PullTaskHistoryDrawer';
import { useAuthStore } from '../../stores/authStore';
import { usePreferencesStore } from '../../stores/preferencesStore';
import { COLORS } from '../../theme/tokens';

const RANGE_OPTIONS = [
  { label: '最近 1 小时', value: '1h' },
  { label: '最近 6 小时', value: '6h' },
  { label: '最近 24 小时', value: '24h' },
  { label: '最近 7 天', value: '7d' },
] as const;

const STATUS_OPTIONS = [
  { label: '全部状态', value: 'all' },
  { label: '健康', value: 'healthy' },
  { label: '运行中', value: 'running' },
  { label: '暂停', value: 'paused' },
  { label: '禁用', value: 'disabled' },
  { label: '离线', value: 'offline' },
  { label: '错误', value: 'error' },
];

const SOURCE_STATUS_AUTO_REFRESH_MS = 10_000;
const SOURCE_STATUS_CHANGE_HIGHLIGHT_MS = 12_000;

function formatDateTime(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN');
}

function formatShortDateTime(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatShortId(value?: string, head = 8, tail = 4) {
  const normalized = String(value ?? '').trim();
  if (!normalized) return '-';
  if (normalized.length <= head + tail + 1) return normalized;
  return `${normalized.slice(0, head)}…${normalized.slice(-tail)}`;
}

function formatNumber(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  return value.toLocaleString('zh-CN');
}

function formatBytes(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

interface SourceStatusRefreshDelta {
  recentRecordCountDelta: number;
  recentPackageCountDelta: number;
  onlineAgentsDelta: number;
  healthySourcesDelta: number;
  changedSourceIds: string[];
  refreshedAt?: string;
}

function formatSignedNumber(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return '0';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toLocaleString('zh-CN')}`;
}

function getDeltaTextColor(value: number) {
  if (value > 0) return COLORS.success;
  if (value < 0) return COLORS.danger;
  return '#94a3b8';
}

function buildSourceSnapshotToken(item: PullSourceRuntimeStatusItem) {
  return [
    item.runtime_status,
    item.updated_at,
    item.error_message,
    item.last_task?.status,
    item.last_task?.finished_at,
    item.last_task?.scheduled_at,
    item.last_cursor?.last_cursor,
    item.last_cursor?.last_offset,
    item.last_cursor?.updated_at,
    item.last_package?.package_id,
    item.last_package?.status,
    item.last_package?.record_count,
    item.last_package?.created_at,
    item.last_package?.acked_at,
  ].map((value) => String(value ?? '')).join('|');
}

function buildRefreshDelta(previous: PullSourceStatusResponse | null, next: PullSourceStatusResponse): SourceStatusRefreshDelta | null {
  if (!previous) return null;

  const previousSnapshots = new Map(previous.items.map((item) => [item.source_id, buildSourceSnapshotToken(item)]));
  const changedSourceIds = next.items
    .filter((item) => previousSnapshots.get(item.source_id) !== buildSourceSnapshotToken(item))
    .map((item) => item.source_id);

  const delta: SourceStatusRefreshDelta = {
    recentRecordCountDelta: (next.summary?.recent_record_count ?? 0) - (previous.summary?.recent_record_count ?? 0),
    recentPackageCountDelta: (next.summary?.recent_package_count ?? 0) - (previous.summary?.recent_package_count ?? 0),
    onlineAgentsDelta: (next.summary?.online_agents ?? 0) - (previous.summary?.online_agents ?? 0),
    healthySourcesDelta: (next.summary?.healthy_sources ?? 0) - (previous.summary?.healthy_sources ?? 0),
    changedSourceIds,
    refreshedAt: next.last_refresh_at,
  };

  const hasChanged = [
    delta.recentRecordCountDelta,
    delta.recentPackageCountDelta,
    delta.onlineAgentsDelta,
    delta.healthySourcesDelta,
  ].some((value) => value !== 0) || changedSourceIds.length > 0;

  return hasChanged ? delta : null;
}

function getRuntimeStatusMeta(status: string) {
  const normalized = String(status ?? '').toLowerCase();
  switch (normalized) {
    case 'healthy':
      return { label: '健康', color: 'success', dot: COLORS.success };
    case 'running':
      return { label: '运行中', color: 'processing', dot: COLORS.primary };
    case 'paused':
      return { label: '暂停', color: 'warning', dot: COLORS.warning };
    case 'disabled':
      return { label: '禁用', color: 'default', dot: '#94a3b8' };
    case 'error':
      return { label: '错误', color: 'error', dot: COLORS.danger };
    default:
      return { label: '离线', color: 'error', dot: COLORS.danger };
  }
}

function renderPathPreview(value?: string) {
  const paths = String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  if (!paths.length) {
    return <span style={{ color: '#94a3b8', fontSize: 12 }}>-</span>;
  }

  const tooltipContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {paths.map((path) => (
        <span key={path} style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}>{path}</span>
      ))}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <Tooltip title={tooltipContent}>
        <Typography.Text code ellipsis style={{ margin: 0, fontSize: 12, maxWidth: '100%', display: 'inline-block' }}>
          {paths[0]}
        </Typography.Text>
      </Tooltip>
      {paths.length > 1 ? (
        <span style={{ fontSize: 12, color: '#94a3b8' }}>共 {paths.length} 个路径</span>
      ) : null}
    </div>
  );
}

const SourceStatus: React.FC = () => {
  const navigate = useNavigate();
  const { message: messageApi } = App.useApp();
  const [range, setRange] = useState<'1h' | '6h' | '24h' | '7d'>('1h');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [response, setResponse] = useState<PullSourceStatusResponse | null>(null);
  const [refreshDelta, setRefreshDelta] = useState<SourceStatusRefreshDelta | null>(null);
  const [highlightedSourceIds, setHighlightedSourceIds] = useState<string[]>([]);
  const previousResponseRef = useRef<PullSourceStatusResponse | null>(null);
  const [selectedItem, setSelectedItem] = useState<PullSourceRuntimeStatusItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [runningSourceIds, setRunningSourceIds] = useState<string[]>([]);
  const [taskHistoryItem, setTaskHistoryItem] = useState<PullSourceRuntimeStatusItem | null>(null);
  const [packageHistoryItem, setPackageHistoryItem] = useState<PullSourceRuntimeStatusItem | null>(null);

  const capabilities = useAuthStore((s) => s.capabilities);
  const canRunPullTask = useMemo(() => hasAnyCapability(capabilities, ['ingest.task.run']), [capabilities]);
  const canReadPullTask = useMemo(() => hasAnyCapability(capabilities, ['ingest.task.read']), [capabilities]);
  const canReadPullPackage = useMemo(() => hasAnyCapability(capabilities, ['ingest.package.read']), [capabilities]);

  const storedPageSize = usePreferencesStore((s) => s.pageSizes.sourceStatus ?? 10);
  const setStoredPageSize = usePreferencesStore((s) => s.setPageSize);
  const [pageSize, setPageSizeLocal] = useState(storedPageSize);

  const setPageSize = useCallback((size: number) => {
    setPageSizeLocal(size);
    setStoredPageSize('sourceStatus', size);
  }, [setStoredPageSize]);

  const loadStatus = useCallback(async (mode: 'initial' | 'refresh' = 'refresh') => {
    const useBackgroundRefresh = mode === 'refresh' && previousResponseRef.current !== null;
    if (useBackgroundRefresh) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const data = await fetchPullSourceStatus(range);
      const refreshDeltaResult = buildRefreshDelta(previousResponseRef.current, data);
      previousResponseRef.current = data;
      setResponse(data);
      setRefreshDelta(refreshDeltaResult);
      setHighlightedSourceIds(refreshDeltaResult?.changedSourceIds ?? []);
    } catch (err) {
      messageApi.error(`数据源状态加载失败：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [messageApi, range]);

  useEffect(() => {
    previousResponseRef.current = null;
    setRefreshDelta(null);
    setHighlightedSourceIds([]);
    setIsRefreshing(false);
  }, [range]);

  useEffect(() => {
    void loadStatus('initial');
  }, [loadStatus]);

  useEffect(() => {
    if (!isAutoRefresh) return undefined;
    const timer = window.setInterval(() => {
      void loadStatus('refresh');
    }, SOURCE_STATUS_AUTO_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [isAutoRefresh, loadStatus]);

  useEffect(() => {
    if (!refreshDelta) return undefined;
    const timer = window.setTimeout(() => {
      setRefreshDelta(null);
      setHighlightedSourceIds([]);
    }, SOURCE_STATUS_CHANGE_HIGHLIGHT_MS);
    return () => window.clearTimeout(timer);
  }, [refreshDelta]);

  const highlightedSourceIdSet = useMemo(() => new Set(highlightedSourceIds), [highlightedSourceIds]);
  const isBackgroundUpdating = isRefreshing || (loading && Boolean(response));

  const filteredItems = useMemo(() => {
    const items = response?.items ?? [];
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (statusFilter !== 'all' && String(item.runtime_status).toLowerCase() !== statusFilter) {
        return false;
      }
      if (!normalizedQuery) return true;
      const haystacks = [
        item.name,
        item.source_id,
        item.path,
        item.host,
        item.agent_hostname,
        item.agent_id,
        item.agent_base_url,
        item.error_message,
      ].filter(Boolean).join(' ').toLowerCase();
      return haystacks.includes(normalizedQuery);
    });
  }, [response?.items, searchQuery, statusFilter]);

  const trendOption = useMemo(() => ({
    tooltip: { trigger: 'axis' },
    grid: { top: 24, left: 48, right: 24, bottom: 36 },
    xAxis: {
      type: 'category',
      data: (response?.trend ?? []).map((point) => formatDateTime(point.bucket_start)),
      axisLabel: { color: '#94a3b8', rotate: 20 },
    },
    yAxis: [
      { type: 'value', name: '日志条数', axisLabel: { color: '#94a3b8' } },
      { type: 'value', name: '包数量', axisLabel: { color: '#94a3b8' } },
    ],
    series: [
      {
        name: '日志条数',
        type: 'line',
        smooth: true,
        data: (response?.trend ?? []).map((point) => point.record_count),
        itemStyle: { color: COLORS.primary },
        areaStyle: { color: `${COLORS.primary}22` },
      },
      {
        name: '包数量',
        type: 'bar',
        yAxisIndex: 1,
        data: (response?.trend ?? []).map((point) => point.package_count),
        itemStyle: { color: COLORS.success },
      },
    ],
  }), [response?.trend]);

  const statusChartOption = useMemo(() => {
    const buckets = new Map<string, number>();
    filteredItems.forEach((item) => {
      const key = String(item.runtime_status ?? 'offline').toLowerCase();
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    });
    const data = Array.from(buckets.entries()).map(([status, count]) => ({
      name: getRuntimeStatusMeta(status).label,
      value: count,
      itemStyle: { color: getRuntimeStatusMeta(status).dot },
    }));
    return {
      tooltip: { trigger: 'item' },
      legend: { bottom: 0, textStyle: { color: '#94a3b8' } },
      series: [
        {
          type: 'pie',
          radius: ['45%', '72%'],
          avoidLabelOverlap: false,
          label: { color: '#cbd5e1' },
          data,
        },
      ],
    };
  }, [filteredItems]);

  const handleRunNow = useCallback(async (item: PullSourceRuntimeStatusItem) => {
    setRunningSourceIds((current) => (current.includes(item.source_id) ? current : [...current, item.source_id]));
    try {
      const result = await runPullTask(item.source_id);
      messageApi.success(`已提交采集任务：${item.name} · ${result.task_id}`);
      window.setTimeout(() => {
        void loadStatus('refresh');
      }, 1200);
    } catch (err) {
      messageApi.error(`执行采集失败：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRunningSourceIds((current) => current.filter((sourceId) => sourceId !== item.source_id));
    }
  }, [loadStatus, messageApi]);

  const columns: ColumnsType<PullSourceRuntimeStatusItem> = [
    {
      title: '数据源',
      key: 'source',
      width: 220,
      render: (_, item) => (
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Tooltip title={item.name}>
              <Typography.Text strong ellipsis style={{ maxWidth: 160, display: 'block' }}>{item.name}</Typography.Text>
            </Tooltip>
            {highlightedSourceIdSet.has(item.source_id) ? <Tag color="processing" style={{ marginInlineEnd: 0 }}>刚更新</Tag> : null}
          </div>
          <Tooltip title={item.source_id}>
            <Typography.Text type="secondary" ellipsis style={{ maxWidth: '100%', display: 'block', fontSize: 12 }}>
              {`${item.protocol.toUpperCase()} · ${formatShortId(item.source_id)}`}
            </Typography.Text>
          </Tooltip>
        </div>
      ),
    },
    {
      title: 'Agent',
      key: 'agent',
      width: 190,
      render: (_, item) => {
        const primary = item.agent_hostname || item.host || '-';
        const secondary = item.agent_id || item.agent_base_url || '-';
        return (
          <div style={{ minWidth: 0 }}>
            <Tooltip title={primary}>
              <Typography.Text ellipsis style={{ maxWidth: '100%', display: 'block' }}>{primary}</Typography.Text>
            </Tooltip>
            <Tooltip title={secondary}>
              <Typography.Text type="secondary" ellipsis style={{ maxWidth: '100%', display: 'block', fontSize: 12 }}>
                {item.agent_id ? formatShortId(item.agent_id, 6, 4) : secondary}
              </Typography.Text>
            </Tooltip>
          </div>
        );
      },
    },
    {
      title: '路径',
      dataIndex: 'path',
      key: 'path',
      width: 220,
      render: (value: string) => renderPathPreview(value),
    },
    {
      title: '采集情况',
      key: 'activity',
      width: 260,
      render: (_, item) => {
        const packageTime = item.last_package?.created_at || item.last_package?.acked_at;
        const cursorTime = item.last_cursor?.updated_at;
        const summary = [
          `${formatNumber(item.last_package?.record_count)} 条`,
          formatBytes(item.last_package?.size_bytes),
          `EPS ${item.estimated_eps && item.estimated_eps > 0 ? item.estimated_eps.toFixed(2) : '-'}`,
        ].join(' · ');
        const detailLines = [
          `最近包：${formatDateTime(packageTime)}`,
          `包状态：${item.last_package?.status || '-'}`,
          `offset：${formatNumber(item.last_cursor?.last_offset)}`,
          `cursor：${item.last_cursor?.last_cursor || '-'}`,
          `游标时间：${formatDateTime(cursorTime)}`,
          `最近文件：${item.last_package?.primary_file || '-'}`,
        ];

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
            <Tooltip
              title={(
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {detailLines.map((line) => <div key={line}>{line}</div>)}
                </div>
              )}
            >
              <Typography.Text ellipsis style={{ maxWidth: '100%', display: 'block', fontSize: 12 }}>
                {summary}
              </Typography.Text>
            </Tooltip>
            <Typography.Text type="secondary" ellipsis style={{ maxWidth: '100%', display: 'block', fontSize: 12 }}>
              {`最近 ${formatShortDateTime(packageTime || cursorTime || item.updated_at)}`}
            </Typography.Text>
          </div>
        );
      },
    },
    {
      title: '状态',
      key: 'runtime_status',
      width: 170,
      render: (_, item) => {
        const meta = getRuntimeStatusMeta(item.runtime_status);
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
            <Tag color={meta.color} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, width: 'fit-content', marginInlineEnd: 0 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta.dot, display: 'inline-block' }} />
              {meta.label}
            </Tag>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              配置 {item.configured_status || '-'}
            </Typography.Text>
            {item.error_message ? (
              <Tooltip title={item.error_message}>
                <Tag color="error" style={{ width: 'fit-content', marginInlineEnd: 0 }}>错误</Tag>
              </Tooltip>
            ) : null}
          </div>
        );
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      align: 'right',
      render: (_, item) => {
        const menuItems: { key: string; label: string; disabled?: boolean }[] = [];
        if (canReadPullTask) menuItems.push({ key: 'task', label: '任务历史' });
        if (canReadPullPackage) menuItems.push({ key: 'package', label: '包历史' });
        if (canRunPullTask) {
          menuItems.push({
            key: 'run',
            label: runningSourceIds.includes(item.source_id) ? '采集中...' : '立即采集',
            disabled: runningSourceIds.includes(item.source_id) || String(item.configured_status).toLowerCase() === 'disabled',
          });
        }

        return (
          <Space size={4}>
            <Button size="small" type="link" onClick={() => { setSelectedItem(item); setDetailOpen(true); }}>详情</Button>
            {menuItems.length > 0 ? (
              <Dropdown
                trigger={['click']}
                menu={{
                  items: menuItems,
                  onClick: ({ key }) => {
                    if (key === 'task') {
                      setTaskHistoryItem(item);
                      return;
                    }
                    if (key === 'package') {
                      setPackageHistoryItem(item);
                      return;
                    }
                    if (key === 'run') {
                      void handleRunNow(item);
                    }
                  },
                }}
              >
                <Button size="small" type="link">更多</Button>
              </Dropdown>
            ) : null}
          </Space>
        );
      },
    },
  ];

  const summary = response?.summary;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <Typography.Title level={2} style={{ margin: 0 }}>数据源状态</Typography.Title>
          <Typography.Paragraph style={{ margin: '4px 0 0', color: '#94a3b8' }}>
            基于真实 pull-tasks / packages / cursors / agent 探活结果展示采集链路状态。
          </Typography.Paragraph>
        </div>
        <Space>
          <Select id="source-status-range" value={range} options={RANGE_OPTIONS.map((item) => ({ label: item.label, value: item.value }))} onChange={setRange} style={{ width: 140 }} />
          <Button type={isAutoRefresh ? 'primary' : 'default'} onClick={() => setIsAutoRefresh((value) => !value)}>
            {isAutoRefresh ? '自动刷新中' : '已暂停'}
          </Button>
          <Button loading={isBackgroundUpdating} onClick={() => void loadStatus('refresh')} icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>refresh</span>}>
            {isBackgroundUpdating ? '刷新中' : '刷新'}
          </Button>
          <Button type="primary" onClick={() => navigate('/ingestion/wizard')}>接入新数据源</Button>
        </Space>
      </div>

      {isBackgroundUpdating ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: COLORS.primary, fontSize: 13 }}>
          <Spin size="small" />
          <span>后台动态刷新中，当前数据保持可见</span>
        </div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(180px, 1fr))', gap: 16 }}>
        <Card>
          <Statistic title="数据源总数" value={summary?.total_sources ?? 0} />
          <div style={{ marginTop: 8, fontSize: 12, color: '#94a3b8' }}>刷新时间：{formatDateTime(response?.last_refresh_at)}</div>
        </Card>
        <Card>
          <Statistic title="在线 Agent" value={summary?.online_agents ?? 0} valueStyle={{ color: COLORS.success }} />
          {refreshDelta ? <div style={{ marginTop: 8, fontSize: 12, color: getDeltaTextColor(refreshDelta.onlineAgentsDelta) }}>较上次 {formatSignedNumber(refreshDelta.onlineAgentsDelta)}</div> : null}
        </Card>
        <Card>
          <Statistic title="健康数据源" value={summary?.healthy_sources ?? 0} valueStyle={{ color: COLORS.primary }} />
          {refreshDelta ? <div style={{ marginTop: 8, fontSize: 12, color: getDeltaTextColor(refreshDelta.healthySourcesDelta) }}>较上次 {formatSignedNumber(refreshDelta.healthySourcesDelta)}</div> : null}
        </Card>
        <Card>
          <Statistic title="最近日志条数" value={summary?.recent_record_count ?? 0} />
          {refreshDelta ? <div style={{ marginTop: 8, fontSize: 12, color: getDeltaTextColor(refreshDelta.recentRecordCountDelta) }}>较上次 {formatSignedNumber(refreshDelta.recentRecordCountDelta)}</div> : null}
        </Card>
      </div>

      {refreshDelta ? (
        <Alert
          type="success"
          showIcon
          message="检测到新的采集变化"
          description={(
            <Space size={[16, 8]} wrap>
              <span>日志 {formatSignedNumber(refreshDelta.recentRecordCountDelta)}</span>
              <span>包 {formatSignedNumber(refreshDelta.recentPackageCountDelta)}</span>
              <span>在线 Agent {formatSignedNumber(refreshDelta.onlineAgentsDelta)}</span>
              <span>健康源 {formatSignedNumber(refreshDelta.healthySourcesDelta)}</span>
              {refreshDelta.changedSourceIds.length ? <span>{refreshDelta.changedSourceIds.length} 个数据源刚刚更新</span> : null}
              <span>刷新时间：{formatDateTime(refreshDelta.refreshedAt)}</span>
            </Space>
          )}
        />
      ) : null}

      {!loading && response && !response.items.length ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无采集状态数据" />
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(320px, 1fr)', gap: 16 }}>
        <ChartWrapper
          title="最近采集趋势"
          subtitle={`范围：${RANGE_OPTIONS.find((item) => item.value === range)?.label ?? range}`}
          height={280}
          loading={loading && !response}
          empty={!response?.trend?.length}
          option={trendOption}
        />
        <ChartWrapper
          title="状态分布"
          subtitle="当前筛选结果"
          height={280}
          loading={loading && !response}
          empty={!filteredItems.length}
          option={statusChartOption}
        />
      </div>

      <Card>
        <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <Input
            name="sourceStatusSearchQuery"
            allowClear
            style={{ width: 320 }}
            placeholder="搜索数据源、主机、路径、错误信息"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            prefix={<span className="material-symbols-outlined" style={{ fontSize: 18, color: '#94a3b8' }}>search</span>}
          />
          <Select id="source-runtime-status-filter" value={statusFilter} options={STATUS_OPTIONS} style={{ width: 160 }} onChange={setStatusFilter} />
        </Space>

        {loading && !response ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spin size="large" /></div>
        ) : filteredItems.length === 0 ? (
          <Empty description="当前筛选条件下没有匹配的数据源" />
        ) : (
          <Table<PullSourceRuntimeStatusItem>
            size="small"
            rowKey={(record) => record.source_id}
            columns={columns}
            dataSource={filteredItems}
            onRow={(record) => (
              highlightedSourceIdSet.has(record.source_id)
                ? { style: { background: 'rgba(22, 119, 255, 0.08)', transition: 'background-color 0.3s ease' } }
                : {}
            )}
            pagination={{
              pageSize,
              showSizeChanger: true,
              pageSizeOptions: [10, 20, 50, 100],
              onShowSizeChange: (_, size) => setPageSize(size),
            }}
            scroll={{ x: 1180 }}
          />
        )}
      </Card>

      <Modal
        title="数据源详情"
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={(
          <Space>
            {canReadPullTask && selectedItem ? (
              <Button onClick={() => setTaskHistoryItem(selectedItem)}>查看任务历史</Button>
            ) : null}
            {canReadPullPackage && selectedItem ? (
              <Button onClick={() => setPackageHistoryItem(selectedItem)}>查看包历史</Button>
            ) : null}
            <Button onClick={() => setDetailOpen(false)}>关闭</Button>
          </Space>
        )}
        width={920}
      >
        {!selectedItem ? null : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {selectedItem.error_message ? <Alert type="warning" showIcon message="最近错误" description={selectedItem.error_message} /> : null}
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="名称">{selectedItem.name}</Descriptions.Item>
              <Descriptions.Item label="状态">{getRuntimeStatusMeta(selectedItem.runtime_status).label}</Descriptions.Item>
              <Descriptions.Item label="协议">{selectedItem.protocol.toUpperCase()}</Descriptions.Item>
              <Descriptions.Item label="配置状态">{selectedItem.configured_status}</Descriptions.Item>
              <Descriptions.Item label="主机">{selectedItem.host}:{selectedItem.port}</Descriptions.Item>
              <Descriptions.Item label="Agent">{selectedItem.agent_hostname || selectedItem.agent_id || '-'}</Descriptions.Item>
              <Descriptions.Item label="路径" span={2}><Typography.Text code>{selectedItem.path}</Typography.Text></Descriptions.Item>
              <Descriptions.Item label="拉取间隔">{selectedItem.pull_interval_sec}s</Descriptions.Item>
              <Descriptions.Item label="拉取超时">{selectedItem.pull_timeout_sec}s</Descriptions.Item>
              <Descriptions.Item label="估算 EPS">{selectedItem.estimated_eps ? selectedItem.estimated_eps.toFixed(2) : '-'}</Descriptions.Item>
              <Descriptions.Item label="最近更新">{formatDateTime(selectedItem.updated_at)}</Descriptions.Item>
            </Descriptions>

            <Card size="small" title="最近任务 / 游标 / 包">
              <Descriptions bordered size="small" column={2}>
                <Descriptions.Item label="任务状态">{selectedItem.last_task?.status || '-'}</Descriptions.Item>
                <Descriptions.Item label="任务时间">{formatDateTime(selectedItem.last_task?.finished_at || selectedItem.last_task?.scheduled_at)}</Descriptions.Item>
                <Descriptions.Item label="游标 offset">{formatNumber(selectedItem.last_cursor?.last_offset)}</Descriptions.Item>
                <Descriptions.Item label="游标时间">{formatDateTime(selectedItem.last_cursor?.updated_at)}</Descriptions.Item>
                <Descriptions.Item label="最近包状态">{selectedItem.last_package?.status || '-'}</Descriptions.Item>
                <Descriptions.Item label="最近包时间">{formatDateTime(selectedItem.last_package?.created_at || selectedItem.last_package?.acked_at)}</Descriptions.Item>
                <Descriptions.Item label="最近包记录数">{formatNumber(selectedItem.last_package?.record_count)}</Descriptions.Item>
                <Descriptions.Item label="最近包大小">{formatBytes(selectedItem.last_package?.size_bytes)}</Descriptions.Item>
                <Descriptions.Item label="最近文件" span={2}>{selectedItem.last_package?.primary_file || '-'}</Descriptions.Item>
              </Descriptions>
            </Card>
          </div>
        )}
      </Modal>

      <PullTaskHistoryDrawer
        open={Boolean(taskHistoryItem)}
        sourceId={taskHistoryItem?.source_id}
        sourceName={taskHistoryItem?.name}
        onClose={() => setTaskHistoryItem(null)}
      />
      <PullPackageHistoryDrawer
        open={Boolean(packageHistoryItem)}
        sourceName={packageHistoryItem?.name}
        agentId={packageHistoryItem?.last_package?.agent_id || packageHistoryItem?.last_cursor?.agent_id || packageHistoryItem?.agent_id}
        sourceRef={packageHistoryItem?.last_package?.source_ref || packageHistoryItem?.path}
        onClose={() => setPackageHistoryItem(null)}
      />
    </div>
  );
};

export default SourceStatus;
