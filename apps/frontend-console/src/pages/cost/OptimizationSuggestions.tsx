import React from 'react';
import { Button, Card, Tag, Input, Switch } from 'antd';
import { useThemeStore } from '../../stores/themeStore';
import { COLORS, DARK_PALETTE, LIGHT_PALETTE } from '../../theme/tokens';

// ============================================================================
// 模拟数据
// ============================================================================

const suggestions = [
  {
    title: 'Move index [app-logs-old] to Cold Storage',
    resource: 'Elasticsearch Cluster A',
    icon: 'inventory_2', iconColor: '#f97316', // orange
    risk: 'Medium Risk', riskColor: '#f97316',
    savings: '¥4,200', impact: 'Slower query > 5s',
    impactIcon: 'speed', impactColor: '#fb923c',
    note: 'Data older than 90 days is rarely accessed.',
  },
  {
    title: 'Delete duplicated ingestion source',
    resource: 'Logstash Pipeline #2',
    icon: 'delete_forever', iconColor: COLORS.danger,
    risk: 'Low Risk', riskColor: COLORS.success,
    savings: '¥850', impact: 'No negative impact',
    impactIcon: 'check_circle', impactColor: COLORS.success,
    note: 'Identical stream found in Pipeline #1.',
  },
  {
    title: 'Enable Zstd compression',
    resource: 'All Indices',
    icon: 'compress', iconColor: COLORS.info,
    risk: 'Low Risk', riskColor: COLORS.success,
    savings: '¥2,100', impact: '+5% CPU Usage',
    impactIcon: 'memory', impactColor: '#60a5fa',
    note: 'Reduce disk space by ~30%.',
  },
  {
    title: 'Reduce retention period (Dev)',
    resource: 'Dev Environment',
    icon: 'history', iconColor: COLORS.purple,
    risk: 'High Risk', riskColor: COLORS.danger,
    savings: '¥5,300', impact: 'Data loss > 7 days',
    impactIcon: 'warning', impactColor: COLORS.danger,
    note: 'Change from 30 days to 7 days.',
  },
];

// ============================================================================
// 组件
// ============================================================================

const OptimizationSuggestions: React.FC = () => {
  const isDark = useThemeStore((s) => s.isDark);
  const p = isDark ? DARK_PALETTE : LIGHT_PALETTE;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, height: '100%' }}>
      {/* 头部 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="material-symbols-outlined" style={{ color: COLORS.primary, fontSize: 24 }}>savings</span>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>优化建议 (Optimization Suggestions)</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button type="text" icon={<span className="material-symbols-outlined" style={{ fontSize: 20 }}>notifications</span>} />
          <Button type="text" icon={<span className="material-symbols-outlined" style={{ fontSize: 20 }}>help</span>} />
        </div>
      </div>

      {/* Hero / 汇总区域 */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        {/* 总节省金额卡片 */}
        <Card size="small" styles={{ body: { padding: '24px', position: 'relative', overflow: 'hidden' } }}>
          <div style={{
            position: 'absolute', right: 0, top: 0, height: '100%', width: '33%',
            background: `linear-gradient(to left, ${COLORS.primary}1a, transparent)`, pointerEvents: 'none',
          }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: 11, color: p.textSecondary, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Total Potential Savings</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <span style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.02em' }}>¥12,450</span>
              <span style={{ fontSize: 13, color: p.textSecondary, fontWeight: 500 }}>/ month</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <Tag color="success" style={{ fontSize: 11 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: 'middle', marginRight: 2 }}>trending_up</span>
                +15%
              </Tag>
              <span style={{ fontSize: 12, color: p.textSecondary }}>compared to last month's analysis</span>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <Button type="primary" size="large" style={{ fontWeight: 600 }}>
                Apply All Recommendations
                <span className="material-symbols-outlined" style={{ fontSize: 18, marginLeft: 4 }}>bolt</span>
              </Button>
              <Button size="large">Download Report</Button>
            </div>
          </div>
        </Card>

        {/* Auto-Pilot 卡片 */}
        <Card
          size="small"
          styles={{
            body: {
              padding: '24px', position: 'relative', overflow: 'hidden',
              background: `linear-gradient(135deg, ${COLORS.primary}, #1d4ed8)`,
              color: '#fff', borderRadius: 8,
            },
          }}
          style={{ border: 'none' }}
        >
          <div style={{ position: 'absolute', right: -24, top: -24, width: 128, height: 128, background: 'rgba(255,255,255,0.1)', borderRadius: '50%', filter: 'blur(32px)' }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span className="material-symbols-outlined">auto_fix_high</span>
              <span style={{ fontWeight: 700, fontSize: 16 }}>Auto-Pilot</span>
            </div>
            <p style={{ color: 'rgba(191,219,254,1)', fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
              Automatically apply optimizations for items classified as "Low Risk".
            </p>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'rgba(255,255,255,0.1)', padding: '10px 14px', borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)',
            }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>Enable Auto-Optimize</span>
              <Switch size="small" />
            </div>
          </div>
        </Card>
      </div>

      {/* 筛选 & 搜索 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button type="primary" size="small">All Suggestions (5)</Button>
          <Button size="small">High Impact (2)</Button>
          <Button size="small">Low Risk (3)</Button>
        </div>
        <Input
          prefix={<span className="material-symbols-outlined" style={{ fontSize: 18, color: p.textSecondary }}>search</span>}
          placeholder="Search resources..."
          style={{ width: 240 }}
        />
      </div>

      {/* 建议卡片网格 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        {suggestions.map(s => (
          <Card key={s.title} size="small" hoverable styles={{ body: { padding: '20px' } }}>
            {/* 标题行 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: `${s.iconColor}1a`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span className="material-symbols-outlined" style={{ color: s.iconColor }}>{s.icon}</span>
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{s.title}</div>
                  <div style={{ fontSize: 12, color: p.textSecondary, marginTop: 4 }}>Resource: {s.resource}</div>
                </div>
              </div>
              <Tag style={{ background: `${s.riskColor}1a`, color: s.riskColor, border: 'none', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {s.risk}
              </Tag>
            </div>

            {/* 指标行 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div style={{ padding: 12, borderRadius: 8, background: isDark ? '#111722' : '#f8fafc', border: `1px solid ${p.border}` }}>
                <div style={{ fontSize: 12, color: p.textSecondary, marginBottom: 4 }}>Potential Savings</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{s.savings}<span style={{ fontSize: 12, fontWeight: 400, color: p.textSecondary, marginLeft: 4 }}>/mo</span></div>
              </div>
              <div style={{ padding: 12, borderRadius: 8, background: isDark ? '#111722' : '#f8fafc', border: `1px solid ${p.border}` }}>
                <div style={{ fontSize: 12, color: p.textSecondary, marginBottom: 4 }}>Impact Analysis</div>
                <div style={{ fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16, color: s.impactColor }}>{s.impactIcon}</span>
                  {s.impact}
                </div>
              </div>
            </div>

            {/* 底部操作 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 16, borderTop: `1px solid ${p.border}` }}>
              <span style={{ fontSize: 12, color: p.textSecondary }}>{s.note}</span>
              <Button type="primary" size="small">Apply Now</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default OptimizationSuggestions;
