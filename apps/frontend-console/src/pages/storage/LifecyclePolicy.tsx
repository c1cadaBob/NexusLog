import React, { useState } from 'react';
import { Input, Button, Card, Tag, Space } from 'antd';
import { useThemeStore } from '../../stores/themeStore';
import { COLORS, DARK_PALETTE, LIGHT_PALETTE } from '../../theme/tokens';

// ============================================================================
// 阶段配置
// ============================================================================

const PHASE_CONFIG = {
  Hot: { icon: 'local_fire_department', color: COLORS.danger },
  Warm: { icon: 'thermostat', color: COLORS.warning },
  Cold: { icon: 'ac_unit', color: COLORS.info },
  Delete: { icon: 'delete', color: '#64748b' },
} as const;

type Phase = keyof typeof PHASE_CONFIG;

interface PolicyData {
  name: string;
  status: 'Active' | 'Error';
  indexCount: number;
  updatedAgo: string;
  phases: { from: Phase; to: Phase; condition: string }[];
  lastRun: { ok: boolean; message: string };
}

const policies: PolicyData[] = [
  {
    name: 'logs-prod-default',
    status: 'Active',
    indexCount: 156,
    updatedAgo: '2h ago',
    phases: [
      { from: 'Hot', to: 'Warm', condition: '50GB or 7 Days' },
      { from: 'Warm', to: 'Cold', condition: '30 Days' },
      { from: 'Cold', to: 'Delete', condition: '365 Days' },
    ],
    lastRun: { ok: true, message: 'Last Run: Success' },
  },
  {
    name: 'metrics-system-high',
    status: 'Active',
    indexCount: 42,
    updatedAgo: '1d ago',
    phases: [{ from: 'Hot', to: 'Delete', condition: '14 Days' }],
    lastRun: { ok: true, message: 'Last Run: Success' },
  },
  {
    name: 'audit-trail-long-term',
    status: 'Error',
    indexCount: 12,
    updatedAgo: '5d ago',
    phases: [
      { from: 'Hot', to: 'Cold', condition: '100GB' },
      { from: 'Cold', to: 'Delete', condition: '5 Years' },
    ],
    lastRun: { ok: false, message: 'Failed: Rollover' },
  },
];

// ============================================================================
// 阶段流程线组件
// ============================================================================

const PhaseFlow: React.FC<{ phases: PolicyData['phases']; isDark: boolean }> = ({ phases, isDark }) => {
  const p = isDark ? DARK_PALETTE : LIGHT_PALETTE;
  // 收集所有阶段节点
  const nodes: Phase[] = [phases[0].from];
  phases.forEach(ph => nodes.push(ph.to));

  return (
    <div style={{ display: 'flex', alignItems: 'center', minWidth: phases.length > 2 ? 500 : phases.length > 1 ? 400 : 300, padding: '8px 0' }}>
      {nodes.map((node, i) => {
        const cfg = PHASE_CONFIG[node];
        return (
          <React.Fragment key={i}>
            {/* 阶段节点 */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: `${cfg.color}20`, border: `1px solid ${cfg.color}66`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: node === 'Hot' ? `0 0 15px ${cfg.color}33` : undefined,
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: cfg.color }}>{cfg.icon}</span>
              </div>
              <span style={{ fontSize: 10, fontWeight: 600, color: cfg.color, marginTop: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{node}</span>
            </div>
            {/* 连接线 + 条件标签 */}
            {i < nodes.length - 1 && (
              <div style={{ flex: 1, height: 2, background: p.border, position: 'relative', margin: '0 8px' }}>
                <div style={{
                  position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)',
                  background: isDark ? '#252f40' : '#f1f5f9', border: `1px solid ${p.border}`,
                  padding: '1px 8px', borderRadius: 4, fontSize: 10, color: p.textSecondary, whiteSpace: 'nowrap',
                }}>
                  {phases[i].condition}
                </div>
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// ============================================================================
// 主组件
// ============================================================================

const LifecyclePolicy: React.FC = () => {
  const isDark = useThemeStore((s) => s.isDark);
  const p = isDark ? DARK_PALETTE : LIGHT_PALETTE;
  const [search, setSearch] = useState('');

  const filtered = policies.filter(pol =>
    !search || pol.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, height: '100%' }}>
      {/* 头部 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>生命周期策略 (Lifecycle Policies)</h2>
          <p style={{ margin: 0, fontSize: 13, color: p.textSecondary }}>Automate index management over time: Hot to Warm, to Cold, then Delete.</p>
        </div>
        <Space>
          <Button onClick={() => { window.location.hash = '#/help/faq'; }} icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>help</span>}>
            帮助
          </Button>
          <Input
            prefix={<span className="material-symbols-outlined" style={{ fontSize: 18, color: p.textSecondary }}>search</span>}
            placeholder="Search policies..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 240 }}
            allowClear
          />
          <Button type="primary"
            icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>}
          >创建策略 (Create Policy)</Button>
        </Space>
      </div>

      {/* 统计卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <Card size="small" styles={{ body: { padding: '20px' } }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 12, color: p.textSecondary, fontWeight: 500 }}>Total Policies</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                <span style={{ fontSize: 28, fontWeight: 700 }}>12</span>
                <Tag color="success">+2 new</Tag>
              </div>
            </div>
            <div style={{ padding: 8, borderRadius: 8, background: `${COLORS.primary}1a` }}>
              <span className="material-symbols-outlined" style={{ color: COLORS.primary }}>policy</span>
            </div>
          </div>
        </Card>
        <Card size="small" styles={{ body: { padding: '20px' } }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 12, color: p.textSecondary, fontWeight: 500 }}>Indices in Hot Phase</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                <span style={{ fontSize: 28, fontWeight: 700 }}>845</span>
                <span style={{ fontSize: 12, color: p.textSecondary }}>Active ingestion</span>
              </div>
            </div>
            <div style={{ padding: 8, borderRadius: 8, background: `${COLORS.danger}1a` }}>
              <span className="material-symbols-outlined" style={{ color: COLORS.danger }}>local_fire_department</span>
            </div>
          </div>
        </Card>
        <Card size="small" styles={{ body: { padding: '20px' } }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 12, color: p.textSecondary, fontWeight: 500 }}>Policy Errors</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                <span style={{ fontSize: 28, fontWeight: 700 }}>3</span>
                <Tag color="error">Action required</Tag>
              </div>
            </div>
            <div style={{ padding: 8, borderRadius: 8, background: `${COLORS.warning}1a` }}>
              <span className="material-symbols-outlined" style={{ color: COLORS.warning }}>warning</span>
            </div>
          </div>
        </Card>
        <Card size="small" styles={{ body: { padding: '20px' } }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 12, color: p.textSecondary, fontWeight: 500 }}>Storage Reclaimed (30d)</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                <span style={{ fontSize: 28, fontWeight: 700 }}>45.2 TB</span>
                <span style={{ fontSize: 12, color: COLORS.success, fontWeight: 500 }}>+5% vs last month</span>
              </div>
            </div>
            <div style={{ padding: 8, borderRadius: 8, background: `${COLORS.success}1a` }}>
              <span className="material-symbols-outlined" style={{ color: COLORS.success }}>cloud_done</span>
            </div>
          </div>
        </Card>
      </div>

      {/* 策略列表 */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Active Policies</h3>
          <Space size={16} style={{ fontSize: 12, color: p.textSecondary }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS.danger, display: 'inline-block' }} />Hot</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS.warning, display: 'inline-block' }} />Warm</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS.info, display: 'inline-block' }} />Cold</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#64748b', display: 'inline-block' }} />Delete</span>
          </Space>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {filtered.map((pol) => (
            <Card key={pol.name} hoverable size="small"
              styles={{ body: { padding: '24px' } }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
                {/* 策略信息 */}
                <div style={{ minWidth: 200 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 16, fontWeight: 600 }}>{pol.name}</span>
                    <Tag color={pol.status === 'Active' ? 'success' : 'error'}>{pol.status}</Tag>
                  </div>
                  <Space size={16} style={{ fontSize: 12, color: p.textSecondary }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>layers</span>
                      {pol.indexCount} Indices
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: p.textTertiary }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>schedule</span>
                      Updated {pol.updatedAgo}
                    </span>
                  </Space>
                </div>

                {/* 阶段流程 */}
                <div style={{ flex: 1, overflow: 'auto' }}>
                  <PhaseFlow phases={pol.phases} isDark={isDark} />
                </div>

                {/* 操作区 */}
                <div style={{ minWidth: 140, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, borderLeft: `1px solid ${p.border}`, paddingLeft: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    {pol.lastRun.ok ? (
                      <>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: COLORS.success }} />
                        <span style={{ fontSize: 12, color: p.textSecondary, fontWeight: 500 }}>{pol.lastRun.message}</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined" style={{ fontSize: 16, color: COLORS.danger }}>error</span>
                        <span style={{ fontSize: 12, color: COLORS.danger, fontWeight: 500 }}>{pol.lastRun.message}</span>
                      </>
                    )}
                  </div>
                  <Space>
                    <Button size="small">Apply</Button>
                    <Button size="small" type="primary" ghost>
                      {pol.status === 'Error' ? 'Fix Policy' : 'Edit Policy'}
                    </Button>
                  </Space>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LifecyclePolicy;
