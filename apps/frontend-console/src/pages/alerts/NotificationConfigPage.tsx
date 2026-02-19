/**
 * 通知配置页面
 *
 * 提供通知渠道管理功能：
 * - 渠道卡片展示
 * - 创建/编辑/删除渠道
 * - 测试通知发送
 * - 启用/禁用渠道
 *
 * @requirements 9.3
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Card,
  Tag,
  Space,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Row,
  Col,
  Typography,
  Badge,
  Tooltip,
  message,
  Popconfirm,
} from 'antd';
import {
  PlusOutlined,
  MailOutlined,
  SlackOutlined,
  ApiOutlined,
  MessageOutlined,
  EditOutlined,
  DeleteOutlined,
  ThunderboltOutlined,
  LoadingOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import type { NotificationChannel, AlertActionType } from '@/types/alert';

const { Text, Paragraph } = Typography;

// ============================================================================
// 模拟数据
// ============================================================================

const mockChannels: NotificationChannel[] = [
  {
    id: '1', name: '邮件通知 (SMTP)', type: 'email',
    config: { server: 'smtp.company.net', sender: 'alerts@system.io', recipients: ['admin@company.com'] },
    enabled: true, createdAt: Date.now() - 86400000 * 30, updatedAt: Date.now() - 7200000,
  },
  {
    id: '2', name: 'DevOps Slack', type: 'slack',
    config: { workspace: 'acme-corp', channel: '#critical-alerts', webhookUrl: 'https://hooks.slack.com/...' },
    enabled: true, createdAt: Date.now() - 86400000 * 20, updatedAt: Date.now() - 86400000,
  },
  {
    id: '3', name: 'Custom Webhook', type: 'webhook',
    config: { url: 'https://api.example.com/v2/ingest', method: 'POST' },
    enabled: false, createdAt: Date.now() - 86400000 * 10, updatedAt: Date.now() - 86400000 * 2,
  },
  {
    id: '4', name: '钉钉机器人', type: 'dingtalk',
    config: { webhookUrl: 'https://oapi.dingtalk.com/robot/send?access_token=...' },
    enabled: true, createdAt: Date.now() - 86400000 * 5, updatedAt: Date.now() - 3600000,
  },
];

// ============================================================================
// 辅助函数
// ============================================================================

const channelTypeIcon: Record<string, React.ReactNode> = {
  email: <MailOutlined />,
  slack: <SlackOutlined />,
  webhook: <ApiOutlined />,
  dingtalk: <MessageOutlined />,
  wechat: <MessageOutlined />,
  pagerduty: <ThunderboltOutlined />,
  sms: <MessageOutlined />,
};

const channelTypeName: Record<string, string> = {
  email: '邮件', slack: 'Slack', webhook: 'Webhook',
  dingtalk: '钉钉', wechat: '企业微信', pagerduty: 'PagerDuty', sms: '短信',
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
// 主组件
// ============================================================================

export const NotificationConfigPage: React.FC = () => {
  const [channels, setChannels] = useState<NotificationChannel[]>(mockChannels);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<NotificationChannel | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Map<string, boolean>>(new Map());
  const [form] = Form.useForm();

  // 统计
  const stats = useMemo(() => ({
    active: channels.filter(c => c.enabled).length,
    inactive: channels.filter(c => !c.enabled).length,
  }), [channels]);

  // 当前表单中的渠道类型
  const currentType = Form.useWatch('type', form) as AlertActionType | undefined;

  // 打开创建/编辑模态框
  const openModal = useCallback((channel?: NotificationChannel) => {
    if (channel) {
      setEditingChannel(channel);
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
    } else {
      setEditingChannel(null);
      form.resetFields();
    }
    setModalOpen(true);
  }, [form]);

  // 构建配置
  const buildConfig = useCallback((values: Record<string, unknown>) => {
    switch (values.type) {
      case 'email':
        return {
          server: values.emailServer || '',
          sender: values.emailSender || '',
          recipients: typeof values.emailRecipients === 'string'
            ? values.emailRecipients.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
        };
      case 'slack':
        return { webhookUrl: values.slackWebhookUrl || '', channel: values.slackChannel || '' };
      case 'webhook':
        return { url: values.webhookUrl || '', method: values.webhookMethod || 'POST' };
      case 'dingtalk':
        return { webhookUrl: values.dingtalkWebhookUrl || '' };
      default:
        return {};
    }
  }, []);

  // 提交表单
  const handleSubmit = useCallback(async () => {
    try {
      const values = await form.validateFields();
      const config = buildConfig(values);
      if (editingChannel) {
        setChannels(prev => prev.map(c => c.id === editingChannel.id ? {
          ...c, name: values.name, type: values.type, config, enabled: values.enabled ?? true, updatedAt: Date.now(),
        } : c));
        message.success(`通知渠道 "${values.name}" 已更新`);
      } else {
        const newChannel: NotificationChannel = {
          id: `channel-${Date.now()}`, name: values.name, type: values.type,
          config, enabled: values.enabled ?? true, createdAt: Date.now(), updatedAt: Date.now(),
        };
        setChannels(prev => [...prev, newChannel]);
        message.success(`通知渠道 "${values.name}" 已创建`);
      }
      setModalOpen(false);
    } catch { /* validation error */ }
  }, [form, editingChannel, buildConfig]);

  // 删除渠道
  const handleDelete = useCallback((channel: NotificationChannel) => {
    setChannels(prev => prev.filter(c => c.id !== channel.id));
    message.success(`通知渠道 "${channel.name}" 已删除`);
  }, []);

  // 切换启用
  const toggleEnabled = useCallback((channel: NotificationChannel) => {
    setChannels(prev => prev.map(c =>
      c.id === channel.id ? { ...c, enabled: !c.enabled, updatedAt: Date.now() } : c
    ));
    message.success(`通知渠道 "${channel.name}" 已${channel.enabled ? '禁用' : '启用'}`);
  }, []);

  // 测试渠道
  const handleTest = useCallback(async (channel: NotificationChannel) => {
    setTestingId(channel.id);
    await new Promise(resolve => setTimeout(resolve, 1500));
    const success = Math.random() > 0.3;
    setTestResults(prev => new Map(prev).set(channel.id, success));
    setTestingId(null);
    message[success ? 'success' : 'error'](success ? '测试消息发送成功' : '连接超时，请检查配置');
  }, []);

  return (
    <div>
      {/* 页面标题 */}
      <div style={{ marginBottom: 16 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Space align="center" style={{ marginBottom: 4 }}>
              <Typography.Title level={4} style={{ margin: 0 }}>通知配置</Typography.Title>
              <Tag color="blue">告警中心</Tag>
            </Space>
            <Paragraph type="secondary" style={{ margin: 0 }}>
              管理告警通知渠道、Webhooks 集成及联系人组排班
            </Paragraph>
          </Col>
          <Col>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>新建渠道</Button>
          </Col>
        </Row>
      </div>

      {/* 统计 */}
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Tag color="success">{stats.active} 个活跃</Tag>
          <Tag>{stats.inactive} 个未启用</Tag>
        </Space>
      </div>

      {/* 渠道卡片网格 */}
      <Row gutter={[16, 16]}>
        {channels.map(channel => {
          const testResult = testResults.get(channel.id);
          const isTesting = testingId === channel.id;

          return (
            <Col xs={24} sm={12} lg={8} xl={6} key={channel.id}>
              <Card
                hoverable
                actions={[
                  <Tooltip title="测试连接" key="test">
                    <Button
                      type="link"
                      size="small"
                      disabled={isTesting || !channel.enabled}
                      icon={isTesting ? <LoadingOutlined /> : <ThunderboltOutlined />}
                      onClick={() => handleTest(channel)}
                    >
                      {isTesting ? '测试中...' : '测试'}
                    </Button>
                  </Tooltip>,
                  <Tooltip title="编辑" key="edit">
                    <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openModal(channel)} />
                  </Tooltip>,
                  <Popconfirm title={`确定删除 "${channel.name}"？`} onConfirm={() => handleDelete(channel)} okText="删除" cancelText="取消" key="delete">
                    <Button type="link" size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>,
                ]}
              >
                <Card.Meta
                  avatar={
                    <Badge dot status={channel.enabled ? 'success' : 'default'}>
                      <div style={{ fontSize: 24 }}>{channelTypeIcon[channel.type] || <MessageOutlined />}</div>
                    </Badge>
                  }
                  title={
                    <Space>
                      <span>{channel.name}</span>
                      <Switch size="small" checked={channel.enabled} onChange={() => toggleEnabled(channel)} />
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size={4} style={{ width: '100%' }}>
                      <Text type="secondary">类型: {channelTypeName[channel.type] || channel.type}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>更新: {formatTimeAgo(channel.updatedAt)}</Text>
                      {testResult !== undefined && (
                        <Space size={4}>
                          {testResult
                            ? <Tag icon={<CheckCircleOutlined />} color="success">测试通过</Tag>
                            : <Tag icon={<CloseCircleOutlined />} color="error">测试失败</Tag>
                          }
                        </Space>
                      )}
                    </Space>
                  }
                />
              </Card>
            </Col>
          );
        })}

        {/* 添加新渠道占位卡片 */}
        <Col xs={24} sm={12} lg={8} xl={6}>
          <Card
            hoverable
            style={{ height: '100%', minHeight: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed' }}
            onClick={() => openModal()}
          >
            <div style={{ textAlign: 'center' }}>
              <PlusOutlined style={{ fontSize: 32, color: '#999', marginBottom: 8 }} />
              <div><Text type="secondary">添加新渠道</Text></div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 创建/编辑模态框 */}
      <Modal
        title={editingChannel ? '编辑通知渠道' : '新建通知渠道'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        okText={editingChannel ? '保存' : '创建'}
        cancelText="取消"
        destroyOnClose
      >
        <Form form={form} layout="vertical" initialValues={{ type: 'email', enabled: true, webhookMethod: 'POST' }}>
          <Form.Item name="name" label="渠道名称" rules={[{ required: true, message: '请输入渠道名称' }]}>
            <Input placeholder="输入渠道名称" />
          </Form.Item>
          <Form.Item name="type" label="渠道类型">
            <Select options={[
              { label: '邮件 (Email)', value: 'email' },
              { label: 'Slack', value: 'slack' },
              { label: 'Webhook', value: 'webhook' },
              { label: '钉钉 (DingTalk)', value: 'dingtalk' },
              { label: '企业微信 (WeChat Work)', value: 'wechat' },
            ]} />
          </Form.Item>

          {/* Email 配置 */}
          {currentType === 'email' && (
            <>
              <Form.Item name="emailServer" label="SMTP 服务器"><Input placeholder="smtp.example.com" /></Form.Item>
              <Form.Item name="emailSender" label="发件人地址"><Input placeholder="alerts@example.com" /></Form.Item>
              <Form.Item name="emailRecipients" label="收件人（多个用逗号分隔）"><Input placeholder="admin@example.com, ops@example.com" /></Form.Item>
            </>
          )}

          {/* Slack 配置 */}
          {currentType === 'slack' && (
            <>
              <Form.Item name="slackWebhookUrl" label="Webhook URL"><Input placeholder="https://hooks.slack.com/services/..." /></Form.Item>
              <Form.Item name="slackChannel" label="频道"><Input placeholder="#alerts" /></Form.Item>
            </>
          )}

          {/* Webhook 配置 */}
          {currentType === 'webhook' && (
            <>
              <Form.Item name="webhookUrl" label="Webhook URL"><Input placeholder="https://api.example.com/webhook" /></Form.Item>
              <Form.Item name="webhookMethod" label="HTTP 方法">
                <Select options={[{ label: 'GET', value: 'GET' }, { label: 'POST', value: 'POST' }, { label: 'PUT', value: 'PUT' }]} />
              </Form.Item>
            </>
          )}

          {/* DingTalk 配置 */}
          {currentType === 'dingtalk' && (
            <Form.Item name="dingtalkWebhookUrl" label="机器人 Webhook URL">
              <Input placeholder="https://oapi.dingtalk.com/robot/send?access_token=..." />
            </Form.Item>
          )}

          <Form.Item name="enabled" label="启用状态" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default NotificationConfigPage;
