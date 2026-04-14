import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Tag, Modal, Form, Input, Select, Checkbox, Space, message, Spin, Empty } from 'antd';
import { useThemeStore } from '../../stores/themeStore';
import { COLORS } from '../../theme/tokens';
import { useUnnamedFormFieldAccessibility } from '../../components/common/useUnnamedFormFieldAccessibility';
import type { NotificationChannel } from '../../types/alert';
import {
  fetchNotificationChannels,
  createNotificationChannel,
  updateNotificationChannel,
  deleteNotificationChannel,
  testNotificationChannel,
} from '../../api/notification';
import AnalysisPageHeader from '../../components/common/AnalysisPageHeader';

type SupportedChannelType = 'email' | 'dingtalk' | 'sms';

const channelIconMap: Record<SupportedChannelType, string> = {
  email: 'mail',
  dingtalk: 'chat',
  sms: 'sms',
};

const channelColorMap: Record<SupportedChannelType, string> = {
  email: COLORS.info,
  dingtalk: '#0ea5e9',
  sms: COLORS.success,
};

const channelTypeName: Record<SupportedChannelType, string> = {
  email: '邮件',
  dingtalk: '钉钉',
  sms: '短信',
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

const normalizeRecipientValues = (value: unknown): string[] => {
  const items = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[;,\n\r]/g)
      : [];

  const seen = new Set<string>();
  return items
    .map((item) => String(item).trim())
    .filter((item) => item.length > 0)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
};

const formatRecipientSummary = (value: unknown): string => {
  const recipients = normalizeRecipientValues(value);
  if (recipients.length === 0) {
    return '未配置';
  }
  return recipients.join(', ');
};

// ============================================================================
// 组件
// ============================================================================

const NotificationConfig: React.FC = () => {
  const navigate = useNavigate();
  const isDark = useThemeStore((s) => s.isDark);
  const [form] = Form.useForm();

  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const notificationChannelModalRef = useUnnamedFormFieldAccessibility('notification-channel-modal');
  const [currentChannel, setCurrentChannel] = useState<NotificationChannel | null>(null);
  const [channelType, setChannelType] = useState<SupportedChannelType>('email');
  const [testingId, setTestingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadChannels = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const items = await fetchNotificationChannels({ force });
      setChannels(items);
      setLastUpdatedAt(new Date());
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载通知渠道失败';
      setError(msg);
      message.error(msg);
      setChannels([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadChannels();
  }, [loadChannels]);

  const stats = useMemo(
    () => ({
      active: channels.filter((c) => c.enabled).length,
      inactive: channels.filter((c) => !c.enabled).length,
    }),
    [channels],
  );

  const openCreate = useCallback(() => {
    setModalMode('create');
    setCurrentChannel(null);
    setChannelType('email');
    form.resetFields();
    form.setFieldsValue({ type: 'email', enabled: true });
    setModalOpen(true);
  }, [form]);

  const openEdit = useCallback(
    (channel: NotificationChannel) => {
      setModalMode('edit');
      setCurrentChannel(channel);
      setChannelType(channel.type as SupportedChannelType);
      const config = channel.config as Record<string, unknown>;
      form.setFieldsValue({
        name: channel.name,
        type: channel.type,
        enabled: channel.enabled,
        smtpHost: config.smtp_host,
        smtpPort: config.smtp_port,
        smtpUsername: config.smtp_username,
        smtpPassword: config.smtp_password,
        fromEmail: config.from_email,
        fromName: config.from_name,
        recipients: normalizeRecipientValues(config.recipients).join(', '),
        useTls: config.use_tls ?? true,
        webhookUrl: config.webhook_url,
        accessToken: config.access_token,
        provider: config.provider,
      });
      setModalOpen(true);
    },
    [form],
  );

  const buildConfig = useCallback((values: Record<string, unknown>): Record<string, unknown> => {
    const t = (values.type as string) || 'email';
    if (t === 'email') {
      return {
        smtp_host: values.smtpHost,
        smtp_port: values.smtpPort ? Number(values.smtpPort) : 587,
        smtp_username: values.smtpUsername,
        smtp_password: values.smtpPassword,
        from_email: values.fromEmail,
        from_name: values.fromName,
        recipients: normalizeRecipientValues(values.recipients),
        use_tls: values.useTls ?? true,
      };
    }
    if (t === 'dingtalk') {
      const cfg: Record<string, unknown> = {};
      if (values.webhookUrl) cfg.webhook_url = values.webhookUrl;
      if (values.accessToken) cfg.access_token = values.accessToken;
      return cfg;
    }
    if (t === 'sms') {
      return { provider: values.provider };
    }
    return {};
  }, []);

  const handleSubmit = useCallback(async () => {
    try {
      await form.validateFields();
    } catch {
      return;
    }
    setSubmitting(true);
    try {
      const values = form.getFieldsValue();
      const config = buildConfig(values);
      if (modalMode === 'create') {
        await createNotificationChannel({
          name: values.name,
          type: values.type as SupportedChannelType,
          config,
          enabled: values.enabled ?? true,
        });
        message.success(`通知渠道 "${values.name}" 已创建`);
      } else if (currentChannel) {
        await updateNotificationChannel(currentChannel.id, {
          name: values.name,
          config,
          enabled: values.enabled,
        });
        message.success(`通知渠道 "${values.name}" 已更新`);
      }
      setModalOpen(false);
      await loadChannels();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '操作失败');
    } finally {
      setSubmitting(false);
    }
  }, [form, modalMode, currentChannel, buildConfig, loadChannels]);

  const handleDelete = useCallback(async () => {
    if (!currentChannel) return;
    setSubmitting(true);
    try {
      await deleteNotificationChannel(currentChannel.id);
      setDeleteModalOpen(false);
      message.success(`通知渠道 "${currentChannel.name}" 已删除`);
      setCurrentChannel(null);
      await loadChannels();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除失败');
    } finally {
      setSubmitting(false);
    }
  }, [currentChannel, loadChannels]);

  const handleTest = useCallback(async (channel: NotificationChannel) => {
    setTestingId(channel.id);
    try {
      const to = channel.type === 'email'
        ? normalizeRecipientValues((channel.config as Record<string, unknown>).recipients)[0]
        : undefined;
      await testNotificationChannel(channel.id, to);
      message.success('测试成功');
    } catch (err) {
      message.error(err instanceof Error ? err.message : '测试失败');
    } finally {
      setTestingId(null);
    }
  }, []);

  const toggleEnabled = useCallback(
    async (channel: NotificationChannel) => {
      try {
        await updateNotificationChannel(channel.id, { enabled: !channel.enabled });
        message.success(`通知渠道 "${channel.name}" 已${channel.enabled ? '禁用' : '启用'}`);
        await loadChannels();
      } catch (err) {
        message.error(err instanceof Error ? err.message : '操作失败');
      }
    },
    [loadChannels],
  );

  if (loading && channels.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error && channels.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 16 }}>
        <Empty description={error} />
        <Button type="primary" onClick={() => void loadChannels(true)}>
          重试
        </Button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, height: '100%' }}>
      <AnalysisPageHeader
        title="通知配置"
        subtitle="管理邮件、钉钉与短信通知渠道，并提供连通性测试"
        lastUpdatedAt={lastUpdatedAt}
        actions={(
          <Space>
            <Button size="small" icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>support_agent</span>} onClick={() => navigate('/help/faq')}>
              帮助
            </Button>
            <Button size="small" icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>refresh</span>} onClick={() => void loadChannels(true)}>
              刷新数据
            </Button>
            <Button size="small" type="primary" icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>} onClick={openCreate}>
              新建渠道
            </Button>
          </Space>
        )}
      />

      {/* 统计 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="material-symbols-outlined" style={{ color: COLORS.primary, fontSize: 20 }}>hub</span>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>通知渠道 (Notification Channels)</h2>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <Tag color="success">{stats.active} Active</Tag>
          <Tag>{stats.inactive} Inactive</Tag>
        </div>
      </div>

      {/* 渠道卡片网格 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
        {channels.map((channel) => {
          const isTesting = testingId === channel.id;
          const iconColor = channelColorMap[channel.type as SupportedChannelType] ?? COLORS.primary;
          const icon = channelIconMap[channel.type as SupportedChannelType] ?? 'hub';
          const typeLabel = channelTypeName[channel.type as SupportedChannelType] ?? channel.type;

          return (
            <Card
              key={channel.id}
              hoverable
              style={{ display: 'flex', flexDirection: 'column' }}
              styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column', padding: 20 } }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: `${iconColor}1a`,
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ color: iconColor }}>{icon}</span>
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{channel.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: channel.enabled ? COLORS.success : '#64748b', display: 'inline-block' }} />
                      <span style={{ fontSize: 12, fontWeight: 500, color: channel.enabled ? COLORS.success : '#94a3b8' }}>
                        {channel.enabled ? 'Running' : 'Disabled'}
                      </span>
                    </div>
                  </div>
                </div>
                <Space size={0}>
                  <Button type="text" size="small" onClick={() => toggleEnabled(channel)} title={channel.enabled ? '禁用' : '启用'}
                    icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>{channel.enabled ? 'toggle_on' : 'toggle_off'}</span>}
                  />
                  <Button type="text" size="small" onClick={() => openEdit(channel)}
                    icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit</span>}
                  />
                  <Button type="text" size="small" danger onClick={() => { setCurrentChannel(channel); setDeleteModalOpen(true); }}
                    icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>}
                  />
                </Space>
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: '#94a3b8' }}>类型</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{typeLabel}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: '#94a3b8' }}>更新时间</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{formatTimeAgo(channel.updatedAt)}</span>
                </div>
                {channel.type === 'email' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, fontSize: 13 }}>
                    <span style={{ color: '#94a3b8', whiteSpace: 'nowrap' }}>收件人</span>
                    <span style={{ textAlign: 'right', wordBreak: 'break-all' }}>{formatRecipientSummary((channel.config as Record<string, unknown>).recipients)}</span>
                  </div>
                )}
              </div>

              <div
                style={{
                  paddingTop: 16,
                  borderTop: `1px solid ${isDark ? '#334155' : '#f1f5f9'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ fontSize: 12, color: '#94a3b8' }}>测试连接</span>
                <Button
                  type="link"
                  size="small"
                  loading={isTesting}
                  disabled={!channel.enabled}
                  onClick={() => handleTest(channel)}
                  icon={!isTesting ? <span className="material-symbols-outlined" style={{ fontSize: 16 }}>bolt</span> : undefined}
                >
                  {isTesting ? '测试中...' : '测试连接'}
                </Button>
              </div>
            </Card>
          );
        })}

        {/* 添加新渠道占位符 */}
        <Card hoverable onClick={openCreate}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 220, border: '2px dashed', borderColor: isDark ? '#334155' : '#e2e8f0', cursor: 'pointer' }}
          styles={{ body: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 } }}>
          <div style={{ padding: 12, borderRadius: '50%', background: isDark ? '#1e293b' : '#f8fafc', marginBottom: 12 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 32, color: '#94a3b8' }}>add_circle</span>
          </div>
          <div style={{ fontWeight: 600, fontSize: 14, color: '#94a3b8' }}>添加新渠道</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>配置邮件、钉钉或短信通知</div>
        </Card>
      </div>

      <Modal
        open={modalOpen}
        title={modalMode === 'create' ? '新建通知渠道' : '编辑通知渠道'}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        okText={modalMode === 'create' ? '创建' : '保存'}
        cancelText="取消"
        destroyOnHidden
        forceRender
        confirmLoading={submitting}
      >
        <div ref={notificationChannelModalRef}>
          <Form
          form={form}
          layout="vertical"
          style={{ marginTop: 16 }}
          onValuesChange={(changed) => {
            if (changed.type) setChannelType(changed.type as SupportedChannelType);
          }}
        >
          <Form.Item name="name" label="渠道名称" rules={[{ required: true, message: '请输入渠道名称' }]}>
            <Input placeholder="输入渠道名称" autoComplete="off" />
          </Form.Item>
          <Form.Item name="type" label="渠道类型" initialValue="email">
            <Select
              options={[
                { value: 'email', label: '邮件 (Email)' },
                { value: 'dingtalk', label: '钉钉 (DingTalk)' },
                { value: 'sms', label: '短信 (SMS)' },
              ]}
            />
          </Form.Item>

          {channelType === 'email' && (
            <>
              <Form.Item name="smtpHost" label="SMTP 服务器" rules={[{ required: true, message: '请输入 SMTP 服务器' }]}>
                <Input placeholder="smtp.example.com" autoComplete="off" />
              </Form.Item>
              <Form.Item name="smtpPort" label="SMTP 端口" rules={[{ required: true, message: '请输入端口' }]} initialValue={587}>
                <Input type="number" placeholder="587" autoComplete="off" />
              </Form.Item>
              <Form.Item name="smtpUsername" label="SMTP 用户名">
                <Input placeholder="user@example.com" autoComplete="username" />
              </Form.Item>
              <Form.Item name="smtpPassword" label="SMTP 密码">
                <Input.Password placeholder="密码" autoComplete="new-password" />
              </Form.Item>
              <Form.Item name="fromEmail" label="发件人地址" rules={[{ required: true, message: '请输入发件人地址' }]}>
                <Input placeholder="alerts@example.com" autoComplete="email" />
              </Form.Item>
              <Form.Item name="fromName" label="发件人名称">
                <Input placeholder="NexusLog Alerts" autoComplete="off" />
              </Form.Item>
              <Form.Item
                name="recipients"
                label="告警收件人"
                extra="支持多个邮箱，使用英文逗号、分号或换行分隔。"
                rules={[
                  {
                    validator: async (_, value) => {
                      if (normalizeRecipientValues(value).length === 0) {
                        throw new Error('请至少配置一个收件人');
                      }
                    },
                  },
                ]}
              >
                <Input.TextArea rows={3} placeholder="ops@example.com, oncall@example.com" autoComplete="off" />
              </Form.Item>
              <Form.Item name="useTls" valuePropName="checked" initialValue={true}>
                <Checkbox>使用 TLS</Checkbox>
              </Form.Item>
            </>
          )}
          {channelType === 'dingtalk' && (
            <>
              <Form.Item name="webhookUrl" label="Webhook URL">
                <Input placeholder="https://oapi.dingtalk.com/robot/send?access_token=..." autoComplete="url" />
              </Form.Item>
              <Form.Item name="accessToken" label="Access Token（二选一）">
                <Input placeholder="机器人 access_token" autoComplete="off" />
              </Form.Item>
            </>
          )}
          {channelType === 'sms' && (
            <Form.Item name="provider" label="提供商" rules={[{ required: true, message: '请输入提供商' }]}>
              <Input placeholder="如: aliyun, tencent" autoComplete="organization" />
            </Form.Item>
          )}

          <Form.Item name="enabled" valuePropName="checked" initialValue={true}>
            <Checkbox>启用此渠道</Checkbox>
          </Form.Item>
          </Form>
        </div>
      </Modal>

      <Modal
        open={deleteModalOpen}
        title="删除通知渠道"
        onCancel={() => setDeleteModalOpen(false)}
        onOk={handleDelete}
        okText="删除"
        okButtonProps={{ danger: true }}
        cancelText="取消"
        confirmLoading={submitting}
      >
        <p style={{ color: '#94a3b8' }}>
          确定要删除通知渠道 <span style={{ fontWeight: 500 }}>"{currentChannel?.name}"</span> 吗？此操作不可撤销。
        </p>
      </Modal>
    </div>
  );
};

export default NotificationConfig;
