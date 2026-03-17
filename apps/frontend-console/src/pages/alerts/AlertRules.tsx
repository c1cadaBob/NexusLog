import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Input, Select, Table, Tag, Button, Card, Space, Modal, Form, Switch, message, Spin, Empty } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useThemeStore } from '../../stores/themeStore';
import { COLORS } from '../../theme/tokens';
import type { AlertRule, AlertSeverity, RuleStatus } from '../../types/alert';
import { ALERT_SEVERITY_CONFIG } from '../../types/alert';
import {
  fetchAlertRules,
  createAlertRule,
  updateAlertRule,
  deleteAlertRule,
  enableAlertRule,
  disableAlertRule,
  type CreateAlertRulePayload,
} from '../../api/alert';

const severityTagColor: Record<AlertSeverity, string> = {
  critical: 'error',
  high: 'warning',
  medium: 'processing',
  low: 'success',
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

const AlertRules: React.FC = () => {
  const isDark = useThemeStore((s) => s.isDark);
  const [form] = Form.useForm();

  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<RuleStatus | 'all'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [currentRule, setCurrentRule] = useState<AlertRule | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [ruleType, setRuleType] = useState<'keyword' | 'level_count' | 'threshold'>('keyword');

  const loadRules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { items } = await fetchAlertRules(1, 200);
      setRules(items);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载告警规则失败';
      setError(msg);
      message.error(msg);
      setRules([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const filteredRules = useMemo(() => {
    return rules.filter((rule) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!rule.name.toLowerCase().includes(q) && !rule.query.toLowerCase().includes(q)) return false;
      }
      if (statusFilter !== 'all' && rule.status !== statusFilter) return false;
      return true;
    });
  }, [rules, searchQuery, statusFilter]);

  const stats = useMemo(
    () => ({
      total: rules.length,
      enabled: rules.filter((r) => r.status === 'enabled').length,
      disabled: rules.filter((r) => r.status === 'disabled').length,
      error: rules.filter((r) => r.status === 'error').length,
    }),
    [rules],
  );

  const openCreate = useCallback(() => {
    setModalMode('create');
    setCurrentRule(null);
    setRuleType('keyword');
    form.resetFields();
    form.setFieldsValue({
      ruleType: 'keyword',
      severity: 'medium',
      evaluationInterval: 60,
      conditionOperator: 'gt',
    });
    setModalOpen(true);
  }, [form]);

  const openEdit = useCallback(
    (rule: AlertRule) => {
      setModalMode('edit');
      setCurrentRule(rule);
      const cond = rule.conditions[0];
      let rt: 'keyword' | 'level_count' | 'threshold' = 'keyword';
      if (rule.query.includes('count(level=')) rt = 'level_count';
      else if (cond?.metric && cond.metric !== 'value' && cond.metric !== 'level_count') rt = 'threshold';
      setRuleType(rt);

      form.setFieldsValue({
        name: rule.name,
        description: rule.description,
        query: rule.query,
        ruleType: rt,
        severity: rule.severity,
        evaluationInterval: rule.evaluationInterval,
        conditionMetric: cond?.metric || '',
        conditionOperator: cond?.operator || 'gt',
        conditionThreshold: cond?.threshold ?? 0,
        keyword: rule.query.match(/contains\([^,]+,\s*'([^']+)'\)/)?.[1] || '',
        keywordField: rule.query.match(/contains\(([^,]+),/)?.[1] || 'message',
        level: rule.query.match(/level='([^']+)'/)?.[1] || 'ERROR',
        windowSeconds: 300,
      });
      setModalOpen(true);
    },
    [form],
  );

  const buildCreatePayload = useCallback((): CreateAlertRulePayload => {
    const values = form.getFieldsValue();
    if (values.ruleType === 'keyword') {
      const keyword = values.keyword || values.query?.match(/contains\([^,]+,\s*'([^']+)'\)/)?.[1] || '';
      const field = values.keywordField || 'message';
      return {
        name: values.name,
        description: values.description,
        conditionType: 'keyword',
        condition: { keyword, field },
        severity: values.severity,
        enabled: true,
      };
    }
    if (values.ruleType === 'level_count') {
      return {
        name: values.name,
        description: values.description,
        conditionType: 'level_count',
        condition: {
          level: values.level || 'ERROR',
          threshold: values.conditionThreshold ?? 10,
          window_seconds: values.windowSeconds ?? 300,
        },
        severity: values.severity,
        enabled: true,
      };
    }
    return {
      name: values.name,
      description: values.description,
      conditionType: 'threshold',
      condition: {
        metric: values.conditionMetric || '',
        operator: values.conditionOperator || 'gt',
        value: values.conditionThreshold ?? 0,
      },
      severity: values.severity,
      enabled: true,
    };
  }, [form]);

  const handleSubmit = useCallback(async () => {
    try {
      await form.validateFields();
    } catch {
      return;
    }
    setSubmitting(true);
    try {
      if (modalMode === 'create') {
        const payload = buildCreatePayload();
        await createAlertRule(payload);
        message.success(`规则 "${payload.name}" 已创建`);
      } else if (currentRule) {
        const values = form.getFieldsValue();
        const update: Parameters<typeof updateAlertRule>[1] = {
          name: values.name,
          description: values.description,
          severity: values.severity,
        };
        if (values.ruleType === 'keyword') {
          update.conditionType = 'keyword';
          update.condition = {
            keyword: values.keyword || '',
            field: values.keywordField || 'message',
          };
        } else if (values.ruleType === 'level_count') {
          update.conditionType = 'level_count';
          update.condition = {
            level: values.level || 'ERROR',
            threshold: values.conditionThreshold ?? 10,
            window_seconds: values.windowSeconds ?? 300,
          };
        } else {
          update.conditionType = 'threshold';
          update.condition = {
            metric: values.conditionMetric || '',
            operator: values.conditionOperator || 'gt',
            value: values.conditionThreshold ?? 0,
          };
        }
        await updateAlertRule(currentRule.id, update);
        message.success(`规则 "${values.name}" 已更新`);
      }
      setModalOpen(false);
      await loadRules();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '操作失败');
    } finally {
      setSubmitting(false);
    }
  }, [form, modalMode, currentRule, buildCreatePayload, loadRules]);

  const handleDelete = useCallback(async () => {
    if (!currentRule) return;
    setSubmitting(true);
    try {
      await deleteAlertRule(currentRule.id);
      setDeleteModalOpen(false);
      message.success(`规则 "${currentRule.name}" 已删除`);
      setCurrentRule(null);
      await loadRules();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除失败');
    } finally {
      setSubmitting(false);
    }
  }, [currentRule, loadRules]);

  const toggleStatus = useCallback(
    async (rule: AlertRule) => {
      try {
        if (rule.status === 'enabled') {
          await disableAlertRule(rule.id);
          message.success(`规则 "${rule.name}" 已禁用`);
        } else {
          await enableAlertRule(rule.id);
          message.success(`规则 "${rule.name}" 已启用`);
        }
        await loadRules();
      } catch (err) {
        message.error(err instanceof Error ? err.message : '操作失败');
      }
    },
    [loadRules],
  );

  const columns: ColumnsType<AlertRule> = [
    {
      title: '规则名称',
      key: 'name',
      render: (_, rule) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: `${COLORS[rule.severity === 'critical' ? 'danger' : rule.severity === 'high' ? 'warning' : rule.severity === 'medium' ? 'info' : 'success']}1a`,
              color:
                COLORS[
                  rule.severity === 'critical' ? 'danger' : rule.severity === 'high' ? 'warning' : rule.severity === 'medium' ? 'info' : 'success'
                ],
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              {ALERT_SEVERITY_CONFIG[rule.severity].icon}
            </span>
          </div>
          <div>
            <div style={{ fontWeight: 500 }}>{rule.name}</div>
            {rule.description && (
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{rule.description}</div>
            )}
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
        <code
          style={{
            fontSize: 12,
            padding: '4px 8px',
            borderRadius: 4,
            display: 'inline-block',
            maxWidth: 260,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            background: isDark ? '#0f172a' : '#f1f5f9',
            border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
          }}
          title={query}
        >
          {query}
        </code>
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
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: COLORS.success,
                display: 'inline-block',
                animation: 'pulse 2s infinite',
              }}
            />
          ) : status === 'error' ? (
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: COLORS.danger }}>
              cancel
            </span>
          ) : (
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#64748b',
                display: 'inline-block',
              }}
            />
          )}
          <span
            style={{
              fontSize: 12,
              color: status === 'enabled' ? COLORS.success : status === 'error' ? COLORS.danger : '#94a3b8',
            }}
          >
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
      render: (ts?: number) => (
        <span style={{ fontSize: 12, color: '#94a3b8' }}>{ts ? formatTimeAgo(ts) : '-'}</span>
      ),
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
          <Button
            type="text"
            size="small"
            onClick={() => openEdit(rule)}
            icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit</span>}
          />
          <Button
            type="text"
            size="small"
            danger
            onClick={() => {
              setCurrentRule(rule);
              setDeleteModalOpen(true);
            }}
            icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>}
          />
        </Space>
      ),
    },
  ];

  if (loading && rules.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error && rules.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 16 }}>
        <Empty description={error} />
        <Button type="primary" onClick={loadRules}>
          重试
        </Button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>告警规则</h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8' }}>配置告警条件和通知路由</p>
        </div>
        <Space>
          <Button icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>help</span>}>
            帮助文档
          </Button>
          <Button type="primary" icon={<span className="material-symbols-outlined" style={{ fontSize: 20 }}>add</span>} onClick={openCreate}>
            新建规则
          </Button>
        </Space>
      </div>

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

      <Card
        style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' } }}
      >
        <div
          style={{
            padding: '16px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
            <Input
              id="alert-rules-search"
              name="alertRulesSearch"
              aria-label="搜索告警规则"
              prefix={<span className="material-symbols-outlined" style={{ fontSize: 20, color: '#94a3b8' }}>search</span>}
              placeholder="搜索规则名称或查询..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ maxWidth: 400 }}
              allowClear
            />
            <Select
              id="alert-rules-status-filter"
              aria-label="告警规则状态筛选"
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: 120 }}
              options={[
                { value: 'all', label: '所有状态' },
                { value: 'enabled', label: '已启用' },
                { value: 'disabled', label: '已禁用' },
                { value: 'error', label: '异常' },
              ]}
            />
          </div>
          <Space>
            <Button type="text" icon={<span className="material-symbols-outlined" style={{ fontSize: 20 }}>refresh</span>} onClick={loadRules} />
          </Space>
        </div>

        <div style={{ flex: 1, overflow: 'auto' }}>
          {filteredRules.length === 0 ? (
            <Empty style={{ margin: 48 }} description="暂无告警规则" />
          ) : (
            <Table<AlertRule>
              rowKey="id"
              columns={columns}
              dataSource={filteredRules}
              size="middle"
              pagination={false}
              scroll={{ x: 900 }}
              loading={loading}
            />
          )}
        </div>
      </Card>

      <Modal
        open={modalOpen}
        title={modalMode === 'create' ? '新建告警规则' : '编辑告警规则'}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        okText={modalMode === 'create' ? '创建' : '保存'}
        cancelText="取消"
        width={640}
        destroyOnHidden
        forceRender
        confirmLoading={submitting}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }} onValuesChange={(c) => c.ruleType && setRuleType(c.ruleType)}>
          <Form.Item name="name" label="规则名称" rules={[{ required: true, message: '请输入规则名称' }]}>
            <Input id="name" placeholder="输入规则名称" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea id="description" placeholder="输入规则描述" rows={2} />
          </Form.Item>
          <Form.Item name="ruleType" label="规则类型" initialValue="keyword">
            <Select
              id="ruleType"
              aria-label="规则类型"
              options={[
                { value: 'keyword', label: '关键词 (keyword)' },
                { value: 'level_count', label: '等级计数 (level_count)' },
                { value: 'threshold', label: '阈值 (threshold)' },
              ]}
            />
          </Form.Item>

          {ruleType === 'keyword' && (
            <>
              <Form.Item name="keywordField" label="字段" initialValue="message">
                <Input id="keywordField" placeholder="message" />
              </Form.Item>
              <Form.Item name="keyword" label="关键词" rules={[{ required: true, message: '请输入关键词' }]}>
                <Input id="keyword" placeholder="如: error, exception" />
              </Form.Item>
            </>
          )}
          {ruleType === 'level_count' && (
            <>
              <Form.Item name="level" label="日志等级" initialValue="ERROR">
                <Select id="level" aria-label="日志等级" options={[{ value: 'ERROR', label: 'ERROR' }, { value: 'WARN', label: 'WARN' }, { value: 'INFO', label: 'INFO' }]} />
              </Form.Item>
              <Form.Item name="conditionThreshold" label="阈值" rules={[{ required: true }]}>
                <Input id="conditionThreshold" type="number" placeholder="如: 10" />
              </Form.Item>
              <Form.Item name="windowSeconds" label="时间窗口(秒)" initialValue={300}>
                <Input id="windowSeconds" type="number" placeholder="300" />
              </Form.Item>
            </>
          )}
          {ruleType === 'threshold' && (
            <>
              <Form.Item name="conditionMetric" label="指标名称">
                <Input id="conditionMetric" placeholder="如: cpu_usage" />
              </Form.Item>
              <Form.Item name="conditionOperator" label="操作符" initialValue="gt">
                <Select
                  id="conditionOperator"
                  aria-label="操作符"
                  options={[
                    { value: 'gt', label: '大于 (>)' },
                    { value: 'gte', label: '大于等于 (>=)' },
                    { value: 'lt', label: '小于 (<)' },
                    { value: 'lte', label: '小于等于 (<=)' },
                    { value: 'eq', label: '等于 (=)' },
                    { value: 'ne', label: '不等于 (!=)' },
                  ]}
                />
              </Form.Item>
              <Form.Item name="conditionThreshold" label="阈值">
                <Input id="conditionThreshold" type="number" placeholder="如: 90" />
              </Form.Item>
            </>
          )}

          <Form.Item name="severity" label="严重程度" initialValue="medium">
            <Select
              id="severity"
              aria-label="严重程度"
              options={[
                { value: 'critical', label: '严重 (Critical)' },
                { value: 'high', label: '高 (High)' },
                { value: 'medium', label: '中 (Medium)' },
                { value: 'low', label: '低 (Low)' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={deleteModalOpen}
        title="删除告警规则"
        onCancel={() => setDeleteModalOpen(false)}
        onOk={handleDelete}
        okText="删除"
        okButtonProps={{ danger: true }}
        cancelText="取消"
        confirmLoading={submitting}
      >
        <p style={{ color: '#94a3b8' }}>
          确定要删除规则 <span style={{ fontWeight: 500 }}>"{currentRule?.name}"</span> 吗？此操作不可撤销。
        </p>
      </Modal>
    </div>
  );
};

export default AlertRules;
