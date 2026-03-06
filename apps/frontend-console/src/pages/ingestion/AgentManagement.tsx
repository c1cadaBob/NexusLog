import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Input, Select, Table, Tag, Button, Card, Space, Modal, message, Spin, Empty } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useThemeStore } from '../../stores/themeStore';
import { usePreferencesStore } from '../../stores/preferencesStore';
import { COLORS } from '../../theme/tokens';
import { fetchPullSources, type PullSource } from '../../api/ingest';

/** Agent view derived from pull sources grouped by agent_base_url or host:port */
interface AgentView {
  id: string;
  ip: string;
  hostname: string;
  sourceCount: number;
  status: 'Online' | 'Offline' | 'Paused';
  lastSeen: string;
  sources: PullSource[];
}

function groupSourcesByAgent(sources: PullSource[]): AgentView[] {
  const byKey = new Map<string, PullSource[]>();
  for (const s of sources) {
    const key = (s.agent_base_url || '').trim() || `${s.host}:${s.port}`;
    const list = byKey.get(key) ?? [];
    list.push(s);
    byKey.set(key, list);
  }
  return Array.from(byKey.entries()).map(([key, list]) => {
    const first = list[0]!;
    const hasActive = list.some((x) => x.status === 'active');
    const allDisabled = list.every((x) => x.status === 'disabled');
    const allPaused = list.every((x) => x.status === 'paused');
    let status: AgentView['status'] = 'Offline';
    if (hasActive) status = 'Online';
    else if (allPaused && !allDisabled) status = 'Paused';

    const lastUpdated = list
      .map((x) => new Date(x.updated_at || x.created_at || 0).getTime())
      .reduce((a, b) => Math.max(a, b), 0);
    const lastSeen = lastUpdated ? new Date(lastUpdated).toLocaleString() : '-';

    return {
      id: key,
      ip: first.host,
      hostname: first.host,
      sourceCount: list.length,
      status,
      lastSeen,
      sources: list,
    };
  });
}

const AgentManagement: React.FC = () => {
  const isDark = useThemeStore((s) => s.isDark);

  const [sources, setSources] = useState<PullSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AgentView | null>(null);

  const storedPageSize = usePreferencesStore((s) => s.pageSizes['agentManagement'] ?? 10);
  const setStoredPageSize = usePreferencesStore((s) => s.setPageSize);
  const [pageSize, setPageSizeLocal] = useState(storedPageSize);
  const setPageSize = useCallback((size: number) => {
    setPageSizeLocal(size);
    setStoredPageSize('agentManagement', size);
  }, [setStoredPageSize]);

  const loadSources = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchPullSources();
      setSources(data);
    } catch (err) {
      message.error('数据加载失败：' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSources();
  }, [loadSources]);

  const agents = useMemo(() => groupSourcesByAgent(sources), [sources]);

  const stats = useMemo(() => {
    const total = agents.length;
    const online = agents.filter((a) => a.status === 'Online').length;
    const offline = agents.filter((a) => a.status === 'Offline').length;
    const paused = agents.filter((a) => a.status === 'Paused').length;
    return { total, online, offline, highLoad: paused };
  }, [agents]);

  const filteredAgents = useMemo(() => {
    let result = agents;
    if (statusFilter !== 'all') result = result.filter((a) => a.status === statusFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((a) => a.ip.toLowerCase().includes(q) || a.hostname.toLowerCase().includes(q));
    }
    return result;
  }, [agents, statusFilter, searchQuery]);

  const openDetail = useCallback((agent: AgentView) => {
    setSelectedAgent(agent);
    setDetailModalOpen(true);
  }, []);

  const columns: ColumnsType<AgentView> = [
    {
      title: '主机 IP/名称',
      key: 'host',
      width: 250,
      render: (_, agent) => (
        <div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 500, opacity: agent.status === 'Offline' ? 0.5 : 1 }}>
            {agent.ip}
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>{agent.hostname}</div>
        </div>
      ),
    },
    {
      title: '采集源数量',
      key: 'sourceCount',
      width: 120,
      render: (_, agent) => <span>{agent.sourceCount}</span>,
    },
    {
      title: '最后更新',
      dataIndex: 'lastSeen',
      key: 'lastSeen',
      width: 180,
      render: (v: string) => <span style={{ fontSize: 12, color: '#94a3b8' }}>{v}</span>,
    },
    {
      title: '状态',
      key: 'status',
      width: 100,
      render: (_, agent) => {
        const color = agent.status === 'Online' ? 'success' : agent.status === 'Paused' ? 'warning' : 'error';
        const label = agent.status === 'Online' ? '在线' : agent.status === 'Paused' ? '已暂停' : '离线';
        return (
          <Tag color={color} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background:
                  COLORS[agent.status === 'Online' ? 'success' : agent.status === 'Paused' ? 'warning' : 'danger'],
                display: 'inline-block',
              }}
            />
            {label}
          </Tag>
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
          <Button
            type="text"
            size="small"
            onClick={() => openDetail(agent)}
            icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>visibility</span>}
            title="查看采集源"
          />
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Agent 管理</h2>
          <Tag>按采集源分组</Tag>
        </div>
        <Space>
          <Button icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>help</span>}>
            文档 Documentation
          </Button>
        </Space>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <Card size="small" styles={{ body: { padding: 16 } }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span className="material-symbols-outlined" style={{ color: '#94a3b8' }}>dns</span>
            <span style={{ fontSize: 13, color: '#94a3b8' }}>Agent 总数</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 600 }}>{stats.total}</div>
        </Card>
        <Card size="small" styles={{ body: { padding: 16 } }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span className="material-symbols-outlined" style={{ color: COLORS.success }}>check_circle</span>
            <span style={{ fontSize: 13, color: '#94a3b8' }}>在线 Online</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 28, fontWeight: 600 }}>{stats.online}</span>
            <div style={{ flex: 1, maxWidth: 80, height: 6, borderRadius: 3, background: isDark ? '#334155' : '#e2e8f0' }}>
              <div
                style={{
                  height: '100%',
                  borderRadius: 3,
                  background: COLORS.success,
                  width: `${stats.total ? (stats.online / stats.total) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        </Card>
        <Card size="small" styles={{ body: { padding: 16 } }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span className="material-symbols-outlined" style={{ color: COLORS.danger }}>error</span>
            <span style={{ fontSize: 13, color: '#94a3b8' }}>离线 Offline</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 600 }}>{stats.offline}</div>
        </Card>
        <Card size="small" styles={{ body: { padding: 16 } }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span className="material-symbols-outlined" style={{ color: COLORS.warning }}>speed</span>
            <span style={{ fontSize: 13, color: '#94a3b8' }}>已暂停 Paused</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 28, fontWeight: 600 }}>{stats.highLoad}</span>
          </div>
        </Card>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
          <Input
            prefix={<span className="material-symbols-outlined" style={{ fontSize: 20, color: '#94a3b8' }}>search</span>}
            placeholder="搜索主机名或 IP..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ maxWidth: 400 }}
            allowClear
          />
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 120 }}
            options={[
              { value: 'all', label: '所有状态' },
              { value: 'Online', label: '在线' },
              { value: 'Offline', label: '离线' },
              { value: 'Paused', label: '已暂停' },
            ]}
          />
        </div>
        <Space>
          <Button type="text" icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>refresh</span>} onClick={loadSources} />
          <Button type="primary" icon={<span className="material-symbols-outlined" style={{ fontSize: 20 }}>add</span>}>
            安装新 Agent
          </Button>
        </Space>
      </div>

      <Card style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }} styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' } }}>
        <Spin spinning={loading}>
          <div style={{ flex: 1, overflow: 'auto', minHeight: 200 }}>
            {!loading && filteredAgents.length === 0 ? (
              <Empty description="暂无 Agent 数据" style={{ padding: 48 }} />
            ) : (
              <Table<AgentView>
                rowKey="id"
                columns={columns}
                dataSource={filteredAgents}
                size="middle"
                loading={false}
                pagination={{
                  pageSize,
                  showSizeChanger: true,
                  showTotal: (total) => `共 ${total} 个 Agent`,
                  onShowSizeChange: (_, size) => setPageSize(size),
                }}
                scroll={{ x: 900 }}
              />
            )}
          </div>
        </Spin>
      </Card>

      <Modal
        open={detailModalOpen}
        title={`Agent 采集源 - ${selectedAgent?.hostname || ''}`}
        onCancel={() => setDetailModalOpen(false)}
        footer={null}
        width={640}
        destroyOnClose
      >
        {selectedAgent && (
          <div style={{ marginTop: 16 }}>
            <Card size="small" style={{ marginBottom: 16 }} styles={{ body: { padding: 12 } }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                <div>
                  <span style={{ color: '#94a3b8' }}>IP 地址:</span>{' '}
                  <span style={{ fontFamily: 'monospace' }}>{selectedAgent.ip}</span>
                </div>
                <div>
                  <span style={{ color: '#94a3b8' }}>状态:</span>{' '}
                  <span
                    style={{
                      color: COLORS[
                        selectedAgent.status === 'Online' ? 'success' : selectedAgent.status === 'Paused' ? 'warning' : 'danger'
                      ],
                    }}
                  >
                    {selectedAgent.status}
                  </span>
                </div>
                <div>
                  <span style={{ color: '#94a3b8' }}>采集源数量:</span> {selectedAgent.sourceCount}
                </div>
                <div>
                  <span style={{ color: '#94a3b8' }}>最后更新:</span> {selectedAgent.lastSeen}
                </div>
              </div>
            </Card>
            <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>关联采集源：</div>
            <ul style={{ paddingLeft: 20, margin: 0 }}>
              {selectedAgent.sources.map((s) => (
                <li key={s.source_id} style={{ marginBottom: 4 }}>
                  <span style={{ fontWeight: 500 }}>{s.name}</span> — {s.path} ({s.status})
                </li>
              ))}
            </ul>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AgentManagement;
