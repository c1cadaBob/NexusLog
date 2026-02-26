import React, { useState, useMemo, useCallback } from 'react';
import { Input, Select, Table, Tag, Button, Card, Space, Modal, Form, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useThemeStore } from '../../stores/themeStore';
import { COLORS, DARK_PALETTE, LIGHT_PALETTE } from '../../theme/tokens';

// ============================================================================
// 类型定义
// ============================================================================

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  lastLogin: string;
  status: 'Active' | 'Disabled';
  avatar: string;
}

// ============================================================================
// 模拟数据
// ============================================================================

const roleOptions = ['Admin', 'SRE', 'Developer', 'Viewer'];

const initialUsers: User[] = [
  { id: '84920', name: '王伟 (Wang Wei)', email: 'wang.wei@company.com', role: 'Admin', lastLogin: '2023-10-24 09:30', status: 'Active', avatar: 'https://ui-avatars.com/api/?name=Wang+Wei&background=6366f1&color=fff' },
  { id: '84921', name: '李娜 (Li Na)', email: 'li.na@company.com', role: 'SRE', lastLogin: '2023-10-23 18:45', status: 'Active', avatar: 'https://ui-avatars.com/api/?name=Li+Na&background=f97316&color=fff' },
  { id: '84899', name: '张强 (Zhang Qiang)', email: 'zhang.q@company.com', role: 'Developer', lastLogin: '2023-09-15 10:00', status: 'Disabled', avatar: 'https://ui-avatars.com/api/?name=Zhang+Qiang&background=64748b&color=fff' },
  { id: '84905', name: '刘燕 (Liu Yan)', email: 'liu.y@company.com', role: 'Developer', lastLogin: '2023-10-20 14:20', status: 'Active', avatar: 'https://ui-avatars.com/api/?name=Liu+Yan&background=10b981&color=fff' },
  { id: '84933', name: '陈博 (Chen Bo)', email: 'chen.bo@company.com', role: 'SRE', lastLogin: '2023-10-24 11:15', status: 'Active', avatar: 'https://ui-avatars.com/api/?name=Chen+Bo&background=3b82f6&color=fff' },
];

// ============================================================================
// 角色颜色映射
// ============================================================================

const roleColorMap: Record<string, string> = {
  Admin: 'purple',
  SRE: 'blue',
  Developer: 'default',
  Viewer: 'cyan',
};

// ============================================================================
// 组件
// ============================================================================

const UserManagement: React.FC = () => {
  const isDark = useThemeStore((s) => s.isDark);
  const palette = isDark ? DARK_PALETTE : LIGHT_PALETTE;

  const [users, setUsers] = useState<User[]>(initialUsers);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [form] = Form.useForm();

  // 过滤用户
  const filteredUsers = useMemo(() => users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = !roleFilter || user.role === roleFilter;
    const matchesStatus = !statusFilter || user.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  }), [users, searchTerm, roleFilter, statusFilter]);

  // 创建用户
  const handleCreateUser = useCallback(() => {
    form.validateFields().then(values => {
      const newUser: User = {
        id: String(Date.now()),
        name: values.name,
        email: values.email,
        role: values.role,
        lastLogin: '-',
        status: 'Active',
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(values.name)}&background=random&color=fff`,
      };
      setUsers(prev => [...prev, newUser]);
      setIsCreateModalOpen(false);
      form.resetFields();
      message.success('用户创建成功');
    });
  }, [form]);

  // 编辑用户
  const handleEditUser = useCallback(() => {
    if (!currentUser) return;
    form.validateFields().then(values => {
      setUsers(prev => prev.map(u => u.id === currentUser.id ? { ...u, name: values.name, email: values.email, role: values.role } : u));
      setIsEditModalOpen(false);
      setCurrentUser(null);
      form.resetFields();
      message.success('用户信息已更新');
    });
  }, [currentUser, form]);

  // 删除用户
  const handleDeleteUser = useCallback(() => {
    if (!currentUser) return;
    setUsers(prev => prev.filter(u => u.id !== currentUser.id));
    setIsDeleteModalOpen(false);
    setCurrentUser(null);
    message.success('用户已删除');
  }, [currentUser]);

  // 切换用户状态
  const handleToggleStatus = useCallback((userId: string) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: u.status === 'Active' ? 'Disabled' : 'Active' } : u));
  }, []);

  // 打开编辑模态框
  const openEditModal = useCallback((user: User) => {
    setCurrentUser(user);
    form.setFieldsValue({ name: user.name, email: user.email, role: user.role });
    setIsEditModalOpen(true);
  }, [form]);

  // 打开删除模态框
  const openDeleteModal = useCallback((user: User) => {
    setCurrentUser(user);
    setIsDeleteModalOpen(true);
  }, []);

  // 表格列定义
  const columns: ColumnsType<User> = [
    {
      title: '用户 (USER)',
      dataIndex: 'name',
      key: 'name',
      render: (_, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img
            alt={`${record.name} Avatar`}
            src={record.avatar}
            style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: `1px solid ${palette.border}` }}
          />
          <div>
            <div style={{ fontWeight: 500 }}>{record.name}</div>
            <div style={{ fontSize: 12, color: palette.textSecondary, fontFamily: 'JetBrains Mono, monospace' }}>ID: {record.id}</div>
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
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => <Tag color={roleColorMap[role] || 'default'}>{role}</Tag>,
    },
    {
      title: '最后登录 (LAST LOGIN)',
      dataIndex: 'lastLogin',
      key: 'lastLogin',
      render: (text: string) => <span style={{ fontFamily: 'JetBrains Mono, monospace', color: palette.textSecondary }}>{text}</span>,
    },
    {
      title: '状态 (STATUS)',
      dataIndex: 'status',
      key: 'status',
      align: 'center',
      render: (status: string) => (
        <Tag color={status === 'Active' ? 'success' : 'error'}>
          {status === 'Active' ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '操作 (ACTIONS)',
      key: 'actions',
      align: 'right',
      render: (_, record) => (
        <Space size={4}>
          <Button type="text" size="small" title="编辑用户" onClick={() => openEditModal(record)}
            icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit</span>} />
          <Button type="text" size="small" title={record.status === 'Active' ? '禁用用户' : '启用用户'} onClick={() => handleToggleStatus(record.id)}
            icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>{record.status === 'Active' ? 'block' : 'check_circle'}</span>} />
          <Button type="text" size="small" danger title="删除用户" onClick={() => openDeleteModal(record)}
            icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>} />
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* 顶部栏 */}
      <div style={{ padding: '16px 24px', borderBottom: `1px solid ${palette.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, background: isDark ? '#111722' : palette.bgContainer }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: palette.textSecondary, marginBottom: 4 }}>
            <span>安全与审计</span>
            <span className="material-symbols-outlined" style={{ fontSize: 10 }}>chevron_right</span>
            <span style={{ color: COLORS.primary, fontWeight: 500 }}>用户管理</span>
          </div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>用户管理</h2>
        </div>
        <Space>
          <Button icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>download</span>}>导出</Button>
          <Button type="primary" onClick={() => { form.resetFields(); setIsCreateModalOpen(true); }}
            icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>}
          >新增用户</Button>
        </Space>
      </div>

      {/* 筛选栏 */}
      <div style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, background: isDark ? palette.bgContainer : '#fff', borderBottom: `1px solid ${palette.border}` }}>
        <Input
          prefix={<span className="material-symbols-outlined" style={{ fontSize: 18, color: palette.textSecondary }}>search</span>}
          placeholder="按用户名、邮箱搜索..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{ width: 280 }}
          allowClear
        />
        <Select
          placeholder="所有角色"
          value={roleFilter}
          onChange={v => setRoleFilter(v)}
          allowClear
          style={{ width: 140 }}
          options={roleOptions.map(r => ({ value: r, label: r }))}
        />
        <Select
          placeholder="所有状态"
          value={statusFilter}
          onChange={v => setStatusFilter(v)}
          allowClear
          style={{ width: 140 }}
          options={[{ value: 'Active', label: '启用' }, { value: 'Disabled', label: '禁用' }]}
        />
      </div>

      {/* 表格 */}
      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        <Table<User>
          columns={columns}
          dataSource={filteredUsers}
          rowKey="id"
          size="middle"
          pagination={{
            showTotal: (total, range) => `显示 ${range[0]} 到 ${range[1]} 条，共 ${total} 条记录`,
            pageSize: 10,
            showSizeChanger: false,
          }}
        />
      </div>

      {/* 创建用户模态框 */}
      <Modal
        open={isCreateModalOpen}
        title="新增用户"
        onCancel={() => { setIsCreateModalOpen(false); form.resetFields(); }}
        onOk={handleCreateUser}
        okText="创建"
        cancelText="取消"
        width={480}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input placeholder="输入用户名" />
          </Form.Item>
          <Form.Item name="email" label="邮箱" rules={[{ required: true, message: '请输入邮箱地址' }, { type: 'email', message: '请输入有效的邮箱地址' }]}>
            <Input placeholder="输入邮箱地址" />
          </Form.Item>
          <Form.Item name="role" label="角色" initialValue="Developer">
            <Select options={roleOptions.map(r => ({ value: r, label: r }))} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑用户模态框 */}
      <Modal
        open={isEditModalOpen}
        title="编辑用户"
        onCancel={() => { setIsEditModalOpen(false); setCurrentUser(null); form.resetFields(); }}
        onOk={handleEditUser}
        okText="保存"
        cancelText="取消"
        width={480}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="邮箱" rules={[{ required: true, message: '请输入邮箱地址' }, { type: 'email', message: '请输入有效的邮箱地址' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="role" label="角色">
            <Select options={roleOptions.map(r => ({ value: r, label: r }))} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 删除确认模态框 */}
      <Modal
        open={isDeleteModalOpen}
        title="确认删除"
        onCancel={() => { setIsDeleteModalOpen(false); setCurrentUser(null); }}
        onOk={handleDeleteUser}
        okText="删除"
        cancelText="取消"
        okButtonProps={{ danger: true }}
        width={420}
      >
        <p style={{ color: palette.textSecondary }}>
          确定要删除用户 <span style={{ fontWeight: 500, color: palette.text }}>{currentUser?.name}</span> 吗？此操作不可撤销。
        </p>
      </Modal>
    </div>
  );
};

export default UserManagement;
