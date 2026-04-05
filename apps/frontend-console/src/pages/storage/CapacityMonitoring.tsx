import React from 'react';
import { Button, Card, Tag, Progress } from 'antd';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { useThemeStore } from '../../stores/themeStore';
import { COLORS, DARK_PALETTE, LIGHT_PALETTE } from '../../theme/tokens';

echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

// ============================================================================
// 模拟数据
// ============================================================================

const growthData = [
  { day: '1日', value: 4.5, predict: null as number | null },
  { day: '3日', value: 5.2, predict: null },
  { day: '5日', value: 5.8, predict: null },
  { day: '7日', value: 6.3, predict: null },
  { day: '9日', value: 6.9, predict: null },
  { day: '11日', value: 7.4, predict: null },
  { day: '13日', value: 8.0, predict: null },
  { day: '15日', value: 8.5, predict: null },
  { day: '17日', value: 9.1, predict: null },
  { day: '19日', value: 9.8, predict: null },
  { day: '21日', value: 10.4, predict: null },
  { day: '23日', value: 11.2, predict: 11.2 },
  { day: '25日', value: null, predict: 11.8 },
  { day: '27日', value: null, predict: 12.5 },
  { day: '29日', value: null, predict: 13.1 },
  { day: '30日', value: null, predict: 13.5 },
];

const topIndices = [
  { name: 'app-logs-2023-10', category: 'Standard Log', size: '2.4 TB', percent: 85 },
  { name: 'nginx-access', category: 'Web Server', size: '1.8 TB', percent: 65 },
  { name: 'syslog-critical', category: 'System', size: '1.2 TB', percent: 45 },
  { name: 'audit-trail-2023', category: 'Security', size: '0.8 TB', percent: 30 },
];

// ============================================================================
// 组件
// ============================================================================

const CapacityMonitoring: React.FC = () => {
  const isDark = useThemeStore((s) => s.isDark);
  const p = isDark ? DARK_PALETTE : LIGHT_PALETTE;

  // ECharts 增长趋势图配置
  const growthChartOption = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderColor: p.border,
      textStyle: { color: isDark ? '#fff' : '#1e293b', fontSize: 12 },
      formatter: (params: any[]) => {
        const day = params[0]?.axisValue || '';
        const lines = params.map((item: any) => {
          const name = item.seriesName === 'value' ? '实际总量' : '预测总量';
          const val = item.value != null ? `${item.value} TB` : '--';
          return `${item.marker} ${name}: ${val}`;
        });
        return `${day}<br/>${lines.join('<br/>')}`;
      },
    },
    grid: { top: 30, right: 20, bottom: 30, left: 50 },
    xAxis: {
      type: 'category',
      data: growthData.map(d => d.day),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: p.textSecondary, fontSize: 12 },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 16,
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: p.border, type: 'dashed', opacity: 0.5 } },
      axisLabel: { color: p.textSecondary, fontSize: 12, formatter: '{value}TB' },
    },
    series: [
      {
        name: 'value',
        type: 'line',
        data: growthData.map(d => d.value),
        smooth: true,
        lineStyle: { width: 3, color: COLORS.primary },
        itemStyle: { color: COLORS.primary },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: `${COLORS.primary}4d` },
            { offset: 1, color: `${COLORS.primary}00` },
          ]),
        },
        connectNulls: false,
        showSymbol: false,
      },
      {
        name: 'predict',
        type: 'line',
        data: growthData.map(d => d.predict),
        smooth: true,
        lineStyle: { width: 2, color: '#60a5fa', type: 'dashed' },
        itemStyle: { color: '#60a5fa' },
        connectNulls: false,
        showSymbol: false,
      },
    ],
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, height: '100%' }}>
      {/* 头部 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>容量监控</h2>
          <Tag color="success">运行正常</Tag>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button onClick={() => { window.location.hash = '#/help/faq'; }} icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>help</span>}>
            帮助
          </Button>
          <Button style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>calendar_today</span>
            最近 30 天
          </Button>
          <Button icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>cleaning_services</span>}>清理缓存</Button>
          <Button type="primary" icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>add_circle</span>}>扩容建议</Button>
        </div>
      </div>

      {/* 英雄指标卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
        {/* 总磁盘使用率 */}
        <Card size="small" styles={{ body: { padding: '24px' } }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: p.textSecondary, fontWeight: 500, marginBottom: 4 }}>总磁盘使用率</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 28, fontWeight: 700 }}>78%</span>
                <span style={{ fontSize: 13, color: COLORS.success, display: 'flex', alignItems: 'center' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>trending_up</span>
                  +2.4%
                </span>
              </div>
              <div style={{ fontSize: 12, color: p.textSecondary, marginTop: 8 }}>12.48 TB / 16.00 TB</div>
              <Progress percent={78} showInfo={false} strokeColor={COLORS.primary} style={{ marginTop: 12 }} />
            </div>
            <div style={{ padding: 8, borderRadius: 8, background: `${COLORS.primary}1a` }}>
              <span className="material-symbols-outlined" style={{ color: COLORS.primary }}>pie_chart</span>
            </div>
          </div>
        </Card>

        {/* 今日新增数据 */}
        <Card size="small" styles={{ body: { padding: '24px' } }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: p.textSecondary, fontWeight: 500, marginBottom: 4 }}>今日新增数据</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 28, fontWeight: 700 }}>128 GB</span>
                <span style={{ fontSize: 13, color: COLORS.success, display: 'flex', alignItems: 'center' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_drop_down</span>
                  -5% 环比
                </span>
              </div>
              <div style={{ fontSize: 12, color: p.textSecondary, marginTop: 8 }}>平均日增量: 135 GB</div>
              {/* 迷你柱状图 */}
              <div style={{ display: 'flex', gap: 3, marginTop: 12, height: 32, alignItems: 'flex-end' }}>
                {[40, 60, 30, 80, 50, 70].map((h, i) => (
                  <div key={i} style={{
                    flex: 1, borderRadius: '2px 2px 0 0', transition: 'background 0.2s',
                    height: `${h}%`,
                    background: i === 5 ? `${COLORS.primary}cc` : (isDark ? 'rgba(255,255,255,0.05)' : '#e2e8f0'),
                  }} />
                ))}
              </div>
            </div>
            <div style={{ padding: 8, borderRadius: 8, background: `${COLORS.warning}1a` }}>
              <span className="material-symbols-outlined" style={{ color: COLORS.warning }}>trending_up</span>
            </div>
          </div>
        </Card>

        {/* 预计可用天数 */}
        <Card size="small" styles={{ body: { padding: '24px', background: isDark ? undefined : `linear-gradient(135deg, #fff, ${COLORS.primary}08)` } }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: p.textSecondary, fontWeight: 500, marginBottom: 4 }}>预计可用天数</div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>42 天</div>
              <div style={{ fontSize: 12, color: p.textSecondary, marginTop: 8 }}>基于当前增长趋势预测</div>
              <div style={{
                marginTop: 12, display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 12px', borderRadius: 8,
                background: `${COLORS.warning}1a`, border: `1px solid ${COLORS.warning}33`,
              }}>
                <span className="material-symbols-outlined" style={{ color: COLORS.warning, fontSize: 18 }}>warning</span>
                <span style={{ fontSize: 12, color: COLORS.warning }}>建议在 30 天内进行扩容规划</span>
              </div>
            </div>
            <div style={{ padding: 8, borderRadius: 8, background: `${COLORS.purple}1a` }}>
              <span className="material-symbols-outlined" style={{ color: COLORS.purple }}>schedule</span>
            </div>
          </div>
        </Card>
      </div>

      {/* 图表区域 */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
        {/* 增长趋势图 */}
        <Card size="small" styles={{ body: { padding: '24px' } }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>近30天存储增长趋势</div>
              <div style={{ fontSize: 12, color: p.textSecondary, marginTop: 4 }}>数据总量持续上升，需关注月底峰值</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, color: p.textSecondary }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS.primary, display: 'inline-block' }} />
                总量
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#60a5fa', border: '1px dashed #60a5fa', display: 'inline-block' }} />
                预测
              </span>
            </div>
          </div>
          <ReactEChartsCore echarts={echarts} option={growthChartOption} style={{ height: 280 }} notMerge />
        </Card>

        {/* 冷热数据分布 */}
        <Card size="small" styles={{ body: { padding: '24px' } }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>冷热数据分布 (Tier)</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            {/* SVG 环形图 */}
            <div style={{ position: 'relative', width: 128, height: 128, flexShrink: 0 }}>
              <svg width="128" height="128" viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)' }}>
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none" stroke={p.border} strokeWidth="4" />
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none" stroke={COLORS.primary} strokeWidth="4" strokeDasharray="20, 100" />
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none" stroke={COLORS.purple} strokeWidth="4" strokeDasharray="30, 100" strokeDashoffset="-20" />
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none" stroke={COLORS.cyan} strokeWidth="4" strokeDasharray="50, 100" strokeDashoffset="-50" />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 11, color: p.textSecondary }}>总计</span>
                <span style={{ fontSize: 13, fontWeight: 700 }}>12.4TB</span>
              </div>
            </div>
            {/* 图例 */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'Hot (热)', color: COLORS.primary, value: '2.5TB' },
                { label: 'Warm (温)', color: COLORS.purple, value: '3.7TB' },
                { label: 'Cold (冷)', color: COLORS.cyan, value: '6.2TB' },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.color }} />
                    <span style={{ fontSize: 12, color: p.textSecondary }}>{item.label}</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 500 }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Top 5 索引占用排名 */}
      <Card size="small" styles={{ body: { padding: '24px' } }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Top 5 索引占用排名</div>
          <a style={{ fontSize: 12, color: COLORS.primary, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            查看全部
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_forward</span>
          </a>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {topIndices.map(item => (
            <div key={item.name} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: 16, alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{item.name}</div>
                <div style={{ fontSize: 12, color: p.textSecondary }}>{item.category}</div>
              </div>
              <Progress percent={item.percent} showInfo={false} strokeColor={COLORS.primary} />
              <div style={{ fontSize: 13, fontWeight: 500, minWidth: 60, textAlign: 'right' }}>{item.size}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default CapacityMonitoring;
