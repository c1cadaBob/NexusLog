import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, App, Button, Card, Descriptions, Empty, Input, Modal, Select, Space, Spin, Statistic, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import { fetchIngestAgents, type IngestAgentItem } from '../../api/ingest';
import { usePreferencesStore } from '../../stores/preferencesStore';
import { COLORS } from '../../theme/tokens';

const statusOptions = [
  { label: '全部状态', value: 'all' },
  { label: '在线', value: 'online' },
  { label: '暂停', value: 'paused' },
  { label: '已禁用', value: 'disabled' },
  { label: '离线', value: 'offline' },
];

function getStatusMeta(status: string, liveConnected: boolean) {
  const normalized = String(status ?? '').toLowerCase();
  if (normalized === 'online') {
    return { color: 'success', label: liveConnected ? '在线' : '在线/未探活', dot: COLORS.success };
  }
  if (normalized === 'paused') {
    return { color: 'warning', label: '已暂停', dot: COLORS.warning };
  }
  if (normalized === 'disabled') {
    return { color: 'default', label: '已禁用', dot: '#94a3b8' };
  }
  return { color: 'error', label: '离线', dot: COLORS.danger };
}

function formatPercent(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  return `${value.toFixed(1)}%`;
}

function formatDateTime(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN');
}

const AgentManagement: React.FC = () => {
  const navigate = useNavigate();
  const { message: messageApi } = App.useApp();
  const [agents, setAgents] = useState<IngestAgentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedAgent, setSelectedAgent] = useState<IngestAgentItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const storedPageSize = usePreferencesStore((s) => s.pageSizes.agentManagement ?? 10);
  const setStoredPageSize = usePreferencesStore((s) => s.setPageSize);
  const [pageSize, setPageSizeLocal] = useState(storedPageSize);

  const setPageSize = useCallback((size: number) => {
    setPageSizeLocal(size);
    setStoredPageSize('agentManagement', size);
  }, [setStoredPageSize]);

  const loadAgents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchIngestAgents();
      setAgents(data);
    } catch (err) {
      messageApi.error(`Agent 列表加载失败：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }, [messageApi]);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  const stats = useMemo(() => ({
    total: agents.length,
    online: agents.filter((item) => String(item.status).toLowerCase() === 'online').length,
    paused: agents.filter((item) => String(item.status).toLowerCase() === 'paused').length,
    offline: agents.filter((item) => !['online', 'paused', 'disabled'].includes(String(item.status).toLowerCase())).length,
  }), [agents]);

  const filteredAgents = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return agents.filter((item) => {
      if (statusFilter !== 'all' && String(item.status).toLowerCase() !== statusFilter) {
        return false;
      }
      if (!normalizedQuery) return true;
      const haystacks = [
        item.agent_id,
        item.hostname,
        item.host,
        item.ip,
        item.agent_base_url,
        ...(item.source_names ?? []),
        ...(item.source_paths ?? []),
      ].filter(Boolean).join(' ').toLowerCase();
      return haystacks.includes(normalizedQuery);
    });
  }, [agents, searchQuery, statusFilter]);

  const columns: ColumnsType<IngestAgentItem> = [
    {
      title: 'Agent / 主机',
      key: 'agent',
      width: 280,
      render: (_, agent) => (
        <div>
          <div style={{ fontWeight: 600 }}>{agent.hostname || agent.host || agent.agent_id}</div>
          <div style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }}>{agent.agent_id}</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>{agent.ip || agent.host || '-'}</div>
        </div>
      ),
    },
    {
      title: '连接地址',
      dataIndex: 'agent_base_url',
      key: 'agent_base_url',
      width: 220,
      render: (value?: string) => (
        <span style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}>{value || '-'}</span>
      ),
    },
    {
      title: '采集目录',
      key: 'paths',
      width: 320,
      render: (_, agent) => {
        const paths = agent.source_paths ?? [];
        if (!paths.length) return <span style={{ color: '#94a3b8' }}>未发现目录</span>;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {paths.slice(0, 3).map((path) => (
              <span key={path} style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}>{path}</span>
            ))}
            {paths.length > 3 ? <span style={{ fontSize: 12, color: '#94a3b8' }}>还有 {paths.length - 3} 个目录...</span> : null}
          </div>
        );
      },
    },
    {
      title: '资源情况',
      key: 'metrics',
      width: 180,
      render: (_, agent) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
          <span>CPU：{formatPercent(agent.metrics?.cpu_usage_pct)}</span>
          <span>内存：{formatPercent(agent.metrics?.memory_usage_pct)}</span>
          <span>磁盘：{formatPercent(agent.metrics?.disk_usage_pct)}</span>
        </div>
      ),
    },
    {
      title: '状态',
      key: 'status',
      width: 120,
      render: (_, agent) => {
        const meta = getStatusMeta(agent.status, agent.live_connected);
        return (
          <Tag color={meta.color} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta.dot, display: 'inline-block' }} />
            {meta.label}
          </Tag>
        );
      },
    },
    {
      title: '最近探测',
      dataIndex: 'last_seen_at',
      key: 'last_seen_at',
      width: 180,
      render: (value?: string) => <span style={{ fontSize: 12, color: '#94a3b8' }}>{formatDateTime(value)}</span>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      align: 'right',
      render: (_, agent) => (
        <Space size={4}>
          <Button size="small" type="link" onClick={() => { setSelectedAgent(agent); setDetailOpen(true); }}>详情</Button>
          <Button size="small" type="link" onClick={() => navigate('/ingestion/wizard')}>接入</Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <Typography.Title level={2} style={{ margin: 0 }}>Agent 管理</Typography.Title>
          <Typography.Paragraph style={{ margin: '4px 0 0', color: '#94a3b8' }}>
            展示当前已配置且可被控制面探测到的真实 Agent、采集目录与资源状态。
          </Typography.Paragraph>
        </div>
        <Space>
          <Button onClick={loadAgents} icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>refresh</span>}>刷新</Button>
          <Button type="primary" onClick={() => navigate('/ingestion/wizard')}>新增接入</Button>
        </Space>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(180px, 1fr))', gap: 16 }}>
        <Card><Statistic title="Agent 总数" value={stats.total} /></Card>
        <Card><Statistic title="在线 Agent" value={stats.online} valueStyle={{ color: COLORS.success }} /></Card>
        <Card><Statistic title="暂停 Agent" value={stats.paused} valueStyle={{ color: COLORS.warning }} /></Card>
        <Card><Statistic title="离线 Agent" value={stats.offline} valueStyle={{ color: COLORS.danger }} /></Card>
      </div>

      <Card>
        <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <Input
            name="agentSearchQuery"
            allowClear
            style={{ width: 320 }}
            placeholder="搜索 Agent、主机、目录、采集源"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            prefix={<span className="material-symbols-outlined" style={{ fontSize: 18, color: '#94a3b8' }}>search</span>}
          />
          <Select id="agent-status-filter" value={statusFilter} style={{ width: 160 }} options={statusOptions} onChange={setStatusFilter} />
        </Space>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spin size="large" /></div>
        ) : filteredAgents.length === 0 ? (
          <Empty description="当前没有可展示的 Agent" />
        ) : (
          <Table<IngestAgentItem>
            rowKey={(record) => `${record.agent_id}-${record.agent_base_url ?? record.host ?? ''}`}
            columns={columns}
            dataSource={filteredAgents}
            pagination={{
              pageSize,
              showSizeChanger: true,
              pageSizeOptions: [10, 20, 50, 100],
              onShowSizeChange: (_, size) => setPageSize(size),
            }}
            scroll={{ x: 1400 }}
          />
        )}
      </Card>

      <Modal
        title="Agent 详情"
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={<Button onClick={() => setDetailOpen(false)}>关闭</Button>}
        width={880}
      >
        {!selectedAgent ? null : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {!selectedAgent.live_connected && selectedAgent.error_message ? (
              <Alert type="warning" showIcon message="探活失败" description={selectedAgent.error_message} />
            ) : null}
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="Agent ID">{selectedAgent.agent_id}</Descriptions.Item>
              <Descriptions.Item label="状态">{getStatusMeta(selectedAgent.status, selectedAgent.live_connected).label}</Descriptions.Item>
              <Descriptions.Item label="主机名">{selectedAgent.hostname || '-'}</Descriptions.Item>
              <Descriptions.Item label="IP">{selectedAgent.ip || selectedAgent.host || '-'}</Descriptions.Item>
              <Descriptions.Item label="Agent URL" span={2}>{selectedAgent.agent_base_url || '-'}</Descriptions.Item>
              <Descriptions.Item label="版本">{selectedAgent.version || '-'}</Descriptions.Item>
              <Descriptions.Item label="最近探测">{formatDateTime(selectedAgent.last_seen_at)}</Descriptions.Item>
              <Descriptions.Item label="活跃采集源">{selectedAgent.active_source_count}</Descriptions.Item>
              <Descriptions.Item label="总采集源">{selectedAgent.source_count}</Descriptions.Item>
            </Descriptions>

            <Card size="small" title="资源指标">
              <Space size={24} wrap>
                <Statistic title="CPU" value={selectedAgent.metrics?.cpu_usage_pct ?? 0} suffix="%" precision={1} />
                <Statistic title="内存" value={selectedAgent.metrics?.memory_usage_pct ?? 0} suffix="%" precision={1} />
                <Statistic title="磁盘" value={selectedAgent.metrics?.disk_usage_pct ?? 0} suffix="%" precision={1} />
              </Space>
              <div style={{ marginTop: 12, fontSize: 12, color: '#94a3b8' }}>采集时间：{formatDateTime(selectedAgent.metrics?.collected_at)}</div>
            </Card>

            <Card size="small" title="采集源与目录">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div>
                  <strong>采集源：</strong> {(selectedAgent.source_names ?? []).length ? (selectedAgent.source_names ?? []).join('、') : '-'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <strong>目录：</strong>
                  {(selectedAgent.source_paths ?? []).length ? (
                    (selectedAgent.source_paths ?? []).map((path) => (
                      <Typography.Text key={path} code style={{ width: 'fit-content' }}>{path}</Typography.Text>
                    ))
                  ) : (
                    <span style={{ color: '#94a3b8' }}>未发现目录</span>
                  )}
                </div>
                <div>
                  <strong>能力：</strong> {(selectedAgent.capabilities ?? []).length ? (selectedAgent.capabilities ?? []).join('、') : '-'}
                </div>
              </div>
            </Card>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AgentManagement;
