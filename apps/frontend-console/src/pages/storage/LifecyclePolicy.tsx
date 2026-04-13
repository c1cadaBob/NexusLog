import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Empty, Input, Space, Statistic, Tag, Tooltip, message } from 'antd';
import { fetchLifecyclePolicies } from '../../api/storage';
import { useThemeStore } from '../../stores/themeStore';
import { COLORS, DARK_PALETTE, LIGHT_PALETTE } from '../../theme/tokens';
import type {
  ExecutionStatus,
  LifecyclePhase,
  LifecyclePhaseCount,
  LifecyclePolicyItem,
  LifecyclePolicySummary,
  PhaseTransition,
  PolicyStatus,
} from '../../types/storage';

const MAINTENANCE_TOOLTIP = '当前版本仅接入真实 ILM 策略读取，新增、编辑、应用等维护动作暂未开放';

const PHASE_CONFIG: Record<LifecyclePhase, { icon: string; color: string }> = {
  Hot: { icon: 'local_fire_department', color: COLORS.danger },
  Warm: { icon: 'thermostat', color: COLORS.warning },
  Cold: { icon: 'ac_unit', color: COLORS.info },
  Delete: { icon: 'delete', color: '#64748b' },
};

const POLICY_STATUS_CONFIG: Record<PolicyStatus, { color: 'success' | 'error' | 'default'; label: string }> = {
  Active: { color: 'success', label: '生效中' },
  Error: { color: 'error', label: '异常' },
  Unused: { color: 'default', label: '未引用' },
};

const EXECUTION_STATUS_CONFIG: Record<ExecutionStatus, { color: string; label: string }> = {
  Success: { color: COLORS.success, label: '执行正常' },
  Failed: { color: COLORS.danger, label: '执行失败' },
  Idle: { color: '#64748b', label: '暂无执行' },
};

const EMPTY_SUMMARY: LifecyclePolicySummary = {
  total: 0,
  active: 0,
  error: 0,
  unused: 0,
  managedIndices: 0,
  operationMode: 'UNKNOWN',
  refreshedAt: undefined,
};

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  return '加载 ILM 策略失败';
}

function formatRefreshTime(timestamp?: number): string {
  if (!timestamp || Number.isNaN(timestamp)) {
    return '-';
  }
  return new Date(timestamp).toLocaleString('zh-CN', { hour12: false });
}

function formatUpdatedTime(timestamp?: number): string {
  if (!timestamp || Number.isNaN(timestamp)) {
    return '未知';
  }
  return new Date(timestamp).toLocaleString('zh-CN', { hour12: false });
}

function formatOperationMode(value: string): string {
  switch ((value || '').trim().toUpperCase()) {
    case 'RUNNING':
      return '运行中';
    case 'STOPPING':
      return '停止中';
    case 'STOPPED':
      return '已停止';
    default:
      return value || '未知';
  }
}

const PhaseFlow: React.FC<{ phaseSequence: LifecyclePhase[]; transitions: PhaseTransition[]; isDark: boolean }> = ({
  phaseSequence,
  transitions,
  isDark,
}) => {
  const palette = isDark ? DARK_PALETTE : LIGHT_PALETTE;

  if (phaseSequence.length === 0) {
    return <span style={{ fontSize: 12, color: palette.textSecondary }}>未配置生命周期阶段</span>;
  }

  const minWidth = phaseSequence.length > 3 ? 680 : phaseSequence.length > 2 ? 560 : phaseSequence.length > 1 ? 420 : 180;

  return (
    <div style={{ display: 'flex', alignItems: 'center', minWidth, padding: '8px 0' }}>
      {phaseSequence.map((phase, index) => {
        const config = PHASE_CONFIG[phase];
        const transition = transitions[index];
        return (
          <React.Fragment key={`${phase}-${index}`}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: `${config.color}20`,
                  border: `1px solid ${config.color}66`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: phase === 'Hot' ? `0 0 15px ${config.color}33` : undefined,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: config.color }}>
                  {config.icon}
                </span>
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: config.color,
                  marginTop: 6,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {phase}
              </span>
            </div>
            {index < phaseSequence.length - 1 && (
              <div style={{ flex: 1, height: 2, background: palette.border, position: 'relative', margin: '0 8px' }}>
                <div
                  style={{
                    position: 'absolute',
                    top: -14,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: isDark ? '#252f40' : '#f1f5f9',
                    border: `1px solid ${palette.border}`,
                    padding: '1px 8px',
                    borderRadius: 4,
                    fontSize: 10,
                    color: palette.textSecondary,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {transition?.condition || '按策略条件'}
                </div>
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

function renderPhaseTags(palette: { textTertiary: string }, currentPhaseCounts: LifecyclePhaseCount[]) {
  if (!currentPhaseCounts.length) {
    return <span style={{ fontSize: 12, color: palette.textTertiary }}>当前无受管索引</span>;
  }
  return (
    <Space wrap size={[8, 8]}>
      {currentPhaseCounts.map((item) => {
        const phaseConfig = PHASE_CONFIG[item.phase];
        return (
          <Tag
            key={`${item.phase}-${item.count}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              marginInlineEnd: 0,
              borderColor: `${phaseConfig.color}66`,
              color: phaseConfig.color,
              background: `${phaseConfig.color}14`,
            }}
          >
            {item.phase} {item.count}
          </Tag>
        );
      })}
    </Space>
  );
}

const LifecyclePolicy: React.FC = () => {
  const isDark = useThemeStore((state) => state.isDark);
  const palette = isDark ? DARK_PALETTE : LIGHT_PALETTE;

  const [items, setItems] = useState<LifecyclePolicyItem[]>([]);
  const [summary, setSummary] = useState<LifecyclePolicySummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const loadPolicies = useCallback(async (options?: { showSuccess?: boolean; showError?: boolean }) => {
    setLoading(true);
    try {
      const result = await fetchLifecyclePolicies();
      setItems(result.items);
      setSummary(result.summary);
      setLoadError(null);
      if (options?.showSuccess) {
        message.success(`ILM 策略已刷新，共 ${result.summary.total} 条`);
      }
    } catch (error) {
      const nextError = normalizeErrorMessage(error);
      setLoadError(nextError);
      if (options?.showError !== false) {
        message.error(nextError);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPolicies({ showError: false });
  }, [loadPolicies]);

  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return items.filter((item) => {
      if (!keyword) return true;
      return item.name.toLowerCase().includes(keyword) || (item.description ?? '').toLowerCase().includes(keyword);
    });
  }, [items, search]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>生命周期 ILM</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: palette.textSecondary }}>
            读取 Elasticsearch 生命周期策略、引用资源与当前执行状态。
          </p>
        </div>
        <Space wrap>
          <span style={{ fontSize: 12, color: palette.textSecondary }}>最近更新：{formatRefreshTime(summary.refreshedAt)}</span>
          <Button
            onClick={() => {
              window.location.hash = '#/help/faq';
            }}
            icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>help</span>}
          >
            帮助
          </Button>
          <Button
            onClick={() => {
              void loadPolicies({ showSuccess: true });
            }}
            loading={loading}
            icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>refresh</span>}
          >
            刷新
          </Button>
          <Tooltip title={MAINTENANCE_TOOLTIP}>
            <span>
              <Button
                type="primary"
                disabled
                icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>}
              >
                创建策略
              </Button>
            </span>
          </Tooltip>
        </Space>
      </div>

      <Alert
        type="info"
        showIcon
        message="当前页已接入真实 ILM 策略"
        description="已展示 Elasticsearch 中的生命周期策略、阶段流转、引用资源和执行状态；新增、编辑、应用等维护动作当前保持只读。"
      />

      {loadError ? (
        <Alert
          type="error"
          showIcon
          message="ILM 策略加载失败"
          description={loadError}
          action={
            <Button size="small" onClick={() => void loadPolicies({ showError: true })}>
              重试
            </Button>
          }
        />
      ) : null}

      {summary.operationMode !== 'RUNNING' ? (
        <Alert
          type="warning"
          showIcon
          message={`ILM 当前运行模式：${formatOperationMode(summary.operationMode)}`}
          description="集群 ILM 未处于 RUNNING 状态，策略可能不会继续推进。"
        />
      ) : null}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
        }}
      >
        <Card size="small" styles={{ body: { padding: 20 } }}>
          <Statistic title="策略总数" value={summary.total} />
        </Card>
        <Card size="small" styles={{ body: { padding: 20 } }}>
          <Statistic title="生效中策略" value={summary.active} />
        </Card>
        <Card size="small" styles={{ body: { padding: 20 } }}>
          <Statistic title="受管索引数" value={summary.managedIndices} />
        </Card>
        <Card size="small" styles={{ body: { padding: 20 } }}>
          <Statistic title="异常策略" value={summary.error} valueStyle={{ color: summary.error > 0 ? COLORS.danger : undefined }} />
          <div style={{ marginTop: 8, fontSize: 12, color: palette.textSecondary }}>
            运行模式：{formatOperationMode(summary.operationMode)}
          </div>
        </Card>
      </div>

      <Card size="small" styles={{ body: { padding: 20 } }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>策略列表</div>
            <div style={{ fontSize: 12, color: palette.textSecondary, marginTop: 4 }}>
              共 {filteredItems.length} 条，包含已生效、异常与未引用策略
            </div>
          </div>
          <Input
            id="lifecycle-policy-search"
            name="lifecycle-policy-search"
            prefix={<span className="material-symbols-outlined" style={{ fontSize: 18, color: palette.textSecondary }}>search</span>}
            placeholder="搜索策略名称或说明"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            style={{ width: 280 }}
            allowClear
          />
        </div>
      </Card>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {filteredItems.length === 0 ? (
          <Card size="small" styles={{ body: { padding: 32 } }}>
            <Empty description={search ? '没有匹配的 ILM 策略' : '当前没有可展示的 ILM 策略'} />
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {filteredItems.map((item) => {
              const statusConfig = POLICY_STATUS_CONFIG[item.status];
              const executionConfig = EXECUTION_STATUS_CONFIG[item.executionStatus];
              return (
                <Card key={item.name} size="small" hoverable styles={{ body: { padding: 24 } }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                      <div style={{ minWidth: 260 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 16, fontWeight: 600 }}>{item.name}</span>
                          <Tag color={statusConfig.color}>{statusConfig.label}</Tag>
                          {item.managed ? <Tag color="processing">内置托管</Tag> : null}
                          {item.deprecated ? <Tag color="warning">Deprecated</Tag> : null}
                        </div>
                        {item.description ? (
                          <div style={{ marginTop: 8, fontSize: 13, color: palette.textSecondary }}>{item.description}</div>
                        ) : null}
                        <Space wrap size={16} style={{ fontSize: 12, color: palette.textSecondary, marginTop: 12 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>database</span>
                            受管索引 {item.managedIndexCount}
                          </span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>stream</span>
                            数据流 {item.dataStreamCount}
                          </span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>view_quilt</span>
                            模板 {item.templateCount}
                          </span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>schedule</span>
                            更新于 {formatUpdatedTime(item.updatedAt)}
                          </span>
                        </Space>
                      </div>

                      <div
                        style={{
                          minWidth: 220,
                          borderLeft: `1px solid ${palette.border}`,
                          paddingLeft: 20,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 12,
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: executionConfig.color }} />
                            <span style={{ fontSize: 13, fontWeight: 600, color: executionConfig.color }}>{executionConfig.label}</span>
                          </div>
                          <div style={{ fontSize: 12, color: item.executionStatus === 'Failed' ? COLORS.danger : palette.textSecondary, lineHeight: 1.6 }}>
                            {item.executionMessage || '暂无执行信息'}
                          </div>
                        </div>
                        <Tooltip title={MAINTENANCE_TOOLTIP}>
                          <span>
                            <Space>
                              <Button size="small" disabled>
                                应用策略
                              </Button>
                              <Button size="small" type="primary" ghost disabled>
                                编辑策略
                              </Button>
                            </Space>
                          </span>
                        </Tooltip>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>阶段流转</div>
                      <div style={{ overflowX: 'auto' }}>
                        <PhaseFlow phaseSequence={item.phaseSequence} transitions={item.phases} isDark={isDark} />
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>当前阶段分布</div>
                      {renderPhaseTags(palette, item.currentPhaseCounts)}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default LifecyclePolicy;
