import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  App,
  Button,
  Card,
  Descriptions,
  Drawer,
  Empty,
  Progress,
  Select,
  Space,
  Statistic,
  Tag,
} from 'antd';
import type { EChartsCoreOption } from 'echarts/core';
import ChartWrapper from '../../components/charts/ChartWrapper';
import AnalysisPageHeader from '../../components/common/AnalysisPageHeader';
import {
  fetchAnomalyStats,
  type DetectedAnomaly,
  type FetchAnomalyStatsParams,
  type FetchAnomalyStatsResult,
  type QueryResultFallbackInfo,
} from '../../api/query';
import { useThemeStore } from '../../stores/themeStore';
import { COLORS } from '../../theme/tokens';
import { buildAlertRuleDraftFromAnomaly, savePendingAlertRuleDraft } from '../../utils/alertRulePrefill';
import { persistPendingRealtimeStartupQuery } from '../search/realtimeStartupQuery';
import { buildRealtimePresetQuery } from '../search/realtimePresetQuery';
import type { RealtimeQueryFilters } from '../search/realtimeQueryFilterTypes';

const NUMBER_FORMATTER = new Intl.NumberFormat('zh-CN');

type AnomalyTimeRange = FetchAnomalyStatsParams['timeRange'];
type AnomalyMetricFilter = DetectedAnomaly['metric'] | 'all';
type AnomalySeverityFilter = DetectedAnomaly['severity'] | 'all';
type AnomalyStatusFilter = DetectedAnomaly['status'] | 'all';

const TIME_RANGE_OPTIONS: Array<{ value: AnomalyTimeRange; label: string }> = [
  { value: '1h', label: '过去 1 小时' },
  { value: '6h', label: '过去 6 小时' },
  { value: '24h', label: '过去 24 小时' },
  { value: '7d', label: '过去 7 天' },
];

const TIME_RANGE_LABELS = Object.fromEntries(TIME_RANGE_OPTIONS.map((option) => [option.value, option.label])) as Record<AnomalyTimeRange, string>;

const EMPTY_RESULT: FetchAnomalyStatsResult = {
  summary: {
    total_anomalies: 0,
    critical_count: 0,
    health_score: 100,
    anomalous_buckets: 0,
    affected_services: 0,
  },
  trend: [],
  anomalies: [],
};

const SEVERITY_MAP: Record<DetectedAnomaly['severity'], { color: string; tagColor: string; icon: string; label: string }> = {
  critical: { color: COLORS.danger, tagColor: 'error', icon: 'error', label: '严重' },
  high: { color: COLORS.warning, tagColor: 'warning', icon: 'warning', label: '高' },
  medium: { color: COLORS.info, tagColor: 'processing', icon: 'info', label: '中' },
  low: { color: COLORS.success, tagColor: 'success', icon: 'info', label: '低' },
};

const STATUS_MAP: Record<DetectedAnomaly['status'], { tagColor: string; label: string }> = {
  active: { tagColor: 'error', label: '活跃' },
  investigating: { tagColor: 'warning', label: '调查中' },
  resolved: { tagColor: 'success', label: '已解决' },
  dismissed: { tagColor: 'default', label: '已忽略' },
};

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function formatCount(value: number): string {
  return NUMBER_FORMATTER.format(Number.isFinite(value) ? value : 0);
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value || '-';
  }
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatMetricValue(value: number): string {
  if (!Number.isFinite(value)) {
    return '0';
  }
  const absolute = Math.abs(value);
  const precision = absolute >= 100 ? 0 : absolute >= 10 ? 1 : 2;
  return NUMBER_FORMATTER.format(Number(value.toFixed(precision)));
}

function formatDeltaValue(value: number): string {
  if (!Number.isFinite(value)) {
    return '0';
  }
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${formatMetricValue(value)}`;
}

function resolveMetricSuffix(metric: string): string {
  return metric === 'error_rate' ? '%' : '';
}

function calculateDeviationPercent(anomaly: DetectedAnomaly): number {
  const actual = Number(anomaly.actual_value) || 0;
  const expected = Number(anomaly.expected_value) || 0;
  if (expected <= 0) {
    return actual > 0 ? 100 : 0;
  }
  return Math.round((Math.abs(actual - expected) / expected) * 100);
}

function resolveRelatedLogWindow(timeRange: AnomalyTimeRange, timestamp: string): { from: string; to: string } | null {
  const center = new Date(timestamp);
  if (Number.isNaN(center.getTime())) {
    return null;
  }
  const windowMsByRange: Record<AnomalyTimeRange, number> = {
    '1h': 10 * 60 * 1000,
    '6h': 30 * 60 * 1000,
    '24h': 2 * 60 * 60 * 1000,
    '7d': 6 * 60 * 60 * 1000,
  };
  const halfWindowMs = windowMsByRange[timeRange] ?? 30 * 60 * 1000;
  return {
    from: new Date(center.getTime() - halfWindowMs).toISOString(),
    to: new Date(center.getTime() + halfWindowMs).toISOString(),
  };
}

function buildRelatedLogPresetQuery(anomaly: DetectedAnomaly, timeRange: AnomalyTimeRange): string {
  const filters: RealtimeQueryFilters = {};
  if (anomaly.service && anomaly.service !== '全局') {
    filters.service = anomaly.service;
  }
  if (anomaly.metric === 'error_rate') {
    filters.level = 'error';
  }
  const presetQuery = buildRealtimePresetQuery({
    queryText: '',
    filters,
  });
  const timeWindow = resolveRelatedLogWindow(timeRange, anomaly.timestamp);
  if (!timeWindow) {
    return presetQuery;
  }
  const timeClause = `time:[${timeWindow.from},${timeWindow.to}]`;
  return [presetQuery, timeClause].filter(Boolean).join(' ').trim();
}

function formatAxisLabel(value: string, timeRange: AnomalyTimeRange): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  if (timeRange === '1h' || timeRange === '6h') {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }
  if (timeRange === '24h') {
    return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit' });
  }
  return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit' });
}

function buildTimelineOption(result: FetchAnomalyStatsResult, isDark: boolean, timeRange: AnomalyTimeRange): EChartsCoreOption {
  const trend = result.trend;
  return {
    grid: { top: 40, right: 16, bottom: 36, left: 48 },
    legend: {
      show: true,
      top: 0,
      right: 0,
      textStyle: { fontSize: 10, color: isDark ? '#94a3b8' : '#475569' },
      data: ['实际值', '预期值', '正常范围'],
    },
    tooltip: {
      trigger: 'axis',
      valueFormatter: (value: string | number | null | undefined) => `${value ?? ''}`,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: trend.map((item) => formatAxisLabel(item.time, timeRange)),
      axisLabel: { color: isDark ? '#94a3b8' : '#64748b', fontSize: 10 },
      axisLine: { lineStyle: { color: isDark ? '#334155' : '#cbd5e1' } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: isDark ? '#94a3b8' : '#64748b', fontSize: 10 },
      splitLine: { lineStyle: { color: isDark ? 'rgba(148,163,184,0.12)' : 'rgba(148,163,184,0.2)' } },
    },
    series: [
      {
        name: '正常范围',
        type: 'line',
        data: trend.map((item) => item.lower_bound),
        stack: 'range',
        symbol: 'none',
        lineStyle: { opacity: 0 },
        areaStyle: { opacity: 0 },
      },
      {
        name: '正常范围',
        type: 'line',
        data: trend.map((item) => Math.max(0, item.upper_bound - item.lower_bound)),
        stack: 'range',
        symbol: 'none',
        lineStyle: { opacity: 0 },
        areaStyle: { opacity: 0.15, color: COLORS.info },
      },
      {
        name: '预期值',
        type: 'line',
        data: trend.map((item) => item.expected),
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 2, type: 'dashed', color: COLORS.success, opacity: 0.7 },
        itemStyle: { color: COLORS.success },
      },
      {
        name: '实际值',
        type: 'line',
        data: trend.map((item) => item.actual),
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 2, color: COLORS.primary },
        itemStyle: { color: COLORS.primary },
        markPoint: {
          symbol: 'circle',
          symbolSize: 12,
          data: trend
            .map((item, index) => (item.is_anomaly
              ? { coord: [index, item.actual], itemStyle: { color: COLORS.danger, borderColor: isDark ? '#1e293b' : '#ffffff', borderWidth: 2 } }
              : null))
            .filter(Boolean),
        },
      },
    ],
  };
}

const AnomalyDetection: React.FC = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const isDark = useThemeStore((state) => state.isDark);

  const [selectedTimeRange, setSelectedTimeRange] = useState<AnomalyTimeRange>('7d');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refreshToken, setRefreshToken] = useState(0);
  const [result, setResult] = useState<FetchAnomalyStatsResult>(EMPTY_RESULT);
  const [fallbackInfo, setFallbackInfo] = useState<QueryResultFallbackInfo | null>(null);
  const [selectedAnomaly, setSelectedAnomaly] = useState<DetectedAnomaly | null>(null);
  const [selectedService, setSelectedService] = useState<string>('all');
  const [selectedMetric, setSelectedMetric] = useState<AnomalyMetricFilter>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<AnomalySeverityFilter>('all');
  const [selectedStatus, setSelectedStatus] = useState<AnomalyStatusFilter>('all');
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const hasSuccessfulResultRef = useRef(false);

  const loadAnomalies = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError('');
    try {
      const nextResult = await fetchAnomalyStats({ timeRange: selectedTimeRange, signal });
      if (signal?.aborted) {
        return;
      }
      hasSuccessfulResultRef.current = true;
      setResult(nextResult);
      setFallbackInfo(nextResult.fallbackInfo ?? null);
      setLastUpdatedAt(new Date());
    } catch (loadError) {
      if (isAbortError(loadError)) {
        return;
      }
      if (!hasSuccessfulResultRef.current) {
        setResult(EMPTY_RESULT);
        setFallbackInfo(null);
      }
      setError(loadError instanceof Error ? loadError.message : '异常检测加载失败，请稍后重试');
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [selectedTimeRange]);

  useEffect(() => {
    const controller = new AbortController();
    void loadAnomalies(controller.signal);
    return () => controller.abort();
  }, [loadAnomalies, refreshToken]);

  const timelineOption = useMemo(
    () => buildTimelineOption(result, isDark, selectedTimeRange),
    [result, isDark, selectedTimeRange],
  );

  const handleRefresh = useCallback(() => {
    setRefreshToken((current) => current + 1);
  }, []);

  const handleViewDetail = useCallback((anomaly: DetectedAnomaly) => {
    setSelectedAnomaly(anomaly);
  }, []);

  const serviceOptions = useMemo(
    () => Array.from(new Set(result.anomalies.map((item) => item.service.trim()).filter(Boolean))).sort((left, right) => left.localeCompare(right, 'zh-CN')),
    [result.anomalies],
  );
  const metricOptions = useMemo(
    () => Array.from(new Set(result.anomalies.map((item) => item.metric.trim()).filter(Boolean))).sort((left, right) => left.localeCompare(right, 'zh-CN')),
    [result.anomalies],
  );
  const filteredAnomalies = useMemo(
    () => result.anomalies.filter((item) => {
      if (selectedService !== 'all' && item.service !== selectedService) {
        return false;
      }
      if (selectedMetric !== 'all' && item.metric !== selectedMetric) {
        return false;
      }
      if (selectedSeverity !== 'all' && item.severity !== selectedSeverity) {
        return false;
      }
      if (selectedStatus !== 'all' && item.status !== selectedStatus) {
        return false;
      }
      return true;
    }),
    [result.anomalies, selectedMetric, selectedService, selectedSeverity, selectedStatus],
  );
  const activeCount = useMemo(
    () => filteredAnomalies.filter((item) => item.status === 'active' || item.status === 'investigating').length,
    [filteredAnomalies],
  );
  const hasActiveFilters = selectedService !== 'all' || selectedMetric !== 'all' || selectedSeverity !== 'all' || selectedStatus !== 'all';
  const hasRetainedResult = Boolean(lastUpdatedAt);
  const staleResultVisible = Boolean(error && hasRetainedResult);

  useEffect(() => {
    if (!selectedAnomaly) {
      return;
    }
    const refreshedSelection = result.anomalies.find((item) => item.id === selectedAnomaly.id);
    if (refreshedSelection) {
      setSelectedAnomaly(refreshedSelection);
    }
  }, [result.anomalies, selectedAnomaly]);

  const handleCreateAlert = useCallback(() => {
    if (!selectedAnomaly) {
      return;
    }
    savePendingAlertRuleDraft(buildAlertRuleDraftFromAnomaly(selectedAnomaly));
    setSelectedAnomaly(null);
    navigate('/alerts/rules');
    message.success('已根据当前异常预填告警规则，请确认后保存');
  }, [message, navigate, selectedAnomaly]);

  const handleViewRelatedLogs = useCallback(() => {
    if (!selectedAnomaly) {
      return;
    }
    persistPendingRealtimeStartupQuery(buildRelatedLogPresetQuery(selectedAnomaly, selectedTimeRange));
    navigate('/search/realtime');
    setSelectedAnomaly(null);
    message.success('已按当前异常预填日志检索条件');
  }, [message, navigate, selectedAnomaly, selectedTimeRange]);

  return (
    <div className="flex flex-col gap-4">
      <AnalysisPageHeader
        title="异常检测"
        subtitle="基于真实日志趋势与错误率的异常检测"
        statusTag={(
          <Tag color={result.summary.total_anomalies > 0 ? 'warning' : 'success'} style={{ margin: 0 }}>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              {result.summary.total_anomalies > 0 ? '已检测到异常' : '实时监控中'}
            </span>
          </Tag>
        )}
        lastUpdatedAt={lastUpdatedAt}
        showRetainedResultTag={staleResultVisible}
        fallbackLabel={fallbackInfo?.label ?? null}
        actions={(
          <>
            <Select
              id="anomaly_time_range"
              aria-label="异常检测时间范围"
              value={selectedTimeRange}
              onChange={(value) => setSelectedTimeRange(value as AnomalyTimeRange)}
              options={TIME_RANGE_OPTIONS}
              style={{ width: 160 }}
              size="small"
            />
            <Button size="small" onClick={handleRefresh} loading={loading} icon={<span className="material-symbols-outlined text-sm">refresh</span>}>
              刷新数据
            </Button>
          </>
        )}
      />

      {error && !hasRetainedResult && (
        <Alert
          type="error"
          showIcon
          message="异常检测加载失败"
          description={error}
        />
      )}

      {staleResultVisible && (
        <Alert
          type="warning"
          showIcon
          message="当前结果为最近一次成功查询的数据"
          description={error}
        />
      )}

      {fallbackInfo && (
        <Alert
          type="warning"
          showIcon
          message={fallbackInfo.label}
          description={fallbackInfo.description}
        />
      )}

      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
        <Card>
          <Statistic
            title="当前异常数"
            value={formatCount(result.summary.total_anomalies)}
            prefix={<span className="material-symbols-outlined text-base" style={{ color: COLORS.danger }}>warning</span>}
          />
        </Card>
        <Card>
          <Statistic
            title="严重异常"
            value={formatCount(result.summary.critical_count)}
            prefix={<span className="material-symbols-outlined text-base" style={{ color: COLORS.warning }}>priority_high</span>}
          />
        </Card>
        <Card>
          <Statistic
            title="系统健康度"
            value={result.summary.health_score}
            suffix="%"
            prefix={<span className="material-symbols-outlined text-base" style={{ color: COLORS.success }}>health_and_safety</span>}
          />
        </Card>
        <Card>
          <Statistic
            title="异常时间桶"
            value={formatCount(result.summary.anomalous_buckets)}
            prefix={<span className="material-symbols-outlined text-base" style={{ color: COLORS.info }}>timeline</span>}
          />
        </Card>
        <Card>
          <Statistic
            title="影响服务"
            value={formatCount(result.summary.affected_services)}
            prefix={<span className="material-symbols-outlined text-base" style={{ color: COLORS.primary }}>dns</span>}
          />
        </Card>
      </div>

      <Card size="small">
        <div className="flex items-center gap-3 flex-wrap">
          <Select
            aria-label="按服务筛选异常"
            value={selectedService}
            onChange={setSelectedService}
            style={{ width: 180 }}
            size="small"
            options={[
              { value: 'all', label: '全部服务' },
              ...serviceOptions.map((service) => ({ value: service, label: service })),
            ]}
          />
          <Select
            aria-label="按指标筛选异常"
            value={selectedMetric}
            onChange={(value) => setSelectedMetric(value as AnomalyMetricFilter)}
            style={{ width: 160 }}
            size="small"
            options={[
              { value: 'all', label: '全部指标' },
              ...metricOptions.map((metric) => ({ value: metric, label: metric })),
            ]}
          />
          <Select
            aria-label="按严重性筛选异常"
            value={selectedSeverity}
            onChange={(value) => setSelectedSeverity(value as AnomalySeverityFilter)}
            style={{ width: 160 }}
            size="small"
            options={[
              { value: 'all', label: '全部严重性' },
              { value: 'critical', label: '严重' },
              { value: 'high', label: '高' },
              { value: 'medium', label: '中' },
              { value: 'low', label: '低' },
            ]}
          />
          <Select
            aria-label="按状态筛选异常"
            value={selectedStatus}
            onChange={(value) => setSelectedStatus(value as AnomalyStatusFilter)}
            style={{ width: 160 }}
            size="small"
            options={[
              { value: 'all', label: '全部状态' },
              { value: 'active', label: '活跃' },
              { value: 'investigating', label: '调查中' },
              { value: 'resolved', label: '已解决' },
              { value: 'dismissed', label: '已忽略' },
            ]}
          />
          {hasActiveFilters && (
            <Button
              size="small"
              onClick={() => {
                setSelectedService('all');
                setSelectedMetric('all');
                setSelectedSeverity('all');
                setSelectedStatus('all');
              }}
            >
              清空筛选
            </Button>
          )}
          <span className="text-xs opacity-60 ml-auto">
            当前展示 {filteredAnomalies.length} / {result.anomalies.length} 条异常
          </span>
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_0.95fr] gap-4">
        <ChartWrapper
          title="日志量异常趋势"
          subtitle={TIME_RANGE_LABELS[selectedTimeRange]}
          loading={loading}
          error={error && !hasRetainedResult ? error || undefined : undefined}
          empty={result.trend.length === 0}
          option={timelineOption}
          height={360}
        />

        <Card
          title={(
            <div className="flex items-center justify-between gap-3">
              <span>检测到的异常</span>
              <Space size={6} wrap>
                <Tag style={{ margin: 0 }}>{filteredAnomalies.length} 条</Tag>
                <Tag color="processing" style={{ margin: 0 }}>{activeCount} 活跃/调查中</Tag>
              </Space>
            </div>
          )}
          styles={{ body: { padding: '8px 12px', maxHeight: 360, overflowY: 'auto' } }}
        >
          {loading && filteredAnomalies.length === 0 ? (
            <Card loading variant="borderless" styles={{ body: { padding: 0 } }} />
          ) : filteredAnomalies.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前筛选条件下未检测到异常结果，请尝试扩展时间范围或稍后刷新。" />
          ) : (
            <div className="flex flex-col gap-2">
              {filteredAnomalies.map((anomaly) => {
                const severity = SEVERITY_MAP[anomaly.severity];
                const isCritical = anomaly.severity === 'critical';
                return (
                  <div
                    key={anomaly.id}
                    className="p-3 rounded-lg cursor-pointer transition-colors"
                    onClick={() => handleViewDetail(anomaly)}
                    style={{
                      borderLeft: `3px solid ${severity.color}`,
                      outline: selectedAnomaly?.id === anomaly.id ? `1px solid ${severity.color}` : 'none',
                      backgroundColor: isCritical
                        ? (isDark ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.04)')
                        : (isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'),
                    }}
                  >
                    <div className="flex items-start justify-between mb-1.5 gap-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="material-symbols-outlined text-base" style={{ color: severity.color }}>{severity.icon}</span>
                        <span className="text-sm font-medium">{anomaly.title}</span>
                        {anomaly.status === 'active' && (
                          <Tag color="blue" style={{ margin: 0, fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>NEW</Tag>
                        )}
                      </div>
                      <span className="text-xs opacity-50 font-mono">{formatDateTime(anomaly.timestamp)}</span>
                    </div>
                    <div className="text-xs opacity-70 mb-2">{anomaly.description}</div>
                    <div className="flex items-center gap-4 text-xs opacity-60 mb-2 flex-wrap">
                      <span>置信度: <strong>{anomaly.confidence}%</strong></span>
                      <span>服务: <strong>{anomaly.service}</strong></span>
                      <span>指标: <strong>{anomaly.metric}</strong></span>
                    </div>
                    <Button size="small" block type="default" className="text-xs" onClick={(event) => {
                      event.stopPropagation();
                      handleViewDetail(anomaly);
                    }}>
                      <span className="material-symbols-outlined text-sm mr-1">troubleshoot</span>
                      查看异常详情
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <Drawer
        title={selectedAnomaly ? (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="material-symbols-outlined" style={{ color: SEVERITY_MAP[selectedAnomaly.severity].color }}>
              {SEVERITY_MAP[selectedAnomaly.severity].icon}
            </span>
            <span>{selectedAnomaly.title}</span>
            <Tag color={SEVERITY_MAP[selectedAnomaly.severity].tagColor} style={{ margin: 0 }}>{SEVERITY_MAP[selectedAnomaly.severity].label}</Tag>
            <Tag color={STATUS_MAP[selectedAnomaly.status].tagColor} style={{ margin: 0 }}>{STATUS_MAP[selectedAnomaly.status].label}</Tag>
          </div>
        ) : '异常详情'}
        open={Boolean(selectedAnomaly)}
        onClose={() => setSelectedAnomaly(null)}
        width={480}
        footer={selectedAnomaly ? (
          <div className="flex items-center gap-2 w-full">
            <Button block onClick={handleViewRelatedLogs}>查看相关日志</Button>
            <Button type="primary" block onClick={handleCreateAlert}>创建告警规则</Button>
            <Button block onClick={() => setSelectedAnomaly(null)}>关闭</Button>
          </div>
        ) : null}
      >
        {selectedAnomaly && (
          <div className="flex flex-col gap-4">
            <div>
              <div className="text-xs font-medium opacity-50 mb-1">描述</div>
              <p className="text-sm m-0">{selectedAnomaly.description}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Card size="small">
                <Statistic title="预期值" value={formatMetricValue(selectedAnomaly.expected_value)} suffix={resolveMetricSuffix(selectedAnomaly.metric)} valueStyle={{ fontSize: 20 }} />
              </Card>
              <Card size="small">
                <Statistic
                  title="实际值"
                  value={formatMetricValue(selectedAnomaly.actual_value)}
                  suffix={resolveMetricSuffix(selectedAnomaly.metric)}
                  valueStyle={{
                    fontSize: 20,
                    color: selectedAnomaly.actual_value > selectedAnomaly.expected_value ? COLORS.danger : COLORS.success,
                  }}
                />
              </Card>
              <Card size="small">
                <Statistic
                  title="偏差值"
                  value={formatDeltaValue(selectedAnomaly.actual_value - selectedAnomaly.expected_value)}
                  suffix={resolveMetricSuffix(selectedAnomaly.metric)}
                  valueStyle={{
                    fontSize: 18,
                    color: selectedAnomaly.actual_value > selectedAnomaly.expected_value ? COLORS.danger : COLORS.success,
                  }}
                />
              </Card>
              <Card size="small">
                <Statistic title="偏差比例" value={calculateDeviationPercent(selectedAnomaly)} suffix="%" valueStyle={{ fontSize: 18 }} />
              </Card>
            </div>

            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="服务">{selectedAnomaly.service}</Descriptions.Item>
              <Descriptions.Item label="指标">{selectedAnomaly.metric}</Descriptions.Item>
              <Descriptions.Item label="严重性">
                <Tag color={SEVERITY_MAP[selectedAnomaly.severity].tagColor} style={{ margin: 0 }}>{SEVERITY_MAP[selectedAnomaly.severity].label}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={STATUS_MAP[selectedAnomaly.status].tagColor} style={{ margin: 0 }}>{STATUS_MAP[selectedAnomaly.status].label}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="置信度">
                <Progress percent={selectedAnomaly.confidence} size="small" style={{ margin: 0, width: 140 }} />
              </Descriptions.Item>
              <Descriptions.Item label="检测时间">
                <span className="font-mono text-xs">{formatDateTime(selectedAnomaly.timestamp)}</span>
              </Descriptions.Item>
            </Descriptions>

            {selectedAnomaly.root_cause && (
              <div
                className="p-3 rounded-lg text-sm"
                style={{
                  backgroundColor: isDark ? 'rgba(16,185,129,0.1)' : 'rgba(16,185,129,0.05)',
                  border: `1px solid ${isDark ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.15)'}`,
                  color: COLORS.success,
                }}
              >
                <div className="text-xs font-medium mb-1 opacity-70">处置建议</div>
                {selectedAnomaly.root_cause}
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default AnomalyDetection;
