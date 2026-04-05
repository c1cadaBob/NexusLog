import React from 'react';
import { Button, Card, Tag, Progress, Input } from 'antd';
import { useThemeStore } from '../../stores/themeStore';
import { COLORS, DARK_PALETTE, LIGHT_PALETTE } from '../../theme/tokens';

// ============================================================================
// 模拟数据
// ============================================================================

const budgets = [
  {
    name: 'Q3 营销日志预算 (Marketing Log)',
    icon: 'campaign',
    iconColor: COLORS.primary,
    group: '运维团队, 市场部负责人',
    used: 36000, total: 80000, percent: 45,
    threshold: 80, start: '2023-10-01',
    status: 'normal' as const,
  },
  {
    name: '核心生产环境日志 (Core Prod)',
    icon: 'dns',
    iconColor: COLORS.warning,
    group: '核心开发组, CTO',
    used: 41000, total: 50000, percent: 82,
    threshold: 80, start: '2023-10-01',
    status: 'warning' as const,
  },
  {
    name: '测试环境 Debug (Test Env)',
    icon: 'bug_report',
    iconColor: COLORS.danger,
    group: '测试团队',
    used: 12500, total: 10000, percent: 125,
    threshold: 80, start: '2023-10-01',
    status: 'critical' as const,
  },
];

const alertHistory = [
  { time: '2023-10-15 14:32', name: '测试环境 Debug', type: '超支告警', typeColor: COLORS.danger, value: '125%', status: '处理中', statusColor: COLORS.warning },
  { time: '2023-10-14 09:15', name: '核心生产环境日志', type: '阈值预警', typeColor: COLORS.warning, value: '82%', status: '已通知', statusColor: COLORS.primary },
  { time: '2023-10-10 16:45', name: 'Q3 营销日志预算', type: '阈值预警', typeColor: COLORS.warning, value: '80%', status: '已解决', statusColor: COLORS.success },
];

// ============================================================================
// 组件
// ============================================================================

const BudgetAlerts: React.FC = () => {
  const isDark = useThemeStore((s) => s.isDark);
  const p = isDark ? DARK_PALETTE : LIGHT_PALETTE;

  const statusLabel = (s: string) => {
    if (s === 'normal') return { text: '正常', color: 'success' as const };
    if (s === 'warning') return { text: '预警', color: 'warning' as const };
    return { text: '严重超支', color: 'error' as const };
  };

  const progressColor = (s: string) => {
    if (s === 'normal') return COLORS.primary;
    if (s === 'warning') return COLORS.warning;
    return COLORS.danger;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, height: '100%' }}>
      {/* 头部 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>预算告警管理</h2>
          <Tag color="blue">企业版</Tag>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button onClick={() => { window.location.hash = '#/help/faq'; }} icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>help</span>}>
            帮助
          </Button>
          <Input
            prefix={<span className="material-symbols-outlined" style={{ fontSize: 18, color: p.textSecondary }}>search</span>}
            placeholder="搜索预算策略..."
            style={{ width: 240 }}
          />
          <Button type="primary" icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>}>
            新建预算
          </Button>
        </div>
      </div>

      {/* 汇总卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
        <Card size="small" styles={{ body: { padding: '20px' } }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 13, color: p.textSecondary, fontWeight: 500 }}>本月总预算</div>
              <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>¥120,000</div>
            </div>
            <div style={{ padding: 8, borderRadius: 8, background: `${COLORS.primary}1a` }}>
              <span className="material-symbols-outlined" style={{ color: COLORS.primary }}>account_balance_wallet</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <span style={{ color: COLORS.success, display: 'flex', alignItems: 'center', fontWeight: 500 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>trending_up</span>+2.5%
            </span>
            <span style={{ color: p.textSecondary }}>较上月</span>
          </div>
        </Card>

        <Card size="small" styles={{ body: { padding: '20px' } }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 13, color: p.textSecondary, fontWeight: 500 }}>当前预测支出</div>
              <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>¥85,400</div>
            </div>
            <div style={{ padding: 8, borderRadius: 8, background: `${COLORS.purple}1a` }}>
              <span className="material-symbols-outlined" style={{ color: COLORS.purple }}>query_stats</span>
            </div>
          </div>
          <div style={{ fontSize: 13, color: p.textSecondary }}>剩余可用: ¥34,600</div>
        </Card>

        <Card size="small" styles={{ body: { padding: '20px' } }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 13, color: p.textSecondary, fontWeight: 500 }}>已触发告警</div>
              <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>2</div>
            </div>
            <div style={{ padding: 8, borderRadius: 8, background: `${COLORS.warning}1a` }}>
              <span className="material-symbols-outlined" style={{ color: COLORS.warning }}>warning</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <span style={{ color: COLORS.danger, fontWeight: 500 }}>1 个严重告警</span>
            <span style={{ width: 4, height: 4, borderRadius: '50%', background: p.textTertiary, display: 'inline-block' }} />
            <span style={{ color: COLORS.warning, fontWeight: 500 }}>1 个预警</span>
          </div>
        </Card>
      </div>

      {/* 活跃预算监控 */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>活跃预算监控</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {['全部', '正常', '告警中'].map((label, i) => (
              <Button key={label} size="small" type={i === 0 ? 'default' : 'text'}>{label}</Button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {budgets.map(budget => {
            const sl = statusLabel(budget.status);
            const borderLeft = budget.status !== 'normal'
              ? { borderLeft: `3px solid ${progressColor(budget.status)}` }
              : {};
            return (
              <Card key={budget.name} size="small" styles={{ body: { padding: '20px' } }} style={borderLeft}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
                  {/* 左侧信息 */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1, minWidth: 240 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 8, background: `${budget.iconColor}1a`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span className="material-symbols-outlined" style={{ color: budget.iconColor }}>{budget.icon}</span>
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{budget.name}</span>
                        <Tag color={sl.color}>{sl.text}</Tag>
                      </div>
                      <div style={{ fontSize: 13, color: p.textSecondary, marginTop: 4 }}>通知组: {budget.group}</div>
                    </div>
                  </div>

                  {/* 中间进度 */}
                  <div style={{ flex: 1, maxWidth: 400, minWidth: 200 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                      <span style={{ color: p.textSecondary }}>已用 ¥{budget.used.toLocaleString()}</span>
                      <span style={{ fontWeight: 500, color: budget.status === 'warning' ? COLORS.warning : budget.status === 'critical' ? COLORS.danger : undefined }}>
                        ¥{budget.total.toLocaleString()} ({budget.percent}%)
                      </span>
                    </div>
                    <Progress
                      percent={Math.min(budget.percent, 100)}
                      showInfo={false}
                      strokeColor={progressColor(budget.status)}
                      size="small"
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: p.textSecondary, marginTop: 4 }}>
                      <span>开始: {budget.start}</span>
                      {budget.status === 'normal' && <span>告警阈值: {budget.threshold}%</span>}
                      {budget.status === 'warning' && <span style={{ color: COLORS.warning }}>已超阈值 {budget.percent - budget.threshold}%</span>}
                      {budget.status === 'critical' && <span style={{ color: COLORS.danger }}>已超支 ¥{(budget.used - budget.total).toLocaleString()}</span>}
                    </div>
                  </div>

                  {/* 右侧操作 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 16, borderLeft: `1px solid ${p.border}` }}>
                    <Button type="text" size="small" icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit</span>} title="编辑" />
                    <Button type="text" size="small" icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>history</span>} title="历史记录" />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* 告警历史记录 */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>告警历史记录</div>
          <Button type="link" size="small" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            查看全部
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span>
          </Button>
        </div>
        <Card size="small" styles={{ body: { padding: 0 } }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: isDark ? '#151c2a' : '#f8fafc' }}>
                {['时间', '预算名称', '告警类型', '触发值', '状态'].map(h => (
                  <th key={h} style={{ padding: '12px 24px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: p.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {alertHistory.map((row, idx) => (
                <tr key={idx} style={{ borderTop: `1px solid ${p.border}` }}>
                  <td style={{ padding: '14px 24px', color: p.textSecondary }}>{row.time}</td>
                  <td style={{ padding: '14px 24px', fontWeight: 500 }}>{row.name}</td>
                  <td style={{ padding: '14px 24px' }}>
                    <Tag style={{ background: `${row.typeColor}1a`, color: row.typeColor, border: 'none' }}>{row.type}</Tag>
                  </td>
                  <td style={{ padding: '14px 24px' }}>{row.value}</td>
                  <td style={{ padding: '14px 24px' }}>
                    <Tag style={{ background: `${row.statusColor}1a`, color: row.statusColor, border: 'none' }}>{row.status}</Tag>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
};

export default BudgetAlerts;
