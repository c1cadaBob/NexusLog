import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  App,
  Button,
  Card,
  Checkbox,
  Input,
  InputNumber,
  Popconfirm,
  Select,
  Switch,
  Table,
  Tag,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useThemeStore } from '../../stores/themeStore';
import { COLORS, DARK_PALETTE, LIGHT_PALETTE } from '../../theme/tokens';

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
  historyCheck: string;
  idleTimeout: number;
  maxConcurrentSessions: number;
  maxLoginAttempts: number;
  lockoutDuration: number;
  ipWhitelistEnabled: boolean;
  ipWhitelist: IpWhitelistItem[];
}

const LOGIN_POLICY_STORAGE_KEY = 'nexuslog-login-policy-settings';
const LOGIN_POLICY_SAVED_AT_KEY = 'nexuslog-login-policy-saved-at';

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
    { ip: '192.168.1.10', note: '管理员固定 IP' },
    { ip: '203.0.113.5', note: 'VPN 网关' },
  ],
};

function cloneSettings(source: PolicySettings): PolicySettings {
  return {
    ...source,
    ipWhitelist: source.ipWhitelist.map((item) => ({ ...item })),
  };
}

function normalizeIpWhitelist(raw: unknown): IpWhitelistItem[] {
  if (!Array.isArray(raw)) return cloneSettings(defaultSettings).ipWhitelist;
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const typedItem = item as Partial<IpWhitelistItem>;
      const ip = String(typedItem.ip ?? '').trim();
      if (!ip) return null;
      return {
        ip,
        note: String(typedItem.note ?? '').trim(),
      };
    })
    .filter((item): item is IpWhitelistItem => Boolean(item));
}

function normalizeSettings(raw: unknown): PolicySettings {
  if (!raw || typeof raw !== 'object') return cloneSettings(defaultSettings);
  const candidate = raw as Partial<PolicySettings>;
  const merged = {
    ...cloneSettings(defaultSettings),
    ...candidate,
  } as PolicySettings;
  merged.ipWhitelist = normalizeIpWhitelist(candidate.ipWhitelist);
  merged.historyCheck = ['0', '3', '5'].includes(String(merged.historyCheck)) ? String(merged.historyCheck) : defaultSettings.historyCheck;
  return merged;
}

function readStoredSettings(): PolicySettings {
  if (typeof window === 'undefined') return cloneSettings(defaultSettings);
  try {
    const stored = window.localStorage.getItem(LOGIN_POLICY_STORAGE_KEY);
    if (!stored) return cloneSettings(defaultSettings);
    return normalizeSettings(JSON.parse(stored));
  } catch {
    return cloneSettings(defaultSettings);
  }
}

function readStoredSavedAt(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(LOGIN_POLICY_SAVED_AT_KEY);
}

function serializeSettings(settings: PolicySettings): string {
  return JSON.stringify(settings);
}

function isValidIpv4Segment(segment: string): boolean {
  if (!/^\d+$/.test(segment)) return false;
  const value = Number(segment);
  return value >= 0 && value <= 255;
}

function isValidIpv4(value: string): boolean {
  const segments = value.split('.');
  return segments.length === 4 && segments.every(isValidIpv4Segment);
}

function isValidCidr(value: string): boolean {
  const [ip, mask] = value.split('/');
  if (!ip || mask === undefined) return false;
  if (!isValidIpv4(ip)) return false;
  if (!/^\d+$/.test(mask)) return false;
  const maskValue = Number(mask);
  return maskValue >= 0 && maskValue <= 32;
}

function isValidIpOrCidr(value: string): boolean {
  return isValidIpv4(value) || isValidCidr(value);
}

function formatSavedAt(value: string | null): string {
  if (!value) return '尚未保存';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN');
}

function toAccessibleDomId(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'item';
}

function validateSettings(settings: PolicySettings): string | null {
  const complexityEnabledCount = [
    settings.requireUppercase,
    settings.requireLowercase,
    settings.requireNumbers,
    settings.requireSpecialChars,
  ].filter(Boolean).length;

  if (settings.minLength < 8) {
    return '密码最小长度不能小于 8 位';
  }
  if (complexityEnabledCount < 3) {
    return '请至少启用 3 项密码复杂度要求';
  }
  if (settings.passwordExpiry < 0 || settings.passwordExpiry > 365) {
    return '密码有效期必须在 0 到 365 天之间';
  }
  if (settings.ipWhitelistEnabled && settings.ipWhitelist.length === 0) {
    return '启用 IP 白名单时，至少保留一条允许规则';
  }
  const invalidIp = settings.ipWhitelist.find((item) => !isValidIpOrCidr(item.ip.trim()));
  if (invalidIp) {
    return `白名单 IP 格式无效：${invalidIp.ip}`;
  }
  return null;
}

const LoginPolicy: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const isDark = useThemeStore((state) => state.isDark);
  const palette = isDark ? DARK_PALETTE : LIGHT_PALETTE;

  const initialSettings = useMemo(() => readStoredSettings(), []);
  const initialSavedAt = useMemo(() => readStoredSavedAt(), []);

  const [settings, setSettings] = useState<PolicySettings>(initialSettings);
  const [savedSnapshot, setSavedSnapshot] = useState(() => serializeSettings(initialSettings));
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(initialSavedAt);
  const [newIp, setNewIp] = useState('');
  const [newIpNote, setNewIpNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const complexityEnabledCount = useMemo(
    () => [settings.requireUppercase, settings.requireLowercase, settings.requireNumbers, settings.requireSpecialChars].filter(Boolean).length,
    [settings],
  );
  const isDirty = useMemo(() => serializeSettings(settings) !== savedSnapshot, [settings, savedSnapshot]);

  const handleSave = useCallback(async () => {
    const validationMessage = validateSettings(settings);
    if (validationMessage) {
      messageApi.error(validationMessage);
      return;
    }

    setIsSaving(true);
    try {
      const serialized = serializeSettings(settings);
      const savedAt = new Date().toISOString();
      window.localStorage.setItem(LOGIN_POLICY_STORAGE_KEY, serialized);
      window.localStorage.setItem(LOGIN_POLICY_SAVED_AT_KEY, savedAt);
      setSavedSnapshot(serialized);
      setLastSavedAt(savedAt);
      messageApi.success('登录策略已保存到当前浏览器');
    } catch {
      messageApi.error('保存登录策略失败');
    } finally {
      setIsSaving(false);
    }
  }, [messageApi, settings]);

  const handleReset = useCallback(() => {
    setSettings(cloneSettings(defaultSettings));
    setNewIp('');
    setNewIpNote('');
    messageApi.info('已恢复默认值，请点击“保存设置”后生效');
  }, [messageApi]);

  const handleAddIp = useCallback(() => {
    const ipValue = newIp.trim();
    const noteValue = newIpNote.trim();
    if (!ipValue) {
      messageApi.warning('请输入 IP 地址或 CIDR');
      return;
    }
    if (!isValidIpOrCidr(ipValue)) {
      messageApi.error('IP 地址或 CIDR 格式无效');
      return;
    }
    if (settings.ipWhitelist.some((item) => item.ip === ipValue)) {
      messageApi.warning('该白名单规则已存在');
      return;
    }
    setSettings((previous) => ({
      ...previous,
      ipWhitelist: [...previous.ipWhitelist, { ip: ipValue, note: noteValue }],
    }));
    setNewIp('');
    setNewIpNote('');
  }, [messageApi, newIp, newIpNote, settings.ipWhitelist]);

  const handleRemoveIp = useCallback((ip: string) => {
    setSettings((previous) => ({
      ...previous,
      ipWhitelist: previous.ipWhitelist.filter((item) => item.ip !== ip),
    }));
  }, []);

  const handleUpdateIpNote = useCallback((ip: string, note: string) => {
    setSettings((previous) => ({
      ...previous,
      ipWhitelist: previous.ipWhitelist.map((item) => (item.ip === ip ? { ...item, note } : item)),
    }));
  }, []);

  const ipColumns: ColumnsType<IpWhitelistItem> = [
    {
      title: '序号',
      key: 'index',
      width: 80,
      align: 'center',
      render: (_, __, index) => (
        <span style={{ fontFamily: 'JetBrains Mono, monospace', color: palette.textSecondary }}>{index + 1}</span>
      ),
    },
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
      render: (text: string, record) => (
        <Input
          id={`ip-whitelist-note-${toAccessibleDomId(record.ip)}`}
          name={`ip_whitelist_note_${record.ip}`}
          aria-label={`白名单规则 ${record.ip} 的备注`}
          size="small"
          value={text}
          placeholder="输入备注"
          onChange={(event) => handleUpdateIpNote(record.ip, event.target.value)}
        />
      ),
    },
    {
      title: '操作',
      key: 'actions',
      align: 'right',
      width: 90,
      render: (_, record) => (
        <Button
          type="text"
          size="small"
          danger
          aria-label={`删除白名单规则 ${record.ip}`}
          onClick={() => handleRemoveIp(record.ip)}
          icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>}
        />
      ),
    },
  ];

  const cardTitle = (icon: string, title: string, iconColor: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ padding: 8, borderRadius: 8, background: `${iconColor}15`, color: iconColor }}>
        <span className="material-symbols-outlined">{icon}</span>
      </div>
      <span style={{ fontSize: 16, fontWeight: 700 }}>{title}</span>
    </div>
  );

  const toggleItem = (
    label: string,
    desc: string,
    checked: boolean,
    onChange: (value: boolean) => void,
    controlId: string,
  ) => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderRadius: 8,
        border: `1px solid ${palette.border}`,
        background: isDark ? 'rgba(17,23,34,0.5)' : palette.bgHover,
      }}
    >
      <div>
        <div style={{ fontWeight: 500, fontSize: 14 }}>{label}</div>
        <div style={{ fontSize: 12, color: palette.textSecondary, marginTop: 2 }}>{desc}</div>
      </div>
      <Switch id={controlId} aria-label={label} checked={checked} onChange={onChange} />
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '16px 24px', borderBottom: `1px solid ${palette.border}`, flexShrink: 0, background: isDark ? '#111722' : palette.bgContainer }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: palette.textSecondary, marginBottom: 4 }}>
          <span>安全与审计</span>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>chevron_right</span>
          <span style={{ color: palette.text, fontWeight: 500 }}>登录策略</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h2 style={{ margin: '8px 0 0', fontSize: 22, fontWeight: 700 }}>登录安全配置</h2>
              <Tag color={isDirty ? 'warning' : 'success'}>{isDirty ? '有未保存变更' : '已保存'}</Tag>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: palette.textSecondary }}>
              管理全系统的认证规则、密码强度与访问控制策略
            </p>
            <p style={{ margin: '6px 0 0', fontSize: 12, color: palette.textTertiary }}>
              最近保存：{formatSavedAt(lastSavedAt)}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Popconfirm
              title="恢复默认设置？"
              description="该操作会重置当前表单，需再次点击“保存设置”后才会持久化。"
              okText="确认重置"
              cancelText="取消"
              onConfirm={handleReset}
            >
              <Button>重置</Button>
            </Popconfirm>
            <Button type="primary" icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>save</span>} onClick={() => void handleSave()} loading={isSaving} disabled={!isDirty}>
              保存设置
            </Button>
          </div>
        </div>
      </div>

      <div style={{ padding: '16px 24px 0', flexShrink: 0 }}>
        <Alert
          showIcon
          type="info"
          message="当前版本先保存到浏览器本地"
          description="登录策略会持久化到当前访问地址的浏览器存储中。不同来源地址（例如 localhost 与 192.168.0.202）会分别保存各自的策略副本。"
        />
      </div>

      <div
        style={{
          padding: '16px 24px 0',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 16,
          flexShrink: 0,
        }}
      >
        <Card size="small" style={{ background: palette.bgContainer, borderColor: palette.border }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 13, color: palette.textSecondary }}>MFA 状态</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{settings.totpEnabled || settings.smsEnabled ? '已启用' : '未启用'}</div>
            </div>
            <div style={{ padding: 8, borderRadius: 8, background: `${COLORS.primary}15`, color: COLORS.primary }}>
              <span className="material-symbols-outlined">verified_user</span>
            </div>
          </div>
        </Card>
        <Card size="small" style={{ background: palette.bgContainer, borderColor: palette.border }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 13, color: palette.textSecondary }}>密码复杂度</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{complexityEnabledCount} / 4</div>
            </div>
            <div style={{ padding: 8, borderRadius: 8, background: `${COLORS.warning}15`, color: COLORS.warning }}>
              <span className="material-symbols-outlined">password</span>
            </div>
          </div>
        </Card>
        <Card size="small" style={{ background: palette.bgContainer, borderColor: palette.border }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 13, color: palette.textSecondary }}>白名单规则</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{settings.ipWhitelist.length}</div>
            </div>
            <div style={{ padding: 8, borderRadius: 8, background: `${COLORS.purple}15`, color: COLORS.purple }}>
              <span className="material-symbols-outlined">lan</span>
            </div>
          </div>
        </Card>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card title={cardTitle('lock_person', '多因素认证 (MFA)', COLORS.primary)} style={{ background: palette.bgContainer, borderColor: palette.border }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {toggleItem('启用 TOTP 验证', '强制用户绑定 Google Authenticator 或类似应用', settings.totpEnabled, (value) => setSettings((previous) => ({ ...previous, totpEnabled: value })), 'login-policy-totp-enabled')}
                {toggleItem('启用短信验证', '登录异常 IP 时发送短信验证码', settings.smsEnabled, (value) => setSettings((previous) => ({ ...previous, smsEnabled: value })), 'login-policy-sms-enabled')}
                <Alert showIcon type="info" message="启用 MFA 将显著提升账户安全性，建议管理员账户强制开启 TOTP。" />
              </div>
            </Card>

            <Card title={cardTitle('password', '密码策略', COLORS.primary)} style={{ background: palette.bgContainer, borderColor: palette.border }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: palette.textSecondary, marginBottom: 8 }}>最小长度</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <InputNumber
                        id="password-min-length"
                        name="password_min_length"
                        aria-label="密码最小长度"
                        value={settings.minLength}
                        min={8}
                        max={32}
                        onChange={(value) => setSettings((previous) => ({ ...previous, minLength: value || 8 }))}
                        style={{ width: 120 }}
                      />
                      <span style={{ color: palette.textSecondary }}>位</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: palette.textSecondary, marginBottom: 8 }}>密码有效期</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <InputNumber
                        id="password-expiry-days"
                        name="password_expiry_days"
                        aria-label="密码有效期（天）"
                        value={settings.passwordExpiry}
                        min={0}
                        max={365}
                        onChange={(value) => setSettings((previous) => ({ ...previous, passwordExpiry: value ?? 0 }))}
                        style={{ width: 120 }}
                      />
                      <span style={{ color: palette.textSecondary }}>天</span>
                    </div>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: palette.textSecondary, marginBottom: 8 }}>强制复杂度要求</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <Checkbox
                      name="require_uppercase"
                      checked={settings.requireUppercase}
                      onChange={(event) => setSettings((previous) => ({ ...previous, requireUppercase: event.target.checked }))}
                    >
                      包含大写字母 (A-Z)
                    </Checkbox>
                    <Checkbox
                      name="require_lowercase"
                      checked={settings.requireLowercase}
                      onChange={(event) => setSettings((previous) => ({ ...previous, requireLowercase: event.target.checked }))}
                    >
                      包含小写字母 (a-z)
                    </Checkbox>
                    <Checkbox
                      name="require_numbers"
                      checked={settings.requireNumbers}
                      onChange={(event) => setSettings((previous) => ({ ...previous, requireNumbers: event.target.checked }))}
                    >
                      包含数字 (0-9)
                    </Checkbox>
                    <Checkbox
                      name="require_special_chars"
                      checked={settings.requireSpecialChars}
                      onChange={(event) => setSettings((previous) => ({ ...previous, requireSpecialChars: event.target.checked }))}
                    >
                      包含特殊符号 (!@#)
                    </Checkbox>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: palette.textSecondary, marginBottom: 8 }}>历史密码检查</div>
                  <Select
                    id="password-history-check"
                    aria-label="历史密码检查"
                    value={settings.historyCheck}
                    onChange={(value) => setSettings((previous) => ({ ...previous, historyCheck: value }))}
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
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card title={cardTitle('timer', '会话管理', COLORS.warning)} style={{ background: palette.bgContainer, borderColor: palette.border }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: palette.textSecondary }}>空闲自动登出时间</span>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{settings.idleTimeout} 分钟</span>
                  </div>
                  <input
                    id="idle-timeout"
                    type="range"
                    name="idle_timeout"
                    aria-label="空闲自动登出时间"
                    min={5}
                    max={120}
                    value={settings.idleTimeout}
                    onChange={(event) => setSettings((previous) => ({ ...previous, idleTimeout: parseInt(event.target.value, 10) }))}
                    style={{ width: '100%', accentColor: COLORS.primary }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: palette.textTertiary, marginTop: 4 }}>
                    <span>5m</span>
                    <span>120m</span>
                  </div>
                </div>
                <div style={{ borderTop: `1px solid ${palette.border}`, paddingTop: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: palette.textSecondary, marginBottom: 8 }}>最大并发登录数</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <InputNumber
                      id="max-concurrent-sessions"
                      name="max_concurrent_sessions"
                      aria-label="最大并发登录数"
                      value={settings.maxConcurrentSessions}
                      onChange={(value) => setSettings((previous) => ({ ...previous, maxConcurrentSessions: value || 1 }))}
                      min={1}
                      max={10}
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
                      <InputNumber
                        id="max-login-attempts"
                        name="max_login_attempts"
                        aria-label="允许失败次数"
                        size="small"
                        value={settings.maxLoginAttempts}
                        onChange={(value) => setSettings((previous) => ({ ...previous, maxLoginAttempts: value || 5 }))}
                        min={1}
                        max={20}
                        style={{ width: 80 }}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13 }}>锁定时间 (分钟)</span>
                      <InputNumber
                        id="lockout-duration"
                        name="lockout_duration"
                        aria-label="锁定时间（分钟）"
                        size="small"
                        value={settings.lockoutDuration}
                        onChange={(value) => setSettings((previous) => ({ ...previous, lockoutDuration: value || 30 }))}
                        min={1}
                        max={1440}
                        style={{ width: 80 }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            <Card
              title={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {cardTitle('lan', 'IP 白名单', COLORS.purple)}
                  <Switch
                    id="ip-whitelist-enabled"
                    size="small"
                    aria-label="启用 IP 白名单"
                    checked={settings.ipWhitelistEnabled}
                    onChange={(value) => setSettings((previous) => ({ ...previous, ipWhitelistEnabled: value }))}
                  />
                </div>
              }
              style={{ background: palette.bgContainer, borderColor: palette.border }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p style={{ fontSize: 13, color: palette.textSecondary, margin: 0 }}>
                  仅允许以下 IP 地址段访问管理后台。未启用时允许所有 IP 访问。
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr auto', gap: 8 }}>
                  <Input
                    id="new-whitelist-ip"
                    name="new_whitelist_ip"
                    aria-label="新增白名单 IP 或网段"
                    placeholder="输入 IP 地址或 CIDR，例如 192.168.1.0/24"
                    value={newIp}
                    onChange={(event) => setNewIp(event.target.value)}
                    onPressEnter={handleAddIp}
                  />
                  <Input
                    id="new-whitelist-note"
                    name="new_whitelist_note"
                    aria-label="新增白名单备注"
                    placeholder="备注（可选）"
                    value={newIpNote}
                    onChange={(event) => setNewIpNote(event.target.value)}
                    onPressEnter={handleAddIp}
                  />
                  <Button aria-label="添加 IP 白名单规则" onClick={handleAddIp}>添加</Button>
                </div>
                <Alert
                  showIcon
                  type={settings.ipWhitelistEnabled && settings.ipWhitelist.length === 0 ? 'warning' : 'info'}
                  message={settings.ipWhitelistEnabled ? `已启用白名单，共 ${settings.ipWhitelist.length} 条规则` : '白名单未启用，当前允许所有 IP 访问'}
                />
                <Table<IpWhitelistItem>
                  columns={ipColumns}
                  dataSource={settings.ipWhitelist}
                  rowKey="ip"
                  size="small"
                  pagination={false}
                  locale={{ emptyText: '暂无白名单规则' }}
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
