/**
 * 用户管理页面
 *
 * 提供用户管理功能：
 * - 用户列表展示（Ant Design Table + Modal）
 * - 创建/编辑/删除用户
 * - 启用/禁用用户
 * - 按角色/状态过滤和搜索
 * - 统计卡片
 *
 * @requirements 9.4
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Card,
  Table,
  Tag,
  Space,
  Button,
  Input,
  Select,
  Modal,
  Form,
  Statistic,
  Row,
  Col,
  Typography,
  Switch,
  Avatar,
  message,
  Popconfirm,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  UserOutlined,
  TeamOutlined,
  SafetyOutlined,
  StopOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { UserRole } from '@/types/user';

const { Text } = Typography;

// ============================================================================
// 本地类型
// ============================================================================

interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  lastLogin: string;
  status: 'active' | 'disabled';
}

// ============================================================================
// 模拟数据
// ============================================================================

const mockUsers: UserRecord[] = [
  { id: '84920', name: '王伟', email: 'wang.wei@company.com', role: 'admin', lastLogin: '2024-03-15 09:30', status: 'active' },
  { id: '84921', name: '李娜', email: 'li.na@company.com', role: 'operator', lastLogin: '2024-03-14 18:45', status: 'active' },
  { id: '84899', name: '张强', email: 'zhang.q@company.com', role: 'user', lastLogin: '2024-02-20 10:00', status: 'disabled' },
  { id: '84905', name: '刘燕', email: 'liu.y@company.com', role: 'user', lastLogin: '2024-03-12 14:20', status: 'active' },
  { id: '84933', name: '陈博', email: 'chen.bo@company.com', role: 'operator', lastLogin: '2024-03-15 11:15', status: 'active' },
  { id: '84940', name: '赵敏', email: 'zhao.m@company.com', role: 'viewer', lastLogin: '2024-03-10 08:30', status: 'active' },
];

const roleOptions: { label: string; value: UserRole }[] = [
  { label: '管理员', value: 'admin' },
  { label: '操作员', value: 'operator' },
  { label: '普通用户', value: 'user' },
  { label: '只读用户', value: 'viewer' },
];

const roleTagColor: Record<UserRole, string> = {
  admin: 'purple',
  operator: 'blue',
  user: 'green',
  viewer: 'default',
};

const roleLabel: Record<UserRole, string> = {
  admin: '管理员',
  operator: '操作员',
  user: '普通用户',
  viewer: '只读用户',
};

// ============================================================================
// 表单接口
// ============================================================================

interface UserFormValues {
  name: string;
  email: string;
  role: UserRole;
}

// ============================================================================
// 主组件
// ============================================================================

export const UserManagementPage: React.FC = () => {
  const [users, setUsers] = useState<UserRecord[]>(mockUsers);
  const [searchText, setSearchText] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'active' | 'disabled' | 'all'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [form] = Form.useForm<UserFormValues>();

  // 过滤
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      if (searchText) {
        const q = searchText.toLowerCase();
        if (!user.name.toLowerCase().includes(q) && !user.email.toLowerCase().includes(q)) return false;
      }
      if (roleFilter !== 'all' && user.role !== roleFilter) return false;
      if (statusFilter !== 'all' && user.status !== statusFilter) return false;
      return true;
    });
  }, [users, searchText, roleFilter, statusFilter]);

  // 统计
  const stats = useMemo(() => ({
    total: users.length,
    active: users.filter(u => u.status === 'active').length,
    admin: users.filter(u => u.role === 'admin').length,
    disabled: users.filter(u => u.status === 'disabled').length,
  }), [users]);

  // 打开创建/编辑模态框
  const openModal = useCallback((user?: UserRecord) => {
    if (user) {
      setEditingUser(user);
      form.setFieldsValue({ name: user.name, email: user.email, role: user.role });
    } else {
      setEditingUser(null);
      form.resetFields();
    }
    setModalOpen(true);
  }, [form]);

  // 提交表单
  const handleSubmit = useCallback(async () => {
    try {
      const values = await form.validateFields();
      if (editingUser) {
        setUsers(prev => prev.map(u => u.id === editingUser.id ? { ...u, ...values } : u));
        message.success(`用户 "${values.name}" 已更新`);
      } else {
        const newUser: UserRecord = {
          id: `user-${Date.now()}`,
          ...values,
          lastLogin: '-',
          status: 'active',
        };
        setUsers(prev => [...prev, newUser]);
        message.success(`用户 "${values.name}" 已创建`);
      }
      setModalOpen(false);
    } catch { /* validation error */ }
  }, [form, editingUser]);

  // 删除用户
  const handleDelete = useCallback((user: UserRecord) => {
    setUsers(prev => prev.filter(u => u.id !== user.id));
    message.success(`用户 "${user.name}" 已删除`);
  }, []);

  // 切换启用/禁用
  const toggleStatus = useCallback((user: UserRecord) => {
    const newStatus = user.status === 'active' ? 'disabled' : 'active';
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: newStatus } : u));
    message.success(`用户 "${user.name}" 已${newStatus === 'active' ? '启用' : '禁用'}`);
  }, []);

  // 表格列
  const columns: ColumnsType<UserRecord> = useMemo(() => [
    {
      title: '用户',
      key: 'user',
      render: (_, record) => (
        <Space>
          <Avatar style={{ backgroundColor: record.role === 'admin' ? '#722ed1' : '#1677ff' }} icon={<UserOutlined />} />
          <div>
            <Text strong>{record.name}</Text>
            <div><Text type="secondary" style={{ fontSize: 12 }}>ID: {record.id}</Text></div>
          </div>
        </Space>
      ),
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      width: 220,
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 120,
      render: (role: UserRole) => <Tag color={roleTagColor[role]}>{roleLabel[role]}</Tag>,
    },
    {
      title: '最后登录',
      dataIndex: 'lastLogin',
      key: 'lastLogin',
      width: 160,
      render: (v: string) => <Text type="secondary" style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={status === 'active' ? 'success' : 'default'}>
          {status === 'active' ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      render: (_, record) => (
        <Space size="small">
          <Switch
            size="small"
            checked={record.status === 'active'}
            onChange={() => toggleStatus(record)}
          />
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openModal(record)} />
          <Popconfirm
            title={`确定删除用户 "${record.name}"？`}
            onConfirm={() => handleDelete(record)}
            okText="删除"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ], [toggleStatus, openModal, handleDelete]);

  return (
    <div>
      {/* 页面标题 */}
      <div style={{ marginBottom: 16 }}>
        <Space align="center" style={{ marginBottom: 4 }}>
          <Typography.Title level={4} style={{ margin: 0 }}>用户管理</Typography.Title>
          <Tag color="blue">安全审计</Tag>
        </Space>
        <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
          管理系统用户账号、角色分配和访问状态
        </Typography.Paragraph>
      </div>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card size="small"><Statistic title="总用户数" value={stats.total} prefix={<TeamOutlined />} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small"><Statistic title="活跃用户" value={stats.active} valueStyle={{ color: '#52c41a' }} prefix={<UserOutlined />} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small"><Statistic title="管理员" value={stats.admin} valueStyle={{ color: '#722ed1' }} prefix={<SafetyOutlined />} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small"><Statistic title="已禁用" value={stats.disabled} prefix={<StopOutlined />} /></Card>
        </Col>
      </Row>

      {/* 过滤器 */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col flex="auto">
            <Input placeholder="按用户名、邮箱搜索..." prefix={<SearchOutlined />} value={searchText} onChange={e => setSearchText(e.target.value)} allowClear />
          </Col>
          <Col>
            <Select value={roleFilter} onChange={setRoleFilter} style={{ width: 130 }} options={[
              { label: '所有角色', value: 'all' },
              ...roleOptions,
            ]} />
          </Col>
          <Col>
            <Select value={statusFilter} onChange={setStatusFilter} style={{ width: 120 }} options={[
              { label: '所有状态', value: 'all' },
              { label: '启用', value: 'active' },
              { label: '禁用', value: 'disabled' },
            ]} />
          </Col>
          <Col>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>新增用户</Button>
          </Col>
        </Row>
      </Card>

      {/* 用户表格 */}
      <Card>
        <Table<UserRecord>
          columns={columns}
          dataSource={filteredUsers}
          rowKey="id"
          pagination={{ showSizeChanger: true, showTotal: (total, range) => `显示 ${range[0]}-${range[1]} 条，共 ${total} 条` }}
          scroll={{ x: 900 }}
          size="middle"
        />
      </Card>

      {/* 创建/编辑模态框 */}
      <Modal
        title={editingUser ? '编辑用户' : '新增用户'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        okText={editingUser ? '保存' : '创建'}
        cancelText="取消"
        destroyOnClose
      >
        <Form form={form} layout="vertical" initialValues={{ role: 'user' }}>
          <Form.Item name="name" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input placeholder="输入用户名" />
          </Form.Item>
          <Form.Item name="email" label="邮箱" rules={[{ required: true, message: '请输入邮箱' }, { type: 'email', message: '请输入有效的邮箱地址' }]}>
            <Input placeholder="输入邮箱地址" />
          </Form.Item>
          <Form.Item name="role" label="角色">
            <Select options={roleOptions} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default UserManagementPage;
