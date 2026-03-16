import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, Select, Button, Space, message, Empty } from 'antd';
import { useThemeStore } from '../../stores/themeStore';
import { COLORS } from '../../theme/tokens';
import ChartWrapper from '../../components/charts/ChartWrapper';
import type { EChartsCoreOption } from 'echarts/core';
import { fetchAggregateStats, type FetchAggregateStatsParams, type AggregateBucket } from '../../api/query';
import InlineLoadingState from '../../components/common/InlineLoadingState';

// ============================================================================
// 常量
// ============================================================================

const GROUP_BY_OPTIONS = [
  { value: 'level', label: '按日志级别 (Level)' },
  { value: 'source', label: '按来源 (Source)' },
  { value: 'hour', label: '按小时 (Hour)' },
];

const TIME_RANGE_OPTIONS = [
  { value: '1h', label: '最近 1 小时' },
  { value: '6h', label: '最近 6 小时' },
  { value: '24h', label: '最近 24 小时' },
  { value: '7d', label: '最近 7 天' },
];

const LEVEL_COLORS: Record<string, string> = {
  error: COLORS.danger,
  warn: COLORS.warning,
  warning: COLORS.warning,
  info: COLORS.primary,
  debug: COLORS.purple,
  trace: COLORS.info,
  fatal: COLORS.danger,
};

// ============================================================================
// 主组件
// ============================================================================

const AggregateAnalysis: React.FC = () => {
  const isDark = useThemeStore((s) => s.isDark);

  const [groupBy, setGroupBy] = useState<FetchAggregateStatsParams['groupBy']>('level');
  const [timeRange, setTimeRange] = useState<FetchAggregateStatsParams['timeRange']>('24h');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [buckets, setBuckets] = useState<AggregateBucket[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchAggregateStats({ groupBy, timeRange });
      setBuckets(result.buckets ?? []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '聚合查询失败';
      message.error(msg);
      setError(msg);
      setBuckets([]);
    } finally {
      setLoading(false);
    }
  }, [groupBy, timeRange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = useCallback(() => {
    loadData();
  }, [loadData]);

  const isEmpty = !loading && buckets.length === 0 && !error;

  // ---- ECharts 配置 ----

  const barOption: EChartsCoreOption = useMemo(() => {
    const labels = buckets.map((b) => b.key || '-');
    const values = buckets.map((b) => b.count);
    const colors = groupBy === 'level'
      ? labels.map((k) => LEVEL_COLORS[k.toLowerCase()] ?? COLORS.primary)
      : undefined;

    return {
      grid: { top: 40, right: 16, bottom: 32, left: 48 },
      xAxis: { type: 'category', data: labels },
      yAxis: { type: 'value' },
      series: [{
        type: 'bar',
        data: values,
        itemStyle: colors ? { color: (params: { dataIndex: number }) => colors[params.dataIndex] } : { color: COLORS.primary, borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 32,
      }],
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    };
  }, [buckets, groupBy, isDark]);

  const pieOption: EChartsCoreOption = useMemo(() => {
    const data = buckets.map((b) => {
      const key = b.key || '-';
      const color = groupBy === 'level' ? (LEVEL_COLORS[key.toLowerCase()] ?? COLORS.primary) : undefined;
      return { name: key, value: b.count, itemStyle: color ? { color } : undefined };
    });

    return {
      legend: { orient: 'vertical', right: 16, top: 'center', textStyle: { fontSize: 12, color: isDark ? '#94a3b8' : '#475569' } },
      series: [{
        type: 'pie',
        radius: ['45%', '70%'],
        center: ['40%', '50%'],
        padAngle: 3,
        itemStyle: { borderRadius: 4 },
        data,
        label: { show: true, formatter: '{b}: {d}%', fontSize: 11, color: isDark ? '#94a3b8' : '#475569' },
      }],
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    };
  }, [buckets, groupBy, isDark]);

  const chartOption = barOption;
  const chartTitle = groupBy === 'level' ? '日志级别分布' : groupBy === 'source' ? '来源分布' : '按小时分布';

  return (
    <div className="flex flex-col gap-4">
      {/* 页面头部 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold m-0">聚合分析</h2>
          <span className="text-xs opacity-50">Log Analysis / Aggregation</span>
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

      {/* 查询构建器 */}
      <Card
        title={
          <span className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base" style={{ color: COLORS.primary }}>query_stats</span>
            聚合查询
          </span>
        }
        styles={{ body: { padding: '16px' } }}
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1" style={{ minWidth: 170 }}>
            <div className="text-xs font-medium opacity-50 mb-1.5 uppercase tracking-wider">分组维度</div>
            <Select
              value={groupBy}
              onChange={(v) => setGroupBy(v as FetchAggregateStatsParams['groupBy'])}
              options={GROUP_BY_OPTIONS}
              style={{ width: '100%' }}
              size="middle"
            />
          </div>
          <div className="flex-1" style={{ minWidth: 170 }}>
            <div className="text-xs font-medium opacity-50 mb-1.5 uppercase tracking-wider">时间范围</div>
            <Select
              value={timeRange}
              onChange={(v) => setTimeRange(v as FetchAggregateStatsParams['timeRange'])}
              options={TIME_RANGE_OPTIONS}
              style={{ width: '100%' }}
              size="middle"
            />
          </div>
          <Button
            type="primary"
            loading={loading}
            onClick={loadData}
            icon={<span className="material-symbols-outlined text-sm">play_arrow</span>}
          >
            {loading ? '分析中...' : '开始分析'}
          </Button>
        </div>
      </Card>

      {/* 图表区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartWrapper
          title={chartTitle}
          subtitle={`按 ${groupBy} 分组 · ${timeRange}`}
          option={chartOption}
          height={340}
          loading={loading}
          error={error ?? undefined}
          empty={isEmpty}
        />
        {groupBy !== 'hour' && (
          <ChartWrapper
            title={`${chartTitle} (饼图)`}
            subtitle={`按 ${groupBy} 分组 · ${timeRange}`}
            option={pieOption}
            height={340}
            loading={loading}
            error={error ?? undefined}
            empty={isEmpty}
          />
        )}
      </div>

      {/* 数据表格 */}
      <Card title="详细数据">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
            <InlineLoadingState tip="加载中..." />
          </div>
        ) : error ? (
          <Empty description={error} image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : buckets.length === 0 ? (
          <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600 }}>{groupBy === 'level' ? '级别' : groupBy === 'source' ? '来源' : '时间'}</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600 }}>数量</th>
                </tr>
              </thead>
              <tbody>
                {buckets.map((b, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
                    <td style={{ padding: '8px 12px', fontFamily: 'JetBrains Mono, monospace' }}>{b.key || '-'}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }}>{b.count.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default AggregateAnalysis;
