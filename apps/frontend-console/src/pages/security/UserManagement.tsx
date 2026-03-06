import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Input, Select, Table, Tag, Button, Space, Modal, Form, Spin, Empty, App } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useThemeStore } from '../../stores/themeStore';
import { COLORS, DARK_PALETTE, LIGHT_PALETTE } from '../../theme/tokens';
import {
  fetchUsers,
  createUser,
  updateUser,
  disableUser,
  assignRole,
  removeRole,
  fetchRoles,
  type UserData,
  type RoleData,
} from '../../api/user';

// ============================================================================
// 角色颜色映射
// ============================================================================

const roleColorMap: Record<string, string> = {
  admin: 'purple',
  sre: 'blue',
  developer: 'default',
  viewer: 'cyan',
  operator: 'orange',
};

// ============================================================================
// 组件
// ============================================================================

const UserManagement: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const isDark = useThemeStore((s) => s.isDark);
  const palette = isDark ? DARK_PALETTE : LIGHT_PALETTE;

  const [users, setUsers] = useState<UserData[]>([]);
  const [roles, setRoles] = useState<RoleData[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  const [form] = Form.useForm();
  const [createForm] = Form.useForm();
  const [actionLoading, setActionLoading] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchUsers(page, pageSize);
      setUsers(res.users);
      setTotal(res.total);
    } catch (err) {
      messageApi.error((err as Error).message || '加载用户列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, messageApi]);

  const loadRoles = useCallback(async () => {
    try {
      const list = await fetchRoles();
      setRoles(list);
    } catch (err) {
      messageApi.error((err as Error).message || '加载角色列表失败');
    }
  }, [messageApi]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  const roleOptions = useMemo(
    () => roles.map((r) => ({ value: r.id, label: r.name })),
    [roles],
  );

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const name = user.display_name || user.username;
      const matchesSearch =
        name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase());
      const primaryRole = user.roles?.[0]?.name;
      const matchesRole = !roleFilter || primaryRole === roleFilter || user.roles?.some((r) => r.name === roleFilter);
      const matchesStatus = !statusFilter || user.status === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchTerm, roleFilter, statusFilter]);

  const handleCreateUser = useCallback(async () => {
    try {
      const values = await createForm.validateFields();
      setActionLoading(true);
      await createUser({
        username: values.username,
        password: values.password,
        email: values.email,
        display_name: values.display_name || values.username,
        role_id: values.role_id,
      });
      setIsCreateModalOpen(false);
      createForm.resetFields();
      messageApi.success('用户创建成功');
      loadUsers();
    } catch (err) {
      if ((err as { errorFields?: unknown[] })?.errorFields) return;
      messageApi.error((err as Error).message || '创建用户失败');
    } finally {
      setActionLoading(false);
    }
  }, [createForm, loadUsers, messageApi]);

  const handleEditUser = useCallback(async () => {
    if (!currentUser) return;
    try {
      const values = await form.validateFields();
      setActionLoading(true);
      await updateUser(currentUser.id, {
        display_name: values.display_name,
        email: values.email,
      });
      const roleId = values.role_id;
      const currentRoleId = currentUser.roles?.[0]?.id;
      if (roleId && roleId !== currentRoleId) {
        if (currentRoleId) await removeRole(currentUser.id, currentRoleId);
        await assignRole(currentUser.id, roleId);
      }
      setIsEditModalOpen(false);
      setCurrentUser(null);
      form.resetFields();
      messageApi.success('用户信息已更新');
      loadUsers();
    } catch (err) {
      if ((err as { errorFields?: unknown[] })?.errorFields) return;
      messageApi.error((err as Error).message || '更新用户失败');
    } finally {
      setActionLoading(false);
    }
  }, [currentUser, form, loadUsers, messageApi]);

  const handleDeleteUser = useCallback(async () => {
    if (!currentUser) return;
    try {
      setActionLoading(true);
      await disableUser(currentUser.id);
      setIsDeleteModalOpen(false);
      setCurrentUser(null);
      messageApi.success('用户已禁用');
      loadUsers();
    } catch (err) {
      messageApi.error((err as Error).message || '禁用用户失败');
    } finally {
      setActionLoading(false);
    }
  }, [currentUser, loadUsers, messageApi]);

  const handleToggleStatus = useCallback(
    async (user: UserData) => {
      const newStatus = user.status === 'active' ? 'disabled' : 'active';
      try {
        setActionLoading(true);
        await updateUser(user.id, { status: newStatus });
        messageApi.success(newStatus === 'active' ? '用户已启用' : '用户已禁用');
        loadUsers();
      } catch (err) {
        messageApi.error((err as Error).message || '操作失败');
      } finally {
        setActionLoading(false);
      }
    },
    [loadUsers, messageApi],
  );

  const openEditModal = useCallback(
    (user: UserData) => {
      setCurrentUser(user);
      form.setFieldsValue({
        display_name: user.display_name || user.username,
        email: user.email,
        role_id: user.roles?.[0]?.id,
      });
      setIsEditModalOpen(true);
    },
    [form],
  );

  const openDeleteModal = useCallback((user: UserData) => {
    setCurrentUser(user);
    setIsDeleteModalOpen(true);
  }, []);

  const formatLastLogin = (lastLogin?: string) => {
    if (!lastLogin) return '-';
    try {
      const d = new Date(lastLogin);
      return Number.isNaN(d.getTime()) ? lastLogin : d.toLocaleString('zh-CN');
    } catch {
      return lastLogin;
    }
  };

  const columns: ColumnsType<UserData> = [
    {
      title: '用户 (USER)',
      dataIndex: 'display_name',
      key: 'name',
      render: (_, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: `${COLORS.primary}20`,
              color: COLORS.primary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            {(record.display_name || record.username || '?').charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 500 }}>{record.display_name || record.username}</div>
            <div style={{ fontSize: 12, color: palette.textSecondary, fontFamily: 'JetBrains Mono, monospace' }}>
              ID: {record.id}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: '邮箱 (EMAIL)',
      dataIndex: 'email',
      key: 'email',
      render: (text: string) => <span style={{ color: palette.textSecondary }}>{text}</span>,
    },
    {
      title: '角色 (ROLE)',
      key: 'role',
      render: (_, record) => {
        const roleName = record.roles?.[0]?.name || '-';
        return <Tag color={roleColorMap[roleName.toLowerCase()] || 'default'}>{roleName}</Tag>;
      },
    },
    {
      title: '最后登录 (LAST LOGIN)',
      key: 'lastLogin',
      render: (_, record) => (
        <span style={{ fontFamily: 'JetBrains Mono, monospace', color: palette.textSecondary }}>
          {formatLastLogin(record.last_login_at)}
        </span>
      ),
    },
    {
      title: '状态 (STATUS)',
      dataIndex: 'status',
      key: 'status',
      align: 'center',
      render: (status: string) => (
        <Tag color={status === 'active' ? 'success' : 'error'}>
          {status === 'active' ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '操作 (ACTIONS)',
      key: 'actions',
      align: 'right',
      render: (_, record) => (
        <Space size={4}>
          <Button
            type="text"
            size="small"
            title="编辑用户"
            onClick={() => openEditModal(record)}
            icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit</span>}
          />
          <Button
            type="text"
            size="small"
            title={record.status === 'active' ? '禁用用户' : '启用用户'}
            onClick={() => handleToggleStatus(record)}
            icon={
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                {record.status === 'active' ? 'block' : 'check_circle'}
              </span>
            }
          />
          <Button
            type="text"
            size="small"
            danger
            title="禁用用户"
            onClick={() => openDeleteModal(record)}
            icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>}
          />
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
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          background: isDark ? '#111722' : palette.bgContainer,
        }}
      >
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              color: palette.textSecondary,
              marginBottom: 4,
            }}
          >
            <span>安全与审计</span>
            <span className="material-symbols-outlined" style={{ fontSize: 10 }}>chevron_right</span>
            <span style={{ color: COLORS.primary, fontWeight: 500 }}>用户管理</span>
          </div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>用户管理</h2>
        </div>
        <Button
          type="primary"
          onClick={() => {
            createForm.resetFields();
            setIsCreateModalOpen(true);
          }}
          icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>}
        >
          新增用户
        </Button>
      </div>

      {/* 筛选栏 */}
      <div
        style={{
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexShrink: 0,
          background: isDark ? palette.bgContainer : '#fff',
          borderBottom: `1px solid ${palette.border}`,
        }}
      >
        <Input
          prefix={<span className="material-symbols-outlined" style={{ fontSize: 18, color: palette.textSecondary }}>search</span>}
          placeholder="按用户名、邮箱搜索..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ width: 280 }}
          allowClear
        />
        <Select
          placeholder="所有角色"
          value={roleFilter}
          onChange={(v) => setRoleFilter(v)}
          allowClear
          style={{ width: 140 }}
          options={roleOptions}
        />
        <Select
          placeholder="所有状态"
          value={statusFilter}
          onChange={(v) => setStatusFilter(v)}
          allowClear
          style={{ width: 140 }}
          options={[
            { value: 'active', label: '启用' },
            { value: 'disabled', label: '禁用' },
          ]}
        />
      </div>

      {/* 表格 */}
      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        <Spin spinning={loading}>
          <Table<UserData>
            columns={columns}
            dataSource={filteredUsers}
            rowKey="id"
            size="middle"
            loading={false}
            pagination={{
              current: page,
              pageSize,
              total,
              showTotal: (t, range) => `显示 ${range[0]} 到 ${range[1]} 条，共 ${t} 条记录`,
              showSizeChanger: true,
              onChange: (p, ps) => {
                setPage(p);
                setPageSize(ps ?? 10);
              },
            }}
            locale={{
              emptyText: <Empty description="暂无用户数据" />,
            }}
          />
        </Spin>
      </div>

      {/* 创建用户模态框 */}
      <Modal
        open={isCreateModalOpen}
        title="新增用户"
        onCancel={() => {
          setIsCreateModalOpen(false);
          createForm.resetFields();
        }}
        onOk={handleCreateUser}
        okText="创建"
        cancelText="取消"
        width={480}
        confirmLoading={actionLoading}
      >
        <Form form={createForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input placeholder="输入登录用户名" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }, { min: 8, message: '密码至少 8 位' }]}>
            <Input.Password placeholder="输入密码" />
          </Form.Item>
          <Form.Item name="display_name" label="显示名称">
            <Input placeholder="输入显示名称（可选）" />
          </Form.Item>
          <Form.Item name="email" label="邮箱" rules={[{ required: true, message: '请输入邮箱地址' }, { type: 'email', message: '请输入有效的邮箱地址' }]}>
            <Input placeholder="输入邮箱地址" />
          </Form.Item>
          <Form.Item name="role_id" label="角色">
            <Select placeholder="选择角色" allowClear options={roleOptions} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑用户模态框 */}
      <Modal
        open={isEditModalOpen}
        title="编辑用户"
        onCancel={() => {
          setIsEditModalOpen(false);
          setCurrentUser(null);
          form.resetFields();
        }}
        onOk={handleEditUser}
        okText="保存"
        cancelText="取消"
        width={480}
        confirmLoading={actionLoading}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="display_name" label="显示名称" rules={[{ required: true, message: '请输入显示名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="邮箱" rules={[{ required: true, message: '请输入邮箱地址' }, { type: 'email', message: '请输入有效的邮箱地址' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="role_id" label="角色">
            <Select placeholder="选择角色" allowClear options={roleOptions} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 删除确认模态框 */}
      <Modal
        open={isDeleteModalOpen}
        title="确认禁用"
        onCancel={() => {
          setIsDeleteModalOpen(false);
          setCurrentUser(null);
        }}
        onOk={handleDeleteUser}
        okText="禁用"
        cancelText="取消"
        okButtonProps={{ danger: true }}
        width={420}
        confirmLoading={actionLoading}
      >
        <p style={{ color: palette.textSecondary }}>
          确定要禁用用户{' '}
          <span style={{ fontWeight: 500, color: palette.text }}>{currentUser?.display_name || currentUser?.username}</span>{' '}
          吗？
        </p>
      </Modal>
    </div>
  );
};

export default UserManagement;
