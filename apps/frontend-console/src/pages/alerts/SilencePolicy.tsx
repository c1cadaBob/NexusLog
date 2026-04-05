import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input, Table, Tag, Button, Card, Space, Modal, Form, DatePicker, message, Empty } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useThemeStore } from '../../stores/themeStore';
import { COLORS } from '../../theme/tokens';
import { useUnnamedFormFieldAccessibility } from '../../components/common/useUnnamedFormFieldAccessibility';
import {
  fetchAlertSilences,
  createAlertSilence,
  updateAlertSilence,
  deleteAlertSilence,
  type AlertSilence,
} from '../../api/alert';
import dayjs from 'dayjs';
import InlineLoadingState from '../../components/common/InlineLoadingState';
import AnalysisPageHeader from '../../components/common/AnalysisPageHeader';

// ============================================================================
// 辅助
// ============================================================================

const formatDateTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatRemainingTime = (endsAt: number): string => {
  const remaining = endsAt - Date.now();
  if (remaining <= 0) return '-';
  const hours = Math.floor(remaining / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  if (hours > 24) return `${Math.floor(hours / 24)}天+`;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

const matchersToArray = (m: Record<string, string>): { name: string; value: string }[] => {
  if (!m || typeof m !== 'object') return [];
  return Object.entries(m)
    .filter(([k, v]) => k && v)
    .map(([name, value]) => ({ name, value }));
};

const arrayToMatchers = (arr: { name: string; value: string }[]): Record<string, string> => {
  const out: Record<string, string> = {};
  arr.filter((m) => m.name && m.value).forEach((m) => { out[m.name] = m.value; });
  return out;
};

// ============================================================================
// 组件
// ============================================================================

const SilencePolicy: React.FC = () => {
  const navigate = useNavigate();
  const isDark = useThemeStore((s) => s.isDark);
  const [form] = Form.useForm();

  const [silences, setSilences] = useState<AlertSilence[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [currentSilence, setCurrentSilence] = useState<AlertSilence | null>(null);
  const [matchers, setMatchers] = useState<{ name: string; value: string }[]>([{ name: '', value: '' }]);
  const [submitLoading, setSubmitLoading] = useState(false);
  const silencePolicyModalRef = useUnnamedFormFieldAccessibility('silence-policy-modal');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await fetchAlertSilences();
      setSilences(items);
      setLastUpdatedAt(new Date());
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载静默策略失败';
      message.error(msg);
      setError(msg);
      setSilences([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreate = useCallback(() => {
    setModalMode('create');
    setCurrentSilence(null);
    setMatchers([{ name: '', value: '' }]);
    form.resetFields();
    form.setFieldsValue({
      reason: '',
      starts_at: dayjs(),
      ends_at: dayjs().add(1, 'hour'),
    });
    setModalOpen(true);
  }, [form]);

  const openEdit = useCallback((s: AlertSilence) => {
    setModalMode('edit');
    setCurrentSilence(s);
    setMatchers(
      matchersToArray(s.matchers).length > 0 ? matchersToArray(s.matchers) : [{ name: '', value: '' }],
    );
    form.setFieldsValue({
      reason: s.reason,
      starts_at: dayjs(s.startsAt),
      ends_at: dayjs(s.endsAt),
    });
    setModalOpen(true);
  }, [form]);

  const addMatcher = useCallback(() => {
    setMatchers((prev) => [...prev, { name: '', value: '' }]);
  }, []);

  const removeMatcher = useCallback((index: number) => {
    setMatchers((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateMatcher = useCallback((index: number, field: 'name' | 'value', value: string) => {
    setMatchers((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)),
    );
  }, []);

  const handleSubmit = useCallback(async () => {
    try {
      const values = await form.validateFields();
      const validMatchers = arrayToMatchers(matchers);
      const startsAt = values.starts_at?.toISOString?.() ?? new Date().toISOString();
      const endsAt = values.ends_at?.toISOString?.() ?? new Date(Date.now() + 3600000).toISOString();

      setSubmitLoading(true);
      if (modalMode === 'create') {
        await createAlertSilence({
          matchers: validMatchers,
          reason: values.reason ?? '',
          starts_at: startsAt,
          ends_at: endsAt,
        });
        message.success('静默策略已创建');
      } else if (currentSilence) {
        await updateAlertSilence(currentSilence.id, {
          matchers: validMatchers,
          reason: values.reason ?? '',
          starts_at: startsAt,
          ends_at: endsAt,
        });
        message.success('静默策略已更新');
      }
      setModalOpen(false);
      loadData();
    } catch (err) {
      if (err instanceof Error && err.message?.includes('required')) return;
      const msg = err instanceof Error ? err.message : '操作失败';
      message.error(msg);
    } finally {
      setSubmitLoading(false);
    }
  }, [form, modalMode, currentSilence, matchers, loadData]);

  const handleDelete = useCallback(async () => {
    if (!currentSilence) return;
    setDeleteLoading(true);
    try {
      await deleteAlertSilence(currentSilence.id);
      message.success('静默策略已删除');
      setDeleteModalOpen(false);
      setCurrentSilence(null);
      loadData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '删除失败';
      message.error(msg);
    } finally {
      setDeleteLoading(false);
    }
  }, [currentSilence, loadData]);

  const columns: ColumnsType<AlertSilence> = [
    {
      title: 'ID / 创建人',
      key: 'id',
      width: 220,
      render: (_, s) => (
        <div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#94a3b8' }}>
            {s.id}
          </div>
          {s.createdBy && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>{s.createdBy}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      title: '匹配规则',
      key: 'matchers',
      render: (_, s) => (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {Object.entries(s.matchers || {}).map(([k, v]) => (
            <Tag key={k} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
              {k}={v}
            </Tag>
          ))}
          {Object.keys(s.matchers || {}).length === 0 && (
            <span style={{ color: '#94a3b8', fontSize: 12 }}>匹配全部</span>
          )}
        </div>
      ),
    },
    {
      title: '原因',
      dataIndex: 'reason',
      key: 'reason',
      width: 160,
      ellipsis: true,
      render: (v: string) => <span style={{ fontSize: 13 }}>{v || '-'}</span>,
    },
    {
      title: '起止时间',
      key: 'time',
      width: 220,
      render: (_, s) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
          <div>
            <span style={{ color: '#94a3b8', marginRight: 4 }}>Start:</span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{formatDateTime(s.startsAt)}</span>
          </div>
          <div>
            <span style={{ color: '#94a3b8', marginRight: 4 }}>End:</span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{formatDateTime(s.endsAt)}</span>
          </div>
        </div>
      ),
    },
    {
      title: '剩余时间',
      key: 'remaining',
      width: 120,
      render: (_, s) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: COLORS.warning }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>timer</span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 14 }}>
            {formatRemainingTime(s.endsAt)}
          </span>
        </div>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      align: 'right',
      render: (_, s) => (
        <Space size={4}>
          <Button
            type="text"
            size="small"
            onClick={() => openEdit(s)}
            title="编辑"
            icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit</span>}
          />
          <Button
            type="text"
            size="small"
            danger
            onClick={() => {
              setCurrentSilence(s);
              setDeleteModalOpen(true);
            }}
            title="删除"
            icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>}
          />
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, height: '100%' }}>
      <AnalysisPageHeader
        title="静默策略"
        subtitle="在维护窗口或已知故障期间屏蔽指定告警的通知发送"
        lastUpdatedAt={lastUpdatedAt}
        actions={(
          <Space>
            <Button size="small" icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>support_agent</span>} onClick={() => navigate('/help/faq')}>
              帮助
            </Button>
            <Button size="small" icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>refresh</span>} onClick={() => void loadData()}>
              刷新数据
            </Button>
            <Button
              size="small"
              type="primary"
              icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>}
              onClick={openCreate}
            >
              新建静默策略
            </Button>
          </Space>
        )}
      />

      {/* 统计 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 16 }}>
        <Card size="small" styles={{ body: { padding: 16 } }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 8,
                background: `${COLORS.success}1a`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span className="material-symbols-outlined" style={{ color: COLORS.success }}>check_circle</span>
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>生效中策略</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{silences.length}</div>
            </div>
          </div>
        </Card>
      </div>

      {/* 表格 */}
      <Card style={{ flex: 1, overflow: 'hidden' }} styles={{ body: { padding: 0, overflow: 'auto', height: '100%' } }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <InlineLoadingState tip="加载中..." />
          </div>
        ) : error ? (
          <Empty description={error} image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: 48 }} />
        ) : silences.length === 0 ? (
          <Empty description="暂无生效中的静默策略" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: 48 }} />
        ) : (
          <Table<AlertSilence>
            rowKey="id"
            columns={columns}
            dataSource={silences}
            size="middle"
            pagination={false}
            scroll={{ x: 900 }}
          />
        )}
      </Card>

      {/* 创建/编辑模态框 */}
      <Modal
        open={modalOpen}
        title={modalMode === 'create' ? '新建静默策略' : '编辑静默策略'}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        okText={modalMode === 'create' ? '创建' : '保存'}
        cancelText="取消"
        width={640}
        confirmLoading={submitLoading}
        destroyOnHidden
        forceRender
      >
        <div ref={silencePolicyModalRef}>
          <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="reason" label="原因/备注" rules={[{ required: true, message: '请输入原因或备注' }]}>
            <Input.TextArea placeholder="输入静默原因或备注" rows={2} />
          </Form.Item>

          <Form.Item label="起止时间" required>
            <Space>
              <Form.Item name="starts_at" rules={[{ required: true, message: '请选择开始时间' }]} noStyle>
                <DatePicker showTime placeholder="开始时间" style={{ width: 220 }} />
              </Form.Item>
              <Form.Item name="ends_at" rules={[{ required: true, message: '请选择结束时间' }]} noStyle>
                <DatePicker showTime placeholder="结束时间" style={{ width: 220 }} />
              </Form.Item>
            </Space>
          </Form.Item>

          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <label style={{ fontWeight: 500, fontSize: 14 }}>匹配规则</label>
              <Button type="link" size="small" onClick={addMatcher} icon={<span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>}>
                添加规则
              </Button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {matchers.map((m, index) => (
                <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Input
                    value={m.name}
                    onChange={(e) => updateMatcher(index, 'name', e.target.value)}
                    placeholder="标签名 (如 service)"
                    style={{ flex: 1 }}
                  />
                  <span style={{ color: '#94a3b8' }}>=</span>
                  <Input
                    value={m.value}
                    onChange={(e) => updateMatcher(index, 'value', e.target.value)}
                    placeholder="标签值"
                    style={{ flex: 1 }}
                  />
                  {matchers.length > 1 && (
                    <Button
                      type="text"
                      size="small"
                      danger
                      onClick={() => removeMatcher(index)}
                      icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
          </Form>
        </div>
      </Modal>

      {/* 删除确认 */}
      <Modal
        open={deleteModalOpen}
        title="删除静默策略"
        onCancel={() => setDeleteModalOpen(false)}
        onOk={handleDelete}
        okText="删除"
        okButtonProps={{ danger: true, loading: deleteLoading }}
        cancelText="取消"
      >
        <p style={{ color: '#94a3b8' }}>
          确定要删除静默策略 <span style={{ fontWeight: 500 }}>"{currentSilence?.reason || currentSilence?.id}"</span> 吗？此操作不可撤销。
        </p>
      </Modal>
    </div>
  );
};

export default SilencePolicy;
