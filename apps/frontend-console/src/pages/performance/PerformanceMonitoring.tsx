import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Select, Empty, message } from 'antd';
import type { EChartsCoreOption } from 'echarts/core';
import { useThemeStore } from '../../stores/themeStore';
import { fetchServerMetrics } from '@/api/metrics';
import type { ServerMetricsData, TimeSeriesPoint } from '@/api/metrics';
import { fetchPullSources, type PullSource } from '@/api/ingest';
import ChartWrapper from '@/components/charts/ChartWrapper';
import { COLORS, DARK_PALETTE, LIGHT_PALETTE } from '@/theme/tokens';
import InlineLoadingState from '@/components/common/InlineLoadingState';

type TimeRange = '1h' | '6h' | '24h' | '7d';

function groupSourcesByAgent(sources: PullSource[]): { id: string; label: string }[] {
  const byKey = new Map<string, PullSource[]>();
  for (const s of sources) {
    const key = (s.agent_base_url || '').trim() || `${s.host}:${s.port}`;
    const list = byKey.get(key) ?? [];
    list.push(s);
    byKey.set(key, list);
  }
  return Array.from(byKey.entries()).map(([key, list]) => {
    const first = list[0]!;
    const label = first.host ? `${first.host}:${first.port}` : key || key;
    return { id: key, label };
  });
}

function buildLineSeries(
  data: TimeSeriesPoint[] | undefined,
  name: string,
  color: string,
  isDark: boolean,
): EChartsCoreOption {
  const palette = isDark ? DARK_PALETTE : LIGHT_PALETTE;
  const sorted = (data ?? []).slice().sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  const xData = sorted.map((d) => {
    const t = new Date(d.timestamp);
    return t.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  });
  const yData = sorted.map((d) => d.value);

  return {
    tooltip: { trigger: 'axis' },
    grid: { top: 30, right: 20, bottom: 30, left: 50 },
    xAxis: {
      type: 'category',
      data: xData,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: palette.textSecondary, fontSize: 10 },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: palette.border, type: 'dashed', opacity: 0.3 } },
      axisLabel: { color: palette.textSecondary, fontSize: 10, formatter: '{value}%' },
    },
    series: [
      {
        name,
        type: 'line',
        data: yData,
        smooth: true,
        lineStyle: { width: 2, color },
        itemStyle: { color },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: `${color}4d` },
              { offset: 1, color: `${color}00` },
            ],
          },
        },
        showSymbol: false,
      },
    ],
  };
}

const PerformanceMonitoring: React.FC = () => {
  const { isDark } = useThemeStore();

  const headerBg = isDark ? 'bg-[#111722]' : 'bg-white';
  const cardBg = isDark ? 'bg-[#1e293b]' : 'bg-white';
  const borderColor = isDark ? 'border-[#2a3441]' : 'border-slate-200';
  const textColor = isDark ? 'text-white' : 'text-slate-900';
  const textSecondary = isDark ? 'text-slate-400' : 'text-slate-600';

  const [agents, setAgents] = useState<{ id: string; label: string }[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [range, setRange] = useState<TimeRange>('1h');
  const [metrics, setMetrics] = useState<ServerMetricsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [agentsLoading, setAgentsLoading] = useState(true);

  const loadAgents = useCallback(async () => {
    setAgentsLoading(true);
    try {
      const sources = await fetchPullSources();
      const list = groupSourcesByAgent(sources);
      setAgents(list);
      setSelectedAgentId((prev) =>
        prev && list.some((a) => a.id === prev) ? prev : list[0]?.id ?? null,
      );
    } catch (err) {
      message.error('加载 Agent 列表失败：' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setAgentsLoading(false);
    }
  }, []);

  const loadMetrics = useCallback(async () => {
    if (!selectedAgentId) {
      setMetrics(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetchServerMetrics(selectedAgentId, range);
      setMetrics(res.data ?? null);
    } catch (err) {
      message.error('加载指标失败：' + (err instanceof Error ? err.message : String(err)));
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  }, [selectedAgentId, range]);

  useEffect(() => {
    loadAgents();
  }, []);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  const handleRefresh = useCallback(() => {
    loadMetrics();
  }, [loadMetrics]);

  const cpuOption = useMemo(
    () =>
      buildLineSeries(
        metrics?.cpu_usage_pct,
        'CPU 使用率',
        COLORS.primary,
        isDark,
      ),
    [metrics?.cpu_usage_pct, isDark],
  );

  const memoryOption = useMemo(
    () =>
      buildLineSeries(
        metrics?.memory_usage_pct,
        '内存使用率',
        COLORS.success,
        isDark,
      ),
    [metrics?.memory_usage_pct, isDark],
  );

  const diskOption = useMemo(
    () =>
      buildLineSeries(
        metrics?.disk_usage_pct,
        '磁盘使用率',
        COLORS.warning,
        isDark,
      ),
    [metrics?.disk_usage_pct, isDark],
  );

  const hasData =
    (metrics?.cpu_usage_pct?.length ?? 0) > 0 ||
    (metrics?.memory_usage_pct?.length ?? 0) > 0 ||
    (metrics?.disk_usage_pct?.length ?? 0) > 0;

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Header */}
      <div
        className={`flex items-center justify-between px-6 py-4 border-b ${borderColor} ${headerBg} shrink-0 -mx-6 -mt-6`}
      >
        <div className="flex flex-col">
          <h2 className={`text-xl font-bold ${textColor} tracking-tight`}>
            实时系统性能 (Real-time System Performance)
          </h2>
          <p className={`text-sm ${textSecondary} mt-1`}>
            监控集群健康状态、资源使用率及关键性能指标
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select
            placeholder="选择 Agent"
            value={selectedAgentId ?? undefined}
            onChange={(v) => setSelectedAgentId(v ?? null)}
            loading={agentsLoading}
            options={agents.map((a) => ({ label: a.label, value: a.id }))}
            allowClear
            style={{ minWidth: 160 }}
          />
          <Select
            value={range}
            onChange={(v) => setRange(v as TimeRange)}
            options={[
              { label: '1 小时', value: '1h' },
              { label: '6 小时', value: '6h' },
              { label: '24 小时', value: '24h' },
              { label: '7 天', value: '7d' },
            ]}
            style={{ minWidth: 100 }}
          />
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center justify-center h-8 w-8 rounded-md bg-[#135bec] hover:bg-[#1a6fff] text-white transition-colors disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">refresh</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pr-2">
        <div className="max-w-[1600px] mx-auto flex flex-col gap-6">
          {!selectedAgentId ? (
            <Empty
              description="请先选择 Agent 查看性能指标"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              style={{ padding: 48 }}
            />
          ) : loading && !metrics ? (
            <div className="flex justify-center py-24">
              <InlineLoadingState tip="加载中..." size="large" />
            </div>
          ) : !hasData ? (
            <Empty
              description="暂无指标数据"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              style={{ padding: 48 }}
            />
          ) : (
            <>
              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className={`${cardBg} rounded-lg border ${borderColor} p-5 shadow-sm`}>
                  <ChartWrapper
                    title="CPU 使用率"
                    subtitle="集群 CPU 负载趋势"
                    height={240}
                    loading={loading}
                    empty={!metrics?.cpu_usage_pct?.length}
                    option={cpuOption}
                  />
                </div>
                <div className={`${cardBg} rounded-lg border ${borderColor} p-5 shadow-sm`}>
                  <ChartWrapper
                    title="内存使用率"
                    subtitle="JVM Heap / 系统内存"
                    height={240}
                    loading={loading}
                    empty={!metrics?.memory_usage_pct?.length}
                    option={memoryOption}
                  />
                </div>
                <div className={`${cardBg} rounded-lg border ${borderColor} p-5 shadow-sm`}>
                  <ChartWrapper
                    title="磁盘使用率"
                    subtitle="磁盘空间占用"
                    height={240}
                    loading={loading}
                    empty={!metrics?.disk_usage_pct?.length}
                    option={diskOption}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PerformanceMonitoring;
