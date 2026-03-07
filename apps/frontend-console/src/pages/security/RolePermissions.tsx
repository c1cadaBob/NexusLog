import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { App, Button, Card, Drawer, Empty, Input, Result, Space, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useThemeStore } from '../../stores/themeStore';
import { COLORS, DARK_PALETTE, LIGHT_PALETTE } from '../../theme/tokens';
import { fetchRoles, type RoleData } from '../../api/user';

interface LoadErrorState {
  message: string;
  status?: number;
}

const iconColorMap: Record<string, { bg: string; text: string }> = {
  purple: { bg: 'rgba(139,92,246,0.15)', text: '#a78bfa' },
  blue: { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa' },
  orange: { bg: 'rgba(249,115,22,0.15)', text: '#fb923c' },
  default: { bg: 'rgba(100,116,139,0.15)', text: '#94a3b8' },
};

const getPermissionTags = (permissions: string[]) => {
  if (permissions.includes('*')) return [{ label: '完全控制', color: 'error' as const }];
  if (permissions.length === 0) return [{ label: '无权限', color: 'default' as const }];
  return permissions.slice(0, 5).map((permission) => ({ label: permission, color: 'processing' as const }));
};

function toLoadError(error: unknown, fallbackMessage: string): LoadErrorState {
  const typedError = error as Error & { status?: number };
  return {
    message: typedError?.message || fallbackMessage,
    status: typeof typedError?.status === 'number' ? typedError.status : undefined,
  };
}

const RolePermissions: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const isDark = useThemeStore((state) => state.isDark);
  const palette = isDark ? DARK_PALETTE : LIGHT_PALETTE;

  const [roles, setRoles] = useState<RoleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadError, setLoadError] = useState<LoadErrorState | null>(null);
  const [selectedRole, setSelectedRole] = useState<RoleData | null>(null);

  const loadRoles = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchRoles();
      setRoles(list);
      setLoadError(null);
    } catch (error) {
      setRoles([]);
      setLoadError(toLoadError(error, '加载角色列表失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  const filteredRoles = useMemo(
    () => roles.filter(
      (role) =>
        role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (role.description || '').toLowerCase().includes(searchTerm.toLowerCase()),
    ),
    [roles, searchTerm],
  );

  const totalPermissionCount = useMemo(
    () => roles.reduce((sum, role) => sum + (role.permissions?.length ?? 0), 0),
    [roles],
  );

  const openRoleDrawer = useCallback((role: RoleData) => {
    setSelectedRole(role);
  }, []);

  const closeRoleDrawer = useCallback(() => {
    setSelectedRole(null);
  }, []);

  const goToLogin = useCallback(() => {
    window.location.hash = '#/login';
  }, []);

  const copyPermissions = useCallback(async () => {
    if (!selectedRole) return;
    try {
      await navigator.clipboard.writeText((selectedRole.permissions || []).join('\n'));
      messageApi.success('权限列表已复制');
    } catch {
      messageApi.error('复制权限列表失败');
    }
  }, [messageApi, selectedRole]);

  const columns: ColumnsType<RoleData> = [
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
      title: '角色名称',
      dataIndex: 'name',
      key: 'name',
      width: '22%',
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
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>badge</span>
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
      width: '28%',
      render: (text: string) => <span style={{ color: palette.textSecondary, fontSize: 13 }}>{text || '-'}</span>,
    },
    {
      title: '权限范围',
      key: 'permissions',
      width: '38%',
      render: (_, record) => {
        const permissions = record.permissions || [];
        return (
          <Space size={4} wrap>
            {getPermissionTags(permissions).map((tag, index) => (
              <Tag key={index} color={tag.color}>
                {tag.label}
              </Tag>
            ))}
            {permissions.length > 5 ? <Tag color="default">+{permissions.length - 5}</Tag> : null}
          </Space>
        );
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      align: 'right',
      render: (_, record) => (
        <Button type="link" size="small" onClick={() => openRoleDrawer(record)}>
          查看详情
        </Button>
      ),
    },
  ];

  const loadErrorPresentation = loadError?.status === 401
    ? {
        status: '403' as const,
        title: '当前会话未登录或已失效',
        subTitle: '角色权限接口返回 401。请先重新登录，再继续查看角色与权限配置。',
      }
    : {
        status: 'warning' as const,
        title: '加载角色权限失败',
        subTitle: loadError?.message || '请稍后重试。',
      };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
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
          name="role_search"
          prefix={<span className="material-symbols-outlined" style={{ fontSize: 18, color: palette.textSecondary }}>search</span>}
          placeholder="搜索角色..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          style={{ width: 220 }}
          allowClear
          disabled={Boolean(loadError)}
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
              <div style={{ fontSize: 13, color: palette.textSecondary }}>当前筛选</div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{filteredRoles.length}</div>
            </div>
            <div style={{ padding: 8, borderRadius: 8, background: `${COLORS.success}15`, color: COLORS.success }}>
              <span className="material-symbols-outlined">filter_alt</span>
            </div>
          </div>
        </Card>
        <Card size="small" style={{ background: palette.bgContainer, borderColor: palette.border }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 13, color: palette.textSecondary }}>权限项</div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{totalPermissionCount}</div>
            </div>
            <div style={{ padding: 8, borderRadius: 8, background: `${COLORS.warning}15`, color: COLORS.warning }}>
              <span className="material-symbols-outlined">key</span>
            </div>
          </div>
        </Card>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        {loadError ? (
          <div style={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Result
              status={loadErrorPresentation.status}
              title={loadErrorPresentation.title}
              subTitle={loadErrorPresentation.subTitle}
              extra={[
                <Button key="retry" onClick={() => void loadRoles()}>重新加载</Button>,
                loadError.status === 401 ? (
                  <Button key="login" type="primary" onClick={goToLogin}>
                    前往登录
                  </Button>
                ) : null,
              ]}
            />
          </div>
        ) : (
          <Table<RoleData>
            columns={columns}
            dataSource={filteredRoles}
            rowKey="id"
            size="middle"
            loading={loading}
            onRow={(record) => ({
              onDoubleClick: () => openRoleDrawer(record),
            })}
            pagination={{
              showTotal: (total, range) => `显示 ${range[0]} 到 ${range[1]}，共 ${total} 条`,
              pageSize: 10,
              showSizeChanger: false,
            }}
            locale={{
              emptyText: <Empty description={searchTerm ? '没有匹配的角色' : '暂无角色数据'} />,
            }}
          />
        )}
      </div>

      <Drawer
        open={Boolean(selectedRole)}
        title={selectedRole ? `${selectedRole.name} · 权限详情` : '权限详情'}
        width={560}
        onClose={closeRoleDrawer}
        extra={
          <Button size="small" onClick={() => void copyPermissions()} disabled={!selectedRole}>
            复制权限
          </Button>
        }
      >
        {selectedRole ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card size="small" style={{ background: palette.bgContainer, borderColor: palette.border }}>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', rowGap: 12, columnGap: 12 }}>
                <span style={{ color: palette.textSecondary }}>角色 ID</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{selectedRole.id}</span>
                <span style={{ color: palette.textSecondary }}>角色描述</span>
                <span>{selectedRole.description || '-'}</span>
                <span style={{ color: palette.textSecondary }}>权限数量</span>
                <span>{selectedRole.permissions?.length ?? 0}</span>
              </div>
            </Card>
            <Card size="small" title="完整权限列表" style={{ background: palette.bgContainer, borderColor: palette.border }}>
              <Space size={6} wrap>
                {(selectedRole.permissions?.length ? selectedRole.permissions : ['无权限']).map((permission) => (
                  <Tag key={permission} color={permission === '*' ? 'error' : 'processing'}>
                    {permission === '*' ? '完全控制 (*)' : permission}
                  </Tag>
                ))}
              </Space>
            </Card>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
};

export default RolePermissions;
