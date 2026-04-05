import React from 'react';
import { Button, Card, Tag } from 'antd';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { LineChart, PieChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { useThemeStore } from '../../stores/themeStore';
import { COLORS, DARK_PALETTE, LIGHT_PALETTE } from '../../theme/tokens';

echarts.use([LineChart, PieChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

// ============================================================================
// 模拟数据
// ============================================================================

const trendData = [
  { day: '1日', cost: 1200 }, { day: '5日', cost: 1350 }, { day: '10日', cost: 1100 },
  { day: '15日', cost: 1600 }, { day: '20日', cost: 1450 }, { day: '25日', cost: 1800 },
  { day: '30日', cost: 1550 },
];

const storageData = [
  { name: '热存储 (Hot)', value: 12500, color: COLORS.primary },
  { name: '温存储 (Warm)', value: 5200, color: COLORS.warning },
  { name: '冷存储 (Cold)', value: 1800, color: COLORS.success },
];

const items = [
  { name: 'app-logs-2023.10', project: '电商核心 (E-comm)', vol: '12.5 TB', retention: '30 天', cost: '¥1,250.00', status: 'Healthy' },
  { name: 'payment-gateway-trans', project: '支付系统 (Fintech)', vol: '8.2 TB', retention: '90 天', cost: '¥2,400.00', status: 'Healthy' },
  { name: 'audit-trails-archive', project: '安全审计 (SecOps)', vol: '45.0 TB', retention: '365 天', cost: '¥900.00', status: 'Warning' },
  { name: 'mobile-sdk-crash', project: '用户中心 (User)', vol: '4.1 TB', retention: '14 天', cost: '¥410.00', status: 'Healthy' },
  { name: 'k8s-cluster-metrics', project: '基础架构 (Infra)', vol: '18.3 TB', retention: '7 天', cost: '¥1,830.00', status: 'Healthy' },
];

// ============================================================================
// 组件
// ============================================================================

const CostOverview: React.FC = () => {
  const isDark = useThemeStore((s) => s.isDark);
  const p = isDark ? DARK_PALETTE : LIGHT_PALETTE;

  // ECharts 成本趋势图配置
  const trendChartOption = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderColor: p.border,
      textStyle: { color: isDark ? '#fff' : '#1e293b', fontSize: 12 },
    },
    grid: { top: 30, right: 20, bottom: 30, left: 50 },
    xAxis: {
      type: 'category',
      data: trendData.map(d => d.day),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: p.textSecondary, fontSize: 12 },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: p.border, type: 'dashed', opacity: 0.5 } },
      axisLabel: { color: p.textSecondary, fontSize: 12, formatter: '¥{value}' },
    },
    series: [
      {
        name: '成本',
        type: 'line',
        data: trendData.map(d => d.cost),
        smooth: true,
        lineStyle: { width: 3, color: COLORS.primary },
        itemStyle: { color: COLORS.primary },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: `${COLORS.primary}4d` },
            { offset: 1, color: `${COLORS.primary}00` },
          ]),
        },
        showSymbol: false,
      },
    ],
  };

  // ECharts 存储成本饼图配置
  const pieChartOption = {
    tooltip: {
      trigger: 'item',
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderColor: p.border,
      textStyle: { color: isDark ? '#fff' : '#1e293b', fontSize: 12 },
      formatter: '{b}: ¥{c} ({d}%)',
    },
    series: [
      {
        type: 'pie',
        radius: ['55%', '75%'],
        center: ['50%', '50%'],
        padAngle: 3,
        itemStyle: { borderRadius: 4 },
        label: { show: false },
        data: storageData.map(d => ({ value: d.value, name: d.name, itemStyle: { color: d.color } })),
      },
    ],
  };

  const retentionColor = (item: typeof items[0]) => {
    if (item.status === 'Warning') return undefined;
    if (item.retention === '14 天' || item.retention === '7 天') return COLORS.primary;
    return COLORS.warning;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, height: '100%' }}>
      {/* 头部 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>成本概览</h2>
          <div style={{ fontSize: 13, color: p.textSecondary, marginTop: 4 }}>实时监控您的基础设施支出与资源使用情况</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button onClick={() => { window.location.hash = '#/help/faq'; }} icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>help</span>}>
            帮助
          </Button>
          <Button style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>calendar_today</span>
            最近 30 天
          </Button>
          <Button type="primary" icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>download</span>}>
            导出报告
          </Button>
        </div>
      </div>

      {/* KPI 卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {/* 本月总成本 */}
        <Card size="small" styles={{ body: { padding: '20px' } }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div style={{ fontSize: 13, color: p.textSecondary, fontWeight: 500 }}>本月总成本 (MTD)</div>
            <span className="material-symbols-outlined" style={{ fontSize: 20, color: p.textTertiary }}>payments</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 24, fontWeight: 700 }}>¥45,230</span>
            <Tag color="success" style={{ fontSize: 11, lineHeight: '18px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 12, verticalAlign: 'middle', marginRight: 2 }}>trending_up</span>
              12%
            </Tag>
          </div>
          <div style={{ fontSize: 12, color: p.textTertiary, marginTop: 8 }}>较上月同期增加 ¥4,200</div>
        </Card>

        {/* 日均支出 */}
        <Card size="small" styles={{ body: { padding: '20px' } }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div style={{ fontSize: 13, color: p.textSecondary, fontWeight: 500 }}>日均支出</div>
            <span className="material-symbols-outlined" style={{ fontSize: 20, color: p.textTertiary }}>calendar_view_day</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 24, fontWeight: 700 }}>¥1,500</span>
            <Tag color="success" style={{ fontSize: 11, lineHeight: '18px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 12, verticalAlign: 'middle', marginRight: 2 }}>trending_up</span>
              5%
            </Tag>
          </div>
          <div style={{ fontSize: 12, color: p.textTertiary, marginTop: 8 }}>波动范围: ±¥200</div>
        </Card>

        {/* 预计本月总额 */}
        <Card size="small" styles={{ body: { padding: '20px' } }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div style={{ fontSize: 13, color: p.textSecondary, fontWeight: 500 }}>预计本月总额</div>
            <span className="material-symbols-outlined" style={{ fontSize: 20, color: p.textTertiary }}>query_stats</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 24, fontWeight: 700 }}>¥48,000</span>
            <Tag color="error" style={{ fontSize: 11, lineHeight: '18px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 12, verticalAlign: 'middle', marginRight: 2 }}>warning</span>
              超预算
            </Tag>
          </div>
          <div style={{ fontSize: 12, color: p.textTertiary, marginTop: 8 }}>当前预算: ¥45,000</div>
        </Card>

        {/* 存储/计算比率 */}
        <Card size="small" styles={{ body: { padding: '20px' } }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div style={{ fontSize: 13, color: p.textSecondary, fontWeight: 500 }}>存储 / 计算比率</div>
            <span className="material-symbols-outlined" style={{ fontSize: 20, color: p.textTertiary }}>pie_chart</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontSize: 24, fontWeight: 700 }}>60%</span>
            <span style={{ fontSize: 14, color: p.textSecondary }}>/ 40%</span>
          </div>
          <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 12, background: p.border }}>
            <div style={{ width: '60%', background: COLORS.primary, borderRadius: '3px 0 0 3px' }} />
            <div style={{ width: '40%', background: COLORS.purple }} />
          </div>
        </Card>
      </div>

      {/* 图表区域 */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
        {/* 成本趋势图 */}
        <Card size="small" styles={{ body: { padding: '24px' } }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>业务组成本趋势</div>
              <div style={{ fontSize: 12, color: p.textSecondary, marginTop: 4 }}>过去 30 天各业务线花费详情</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, color: p.textSecondary }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS.primary, display: 'inline-block' }} />
                电商核心
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS.purple, display: 'inline-block' }} />
                物流服务
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS.success, display: 'inline-block' }} />
                用户中心
              </span>
            </div>
          </div>
          <ReactEChartsCore echarts={echarts} option={trendChartOption} style={{ height: 280 }} notMerge />
        </Card>

        {/* 存储成本细分 */}
        <Card size="small" styles={{ body: { padding: '24px' } }}>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>存储成本细分</div>
            <div style={{ fontSize: 12, color: p.textSecondary, marginTop: 4 }}>按存储类型 (热/温/冷)</div>
          </div>
          <div style={{ position: 'relative' }}>
            <ReactEChartsCore echarts={echarts} option={pieChartOption} style={{ height: 200 }} notMerge />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <span style={{ fontSize: 22, fontWeight: 700 }}>120 TB</span>
              <span style={{ fontSize: 12, color: p.textSecondary }}>总存储量</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
            {storageData.map(entry => (
              <div key={entry.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: p.textSecondary }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: entry.color, display: 'inline-block' }} />
                  {entry.name}
                </div>
                <span style={{ fontWeight: 500 }}>¥{entry.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* 索引/项目成本明细表格 */}
      <Card size="small" styles={{ body: { padding: 0 } }}>
        <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${p.border}` }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>索引/项目成本明细</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ position: 'relative' }}>
              <span className="material-symbols-outlined" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: p.textSecondary }}>search</span>
              <input
                id="cost-overview-search"
                name="costOverviewSearch"
                placeholder="搜索项目或索引..."
                style={{
                  paddingLeft: 34, paddingRight: 12, paddingTop: 7, paddingBottom: 7,
                  fontSize: 13, borderRadius: 8, border: `1px solid ${p.border}`,
                  background: p.bgContainer, color: p.text, outline: 'none', width: 240,
                }}
              />
            </div>
            <Button icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>filter_list</span>} />
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: isDark ? '#151c2a' : '#f8fafc' }}>
                <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: p.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>索引名称 (Index)</th>
                <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: p.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>所属项目</th>
                <th style={{ padding: '12px 24px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: p.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>数据量 (Vol)</th>
                <th style={{ padding: '12px 24px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: p.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>保留周期</th>
                <th style={{ padding: '12px 24px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: p.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>预估成本 (Est.)</th>
                <th style={{ padding: '12px 24px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: p.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>状态</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} style={{ borderTop: `1px solid ${p.border}` }}>
                  <td style={{ padding: '14px 24px', fontWeight: 500, fontFamily: 'monospace' }}>{item.name}</td>
                  <td style={{ padding: '14px 24px', color: p.textSecondary }}>{item.project}</td>
                  <td style={{ padding: '14px 24px', textAlign: 'right', fontFamily: 'monospace', color: p.textSecondary }}>{item.vol}</td>
                  <td style={{ padding: '14px 24px', textAlign: 'center' }}>
                    <Tag color={retentionColor(item) === COLORS.primary ? 'blue' : retentionColor(item) === COLORS.warning ? 'orange' : 'default'}>
                      {item.retention}
                    </Tag>
                  </td>
                  <td style={{ padding: '14px 24px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 500 }}>{item.cost}</td>
                  <td style={{ padding: '14px 24px', textAlign: 'center' }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%', margin: '0 auto',
                      background: item.status === 'Warning' ? COLORS.warning : COLORS.success,
                      animation: item.status === 'Warning' ? 'pulse 2s infinite' : undefined,
                    }} title={item.status === 'Warning' ? '接近配额' : '正常'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* 分页 */}
        <div style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: `1px solid ${p.border}`, fontSize: 13, color: p.textSecondary }}>
          <span>显示 1 至 5 共 48 项</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <Button size="small" disabled>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_left</span>
            </Button>
            <Button size="small" type="primary">1</Button>
            <Button size="small">2</Button>
            <Button size="small">3</Button>
            <span style={{ padding: '0 4px', color: p.textTertiary }}>...</span>
            <Button size="small">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_right</span>
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default CostOverview;
