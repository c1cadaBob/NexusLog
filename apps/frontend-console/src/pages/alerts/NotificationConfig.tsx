import React, { useState, useMemo, useCallback } from 'react';
import { Button, Card, Tag, Modal, Form, Input, Select, Checkbox, Space, message } from 'antd';
import { useThemeStore } from '../../stores/themeStore';
import { COLORS } from '../../theme/tokens';
import type { NotificationChannel, NotificationChannelType } from '../../types/alert';

// ============================================================================
// 模拟数据
// ============================================================================

const mockChannels: NotificationChannel[] = [
  { id: '1', name: '邮件通知 (SMTP)', type: 'email', config: { server: 'smtp.company.net', sender: 'alerts@system.io', recipients: ['admin@company.com'] }, enabled: true, createdAt: Date.now() - 86400000 * 30, updatedAt: Date.now() - 7200000 },
  { id: '2', name: 'DevOps Slack', type: 'slack', config: { workspace: 'acme-corp', channel: '#critical-alerts', webhookUrl: 'https://hooks.slack.com/...' }, enabled: true, createdAt: Date.now() - 86400000 * 20, updatedAt: Date.now() - 86400000 },
  { id: '3', name: 'Custom Webhook', type: 'webhook', config: { url: 'https://api.example.com/v2/ingest', method: 'POST' }, enabled: false, createdAt: Date.now() - 86400000 * 10, updatedAt: Date.now() - 86400000 * 2 },
  { id: '4', name: '钉钉机器人', type: 'dingtalk', config: { webhookUrl: 'https://oapi.dingtalk.com/robot/send?access_token=...' }, enabled: true, createdAt: Date.now() - 86400000 * 5, updatedAt: Date.now() - 3600000 },
];

// ============================================================================
// 辅助函数
// ============================================================================

const channelIconMap: Record<NotificationChannelType, string> = {
  email: 'mail', slack: 'groups', webhook: 'webhook', dingtalk: 'chat', wechat: 'forum',
};

const channelColorMap: Record<NotificationChannelType, string> = {
  email: COLORS.info, slack: '#E01E5A', webhook: '#f97316', dingtalk: '#0ea5e9', wechat: COLORS.success,
};

const channelTypeName: Record<NotificationChannelType, string> = {
  email: '邮件', slack: 'Slack', webhook: 'Webhook', dingtalk: '钉钉', wechat: '企业微信',
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

const NotificationConfig: React.FC = () => {
  const isDark = useThemeStore((s) => s.isDark);
  const [form] = Form.useForm();

  const [channels, setChannels] = useState<NotificationChannel[]>(mockChannels);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [currentChannel, setCurrentChannel] = useState<NotificationChannel | null>(null);
  const [channelType, setChannelType] = useState<NotificationChannelType>('email');
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Map<string, { success: boolean; message: string }>>(new Map());

  const stats = useMemo(() => ({
    active: channels.filter(c => c.enabled).length,
    inactive: channels.filter(c => !c.enabled).length,
  }), [channels]);

  // 打开创建
  const openCreate = useCallback(() => {
    setModalMode('create');
    setCurrentChannel(null);
    setChannelType('email');
    form.resetFields();
    form.setFieldsValue({ type: 'email', enabled: true });
    setModalOpen(true);
  }, [form]);

  // 打开编辑
  const openEdit = useCallback((channel: NotificationChannel) => {
    setModalMode('edit');
    setCurrentChannel(channel);
    setChannelType(channel.type);
    const config = channel.config as Record<string, unknown>;
    form.setFieldsValue({
      name: channel.name,
      type: channel.type,
      enabled: channel.enabled,
      emailServer: config.server,
      emailSender: config.sender,
      emailRecipients: Array.isArray(config.recipients) ? (config.recipients as string[]).join(', ') : '',
      slackWebhookUrl: config.webhookUrl,
      slackChannel: config.channel,
      webhookUrl: config.url,
      webhookMethod: config.method || 'POST',
      dingtalkWebhookUrl: config.webhookUrl,
    });
    setModalOpen(true);
  }, [form]);

  // 构建配置
  const buildConfig = useCallback((values: Record<string, unknown>): Record<string, unknown> => {
    switch (values.type) {
      case 'email': return { server: values.emailServer, sender: values.emailSender, recipients: (values.emailRecipients as string)?.split(',').map((s: string) => s.trim()).filter(Boolean) || [] };
      case 'slack': return { webhookUrl: values.slackWebhookUrl, channel: values.slackChannel };
      case 'webhook': return { url: values.webhookUrl, method: values.webhookMethod || 'POST' };
      case 'dingtalk': return { webhookUrl: values.dingtalkWebhookUrl };
      default: return {};
    }
  }, []);

  // 提交
  const handleSubmit = useCallback(() => {
    form.validateFields().then(values => {
      if (modalMode === 'create') {
        const newChannel: NotificationChannel = {
          id: `channel-${Date.now()}`, name: values.name, type: values.type,
          config: buildConfig(values), enabled: values.enabled ?? true,
          createdAt: Date.now(), updatedAt: Date.now(),
        };
        setChannels(prev => [...prev, newChannel]);
        message.success(`通知渠道 "${values.name}" 已创建`);
      } else if (currentChannel) {
        setChannels(prev => prev.map(c => c.id === currentChannel.id ? {
          ...c, name: values.name, type: values.type, config: buildConfig(values),
          enabled: values.enabled ?? c.enabled, updatedAt: Date.now(),
        } : c));
        message.success(`通知渠道 "${values.name}" 已更新`);
      }
      setModalOpen(false);
    });
  }, [form, modalMode, currentChannel, buildConfig]);

  // 删除
  const handleDelete = useCallback(() => {
    if (!currentChannel) return;
    setChannels(prev => prev.filter(c => c.id !== currentChannel.id));
    setDeleteModalOpen(false);
    message.success(`通知渠道 "${currentChannel.name}" 已删除`);
    setCurrentChannel(null);
  }, [currentChannel]);

  // 测试
  const handleTest = useCallback(async (channel: NotificationChannel) => {
    setTestingId(channel.id);
    message.info(`正在测试 "${channel.name}"...`);
    await new Promise(r => setTimeout(r, 1500));
    const success = Math.random() > 0.3;
    setTestResults(prev => new Map(prev).set(channel.id, { success, message: success ? '测试消息发送成功' : '连接超时，请检查配置' }));
    setTestingId(null);
    message[success ? 'success' : 'error'](success ? '测试成功' : '测试失败：连接超时');
  }, []);

  // 切换启用
  const toggleEnabled = useCallback((channel: NotificationChannel) => {
    setChannels(prev => prev.map(c => c.id === channel.id ? { ...c, enabled: !c.enabled, updatedAt: Date.now() } : c));
    message.success(`通知渠道 "${channel.name}" 已${channel.enabled ? '禁用' : '启用'}`);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, height: '100%' }}>
      {/* 头部 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>
            通知配置 <span style={{ fontSize: 16, fontWeight: 400, color: '#94a3b8', marginLeft: 8 }}>(Notification Config)</span>
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: '#94a3b8' }}>管理告警通知渠道、Webhooks 集成及联系人组排班。</p>
        </div>
        <Space>
          <Button icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>history</span>}>发送日志</Button>
          <Button type="primary" icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>} onClick={openCreate}>新建渠道</Button>
        </Space>
      </div>

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
        {channels.map(channel => {
          const testResult = testResults.get(channel.id);
          const isTesting = testingId === channel.id;
          const iconColor = channelColorMap[channel.type];

          return (
            <Card key={channel.id} hoverable style={{ display: 'flex', flexDirection: 'column' }}
              styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column', padding: 20 } }}>
              {/* 头部 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${iconColor}1a` }}>
                    <span className="material-symbols-outlined" style={{ color: iconColor }}>{channelIconMap[channel.type]}</span>
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

              {/* 详情 */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: '#94a3b8' }}>类型</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{channelTypeName[channel.type]}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: '#94a3b8' }}>更新时间</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{formatTimeAgo(channel.updatedAt)}</span>
                </div>
              </div>

              {/* 底部 */}
              <div style={{ paddingTop: 16, borderTop: `1px solid ${isDark ? '#334155' : '#f1f5f9'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                {testResult ? (
                  <span style={{ fontSize: 12, fontWeight: 500, color: testResult.success ? COLORS.success : COLORS.danger, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{testResult.success ? 'check_circle' : 'error'}</span>
                    {testResult.success ? '测试通过' : '测试失败'}
                  </span>
                ) : (
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>未测试</span>
                )}
                <Button type="link" size="small" loading={isTesting} disabled={!channel.enabled}
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
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>配置 Webhook、邮件或即时通讯</div>
        </Card>
      </div>

      {/* 创建/编辑模态框 */}
      <Modal
        open={modalOpen}
        title={modalMode === 'create' ? '新建通知渠道' : '编辑通知渠道'}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        okText={modalMode === 'create' ? '创建' : '保存'}
        cancelText="取消"
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}
          onValuesChange={(changed) => { if (changed.type) setChannelType(changed.type); }}>
          <Form.Item name="name" label="渠道名称" rules={[{ required: true, message: '请输入渠道名称' }]}>
            <Input placeholder="输入渠道名称" />
          </Form.Item>
          <Form.Item name="type" label="渠道类型" initialValue="email">
            <Select options={[
              { value: 'email', label: '邮件 (Email)' },
              { value: 'slack', label: 'Slack' },
              { value: 'webhook', label: 'Webhook' },
              { value: 'dingtalk', label: '钉钉 (DingTalk)' },
              { value: 'wechat', label: '企业微信 (WeChat Work)' },
            ]} />
          </Form.Item>

          {/* Email 配置 */}
          {channelType === 'email' && (
            <>
              <Form.Item name="emailServer" label="SMTP 服务器"><Input placeholder="smtp.example.com" /></Form.Item>
              <Form.Item name="emailSender" label="发件人地址"><Input placeholder="alerts@example.com" /></Form.Item>
              <Form.Item name="emailRecipients" label="收件人（多个用逗号分隔）"><Input placeholder="admin@example.com, ops@example.com" /></Form.Item>
            </>
          )}
          {/* Slack 配置 */}
          {channelType === 'slack' && (
            <>
              <Form.Item name="slackWebhookUrl" label="Webhook URL"><Input placeholder="https://hooks.slack.com/services/..." /></Form.Item>
              <Form.Item name="slackChannel" label="频道"><Input placeholder="#alerts" /></Form.Item>
            </>
          )}
          {/* Webhook 配置 */}
          {channelType === 'webhook' && (
            <>
              <Form.Item name="webhookUrl" label="Webhook URL"><Input placeholder="https://api.example.com/webhook" /></Form.Item>
              <Form.Item name="webhookMethod" label="HTTP 方法" initialValue="POST">
                <Select options={[{ value: 'GET', label: 'GET' }, { value: 'POST', label: 'POST' }, { value: 'PUT', label: 'PUT' }]} />
              </Form.Item>
            </>
          )}
          {/* DingTalk 配置 */}
          {channelType === 'dingtalk' && (
            <Form.Item name="dingtalkWebhookUrl" label="机器人 Webhook URL">
              <Input placeholder="https://oapi.dingtalk.com/robot/send?access_token=..." />
            </Form.Item>
          )}

          <Form.Item name="enabled" valuePropName="checked" initialValue={true}>
            <Checkbox>启用此渠道</Checkbox>
          </Form.Item>
        </Form>
      </Modal>

      {/* 删除确认 */}
      <Modal
        open={deleteModalOpen}
        title="删除通知渠道"
        onCancel={() => setDeleteModalOpen(false)}
        onOk={handleDelete}
        okText="删除"
        okButtonProps={{ danger: true }}
        cancelText="取消"
      >
        <p style={{ color: '#94a3b8' }}>
          确定要删除通知渠道 <span style={{ fontWeight: 500 }}>"{currentChannel?.name}"</span> 吗？此操作不可撤销。
        </p>
      </Modal>
    </div>
  );
};

export default NotificationConfig;
