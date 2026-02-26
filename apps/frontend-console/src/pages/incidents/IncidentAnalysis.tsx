import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Table, Tag, Select, Descriptions, Modal, Button, Space, Empty } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useThemeStore } from '../../stores/themeStore';
import { COLORS } from '../../theme/tokens';
import type { IncidentAnalysis as AnalysisType, RootCauseCategory, ActionType } from '../../types/incident';

// ============================================================================
// 配置映射
// ============================================================================

const ROOT_CAUSE_CONFIG: Record<RootCauseCategory, { label: string; color: string; icon: string }> = {
  config: { label: '配置错误', color: COLORS.warning, icon: 'settings_suggest' },
  capacity: { label: '容量不足', color: '#f97316', icon: 'storage' },
  dependency: { label: '依赖故障', color: COLORS.danger, icon: 'link_off' },
  code_defect: { label: '代码缺陷', color: '#8b5cf6', icon: 'bug_report' },
  security: { label: '安全事件', color: '#ef4444', icon: 'gpp_maybe' },
  network: { label: '网络问题', color: COLORS.info, icon: 'wifi_off' },
  hardware: { label: '硬件故障', color: '#64748b', icon: 'memory' },
  unknown: { label: '未知', color: '#94a3b8', icon: 'help' },
};

const ACTION_TYPE_LABEL: Record<ActionType, string> = {
  rollback: '回滚', scale_up: '扩容', restart: '重启',
  rate_limit: '限流', hotfix: '热修复', config_change: '配置变更', other: '其他',
};

// ============================================================================
// 模拟数据
// ============================================================================

const now = Date.now();
const MOCK_ANALYSES: AnalysisType[] = [
  {
    id: 'ana-001', incidentId: 'INC-20260219-003', category: 'capacity',
    summary: 'ES node-05 JVM 堆内存溢出导致节点不可用',
    detail: '由于近期日志量增长 40%，node-05 的 JVM heap size 配置（8GB）不足以处理当前索引负载，导致频繁 Full GC 最终 OOM。',
    impactScope: 'ES 集群降级为黄色状态，search-service 查询延迟从 200ms 升至 5s',
    affectedServiceCount: 2, affectedUserCount: 320,
    actions: [
      { id: 'act-001', type: 'restart', description: '重启 ES node-05 节点', operator: '王运维', executedAt: now - 84600000, result: 'success' },
      { id: 'act-002', type: 'config_change', description: '调整 JVM heap size 从 8GB 到 16GB', operator: '王运维', executedAt: now - 80000000, result: 'success' },
    ],
    preventionPlan: '1. 设置 JVM heap 使用率 75% 告警阈值\n2. 制定 ES 集群容量规划，按月评估\n3. 启用自动扩容策略',
    analyst: '王运维', createdAt: now - 82000000,
  },
  {
    id: 'ana-002', incidentId: 'INC-20260218-004', category: 'config',
    summary: 'Kafka 消费者组配置不当导致消息积压',
    detail: '消费者组 max.poll.records 设置过低（100），且 session.timeout.ms 过短导致频繁 rebalance，消费速度跟不上生产速度。',
    impactScope: '日志处理管道延迟 30 分钟，影响实时告警的时效性',
    affectedServiceCount: 2, affectedUserCount: 0,
    actions: [
      { id: 'act-003', type: 'config_change', description: '调整 max.poll.records=500, session.timeout.ms=30000', operator: '赵运维', executedAt: now - 170000000, result: 'success' },
      { id: 'act-004', type: 'scale_up', description: '增加消费者实例从 3 个到 6 个', operator: '赵运维', executedAt: now - 169000000, result: 'success' },
    ],
    preventionPlan: '1. 建立 Kafka 消费延迟监控看板\n2. 设置 lag > 5000 的告警规则\n3. 消费者配置纳入配置管理平台',
    analyst: '赵运维', createdAt: now - 168000000,
  },
  {
    id: 'ana-003', incidentId: 'INC-20260215-005', category: 'config',
    summary: 'Gateway TLS 证书过期未及时续期',
    detail: '证书管理流程缺失，未设置证书到期提醒。证书于 2026-02-15 00:00 过期，导致所有外部 HTTPS 请求返回 503。',
    impactScope: '所有外部 API 不可用，持续约 20 分钟，影响 8500 用户',
    affectedServiceCount: 10, affectedUserCount: 8500,
    actions: [
      { id: 'act-005', type: 'config_change', description: '紧急更新 TLS 证书', operator: '张运维', executedAt: now - 430200000, result: 'success' },
      { id: 'act-006', type: 'hotfix', description: '部署证书自动续期脚本', operator: '张运维', executedAt: now - 428000000, result: 'success' },
    ],
    preventionPlan: '1. 部署 cert-manager 自动续期\n2. 证书到期前 30/7/1 天三级告警\n3. 建立证书资产清单',
    analyst: '张运维', createdAt: now - 429000000,
  },
];


// ============================================================================
// IncidentAnalysis 主组件
// ============================================================================

const IncidentAnalysis: React.FC = () => {
  const isDark = useThemeStore((s) => s.isDark);
  const navigate = useNavigate();
  const [categoryFilter, setCategoryFilter] = useState<RootCauseCategory | 'all'>('all');
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<AnalysisType | null>(null);

  const filtered = useMemo(() => {
    if (categoryFilter === 'all') return MOCK_ANALYSES;
    return MOCK_ANALYSES.filter((a) => a.category === categoryFilter);
  }, [categoryFilter]);

  // 根因分布统计
  const categoryStats = useMemo(() => {
    const counts: Partial<Record<RootCauseCategory, number>> = {};
    MOCK_ANALYSES.forEach((a) => { counts[a.category] = (counts[a.category] ?? 0) + 1; });
    return Object.entries(counts).map(([k, v]) => ({
      category: k as RootCauseCategory,
      count: v,
      ...ROOT_CAUSE_CONFIG[k as RootCauseCategory],
    }));
  }, []);

  const columns: ColumnsType<AnalysisType> = useMemo(() => [
    {
      title: '事件 ID',
      dataIndex: 'incidentId',
      key: 'incidentId',
      width: 180,
      render: (v: string) => (
        <Button type="link" size="small" className="font-mono text-xs p-0" onClick={(e) => { e.stopPropagation(); navigate(`/incidents/detail/${v}`); }}>
          {v}
        </Button>
      ),
    },
    {
      title: '根因分类',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      render: (v: RootCauseCategory) => {
        const cfg = ROOT_CAUSE_CONFIG[v];
        return (
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-sm" style={{ color: cfg.color }}>{cfg.icon}</span>
            <Tag color={cfg.color} style={{ margin: 0 }}>{cfg.label}</Tag>
          </span>
        );
      },
    },
    {
      title: '根因概述',
      dataIndex: 'summary',
      key: 'summary',
      render: (v: string) => <span className="text-sm">{v}</span>,
    },
    {
      title: '影响范围',
      key: 'impact',
      width: 140,
      render: (_: unknown, r: AnalysisType) => (
        <div className="text-xs">
          <div>{r.affectedServiceCount} 个服务</div>
          <div className="opacity-50">{r.affectedUserCount.toLocaleString()} 用户</div>
        </div>
      ),
    },
    {
      title: '处置动作',
      key: 'actions',
      width: 100,
      render: (_: unknown, r: AnalysisType) => <span className="text-sm">{r.actions.length} 项</span>,
    },
    {
      title: '分析人',
      dataIndex: 'analyst',
      key: 'analyst',
      width: 100,
    },
    {
      title: '操作',
      key: 'ops',
      width: 80,
      render: (_: unknown, record: AnalysisType) => (
        <Button
          type="link"
          size="small"
          icon={<span className="material-symbols-outlined text-sm">visibility</span>}
          onClick={(e) => { e.stopPropagation(); setSelected(record); setDetailOpen(true); }}
        />
      ),
    },
  ], []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-lg font-semibold">根因分析与研判</span>
      </div>

      {/* 根因分布卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {categoryStats.map((s) => (
          <Card key={s.category} size="small" style={{ borderColor: isDark ? '#334155' : '#e2e8f0' }} styles={{ body: { padding: '16px 20px' } }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs opacity-50 mb-1">{s.label}</div>
                <div className="text-2xl font-bold" style={{ color: s.color }}>{s.count}</div>
              </div>
              <span className="material-symbols-outlined text-2xl" style={{ color: s.color, opacity: 0.6 }}>{s.icon}</span>
            </div>
          </Card>
        ))}
      </div>

      {/* 筛选 */}
      <div className="flex items-center gap-3">
        <Select
          value={categoryFilter}
          onChange={setCategoryFilter}
          style={{ width: 180 }}
          options={[
            { value: 'all', label: '所有根因分类' },
            ...Object.entries(ROOT_CAUSE_CONFIG).map(([k, v]) => ({ value: k, label: v.label })),
          ]}
        />
      </div>

      {/* 分析列表 */}
      <Table<AnalysisType>
        dataSource={filtered}
        columns={columns}
        rowKey="id"
        size="small"
        pagination={false}
        onRow={(record) => ({
          onClick: () => { setSelected(record); setDetailOpen(true); },
          style: { cursor: 'pointer' },
        })}
        scroll={{ x: 900 }}
      />

      {/* 分析详情弹窗 */}
      <Modal
        title={selected ? `根因分析 - ${selected.incidentId}` : '根因分析'}
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        width={700}
        footer={<Button onClick={() => setDetailOpen(false)}>关闭</Button>}
      >
        {selected && (
          <div className="flex flex-col gap-4 mt-4">
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="根因分类" span={2}>
                <Tag color={ROOT_CAUSE_CONFIG[selected.category].color} style={{ margin: 0 }}>
                  {ROOT_CAUSE_CONFIG[selected.category].label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="根因概述" span={2}>{selected.summary}</Descriptions.Item>
              <Descriptions.Item label="详细分析" span={2}>
                <span className="text-xs whitespace-pre-wrap">{selected.detail}</span>
              </Descriptions.Item>
              <Descriptions.Item label="影响范围" span={2}>
                <span className="text-xs">{selected.impactScope}</span>
              </Descriptions.Item>
              <Descriptions.Item label="影响服务数">{selected.affectedServiceCount}</Descriptions.Item>
              <Descriptions.Item label="影响用户数">{selected.affectedUserCount.toLocaleString()}</Descriptions.Item>
            </Descriptions>

            {/* 处置动作 */}
            <Card size="small" title="处置动作" style={{ borderColor: isDark ? '#334155' : '#e2e8f0' }}>
              {selected.actions.map((act) => (
                <div key={act.id} className="flex items-center gap-3 py-2 border-b last:border-b-0" style={{ borderColor: isDark ? '#334155' : '#e2e8f0' }}>
                  <Tag style={{ margin: 0 }}>{ACTION_TYPE_LABEL[act.type]}</Tag>
                  <span className="text-sm flex-1">{act.description}</span>
                  <Tag color={act.result === 'success' ? 'success' : act.result === 'failed' ? 'error' : 'warning'} style={{ margin: 0 }}>
                    {act.result === 'success' ? '成功' : act.result === 'failed' ? '失败' : '部分成功'}
                  </Tag>
                  <span className="text-xs opacity-50">{act.operator}</span>
                </div>
              ))}
            </Card>

            {/* 预防措施 */}
            <Card size="small" title="预防措施" style={{ borderColor: isDark ? '#334155' : '#e2e8f0' }}>
              <pre className="text-xs whitespace-pre-wrap m-0 opacity-80">{selected.preventionPlan}</pre>
            </Card>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default IncidentAnalysis;
