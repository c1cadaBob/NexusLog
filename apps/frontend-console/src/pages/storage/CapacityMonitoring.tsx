import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Empty, Progress, Select, Space, Tag, Tooltip, message } from 'antd';
import type { EChartsCoreOption } from 'echarts/core';
import { useNavigate } from 'react-router-dom';
import {
  fetchMetricsOverview,
  type MetricsOverviewData,
  type MetricsOverviewTrendPoint,
} from '../../api/metrics';
import { fetchStorageIndices, formatStorageBytes, formatStorageCount } from '../../api/storage';
import ChartWrapper from '../../components/charts/ChartWrapper';
import InlineErrorState from '../../components/common/InlineErrorState';
import InlineLoadingState from '../../components/common/InlineLoadingState';
import { useThemeStore } from '../../stores/themeStore';
import { COLORS, DARK_PALETTE, LIGHT_PALETTE } from '../../theme/tokens';
import { INDEX_HEALTH_CONFIG, type IndexInfo, type IndexSummary } from '../../types/storage';

type CapacityRange = '24h' | '7d';

interface Palette {
  bgLayout: string;
  bgContainer: string;
  bgElevated: string;
  bgHover: string;
  border: string;
  borderSecondary: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
}

const RANGE_OPTIONS: Array<{ label: string; value: CapacityRange }> = [
  { label: '近 24 小时', value: '24h' },
  { label: '近 7 天', value: '7d' },
];

const EMPTY_SUMMARY: IndexSummary = {
  total: 0,
  green: 0,
  yellow: 0,
  red: 0,
  docsCount: 0,
  storeSizeBytes: 0,
  refreshedAt: undefined,
};

interface SummaryMetricCardProps {
  palette: Palette;
  title: string;
  value: string;
  description: string;
  extra?: string;
  icon: string;
  iconColor: string;
}

interface ThroughputMetricTileProps {
  palette: Palette;
  title: string;
  value: string;
  description: string;
  icon: string;
  iconColor: string;
}

function SummaryMetricCard({
  palette,
  title,
  value,
  description,
  extra,
  icon,
  iconColor,
}: SummaryMetricCardProps): React.ReactElement {
  return (
    <Card size="small" styles={{ body: { padding: '20px 24px' } }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, color: palette.textSecondary }}>{title}</div>
          <div style={{ marginTop: 8, fontSize: 28, lineHeight: 1.1, fontWeight: 700 }}>{value}</div>
          <div style={{ marginTop: 8, fontSize: 12, color: palette.textSecondary }}>{description}</div>
          {extra ? (
            <div style={{ marginTop: 4, fontSize: 12, color: palette.textTertiary }}>{extra}</div>
          ) : null}
        </div>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: `${iconColor}1a`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 22, color: iconColor }}>
            {icon}
          </span>
        </div>
      </div>
    </Card>
  );
}

function ThroughputMetricTile({
  palette,
  title,
  value,
  description,
  icon,
  iconColor,
}: ThroughputMetricTileProps): React.ReactElement {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 12,
        border: `1px solid ${palette.border}`,
        background: palette.bgHover,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ fontSize: 12, color: palette.textSecondary }}>{title}</span>
        <span className="material-symbols-outlined" style={{ fontSize: 18, color: iconColor }}>
          {icon}
        </span>
      </div>
      <div style={{ fontSize: 20, lineHeight: 1.2, fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: 12, color: palette.textSecondary }}>{description}</div>
    </div>
  );
}

function normalizeErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  return fallback;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, value));
}

function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—';
  }
  return `${clampPercent(value).toFixed(digits)}%`;
}

function formatSignedPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—';
  }
  const rounded = Number(value.toFixed(digits));
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded}%`;
}

function formatDateTime(value: string | number | undefined): string {
  if (value === undefined || value === null || value === '') {
    return '暂无数据';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return parsed.toLocaleString('zh-CN', { hour12: false });
}

function formatTrendAxisLabel(value: string, range: CapacityRange): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  if (range === '7d') {
    return parsed.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
  }

  return parsed.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function resolveUsageColor(value: number): string {
  if (value >= 90) return COLORS.danger;
  if (value >= 75) return COLORS.warning;
  return COLORS.success;
}

function buildDiskUsageTrendOption(
  trend: MetricsOverviewTrendPoint[],
  range: CapacityRange,
  palette: Palette,
): EChartsCoreOption {
  const sorted = trend
    .slice()
    .sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp));

  return {
    tooltip: {
      trigger: 'axis',
      backgroundColor: palette.bgContainer,
      borderColor: palette.border,
      textStyle: { color: palette.text },
      formatter: (params: Array<{ dataIndex?: number; marker?: string; value?: number }>) => {
        const current = typeof params[0]?.dataIndex === 'number' ? sorted[params[0].dataIndex] : undefined;
        const usage = typeof params[0]?.value === 'number' ? formatPercent(params[0].value) : '—';
        return [
          formatDateTime(current?.timestamp),
          `${params[0]?.marker ?? ''}平均磁盘使用率：${usage}`,
          `活跃采集节点：${current?.active_agents ?? 0}`,
        ].join('<br/>');
      },
    },
    grid: { top: 30, right: 20, bottom: 30, left: 56 },
    xAxis: {
      type: 'category',
      data: sorted.map((item) => formatTrendAxisLabel(item.timestamp, range)),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: palette.textSecondary, fontSize: 12 },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: palette.border, type: 'dashed', opacity: 0.5 } },
      axisLabel: { color: palette.textSecondary, fontSize: 12, formatter: '{value}%' },
    },
    series: [
      {
        name: '平均磁盘使用率',
        type: 'line',
        data: sorted.map((item) => Number(item.avg_disk_usage_pct ?? 0)),
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 3, color: COLORS.warning },
        itemStyle: { color: COLORS.warning },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: `${COLORS.warning}4d` },
              { offset: 1, color: `${COLORS.warning}00` },
            ],
          },
        },
      },
    ],
  };
}

function resolveTrendDelta(trend: MetricsOverviewTrendPoint[]): number | null {
  if (trend.length < 2) {
    return null;
  }

  const sorted = trend
    .slice()
    .sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp));
  const first = Number(sorted[0]?.avg_disk_usage_pct ?? 0);
  const last = Number(sorted[sorted.length - 1]?.avg_disk_usage_pct ?? 0);
  if (!Number.isFinite(first) || !Number.isFinite(last)) {
    return null;
  }
  return last - first;
}

function resolvePageStatus(
  metricsOverview: MetricsOverviewData | null,
  loadError: string | null,
  hasIndexData: boolean,
): { color: 'success' | 'warning' | 'default' | 'processing'; label: string } {
  if (loadError && (metricsOverview || hasIndexData)) {
    return { color: 'warning', label: '部分可用' };
  }

  if (!metricsOverview?.latest_collected_at) {
    return hasIndexData
      ? { color: 'processing', label: '仅索引数据' }
      : { color: 'default', label: '暂无数据' };
  }

  const latestCollectedAt = Date.parse(metricsOverview.latest_collected_at);
  if (!Number.isNaN(latestCollectedAt) && Date.now() - latestCollectedAt > 30 * 60 * 1000) {
    return { color: 'warning', label: '采集延迟' };
  }

  return { color: 'success', label: '数据已接入' };
}

const CapacityMonitoring: React.FC = () => {
  const navigate = useNavigate();
  const isDark = useThemeStore((state) => state.isDark);
  const palette = isDark ? DARK_PALETTE : LIGHT_PALETTE;

  const [range, setRange] = useState<CapacityRange>('7d');
  const [metricsOverview, setMetricsOverview] = useState<MetricsOverviewData | null>(null);
  const [indexItems, setIndexItems] = useState<IndexInfo[]>([]);
  const [indexSummary, setIndexSummary] = useState<IndexSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadCapacityData = useCallback(async (options?: { silent?: boolean; showSuccess?: boolean }) => {
    setLoading(true);
    try {
      const [metricsResult, indicesResult] = await Promise.allSettled([
        fetchMetricsOverview(range, 8),
        fetchStorageIndices(),
      ]);

      const errors: string[] = [];

      if (metricsResult.status === 'fulfilled') {
        setMetricsOverview(metricsResult.value.data ?? null);
      } else {
        errors.push(`容量指标：${normalizeErrorMessage(metricsResult.reason, '加载失败')}`);
      }

      if (indicesResult.status === 'fulfilled') {
        setIndexItems(indicesResult.value.items);
        setIndexSummary(indicesResult.value.summary);
      } else {
        errors.push(`索引存储：${normalizeErrorMessage(indicesResult.reason, '加载失败')}`);
      }

      const nextError = errors.length > 0 ? errors.join('；') : null;
      setLoadError(nextError);

      if (nextError) {
        if (!options?.silent) {
          message.error(nextError);
        }
        return;
      }

      if (options?.showSuccess) {
        message.success('容量数据已刷新');
      }
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    void loadCapacityData({ silent: true });
  }, [loadCapacityData]);

  const hasIndexData = indexSummary.total > 0 || indexItems.length > 0;
  const hasMetricsData = Boolean(metricsOverview);
  const hasAnyData = hasIndexData || hasMetricsData;
  const rangeLabel = range === '7d' ? '近 7 天' : '近 24 小时';

  const pageStatus = useMemo(
    () => resolvePageStatus(metricsOverview, loadError, hasIndexData),
    [hasIndexData, loadError, metricsOverview],
  );

  const diskTrend = useMemo(() => metricsOverview?.trend ?? [], [metricsOverview]);
  const diskTrendDelta = useMemo(() => resolveTrendDelta(diskTrend), [diskTrend]);

  const trendOption = useMemo(
    () => buildDiskUsageTrendOption(diskTrend, range, palette),
    [diskTrend, palette, range],
  );

  const nodeSnapshots = useMemo(() => {
    return (metricsOverview?.snapshots ?? [])
      .slice()
      .sort((left, right) => Number(right.disk_usage_pct ?? 0) - Number(left.disk_usage_pct ?? 0))
      .slice(0, 5);
  }, [metricsOverview]);

  const topIndices = useMemo(() => {
    return indexItems
      .filter((item) => item.storeSizeBytes > 0)
      .slice()
      .sort((left, right) => right.storeSizeBytes - left.storeSizeBytes)
      .slice(0, 5);
  }, [indexItems]);

  const topIndicesShare = useMemo(() => {
    if (indexSummary.storeSizeBytes <= 0) {
      return null;
    }
    const topBytes = topIndices.reduce((sum, item) => sum + item.storeSizeBytes, 0);
    return (topBytes / indexSummary.storeSizeBytes) * 100;
  }, [indexSummary.storeSizeBytes, topIndices]);

  const healthyIndexRatio = useMemo(() => {
    if (indexSummary.total <= 0) {
      return null;
    }
    return (indexSummary.green / indexSummary.total) * 100;
  }, [indexSummary.green, indexSummary.total]);

  const throughputItems = useMemo(() => {
    return [
      {
        key: 'disk-read',
        title: '累计磁盘读取',
        value: formatStorageBytes(metricsOverview?.total_disk_io_read_bytes ?? 0),
        description: '来自最近一次节点指标汇总',
        icon: 'database',
        iconColor: COLORS.info,
      },
      {
        key: 'disk-write',
        title: '累计磁盘写入',
        value: formatStorageBytes(metricsOverview?.total_disk_io_write_bytes ?? 0),
        description: '来自最近一次节点指标汇总',
        icon: 'save',
        iconColor: COLORS.primary,
      },
      {
        key: 'net-in-delta',
        title: '最近采样入站增量',
        value: formatStorageBytes(metricsOverview?.latest_net_in_delta_bytes ?? 0),
        description: '非速率值，为最近两次采样差值',
        icon: 'south_west',
        iconColor: COLORS.success,
      },
      {
        key: 'net-out-delta',
        title: '最近采样出站增量',
        value: formatStorageBytes(metricsOverview?.latest_net_out_delta_bytes ?? 0),
        description: '非速率值，为最近两次采样差值',
        icon: 'north_east',
        iconColor: COLORS.purple,
      },
    ];
  }, [metricsOverview]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>容量监控</h2>
            <Tag color={pageStatus.color}>{pageStatus.label}</Tag>
          </div>
          <div style={{ marginTop: 8, color: palette.textSecondary, fontSize: 14 }}>
            仅展示当前系统已真实接入的索引存储与采集节点容量指标，不再展示预测或模拟数据。
          </div>
          <div style={{ marginTop: 8, color: palette.textSecondary, fontSize: 12 }}>
            最近采样：{formatDateTime(metricsOverview?.latest_collected_at)}
            {' · '}
            索引刷新：{formatDateTime(indexSummary.refreshedAt)}
          </div>
        </div>
        <Space wrap>
          <Button
            icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>help</span>}
            onClick={() => { window.location.hash = '#/help/faq'; }}
          >
            帮助
          </Button>
          <Select
            value={range}
            onChange={(value) => setRange(value as CapacityRange)}
            options={RANGE_OPTIONS}
            style={{ minWidth: 120 }}
          />
          <Button
            loading={loading}
            icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>refresh</span>}
            onClick={() => { void loadCapacityData({ showSuccess: true }); }}
          >
            刷新数据
          </Button>
        </Space>
      </div>

      {loadError && hasAnyData ? (
        <Alert
          type="warning"
          showIcon
          message="部分数据加载失败"
          description={`${loadError}。页面继续显示最近一次成功加载的数据。`}
        />
      ) : null}

      {!hasAnyData && loading ? (
        <Card size="small" styles={{ body: { padding: 48 } }}>
          <InlineLoadingState size="large" tip="加载容量数据..." />
        </Card>
      ) : null}

      {!hasAnyData && !loading && loadError ? (
        <Card size="small" styles={{ body: { padding: 48 } }}>
          <InlineErrorState
            title="容量数据加载失败"
            description={loadError}
            onAction={() => { void loadCapacityData(); }}
            actionLoading={loading}
          />
        </Card>
      ) : null}

      {hasAnyData ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 24 }}>
            <SummaryMetricCard
              palette={palette}
              title="索引存储总量"
              value={formatStorageBytes(indexSummary.storeSizeBytes)}
              description={`共 ${formatStorageCount(indexSummary.total)} 个索引`}
              extra={topIndicesShare === null ? undefined : `Top 5 索引占比 ${formatPercent(topIndicesShare)}`}
              icon="hard_drive"
              iconColor={COLORS.primary}
            />
            <SummaryMetricCard
              palette={palette}
              title="文档总量"
              value={formatStorageCount(indexSummary.docsCount)}
              description={`索引最近刷新：${formatDateTime(indexSummary.refreshedAt)}`}
              extra={indexSummary.total > 0 ? `Green ${indexSummary.green} · Yellow ${indexSummary.yellow} · Red ${indexSummary.red}` : undefined}
              icon="description"
              iconColor={COLORS.info}
            />
            <SummaryMetricCard
              palette={palette}
              title="平均磁盘使用率"
              value={formatPercent(metricsOverview?.avg_disk_usage_pct)}
              description={`${rangeLabel}平均值，活跃采集节点 ${metricsOverview?.active_agents ?? 0} 个`}
              extra={diskTrendDelta === null ? undefined : `较周期起点 ${formatSignedPercent(diskTrendDelta)}`}
              icon="monitoring"
              iconColor={resolveUsageColor(Number(metricsOverview?.avg_disk_usage_pct ?? 0))}
            />
            <SummaryMetricCard
              palette={palette}
              title="健康索引占比"
              value={healthyIndexRatio === null ? '—' : formatPercent(healthyIndexRatio)}
              description={`Green ${indexSummary.green} / Total ${indexSummary.total}`}
              extra={indexSummary.yellow + indexSummary.red > 0 ? `待关注索引 ${indexSummary.yellow + indexSummary.red} 个` : '当前无 Yellow / Red 索引'}
              icon="health_and_safety"
              iconColor={indexSummary.yellow + indexSummary.red > 0 ? COLORS.warning : COLORS.success}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(320px, 1fr)', gap: 24 }}>
            <ChartWrapper
              title={`${rangeLabel}磁盘使用率趋势`}
              subtitle={`最近采样：${formatDateTime(metricsOverview?.latest_collected_at)}`}
              height={320}
              loading={loading && diskTrend.length === 0}
              empty={diskTrend.length === 0}
              option={trendOption}
            />

            <Card size="small" title="采集节点磁盘占用" styles={{ body: { padding: '20px 24px' } }}>
              <div style={{ fontSize: 12, color: palette.textSecondary, marginBottom: 16 }}>
                依据最近一次 metrics 汇总，展示节点当前 CPU / 内存 / 磁盘占用情况。
              </div>
              {nodeSnapshots.length === 0 ? (
                <Empty description="暂无采集节点快照" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '24px 0' }} />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {nodeSnapshots.map((snapshot) => {
                    const title = snapshot.server_id?.trim() || snapshot.agent_id?.trim() || '未命名节点';
                    const usage = clampPercent(Number(snapshot.disk_usage_pct ?? 0));
                    return (
                      <div key={`${snapshot.server_id}-${snapshot.agent_id}-${snapshot.collected_at}`}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                          <div style={{ minWidth: 0 }}>
                            <Tooltip title={title}>
                              <div
                                style={{
                                  fontSize: 13,
                                  fontWeight: 600,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {title}
                              </div>
                            </Tooltip>
                            <div style={{ marginTop: 4, fontSize: 12, color: palette.textSecondary }}>
                              Agent：{snapshot.agent_id || '—'}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{formatPercent(usage)}</div>
                            <div style={{ marginTop: 4, fontSize: 12, color: palette.textSecondary }}>
                              {formatDateTime(snapshot.collected_at)}
                            </div>
                          </div>
                        </div>
                        <Progress
                          percent={usage}
                          showInfo={false}
                          strokeColor={resolveUsageColor(usage)}
                          style={{ marginTop: 10, marginBottom: 6 }}
                        />
                        <div style={{ fontSize: 12, color: palette.textSecondary }}>
                          CPU {formatPercent(snapshot.cpu_usage_pct)} · 内存 {formatPercent(snapshot.memory_usage_pct)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)', gap: 24 }}>
            <Card
              size="small"
              title="Top 5 索引占用排名"
              extra={
                <Button type="link" onClick={() => navigate('/storage/indices')} style={{ paddingInline: 0 }}>
                  查看全部
                </Button>
              }
              styles={{ body: { padding: '20px 24px' } }}
            >
              {topIndices.length === 0 ? (
                <Empty description="暂无索引存储数据" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '24px 0' }} />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {topIndices.map((item) => {
                    const percent = indexSummary.storeSizeBytes > 0
                      ? clampPercent((item.storeSizeBytes / indexSummary.storeSizeBytes) * 100)
                      : 0;
                    const healthConfig = INDEX_HEALTH_CONFIG[item.health];

                    return (
                      <div key={item.name}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr) auto', gap: 16, alignItems: 'center' }}>
                          <div style={{ minWidth: 0 }}>
                            <Tooltip title={item.name}>
                              <div
                                style={{
                                  fontSize: 13,
                                  fontWeight: 600,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {item.name}
                              </div>
                            </Tooltip>
                            <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12, color: palette.textSecondary }}>
                              <span style={{ color: healthConfig.color }}>{healthConfig.label}</span>
                              <span>{item.status === 'Open' ? '开启' : '关闭'}</span>
                              <span>{item.shards} 分片</span>
                              <span>{item.docs} 文档</span>
                            </div>
                          </div>
                          <Progress percent={percent} showInfo={false} strokeColor={COLORS.primary} />
                          <div style={{ fontSize: 13, fontWeight: 600, textAlign: 'right', minWidth: 84 }}>
                            {formatStorageBytes(item.storeSizeBytes)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            <Card size="small" title="资源吞吐概览" styles={{ body: { padding: '20px 24px' } }}>
              {metricsOverview ? (
                <>
                  <div style={{ fontSize: 12, color: palette.textSecondary, marginBottom: 16 }}>
                    以下值均来自最近一次节点汇总，其中“最近采样增量”表示最近两次采样之间的差值。
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                    {throughputItems.map((item) => (
                      <ThroughputMetricTile
                        key={item.key}
                        palette={palette}
                        title={item.title}
                        value={item.value}
                        description={item.description}
                        icon={item.icon}
                        iconColor={item.iconColor}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <Empty description="暂无吞吐指标" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '24px 0' }} />
              )}
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
};

export default CapacityMonitoring;
