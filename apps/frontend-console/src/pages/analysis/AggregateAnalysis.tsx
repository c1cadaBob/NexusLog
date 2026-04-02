import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Alert, App, Button, Card, Empty, Input, Pagination, Select, Tag, Typography } from 'antd';
import { useThemeStore } from '../../stores/themeStore';
import { COLORS } from '../../theme/tokens';
import ChartWrapper from '../../components/charts/ChartWrapper';
import type { EChartsCoreOption } from 'echarts/core';
import {
  fetchAggregateStats,
  type AggregateBucket,
  type FetchAggregateStatsParams,
} from '../../api/query';
import InlineLoadingState from '../../components/common/InlineLoadingState';

const { Text } = Typography;

type AggregateGroupBy = FetchAggregateStatsParams['groupBy'];
type AggregateTimeRange = FetchAggregateStatsParams['timeRange'];

interface AggregateFormState {
  groupBy: AggregateGroupBy;
  timeRange: AggregateTimeRange;
  keywords: string;
  service: string;
}

interface AggregateSummary {
  totalCount: number;
  bucketCount: number;
  nonZeroBucketCount: number;
  topBucket: AggregateBucket | null;
  averagePerBucket: number;
}

const NUMBER_FORMATTER = new Intl.NumberFormat('zh-CN');
const DECIMAL_FORMATTER = new Intl.NumberFormat('zh-CN', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

const GROUP_BY_OPTIONS: Array<{ value: AggregateGroupBy; label: string }> = [
  { value: 'level', label: '按日志级别 (Level)' },
  { value: 'source', label: '按主机 / 服务 (Source)' },
  { value: 'hour', label: '按小时趋势 (Hour)' },
  { value: 'minute', label: '按分钟趋势 (Minute)' },
];

const TIME_RANGE_OPTIONS: Array<{ value: AggregateTimeRange; label: string }> = [
  { value: '30m', label: '最近 30 分钟' },
  { value: '1h', label: '最近 1 小时' },
  { value: '6h', label: '最近 6 小时' },
  { value: '24h', label: '最近 24 小时' },
  { value: '7d', label: '最近 7 天' },
];

const TIME_RANGE_LABEL_MAP = Object.fromEntries(
  TIME_RANGE_OPTIONS.map((option) => [option.value, option.label]),
) as Record<AggregateTimeRange, string>;

const GROUP_BY_LABEL_MAP = Object.fromEntries(
  GROUP_BY_OPTIONS.map((option) => [option.value, option.label]),
) as Record<AggregateGroupBy, string>;

const LEVEL_COLORS: Record<string, string> = {
  error: COLORS.danger,
  warn: COLORS.warning,
  warning: COLORS.warning,
  info: COLORS.primary,
  debug: COLORS.purple,
  trace: COLORS.info,
  fatal: '#b91c1c',
  panic: '#7f1d1d',
};

const INITIAL_FORM_STATE: AggregateFormState = {
  groupBy: 'level',
  timeRange: '7d',
  keywords: '',
  service: '',
};

const SOURCE_BUCKET_KEY_SEPARATOR = '\u001f';

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function isTemporalGroupBy(groupBy: AggregateGroupBy): boolean {
  return groupBy === 'hour' || groupBy === 'minute';
}

function isSourceGroupBy(groupBy: AggregateGroupBy): boolean {
  return groupBy === 'source';
}

function resolveSourceBucketHost(bucket: AggregateBucket): string {
  return bucket.host?.trim() || 'unknown-host';
}

function resolveSourceBucketService(bucket: AggregateBucket): string {
  return bucket.service?.trim() || 'unknown-service';
}

function resolveSourceBucketLabel(bucket: AggregateBucket): string {
  return bucket.label?.trim() || `${resolveSourceBucketHost(bucket)} / ${resolveSourceBucketService(bucket)}`;
}

function resolveSourceBucketIdentity(bucket: AggregateBucket): string {
  return `${resolveSourceBucketHost(bucket)}${SOURCE_BUCKET_KEY_SEPARATOR}${resolveSourceBucketService(bucket)}`;
}

function resolveBucketIdentity(groupBy: AggregateGroupBy, bucket: AggregateBucket): string {
  if (isSourceGroupBy(groupBy)) {
    return resolveSourceBucketIdentity(bucket);
  }
  return bucket.key?.trim() || '-';
}

function resolveBucketDisplayValue(groupBy: AggregateGroupBy, bucket: AggregateBucket): string {
  const key = resolveBucketIdentity(groupBy, bucket);
  if (groupBy === 'level') {
    return key.toUpperCase();
  }
  if (isSourceGroupBy(groupBy)) {
    return resolveSourceBucketLabel(bucket);
  }
  if (!isTemporalGroupBy(groupBy)) {
    return key;
  }
  const date = new Date(key);
  if (Number.isNaN(date.getTime())) {
    return key;
  }
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: groupBy === 'minute' ? '2-digit' : undefined,
  });
}

function normalizeFormState(state: AggregateFormState): AggregateFormState {
  return {
    groupBy: state.groupBy,
    timeRange: state.timeRange,
    keywords: state.keywords.trim(),
    service: state.service.trim(),
  };
}

function buildAggregateFilters(service: string): Record<string, unknown> {
  const trimmedService = service.trim();
  if (!trimmedService) {
    return {};
  }
  return { service: trimmedService };
}

function formatCount(value: number): string {
  return NUMBER_FORMATTER.format(Number.isFinite(value) ? value : 0);
}

function formatAverage(value: number): string {
  return DECIMAL_FORMATTER.format(Number.isFinite(value) ? value : 0);
}

function formatTimeAxisLabel(rawKey: string, groupBy: AggregateGroupBy, timeRange: AggregateTimeRange): string {
  const date = new Date(rawKey);
  if (Number.isNaN(date.getTime())) {
    return rawKey;
  }

  if (groupBy === 'minute' || timeRange === '30m' || timeRange === '1h') {
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
  });
}

function truncateLabel(label: string, maxLength: number): string {
  if (label.length <= maxLength) {
    return label;
  }
  return `${label.slice(0, Math.max(0, maxLength - 1))}…`;
}

function buildSummary(buckets: AggregateBucket[]): AggregateSummary {
  const totalCount = buckets.reduce((sum, bucket) => sum + Number(bucket.count || 0), 0);
  const bucketCount = buckets.length;
  const nonZeroBucketCount = buckets.filter((bucket) => Number(bucket.count || 0) > 0).length;
  const topBucket = buckets.reduce<AggregateBucket | null>((currentTop, bucket) => {
    if (!currentTop || Number(bucket.count || 0) > Number(currentTop.count || 0)) {
      return bucket;
    }
    return currentTop;
  }, null);

  return {
    totalCount,
    bucketCount,
    nonZeroBucketCount,
    topBucket,
    averagePerBucket: bucketCount > 0 ? totalCount / bucketCount : 0,
  };
}

function buildMainChartOption(
  buckets: AggregateBucket[],
  groupBy: AggregateGroupBy,
  timeRange: AggregateTimeRange,
): EChartsCoreOption {
  if (isTemporalGroupBy(groupBy)) {
    const labels = buckets.map((bucket) => formatTimeAxisLabel(bucket.key, groupBy, timeRange));
    const values = buckets.map((bucket) => Number(bucket.count || 0));
    const needsZoom = labels.length > 24;

    return {
      grid: { top: 36, right: 16, bottom: needsZoom ? 68 : 32, left: 52 },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: labels,
        axisLabel: {
          hideOverlap: true,
        },
      },
      yAxis: {
        type: 'value',
        splitLine: {
          lineStyle: { color: 'rgba(148, 163, 184, 0.15)' },
        },
      },
      tooltip: {
        trigger: 'axis',
        formatter: (params: Array<{ axisValueLabel?: string; data?: number }>) => {
          const first = params[0];
          if (!first) {
            return '';
          }
          return `${first.axisValueLabel ?? ''}<br />事件量：${formatCount(Number(first.data || 0))}`;
        },
      },
      dataZoom: needsZoom
        ? [
            { type: 'inside', xAxisIndex: 0 },
            {
              type: 'slider',
              xAxisIndex: 0,
              height: 18,
              bottom: 8,
              startValue: 0,
              endValue: Math.min(labels.length - 1, 23),
            },
          ]
        : undefined,
      series: [
        {
          type: 'line',
          smooth: true,
          showSymbol: labels.length <= 36,
          symbolSize: 6,
          lineStyle: { width: 2, color: COLORS.primary },
          itemStyle: { color: COLORS.primary },
          areaStyle: { color: 'rgba(14, 165, 233, 0.15)' },
          data: values,
        },
      ],
    };
  }

  const labels = buckets.map((bucket) => resolveBucketDisplayValue(groupBy, bucket));
  const values = buckets.map((bucket) => Number(bucket.count || 0));
  const needsZoom = labels.length > 10;
  const colors = groupBy === 'level'
    ? labels.map((label) => LEVEL_COLORS[label.toLowerCase()] ?? COLORS.primary)
    : undefined;

  return {
    grid: { top: 36, right: 16, bottom: needsZoom ? 76 : 52, left: 52 },
    xAxis: {
      type: 'category',
      data: labels,
      axisLabel: {
        interval: 0,
        hideOverlap: false,
        formatter: (value: string) => truncateLabel(String(value ?? ''), groupBy === 'source' ? 18 : 12),
        rotate: groupBy === 'source' ? 18 : 0,
      },
    },
    yAxis: {
      type: 'value',
      splitLine: {
        lineStyle: { color: 'rgba(148, 163, 184, 0.15)' },
      },
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: Array<{ axisValueLabel?: string; data?: number }>) => {
        const first = params[0];
        if (!first) {
          return '';
        }
        return `${first.axisValueLabel ?? ''}<br />事件量：${formatCount(Number(first.data || 0))}`;
      },
    },
    dataZoom: needsZoom
      ? [
          { type: 'inside', xAxisIndex: 0 },
          {
            type: 'slider',
            xAxisIndex: 0,
            height: 18,
            bottom: 8,
            startValue: 0,
            endValue: Math.min(labels.length - 1, 9),
          },
        ]
      : undefined,
    series: [
      {
        type: 'bar',
        data: values,
        barMaxWidth: 36,
        itemStyle: colors
          ? {
              color: (params: { dataIndex: number }) => colors[params.dataIndex],
              borderRadius: [6, 6, 0, 0],
            }
          : { color: COLORS.primary, borderRadius: [6, 6, 0, 0] },
      },
    ],
  };
}

function buildPieChartOption(buckets: AggregateBucket[], groupBy: AggregateGroupBy): EChartsCoreOption {
  const topBuckets = [...buckets]
    .sort((left, right) => Number(right.count || 0) - Number(left.count || 0))
    .slice(0, groupBy === 'source' ? 10 : buckets.length)
    .map((bucket) => {
      const bucketIdentity = resolveBucketIdentity(groupBy, bucket);
      const color = groupBy === 'level' ? LEVEL_COLORS[bucketIdentity.toLowerCase()] ?? COLORS.primary : undefined;
      return {
        name: resolveBucketDisplayValue(groupBy, bucket),
        value: Number(bucket.count || 0),
        itemStyle: color ? { color } : undefined,
      };
    });

  return {
    tooltip: { trigger: 'item', formatter: '{b}<br />事件量：{c} ({d}%)' },
    legend: {
      type: 'scroll',
      orient: 'vertical',
      right: 12,
      top: 'center',
      bottom: 12,
      formatter: (value: string) => truncateLabel(value, 18),
    },
    series: [
      {
        type: 'pie',
        radius: ['46%', '70%'],
        center: ['38%', '50%'],
        padAngle: 2,
        itemStyle: { borderRadius: 4 },
        label: {
          formatter: '{d}%',
          fontSize: 12,
        },
        data: topBuckets,
      },
    ],
  };
}

const AggregateAnalysis: React.FC = () => {
  const isDark = useThemeStore((state) => state.isDark);
  const { message: messageApi } = App.useApp();

  const [formState, setFormState] = useState<AggregateFormState>(INITIAL_FORM_STATE);
  const [queryState, setQueryState] = useState<AggregateFormState>(INITIAL_FORM_STATE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [buckets, setBuckets] = useState<AggregateBucket[]>([]);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [detailPage, setDetailPage] = useState(1);
  const [detailPageSize, setDetailPageSize] = useState(20);
  const abortControllerRef = useRef<AbortController | null>(null);

  const loadData = useCallback(async (state: AggregateFormState) => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const result = await fetchAggregateStats({
        groupBy: state.groupBy,
        timeRange: state.timeRange,
        keywords: state.keywords,
        filters: buildAggregateFilters(state.service),
        signal: controller.signal,
      });

      if (controller.signal.aborted) {
        return;
      }

      setBuckets(result.buckets ?? []);
      setLastUpdatedAt(new Date());
    } catch (err) {
      if (controller.signal.aborted || isAbortError(err)) {
        return;
      }

      const nextError = err instanceof Error ? err.message : '聚合查询失败';
      setError(nextError);
      messageApi.error(nextError);
      if (buckets.length === 0) {
        setBuckets([]);
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  }, [buckets.length, messageApi]);

  useEffect(() => {
    loadData(queryState);
  }, [loadData, queryState]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const handleAnalyze = useCallback(() => {
    setQueryState(normalizeFormState(formState));
  }, [formState]);

  const handleRefresh = useCallback(() => {
    void loadData(queryState);
  }, [loadData, queryState]);

  const handleExpandToSevenDays = useCallback(() => {
    const nextState = normalizeFormState({ ...formState, timeRange: '7d' });
    setFormState(nextState);
    setQueryState(nextState);
  }, [formState]);

  const handleResetFilters = useCallback(() => {
    const nextState = normalizeFormState({ ...formState, keywords: '', service: '' });
    setFormState(nextState);
    setQueryState(nextState);
  }, [formState]);

  const timeRangeOptions = useMemo(() => {
    return TIME_RANGE_OPTIONS.map((option) => ({
      ...option,
      disabled: formState.groupBy === 'minute' && option.value === '7d',
      label: formState.groupBy === 'minute' && option.value === '7d'
        ? '最近 7 天（分钟维度过大）'
        : option.label,
    }));
  }, [formState.groupBy]);

  const isTemporal = isTemporalGroupBy(queryState.groupBy);
  const isEmpty = !loading && !error && buckets.length === 0;
  const hasActiveFilters = Boolean(queryState.keywords || queryState.service);
  const summary = useMemo(() => buildSummary(buckets), [buckets]);
  const topBuckets = useMemo(() => {
    if (isTemporal) {
      return [...buckets].sort((left, right) => Number(right.count || 0) - Number(left.count || 0)).slice(0, 5);
    }
    return [...buckets].sort((left, right) => Number(right.count || 0) - Number(left.count || 0));
  }, [buckets, isTemporal]);
  const displayBuckets = useMemo(() => (isTemporal ? buckets : topBuckets), [buckets, isTemporal, topBuckets]);
  const detailPageCount = useMemo(
    () => Math.max(1, Math.ceil(displayBuckets.length / detailPageSize)),
    [detailPageSize, displayBuckets.length],
  );
  const pagedDisplayBuckets = useMemo(() => {
    const startIndex = (detailPage - 1) * detailPageSize;
    return displayBuckets.slice(startIndex, startIndex + detailPageSize);
  }, [detailPage, detailPageSize, displayBuckets]);

  const summaryCards = useMemo(() => {
    return [
      {
        title: '总事件量',
        value: formatCount(summary.totalCount),
        helper: `${summary.bucketCount} 个分桶`,
      },
      {
        title: '有效分桶',
        value: formatCount(summary.nonZeroBucketCount),
        helper: `非零结果 / 共 ${summary.bucketCount}`,
      },
      {
        title: isTemporal ? '峰值时段' : '最高桶',
        value: formatCount(Number(summary.topBucket?.count || 0)),
        helper: summary.topBucket
          ? resolveBucketDisplayValue(queryState.groupBy, summary.topBucket)
          : '暂无数据',
      },
      {
        title: '平均每桶',
        value: formatAverage(summary.averagePerBucket),
        helper: `${TIME_RANGE_LABEL_MAP[queryState.timeRange]} 内平均值`,
      },
    ];
  }, [queryState.groupBy, queryState.timeRange, summary]);

  const mainChartTitle = useMemo(() => {
    if (queryState.groupBy === 'level') {
      return '日志级别分布';
    }
    if (queryState.groupBy === 'source') {
      return '主机 / 服务分布';
    }
    return queryState.groupBy === 'minute' ? '分钟级事件趋势' : '小时级事件趋势';
  }, [queryState.groupBy]);

  const mainChartSubtitle = useMemo(() => {
    const fragments = [TIME_RANGE_LABEL_MAP[queryState.timeRange], GROUP_BY_LABEL_MAP[queryState.groupBy]];
    if (queryState.keywords) {
      fragments.push(`关键词：${queryState.keywords}`);
    }
    if (queryState.service) {
      fragments.push(`服务：${queryState.service}`);
    }
    return fragments.join(' · ');
  }, [queryState]);

  const mainChartOption = useMemo(
    () => buildMainChartOption(buckets, queryState.groupBy, queryState.timeRange),
    [buckets, queryState.groupBy, queryState.timeRange],
  );

  const pieChartOption = useMemo(
    () => buildPieChartOption(buckets, queryState.groupBy),
    [buckets, queryState.groupBy],
  );

  const resultLevel = error && buckets.length > 0 ? 'warning' : undefined;
  const resultStatusTag = error && buckets.length > 0
    ? <Tag color="warning">展示最近一次成功结果</Tag>
    : <Tag color="processing">{TIME_RANGE_LABEL_MAP[queryState.timeRange]}</Tag>;

  const shouldRenderResults = loading || buckets.length > 0 || Boolean(error && buckets.length > 0);

  useEffect(() => {
    setDetailPage(1);
  }, [queryState.groupBy, queryState.keywords, queryState.service, queryState.timeRange]);

  useEffect(() => {
    if (detailPage > detailPageCount) {
      setDetailPage(detailPageCount);
    }
  }, [detailPage, detailPageCount]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold m-0">聚合分析</h2>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <span className="text-xs opacity-50">Log Analysis / Aggregation</span>
            {lastUpdatedAt && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                最近更新：{lastUpdatedAt.toLocaleString('zh-CN')}
              </Text>
            )}
            {error && buckets.length > 0 && <Tag color="warning">接口异常时保留上次成功结果</Tag>}
          </div>
        </div>
        <Button
          icon={<span className="material-symbols-outlined text-sm">refresh</span>}
          type="primary"
          size="small"
          loading={loading}
          onClick={handleRefresh}
        >
          刷新
        </Button>
      </div>

      <Card
        title={
          <span className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base" style={{ color: COLORS.primary }}>query_stats</span>
            聚合查询
          </span>
        }
        styles={{ body: { padding: 16 } }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          <div>
            <div className="text-xs font-medium opacity-50 mb-1.5 uppercase tracking-wider">分组维度</div>
            <Select
              value={formState.groupBy}
              onChange={(value) => {
                setFormState((current) => {
                  const nextTimeRange = value === 'minute' && current.timeRange === '7d' ? '24h' : current.timeRange;
                  return {
                    ...current,
                    groupBy: value,
                    timeRange: nextTimeRange,
                  };
                });
              }}
              options={GROUP_BY_OPTIONS}
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <div className="text-xs font-medium opacity-50 mb-1.5 uppercase tracking-wider">时间范围</div>
            <Select
              value={formState.timeRange}
              onChange={(value) => setFormState((current) => ({ ...current, timeRange: value }))}
              options={timeRangeOptions}
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <div className="text-xs font-medium opacity-50 mb-1.5 uppercase tracking-wider">关键词</div>
            <Input
              id="aggregate-analysis-keywords"
              name="aggregateAnalysisKeywords"
              allowClear
              value={formState.keywords}
              placeholder="例如 docker / error / timeout"
              onChange={(event) => setFormState((current) => ({ ...current, keywords: event.target.value }))}
              onPressEnter={handleAnalyze}
            />
          </div>
          <div>
            <div className="text-xs font-medium opacity-50 mb-1.5 uppercase tracking-wider">服务名</div>
            <Input
              id="aggregate-analysis-service"
              name="aggregateAnalysisService"
              allowClear
              value={formState.service}
              placeholder="例如 audit.log"
              onChange={(event) => setFormState((current) => ({ ...current, service: event.target.value }))}
              onPressEnter={handleAnalyze}
            />
          </div>
          <div className="flex items-end">
            <Button
              block
              type="primary"
              loading={loading}
              onClick={handleAnalyze}
              icon={<span className="material-symbols-outlined text-sm">play_arrow</span>}
            >
              {loading ? '分析中...' : '开始分析'}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-3">
          <Tag color="processing">{TIME_RANGE_LABEL_MAP[queryState.timeRange]}</Tag>
          <Tag color="blue">{GROUP_BY_LABEL_MAP[queryState.groupBy]}</Tag>
          {queryState.keywords && <Tag color="gold">关键词：{queryState.keywords}</Tag>}
          {queryState.service && <Tag color="cyan">服务：{queryState.service}</Tag>}
          {formState.groupBy === 'minute' && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              分钟维度默认限制在 24 小时以内，避免生成过大的时间桶。
            </Text>
          )}
        </div>
      </Card>

      {error && buckets.length === 0 && (
        <Alert
          showIcon
          type="error"
          message="聚合查询失败"
          description={error}
        />
      )}

      {isEmpty && (
        <Card>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              queryState.timeRange === '7d'
                ? '当前筛选条件下暂无聚合结果，请尝试调整关键词、服务名或切换分组维度。'
                : `当前 ${TIME_RANGE_LABEL_MAP[queryState.timeRange]} 内暂无结果，建议扩展到最近 7 天查看历史数据。`
            }
          >
            <div className="flex flex-wrap justify-center gap-2">
              {queryState.timeRange !== '7d' && (
                <Button type="primary" onClick={handleExpandToSevenDays}>
                  切换到最近 7 天
                </Button>
              )}
              {hasActiveFilters && (
                <Button onClick={handleResetFilters}>清空关键词和服务</Button>
              )}
            </div>
          </Empty>
        </Card>
      )}

      {shouldRenderResults && (
        <>
          {resultLevel && (
            <Alert
              showIcon
              type="warning"
              message="当前结果为最近一次成功查询的数据"
              description={error ?? undefined}
            />
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {summaryCards.map((item) => (
              <Card key={item.title} size="small" styles={{ body: { padding: 16 } }}>
                <div className="text-xs font-medium opacity-50 tracking-wider uppercase">{item.title}</div>
                <div className="text-2xl font-semibold mt-2" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {item.value}
                </div>
                <div className="text-xs mt-2 opacity-60 break-all">{item.helper}</div>
              </Card>
            ))}
          </div>

          <div className={`grid grid-cols-1 ${isTemporal ? 'xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]' : 'xl:grid-cols-2'} gap-4`}>
            <ChartWrapper
              title={mainChartTitle}
              subtitle={mainChartSubtitle}
              option={mainChartOption}
              height={360}
              loading={loading}
              error={error && buckets.length === 0 ? error : undefined}
              empty={isEmpty}
              actions={resultStatusTag}
            />

            {isTemporal ? (
              <Card
                title="趋势洞察"
                extra={<Tag color="purple">Top 5 高峰分桶</Tag>}
                styles={{ body: { padding: 16 } }}
              >
                {loading && buckets.length === 0 ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
                    <InlineLoadingState tip="加载中..." />
                  </div>
                ) : topBuckets.length === 0 ? (
                  <Empty description="暂无可展示的时间桶" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : (
                  <div className="flex flex-col gap-3">
                    {topBuckets.map((bucket, index) => {
                      const count = Number(bucket.count || 0);
                      const width = summary.totalCount > 0 ? Math.max(6, (count / summary.totalCount) * 100) : 0;
                      return (
                        <div key={`${resolveBucketIdentity(queryState.groupBy, bucket)}-${index}`} className="flex flex-col gap-1">
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <span className="font-medium">{resolveBucketDisplayValue(queryState.groupBy, bucket)}</span>
                            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCount(count)}</span>
                          </div>
                          <div
                            style={{
                              height: 8,
                              borderRadius: 999,
                              backgroundColor: isDark ? '#1e293b' : '#e2e8f0',
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                width: `${width}%`,
                                height: '100%',
                                background: COLORS.primary,
                                borderRadius: 999,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            ) : (
              <ChartWrapper
                title={queryState.groupBy === 'source' ? '主机 / 服务占比（Top 10）' : '分布占比'}
                subtitle={mainChartSubtitle}
                option={pieChartOption}
                height={360}
                loading={loading}
                error={error && buckets.length === 0 ? error : undefined}
                empty={isEmpty}
                actions={<Tag color="geekblue">按占比展示</Tag>}
              />
            )}
          </div>

          <Card
            title="详细数据"
            extra={
              <Text type="secondary" style={{ fontSize: 12 }}>
                共 {formatCount(displayBuckets.length)} 个分桶
              </Text>
            }
          >
            {loading && buckets.length === 0 ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
                <InlineLoadingState tip="加载中..." />
              </div>
            ) : displayBuckets.length === 0 ? (
              <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <div className="flex flex-col gap-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
                      <th style={{ textAlign: 'left', padding: '10px 12px', width: 72, fontWeight: 600 }}>排名</th>
                      {queryState.groupBy === 'source' ? (
                        <>
                          <th style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 600 }}>主机名</th>
                          <th style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 600 }}>服务名</th>
                        </>
                      ) : (
                        <th style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 600 }}>
                          {isTemporal ? '时间桶' : '日志级别'}
                        </th>
                      )}
                      <th style={{ textAlign: 'right', padding: '10px 12px', width: 140, fontWeight: 600 }}>事件量</th>
                      <th style={{ textAlign: 'right', padding: '10px 12px', width: 180, fontWeight: 600 }}>占比</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedDisplayBuckets.map((bucket, index) => {
                      const count = Number(bucket.count || 0);
                      const share = summary.totalCount > 0 ? (count / summary.totalCount) * 100 : 0;
                      const displayValue = resolveBucketDisplayValue(queryState.groupBy, bucket);
                      const bucketIdentity = resolveBucketIdentity(queryState.groupBy, bucket);
                      const levelColor = queryState.groupBy === 'level'
                        ? LEVEL_COLORS[bucketIdentity.toLowerCase()] ?? COLORS.primary
                        : COLORS.primary;
                      const sourceHost = resolveSourceBucketHost(bucket);
                      const sourceService = resolveSourceBucketService(bucket);
                      const rank = (detailPage - 1) * detailPageSize + index + 1;

                      return (
                        <tr key={`${bucketIdentity}-${rank}`} style={{ borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
                          <td style={{ padding: '10px 12px', fontVariantNumeric: 'tabular-nums' }}>#{rank}</td>
                          {queryState.groupBy === 'source' ? (
                            <>
                              <td style={{ padding: '10px 12px' }}>
                                <div style={{ maxWidth: 260, wordBreak: 'break-all', fontWeight: 500 }}>{sourceHost}</div>
                              </td>
                              <td style={{ padding: '10px 12px' }}>
                                <div style={{ maxWidth: 260, wordBreak: 'break-all' }}>{sourceService}</div>
                              </td>
                            </>
                          ) : (
                            <td style={{ padding: '10px 12px' }}>
                              {queryState.groupBy === 'level' ? (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    padding: '2px 10px',
                                    borderRadius: 999,
                                    backgroundColor: `${levelColor}1f`,
                                    color: levelColor,
                                    fontWeight: 600,
                                    fontVariantNumeric: 'tabular-nums',
                                  }}
                                >
                                  {displayValue}
                                </span>
                              ) : (
                                <div style={{ maxWidth: 520, wordBreak: 'break-all' }}>{displayValue}</div>
                              )}
                            </td>
                          )}
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {formatCount(count)}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <div className="flex items-center justify-end gap-3">
                              <div
                                style={{
                                  width: 96,
                                  height: 8,
                                  borderRadius: 999,
                                  backgroundColor: isDark ? '#1e293b' : '#e2e8f0',
                                  overflow: 'hidden',
                                }}
                              >
                                <div
                                  style={{
                                    width: `${Math.min(100, Math.max(4, share))}%`,
                                    height: '100%',
                                    backgroundColor: queryState.groupBy === 'level' ? levelColor : COLORS.primary,
                                    borderRadius: 999,
                                  }}
                                />
                              </div>
                              <span style={{ minWidth: 56, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                {share.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <Text type="secondary" style={{ fontSize: 12 }}>
                  显示第 {(detailPage - 1) * detailPageSize + 1} - {Math.min(detailPage * detailPageSize, displayBuckets.length)} 条，共 {formatCount(displayBuckets.length)} 条
                </Text>
                <Pagination
                  current={detailPage}
                  pageSize={detailPageSize}
                  total={displayBuckets.length}
                  showSizeChanger
                  pageSizeOptions={["10", "20", "50", "100"]}
                  onChange={(page, pageSize) => {
                    setDetailPage(page);
                    setDetailPageSize(pageSize);
                  }}
                  showTotal={(total) => `共 ${formatCount(total)} 条`}
                  size="small"
                />
              </div>
            </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
};

export default AggregateAnalysis;
