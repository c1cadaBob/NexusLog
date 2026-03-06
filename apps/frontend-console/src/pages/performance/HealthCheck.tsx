import React, { useEffect, useState, useCallback } from 'react';
import {
  Table,
  Button,
  Space,
  Spin,
  Empty,
  message,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Switch,
  Popconfirm,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useThemeStore } from '../../stores/themeStore';
import {
  fetchResourceThresholds,
  createResourceThreshold,
  updateResourceThreshold,
  deleteResourceThreshold,
  type ResourceThreshold,
  type CreateResourceThresholdPayload,
} from '@/api/metrics';

const METRIC_OPTIONS = [
  { label: 'CPU 使用率', value: 'cpu_usage_pct' },
  { label: '内存使用率', value: 'memory_usage_pct' },
  { label: '磁盘使用率', value: 'disk_usage_pct' },
];

const COMPARISON_OPTIONS = [
  { label: '>', value: '>' },
  { label: '>=', value: '>=' },
  { label: '<', value: '<' },
  { label: '<=', value: '<=' },
];

const SEVERITY_OPTIONS = [
  { label: '警告', value: 'warning' },
  { label: '严重', value: 'critical' },
  { label: '信息', value: 'info' },
];

const HealthCheck: React.FC = () => {
  const { isDark } = useThemeStore();

  const headerBg = isDark ? 'bg-[#111722]/50' : 'bg-white/80';
  const cardBg = isDark ? 'bg-[#1e293b]' : 'bg-white';
  const borderColor = isDark ? 'border-[#2a3441]' : 'border-slate-200';
  const textColor = isDark ? 'text-white' : 'text-slate-900';
  const textSecondary = isDark ? 'text-slate-400' : 'text-slate-600';
  const tableHeaderBg = isDark ? 'bg-[#111722]' : 'bg-slate-100';
  const rowHoverBg = isDark ? 'hover:bg-[#1a2333]' : 'hover:bg-slate-50';

  const [thresholds, setThresholds] = useState<ResourceThreshold[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingThreshold, setEditingThreshold] = useState<ResourceThreshold | null>(null);
  const [form] = Form.useForm();

  const loadThresholds = useCallback(async () => {
    setLoading(true);
    try {
      const { items } = await fetchResourceThresholds({ page_size: 200 });
      setThresholds(items);
    } catch (err) {
      message.error('加载阈值失败：' + (err instanceof Error ? err.message : String(err)));
      setThresholds([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadThresholds();
  }, [loadThresholds]);

  const handleCreate = () => {
    setEditingThreshold(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = (record: ResourceThreshold) => {
    setEditingThreshold(record);
    form.setFieldsValue({
      metric_name: record.metric_name,
      threshold_value: record.threshold_value,
      comparison: record.comparison,
      alert_severity: record.alert_severity,
      enabled: record.enabled,
      agent_id: record.agent_id ?? undefined,
    });
    setModalOpen(true);
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      if (editingThreshold) {
        await updateResourceThreshold(editingThreshold.id, {
          metric_name: values.metric_name,
          threshold_value: values.threshold_value,
          comparison: values.comparison,
          alert_severity: values.alert_severity,
          enabled: values.enabled,
          agent_id: values.agent_id || null,
        });
        message.success('更新成功');
      } else {
        await createResourceThreshold({
          metric_name: values.metric_name,
          threshold_value: values.threshold_value,
          comparison: values.comparison,
          alert_severity: values.alert_severity ?? 'warning',
          enabled: values.enabled ?? true,
          agent_id: values.agent_id || null,
        } as CreateResourceThresholdPayload);
        message.success('创建成功');
      }
      setModalOpen(false);
      loadThresholds();
    } catch (err) {
      if (err instanceof Error && err.message !== 'Validation failed') {
        message.error((err as Error).message);
      }
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteResourceThreshold(id);
      message.success('删除成功');
      loadThresholds();
    } catch (err) {
      message.error('删除失败：' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleToggleEnabled = async (record: ResourceThreshold) => {
    try {
      await updateResourceThreshold(record.id, { enabled: !record.enabled });
      message.success(record.enabled ? '已禁用' : '已启用');
      loadThresholds();
    } catch (err) {
      message.error('操作失败：' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const columns: ColumnsType<ResourceThreshold> = [
    {
      title: '指标',
      dataIndex: 'metric_name',
      key: 'metric_name',
      render: (v: string) => METRIC_OPTIONS.find((o) => o.value === v)?.label ?? v,
    },
    {
      title: 'Agent ID',
      dataIndex: 'agent_id',
      key: 'agent_id',
      render: (v: string | null) => v ?? '—',
    },
    {
      title: '阈值',
      key: 'threshold',
      render: (_, r) => `${r.comparison} ${r.threshold_value}`,
    },
    {
      title: '严重程度',
      dataIndex: 'alert_severity',
      key: 'alert_severity',
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (v: boolean, record) => (
        <Switch checked={v} onChange={() => handleToggleEnabled(record)} size="small" />
      ),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确定删除此阈值？"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button type="link" size="small" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Header */}
      <div
        className={`h-16 border-b ${borderColor} ${headerBg} backdrop-blur flex items-center justify-between px-8 shrink-0 -mx-6 -mt-6`}
      >
        <div className={`flex items-center gap-2 ${textSecondary}`}>
          <span className="text-sm">性能与高可用</span>
          <span className="material-symbols-outlined text-sm">chevron_right</span>
          <span className={`${textColor} text-sm font-medium`}>健康检查阈值配置</span>
        </div>
        <Button type="primary" onClick={handleCreate}>
          新建阈值
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className={`${cardBg} rounded-xl border ${borderColor} overflow-hidden`}>
          {loading ? (
            <div className="flex justify-center py-24">
              <Spin tip="加载中..." size="large" />
            </div>
          ) : thresholds.length === 0 ? (
            <Empty
              description="暂无阈值配置"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              style={{ padding: 48 }}
            >
              <Button type="primary" onClick={handleCreate}>
                新建阈值
              </Button>
            </Empty>
          ) : (
            <Table<ResourceThreshold>
              dataSource={thresholds}
              columns={columns}
              rowKey="id"
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showTotal: (t) => `共 ${t} 条`,
              }}
              className={`${rowHoverBg}`}
            />
          )}
        </div>
      </div>

      <Modal
        title={editingThreshold ? '编辑阈值' : '新建阈值'}
        open={modalOpen}
        onOk={handleModalOk}
        onCancel={() => setModalOpen(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="metric_name"
            label="指标"
            rules={[{ required: true, message: '请选择指标' }]}
          >
            <Select options={METRIC_OPTIONS} placeholder="选择指标" />
          </Form.Item>
          <Form.Item name="agent_id" label="Agent ID（可选，留空表示全局）">
            <Input placeholder="例如: 192.168.1.1:8080" allowClear />
          </Form.Item>
          <Form.Item
            name="threshold_value"
            label="阈值"
            rules={[{ required: true, message: '请输入阈值' }]}
          >
            <InputNumber min={0} max={100} style={{ width: '100%' }} placeholder="0-100" />
          </Form.Item>
          <Form.Item
            name="comparison"
            label="比较符"
            rules={[{ required: true, message: '请选择比较符' }]}
          >
            <Select options={COMPARISON_OPTIONS} placeholder="选择比较符" />
          </Form.Item>
          <Form.Item name="alert_severity" label="严重程度" initialValue="warning">
            <Select options={SEVERITY_OPTIONS} />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default HealthCheck;
