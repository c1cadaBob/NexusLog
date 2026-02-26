import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Statistic, Select, Button, Row, Col, Table, Tag, Progress } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useThemeStore } from '../stores/themeStore';
import { useAlertStore } from '../stores/alertStore';
import { usePreferencesStore } from '../stores/preferencesStore';
import { COLORS } from '../theme/tokens';
import { KPI_DATA, SERVICE_STATUS_DATA, AUDIT_LOG_DATA } from '../constants';
import type { KpiData, ServiceStatus } from '../types/dashboard';
import ChartWrapper from '../components/charts/ChartWrapper';
import type { EChartsCoreOption } from 'echarts/core';

// ============================================================================
// 模拟数据刷新工具函数
// ============================================================================

/** 生成初始日志趋势数据（近 3 小时，1 分钟颗粒度，共 180 个点） */
function generateInitialTrendData() {
  const now = new Date();
  return Array.from({ length: 180 }, (_, i) => {
    const t = new Date(now.getTime() - (179 - i) * 60000);
    return {
      time: t.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      info: Math.floor(40 + Math.random() * 250),
      warn: Math.floor(5 + Math.random() * 40),
      error: Math.floor(2 + Math.random() * 20),
    };
  });
}

/** 模拟 KPI 数据微变 */
function refreshKpiData(prev: KpiData[]): KpiData[] {
  return prev.map((kpi) => {
    if (kpi.icon === 'data_usage') {
      const v = parseFloat(kpi.value) + (Math.random() - 0.4) * 0.5;
      return { ...kpi, value: `${v.toFixed(1)}M` };
    }
    if (kpi.icon === 'speed') {
      const v = parseFloat(kpi.value) + (Math.random() - 0.4) * 2;
      return { ...kpi, value: `${v.toFixed(1)}k` };
    }
    if (kpi.icon === 'error') {
      const v = Math.max(0.1, parseFloat(kpi.value) + (Math.random() - 0.5) * 0.3);
      return { ...kpi, value: `${v.toFixed(1)}%` };
    }
    if (kpi.icon === 'notifications_active') {
      return kpi; // 由 alertStore 驱动，不做随机变动
    }
    return kpi;
  });
}

/** 模拟服务状态微变 */
function refreshServiceData(prev: ServiceStatus[]): ServiceStatus[] {
  return prev.map((s) => ({
    ...s,
    errorRate: Math.max(0, +(s.errorRate + (Math.random() - 0.5) * 2).toFixed(1)),
  }));
}

/** 追加一个新的趋势数据点（保留最近 180 个点） */
function appendTrendPoint(prev: { time: string; info: number; warn: number; error: number }[]) {
  const now = new Date();
  const next = [
    ...prev.slice(-179),
    {
      time: now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      info: Math.floor(40 + Math.random() * 250),
      warn: Math.floor(5 + Math.random() * 40),
      error: Math.floor(2 + Math.random() * 20),
    },
  ];
  return next;
}

/** 刷新间隔选项 */
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

/** 模拟带宽数据 */
const BANDWIDTH_DATA = [
  { in: 0, out: 0 },
  { in: 150, out: 250 },
  { in: 120, out: 300 },
  { in: 200, out: 220 },
  { in: 180, out: 350 },
  { in: 250, out: 400 },
  { in: 900, out: 950 },
];

// ============================================================================
// 刷新控制栏
// ============================================================================
const RefreshControls: React.FC<{
  lastUpdated: number;
  wsConnected: boolean;
  countdown: number;
  refreshInterval: number;
  isLoading: boolean;
  onRefresh: () => void;
  onIntervalChange: (v: number) => void;
}> = React.memo(({ lastUpdated, wsConnected, countdown, refreshInterval, isLoading, onRefresh, onIntervalChange }) => {
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
      <div className="flex items-center gap-3">
        {refreshInterval > 1000 && countdown > 0 && (
          <span className="text-xs opacity-60">{countdown}s 后刷新</span>
        )}
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
const KpiCard: React.FC<{ data: typeof KPI_DATA[number] }> = React.memo(({ data }) => {
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
          <span className="text-[10px] opacity-50">{data.trendLabel}</span>
        </div>
      )}
    </Card>
  );
});
KpiCard.displayName = 'KpiCard';

// ============================================================================
// 基础设施监控
// ============================================================================
const InfrastructureMonitor: React.FC = React.memo(() => {
  const isDark = useThemeStore((s) => s.isDark);
  const innerBg = isDark ? '#0f172a' : '#f1f5f9';
  const gaugeBg = isDark ? '#1e293b' : '#ffffff';

  // 带宽迷你折线图 ECharts 配置
  const bandwidthOption: EChartsCoreOption = useMemo(() => ({
    grid: { top: 0, right: 0, bottom: 0, left: 0 },
    xAxis: { type: 'category', show: false, data: BANDWIDTH_DATA.map((_, i) => i) },
    yAxis: { type: 'value', show: false, min: 0, max: 1000 },
    series: [
      { type: 'line', data: BANDWIDTH_DATA.map((d) => d.in), smooth: true, showSymbol: false, lineStyle: { width: 2, color: COLORS.info } },
      { type: 'line', data: BANDWIDTH_DATA.map((d) => d.out), smooth: true, showSymbol: false, lineStyle: { width: 2, color: COLORS.success } },
    ],
    tooltip: { show: false },
  }), []);

  const dividerColor = isDark ? '#334155' : '#e2e8f0';

  const gaugeAngle = 151.2; // 42% of 360
  const gaugeStyle: React.CSSProperties = useMemo(() => ({
    background: `conic-gradient(from 180deg at 50% 100%, ${COLORS.info} ${gaugeAngle}deg, ${isDark ? '#334155' : '#e2e8f0'} ${gaugeAngle}deg, ${isDark ? '#334155' : '#e2e8f0'} 180deg, transparent 180deg)`,
  }), [isDark]);

  return (
    <Card styles={{ body: { padding: '20px' } }}>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: 'rgba(99,102,241,0.2)', color: '#818cf8' }}>
            <span className="material-symbols-outlined text-lg">dns</span>
          </div>
          <div>
            <div className="text-sm font-bold">系统基础设施监控</div>
            <div className="text-[10px] opacity-50 uppercase">Infrastructure Real-time Status</div>
          </div>
        </div>
        <div className="flex gap-2">
          <Tag color="success" style={{ fontSize: 10 }}>系统健康</Tag>
          <Tag style={{ fontSize: 10 }}>Cluster Node-01</Tag>
        </div>
      </div>

      <Row gutter={[24, 16]} align="stretch">
        {/* CPU Load */}
        <Col xs={24} md={12} lg={6}>
          <div className="h-full flex flex-col">
            <div className="flex justify-between items-end mb-2">
              <span className="text-xs opacity-60 font-medium">负载 (CPU Load)</span>
              <span className="text-lg font-bold">42%</span>
            </div>
            <div className="h-20 flex items-center justify-center relative overflow-hidden flex-1">
              <div className="w-32 h-16 relative">
                <div className="w-full h-full rounded-t-full relative" style={gaugeStyle} />
                <div
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 w-24 h-12 rounded-t-full flex items-end justify-center pb-2"
                  style={{ backgroundColor: gaugeBg }}
                >
                  <span className="text-[10px] opacity-50">8 vCPUs</span>
                </div>
              </div>
            </div>
            <Row gutter={8} className="mt-auto">
              <Col span={12}>
                <div className="p-1.5 rounded text-center" style={{ backgroundColor: innerBg }}>
                  <div className="text-[9px] opacity-50">Load Avg</div>
                  <div className="text-xs font-bold">3.2</div>
                </div>
              </Col>
              <Col span={12}>
                <div className="p-1.5 rounded text-center" style={{ backgroundColor: innerBg }}>
                  <div className="text-[9px] opacity-50">进程数</div>
                  <div className="text-xs font-bold">186</div>
                </div>
              </Col>
            </Row>
          </div>
        </Col>

        {/* Memory */}
        <Col xs={24} md={12} lg={6}>
          <div className="lg:border-l lg:pl-6 h-full flex flex-col" style={{ borderColor: dividerColor }}>
            <div className="flex justify-between items-end mb-3">
              <span className="text-xs opacity-60 font-medium">内存 (Memory)</span>
              <span className="text-sm font-bold">12.4 GB <span className="text-[10px] opacity-50 font-normal">/ 16 GB</span></span>
            </div>
            <Progress percent={78} showInfo={false} strokeColor={{ from: COLORS.success, to: '#2dd4bf' }} size="small" />
            <div className="flex justify-between text-[10px] opacity-50 mb-4 mt-1">
              <span>已使用: 78%</span>
              <span>可用: 3.6 GB</span>
            </div>
            <div className="space-y-2 mt-auto">
              <div className="flex justify-between items-center text-[10px]">
                <span className="opacity-60">缓存 (Cache)</span>
                <span>4.2 GB</span>
              </div>
              <Progress percent={26} showInfo={false} strokeColor={COLORS.info} size={['100%', 4]} />
            </div>
          </div>
        </Col>

        {/* Connections */}
        <Col xs={24} md={12} lg={6}>
          <div className="lg:border-l lg:pl-6 h-full flex flex-col" style={{ borderColor: dividerColor }}>
            <div className="flex justify-between items-end mb-3">
              <span className="text-xs opacity-60 font-medium">传输连接数</span>
              <div className="flex items-center gap-1 text-[10px]" style={{ color: COLORS.success }}>
                <span className="material-symbols-outlined text-[12px]">arrow_upward</span> 实时
              </div>
            </div>
            <div className="flex items-end gap-2 mb-2">
              <span className="text-3xl font-bold tracking-tight">8,492</span>
              <span className="text-[10px] opacity-50 mb-1">活跃连接</span>
            </div>
            <Row gutter={8} className="mt-auto">
              <Col span={6}>
                <div className="p-1.5 rounded text-center" style={{ backgroundColor: innerBg }}>
                  <div className="text-[9px] opacity-50 uppercase">TCP</div>
                  <div className="text-xs font-bold">8.1k</div>
                </div>
              </Col>
              <Col span={6}>
                <div className="p-1.5 rounded text-center" style={{ backgroundColor: innerBg }}>
                  <div className="text-[9px] opacity-50 uppercase">UDP</div>
                  <div className="text-xs font-bold">372</div>
                </div>
              </Col>
              <Col span={6}>
                <div className="p-1.5 rounded text-center" style={{ backgroundColor: innerBg }}>
                  <div className="text-[9px] opacity-50 uppercase">HTTP</div>
                  <div className="text-xs font-bold">5.2k</div>
                </div>
              </Col>
              <Col span={6}>
                <div className="p-1.5 rounded text-center" style={{ backgroundColor: innerBg }}>
                  <div className="text-[9px] opacity-50 uppercase">HTTPS</div>
                  <div className="text-xs font-bold">2.9k</div>
                </div>
              </Col>
            </Row>
          </div>
        </Col>

        {/* Bandwidth */}
        <Col xs={24} md={12} lg={6}>
          <div className="lg:border-l lg:pl-6 h-full flex flex-col" style={{ borderColor: dividerColor }}>
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs opacity-60 font-medium">带宽与流量统计</span>
              <div className="flex gap-2 text-[10px]">
                <span className="flex items-center gap-1" style={{ color: COLORS.info }}>
                  <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS.info }} /> In
                </span>
                <span className="flex items-center gap-1" style={{ color: COLORS.success }}>
                  <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS.success }} /> Out
                </span>
              </div>
            </div>
            <div className="flex justify-between mb-1">
              <span className="text-[10px]">450 Mbps</span>
              <span className="text-[10px]">1.2 Gbps</span>
            </div>
            <div className="flex-1 min-h-0">
              <ChartWrapper option={bandwidthOption} height={80} />
            </div>
          </div>
        </Col>
      </Row>
    </Card>
  );
});
InfrastructureMonitor.displayName = 'InfrastructureMonitor';

// ============================================================================
// Dashboard 主组件
// ============================================================================
const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const isDark = useThemeStore((s) => s.isDark);
  const alertUnreadCount = useAlertStore((s) => s.unreadCount);

  // === 动态数据状态 ===
  const [kpiData, setKpiData] = useState<KpiData[]>(KPI_DATA);
  const [serviceData, setServiceData] = useState<ServiceStatus[]>(SERVICE_STATUS_DATA);
  const [trendData, setTrendData] = useState(generateInitialTrendData);

  // 刷新控制状态
  const [lastUpdated, setLastUpdated] = useState(Date.now());
  const [wsConnected] = useState(true);
  const storedRefreshInterval = usePreferencesStore((s) => s.refreshInterval);
  const setStoredRefreshInterval = usePreferencesStore((s) => s.setRefreshInterval);
  const [refreshInterval, setRefreshIntervalLocal] = useState(storedRefreshInterval * 1000);
  const [countdown, setCountdown] = useState(storedRefreshInterval);
  const [isLoading, setIsLoading] = useState(false);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 执行数据刷新
  const doRefresh = useCallback(() => {
    setKpiData((prev) => refreshKpiData(prev));
    setServiceData((prev) => refreshServiceData(prev));
    setTrendData((prev) => appendTrendPoint(prev));
    setLastUpdated(Date.now());
  }, []);

  // 手动刷新
  const handleRefresh = useCallback(() => {
    setIsLoading(true);
    setTimeout(() => {
      doRefresh();
      setIsLoading(false);
      if (refreshInterval > 0) setCountdown(refreshInterval / 1000);
    }, 300);
  }, [refreshInterval, doRefresh]);

  // 刷新间隔变更
  const handleIntervalChange = useCallback((val: number) => {
    setRefreshIntervalLocal(val);
    setStoredRefreshInterval(val === 0 ? 0 : val / 1000);
    if (val > 0) setCountdown(val / 1000);
    else setCountdown(0);
  }, [setStoredRefreshInterval]);

  // 自动刷新定时器
  useEffect(() => {
    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);

    if (refreshInterval > 0) {
      setCountdown(refreshInterval / 1000);
      refreshTimerRef.current = setInterval(() => {
        doRefresh();
        setCountdown(refreshInterval / 1000);
      }, refreshInterval);
      countdownTimerRef.current = setInterval(() => {
        setCountdown((p) => (p > 0 ? p - 1 : refreshInterval / 1000));
      }, 1000);
    }

    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [refreshInterval, doRefresh]);

  // 页面可见性：隐藏时暂停，显示时恢复
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      } else if (refreshInterval > 0) {
        doRefresh();
        setCountdown(refreshInterval / 1000);
        refreshTimerRef.current = setInterval(() => {
          doRefresh();
          setCountdown(refreshInterval / 1000);
        }, refreshInterval);
        countdownTimerRef.current = setInterval(() => {
          setCountdown((p) => (p > 0 ? p - 1 : refreshInterval / 1000));
        }, 1000);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [refreshInterval, doRefresh]);

  // 导航
  const handleNavigate = useCallback((path: string) => navigate(path), [navigate]);

  // 异常服务表格列
  const serviceColumns: ColumnsType<ServiceStatus> = useMemo(() => [
    { title: '服务名称', dataIndex: 'name', key: 'name', render: (v: string) => <span className="font-medium">{v}</span> },
    {
      title: '错误数/h', dataIndex: 'errorRate', key: 'errorRate',
      render: (v: number, r: ServiceStatus) => (
        <span style={{ color: r.status === 'critical' ? COLORS.danger : r.status === 'warning' ? COLORS.warning : COLORS.success, fontWeight: 700 }}>
          {v.toLocaleString()}
        </span>
      ),
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 60,
      render: (_: unknown, r: ServiceStatus) => (
        <span
          className="inline-block w-2 h-2 rounded-full"
          style={{ backgroundColor: r.status === 'critical' ? COLORS.danger : r.status === 'warning' ? COLORS.warning : COLORS.success }}
        />
      ),
    },
  ], []);

  // 日志趋势图表 ECharts 配置（依赖动态 trendData）
  const logTrendOption: EChartsCoreOption = useMemo(() => ({
    legend: { show: false },
    grid: { top: 10, right: 16, bottom: 24, left: 40 },
    xAxis: {
      type: 'category',
      data: trendData.map((d) => d.time),
      boundaryGap: false,
      axisLabel: {
        interval: Math.floor(trendData.length / 6),
      },
    },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' } } },
    series: [
      {
        name: 'Info',
        type: 'line',
        data: trendData.map((d) => d.info),
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
      {
        name: 'Warn',
        type: 'line',
        data: trendData.map((d) => d.warn),
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 1.5, color: COLORS.warning },
        itemStyle: { color: COLORS.warning },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: `${COLORS.warning}99` },
              { offset: 1, color: `${COLORS.warning}11` },
            ],
          },
        },
      },
      {
        name: 'Error',
        type: 'line',
        data: trendData.map((d) => d.error),
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 1.5, color: COLORS.danger },
        itemStyle: { color: COLORS.danger },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: `${COLORS.danger}99` },
              { offset: 1, color: `${COLORS.danger}11` },
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
        wsConnected={wsConnected}
        countdown={countdown}
        refreshInterval={refreshInterval}
        isLoading={isLoading}
        onRefresh={handleRefresh}
        onIntervalChange={handleIntervalChange}
      />

      {/* KPI 卡片网格: 2→3→6 列 */}
      <Row gutter={[16, 16]}>
        {kpiData.map((kpi, idx) => {
          // 未处理告警从 alertStore 读取总数
          if (kpi.icon === 'notifications_active') {
            return (
              <Col key={idx} xs={12} md={8} xl={4}>
                <KpiCard data={{ ...kpi, value: String(alertUnreadCount), trend: `共 ${alertUnreadCount} 条`, trendLabel: '待处理' }} />
              </Col>
            );
          }
          return (
            <Col key={idx} xs={12} md={8} xl={4}>
              <KpiCard data={kpi} />
            </Col>
          );
        })}
      </Row>

      {/* 基础设施监控 */}
      <InfrastructureMonitor />

      {/* 图表 + 异常服务排行 */}
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={16}>
          <ChartWrapper
            title="日志量趋势"
            subtitle="过去3小时每分钟摄入量"
            option={logTrendOption}
            height={220}
            actions={
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-[10px] opacity-60">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: COLORS.primary }} /> Info
                </span>
                <span className="flex items-center gap-1.5 text-[10px] opacity-60">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: COLORS.danger }} /> Error
                </span>
                <span className="flex items-center gap-1.5 text-[10px] opacity-60">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: COLORS.warning }} /> Warn
                </span>
              </div>
            }
          />
        </Col>
        <Col xs={24} lg={8}>
          <Card
            title={<span className="text-sm font-bold">异常服务排行 Top 5</span>}
            extra={
              <Button type="link" size="small" onClick={() => handleNavigate('/alerts/list')}>
                查看更多
              </Button>
            }
            className="h-full flex flex-col"
            styles={{ body: { padding: 0, flex: 1 } }}
          >
            <Table<ServiceStatus>
              dataSource={serviceData}
              columns={serviceColumns}
              pagination={false}
              size="small"
              rowKey="name"
              onRow={() => ({
                onClick: () => handleNavigate('/search/realtime'),
                style: { cursor: 'pointer' },
              })}
            />
          </Card>
        </Col>
      </Row>

      {/* 快速操作 + 审计日志 */}
      <Row gutter={[24, 24]}>
        {/* 快速操作入口 */}
        <Col xs={24} lg={12}>
          <div className="flex flex-col gap-3 h-full justify-center">
            {/* 大按钮: 新建采集源 */}
            <Card
              hoverable
              styles={{ body: { padding: '16px' } }}
              onClick={() => handleNavigate('/ingestion/wizard')}
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

            {/* 大按钮: 新建告警规则 */}
            <Card
              hoverable
              styles={{ body: { padding: '16px' } }}
              onClick={() => handleNavigate('/alerts/rules')}
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

            {/* 小按钮: 创建索引 + 生成报表 */}
            <Row gutter={12}>
              <Col span={12}>
                <Card
                  hoverable
                  styles={{ body: { padding: '12px', textAlign: 'center' } }}
                  onClick={() => handleNavigate('/storage/indices')}
                >
                  <span className="material-symbols-outlined opacity-50 mb-1">database</span>
                  <div className="text-xs font-medium">创建索引</div>
                </Card>
              </Col>
              <Col span={12}>
                <Card
                  hoverable
                  styles={{ body: { padding: '12px', textAlign: 'center' } }}
                  onClick={() => handleNavigate('/reports/management')}
                >
                  <span className="material-symbols-outlined opacity-50 mb-1">description</span>
                  <div className="text-xs font-medium">生成报表</div>
                </Card>
              </Col>
            </Row>
          </div>
        </Col>

        {/* 最近审计活动 */}
        <Col xs={24} lg={12}>
          <Card
            title={<span className="text-sm font-bold">最近审计活动</span>}
            extra={
              <Button type="link" size="small" onClick={() => handleNavigate('/security/audit')}>
                查看全部
              </Button>
            }
          >
            <div className="space-y-4">
              {AUDIT_LOG_DATA.map((audit, idx) => {
                const cfg = auditTypeConfig[audit.type] || auditTypeConfig.update;
                return (
                  <div key={idx} className="flex items-center gap-3 text-xs">
                    <div className="w-[60px] shrink-0 text-right opacity-50">{audit.time}</div>
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
              })}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
