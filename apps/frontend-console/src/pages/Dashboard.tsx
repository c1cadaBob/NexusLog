import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Statistic, Button, Row, Col, Table, message } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useThemeStore } from '../stores/themeStore';
import { COLORS } from '../theme/tokens';
import { fetchDashboardOverview, type DashboardOverviewStats } from '../api/query';
import ChartWrapper from '../components/charts/ChartWrapper';
import type { EChartsCoreOption } from 'echarts/core';

const REFRESH_INTERVAL_MS = 30000;

const LEVEL_COLORS: Record<string, string> = {
  debug: COLORS.info,
  info: COLORS.primary,
  warn: COLORS.warning,
  warning: COLORS.warning,
  error: COLORS.danger,
  fatal: COLORS.danger,
};

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const isDark = useThemeStore((s) => s.isDark);
  const [stats, setStats] = useState<DashboardOverviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState(Date.now());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadOverview = useCallback(async () => {
    try {
      const data = await fetchDashboardOverview();
      setStats(data);
      setError(null);
      setLastUpdated(Date.now());
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载失败';
      setError(msg);
      message.error(msg);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    refreshTimerRef.current = setInterval(loadOverview, REFRESH_INTERVAL_MS);
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [loadOverview]);

  const totalLogs = stats?.total_logs ?? 0;
  const levelDist = stats?.level_distribution ?? {};
  const errorCount = (levelDist.error ?? 0) + (levelDist.fatal ?? 0);
  const errorRate = totalLogs > 0 ? ((errorCount / totalLogs) * 100).toFixed(1) : '0';
  const alertSummary = stats?.alert_summary ?? { total: 0, firing: 0, resolved: 0 };
  const topSources = stats?.top_sources ?? [];
  const logTrend = stats?.log_trend ?? [];

  const logTrendOption: EChartsCoreOption = useMemo(() => {
    const times = logTrend.map((p) => {
      try {
        const d = new Date(p.time);
        return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      } catch {
        return p.time;
      }
    });
    const counts = logTrend.map((p) => p.count);
    return {
      legend: { show: false },
      grid: { top: 10, right: 16, bottom: 24, left: 40 },
      xAxis: { type: 'category', data: times, boundaryGap: false },
      yAxis: { type: 'value', splitLine: { lineStyle: { color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' } } },
      series: [
        {
          type: 'line',
          data: counts,
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 1.5, color: COLORS.primary },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: `${COLORS.primary}99` },
                { offset: 1, color: `${COLORS.primary}11` },
              ],
            },
          },
        },
      ],
      tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
    };
  }, [logTrend, isDark]);

  const levelPieOption: EChartsCoreOption = useMemo(() => {
    const entries = Object.entries(levelDist).filter(([, v]) => v > 0);
    if (entries.length === 0) {
      return { series: [{ type: 'pie', data: [{ name: '无数据', value: 1 }], radius: ['40%', '70%'] }] };
    }
    const data = entries.map(([name, count]) => ({
      name: name,
      value: count,
      itemStyle: { color: LEVEL_COLORS[name.toLowerCase()] ?? COLORS.info },
    }));
    return {
      tooltip: { trigger: 'item' },
      series: [
        {
          type: 'pie',
          radius: ['40%', '70%'],
          data,
          label: { show: true, formatter: '{b}: {d}%' },
        },
      ],
    };
  }, [levelDist]);

  const sourceColumns: ColumnsType<{ source: string; count: number }> = useMemo(
    () => [
      { title: '来源', dataIndex: 'source', key: 'source', render: (v: string) => <span className="font-medium">{v}</span> },
      {
        title: '数量',
        dataIndex: 'count',
        key: 'count',
        render: (v: number) => <span style={{ fontWeight: 700 }}>{v.toLocaleString()}</span>,
      },
    ],
    [],
  );

  const handleNavigate = useCallback((path: string) => navigate(path), [navigate]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="text-xs opacity-60">
            最后更新: {new Date(lastUpdated).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          <span className="text-xs opacity-60">每 30 秒自动刷新</span>
        </div>
        <Button size="small" icon={<ReloadOutlined spin={isRefreshing} />} onClick={handleRefresh} disabled={isRefreshing}>
          刷新
        </Button>
      </div>

      {loading ? (
        <Card><div className="py-12 text-center">加载中...</div></Card>
      ) : error ? (
        <Card><div className="py-12 text-center">加载失败: {error}</div></Card>
      ) : (
        <>
          <Row gutter={[16, 16]}>
            <Col xs={12} md={8} xl={4}>
              <Card size="small" styles={{ body: { padding: '16px' } }}>
                <div className="flex justify-between items-start">
                  <span className="text-xs opacity-60">总日志量</span>
                  <span className="material-symbols-outlined opacity-70" style={{ color: COLORS.primary }}>data_usage</span>
                </div>
                <Statistic value={formatCount(totalLogs)} valueStyle={{ fontSize: 20, fontWeight: 700 }} />
              </Card>
            </Col>
            <Col xs={12} md={8} xl={4}>
              <Card size="small" styles={{ body: { padding: '16px' } }}>
                <div className="flex justify-between items-start">
                  <span className="text-xs opacity-60">错误率</span>
                  <span className="material-symbols-outlined opacity-70" style={{ color: COLORS.danger }}>error</span>
                </div>
                <Statistic value={`${errorRate}%`} valueStyle={{ fontSize: 20, fontWeight: 700 }} />
              </Card>
            </Col>
            <Col xs={12} md={8} xl={4}>
              <Card size="small" styles={{ body: { padding: '16px' } }}>
                <div className="flex justify-between items-start">
                  <span className="text-xs opacity-60">告警中</span>
                  <span className="material-symbols-outlined opacity-70" style={{ color: COLORS.warning }}>notifications_active</span>
                </div>
                <Statistic value={alertSummary.firing} valueStyle={{ fontSize: 20, fontWeight: 700 }} />
              </Card>
            </Col>
            <Col xs={12} md={8} xl={4}>
              <Card size="small" styles={{ body: { padding: '16px' } }}>
                <div className="flex justify-between items-start">
                  <span className="text-xs opacity-60">已解决</span>
                  <span className="material-symbols-outlined opacity-70" style={{ color: COLORS.success }}>check_circle</span>
                </div>
                <Statistic value={alertSummary.resolved} valueStyle={{ fontSize: 20, fontWeight: 700 }} />
              </Card>
            </Col>
          </Row>

          <Row gutter={[24, 24]}>
            <Col xs={24} lg={16}>
              <ChartWrapper
                title="日志量趋势"
                subtitle="过去 24 小时"
                option={logTrendOption}
                height={220}
                loading={loading}
                error={error ?? undefined}
                empty={logTrend.length === 0}
              />
            </Col>
            <Col xs={24} lg={8}>
              <ChartWrapper
                title="日志级别分布"
                option={levelPieOption}
                height={220}
                loading={loading}
                error={error ?? undefined}
                empty={Object.keys(levelDist).length === 0}
              />
            </Col>
          </Row>

          <Row gutter={[24, 24]}>
            <Col xs={24} lg={12}>
              <Card
                title={<span className="text-sm font-bold">来源 Top 10</span>}
                extra={
                  <Button type="link" size="small" onClick={() => handleNavigate('/search/realtime')}>
                    查看更多
                  </Button>
                }
              >
                <Table
                  dataSource={topSources}
                  columns={sourceColumns}
                  pagination={false}
                  size="small"
                  rowKey="source"
                  loading={loading}
                  locale={{ emptyText: '暂无数据' }}
                />
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card
                title={<span className="text-sm font-bold">告警摘要</span>}
                extra={
                  <Button type="link" size="small" onClick={() => handleNavigate('/alerts/list')}>
                    查看全部
                  </Button>
                }
              >
                <div className="flex gap-6">
                  <div>
                    <div className="text-xs opacity-60">总数</div>
                    <div className="text-2xl font-bold">{alertSummary.total}</div>
                  </div>
                  <div>
                    <div className="text-xs opacity-60">进行中</div>
                    <div className="text-2xl font-bold" style={{ color: COLORS.warning }}>{alertSummary.firing}</div>
                  </div>
                  <div>
                    <div className="text-xs opacity-60">已解决</div>
                    <div className="text-2xl font-bold" style={{ color: COLORS.success }}>{alertSummary.resolved}</div>
                  </div>
                </div>
              </Card>
            </Col>
          </Row>

          <Row gutter={[24, 24]}>
            <Col xs={24} lg={12}>
              <Card hoverable styles={{ body: { padding: '16px' } }} onClick={() => handleNavigate('/ingestion/wizard')}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded flex items-center justify-center" style={{ backgroundColor: `${COLORS.primary}33`, color: COLORS.primary }}>
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
            </Col>
            <Col xs={24} lg={12}>
              <Card hoverable styles={{ body: { padding: '16px' } }} onClick={() => handleNavigate('/alerts/rules')}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded flex items-center justify-center" style={{ backgroundColor: 'rgba(139,92,246,0.2)', color: '#a78bfa' }}>
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
            </Col>
          </Row>
        </>
      )}
    </div>
  );
};

export default Dashboard;
