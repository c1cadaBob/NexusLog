import React, { useState, useMemo, useCallback } from 'react';
import { Input, Select, Table, Tag, Button, Card, Statistic, Space, Modal, Form, Switch, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useThemeStore } from '../../stores/themeStore';
import { COLORS } from '../../theme/tokens';
import type { AlertRule, AlertSeverity, RuleStatus, ConditionOperator } from '../../types/alert';
import { ALERT_SEVERITY_CONFIG } from '../../types/alert';

// ============================================================================
// 模拟数据
// ============================================================================

const mockRules: AlertRule[] = [
  {
    id: '1', name: 'Error Rate Spikes', description: '监控错误率突增',
    query: "count(level='ERROR') / count(*) * 100",
    conditions: [{ metric: 'error_rate', operator: 'gt', threshold: 5, duration: 300 }],
    severity: 'critical', status: 'enabled', evaluationInterval: 60, forDuration: 300,
    labels: { team: 'devops' }, annotations: {}, actions: [],
    createdBy: 'admin', createdAt: Date.now() - 86400000 * 30, updatedAt: Date.now() - 86400000 * 2,
    lastEvaluatedAt: Date.now() - 60000,
  },
  {
    id: '2', name: 'Latency Warning', description: '监控 P99 延迟',
    query: 'p99(latency)',
    conditions: [{ metric: 'latency_p99', operator: 'gt', threshold: 500 }],
    severity: 'high', status: 'enabled', evaluationInterval: 300, forDuration: 600,
    labels: { team: 'sre' }, annotations: {}, actions: [],
    createdBy: 'admin', createdAt: Date.now() - 86400000 * 20, updatedAt: Date.now() - 86400000 * 5,
    lastEvaluatedAt: Date.now() - 300000,
  },
  {
    id: '3', name: 'Login Failures', description: '监控登录失败次数',
    query: "count(event='login_fail')",
    conditions: [{ metric: 'login_failures', operator: 'gt', threshold: 10 }],
    severity: 'medium', status: 'error', evaluationInterval: 600, forDuration: 600,
    labels: { team: 'security' }, annotations: {}, actions: [],
    createdBy: 'admin', createdAt: Date.now() - 86400000 * 15, updatedAt: Date.now() - 86400000,
    lastEvaluatedAt: Date.now() - 120000,
  },
];

// ============================================================================
// 辅助函数
// ============================================================================

const severityTagColor: Record<AlertSeverity, string> = {
  critical: 'error', high: 'warning', medium: 'processing', low: 'success',
};

const formatInterval = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h`;
};

const formatTimeAgo = (timestamp: number): string => {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}秒前`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  return `${Math.floor(hours / 24)}天前`;
};

// ============================================================================
// 组件
// ============================================================================

const AlertRules: React.FC = () => {
  const isDark = useThemeStore((s) => s.isDark);
  const [form] = Form.useForm();

  // 状态
  const [rules, setRules] = useState<AlertRule[]>(mockRules);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<RuleStatus | 'all'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [currentRule, setCurrentRule] = useState<AlertRule | null>(null);

  // 过滤
  const filteredRules = useMemo(() => {
    return rules.filter(rule => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!rule.name.toLowerCase().includes(q) && !rule.query.toLowerCase().includes(q)) return false;
      }
      if (statusFilter !== 'all' && rule.status !== statusFilter) return false;
      return true;
    });
  }, [rules, searchQuery, statusFilter]);

  // 统计
  const stats = useMemo(() => ({
    total: rules.length,
    enabled: rules.filter(r => r.status === 'enabled').length,
    disabled: rules.filter(r => r.status === 'disabled').length,
    error: rules.filter(r => r.status === 'error').length,
  }), [rules]);

  // 打开创建
  const openCreate = useCallback(() => {
    setModalMode('create');
    setCurrentRule(null);
    form.resetFields();
    setModalOpen(true);
  }, [form]);

  // 打开编辑
  const openEdit = useCallback((rule: AlertRule) => {
    setModalMode('edit');
    setCurrentRule(rule);
    form.setFieldsValue({
      name: rule.name,
      description: rule.description,
      query: rule.query,
      severity: rule.severity,
      evaluationInterval: rule.evaluationInterval,
      conditionMetric: rule.conditions[0]?.metric || '',
      conditionOperator: rule.conditions[0]?.operator || 'gt',
      conditionThreshold: rule.conditions[0]?.threshold || 0,
    });
    setModalOpen(true);
  }, [form]);

  // 提交表单
  const handleSubmit = useCallback(() => {
    form.validateFields().then(values => {
      if (modalMode === 'create') {
        const newRule: AlertRule = {
          id: `rule-${Date.now()}`,
          name: values.name,
          description: values.description || '',
          query: values.query,
          conditions: [{ metric: values.conditionMetric || '', operator: values.conditionOperator || 'gt', threshold: values.conditionThreshold || 0 }],
          severity: values.severity,
          status: 'enabled',
          evaluationInterval: values.evaluationInterval,
          forDuration: 300,
          labels: {}, annotations: {}, actions: [],
          createdBy: 'current_user', createdAt: Date.now(), updatedAt: Date.now(),
        };
        setRules(prev => [...prev, newRule]);
        message.success(`规则 "${values.name}" 已创建`);
      } else if (currentRule) {
        setRules(prev => prev.map(r => r.id === currentRule.id ? {
          ...r, name: values.name, description: values.description || '', query: values.query,
          severity: values.severity, evaluationInterval: values.evaluationInterval,
          conditions: [{ metric: values.conditionMetric || '', operator: values.conditionOperator || 'gt', threshold: values.conditionThreshold || 0 }],
          updatedAt: Date.now(),
        } : r));
        message.success(`规则 "${values.name}" 已更新`);
      }
      setModalOpen(false);
    });
  }, [form, modalMode, currentRule]);

  // 删除
  const handleDelete = useCallback(() => {
    if (!currentRule) return;
    setRules(prev => prev.filter(r => r.id !== currentRule.id));
    setDeleteModalOpen(false);
    message.success(`规则 "${currentRule.name}" 已删除`);
    setCurrentRule(null);
  }, [currentRule]);

  // 启用/禁用
  const toggleStatus = useCallback((rule: AlertRule) => {
    const newStatus: RuleStatus = rule.status === 'enabled' ? 'disabled' : 'enabled';
    setRules(prev => prev.map(r => r.id === rule.id ? { ...r, status: newStatus, updatedAt: Date.now() } : r));
    message.success(`规则 "${rule.name}" 已${newStatus === 'enabled' ? '启用' : '禁用'}`);
  }, []);

  // 表格列
  const columns: ColumnsType<AlertRule> = [
    {
      title: '规则名称',
      key: 'name',
      render: (_, rule) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 24, height: 24, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `${COLORS[rule.severity === 'critical' ? 'danger' : rule.severity === 'high' ? 'warning' : rule.severity === 'medium' ? 'info' : 'success']}1a`,
            color: COLORS[rule.severity === 'critical' ? 'danger' : rule.severity === 'high' ? 'warning' : rule.severity === 'medium' ? 'info' : 'success'],
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{ALERT_SEVERITY_CONFIG[rule.severity].icon}</span>
          </div>
          <div>
            <div style={{ fontWeight: 500 }}>{rule.name}</div>
            {rule.description && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{rule.description}</div>}
          </div>
        </div>
      ),
    },
    {
      title: '查询条件',
      dataIndex: 'query',
      key: 'query',
      width: '25%',
      render: (query: string) => (
        <code style={{ fontSize: 12, padding: '4px 8px', borderRadius: 4, display: 'inline-block', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          background: isDark ? '#0f172a' : '#f1f5f9', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
        }} title={query}>{query}</code>
      ),
    },
    {
      title: '严重程度',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (severity: AlertSeverity) => (
        <Tag color={severityTagColor[severity]}>{ALERT_SEVERITY_CONFIG[severity].label}</Tag>
      ),
    },
    {
      title: '评估间隔',
      dataIndex: 'evaluationInterval',
      key: 'evaluationInterval',
      width: 90,
      render: (v: number) => <span style={{ fontSize: 12, color: '#94a3b8' }}>{formatInterval(v)}</span>,
    },
    {
      title: '健康状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: RuleStatus) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {status === 'enabled' ? (
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS.success, display: 'inline-block', animation: 'pulse 2s infinite' }} />
          ) : status === 'error' ? (
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: COLORS.danger }}>cancel</span>
          ) : (
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#64748b', display: 'inline-block' }} />
          )}
          <span style={{ fontSize: 12, color: status === 'enabled' ? COLORS.success : status === 'error' ? COLORS.danger : '#94a3b8' }}>
            {status === 'enabled' ? '正常' : status === 'disabled' ? '已禁用' : '异常'}
          </span>
        </div>
      ),
    },
    {
      title: '最后评估',
      dataIndex: 'lastEvaluatedAt',
      key: 'lastEvaluatedAt',
      width: 100,
      render: (ts?: number) => <span style={{ fontSize: 12, color: '#94a3b8' }}>{ts ? formatTimeAgo(ts) : '-'}</span>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 140,
      align: 'right',
      render: (_, rule) => (
        <Space size={8}>
          <Switch
            size="small"
            checked={rule.status === 'enabled'}
            onChange={() => toggleStatus(rule)}
          />
          <Button type="text" size="small" onClick={() => openEdit(rule)}
            icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit</span>}
          />
          <Button type="text" size="small" danger onClick={() => { setCurrentRule(rule); setDeleteModalOpen(true); }}
            icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>}
          />
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, height: '100%' }}>
      {/* 头部 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>告警规则</h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8' }}>配置告警条件和通知路由</p>
        </div>
        <Space>
          <Button icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>help</span>}>帮助文档</Button>
          <Button type="primary" icon={<span className="material-symbols-outlined" style={{ fontSize: 20 }}>add</span>} onClick={openCreate}>
            新建规则
          </Button>
        </Space>
      </div>

      {/* 统计卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <Card size="small" styles={{ body: { padding: 16 } }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ padding: 8, borderRadius: 8, background: `${COLORS.primary}1a` }}>
              <span className="material-symbols-outlined" style={{ color: COLORS.primary }}>rule</span>
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>总规则数</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{stats.total}</div>
            </div>
          </div>
        </Card>
        <Card size="small" styles={{ body: { padding: 16 } }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ padding: 8, borderRadius: 8, background: `${COLORS.success}1a` }}>
              <span className="material-symbols-outlined" style={{ color: COLORS.success }}>check_circle</span>
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>已启用</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{stats.enabled}</div>
            </div>
          </div>
        </Card>
        <Card size="small" styles={{ body: { padding: 16 } }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ padding: 8, borderRadius: 8, background: isDark ? '#334155' : '#f1f5f9' }}>
              <span className="material-symbols-outlined" style={{ color: '#94a3b8' }}>pause_circle</span>
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>已禁用</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{stats.disabled}</div>
            </div>
          </div>
        </Card>
        <Card size="small" styles={{ body: { padding: 16 } }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ padding: 8, borderRadius: 8, background: `${COLORS.danger}1a` }}>
              <span className="material-symbols-outlined" style={{ color: COLORS.danger }}>error</span>
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>异常</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{stats.error}</div>
            </div>
          </div>
        </Card>
      </div>

      {/* 主表格 */}
      <Card style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' } }}>
        {/* 过滤器 */}
        <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
            <Input
              prefix={<span className="material-symbols-outlined" style={{ fontSize: 20, color: '#94a3b8' }}>search</span>}
              placeholder="搜索规则名称或查询..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ maxWidth: 400 }}
              allowClear
            />
            <Select value={statusFilter} onChange={setStatusFilter} style={{ width: 120 }}
              options={[
                { value: 'all', label: '所有状态' },
                { value: 'enabled', label: '已启用' },
                { value: 'disabled', label: '已禁用' },
                { value: 'error', label: '异常' },
              ]}
            />
          </div>
          <Space>
            <Button type="text" icon={<span className="material-symbols-outlined" style={{ fontSize: 20 }}>refresh</span>} />
            <Button type="text" icon={<span className="material-symbols-outlined" style={{ fontSize: 20 }}>download</span>} />
          </Space>
        </div>

        <div style={{ flex: 1, overflow: 'auto' }}>
          <Table<AlertRule>
            rowKey="id"
            columns={columns}
            dataSource={filteredRules}
            size="middle"
            pagination={false}
            scroll={{ x: 900 }}
          />
        </div>
      </Card>

      {/* 创建/编辑规则模态框 */}
      <Modal
        open={modalOpen}
        title={modalMode === 'create' ? '新建告警规则' : '编辑告警规则'}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        okText={modalMode === 'create' ? '创建' : '保存'}
        cancelText="取消"
        width={640}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="规则名称" rules={[{ required: true, message: '请输入规则名称' }]}>
            <Input placeholder="输入规则名称" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea placeholder="输入规则描述" rows={2} />
          </Form.Item>
          <Form.Item name="query" label="查询表达式" rules={[{ required: true, message: '请输入查询表达式' }]}>
            <Input.TextArea placeholder="输入查询表达式，如: count(level='ERROR') > 10" rows={3} style={{ fontFamily: 'JetBrains Mono, monospace' }} />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="severity" label="严重程度" initialValue="medium">
              <Select options={[
                { value: 'critical', label: '严重 (Critical)' },
                { value: 'high', label: '高 (High)' },
                { value: 'medium', label: '中 (Medium)' },
                { value: 'low', label: '低 (Low)' },
              ]} />
            </Form.Item>
            <Form.Item name="evaluationInterval" label="评估间隔" initialValue={60}>
              <Select options={[
                { value: 30, label: '30 秒' },
                { value: 60, label: '1 分钟' },
                { value: 300, label: '5 分钟' },
                { value: 600, label: '10 分钟' },
                { value: 900, label: '15 分钟' },
              ]} />
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <Form.Item name="conditionMetric" label="条件指标">
              <Input placeholder="指标名称" />
            </Form.Item>
            <Form.Item name="conditionOperator" label="操作符" initialValue="gt">
              <Select options={[
                { value: 'gt', label: '大于 (>)' },
                { value: 'gte', label: '大于等于 (>=)' },
                { value: 'lt', label: '小于 (<)' },
                { value: 'lte', label: '小于等于 (<=)' },
                { value: 'eq', label: '等于 (=)' },
                { value: 'ne', label: '不等于 (!=)' },
              ]} />
            </Form.Item>
            <Form.Item name="conditionThreshold" label="阈值">
              <Input type="number" placeholder="阈值" />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      {/* 删除确认 */}
      <Modal
        open={deleteModalOpen}
        title="删除告警规则"
        onCancel={() => setDeleteModalOpen(false)}
        onOk={handleDelete}
        okText="删除"
        okButtonProps={{ danger: true }}
        cancelText="取消"
      >
        <p style={{ color: '#94a3b8' }}>
          确定要删除规则 <span style={{ fontWeight: 500 }}>"{currentRule?.name}"</span> 吗？此操作不可撤销。
        </p>
      </Modal>
    </div>
  );
};

export default AlertRules;
