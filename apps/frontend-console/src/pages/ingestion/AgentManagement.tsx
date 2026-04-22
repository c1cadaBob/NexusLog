import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, App, Button, Card, Descriptions, Empty, Input, Modal, Select, Space, Spin, Statistic, Table, Tag, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import { deletePullSource, fetchIngestAgents, type IngestAgentItem } from '../../api/ingest';
import { hasAnyCapability } from '../../auth/routeAuthorization';
import { useAuthStore } from '../../stores/authStore';
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

function formatShortDateTime(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatShortId(value?: string, head = 8, tail = 4) {
  const normalized = String(value ?? '').trim();
  if (!normalized) return '-';
  if (normalized.length <= head + tail + 1) return normalized;
  return `${normalized.slice(0, head)}…${normalized.slice(-tail)}`;
}

function getAgentDisplayName(agent: IngestAgentItem) {
  return agent.hostname || agent.host || agent.agent_id;
}

function renderPathPreview(paths?: string[]) {
  const normalizedPaths = (paths ?? [])
    .map((path) => String(path ?? '').trim())
    .filter(Boolean);

  if (!normalizedPaths.length) {
    return <span style={{ color: '#94a3b8', fontSize: 12 }}>未发现目录</span>;
  }

  const tooltipContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {normalizedPaths.map((path) => (
        <span key={path} style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}>{path}</span>
      ))}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <Tooltip title={tooltipContent}>
        <Typography.Text code ellipsis style={{ margin: 0, fontSize: 12, maxWidth: '100%', display: 'inline-block' }}>
          {normalizedPaths[0]}
        </Typography.Text>
      </Tooltip>
      {normalizedPaths.length > 1 ? (
        <span style={{ fontSize: 12, color: '#94a3b8' }}>共 {normalizedPaths.length} 个目录</span>
      ) : null}
    </div>
  );
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
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTargetAgent, setDeleteTargetAgent] = useState<IngestAgentItem | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const capabilities = useAuthStore((s) => s.capabilities);
  const canDeleteAgent = useMemo(() => hasAnyCapability(capabilities, ['ingest.source.delete']), [capabilities]);

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

  const openDeleteModal = useCallback((agent: IngestAgentItem) => {
    setDeleteTargetAgent(agent);
    setDeleteConfirmText('');
    setDeleteModalOpen(true);
  }, []);

  const closeDeleteModal = useCallback(() => {
    setDeleteModalOpen(false);
    setDeleteTargetAgent(null);
    setDeleteConfirmText('');
  }, []);

  const handleDeleteAgent = useCallback(async () => {
    if (!deleteTargetAgent) return;

    const expectedName = getAgentDisplayName(deleteTargetAgent).trim();
    if (deleteConfirmText.trim() !== expectedName) {
      messageApi.error('请输入正确的 Agent 名称后再删除');
      return;
    }

    const sourceIds = (deleteTargetAgent.source_ids ?? []).filter(Boolean);
    if (sourceIds.length === 0) {
      messageApi.error('当前 Agent 没有关联采集源，无法删除');
      return;
    }

    setDeleting(true);
    try {
      const results = await Promise.allSettled(sourceIds.map((sourceId) => deletePullSource(sourceId)));
      const failed = results.filter((item) => item.status === 'rejected');
      const succeeded = results.length - failed.length;

      if (failed.length === 0) {
        messageApi.success(`已删除 Agent：${expectedName}`);
      } else if (succeeded > 0) {
        messageApi.warning(`已删除 ${succeeded} 个采集源，仍有 ${failed.length} 个删除失败`);
      } else {
        const firstError = failed[0];
        const message = firstError && firstError.status === 'rejected'
          ? (firstError.reason instanceof Error ? firstError.reason.message : String(firstError.reason))
          : '未知错误';
        messageApi.error(`删除失败：${message}`);
        return;
      }

      if (selectedAgent?.agent_id === deleteTargetAgent.agent_id && selectedAgent?.agent_base_url === deleteTargetAgent.agent_base_url) {
        setDetailOpen(false);
        setSelectedAgent(null);
      }
      closeDeleteModal();
      loadAgents();
    } finally {
      setDeleting(false);
    }
  }, [closeDeleteModal, deleteConfirmText, deleteTargetAgent, loadAgents, messageApi, selectedAgent]);

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
      title: 'Agent',
      key: 'agent',
      width: 250,
      render: (_, agent) => {
        const displayName = getAgentDisplayName(agent);
        const displayEndpoint = [agent.ip || agent.host, agent.agent_base_url].filter(Boolean).join(' · ');

        return (
          <div style={{ minWidth: 0 }}>
            <Tooltip title={displayName}>
              <Typography.Text strong ellipsis style={{ maxWidth: '100%', display: 'block' }}>{displayName}</Typography.Text>
            </Tooltip>
            <Tooltip title={agent.agent_id}>
              <Typography.Text
                type="secondary"
                ellipsis
                style={{ maxWidth: '100%', display: 'block', fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}
              >
                {formatShortId(agent.agent_id)}
              </Typography.Text>
            </Tooltip>
            <Tooltip title={displayEndpoint || '-'}>
              <Typography.Text type="secondary" ellipsis style={{ maxWidth: '100%', display: 'block', fontSize: 12 }}>
                {displayEndpoint || '-'}
              </Typography.Text>
            </Tooltip>
          </div>
        );
      },
    },
    {
      title: '目录',
      key: 'paths',
      width: 260,
      render: (_, agent) => renderPathPreview(agent.source_paths),
    },
    {
      title: '资源 / 采集源',
      key: 'metrics',
      width: 220,
      render: (_, agent) => {
        const summary = `CPU ${formatPercent(agent.metrics?.cpu_usage_pct)} / 内存 ${formatPercent(agent.metrics?.memory_usage_pct)} / 磁盘 ${formatPercent(agent.metrics?.disk_usage_pct)}`;
        const detailLines = [
          `CPU：${formatPercent(agent.metrics?.cpu_usage_pct)}`,
          `内存：${formatPercent(agent.metrics?.memory_usage_pct)}`,
          `磁盘：${formatPercent(agent.metrics?.disk_usage_pct)}`,
          `采集时间：${formatDateTime(agent.metrics?.collected_at)}`,
          `版本：${agent.version || '-'}`,
        ];

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
            <Tooltip
              title={(
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {detailLines.map((line) => <div key={line}>{line}</div>)}
                </div>
              )}
            >
              <Typography.Text ellipsis style={{ maxWidth: '100%', display: 'block', fontSize: 12 }}>
                {summary}
              </Typography.Text>
            </Tooltip>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              活跃 {agent.active_source_count} / 总 {agent.source_count}
            </Typography.Text>
          </div>
        );
      },
    },
    {
      title: '状态 / 探测',
      key: 'status',
      width: 170,
      render: (_, agent) => {
        const meta = getStatusMeta(agent.status, agent.live_connected);
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
            <Tag color={meta.color} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, width: 'fit-content', marginInlineEnd: 0 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta.dot, display: 'inline-block' }} />
              {meta.label}
            </Tag>
            <Tooltip title={formatDateTime(agent.last_seen_at)}>
              <Typography.Text type="secondary" ellipsis style={{ maxWidth: '100%', display: 'block', fontSize: 12 }}>
                最近 {formatShortDateTime(agent.last_seen_at)}
              </Typography.Text>
            </Tooltip>
          </div>
        );
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      align: 'right',
      render: (_, agent) => (
        <Space size={4}>
          <Button size="small" type="link" onClick={() => { setSelectedAgent(agent); setDetailOpen(true); }}>详情</Button>
          <Button size="small" type="link" onClick={() => navigate('/ingestion/wizard')}>接入</Button>
          {canDeleteAgent ? (
            <Button
              size="small"
              type="link"
              danger
              onClick={() => openDeleteModal(agent)}
              disabled={!agent.source_ids?.length}
            >
              删除
            </Button>
          ) : null}
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
            size="small"
            rowKey={(record) => `${record.agent_id}-${record.agent_base_url ?? record.host ?? ''}`}
            columns={columns}
            dataSource={filteredAgents}
            pagination={{
              pageSize,
              showSizeChanger: true,
              pageSizeOptions: [10, 20, 50, 100],
              onShowSizeChange: (_, size) => setPageSize(size),
            }}
            scroll={{ x: 1080 }}
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

      <Modal
        title="删除 Agent"
        open={deleteModalOpen}
        onCancel={() => {
          if (!deleting) closeDeleteModal();
        }}
        onOk={() => void handleDeleteAgent()}
        confirmLoading={deleting}
        okText="确认删除"
        okButtonProps={{ danger: true, disabled: !deleteTargetAgent || deleteConfirmText.trim() !== getAgentDisplayName(deleteTargetAgent).trim() }}
        cancelText="取消"
        cancelButtonProps={{ disabled: deleting }}
        destroyOnHidden
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Alert
            type="warning"
            showIcon
            message="删除后不可恢复"
            description="删除 Agent 会级联删除其关联的全部采集源配置。"
          />
          <Typography.Paragraph style={{ marginBottom: 0 }}>
            请输入 Agent 名称 <Typography.Text code>{deleteTargetAgent ? getAgentDisplayName(deleteTargetAgent) : '-'}</Typography.Text> 以确认删除。
          </Typography.Paragraph>
          <Input
            id="agent-delete-confirm-name"
            name="agentDeleteConfirmName"
            value={deleteConfirmText}
            onChange={(event) => setDeleteConfirmText(event.target.value)}
            placeholder="请输入 Agent 名称"
          />
        </div>
      </Modal>
    </div>
  );
};

export default AgentManagement;
