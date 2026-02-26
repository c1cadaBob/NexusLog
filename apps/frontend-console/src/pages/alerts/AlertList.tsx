import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Input, Select, Table, Tag, Button, Card, Statistic, Space, Modal, message, Badge } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useThemeStore } from '../../stores/themeStore';
import { usePreferencesStore } from '../../stores/preferencesStore';
import { useAlertStore } from '../../stores/alertStore';
import { COLORS } from '../../theme/tokens';
import type { AlertSummary, AlertSeverity, AlertStatus } from '../../types/alert';
import { ALERT_SEVERITY_CONFIG, ALERT_STATUS_CONFIG } from '../../types/alert';

// ============================================================================
// 模拟数据
// ============================================================================

const mockAlerts: AlertSummary[] = [
  { id: '1', name: 'CPU Usage > 90%', severity: 'critical', status: 'active', source: 'auth-service-prod', count: 5, lastTriggeredAt: Date.now() - 920000 },
  { id: '2', name: 'Memory High (85%)', severity: 'high', status: 'active', source: 'payment-gateway', count: 3, lastTriggeredAt: Date.now() - 1145000 },
  { id: '3', name: 'Database Connection Timeout', severity: 'critical', status: 'acknowledged', source: 'db-service', count: 12, lastTriggeredAt: Date.now() - 1640000 },
  { id: '4', name: 'New Deployment', severity: 'low', status: 'resolved', source: 'ci-cd-pipeline', count: 1, lastTriggeredAt: Date.now() - 5522000 },
  { id: '5', name: 'High Memory Usage', severity: 'medium', status: 'active', source: 'worker-node-05', count: 8, lastTriggeredAt: Date.now() - 3730000 },
  { id: '6', name: 'Slow Query Detected', severity: 'medium', status: 'active', source: 'db-master', count: 15, lastTriggeredAt: Date.now() - 4205000 },
  { id: '7', name: 'API Latency Spike', severity: 'high', status: 'silenced', source: 'api-gateway', count: 7, lastTriggeredAt: Date.now() - 2100000 },
  { id: '8', name: 'Disk Space Low', severity: 'critical', status: 'active', source: 'storage-node-01', count: 2, lastTriggeredAt: Date.now() - 600000 },
];

// ============================================================================
// 辅助函数
// ============================================================================

const formatTimeAgo = (timestamp: number): string => {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}秒前`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return `${days}天前`;
};

const severityTagColor: Record<AlertSeverity, string> = {
  critical: 'error',
  high: 'warning',
  medium: 'processing',
  low: 'success',
};

// ============================================================================
// 组件
// ============================================================================

const AlertList: React.FC = () => {
  const isDark = useThemeStore((s) => s.isDark);
  const markAllAsRead = useAlertStore((s) => s.markAllAsRead);

  // 进入告警列表页面时，清除侧边栏未读红点
  useEffect(() => {
    markAllAsRead();
  }, [markAllAsRead]);

  // 状态
  const [alerts, setAlerts] = useState<AlertSummary[]>(mockAlerts);
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<AlertStatus | 'all'>('all');
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [silenceModalOpen, setSilenceModalOpen] = useState(false);
  const [silenceDuration, setSilenceDuration] = useState(3600);
  const [batchRunning, setBatchRunning] = useState(false);

  // 分页
  const storedPageSize = usePreferencesStore((s) => s.pageSizes['alertList'] ?? 10);
  const setStoredPageSize = usePreferencesStore((s) => s.setPageSize);
  const [pageSize, setPageSizeLocal] = useState(storedPageSize);
  const setPageSize = useCallback((size: number) => {
    setPageSizeLocal(size);
    setStoredPageSize('alertList', size);
  }, [setStoredPageSize]);

  // 过滤后的告警
  const filteredAlerts = useMemo(() => {
    return alerts.filter(alert => {
      if (search) {
        const s = search.toLowerCase();
        if (!alert.name.toLowerCase().includes(s) && !alert.source.toLowerCase().includes(s)) return false;
      }
      if (severityFilter !== 'all' && alert.severity !== severityFilter) return false;
      if (statusFilter !== 'all' && alert.status !== statusFilter) return false;
      return true;
    });
  }, [alerts, search, severityFilter, statusFilter]);

  // 统计
  const stats = useMemo(() => ({
    pending: alerts.filter(a => a.status === 'active').length,
    critical: alerts.filter(a => a.severity === 'critical' && a.status !== 'resolved').length,
    warning: alerts.filter(a => (a.severity === 'high' || a.severity === 'medium') && a.status !== 'resolved').length,
    silenced: alerts.filter(a => a.status === 'silenced').length,
  }), [alerts]);

  // 操作
  const handleAcknowledge = useCallback((id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'acknowledged' as AlertStatus } : a));
    message.success('告警已确认');
  }, []);

  const handleResolve = useCallback((id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'resolved' as AlertStatus } : a));
    message.success('告警已解决');
  }, []);

  const handleSilence = useCallback((id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'silenced' as AlertStatus } : a));
    message.success('告警已静默');
  }, []);

  // 批量操作
  const executeBatch = useCallback(async (type: 'acknowledge' | 'resolve' | 'silence') => {
    if (selectedRowKeys.length === 0) return;
    setBatchRunning(true);
    const newStatus: AlertStatus = type === 'acknowledge' ? 'acknowledged' : type === 'resolve' ? 'resolved' : 'silenced';
    // 模拟逐条处理
    for (const id of selectedRowKeys) {
      await new Promise(r => setTimeout(r, 150));
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a));
    }
    setBatchRunning(false);
    setSelectedRowKeys([]);
    message.success(`成功处理 ${selectedRowKeys.length} 条告警`);
  }, [selectedRowKeys]);

  const confirmBatchSilence = useCallback(() => {
    setSilenceModalOpen(false);
    executeBatch('silence');
  }, [executeBatch]);

  // 表格列定义
  const columns: ColumnsType<AlertSummary> = [
    {
      title: '等级',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (severity: AlertSeverity) => (
        <Tag
          icon={<span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: 'middle', marginRight: 2 }}>{ALERT_SEVERITY_CONFIG[severity].icon}</span>}
          color={severityTagColor[severity]}
        >
          {ALERT_SEVERITY_CONFIG[severity].label}
        </Tag>
      ),
    },
    {
      title: '告警名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <span style={{ fontWeight: 500 }}>{name}</span>,
    },
    {
      title: '来源',
      dataIndex: 'source',
      key: 'source',
      render: (source: string) => (
        <code style={{ fontSize: 12, padding: '2px 6px', borderRadius: 4, background: isDark ? '#232f48' : '#f1f5f9' }}>
          {source}
        </code>
      ),
    },
    {
      title: '触发次数',
      dataIndex: 'count',
      key: 'count',
      width: 100,
      render: (count: number) => <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{count}</span>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: AlertStatus) => (
        <Badge
          status={status === 'active' ? 'error' : status === 'acknowledged' ? 'warning' : status === 'resolved' ? 'success' : 'default'}
          text={ALERT_STATUS_CONFIG[status].label}
          style={{ whiteSpace: 'nowrap' }}
        />
      ),
    },
    {
      title: '最后触发',
      dataIndex: 'lastTriggeredAt',
      key: 'lastTriggeredAt',
      width: 120,
      render: (ts: number) => <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{formatTimeAgo(ts)}</span>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      align: 'right',
      render: (_, record) => (
        <Space size={4}>
          {record.status === 'active' && (
            <Button type="text" size="small" onClick={() => handleAcknowledge(record.id)} title="确认"
              icon={<span className="material-symbols-outlined" style={{ fontSize: 18, color: COLORS.warning }}>check_circle</span>}
            />
          )}
          {(record.status === 'active' || record.status === 'acknowledged') && (
            <Button type="text" size="small" onClick={() => handleResolve(record.id)} title="解决"
              icon={<span className="material-symbols-outlined" style={{ fontSize: 18, color: COLORS.success }}>task_alt</span>}
            />
          )}
          {record.status !== 'silenced' && record.status !== 'resolved' && (
            <Button type="text" size="small" onClick={() => handleSilence(record.id)} title="静默"
              icon={<span className="material-symbols-outlined" style={{ fontSize: 18, color: COLORS.info }}>notifications_off</span>}
            />
          )}
          <Button type="text" size="small" title="查看日志"
            icon={<span className="material-symbols-outlined" style={{ fontSize: 18, color: COLORS.primary }}>description</span>}
          />
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, height: '100%' }}>
      {/* 头部 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>告警列表</h2>
          <Tag color="blue">Live</Tag>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button
            type="text"
            shape="circle"
            icon={<span className="material-symbols-outlined" style={{ fontSize: 20 }}>refresh</span>}
            onClick={() => message.info('正在刷新告警数据...')}
          />
          <Badge status="success" text="系统正常" />
        </div>
      </div>

      {/* 统计卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <Card size="small" styles={{ body: { padding: '20px' } }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Statistic title="待处理告警" value={stats.pending} valueStyle={{ fontSize: 28, fontWeight: 700 }} />
            <div style={{ padding: 8, borderRadius: 8, background: `${COLORS.primary}1a` }}>
              <span className="material-symbols-outlined" style={{ color: COLORS.primary }}>pending_actions</span>
            </div>
          </div>
        </Card>
        <Card size="small" styles={{ body: { padding: '20px' } }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Statistic title="严重告警" value={stats.critical} valueStyle={{ fontSize: 28, fontWeight: 700, color: COLORS.danger }} />
            <div style={{ padding: 8, borderRadius: 8, background: `${COLORS.danger}1a` }}>
              <span className="material-symbols-outlined" style={{ color: COLORS.danger }}>gpp_maybe</span>
            </div>
          </div>
        </Card>
        <Card size="small" styles={{ body: { padding: '20px' } }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Statistic title="警告告警" value={stats.warning} valueStyle={{ fontSize: 28, fontWeight: 700, color: COLORS.warning }} />
            <div style={{ padding: 8, borderRadius: 8, background: `${COLORS.warning}1a` }}>
              <span className="material-symbols-outlined" style={{ color: COLORS.warning }}>warning</span>
            </div>
          </div>
        </Card>
        <Card size="small" styles={{ body: { padding: '20px' } }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Statistic title="静默中" value={stats.silenced} valueStyle={{ fontSize: 28, fontWeight: 700 }} />
            <div style={{ padding: 8, borderRadius: 8, background: isDark ? '#334155' : '#f1f5f9' }}>
              <span className="material-symbols-outlined" style={{ color: '#94a3b8' }}>notifications_paused</span>
            </div>
          </div>
        </Card>
      </div>

      {/* 主表格卡片 */}
      <Card
        style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' } }}
      >
        {/* 过滤器 */}
        <div style={{ padding: '16px 24px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
          <Input
            prefix={<span className="material-symbols-outlined" style={{ fontSize: 20, color: '#94a3b8' }}>search</span>}
            placeholder="按告警名称、来源搜索..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 240 }}
            allowClear
          />
          <Select
            value={severityFilter}
            onChange={setSeverityFilter}
            style={{ width: 140 }}
            options={[
              { value: 'all', label: '所有等级' },
              { value: 'critical', label: '严重 (Critical)' },
              { value: 'high', label: '高 (High)' },
              { value: 'medium', label: '中 (Medium)' },
              { value: 'low', label: '低 (Low)' },
            ]}
          />
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 160 }}
            options={[
              { value: 'all', label: '状态: 全部' },
              { value: 'active', label: '活跃 (Active)' },
              { value: 'acknowledged', label: '已确认' },
              { value: 'resolved', label: '已解决' },
              { value: 'silenced', label: '静默' },
            ]}
          />
          {selectedRowKeys.length > 0 && (
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: '#94a3b8' }}>已选择 {selectedRowKeys.length} 项</span>
              <Button size="small" onClick={() => executeBatch('acknowledge')} loading={batchRunning}
                style={{ background: `${COLORS.warning}33`, borderColor: `${COLORS.warning}4d`, color: COLORS.warning }}
                icon={<span className="material-symbols-outlined" style={{ fontSize: 16 }}>check_circle</span>}
              >批量确认</Button>
              <Button size="small" onClick={() => executeBatch('resolve')} loading={batchRunning}
                style={{ background: `${COLORS.success}33`, borderColor: `${COLORS.success}4d`, color: COLORS.success }}
                icon={<span className="material-symbols-outlined" style={{ fontSize: 16 }}>task_alt</span>}
              >批量解决</Button>
              <Button size="small" onClick={() => setSilenceModalOpen(true)} loading={batchRunning}
                style={{ background: `${COLORS.info}33`, borderColor: `${COLORS.info}4d`, color: COLORS.info }}
                icon={<span className="material-symbols-outlined" style={{ fontSize: 16 }}>notifications_off</span>}
              >批量静默</Button>
            </div>
          )}
        </div>

        {/* 表格 */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          <Table<AlertSummary>
            rowKey="id"
            columns={columns}
            dataSource={filteredAlerts}
            size="middle"
            rowSelection={{
              selectedRowKeys,
              onChange: setSelectedRowKeys,
            }}
            pagination={{
              current: undefined,
              pageSize,
              showSizeChanger: true,
              showTotal: (total, range) => `显示 ${range[0]} 到 ${range[1]} 条，共 ${total} 条`,
              onShowSizeChange: (_, size) => setPageSize(size),
            }}
            scroll={{ x: 800 }}
          />
        </div>
      </Card>

      {/* 批量静默模态框 */}
      <Modal
        open={silenceModalOpen}
        title="批量静默告警"
        onCancel={() => setSilenceModalOpen(false)}
        onOk={confirmBatchSilence}
        okText="确认静默"
        cancelText="取消"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ color: '#94a3b8' }}>
            将对 <span style={{ fontWeight: 500 }}>{selectedRowKeys.length}</span> 条告警执行静默操作
          </p>
          <div>
            <div style={{ marginBottom: 8, fontWeight: 500, fontSize: 14 }}>静默时长</div>
            <Select
              value={silenceDuration}
              onChange={setSilenceDuration}
              style={{ width: '100%' }}
              options={[
                { value: 1800, label: '30 分钟' },
                { value: 3600, label: '1 小时' },
                { value: 7200, label: '2 小时' },
                { value: 14400, label: '4 小时' },
                { value: 28800, label: '8 小时' },
                { value: 86400, label: '24 小时' },
              ]}
            />
          </div>
          <div>
            <div style={{ marginBottom: 8, fontWeight: 500, fontSize: 14 }}>备注（可选）</div>
            <Input.TextArea placeholder="请输入静默原因..." rows={3} />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AlertList;
