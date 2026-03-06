import React, { useState, useCallback, useEffect } from 'react';
import { Input, Table, Tag, Card, Space, App, Empty } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useThemeStore } from '../../stores/themeStore';
import { COLORS, DARK_PALETTE, LIGHT_PALETTE } from '../../theme/tokens';
import { fetchRoles, type RoleData } from '../../api/user';

// ============================================================================
// 辅助
// ============================================================================

const iconColorMap: Record<string, { bg: string; text: string }> = {
  purple: { bg: 'rgba(139,92,246,0.15)', text: '#a78bfa' },
  blue: { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa' },
  orange: { bg: 'rgba(249,115,22,0.15)', text: '#fb923c' },
  default: { bg: 'rgba(100,116,139,0.15)', text: '#94a3b8' },
};

const getPermissionTags = (permissions: string[]) => {
  if (permissions.includes('*')) return [{ label: '完全控制', color: 'error' as const }];
  if (permissions.length === 0) return [{ label: '无权限', color: 'default' as const }];
  return permissions.slice(0, 5).map((p) => ({ label: p, color: 'processing' as const }));
};

// ============================================================================
// 组件
// ============================================================================

const RolePermissions: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const isDark = useThemeStore((s) => s.isDark);
  const palette = isDark ? DARK_PALETTE : LIGHT_PALETTE;

  const [roles, setRoles] = useState<RoleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const loadRoles = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchRoles();
      setRoles(list);
    } catch (err) {
      messageApi.error((err as Error).message || '加载角色列表失败');
    } finally {
      setLoading(false);
    }
  }, [messageApi]);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  const filteredRoles = roles.filter(
    (role) =>
      role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (role.description || '').toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const columns: ColumnsType<RoleData> = [
    {
      title: '角色名称',
      dataIndex: 'name',
      key: 'name',
      width: '20%',
      render: (_, record) => {
        const colors = iconColorMap.default;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: colors.bg,
                color: colors.text,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                badge
              </span>
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{record.name}</div>
              <div style={{ fontSize: 12, color: palette.textSecondary }}>Role ID: #{record.id}</div>
            </div>
          </div>
        );
      },
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      width: '30%',
      render: (text: string) => <span style={{ color: palette.textSecondary, fontSize: 13 }}>{text || '-'}</span>,
    },
    {
      title: '权限范围',
      key: 'permissions',
      width: '50%',
      render: (_, record) => (
        <Space size={4} wrap>
          {getPermissionTags(record.permissions || []).map((tag, idx) => (
            <Tag key={idx} color={tag.color}>
              {tag.label}
            </Tag>
          ))}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* 顶部栏 */}
      <div
        style={{
          padding: '16px 24px',
          borderBottom: `1px solid ${palette.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          flexShrink: 0,
          background: isDark ? '#111722' : palette.bgContainer,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>角色权限</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: palette.textSecondary }}>
            管理用户角色及对应的功能模块访问权限
          </p>
        </div>
        <Input
          prefix={<span className="material-symbols-outlined" style={{ fontSize: 18, color: palette.textSecondary }}>search</span>}
          placeholder="搜索角色..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ width: 220 }}
          allowClear
        />
      </div>

      {/* 统计卡片 */}
      <div
        style={{
          padding: '16px 24px 0',
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 16,
          flexShrink: 0,
        }}
      >
        <Card size="small" style={{ background: palette.bgContainer, borderColor: palette.border }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 13, color: palette.textSecondary }}>总角色数</div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{roles.length}</div>
            </div>
            <div style={{ padding: 8, borderRadius: 8, background: `${COLORS.primary}15`, color: COLORS.primary }}>
              <span className="material-symbols-outlined">badge</span>
            </div>
          </div>
        </Card>
        <Card size="small" style={{ background: palette.bgContainer, borderColor: palette.border }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 13, color: palette.textSecondary }}>权限项</div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>
                {roles.reduce((sum, r) => sum + (r.permissions?.length ?? 0), 0)}
              </div>
            </div>
            <div style={{ padding: 8, borderRadius: 8, background: `${COLORS.warning}15`, color: COLORS.warning }}>
              <span className="material-symbols-outlined">key</span>
            </div>
          </div>
        </Card>
      </div>

      {/* 表格 */}
      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        <Table<RoleData>
          columns={columns}
          dataSource={filteredRoles}
          rowKey="id"
          size="middle"
          loading={loading}
          pagination={{
            showTotal: (total, range) => `显示 ${range[0]} 到 ${range[1]}，共 ${total} 条`,
            pageSize: 10,
            showSizeChanger: false,
          }}
          locale={{
            emptyText: <Empty description="暂无角色数据" />,
          }}
        />
      </div>
    </div>
  );
};

export default RolePermissions;
