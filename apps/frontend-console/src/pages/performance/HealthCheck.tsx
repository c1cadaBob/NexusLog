import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Table,
  Button,
  Space,
  Empty,
  message,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Switch,
  Popconfirm,
  Tag,
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
import { fetchBffOverview, type BffOverviewResponse, type BffServiceProbe } from '@/api/bff';
import InlineLoadingState from '@/components/common/InlineLoadingState';
import { useUnnamedFormFieldAccessibility } from '@/components/common/useUnnamedFormFieldAccessibility';

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

interface HealthServiceCardItem {
  key: string;
  label: string;
  probe: BffServiceProbe;
  reconcilerState?: string | null;
}

function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function formatLatency(latencyMs?: number): string {
  if (typeof latencyMs !== 'number' || Number.isNaN(latencyMs)) return '—';
  return `${latencyMs} ms`;
}

function getStatusTagColor(status: string): 'success' | 'error' | 'warning' | 'processing' | 'default' {
  if (status === 'healthy') return 'success';
  if (status === 'degraded' || status === 'unhealthy' || status === 'unreachable') return 'error';
  if (status === 'unknown') return 'default';
  return 'processing';
}

function getStatusLabel(status: string): string {
  if (status === 'healthy') return '健康';
  if (status === 'degraded') return '降级';
  if (status === 'unhealthy') return '异常';
  if (status === 'unreachable') return '不可达';
  if (status === 'unknown') return '未知';
  return status || '未知';
}

function extractReconcilerState(details?: string): string | null {
  if (!details) return null;
  const match = details.match(/reconciler:([^\s]+)/i);
  return match?.[1] ?? null;
}

const HealthCheck: React.FC = () => {
  const { isDark } = useThemeStore();

  const headerBg = isDark ? 'bg-[#111722]/50' : 'bg-white/80';
  const cardBg = isDark ? 'bg-[#1e293b]' : 'bg-white';
  const borderColor = isDark ? 'border-[#2a3441]' : 'border-slate-200';
  const textColor = isDark ? 'text-white' : 'text-slate-900';
  const textSecondary = isDark ? 'text-slate-400' : 'text-slate-600';
  const surfaceSoft = isDark ? 'bg-[#0f172a]' : 'bg-slate-50';
  const valueColor = isDark ? 'text-slate-100' : 'text-slate-900';
  const detailColor = isDark ? 'text-slate-300' : 'text-slate-600';
  const rowHoverBg = isDark ? 'hover:bg-[#1a2333]' : 'hover:bg-slate-50';

  const [thresholds, setThresholds] = useState<ResourceThreshold[]>([]);
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<BffOverviewResponse | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewRefreshing, setOverviewRefreshing] = useState(false);
  const [overviewError, setOverviewError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingThreshold, setEditingThreshold] = useState<ResourceThreshold | null>(null);
  const thresholdModalRef = useUnnamedFormFieldAccessibility('health-threshold-modal');
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

  const loadOverview = useCallback(async (refresh = false) => {
    if (refresh) {
      setOverviewRefreshing(true);
    } else {
      setOverviewLoading(true);
    }
    setOverviewError('');
    try {
      const nextOverview = await fetchBffOverview({ refresh });
      setOverview(nextOverview);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setOverviewError(msg);
      message.error(`加载健康概览失败：${msg}`);
    } finally {
      if (refresh) {
        setOverviewRefreshing(false);
      } else {
        setOverviewLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadThresholds();
    void loadOverview();
  }, [loadThresholds, loadOverview]);

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
      void loadThresholds();
    } catch (err) {
      if (err instanceof Error && err.message !== 'Validation failed') {
        message.error(err.message);
      }
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteResourceThreshold(id);
      message.success('删除成功');
      void loadThresholds();
    } catch (err) {
      message.error('删除失败：' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleToggleEnabled = async (record: ResourceThreshold) => {
    try {
      await updateResourceThreshold(record.id, { enabled: !record.enabled });
      message.success(record.enabled ? '已禁用' : '已启用');
      void loadThresholds();
    } catch (err) {
      message.error('操作失败：' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const serviceCards = useMemo<HealthServiceCardItem[]>(() => {
    if (!overview) return [];
    return [
      {
        key: 'controlPlane',
        label: '控制面服务',
        probe: overview.services.controlPlane,
        reconcilerState: extractReconcilerState(overview.services.controlPlane.details),
      },
      {
        key: 'apiService',
        label: '业务 API',
        probe: overview.services.apiService,
      },
      {
        key: 'queryApi',
        label: '查询服务',
        probe: overview.services.dataServices.queryApi,
      },
      {
        key: 'auditApi',
        label: '审计服务',
        probe: overview.services.dataServices.auditApi,
      },
      {
        key: 'exportApi',
        label: '导出服务',
        probe: overview.services.dataServices.exportApi,
      },
    ];
  }, [overview]);

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
          <Popconfirm title="确定删除此阈值？" onConfirm={() => handleDelete(record.id)}>
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
      <div
        className={`h-16 border-b ${borderColor} ${headerBg} backdrop-blur flex items-center justify-between px-8 shrink-0 -mx-6 -mt-6`}
      >
        <div className={`flex items-center gap-2 ${textSecondary}`}>
          <span className="text-sm">性能与高可用</span>
          <span className="material-symbols-outlined text-sm">chevron_right</span>
          <span className={`${textColor} text-sm font-medium`}>健康检查</span>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => {
              window.location.hash = '#/help/faq';
            }}
            icon={(
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                help
              </span>
            )}
          >
            帮助
          </Button>
          <Button
            onClick={() => {
              void loadOverview(true);
            }}
            loading={overviewRefreshing}
          >
            刷新健康概览
          </Button>
          <Button type="primary" onClick={handleCreate}>
            新建阈值
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-1">
        <div className="flex flex-col gap-6">
          <div className={`${cardBg} rounded-xl border ${borderColor} p-5`}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className={`text-lg font-semibold ${textColor}`}>实时健康概览</div>
                <div className={`mt-1 text-sm ${textSecondary}`}>
                  聚合 control-plane、api-service、query-api、audit-api、export-api 的存活状态。
                </div>
              </div>
              <div className={`text-right text-xs ${textSecondary}`}>
                <div>生成时间：{formatDateTime(overview?.generatedAt)}</div>
                <div>缓存：{overview?.cache.hit ? '命中缓存' : '实时刷新'} / TTL {overview?.cache.ttlMs ?? 0} ms</div>
              </div>
            </div>

            {overviewLoading ? (
              <div className="flex justify-center py-20">
                <InlineLoadingState tip="加载健康概览中..." size="large" />
              </div>
            ) : !overview ? (
              <Empty
                description={overviewError ? `健康概览加载失败：${overviewError}` : '暂无健康概览数据'}
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                style={{ padding: 40 }}
              >
                <Button
                  type="primary"
                  onClick={() => {
                    void loadOverview(true);
                  }}
                  loading={overviewRefreshing}
                >
                  重新加载
                </Button>
              </Empty>
            ) : (
              <>
                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {[
                    {
                      key: 'total',
                      label: '服务总数',
                      value: String(overview.summary.total),
                      helper: '纳入当前聚合概览的服务数',
                    },
                    {
                      key: 'healthy',
                      label: '健康服务',
                      value: String(overview.summary.healthy),
                      helper: '可正常访问且状态健康',
                    },
                    {
                      key: 'degraded',
                      label: '异常服务',
                      value: String(overview.summary.degraded),
                      helper: '降级 / 不可达 / 非健康状态',
                    },
                    {
                      key: 'availabilityRate',
                      label: '可用率',
                      value: `${overview.summary.availabilityRate}%`,
                      helper: '按当前聚合结果实时计算',
                    },
                  ].map((item) => (
                    <div
                      key={item.key}
                      className={`rounded-xl border ${borderColor} ${surfaceSoft} p-4`}
                    >
                      <div className={`text-sm ${textSecondary}`}>{item.label}</div>
                      <div className={`mt-3 text-3xl font-semibold ${valueColor}`}>{item.value}</div>
                      <div className={`mt-2 text-xs ${detailColor}`}>{item.helper}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex items-center justify-between gap-3">
                  <div className={`text-sm font-medium ${textColor}`}>服务明细</div>
                  {overviewError ? <Tag color="warning">最近一次刷新失败，已保留上次成功结果</Tag> : null}
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
                  {serviceCards.map((item) => (
                    <div
                      key={item.key}
                      className={`rounded-xl border ${borderColor} ${surfaceSoft} p-4`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className={`text-base font-medium ${textColor}`}>{item.label}</div>
                          <div className={`mt-1 text-xs break-all ${textSecondary}`}>{item.probe.upstream}</div>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <Tag color={getStatusTagColor(item.probe.status)} style={{ margin: 0 }}>
                            {getStatusLabel(item.probe.status)}
                          </Tag>
                          {item.reconcilerState ? (
                            <Tag color={getStatusTagColor(item.reconcilerState)} style={{ margin: 0 }}>
                              ES 对账 {getStatusLabel(item.reconcilerState)}
                            </Tag>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className={`rounded-lg border ${borderColor} ${cardBg} p-3`}>
                          <div className={`text-xs ${textSecondary}`}>HTTP 状态</div>
                          <div className={`mt-1 text-lg font-medium ${textColor}`}>{item.probe.statusCode || '—'}</div>
                        </div>
                        <div className={`rounded-lg border ${borderColor} ${cardBg} p-3`}>
                          <div className={`text-xs ${textSecondary}`}>响应耗时</div>
                          <div className={`mt-1 text-lg font-medium ${textColor}`}>{formatLatency(item.probe.latencyMs)}</div>
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className={`text-xs ${textSecondary}`}>探测详情</div>
                        <div className={`mt-1 text-sm break-all ${detailColor}`}>{item.probe.details || '—'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className={`${cardBg} rounded-xl border ${borderColor} overflow-hidden`}>
            <div className={`flex items-center justify-between border-b ${borderColor} px-5 py-4`}>
              <div>
                <div className={`text-base font-semibold ${textColor}`}>健康检查阈值配置</div>
                <div className={`mt-1 text-sm ${textSecondary}`}>
                  用于定义资源使用阈值与告警严重程度。
                </div>
              </div>
              <Button type="primary" onClick={handleCreate}>
                新建阈值
              </Button>
            </div>
            {loading ? (
              <div className="flex justify-center py-24">
                <InlineLoadingState tip="加载阈值中..." size="large" />
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
      </div>

      <Modal
        title={editingThreshold ? '编辑阈值' : '新建阈值'}
        open={modalOpen}
        onOk={handleModalOk}
        onCancel={() => setModalOpen(false)}
        destroyOnHidden
        forceRender
      >
        <div ref={thresholdModalRef}>
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
        </div>
      </Modal>
    </div>
  );
};

export default HealthCheck;
