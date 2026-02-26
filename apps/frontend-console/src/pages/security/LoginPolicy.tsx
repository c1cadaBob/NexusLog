import React, { useState, useCallback } from 'react';
import { Button, Card, Switch, InputNumber, Select, Checkbox, Input, Table, Space, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useThemeStore } from '../../stores/themeStore';
import { COLORS, DARK_PALETTE, LIGHT_PALETTE } from '../../theme/tokens';

// ============================================================================
// 类型定义
// ============================================================================

interface PolicySettings {
  totpEnabled: boolean;
  smsEnabled: boolean;
  minLength: number;
  passwordExpiry: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  historyCheck: string;
  idleTimeout: number;
  maxConcurrentSessions: number;
  maxLoginAttempts: number;
  lockoutDuration: number;
  ipWhitelistEnabled: boolean;
  ipWhitelist: { ip: string; note: string }[];
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
  historyCheck: '3',
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
// 组件
// ============================================================================

const LoginPolicy: React.FC = () => {
  const isDark = useThemeStore((s) => s.isDark);
  const palette = isDark ? DARK_PALETTE : LIGHT_PALETTE;

  const [settings, setSettings] = useState<PolicySettings>(defaultSettings);
  const [newIp, setNewIp] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(() => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      message.success('设置已保存');
    }, 1000);
  }, []);

  const handleReset = useCallback(() => {
    setSettings(defaultSettings);
    message.info('设置已重置');
  }, []);

  const handleAddIp = useCallback(() => {
    if (newIp.trim()) {
      setSettings(prev => ({
        ...prev,
        ipWhitelist: [...prev.ipWhitelist, { ip: newIp.trim(), note: '' }],
      }));
      setNewIp('');
    }
  }, [newIp]);

  const handleRemoveIp = useCallback((ip: string) => {
    setSettings(prev => ({
      ...prev,
      ipWhitelist: prev.ipWhitelist.filter(item => item.ip !== ip),
    }));
  }, []);

  const ipColumns: ColumnsType<{ ip: string; note: string }> = [
    {
      title: 'IP RANGE',
      dataIndex: 'ip',
      key: 'ip',
      render: (text: string) => <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>{text}</span>,
    },
    {
      title: '备注',
      dataIndex: 'note',
      key: 'note',
      render: (text: string) => <span style={{ color: palette.textSecondary }}>{text || '-'}</span>,
    },
    {
      title: '操作',
      key: 'actions',
      align: 'right',
      width: 80,
      render: (_, record) => (
        <Button type="text" size="small" danger onClick={() => handleRemoveIp(record.ip)}
          icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>} />
      ),
    },
  ];

  // 卡片标题辅助
  const cardTitle = (icon: string, title: string, iconColor: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ padding: 8, borderRadius: 8, background: `${iconColor}15`, color: iconColor }}>
        <span className="material-symbols-outlined">{icon}</span>
      </div>
      <span style={{ fontSize: 16, fontWeight: 700 }}>{title}</span>
    </div>
  );

  // 开关项辅助
  const toggleItem = (label: string, desc: string, checked: boolean, onChange: (v: boolean) => void) => (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: 16, borderRadius: 8, border: `1px solid ${palette.border}`,
      background: isDark ? 'rgba(17,23,34,0.5)' : palette.bgHover,
      cursor: 'pointer',
    }}>
      <div>
        <div style={{ fontWeight: 500, fontSize: 14 }}>{label}</div>
        <div style={{ fontSize: 12, color: palette.textSecondary, marginTop: 2 }}>{desc}</div>
      </div>
      <Switch checked={checked} onChange={onChange} />
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* 顶部栏 */}
      <div style={{ padding: '16px 24px', borderBottom: `1px solid ${palette.border}`, flexShrink: 0, background: isDark ? '#111722' : palette.bgContainer }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: palette.textSecondary, marginBottom: 4 }}>
          <span>安全与审计</span>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>chevron_right</span>
          <span style={{ color: palette.text, fontWeight: 500 }}>登录策略</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h2 style={{ margin: '8px 0 0', fontSize: 22, fontWeight: 700 }}>登录安全配置</h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: palette.textSecondary }}>管理全系统的认证规则、密码强度与访问控制策略</p>
          </div>
          <Space>
            <Button onClick={handleReset}>重置</Button>
            <Button type="primary" loading={isSaving} onClick={handleSave}
              icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>{isSaving ? 'progress_activity' : 'save'}</span>}
            >{isSaving ? '保存中...' : '保存设置'}</Button>
          </Space>
        </div>
      </div>

      {/* 内容区域 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

            {/* MFA 设置卡片 */}
            <Card title={cardTitle('lock_person', '多因素认证 (MFA)', COLORS.info)} style={{ background: palette.bgContainer, borderColor: palette.border }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {toggleItem(
                  '启用 TOTP 验证',
                  '强制用户绑定 Google Authenticator 或类似应用',
                  settings.totpEnabled,
                  v => setSettings(prev => ({ ...prev, totpEnabled: v }))
                )}
                {toggleItem(
                  '启用短信验证',
                  '登录异常IP时发送短信验证码',
                  settings.smsEnabled,
                  v => setSettings(prev => ({ ...prev, smsEnabled: v }))
                )}
                <div style={{ padding: 12, background: `${COLORS.info}08`, border: `1px solid ${COLORS.info}15`, borderRadius: 8, display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 4 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16, color: COLORS.info, marginTop: 2 }}>info</span>
                  <span style={{ fontSize: 12, color: palette.textSecondary, lineHeight: 1.6 }}>
                    启用 MFA 将显著提升账户安全性。建议管理员账户强制开启 TOTP。
                  </span>
                </div>
              </div>
            </Card>

            {/* 密码策略卡片 */}
            <Card title={cardTitle('password', '密码策略', COLORS.success)} style={{ background: palette.bgContainer, borderColor: palette.border }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: palette.textSecondary, marginBottom: 8 }}>最小长度</div>
                    <InputNumber
                      value={settings.minLength}
                      onChange={v => setSettings(prev => ({ ...prev, minLength: v || 8 }))}
                      min={6} max={32}
                      addonAfter="位"
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: palette.textSecondary, marginBottom: 8 }}>密码有效期</div>
                    <InputNumber
                      value={settings.passwordExpiry}
                      onChange={v => setSettings(prev => ({ ...prev, passwordExpiry: v || 90 }))}
                      min={0} max={365}
                      addonAfter="天"
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: palette.textSecondary, marginBottom: 8 }}>强制复杂度要求</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <Checkbox checked={settings.requireUppercase} onChange={e => setSettings(prev => ({ ...prev, requireUppercase: e.target.checked }))}>包含大写字母 (A-Z)</Checkbox>
                    <Checkbox checked={settings.requireLowercase} onChange={e => setSettings(prev => ({ ...prev, requireLowercase: e.target.checked }))}>包含小写字母 (a-z)</Checkbox>
                    <Checkbox checked={settings.requireNumbers} onChange={e => setSettings(prev => ({ ...prev, requireNumbers: e.target.checked }))}>包含数字 (0-9)</Checkbox>
                    <Checkbox checked={settings.requireSpecialChars} onChange={e => setSettings(prev => ({ ...prev, requireSpecialChars: e.target.checked }))}>包含特殊符号 (!@#)</Checkbox>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: palette.textSecondary, marginBottom: 8 }}>历史密码检查</div>
                  <Select
                    value={settings.historyCheck}
                    onChange={v => setSettings(prev => ({ ...prev, historyCheck: v }))}
                    style={{ width: '100%' }}
                    options={[
                      { value: '3', label: '禁止使用最近 3 个历史密码' },
                      { value: '5', label: '禁止使用最近 5 个历史密码' },
                      { value: '0', label: '不限制' },
                    ]}
                  />
                </div>
              </div>
            </Card>

            {/* 会话管理卡片 */}
            <Card title={cardTitle('timer', '会话管理', COLORS.warning)} style={{ background: palette.bgContainer, borderColor: palette.border }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: palette.textSecondary }}>空闲自动登出时间</span>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{settings.idleTimeout} 分钟</span>
                  </div>
                  <input
                    type="range"
                    min={5} max={120}
                    value={settings.idleTimeout}
                    onChange={e => setSettings(prev => ({ ...prev, idleTimeout: parseInt(e.target.value) }))}
                    style={{ width: '100%', accentColor: COLORS.primary }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: palette.textTertiary, marginTop: 4 }}>
                    <span>5m</span><span>120m</span>
                  </div>
                </div>
                <div style={{ borderTop: `1px solid ${palette.border}`, paddingTop: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: palette.textSecondary, marginBottom: 8 }}>最大并发登录数</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <InputNumber
                      value={settings.maxConcurrentSessions}
                      onChange={v => setSettings(prev => ({ ...prev, maxConcurrentSessions: v || 1 }))}
                      min={1} max={10}
                      style={{ width: 100 }}
                    />
                    <span style={{ fontSize: 12, color: palette.textSecondary, flex: 1 }}>
                      允许同一账号同时在线的设备数量。设置为 1 则强制单点登录。
                    </span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: palette.textSecondary, marginBottom: 8 }}>登录失败锁定策略</div>
                  <div style={{ padding: 12, border: `1px solid ${palette.border}`, borderRadius: 8, background: isDark ? palette.bgLayout : palette.bgHover, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13 }}>允许失败次数</span>
                      <InputNumber size="small" value={settings.maxLoginAttempts} onChange={v => setSettings(prev => ({ ...prev, maxLoginAttempts: v || 5 }))} min={1} max={20} style={{ width: 80 }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13 }}>锁定时间 (分钟)</span>
                      <InputNumber size="small" value={settings.lockoutDuration} onChange={v => setSettings(prev => ({ ...prev, lockoutDuration: v || 30 }))} min={1} max={1440} style={{ width: 80 }} />
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* IP 白名单卡片 */}
            <Card
              title={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {cardTitle('lan', 'IP 白名单', COLORS.purple)}
                  <Switch size="small" checked={settings.ipWhitelistEnabled} onChange={v => setSettings(prev => ({ ...prev, ipWhitelistEnabled: v }))} />
                </div>
              }
              style={{ background: palette.bgContainer, borderColor: palette.border }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p style={{ fontSize: 13, color: palette.textSecondary, margin: 0 }}>
                  仅允许以下 IP 地址段访问管理后台。未启用时允许所有 IP 访问。
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Input
                    placeholder="输入 IP 地址或 CIDR (e.g. 192.168.1.0/24)"
                    value={newIp}
                    onChange={e => setNewIp(e.target.value)}
                    onPressEnter={handleAddIp}
                    style={{ flex: 1 }}
                  />
                  <Button onClick={handleAddIp}>添加</Button>
                </div>
                <Table
                  columns={ipColumns}
                  dataSource={settings.ipWhitelist}
                  rowKey="ip"
                  size="small"
                  pagination={false}
                  style={{ marginTop: 4 }}
                />
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPolicy;
