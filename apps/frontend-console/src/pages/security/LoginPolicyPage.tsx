/**
 * 登录策略页面
 *
 * 提供登录安全策略配置功能：
 * - 多因素认证 (MFA) 设置
 * - 密码策略配置
 * - 会话管理
 * - IP 白名单
 *
 * @requirements 9.4
 */

import React, { useState, useCallback } from 'react';
import {
  Card,
  Row,
  Col,
  Typography,
  Switch,
  InputNumber,
  Slider,
  Select,
  Input,
  Button,
  Table,
  Space,
  Tag,
  Checkbox,
  message,
  Popconfirm,
  Alert,
} from 'antd';
import {
  LockOutlined,
  SafetyOutlined,
  ClockCircleOutlined,
  GlobalOutlined,
  SaveOutlined,
  UndoOutlined,
  PlusOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { Text } = Typography;

// ============================================================================
// 本地类型
// ============================================================================

interface IpWhitelistItem {
  ip: string;
  note: string;
}

interface PolicySettings {
  totpEnabled: boolean;
  smsEnabled: boolean;
  minLength: number;
  passwordExpiry: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  historyCheck: number;
  idleTimeout: number;
  maxConcurrentSessions: number;
  maxLoginAttempts: number;
  lockoutDuration: number;
  ipWhitelistEnabled: boolean;
  ipWhitelist: IpWhitelistItem[];
}

// ============================================================================
// 默认设置
// ============================================================================

const defaultSettings: PolicySettings = {
  totpEnabled: true,
  smsEnabled: false,
  minLength: 12,
  passwordExpiry: 90,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: false,
  historyCheck: 3,
  idleTimeout: 30,
  maxConcurrentSessions: 3,
  maxLoginAttempts: 5,
  lockoutDuration: 30,
  ipWhitelistEnabled: true,
  ipWhitelist: [
    { ip: '10.0.0.0/8', note: '内网办公段' },
    { ip: '192.168.1.10', note: '管理员固定IP' },
    { ip: '203.0.113.5', note: 'VPN 网关' },
  ],
};

// ============================================================================
// 主组件
// ============================================================================

export const LoginPolicyPage: React.FC = () => {
  const [settings, setSettings] = useState<PolicySettings>({ ...defaultSettings, ipWhitelist: [...defaultSettings.ipWhitelist] });
  const [newIp, setNewIp] = useState('');
  const [saving, setSaving] = useState(false);

  // 更新设置字段
  const updateField = useCallback(<K extends keyof PolicySettings>(key: K, value: PolicySettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  // 保存
  const handleSave = useCallback(() => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      message.success('登录策略已保存');
    }, 800);
  }, []);

  // 重置
  const handleReset = useCallback(() => {
    setSettings({ ...defaultSettings, ipWhitelist: [...defaultSettings.ipWhitelist] });
    message.info('已恢复默认设置');
  }, []);

  // 添加 IP
  const handleAddIp = useCallback(() => {
    const trimmed = newIp.trim();
    if (!trimmed) return;
    if (settings.ipWhitelist.some(item => item.ip === trimmed)) {
      message.warning('该 IP 已存在');
      return;
    }
    setSettings(prev => ({ ...prev, ipWhitelist: [...prev.ipWhitelist, { ip: trimmed, note: '' }] }));
    setNewIp('');
    message.success('IP 已添加');
  }, [newIp, settings.ipWhitelist]);

  // 删除 IP
  const handleRemoveIp = useCallback((ip: string) => {
    setSettings(prev => ({ ...prev, ipWhitelist: prev.ipWhitelist.filter(item => item.ip !== ip) }));
  }, []);

  // IP 白名单表格列
  const ipColumns: ColumnsType<IpWhitelistItem> = [
    { title: 'IP 地址/CIDR', dataIndex: 'ip', key: 'ip', render: (ip: string) => <Text code>{ip}</Text> },
    { title: '备注', dataIndex: 'note', key: 'note', render: (note: string) => note || '-' },
    {
      title: '操作', key: 'actions', width: 80,
      render: (_, record) => (
        <Popconfirm title="确定删除？" onConfirm={() => handleRemoveIp(record.ip)} okText="删除" cancelText="取消">
          <Button type="link" size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      {/* 页面标题和操作按钮 */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Space align="center" style={{ marginBottom: 4 }}>
            <Typography.Title level={4} style={{ margin: 0 }}>登录策略</Typography.Title>
            <Tag color="blue">安全审计</Tag>
          </Space>
          <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
            管理全系统的认证规则、密码强度与访问控制策略
          </Typography.Paragraph>
        </div>
        <Space>
          <Button icon={<UndoOutlined />} onClick={handleReset}>重置</Button>
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving}>保存设置</Button>
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        {/* MFA 设置 */}
        <Col xs={24} lg={12}>
          <Card title={<Space><LockOutlined style={{ color: '#1677ff' }} /><span>多因素认证 (MFA)</span></Space>} size="small">
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Text>启用 TOTP 验证</Text>
                <div><Text type="secondary" style={{ fontSize: 12 }}>强制用户绑定 Google Authenticator 或类似应用</Text></div>
              </div>
              <Switch checked={settings.totpEnabled} onChange={v => updateField('totpEnabled', v)} />
            </div>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Text>启用短信验证</Text>
                <div><Text type="secondary" style={{ fontSize: 12 }}>登录异常 IP 时发送短信验证码</Text></div>
              </div>
              <Switch checked={settings.smsEnabled} onChange={v => updateField('smsEnabled', v)} />
            </div>
            <Alert type="info" showIcon message="启用 MFA 将显著提升账户安全性。建议管理员账户强制开启 TOTP。" style={{ fontSize: 12 }} />
          </Card>
        </Col>

        {/* 密码策略 */}
        <Col xs={24} lg={12}>
          <Card title={<Space><SafetyOutlined style={{ color: '#52c41a' }} /><span>密码策略</span></Space>} size="small">
            <Row gutter={16} style={{ marginBottom: 12 }}>
              <Col span={12}>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>最小长度</Text>
                <InputNumber min={6} max={32} value={settings.minLength} onChange={v => updateField('minLength', v ?? 8)} style={{ width: '100%' }} addonAfter="位" />
              </Col>
              <Col span={12}>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>密码有效期</Text>
                <InputNumber min={0} max={365} value={settings.passwordExpiry} onChange={v => updateField('passwordExpiry', v ?? 90)} style={{ width: '100%' }} addonAfter="天" />
              </Col>
            </Row>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>强制复杂度要求</Text>
            <Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
              <Col span={12}><Checkbox checked={settings.requireUppercase} onChange={e => updateField('requireUppercase', e.target.checked)}>大写字母 (A-Z)</Checkbox></Col>
              <Col span={12}><Checkbox checked={settings.requireLowercase} onChange={e => updateField('requireLowercase', e.target.checked)}>小写字母 (a-z)</Checkbox></Col>
              <Col span={12}><Checkbox checked={settings.requireNumbers} onChange={e => updateField('requireNumbers', e.target.checked)}>数字 (0-9)</Checkbox></Col>
              <Col span={12}><Checkbox checked={settings.requireSpecialChars} onChange={e => updateField('requireSpecialChars', e.target.checked)}>特殊符号 (!@#)</Checkbox></Col>
            </Row>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>历史密码检查</Text>
            <Select value={settings.historyCheck} onChange={v => updateField('historyCheck', v)} style={{ width: '100%' }} options={[
              { label: '禁止使用最近 3 个历史密码', value: 3 },
              { label: '禁止使用最近 5 个历史密码', value: 5 },
              { label: '不限制', value: 0 },
            ]} />
          </Card>
        </Col>

        {/* 会话管理 */}
        <Col xs={24} lg={12}>
          <Card title={<Space><ClockCircleOutlined style={{ color: '#fa8c16' }} /><span>会话管理</span></Space>} size="small">
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>空闲自动登出时间</Text>
                <Text strong>{settings.idleTimeout} 分钟</Text>
              </div>
              <Slider min={5} max={120} value={settings.idleTimeout} onChange={v => updateField('idleTimeout', v)} />
            </div>
            <Row gutter={16} style={{ marginBottom: 12 }}>
              <Col span={12}>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>最大并发登录数</Text>
                <InputNumber min={1} max={10} value={settings.maxConcurrentSessions} onChange={v => updateField('maxConcurrentSessions', v ?? 1)} style={{ width: '100%' }} />
              </Col>
              <Col span={12}>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>锁定时间（分钟）</Text>
                <InputNumber min={1} max={1440} value={settings.lockoutDuration} onChange={v => updateField('lockoutDuration', v ?? 30)} style={{ width: '100%' }} />
              </Col>
            </Row>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>允许登录失败次数</Text>
            <InputNumber min={1} max={20} value={settings.maxLoginAttempts} onChange={v => updateField('maxLoginAttempts', v ?? 5)} style={{ width: '100%' }} />
          </Card>
        </Col>

        {/* IP 白名单 */}
        <Col xs={24} lg={12}>
          <Card
            title={<Space><GlobalOutlined style={{ color: '#722ed1' }} /><span>IP 白名单</span></Space>}
            size="small"
            extra={<Switch size="small" checked={settings.ipWhitelistEnabled} onChange={v => updateField('ipWhitelistEnabled', v)} />}
          >
            <Typography.Paragraph type="secondary" style={{ fontSize: 12, margin: '0 0 12px' }}>
              仅允许以下 IP 地址段访问管理后台。未启用时允许所有 IP 访问。
            </Typography.Paragraph>
            <Space.Compact style={{ width: '100%', marginBottom: 12 }}>
              <Input
                placeholder="输入 IP 地址或 CIDR (如 192.168.1.0/24)"
                value={newIp}
                onChange={e => setNewIp(e.target.value)}
                onPressEnter={handleAddIp}
              />
              <Button icon={<PlusOutlined />} onClick={handleAddIp}>添加</Button>
            </Space.Compact>
            <Table<IpWhitelistItem>
              columns={ipColumns}
              dataSource={settings.ipWhitelist}
              rowKey="ip"
              size="small"
              pagination={false}
              scroll={{ y: 200 }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default LoginPolicyPage;
