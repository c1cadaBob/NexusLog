import React, { useState, useMemo, useCallback } from 'react';
import { Input, Select, Table, Tag, Button, Card, Space, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useThemeStore } from '../../stores/themeStore';
import { COLORS, DARK_PALETTE, LIGHT_PALETTE } from '../../theme/tokens';

// ============================================================================
// 类型定义
// ============================================================================

interface AuditLog {
  id: string;
  timestamp: string;
  operator: string;
  operatorInitial: string;
  operatorColor: string;
  action: 'Login' | 'Update' | 'Delete' | 'Create';
  target: string;
  sourceIp: string;
  status: 'success' | 'failed';
}

// ============================================================================
// 模拟数据
// ============================================================================

const initialLogs: AuditLog[] = [
  { id: '1', timestamp: '2023-10-27 14:35:22', operator: 'admin_01', operatorInitial: 'A', operatorColor: 'purple', action: 'Update', target: 'Dashboard Config / Main', sourceIp: '192.168.1.10', status: 'success' },
  { id: '2', timestamp: '2023-10-27 14:32:15', operator: 'user_mike', operatorInitial: 'M', operatorColor: 'orange', action: 'Delete', target: 'Alert Rule #402', sourceIp: '10.0.0.5', status: 'failed' },
  { id: '3', timestamp: '2023-10-27 14:30:01', operator: 'admin_01', operatorInitial: 'A', operatorColor: 'purple', action: 'Login', target: 'System / Auth', sourceIp: '192.168.1.10', status: 'success' },
  { id: '4', timestamp: '2023-10-27 14:15:45', operator: 'sys_bot', operatorInitial: 'S', operatorColor: 'geekblue', action: 'Create', target: 'Auto-Backup #992', sourceIp: 'localhost', status: 'success' },
  { id: '5', timestamp: '2023-10-27 13:58:12', operator: 'admin_01', operatorInitial: 'A', operatorColor: 'purple', action: 'Update', target: 'User Role / user_mike', sourceIp: '192.168.1.10', status: 'success' },
  { id: '6', timestamp: '2023-10-27 13:45:33', operator: 'unknown', operatorInitial: '?', operatorColor: 'default', action: 'Login', target: 'System / Auth', sourceIp: '203.0.113.42', status: 'failed' },
  { id: '7', timestamp: '2023-10-27 12:30:00', operator: 'user_jane', operatorInitial: 'J', operatorColor: 'green', action: 'Create', target: 'Dashboard / Sales', sourceIp: '192.168.1.25', status: 'success' },
  { id: '8', timestamp: '2023-10-27 11:20:15', operator: 'admin_02', operatorInitial: 'A', operatorColor: 'blue', action: 'Update', target: 'System Config', sourceIp: '192.168.1.11', status: 'success' },
  { id: '9', timestamp: '2023-10-26 18:45:00', operator: 'user_mike', operatorInitial: 'M', operatorColor: 'orange', action: 'Login', target: 'System / Auth', sourceIp: '10.0.0.5', status: 'success' },
  { id: '10', timestamp: '2023-10-26 16:30:22', operator: 'sys_bot', operatorInitial: 'S', operatorColor: 'geekblue', action: 'Delete', target: 'Old Logs / Archive', sourceIp: 'localhost', status: 'success' },
];

// ============================================================================
// 辅助函数
// ============================================================================

const actionTagColor: Record<string, string> = {
  Update: 'processing',
  Delete: 'error',
  Create: 'success',
  Login: 'default',
};

const operatorAvatarColors: Record<string, { bg: string; text: string }> = {
  purple: { bg: 'rgba(139,92,246,0.2)', text: '#a78bfa' },
  orange: { bg: 'rgba(249,115,22,0.2)', text: '#fb923c' },
  geekblue: { bg: 'rgba(139,92,246,0.2)', text: '#a78bfa' },
  green: { bg: 'rgba(16,185,129,0.2)', text: '#34d399' },
  blue: { bg: 'rgba(59,130,246,0.2)', text: '#60a5fa' },
  default: { bg: 'rgba(100,116,139,0.2)', text: '#94a3b8' },
};

// ============================================================================
// 组件
// ============================================================================

const AuditLogs: React.FC = () => {
  const isDark = useThemeStore((s) => s.isDark);
  const palette = isDark ? DARK_PALETTE : LIGHT_PALETTE;

  const [operatorFilter, setOperatorFilter] = useState('');
  const [actionFilter, setActionFilter] = useState<string | undefined>(undefined);
  const [resourceFilter, setResourceFilter] = useState<string | undefined>(undefined);
  const [dateRange, setDateRange] = useState('2023-10-26 - 2023-10-27');

  const filteredLogs = useMemo(() => {
    return initialLogs.filter(log => {
      const matchesOperator = !operatorFilter || log.operator.toLowerCase().includes(operatorFilter.toLowerCase());
      const matchesAction = !actionFilter || log.action.toLowerCase() === actionFilter.toLowerCase();
      const matchesResource = !resourceFilter || log.target.toLowerCase().includes(resourceFilter.toLowerCase());
      return matchesOperator && matchesAction && matchesResource;
    });
  }, [operatorFilter, actionFilter, resourceFilter]);

  const handleReset = useCallback(() => {
    setOperatorFilter('');
    setActionFilter(undefined);
    setResourceFilter(undefined);
    setDateRange('2023-10-26 - 2023-10-27');
  }, []);

  const handleExport = useCallback(() => {
    message.success('审计日志导出成功');
  }, []);

  const columns: ColumnsType<AuditLog> = [
    {
      title: '时间戳 (Timestamp)',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 180,
      render: (text: string) => <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: palette.textSecondary }}>{text}</span>,
    },
    {
      title: '操作人 (Operator)',
      dataIndex: 'operator',
      key: 'operator',
      width: 160,
      render: (_, record) => {
        const colors = operatorAvatarColors[record.operatorColor] || operatorAvatarColors.default;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: colors.bg, color: colors.text, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
              {record.operatorInitial}
            </div>
            <span style={{ fontWeight: 500, fontSize: 13 }}>{record.operator}</span>
          </div>
        );
      },
    },
    {
      title: '动作 (Action)',
      dataIndex: 'action',
      key: 'action',
      width: 120,
      render: (action: string) => <Tag color={actionTagColor[action] || 'default'}>{action}</Tag>,
    },
    {
      title: '对象 (Target)',
      dataIndex: 'target',
      key: 'target',
      render: (text: string) => <span style={{ color: palette.textSecondary, fontSize: 13 }}>{text}</span>,
    },
    {
      title: 'IP地址 (Source IP)',
      dataIndex: 'sourceIp',
      key: 'sourceIp',
      width: 150,
      render: (text: string) => <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: palette.textSecondary }}>{text}</span>,
    },
    {
      title: '状态 (Status)',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: status === 'success' ? COLORS.success : COLORS.danger, display: 'inline-block' }} />
          <span style={{ fontSize: 13, fontWeight: 500, color: status === 'success' ? COLORS.success : COLORS.danger }}>
            {status === 'success' ? '成功' : '失败'}
          </span>
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* 顶部栏 */}
      <div style={{ height: 56, padding: '0 24px', borderBottom: `1px solid ${palette.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, background: isDark ? '#111722' : palette.bgContainer }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>审计日志</h2>
          <Tag style={{ fontSize: 10 }}>Audit Logs</Tag>
        </div>
        <Space>
          <Button onClick={handleReset}
            icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>refresh</span>}
          >重置</Button>
          <Button type="primary" onClick={handleExport}
            icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>download</span>}
          >导出 CSV</Button>
        </Space>
      </div>

      {/* 筛选区域 */}
      <div style={{ padding: '16px 24px', flexShrink: 0 }}>
        <Card size="small" style={{ background: palette.bgContainer, borderColor: palette.border }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, alignItems: 'end' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>操作人 (Operator)</div>
              <Input
                prefix={<span className="material-symbols-outlined" style={{ fontSize: 18, color: palette.textSecondary }}>person</span>}
                placeholder="输入用户名..."
                value={operatorFilter}
                onChange={e => setOperatorFilter(e.target.value)}
                allowClear
              />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>操作类型 (Action)</div>
              <Select
                placeholder="全部类型"
                value={actionFilter}
                onChange={v => setActionFilter(v)}
                allowClear
                style={{ width: '100%' }}
                options={[
                  { value: 'login', label: '登录 (Login)' },
                  { value: 'delete', label: '删除 (Delete)' },
                  { value: 'update', label: '更新 (Update)' },
                  { value: 'create', label: '创建 (Create)' },
                ]}
              />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>资源对象 (Resource)</div>
              <Select
                placeholder="全部资源"
                value={resourceFilter}
                onChange={v => setResourceFilter(v)}
                allowClear
                style={{ width: '100%' }}
                options={[
                  { value: 'dashboard', label: '仪表盘 (Dashboard)' },
                  { value: 'alert', label: '告警规则 (Alert)' },
                  { value: 'user', label: '用户 (User)' },
                  { value: 'system', label: '系统 (System)' },
                ]}
              />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>时间范围 (Time Range)</div>
              <Input
                prefix={<span className="material-symbols-outlined" style={{ fontSize: 18, color: palette.textSecondary }}>calendar_today</span>}
                value={dateRange}
                onChange={e => setDateRange(e.target.value)}
              />
            </div>
            <div>
              <Button type="primary" block
                icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>search</span>}
              >查询</Button>
            </div>
          </div>
        </Card>
      </div>

      {/* 表格 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 24px 24px' }}>
        <Table<AuditLog>
          columns={columns}
          dataSource={filteredLogs}
          rowKey="id"
          size="middle"
          pagination={{
            showTotal: (total, range) => `显示 ${range[0]} 到 ${range[1]} 条，共 ${total} 条记录`,
            pageSize: 10,
            showSizeChanger: false,
          }}
        />
      </div>

      {/* 底部安全提示 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 0 16px', fontSize: 12, color: palette.textTertiary, flexShrink: 0 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 14, marginRight: 4 }}>lock</span>
        <span>所有审计日志已加密存储，且不可篡改。最近归档：2023-10-26 23:59:59</span>
      </div>
    </div>
  );
};

export default AuditLogs;
