import React, { useState, useMemo, useCallback } from 'react';
import { Input, Select, Table, Tag, Button, Card, Space, Modal, Form, InputNumber, Progress, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useThemeStore } from '../../stores/themeStore';
import { usePreferencesStore } from '../../stores/preferencesStore';
import { COLORS } from '../../theme/tokens';
import type { Agent, AgentConfig } from '../../types/ingestion';

// ============================================================================
// 模拟数据
// ============================================================================

const initialAgents: Agent[] = [
  { id: 'agent-001', ip: '192.168.1.105', hostname: 'web-server-01', version: 'v2.4.1', cpu: 25, mem: 42, throughput: '24.5 MB/s', status: 'Online', hasUpdate: false, lastSeen: '2026-02-10 10:30:00',
    config: { logLevel: 'info', maxCpu: 80, maxMem: 80, batchSize: 1000, flushInterval: 5 } },
  { id: 'agent-002', ip: '10.0.4.212', hostname: 'db-primary-shard-01', version: 'v2.4.0', cpu: 92, mem: 78, throughput: '142.8 MB/s', status: 'High Load', hasUpdate: true, lastSeen: '2026-02-10 10:29:55',
    config: { logLevel: 'warn', maxCpu: 90, maxMem: 85, batchSize: 2000, flushInterval: 3 } },
  { id: 'agent-003', ip: '192.168.2.055', hostname: 'payment-gateway-03', version: 'v2.3.9', cpu: 0, mem: 0, throughput: '-', status: 'Offline', hasUpdate: false, lastSeen: '2026-02-09 18:45:00',
    config: { logLevel: 'info', maxCpu: 80, maxMem: 80, batchSize: 1000, flushInterval: 5 } },
  { id: 'agent-004', ip: '192.168.1.108', hostname: 'app-worker-04', version: 'v2.4.1', cpu: 45, mem: 60, throughput: '18.2 MB/s', status: 'Online', hasUpdate: false, lastSeen: '2026-02-10 10:30:02',
    config: { logLevel: 'debug', maxCpu: 75, maxMem: 70, batchSize: 500, flushInterval: 10 } },
];

const logLevelOptions = [
  { label: 'Debug', value: 'debug' },
  { label: 'Info', value: 'info' },
  { label: 'Warn', value: 'warn' },
  { label: 'Error', value: 'error' },
];

// ============================================================================
// 组件
// ============================================================================

const AgentManagement: React.FC = () => {
  const isDark = useThemeStore((s) => s.isDark);
  const [configForm] = Form.useForm();

  // 状态
  const [agents, setAgents] = useState<Agent[]>(initialAgents);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [installModalOpen, setInstallModalOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  // 分页
  const storedPageSize = usePreferencesStore((s) => s.pageSizes['agentManagement'] ?? 10);
  const setStoredPageSize = usePreferencesStore((s) => s.setPageSize);
  const [pageSize, setPageSizeLocal] = useState(storedPageSize);
  const setPageSize = useCallback((size: number) => {
    setPageSizeLocal(size);
    setStoredPageSize('agentManagement', size);
  }, [setStoredPageSize]);

  // 统计
  const stats = useMemo(() => {
    const total = agents.length;
    const online = agents.filter(a => a.status === 'Online').length;
    const offline = agents.filter(a => a.status === 'Offline').length;
    const highLoad = agents.filter(a => a.status === 'High Load').length;
    return { total, online, offline, highLoad };
  }, [agents]);

  // 过滤
  const filteredAgents = useMemo(() => {
    let result = agents;
    if (statusFilter !== 'all') result = result.filter(a => a.status === statusFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(a => a.ip.toLowerCase().includes(q) || a.hostname.toLowerCase().includes(q));
    }
    return result;
  }, [agents, statusFilter, searchQuery]);

  // 打开配置
  const openConfig = useCallback((agent: Agent) => {
    setSelectedAgent(agent);
    configForm.setFieldsValue(agent.config);
    setConfigModalOpen(true);
  }, [configForm]);

  // 保存配置
  const handleSaveConfig = useCallback(() => {
    if (!selectedAgent) return;
    configForm.validateFields().then((values: AgentConfig) => {
      setAgents(prev => prev.map(a => a.id === selectedAgent.id ? { ...a, config: values } : a));
      setConfigModalOpen(false);
      message.success(`Agent ${selectedAgent.hostname} 配置已保存`);
    });
  }, [configForm, selectedAgent]);

  // 重启
  const handleRestart = useCallback((agent: Agent) => {
    setAgents(prev => prev.map(a =>
      a.id === agent.id ? { ...a, status: 'Online', cpu: Math.floor(Math.random() * 30), mem: Math.floor(Math.random() * 40) } : a
    ));
    message.success(`Agent ${agent.hostname} 已重启`);
  }, []);

  // 升级
  const handleUpgrade = useCallback((agent: Agent) => {
    setAgents(prev => prev.map(a =>
      a.id === agent.id ? { ...a, version: 'v2.4.1', hasUpdate: false } : a
    ));
    message.success(`Agent ${agent.hostname} 已升级到 v2.4.1`);
  }, []);

  // 表格列
  const columns: ColumnsType<Agent> = [
    {
      title: '主机 IP/名称',
      key: 'host',
      width: 250,
      render: (_, agent) => (
        <div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 500, opacity: agent.status === 'Offline' ? 0.5 : 1 }}>{agent.ip}</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>{agent.hostname}</div>
        </div>
      ),
    },
    {
      title: 'Agent 版本',
      key: 'version',
      width: 140,
      render: (_, agent) => (
        <Space size={4}>
          <Tag style={{ fontFamily: 'JetBrains Mono, monospace' }}>{agent.version}</Tag>
          {agent.hasUpdate && <Tag color="warning" style={{ fontSize: 10 }}>Update</Tag>}
        </Space>
      ),
    },
    {
      title: '资源使用率 (CPU/Mem)',
      key: 'resources',
      width: 220,
      render: (_, agent) => (
        <div style={{ opacity: agent.status === 'Offline' ? 0.4 : 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ width: 28, fontSize: 12, color: '#94a3b8' }}>CPU</span>
            <Progress percent={agent.cpu} size="small" strokeColor={agent.cpu > 90 ? COLORS.danger : COLORS.success}
              style={{ flex: 1, margin: 0 }} format={(p) => agent.status === 'Offline' ? '-' : `${p}%`} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 28, fontSize: 12, color: '#94a3b8' }}>Mem</span>
            <Progress percent={agent.mem} size="small" strokeColor={agent.mem > 90 ? COLORS.danger : agent.mem > 70 ? COLORS.warning : COLORS.primary}
              style={{ flex: 1, margin: 0 }} format={(p) => agent.status === 'Offline' ? '-' : `${p}%`} />
          </div>
        </div>
      ),
    },
    {
      title: '日志吞吐量',
      dataIndex: 'throughput',
      key: 'throughput',
      width: 120,
      render: (v: string) => <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{v}</span>,
    },
    {
      title: '状态',
      key: 'status',
      width: 100,
      render: (_, agent) => {
        const color = agent.status === 'Online' ? 'success' : agent.status === 'High Load' ? 'warning' : 'error';
        const label = agent.status === 'Online' ? '在线' : agent.status === 'High Load' ? '高负载' : '离线';
        return (
          <Tag color={color} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: COLORS[agent.status === 'Online' ? 'success' : agent.status === 'High Load' ? 'warning' : 'danger'], display: 'inline-block' }} />
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
          <Button type="text" size="small" onClick={() => openConfig(agent)}
            icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit_document</span>} title="配置" />
          <Button type="text" size="small" onClick={() => handleRestart(agent)}
            icon={<span className="material-symbols-outlined" style={{ fontSize: 18, color: COLORS.warning }}>replay</span>} title="重启" />
          <Button type="text" size="small" disabled={agent.status === 'Offline' || !agent.hasUpdate}
            onClick={() => agent.hasUpdate && handleUpgrade(agent)}
            icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>system_update_alt</span>} title="升级" />
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, height: '100%' }}>
      {/* 头部 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Agent 管理</h2>
          <Tag>v2.4.1</Tag>
        </div>
        <Space>
          <Button icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>help</span>}>文档 Documentation</Button>
        </Space>
      </div>

      {/* 统计卡片 */}
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
              <div style={{ height: '100%', borderRadius: 3, background: COLORS.success, width: `${(stats.online / stats.total) * 100}%` }} />
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
            <span style={{ fontSize: 13, color: '#94a3b8' }}>高负载 High Load</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 28, fontWeight: 600 }}>{stats.highLoad}</span>
            {stats.highLoad > 0 && (
              <span style={{ fontSize: 12, color: COLORS.warning, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS.warning }} />
                Attention
              </span>
            )}
          </div>
        </Card>
      </div>

      {/* 搜索和过滤 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
          <Input prefix={<span className="material-symbols-outlined" style={{ fontSize: 20, color: '#94a3b8' }}>search</span>}
            placeholder="搜索主机名或 IP..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            style={{ maxWidth: 400 }} allowClear />
          <Select value={statusFilter} onChange={setStatusFilter} style={{ width: 120 }}
            options={[
              { value: 'all', label: '所有状态' },
              { value: 'Online', label: '在线' },
              { value: 'Offline', label: '离线' },
              { value: 'High Load', label: '高负载' },
            ]} />
        </div>
        <Space>
          <Button icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>restart_alt</span>}>批量重启</Button>
          <Button type="primary" icon={<span className="material-symbols-outlined" style={{ fontSize: 20 }}>add</span>}
            onClick={() => setInstallModalOpen(true)}>安装新 Agent</Button>
        </Space>
      </div>

      {/* 表格 */}
      <Card style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' } }}>
        <div style={{ flex: 1, overflow: 'auto' }}>
          <Table<Agent>
            rowKey="id" columns={columns} dataSource={filteredAgents} size="middle"
            pagination={{ pageSize, showSizeChanger: true, showTotal: (total) => `共 ${total} 个 Agent`,
              onShowSizeChange: (_, size) => setPageSize(size) }}
            scroll={{ x: 900 }}
          />
        </div>
      </Card>

      {/* Agent 配置模态框 */}
      <Modal open={configModalOpen} title={`配置 Agent - ${selectedAgent?.hostname || ''}`}
        onCancel={() => setConfigModalOpen(false)} onOk={handleSaveConfig}
        okText="保存配置" cancelText="取消" width={640} destroyOnHidden>
        {/* Agent 信息 */}
        {selectedAgent && (
          <Card size="small" style={{ marginBottom: 16, marginTop: 16 }} styles={{ body: { padding: 12 } }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
              <div><span style={{ color: '#94a3b8' }}>IP 地址:</span> <span style={{ fontFamily: 'monospace' }}>{selectedAgent.ip}</span></div>
              <div><span style={{ color: '#94a3b8' }}>版本:</span> {selectedAgent.version}</div>
              <div><span style={{ color: '#94a3b8' }}>状态:</span> <span style={{ color: COLORS[selectedAgent.status === 'Online' ? 'success' : selectedAgent.status === 'High Load' ? 'warning' : 'danger'] }}>{selectedAgent.status}</span></div>
              <div><span style={{ color: '#94a3b8' }}>最后活动:</span> {selectedAgent.lastSeen}</div>
            </div>
          </Card>
        )}
        <Form form={configForm} layout="vertical">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="logLevel" label="日志级别" extra="设置 Agent 的日志输出级别">
              <Select options={logLevelOptions} />
            </Form.Item>
            <Form.Item name="batchSize" label="批量大小" extra="每批次发送的日志条数">
              <InputNumber min={100} max={10000} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="maxCpu" label="CPU 上限 (%)" extra="Agent 最大 CPU 使用率">
              <InputNumber min={10} max={100} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="maxMem" label="内存上限 (%)" extra="Agent 最大内存使用率">
              <InputNumber min={10} max={100} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="flushInterval" label="刷新间隔 (秒)" extra="日志发送的时间间隔">
              <InputNumber min={1} max={60} style={{ width: '100%' }} />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      {/* 安装新 Agent 模态框 */}
      <Modal open={installModalOpen} title="安装新 Agent" onCancel={() => setInstallModalOpen(false)}
        footer={null} width={640}>
        <div style={{ marginTop: 16 }}>
          <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 16 }}>选择您的操作系统，然后在目标服务器上运行以下安装命令：</p>

          {/* 操作系统选择 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
            <div style={{ padding: 16, borderRadius: 8, border: `2px solid ${COLORS.primary}`, background: `${COLORS.primary}1a`, textAlign: 'center', cursor: 'pointer' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 32, color: COLORS.primary, display: 'block', marginBottom: 8 }}>computer</span>
              <span style={{ fontWeight: 500 }}>Linux</span>
            </div>
            <div style={{ padding: 16, borderRadius: 8, border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, textAlign: 'center', cursor: 'pointer' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 32, color: '#94a3b8', display: 'block', marginBottom: 8 }}>desktop_windows</span>
              <span style={{ color: '#94a3b8' }}>Windows</span>
            </div>
            <div style={{ padding: 16, borderRadius: 8, border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, textAlign: 'center', cursor: 'pointer' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 32, color: '#94a3b8', display: 'block', marginBottom: 8 }}>laptop_mac</span>
              <span style={{ color: '#94a3b8' }}>macOS</span>
            </div>
          </div>

          {/* 安装命令 */}
          <Card size="small" styles={{ body: { padding: 16 } }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>安装命令</span>
              <Button type="link" size="small" icon={<span className="material-symbols-outlined" style={{ fontSize: 14 }}>content_copy</span>}>复制</Button>
            </div>
            <pre style={{ fontSize: 13, color: '#10b981', fontFamily: 'JetBrains Mono, monospace', margin: 0, overflowX: 'auto' }}>
{`curl -sSL https://logscale.pro/install.sh | sudo bash -s -- \\
  --token=YOUR_API_TOKEN \\
  --server=https://api.logscale.pro`}
            </pre>
          </Card>

          {/* 注意事项 */}
          <div style={{ marginTop: 16, padding: 16, borderRadius: 8, background: `${COLORS.warning}1a`, border: `1px solid ${COLORS.warning}33` }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <span className="material-symbols-outlined" style={{ color: COLORS.warning }}>info</span>
              <div style={{ fontSize: 13 }}>
                <p style={{ color: COLORS.warning, fontWeight: 500, marginBottom: 8 }}>注意事项</p>
                <ul style={{ color: '#94a3b8', paddingLeft: 16, margin: 0 }}>
                  <li>确保目标服务器可以访问 api.logscale.pro</li>
                  <li>安装需要 root 权限</li>
                  <li>Agent 将自动注册并开始采集日志</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AgentManagement;
