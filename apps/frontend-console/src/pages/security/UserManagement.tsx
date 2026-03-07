import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Alert, App, Button, Empty, Form, Input, Modal, Result, Select, Space, Spin, Table, Tag } from 'antd';
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

interface LoadErrorState {
  message: string;
  status?: number;
}

const roleColorMap: Record<string, string> = {
  admin: 'purple',
  sre: 'blue',
  developer: 'default',
  viewer: 'cyan',
  operator: 'orange',
};

function toLoadError(error: unknown, fallbackMessage: string): LoadErrorState {
  const typedError = error as Error & { status?: number };
  return {
    message: typedError?.message || fallbackMessage,
    status: typeof typedError?.status === 'number' ? typedError.status : undefined,
  };
}

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
  const [userLoadError, setUserLoadError] = useState<LoadErrorState | null>(null);
  const [roleLoadError, setRoleLoadError] = useState<LoadErrorState | null>(null);
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
      setUserLoadError(null);
    } catch (error) {
      setUsers([]);
      setTotal(0);
      setUserLoadError(toLoadError(error, '加载用户列表失败'));
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  const loadRoles = useCallback(async () => {
    try {
      const list = await fetchRoles();
      setRoles(list);
      setRoleLoadError(null);
    } catch (error) {
      setRoles([]);
      setRoleLoadError(toLoadError(error, '加载角色列表失败'));
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  const roleOptions = useMemo(
    () => roles.map((role) => ({ value: role.id, label: role.name })),
    [roles],
  );

  const filteredUsers = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    return users.filter((user) => {
      const name = (user.display_name || user.username || '').toLowerCase();
      const email = (user.email || '').toLowerCase();
      const matchesSearch = !keyword || name.includes(keyword) || email.includes(keyword);
      const matchesRole = !roleFilter || Boolean(user.roles?.some((role) => role.id === roleFilter));
      const matchesStatus = !statusFilter || user.status === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchTerm, roleFilter, statusFilter]);

  const filtersActive = Boolean(searchTerm.trim() || roleFilter || statusFilter);
  const currentPageSummary = filtersActive
    ? `当前页筛选命中 ${filteredUsers.length} / ${users.length} 条；后端总数 ${total} 条`
    : `当前页已加载 ${users.length} 条；后端总数 ${total} 条`;

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
      await loadUsers();
    } catch (error) {
      if ((error as { errorFields?: unknown[] })?.errorFields) return;
      messageApi.error((error as Error).message || '创建用户失败');
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
      if (roleId !== currentRoleId) {
        if (currentRoleId) await removeRole(currentUser.id, currentRoleId);
        if (roleId) await assignRole(currentUser.id, roleId);
      }
      setIsEditModalOpen(false);
      setCurrentUser(null);
      form.resetFields();
      messageApi.success('用户信息已更新');
      await loadUsers();
    } catch (error) {
      if ((error as { errorFields?: unknown[] })?.errorFields) return;
      messageApi.error((error as Error).message || '更新用户失败');
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
      await loadUsers();
    } catch (error) {
      messageApi.error((error as Error).message || '禁用用户失败');
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
        await loadUsers();
      } catch (error) {
        messageApi.error((error as Error).message || '操作失败');
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

  const goToLogin = useCallback(() => {
    window.location.hash = '#/login';
  }, []);

  const retryAll = useCallback(() => {
    void loadUsers();
    void loadRoles();
  }, [loadUsers, loadRoles]);

  const formatLastLogin = (lastLogin?: string) => {
    if (!lastLogin) return '-';
    try {
      const date = new Date(lastLogin);
      return Number.isNaN(date.getTime()) ? lastLogin : date.toLocaleString('zh-CN');
    } catch {
      return lastLogin;
    }
  };

  const columns: ColumnsType<UserData> = [
    {
      title: '序号',
      key: 'index',
      width: 80,
      align: 'center',
      render: (_, __, index) => (
        <span style={{ fontFamily: 'JetBrains Mono, monospace', color: palette.textSecondary }}>
          {(page - 1) * pageSize + index + 1}
        </span>
      ),
    },
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
      render: (status: string) => <Tag color={status === 'active' ? 'success' : 'error'}>{status === 'active' ? '启用' : '禁用'}</Tag>,
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

  const userErrorPresentation = userLoadError?.status === 401
    ? {
        status: '403' as const,
        title: '当前会话未登录或已失效',
        subTitle: '用户管理接口返回 401。请先重新登录，再继续查看或维护用户信息。',
      }
    : {
        status: 'warning' as const,
        title: '加载用户数据失败',
        subTitle: userLoadError?.message || '请稍后重试。',
      };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
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
          disabled={Boolean(userLoadError)}
          onClick={() => {
            createForm.resetFields();
            setIsCreateModalOpen(true);
          }}
          icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>}
        >
          新增用户
        </Button>
      </div>

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
          name="user_search"
          prefix={<span className="material-symbols-outlined" style={{ fontSize: 18, color: palette.textSecondary }}>search</span>}
          placeholder="按用户名、邮箱搜索..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          style={{ width: 280 }}
          allowClear
          disabled={Boolean(userLoadError)}
        />
        <Select
          placeholder="所有角色"
          value={roleFilter}
          onChange={(value) => setRoleFilter(value)}
          allowClear
          style={{ width: 160 }}
          options={roleOptions}
          disabled={Boolean(userLoadError) || Boolean(roleLoadError)}
        />
        <Select
          placeholder="所有状态"
          value={statusFilter}
          onChange={(value) => setStatusFilter(value)}
          allowClear
          style={{ width: 140 }}
          disabled={Boolean(userLoadError)}
          options={[
            { value: 'active', label: '启用' },
            { value: 'disabled', label: '禁用' },
          ]}
        />
      </div>

      <div style={{ padding: '12px 24px 0', flexShrink: 0 }}>
        {roleLoadError ? (
          <Alert
            showIcon
            type={roleLoadError.status === 401 ? 'warning' : 'error'}
            message={roleLoadError.status === 401 ? '角色信息未授权，角色筛选与角色分配暂不可用' : '角色信息加载失败'}
            description={roleLoadError.message}
            action={<Button size="small" onClick={() => void loadRoles()}>重试角色加载</Button>}
          />
        ) : (
          <Alert showIcon type="info" message={currentPageSummary} description={filtersActive ? '搜索、角色与状态筛选当前只作用于已加载的这一页数据。' : undefined} />
        )}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        {userLoadError ? (
          <div style={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Result
              status={userErrorPresentation.status}
              title={userErrorPresentation.title}
              subTitle={userErrorPresentation.subTitle}
              extra={[
                <Button key="retry" onClick={retryAll}>重新加载</Button>,
                userLoadError.status === 401 ? (
                  <Button key="login" type="primary" onClick={goToLogin}>
                    前往登录
                  </Button>
                ) : null,
              ]}
            />
          </div>
        ) : (
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
                showTotal: (itemsTotal, range) => `显示 ${range[0]} 到 ${range[1]} 条，共 ${itemsTotal} 条记录`,
                showSizeChanger: true,
                onChange: (nextPage, nextPageSize) => {
                  setPage(nextPage);
                  setPageSize(nextPageSize ?? 10);
                },
              }}
              locale={{
                emptyText: <Empty description={filtersActive ? '当前页没有匹配条件的用户' : '暂无用户数据'} />,
              }}
            />
          </Spin>
        )}
      </div>

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
            <Input name="create_username" placeholder="输入登录用户名" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }, { min: 8, message: '密码至少 8 位' }]}>
            <Input.Password placeholder="输入密码" />
          </Form.Item>
          <Form.Item name="display_name" label="显示名称">
            <Input name="create_display_name" placeholder="输入显示名称（可选）" />
          </Form.Item>
          <Form.Item name="email" label="邮箱" rules={[{ required: true, message: '请输入邮箱地址' }, { type: 'email', message: '请输入有效的邮箱地址' }]}>
            <Input name="create_email" placeholder="输入邮箱地址" />
          </Form.Item>
          <Form.Item name="role_id" label="角色">
            <Select placeholder={roleLoadError ? '角色加载失败，暂不可选' : '选择角色'} allowClear options={roleOptions} disabled={Boolean(roleLoadError)} />
          </Form.Item>
        </Form>
      </Modal>

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
            <Input name="edit_display_name" />
          </Form.Item>
          <Form.Item name="email" label="邮箱" rules={[{ required: true, message: '请输入邮箱地址' }, { type: 'email', message: '请输入有效的邮箱地址' }]}>
            <Input name="edit_email" />
          </Form.Item>
          <Form.Item name="role_id" label="角色">
            <Select placeholder={roleLoadError ? '角色加载失败，暂不可选' : '选择角色'} allowClear options={roleOptions} disabled={Boolean(roleLoadError)} />
          </Form.Item>
        </Form>
      </Modal>

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
