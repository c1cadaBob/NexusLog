import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Statistic, Select, Button, Row, Col, Table, Tag, Progress, Tooltip, Empty, message } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useThemeStore } from '../stores/themeStore';
import { usePreferencesStore } from '../stores/preferencesStore';
import { useAuthStore } from '../stores/authStore';
import { COLORS } from '../theme/tokens';
import type { KpiData, ServiceStatus } from '../types/dashboard';
import { resolveDashboardQuickActionAccess } from './dashboardAuthorization';
import ChartWrapper from '../components/charts/ChartWrapper';
import type { EChartsCoreOption } from 'echarts/core';
import { fetchDashboardOverview, type DashboardOverviewRange, type DashboardOverviewStats } from '../api/query';
import { fetchAuditLogs, type AuditLogItem } from '../api/audit';
import { fetchMetricsOverview, type MetricsOverviewData } from '../api/metrics';
import { fetchBffOverview, type BffOverviewResponse, type BffServiceProbe } from '../api/bff';
import { persistPendingRealtimeStartupQuery } from './search/realtimeStartupQuery';
import { buildRealtimePresetQuery } from './search/realtimePresetQuery';

interface DashboardTrendPoint {
  time: string;
  count: number;
}

interface DashboardAuditRecord {
  time: string;
  user: string;
  action: string;
  target: string;
  type: 'update' | 'create' | 'delete';
}

interface DashboardRealtimeTimeRange {
  from: string;
  to: string;
}

interface PlatformHealthServiceItem {
  key: string;
  label: string;
  probe: BffServiceProbe;
  reconcilerState?: string | null;
}

function getHealthStatusTagColor(status: string): 'success' | 'error' | 'warning' | 'processing' | 'default' {
  if (status === 'healthy') return 'success';
  if (status === 'degraded' || status === 'unhealthy' || status === 'unreachable') return 'error';
  if (status === 'unknown') return 'default';
  return 'processing';
}

function getHealthStatusLabel(status: string): string {
  if (status === 'healthy') return '健康';
  if (status === 'degraded') return '降级';
  if (status === 'unhealthy') return '异常';
  if (status === 'unreachable') return '不可达';
  if (status === 'unknown') return '未知';
  return status || '未知';
}

function extractReconcilerState(details?: string): string | null {
  if (!details) return null;
  const match = details.match(/reconciler:([^\s]+)/i);
  return match?.[1] ?? null;
}

function formatHealthLatency(latencyMs?: number): string {
  if (typeof latencyMs !== 'number' || Number.isNaN(latencyMs)) return '—';
  return `${latencyMs} ms`;
}

function formatCompactPercent(value: number): string {
  if (!Number.isFinite(value)) return '0%';
  return `${Number(value.toFixed(2))}%`;
}

function formatCompactCount(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}k`;
  }
  return `${value}`;
}

function formatOverviewRangeLabel(range: DashboardOverviewRange): string {
  return range === '7d' ? '近 7 天' : '近 24 小时';
}

function toDisplayTrendTime(value: string, range: DashboardOverviewRange = '24h'): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  if (range === '7d') {
    return parsed.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
  }
  return parsed.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function buildTrendData(overview: DashboardOverviewStats | null, range: DashboardOverviewRange): DashboardTrendPoint[] {
  if (!overview?.log_trend?.length) {
    return [];
  }
  return overview.log_trend.map((item) => ({
    time: toDisplayTrendTime(item.time, range),
    count: Number(item.count) || 0,
  }));
}

function clampMetricPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, value));
}

function formatMetricPercent(value: number): string {
  return `${clampMetricPercent(value).toFixed(1)}%`;
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let nextValue = value;
  let unitIndex = 0;
  while (nextValue >= 1024 && unitIndex < units.length - 1) {
    nextValue /= 1024;
    unitIndex += 1;
  }
  const digits = nextValue >= 100 || unitIndex === 0 ? 0 : nextValue >= 10 ? 1 : 2;
  return `${nextValue.toFixed(digits)} ${units[unitIndex]}`;
}

function formatTimeAgo(value: string): string {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return value;
  }

  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return `${seconds}秒前`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return `${days}天前`;
}

function formatMonitorTimestamp(value: string | undefined): string {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) {
    return '暂无数据';
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return trimmed;
  }

  return parsed.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function inferAuditType(value: string): DashboardAuditRecord['type'] {
  const normalized = value.trim().toLowerCase();
  if (/(create|add|insert|invite|grant|assign|enable|bind)/.test(normalized)) {
    return 'create';
  }
  if (/(delete|remove|drop|revoke|disable|unbind)/.test(normalized)) {
    return 'delete';
  }
  return 'update';
}

function formatAuditActionText(item: AuditLogItem): string {
  const detailOperation = typeof item.detail?.operation === 'string' ? item.detail.operation : '';
  const normalized = `${item.action || ''} ${detailOperation}`.trim().toLowerCase();

  if (/(create|add|insert|invite)/.test(normalized)) return '创建了';
  if (/(delete|remove|drop)/.test(normalized)) return '删除了';
  if (/(grant|assign|bind)/.test(normalized)) return '授权了';
  if (/(revoke|unbind)/.test(normalized)) return '回收了';
  if (/(login|signin)/.test(normalized)) return '登录了';
  if (/(logout|signout)/.test(normalized)) return '退出了';
  if (/(reset.*password|password.*reset)/.test(normalized)) return '重置了密码';
  return '更新了';
}

function formatAuditTarget(item: AuditLogItem): string {
  const parts = [item.resource_type, item.resource_id]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : '系统对象';
}

function mapAuditLogsForDashboard(items: AuditLogItem[]): DashboardAuditRecord[] {
  return items.slice(0, 5).map((item) => {
    const detailOperation = typeof item.detail?.operation === 'string' ? item.detail.operation : '';
    const normalizedAction = `${item.action || ''} ${detailOperation}`.trim();
    return {
      time: formatTimeAgo(item.created_at),
      user: item.user_id?.trim() || '系统',
      action: formatAuditActionText(item),
      target: formatAuditTarget(item),
      type: inferAuditType(normalizedAction),
    };
  });
}
function normalizeIdentityValue(value: string | undefined, fallback: string): string {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed || trimmed.toLowerCase() === 'unknown') {
    return fallback;
  }
  return trimmed;
}

function formatTopSourceLabel(topSource: DashboardOverviewStats['top_sources'][number] | undefined): string {
  if (!topSource) {
    return '等待数据';
  }

  const host = normalizeIdentityValue(topSource.host, '');
  const service = normalizeIdentityValue(topSource.service, '');
  if (host && service) {
    return `Top ${host} · ${service}`;
  }
  if (host) {
    return `Top 主机 ${host}`;
  }
  if (service) {
    return `Top 服务 ${service}`;
  }
  return topSource.source?.trim() ? `Top ${topSource.source}` : '等待数据';
}

function buildSourceRows(overview: DashboardOverviewStats | null): ServiceStatus[] {
  const sources = overview?.top_sources ?? [];
  const maxCount = Math.max(...sources.map((item) => Number(item.count) || 0), 0);
  return sources.slice(0, 5).map((item) => {
    const count = Number(item.count) || 0;
    const ratio = maxCount > 0 ? count / maxCount : 0;
    const host = normalizeIdentityValue(item.host, '未知主机');
    const service = normalizeIdentityValue(item.service, '未知服务');
    return {
      name: `${host} · ${service}`,
      source: item.source || `${host} / ${service}`,
      host,
      service,
      errorRate: count,
      status: ratio >= 0.75 ? 'critical' : ratio >= 0.35 ? 'warning' : 'healthy',
    };
  });
}

function buildSourcePresetQuery(row: Pick<ServiceStatus, 'host' | 'service' | 'name'>): string {
  const host = normalizeIdentityValue(row.host, '');
  const service = normalizeIdentityValue(row.service, '');
  const filters: Record<string, string> = {};

  if (host) {
    filters.host = host;
  }
  if (service) {
    filters.service = service;
  }

  return buildRealtimePresetQuery({
    queryText: '',
    filters,
  }) || row.name;
}

function buildRealtimeTimeRangeForOverviewRange(overviewRange: DashboardOverviewRange): DashboardRealtimeTimeRange {
  const to = new Date();
  const from = new Date(to.getTime() - (overviewRange === '7d' ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000));
  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
}

function buildKpiData(overview: DashboardOverviewStats | null, overviewRange: DashboardOverviewRange): KpiData[] {
  const levelDistribution = overview?.level_distribution ?? {};
  const totalLogs = Number(overview?.total_logs) || 0;
  const errorLogs = Number(levelDistribution.error) || 0;
  const fatalLogs = Number(levelDistribution.fatal) || 0;
  const warnLogs = Number(levelDistribution.warn) || 0;
  const infoLogs = Number(levelDistribution.info) || 0;
  const debugLogs = Number(levelDistribution.debug) || 0;
  const totalLevelLogs = errorLogs + fatalLogs + warnLogs + infoLogs + debugLogs;
  const errorRate = totalLevelLogs > 0 ? ((errorLogs + fatalLogs) / totalLevelLogs) * 100 : 0;
  const topSource = overview?.top_sources?.[0];
  const alertSummary = overview?.alert_summary ?? { total: 0, firing: 0, resolved: 0 };

  const overviewRangeLabel = formatOverviewRangeLabel(overviewRange);

  return [
    {
      title: '总日志量',
      value: formatCompactCount(totalLogs),
      trend: overviewRangeLabel,
      trendType: 'neutral',
      trendLabel: formatTopSourceLabel(topSource),
      icon: 'data_usage',
      color: 'primary',
    },
    {
      title: '错误率',
      value: `${errorRate.toFixed(2)}%`,
      trend: `${formatCompactCount(errorLogs + fatalLogs)} 条`,
      trendType: errorRate >= 5 ? 'up' : 'neutral',
      trendLabel: 'error + fatal',
      icon: 'error',
      color: 'danger',
    },
    {
      title: '告警中',
      value: `${alertSummary.firing}`,
      trend: `总计 ${alertSummary.total}`,
      trendType: alertSummary.firing > 0 ? 'up' : 'neutral',
      trendLabel: overviewRangeLabel,
      icon: 'notifications_active',
      color: 'warning',
    },
    {
      title: '已解决告警',
      value: `${alertSummary.resolved}`,
      trend: `${formatCompactCount(warnLogs)} warn`,
      trendType: 'neutral',
      trendLabel: overviewRangeLabel,
      icon: 'task_alt',
      color: 'success',
    },
    {
      title: '活跃来源',
      value: `${overview?.top_sources?.length ?? 0}`,
      trend: topSource ? formatCompactCount(Number(topSource.count) || 0) : '0',
      trendType: 'neutral',
      trendLabel: formatTopSourceLabel(topSource),
      icon: 'dns',
      color: 'info',
    },
    {
      title: '级别覆盖',
      value: `${Object.values(levelDistribution).filter((count) => Number(count) > 0).length}/5`,
      trend: `${formatCompactCount(debugLogs + infoLogs)} 低风险`,
      trendType: 'neutral',
      trendLabel: 'debug + info',
      icon: 'monitoring',
      color: 'success',
    },
  ];
}

/** 刷新间隔选项 */
const OVERVIEW_RANGE_OPTIONS: Array<{ label: string; value: DashboardOverviewRange }> = [
  { label: '最近 24 小时', value: '24h' },
  { label: '最近 7 天', value: '7d' },
];

const REFRESH_INTERVAL_OPTIONS = [
  { label: '实时', value: 1000 },
  { label: '3秒', value: 3000 },
  { label: '5秒', value: 5000 },
  { label: '10秒', value: 10000 },
  { label: '30秒', value: 30000 },
  { label: '1分钟', value: 60000 },
  { label: '5分钟', value: 300000 },
  { label: '关闭', value: 0 },
];

/** 颜色映射 */
const COLOR_MAP: Record<string, string> = {
  primary: COLORS.primary,
  success: COLORS.success,
  warning: COLORS.warning,
  danger: COLORS.danger,
  info: COLORS.info,
};

// ============================================================================
// 刷新控制栏
// ============================================================================
const RefreshControls: React.FC<{
  lastUpdated: number;
  wsConnected: boolean;
  countdown: number;
  refreshInterval: number;
  overviewRange: DashboardOverviewRange;
  isLoading: boolean;
  onRefresh: () => void;
  onIntervalChange: (v: number) => void;
  onOverviewRangeChange: (value: DashboardOverviewRange) => void;
}> = React.memo(({
  lastUpdated,
  wsConnected,
  countdown,
  refreshInterval,
  overviewRange,
  isLoading,
  onRefresh,
  onIntervalChange,
  onOverviewRangeChange,
}) => {
  const formatted = useMemo(
    () => new Date(lastUpdated).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    [lastUpdated],
  );

  return (
    <div className="flex items-center justify-between flex-wrap gap-2">
      <div className="flex items-center gap-3">
        <span className="text-xs opacity-60">最后更新: {formatted}</span>
        {wsConnected && (
          <span className="flex items-center gap-1 text-xs" style={{ color: COLORS.success }}>
            <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: COLORS.success }} />
            实时连接
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 flex-wrap justify-end">
        {refreshInterval > 1000 && countdown > 0 && (
          <span className="text-xs opacity-60">{countdown}s 后刷新</span>
        )}
        <Select<DashboardOverviewRange>
          size="small"
          value={overviewRange}
          onChange={onOverviewRangeChange}
          options={OVERVIEW_RANGE_OPTIONS}
          style={{ width: 120 }}
        />
        <Select
          size="small"
          value={refreshInterval}
          onChange={onIntervalChange}
          options={REFRESH_INTERVAL_OPTIONS}
          style={{ width: 100 }}
        />
        <Button size="small" icon={<ReloadOutlined spin={isLoading} />} onClick={onRefresh} disabled={isLoading}>
          刷新
        </Button>
      </div>
    </div>
  );
});
RefreshControls.displayName = 'RefreshControls';

// ============================================================================
// KPI 卡片
// ============================================================================
const KpiCard: React.FC<{ data: KpiData }> = React.memo(({ data }) => {
  const isDark = useThemeStore((s) => s.isDark);
  const isStorage = data.icon === 'hard_drive';

  return (
    <Card
      size="small"
      hoverable
      styles={{ body: { padding: '16px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
      style={{ height: '100%' }}
    >
      <div className="flex justify-between items-start mb-1">
        <span className="text-xs opacity-60">{data.title}</span>
        <span
          className="material-symbols-outlined text-[18px]"
          style={{ color: COLOR_MAP[data.color] || COLORS.primary, opacity: 0.7 }}
        >
          {data.icon}
        </span>
      </div>
      <Statistic
        value={data.value}
        valueStyle={{ fontSize: 20, fontWeight: 700, lineHeight: 1.3 }}
      />
      {isStorage ? (
        <>
          <div className="mt-2 flex gap-0 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: isDark ? '#334155' : '#e2e8f0' }}>
            <div className="h-full bg-red-500" style={{ width: '20%' }} />
            <div className="h-full bg-orange-400" style={{ width: '30%' }} />
            <div className="h-full" style={{ width: '18%', backgroundColor: COLORS.info }} />
          </div>
          <div className="mt-1 flex justify-between text-[8px] opacity-50">
            <span>热</span><span>温</span><span>冷</span>
          </div>
        </>
      ) : (
        <div className="mt-2 flex items-center gap-1">
          <Tag
            color={data.trendType === 'up' ? 'success' : data.trendType === 'down' ? 'error' : 'success'}
            style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', margin: 0 }}
          >
            {data.trend}
          </Tag>
          <span className="min-w-0 flex-1 truncate text-[10px] opacity-50">{data.trendLabel}</span>
        </div>
      )}
    </Card>
  );
});
KpiCard.displayName = 'KpiCard';

// ============================================================================
// 基础设施监控
// ============================================================================
const InfrastructureMonitor: React.FC<{ data: MetricsOverviewData | null; isLoading: boolean }> = React.memo(({ data, isLoading }) => {
  const isDark = useThemeStore((s) => s.isDark);
  const panelBg = isDark ? '#0f172a' : '#f8fafc';
  const borderColor = isDark ? '#334155' : '#e2e8f0';
  const progressTrail = isDark ? '#1e293b' : '#e2e8f0';
  const trendPoints = data?.trend ?? [];
  const latestSnapshots = data?.snapshots ?? [];

  const utilizationItems = [
    {
      key: 'cpu',
      label: '平均 CPU 使用率',
      value: data?.avg_cpu_usage_pct ?? 0,
      color: COLORS.info,
      hint: `${data?.active_agents ?? 0} 个节点最新快照`,
    },
    {
      key: 'memory',
      label: '平均内存使用率',
      value: data?.avg_memory_usage_pct ?? 0,
      color: COLORS.warning,
      hint: `最近上报 ${formatMonitorTimestamp(data?.latest_collected_at)}`,
    },
    {
      key: 'disk',
      label: '平均磁盘使用率',
      value: data?.avg_disk_usage_pct ?? 0,
      color: COLORS.success,
      hint: `累计读 ${formatBytes(data?.total_disk_io_read_bytes ?? 0)} · 写 ${formatBytes(data?.total_disk_io_write_bytes ?? 0)}`,
    },
  ];

  const bandwidthOption: EChartsCoreOption = useMemo(() => ({
    grid: { top: 8, right: 0, bottom: 0, left: 0 },
    xAxis: { type: 'category', show: false, data: trendPoints.map((point) => toDisplayTrendTime(point.timestamp)) },
    yAxis: { type: 'value', show: false },
    series: [
      {
        type: 'line',
        data: trendPoints.map((point) => point.net_in_delta_bytes),
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 2, color: COLORS.info },
        itemStyle: { color: COLORS.info },
        areaStyle: { color: `${COLORS.info}22` },
      },
      {
        type: 'line',
        data: trendPoints.map((point) => point.net_out_delta_bytes),
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 2, color: COLORS.success },
        itemStyle: { color: COLORS.success },
        areaStyle: { color: `${COLORS.success}22` },
      },
    ],
    tooltip: { trigger: 'axis' },
  }), [trendPoints]);

  return (
    <Card loading={isLoading && !data} styles={{ body: { padding: '20px' } }}>
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: 'rgba(99,102,241,0.2)', color: '#818cf8' }}>
            <span className="material-symbols-outlined text-lg">dns</span>
          </div>
          <div>
            <div className="text-sm font-bold">系统基础设施监控</div>
            <div className="text-[10px] opacity-50 uppercase">Infrastructure Metrics Overview</div>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Tag color={(data?.active_agents ?? 0) > 0 ? 'success' : undefined} style={{ fontSize: 10 }}>
            {(data?.active_agents ?? 0) > 0 ? `${data?.active_agents ?? 0} 个节点在线` : '暂无节点数据'}
          </Tag>
          <Tag style={{ fontSize: 10 }}>最近上报 {formatMonitorTimestamp(data?.latest_collected_at)}</Tag>
        </div>
      </div>

      <Row gutter={[16, 16]} align="stretch">
        {utilizationItems.map((item) => {
          const riskColor = item.value >= 80 ? 'error' : item.value >= 60 ? 'warning' : 'success';
          return (
            <Col key={item.key} xs={24} md={12} lg={6}>
              <div className="h-full rounded-xl border p-4" style={{ backgroundColor: panelBg, borderColor }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs opacity-60">{item.label}</div>
                    <div className="text-2xl font-bold mt-1">{formatMetricPercent(item.value)}</div>
                  </div>
                  <Tag color={riskColor} style={{ margin: 0, fontSize: 10 }}>
                    {item.value >= 80 ? '高' : item.value >= 60 ? '中' : '低'}
                  </Tag>
                </div>
                <Progress
                  percent={clampMetricPercent(item.value)}
                  showInfo={false}
                  strokeColor={item.color}
                  trailColor={progressTrail}
                  style={{ margin: '12px 0 8px' }}
                />
                <div className="text-[10px] opacity-50">{item.hint}</div>
              </div>
            </Col>
          );
        })}

        <Col xs={24} md={12} lg={6}>
          <div className="h-full rounded-xl border p-4 flex flex-col" style={{ backgroundColor: panelBg, borderColor }}>
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs opacity-60 font-medium">近窗口网络流量</span>
              <div className="flex gap-2 text-[10px]">
                <span className="flex items-center gap-1" style={{ color: COLORS.info }}>
                  <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS.info }} /> 入站
                </span>
                <span className="flex items-center gap-1" style={{ color: COLORS.success }}>
                  <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS.success }} /> 出站
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] mb-3">
              <div className="rounded-lg p-2" style={{ backgroundColor: isDark ? '#111827' : '#ffffff' }}>
                <div className="opacity-50 mb-1">最近窗口入站</div>
                <div className="font-bold">{formatBytes(data?.latest_net_in_delta_bytes ?? 0)}</div>
              </div>
              <div className="rounded-lg p-2" style={{ backgroundColor: isDark ? '#111827' : '#ffffff' }}>
                <div className="opacity-50 mb-1">最近窗口出站</div>
                <div className="font-bold">{formatBytes(data?.latest_net_out_delta_bytes ?? 0)}</div>
              </div>
              <div className="rounded-lg p-2" style={{ backgroundColor: isDark ? '#111827' : '#ffffff' }}>
                <div className="opacity-50 mb-1">累计入站</div>
                <div className="font-bold">{formatBytes(data?.total_net_in_bytes ?? 0)}</div>
              </div>
              <div className="rounded-lg p-2" style={{ backgroundColor: isDark ? '#111827' : '#ffffff' }}>
                <div className="opacity-50 mb-1">累计出站</div>
                <div className="font-bold">{formatBytes(data?.total_net_out_bytes ?? 0)}</div>
              </div>
            </div>
            <div className="flex-1 min-h-[96px]">
              {trendPoints.length > 0 ? (
                <ChartWrapper option={bandwidthOption} height={96} />
              ) : (
                <div className="h-24 flex items-center justify-center text-xs opacity-50">
                  当前范围内暂无网络趋势数据
                </div>
              )}
            </div>
          </div>
        </Col>
      </Row>

      <div className="mt-5">
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <div className="text-xs font-medium opacity-60">最近节点快照</div>
          <div className="text-[10px] opacity-50">
            {latestSnapshots.length > 0 ? `展示 ${latestSnapshots.length} 条最新上报` : '当前租户暂无可展示的主机指标数据'}
          </div>
        </div>

        {latestSnapshots.length > 0 ? (
          <Row gutter={[12, 12]}>
            {latestSnapshots.map((snapshot) => (
              <Col key={`${snapshot.agent_id}-${snapshot.server_id}`} xs={24} xl={12}>
                <div className="rounded-xl border p-3" style={{ backgroundColor: panelBg, borderColor }}>
                  <div className="grid min-w-0 grid-cols-2 gap-3">
                    <div className="min-w-0">
                      <div className="text-[11px] opacity-45">主机名</div>
                      <div className="truncate font-medium">{snapshot.server_id || '未知主机'}</div>
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] opacity-45">Agent</div>
                      <div className="truncate font-medium">{snapshot.agent_id || '未知 Agent'}</div>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <div className="rounded-lg px-2 py-1.5 text-center" style={{ backgroundColor: isDark ? '#111827' : '#ffffff' }}>
                      <div className="text-[10px] opacity-50">CPU</div>
                      <div className="text-xs font-bold">{formatMetricPercent(snapshot.cpu_usage_pct)}</div>
                    </div>
                    <div className="rounded-lg px-2 py-1.5 text-center" style={{ backgroundColor: isDark ? '#111827' : '#ffffff' }}>
                      <div className="text-[10px] opacity-50">内存</div>
                      <div className="text-xs font-bold">{formatMetricPercent(snapshot.memory_usage_pct)}</div>
                    </div>
                    <div className="rounded-lg px-2 py-1.5 text-center" style={{ backgroundColor: isDark ? '#111827' : '#ffffff' }}>
                      <div className="text-[10px] opacity-50">磁盘</div>
                      <div className="text-xs font-bold">{formatMetricPercent(snapshot.disk_usage_pct)}</div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[10px] opacity-50 gap-3">
                    <span className="truncate">入站 {formatBytes(snapshot.net_in_bytes)} · 出站 {formatBytes(snapshot.net_out_bytes)}</span>
                    <span className="shrink-0">{formatTimeAgo(snapshot.collected_at)}</span>
                  </div>
                </div>
              </Col>
            ))}
          </Row>
        ) : (
          <div className="rounded-xl border border-dashed p-4 text-xs opacity-50" style={{ borderColor }}>
            当前租户暂无可展示的主机指标数据
          </div>
        )}
      </div>
    </Card>
  );
});
InfrastructureMonitor.displayName = 'InfrastructureMonitor';

const PlatformHealthOverview: React.FC<{
  data: BffOverviewResponse | null;
  isLoading: boolean;
  staleError: string | null;
  onOpenDetail: () => void;
}> = React.memo(({ data, isLoading, staleError, onOpenDetail }) => {
  const isDark = useThemeStore((s) => s.isDark);
  const panelBg = isDark ? '#0f172a' : '#f8fafc';
  const borderColor = isDark ? '#334155' : '#e2e8f0';

  const serviceItems = useMemo<PlatformHealthServiceItem[]>(() => {
    if (!data) return [];
    return [
      {
        key: 'controlPlane',
        label: '控制面服务',
        probe: data.services.controlPlane,
        reconcilerState: extractReconcilerState(data.services.controlPlane.details),
      },
      {
        key: 'apiService',
        label: '业务 API',
        probe: data.services.apiService,
      },
      {
        key: 'queryApi',
        label: '查询服务',
        probe: data.services.dataServices.queryApi,
      },
      {
        key: 'auditApi',
        label: '审计服务',
        probe: data.services.dataServices.auditApi,
      },
      {
        key: 'exportApi',
        label: '导出服务',
        probe: data.services.dataServices.exportApi,
      },
    ];
  }, [data]);

  return (
    <Card
      className="w-full"
      title={<span className="text-sm font-bold">平台健康总览</span>}
      extra={
        <Button type="link" size="small" onClick={onOpenDetail}>
          查看健康页
        </Button>
      }
      loading={isLoading && !data}
    >
      {!data ? (
        <Empty description="暂无平台健康数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-wrap gap-3">
              <div className="min-w-[120px] rounded-xl border px-4 py-3" style={{ backgroundColor: panelBg, borderColor }}>
                <div className="text-[11px] opacity-60">服务总数</div>
                <div className="mt-1 text-xl font-semibold">{data.summary.total}</div>
              </div>
              <div className="min-w-[120px] rounded-xl border px-4 py-3" style={{ backgroundColor: panelBg, borderColor }}>
                <div className="text-[11px] opacity-60">健康服务</div>
                <div className="mt-1 text-xl font-semibold" style={{ color: COLORS.success }}>{data.summary.healthy}</div>
              </div>
              <div className="min-w-[120px] rounded-xl border px-4 py-3" style={{ backgroundColor: panelBg, borderColor }}>
                <div className="text-[11px] opacity-60">异常服务</div>
                <div className="mt-1 text-xl font-semibold" style={{ color: data.summary.degraded > 0 ? COLORS.danger : COLORS.success }}>{data.summary.degraded}</div>
              </div>
              <div className="min-w-[120px] rounded-xl border px-4 py-3" style={{ backgroundColor: panelBg, borderColor }}>
                <div className="text-[11px] opacity-60">可用率</div>
                <div className="mt-1 text-xl font-semibold">{formatCompactPercent(data.summary.availabilityRate)}</div>
              </div>
            </div>
            <div className="text-right text-[11px] opacity-60">
              <div>生成时间：{formatMonitorTimestamp(data.generatedAt)}</div>
              <div>缓存：{data.cache.hit ? '命中缓存' : '实时刷新'} / TTL {data.cache.ttlMs} ms</div>
            </div>
          </div>

          {staleError ? <Tag color="warning" style={{ width: 'fit-content', margin: 0 }}>最近一次刷新失败，当前展示上次成功结果：{staleError}</Tag> : null}

          <Row gutter={[12, 12]}>
            {serviceItems.map((item) => (
              <Col key={item.key} xs={24} md={12} xl={8} xxl={4}>
                <div className="h-full rounded-xl border p-3" style={{ backgroundColor: panelBg, borderColor }}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold">{item.label}</div>
                      <div className="mt-1 text-[11px] opacity-60 break-all">{item.probe.upstream}</div>
                    </div>
                    <div className="flex flex-wrap justify-end gap-1">
                      <Tag color={getHealthStatusTagColor(item.probe.status)} style={{ margin: 0 }}>
                        {getHealthStatusLabel(item.probe.status)}
                      </Tag>
                      {item.reconcilerState ? (
                        <Tag color={getHealthStatusTagColor(item.reconcilerState)} style={{ margin: 0 }}>
                          ES 对账 {getHealthStatusLabel(item.reconcilerState)}
                        </Tag>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="opacity-60">HTTP {item.probe.statusCode || '—'}</span>
                    <span className="font-medium">{formatHealthLatency(item.probe.latencyMs)}</span>
                  </div>
                  <div className="mt-2 text-[11px] opacity-60 break-all">{item.probe.details || '—'}</div>
                </div>
              </Col>
            ))}
          </Row>
        </div>
      )}
    </Card>
  );
});
PlatformHealthOverview.displayName = 'PlatformHealthOverview';

// ============================================================================
// Dashboard 主组件
// ============================================================================
const AUTHZ_LOADING_TOOLTIP = '权限信息加载中';

function getDashboardEntryCardStyle(allowed: boolean) {
  return {
    opacity: allowed ? 1 : 0.5,
    cursor: allowed ? 'pointer' : 'not-allowed',
  } as const;
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const isDark = useThemeStore((s) => s.isDark);
  const permissions = useAuthStore((s) => s.permissions);
  const capabilities = useAuthStore((s) => s.capabilities);
  const authzReady = useAuthStore((s) => s.authzReady);

  const [overview, setOverview] = useState<DashboardOverviewStats | null>(null);
  const [overviewRange, setOverviewRange] = useState<DashboardOverviewRange>('24h');
  const [metricsOverview, setMetricsOverview] = useState<MetricsOverviewData | null>(null);
  const [platformHealth, setPlatformHealth] = useState<BffOverviewResponse | null>(null);
  const [platformHealthError, setPlatformHealthError] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<DashboardAuditRecord[]>([]);
  const [lastUpdated, setLastUpdated] = useState(Date.now());
  const storedRefreshInterval = usePreferencesStore((s) => s.refreshInterval);
  const setStoredRefreshInterval = usePreferencesStore((s) => s.setRefreshInterval);
  const [refreshInterval, setRefreshIntervalLocal] = useState(storedRefreshInterval > 0 ? storedRefreshInterval * 1000 : 0);
  const [countdown, setCountdown] = useState(storedRefreshInterval);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initialRefreshCompletedRef = useRef(false);
  const refreshRequestRef = useRef<Promise<void> | null>(null);

  const clearRefreshTimers = useCallback(() => {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }, []);

  const kpiData = useMemo(() => buildKpiData(overview, overviewRange), [overview, overviewRange]);
  const serviceData = useMemo(() => buildSourceRows(overview), [overview]);
  const trendData = useMemo(() => buildTrendData(overview, overviewRange), [overview, overviewRange]);

  const doRefresh = useCallback(async (silent: boolean, nextOverviewRange = overviewRange) => {
    if (refreshRequestRef.current) {
      return refreshRequestRef.current;
    }

    setIsLoading(true);
    const refreshRequest = (async () => {
      try {
        const [overviewResult, metricsOverviewResult, platformHealthResult, auditLogsResult] = await Promise.allSettled([
          fetchDashboardOverview(nextOverviewRange),
          fetchMetricsOverview('24h', 4),
          fetchBffOverview(),
          fetchAuditLogs({ page: 1, page_size: 5 }),
        ]);

        const errors: string[] = [];
        let hasSuccessfulUpdate = false;

        if (overviewResult.status === 'fulfilled') {
          setOverview(overviewResult.value);
          hasSuccessfulUpdate = true;
        } else {
          errors.push(`日志概览：${overviewResult.reason instanceof Error ? overviewResult.reason.message : '加载失败'}`);
        }

        if (metricsOverviewResult.status === 'fulfilled') {
          setMetricsOverview(metricsOverviewResult.value.data);
          hasSuccessfulUpdate = true;
        } else {
          errors.push(`基础设施监控：${metricsOverviewResult.reason instanceof Error ? metricsOverviewResult.reason.message : '加载失败'}`);
        }

        if (platformHealthResult.status === 'fulfilled') {
          setPlatformHealth(platformHealthResult.value);
          setPlatformHealthError(null);
          hasSuccessfulUpdate = true;
        } else {
          const nextPlatformHealthError = platformHealthResult.reason instanceof Error ? platformHealthResult.reason.message : '加载失败';
          setPlatformHealthError(nextPlatformHealthError);
          errors.push(`平台健康：${nextPlatformHealthError}`);
        }

        if (auditLogsResult.status === 'fulfilled') {
          setAuditLogs(mapAuditLogsForDashboard(auditLogsResult.value.items));
          hasSuccessfulUpdate = true;
        } else {
          errors.push(`审计活动：${auditLogsResult.reason instanceof Error ? auditLogsResult.reason.message : '加载失败'}`);
        }

        if (hasSuccessfulUpdate) {
          setLastUpdated(Date.now());
        }

        const nextLoadError = errors.length > 0 ? errors.join('；') : null;
        setLoadError(nextLoadError);
        if (nextLoadError && !silent) {
          message.error(nextLoadError);
        }
      } finally {
        refreshRequestRef.current = null;
        setIsLoading(false);
      }
    })();

    refreshRequestRef.current = refreshRequest;
    return refreshRequest;
  }, [overviewRange]);

  const handleRefresh = useCallback(() => {
    void doRefresh(false);
    if (refreshInterval > 0) {
      setCountdown(refreshInterval / 1000);
    }
  }, [doRefresh, refreshInterval]);

  const handleOverviewRangeChange = useCallback((value: DashboardOverviewRange) => {
    setOverviewRange(value);
    void doRefresh(true, value);
  }, [doRefresh]);

  const handleIntervalChange = useCallback((val: number) => {
    setRefreshIntervalLocal(val);
    setStoredRefreshInterval(val === 0 ? 0 : val / 1000);
    if (val > 0) {
      setCountdown(val / 1000);
    } else {
      setCountdown(0);
    }
  }, [setStoredRefreshInterval]);

  const startRefreshTimers = useCallback(() => {
    clearRefreshTimers();

    if (refreshInterval <= 0 || document.hidden) {
      return;
    }

    setCountdown(refreshInterval / 1000);
    refreshTimerRef.current = setInterval(() => {
      void doRefresh(true);
      setCountdown(refreshInterval / 1000);
    }, refreshInterval);
    countdownTimerRef.current = setInterval(() => {
      setCountdown((p) => (p > 0 ? p - 1 : refreshInterval / 1000));
    }, 1000);
  }, [clearRefreshTimers, doRefresh, refreshInterval]);

  useEffect(() => {
    if (initialRefreshCompletedRef.current) {
      return;
    }
    initialRefreshCompletedRef.current = true;
    void doRefresh(true);
  }, [doRefresh]);

  useEffect(() => {
    startRefreshTimers();
    return clearRefreshTimers;
  }, [clearRefreshTimers, startRefreshTimers]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        clearRefreshTimers();
        return;
      }
      if (refreshInterval > 0) {
        void doRefresh(true);
        startRefreshTimers();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [clearRefreshTimers, doRefresh, refreshInterval, startRefreshTimers]);

  const dashboardEntryAccess = useMemo(() => {
    if (!authzReady) {
      const pendingAccess = {
        allowed: false,
        deniedTooltip: AUTHZ_LOADING_TOOLTIP,
      };

      return {
        realtimeSearch: pendingAccess,
        alertsList: pendingAccess,
        ingestSourceCreate: pendingAccess,
        alertRuleCreate: pendingAccess,
        storageIndexCreate: pendingAccess,
        reportGenerate: pendingAccess,
        auditLogs: pendingAccess,
      };
    }

    return resolveDashboardQuickActionAccess({ permissions, capabilities });
  }, [authzReady, capabilities, permissions]);

  const handleProtectedNavigate = useCallback((path: string, allowed: boolean, deniedTooltip?: string) => {
    if (!allowed) {
      message.warning(deniedTooltip ?? '当前会话缺少访问权限');
      return;
    }

    navigate(path);
  }, [navigate]);

  const handleRealtimeSearchNavigate = useCallback((presetQuery: string, timeRange?: DashboardRealtimeTimeRange) => {
    if (!dashboardEntryAccess.realtimeSearch.allowed) {
      message.warning(dashboardEntryAccess.realtimeSearch.deniedTooltip ?? '当前会话缺少日志查询权限');
      return;
    }

    persistPendingRealtimeStartupQuery(presetQuery);
    navigate('/search/realtime', { state: { autoRun: true, presetQuery, timeRange } });
  }, [dashboardEntryAccess.realtimeSearch, navigate]);

  const serviceColumns: ColumnsType<ServiceStatus> = useMemo(() => [
    {
      title: '主机 / 服务',
      dataIndex: 'name',
      key: 'name',
      render: (_: string, row: ServiceStatus) => (
        <Tooltip title={row.source || undefined}>
          <div className="grid min-w-0 grid-cols-2 gap-3">
            <div className="min-w-0">
              <div className="text-[11px] opacity-45">主机名</div>
              <div className="truncate font-medium">{row.host || '未知主机'}</div>
            </div>
            <div className="min-w-0">
              <div className="text-[11px] opacity-45">服务名</div>
              <div className="truncate font-medium">{row.service || '未知服务'}</div>
            </div>
          </div>
        </Tooltip>
      ),
    },
    {
      title: overviewRange === '7d' ? '日志量 (7d)' : '日志量 (24h)', dataIndex: 'errorRate', key: 'errorRate',
      render: (value: number, row: ServiceStatus) => (
        <span style={{ color: row.status === 'critical' ? COLORS.danger : row.status === 'warning' ? COLORS.warning : COLORS.success, fontWeight: 700 }}>
          {value.toLocaleString()}
        </span>
      ),
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 60,
      render: (_: unknown, row: ServiceStatus) => (
        <span
          className="inline-block w-2 h-2 rounded-full"
          style={{ backgroundColor: row.status === 'critical' ? COLORS.danger : row.status === 'warning' ? COLORS.warning : COLORS.success }}
        />
      ),
    },
  ], [overviewRange]);

  const logTrendOption: EChartsCoreOption = useMemo(() => ({
    legend: { show: false },
    grid: { top: 10, right: 16, bottom: 24, left: 40 },
    xAxis: {
      type: 'category',
      data: trendData.map((point) => point.time),
      boundaryGap: false,
      axisLabel: {
        interval: Math.max(0, Math.floor(trendData.length / 6)),
      },
    },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' } } },
    series: [
      {
        name: 'Logs',
        type: 'line',
        data: trendData.map((point) => point.count),
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 1.5, color: COLORS.primary },
        itemStyle: { color: COLORS.primary },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: `${COLORS.primary}99` },
              { offset: 1, color: `${COLORS.primary}11` },
            ],
          },
        },
      },
    ],
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
    },
  }), [trendData, isDark]);

  // 审计操作类型配置
  const auditTypeConfig: Record<string, { icon: string; color: string }> = useMemo(() => ({
    update: { icon: 'edit', color: COLORS.info },
    create: { icon: 'add_circle', color: COLORS.success },
    delete: { icon: 'delete', color: COLORS.danger },
  }), []);

  return (
    <div className="flex flex-col gap-6">
      {/* 刷新控制栏 */}
      <RefreshControls
        lastUpdated={lastUpdated}
        wsConnected={false}
        countdown={countdown}
        refreshInterval={refreshInterval}
        overviewRange={overviewRange}
        isLoading={isLoading}
        onRefresh={handleRefresh}
        onIntervalChange={handleIntervalChange}
        onOverviewRangeChange={handleOverviewRangeChange}
      />
      {loadError && <Tag color="error" style={{ width: 'fit-content', margin: 0 }}>{loadError}</Tag>}

      {/* KPI 卡片网格: 2→3→6 列 */}
      <Row gutter={[16, 16]}>
        {kpiData.map((kpi, idx) => (
          <Col key={idx} xs={12} md={8} xl={4}>
            <KpiCard data={kpi} />
          </Col>
        ))}
      </Row>

      {/* 基础设施监控 */}
      <InfrastructureMonitor data={metricsOverview} isLoading={isLoading} />

      {/* 平台健康总览 */}
      <PlatformHealthOverview
        data={platformHealth}
        isLoading={isLoading}
        staleError={platformHealth && platformHealthError ? platformHealthError : null}
        onOpenDetail={() => navigate('/performance/health')}
      />

      {/* 图表 + 异常服务排行 */}
      <Row gutter={[24, 24]} align="stretch">
        <Col xs={24} lg={16} className="flex">
          <ChartWrapper
            title="日志量趋势"
            subtitle={`${formatOverviewRangeLabel(overviewRange)} ES 聚合结果`}
            option={logTrendOption}
            height="100%"
            fullHeight
            className="w-full"
            actions={
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-[10px] opacity-60">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: COLORS.primary }} /> Logs
                </span>
              </div>
            }
          />
        </Col>
        <Col xs={24} lg={8} className="flex">
          <Card
            title={<span className="text-sm font-bold">活跃主机 / 服务 Top 5</span>}
            extra={
              <Tooltip title={dashboardEntryAccess.alertsList.allowed ? undefined : dashboardEntryAccess.alertsList.deniedTooltip}>
                <Button
                  type="link"
                  size="small"
                  onClick={() => handleProtectedNavigate(
                    '/alerts/list',
                    dashboardEntryAccess.alertsList.allowed,
                    dashboardEntryAccess.alertsList.deniedTooltip,
                  )}
                  style={dashboardEntryAccess.alertsList.allowed ? undefined : { opacity: 0.5, cursor: 'not-allowed' }}
                >
                  查看更多
                </Button>
              </Tooltip>
            }
            className="h-full flex flex-col"
            styles={{ body: { padding: 0, flex: 1 } }}
          >
            <Table<ServiceStatus>
              dataSource={serviceData}
              columns={serviceColumns}
              pagination={false}
              size="small"
              rowKey={(record) => `${record.host || 'unknown-host'}::${record.service || 'unknown-service'}`}
              locale={{ emptyText: '暂无来源统计' }}
              onRow={(record) => ({
                onClick: () => handleRealtimeSearchNavigate(
                  buildSourcePresetQuery(record),
                  buildRealtimeTimeRangeForOverviewRange(overviewRange),
                ),
                style: {
                  cursor: dashboardEntryAccess.realtimeSearch.allowed ? 'pointer' : 'not-allowed',
                  opacity: dashboardEntryAccess.realtimeSearch.allowed ? 1 : 0.6,
                },
              })}
            />
          </Card>
        </Col>
      </Row>

      {/* 快速操作 + 审计日志 */}
      <Row gutter={[24, 24]} align="stretch">
        {/* 快速操作入口 */}
        <Col xs={24} lg={12} className="flex">
          <div className="flex h-full w-full flex-col gap-3">
            {/* 大按钮: 新建采集源 */}
            <Tooltip title={dashboardEntryAccess.ingestSourceCreate.allowed ? undefined : dashboardEntryAccess.ingestSourceCreate.deniedTooltip}>
              <Card
                hoverable={dashboardEntryAccess.ingestSourceCreate.allowed}
                styles={{ body: { padding: '16px' } }}
                onClick={() => handleProtectedNavigate(
                  '/ingestion/wizard',
                  dashboardEntryAccess.ingestSourceCreate.allowed,
                  dashboardEntryAccess.ingestSourceCreate.deniedTooltip,
                )}
                style={getDashboardEntryCardStyle(dashboardEntryAccess.ingestSourceCreate.allowed)}
              >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="h-8 w-8 rounded flex items-center justify-center"
                    style={{ backgroundColor: `${COLORS.primary}33`, color: COLORS.primary }}
                  >
                    <span className="material-symbols-outlined text-[18px]">add_to_queue</span>
                  </div>
                  <div>
                    <div className="text-sm font-bold">新建采集源</div>
                    <div className="text-[10px] opacity-50">配置 Agent 或 HTTP 接入</div>
                  </div>
                </div>
                <span className="material-symbols-outlined opacity-40">chevron_right</span>
              </div>
              </Card>
            </Tooltip>

            {/* 大按钮: 新建告警规则 */}
            <Tooltip title={dashboardEntryAccess.alertRuleCreate.allowed ? undefined : dashboardEntryAccess.alertRuleCreate.deniedTooltip}>
              <Card
                hoverable={dashboardEntryAccess.alertRuleCreate.allowed}
                styles={{ body: { padding: '16px' } }}
                onClick={() => handleProtectedNavigate(
                  '/alerts/rules',
                  dashboardEntryAccess.alertRuleCreate.allowed,
                  dashboardEntryAccess.alertRuleCreate.deniedTooltip,
                )}
                style={getDashboardEntryCardStyle(dashboardEntryAccess.alertRuleCreate.allowed)}
              >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="h-8 w-8 rounded flex items-center justify-center"
                    style={{ backgroundColor: 'rgba(139,92,246,0.2)', color: '#a78bfa' }}
                  >
                    <span className="material-symbols-outlined text-[18px]">notification_add</span>
                  </div>
                  <div>
                    <div className="text-sm font-bold">新建告警规则</div>
                    <div className="text-[10px] opacity-50">设置阈值和通知渠道</div>
                  </div>
                </div>
                <span className="material-symbols-outlined opacity-40">chevron_right</span>
              </div>
              </Card>
            </Tooltip>

            {/* 小按钮: 创建索引 + 生成报表 */}
            <Row gutter={12} className="mt-auto" align="stretch">
              <Col span={12} className="flex">
                <Tooltip title={dashboardEntryAccess.storageIndexCreate.allowed ? undefined : dashboardEntryAccess.storageIndexCreate.deniedTooltip}>
                  <Card
                    className="h-full w-full"
                    hoverable={dashboardEntryAccess.storageIndexCreate.allowed}
                    styles={{ body: { padding: '12px', textAlign: 'center', height: '100%' } }}
                    onClick={() => handleProtectedNavigate(
                      '/storage/indices',
                      dashboardEntryAccess.storageIndexCreate.allowed,
                      dashboardEntryAccess.storageIndexCreate.deniedTooltip,
                    )}
                    style={getDashboardEntryCardStyle(dashboardEntryAccess.storageIndexCreate.allowed)}
                  >
                    <span className="material-symbols-outlined opacity-50 mb-1">database</span>
                    <div className="text-xs font-medium">创建索引</div>
                  </Card>
                </Tooltip>
              </Col>
              <Col span={12} className="flex">
                <Tooltip title={dashboardEntryAccess.reportGenerate.allowed ? '进入报表管理' : dashboardEntryAccess.reportGenerate.deniedTooltip}>
                  <Card
                    className="h-full w-full"
                    hoverable={dashboardEntryAccess.reportGenerate.allowed}
                    styles={{ body: { padding: '12px', textAlign: 'center', height: '100%' } }}
                    onClick={() => handleProtectedNavigate(
                      '/reports/management',
                      dashboardEntryAccess.reportGenerate.allowed,
                      dashboardEntryAccess.reportGenerate.deniedTooltip,
                    )}
                    style={getDashboardEntryCardStyle(dashboardEntryAccess.reportGenerate.allowed)}
                  >
                    <span className="material-symbols-outlined opacity-50 mb-1">description</span>
                    <div className="text-xs font-medium">生成报表</div>
                  </Card>
                </Tooltip>
              </Col>
            </Row>
          </div>
        </Col>

        {/* 最近审计活动 */}
        <Col xs={24} lg={12} className="flex">
          <Card
            className="h-full w-full flex flex-col"
            title={<span className="text-sm font-bold">最近审计活动</span>}
            extra={
              <Tooltip title={dashboardEntryAccess.auditLogs.allowed ? undefined : dashboardEntryAccess.auditLogs.deniedTooltip}>
                <Button
                  type="link"
                  size="small"
                  onClick={() => handleProtectedNavigate(
                    '/security/audit',
                    dashboardEntryAccess.auditLogs.allowed,
                    dashboardEntryAccess.auditLogs.deniedTooltip,
                  )}
                  style={dashboardEntryAccess.auditLogs.allowed ? undefined : { opacity: 0.5, cursor: 'not-allowed' }}
                >
                  查看全部
                </Button>
              </Tooltip>
            }
            styles={{
              body: {
                display: 'flex',
                flex: 1,
                minHeight: 0,
                flexDirection: 'column',
              },
            }}
          >
            <div className="space-y-4 flex-1">
              {auditLogs.length > 0 ? auditLogs.map((audit, idx) => {
                const cfg = auditTypeConfig[audit.type] || auditTypeConfig.update;
                return (
                  <div key={`${audit.user}-${audit.target}-${idx}`} className="flex items-center gap-3 text-xs">
                    <div className="w-[72px] shrink-0 text-right opacity-50">{audit.time}</div>
                    <div
                      className="h-6 w-6 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${cfg.color}33`, color: cfg.color }}
                    >
                      <span className="material-symbols-outlined text-[14px]">{cfg.icon}</span>
                    </div>
                    <div className="min-w-0">
                      <span className="font-bold">{audit.user}</span>{' '}
                      {audit.action}{' '}
                      <span style={{ color: COLORS.primary }}>{audit.target}</span>
                    </div>
                  </div>
                );
              }) : (
                <div className="text-xs opacity-50">当前范围内暂无审计活动记录</div>
              )}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
