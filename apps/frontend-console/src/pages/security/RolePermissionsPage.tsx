/**
 * 角色权限页面
 *
 * 提供角色权限管理功能：
 * - 角色列表展示（Ant Design Table）
 * - 创建/编辑/删除角色
 * - 权限分配（按分类的 Checkbox 组）
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
  Modal,
  Form,
  Statistic,
  Row,
  Col,
  Typography,
  Checkbox,
  message,
  Popconfirm,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  SafetyOutlined,
  TeamOutlined,
  KeyOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { Text } = Typography;
const { TextArea } = Input;

interface PermissionItem {
  id: string;
  name: string;
  category: string;
}

interface RoleRecord {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  permissions: string[];
}

const allPermissions: PermissionItem[] = [
  { id: 'dashboard_view', name: '仪表盘查看', category: '仪表盘' },
  { id: 'dashboard_edit', name: '仪表盘编辑', category: '仪表盘' },
  { id: 'logs_view', name: '日志查看', category: '日志' },
  { id: 'logs_export', name: '日志导出', category: '日志' },
  { id: 'alerts_view', name: '告警查看', category: '告警' },
  { id: 'alerts_manage', name: '告警管理', category: '告警' },
  { id: 'users_view', name: '用户查看', category: '用户管理' },
  { id: 'users_manage', name: '用户管理', category: '用户管理' },
  { id: 'roles_manage', name: '角色管理', category: '用户管理' },
  { id: 'system_config', name: '系统配置', category: '系统' },
  { id: 'audit_view', name: '审计日志', category: '系统' },
];

const permissionsByCategory = allPermissions.reduce<Record<string, PermissionItem[]>>((acc, p) => {
  const list = acc[p.category] ?? [];
  list.push(p);
  acc[p.category] = list;
  return acc;
}, {});

const mockRoles: RoleRecord[] = [
  { id: '001', name: '超级管理员', description: '拥有系统的所有操作权限', memberCount: 3, permissions: allPermissions.map(p => p.id) },
  { id: '002', name: '日志审计员', description: '负责审查安全日志和操作记录', memberCount: 8, permissions: ['logs_view', 'logs_export', 'audit_view'] },
  { id: '003', name: '运维人员', description: '监控系统运行状态和告警', memberCount: 12, permissions: ['dashboard_view', 'logs_view', 'alerts_view', 'alerts_manage'] },
  { id: '004', name: '开发人员', description: '查看应用日志用于调试', memberCount: 25, permissions: ['dashboard_view', 'logs_view'] },
  { id: '005', name: '访客', description: '仅限查看公开仪表盘', memberCount: 0, permissions: ['dashboard_view'] },
];

interface RoleFormValues {
  name: string;
  description?: string;
  permissions: string[];
}

export const RolePermissionsPage: React.FC = () => {
  const [roles, setRoles] = useState<RoleRecord[]>(mockRoles);
  const [searchText, setSearchText] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleRecord | null>(null);
  const [form] = Form.useForm<RoleFormValues>();

  const filteredRoles = useMemo(() => {
    if (!searchText) return roles;
    const q = searchText.toLowerCase();
    return roles.filter(r => r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q));
  }, [roles, searchText]);

  const stats = useMemo(() => ({
    total: roles.length,
    totalMembers: roles.reduce((sum, r) => sum + r.memberCount, 0),
    totalPermissions: allPermissions.length,
  }), [roles]);

  const getPermissionSummary = useCallback((permissions: string[]) => {
    if (permissions.length === allPermissions.length) return [{ label: '完全控制', color: 'red' }];
    if (permissions.length === 0) return [{ label: '无权限', color: 'default' }];
    const categories = [...new Set(allPermissions.filter(p => permissions.includes(p.id)).map(p => p.category))];
    return categories.slice(0, 3).map(cat => ({ label: cat, color: 'blue' as const }));
  }, []);

  const openModal = useCallback((role?: RoleRecord) => {
    if (role) {
      setEditingRole(role);
      form.setFieldsValue({ name: role.name, description: role.description, permissions: role.permissions });
    } else {
      setEditingRole(null);
      form.resetFields();
    }
    setModalOpen(true);
  }, [form]);

  const handleSubmit = useCallback(async () => {
    try {
      const values = await form.validateFields();
      if (editingRole) {
        setRoles(prev => prev.map(r => r.id === editingRole.id ? { ...r, ...values } : r));
        message.success(`角色 "${values.name}" 已更新`);
      } else {
        const newRole: RoleRecord = {
          id: `role-${Date.now()}`,
          name: values.name,
          description: values.description || '',
          memberCount: 0,
          permissions: values.permissions || [],
        };
        setRoles(prev => [...prev, newRole]);
        message.success(`角色 "${values.name}" 已创建`);
      }
      setModalOpen(false);
    } catch { /* validation error */ }
  }, [form, editingRole]);

  const handleDelete = useCallback((role: RoleRecord) => {
    setRoles(prev => prev.filter(r => r.id !== role.id));
    message.success(`角色 "${role.name}" 已删除`);
  }, []);

  const columns: ColumnsType<RoleRecord> = useMemo(() => [
    {
      title: '角色名称', key: 'name',
      render: (_: unknown, role: RoleRecord) => (
        <div>
          <Text strong>{role.name}</Text>
          {role.description && <div><Text type="secondary" style={{ fontSize: 12 }}>{role.description}</Text></div>}
        </div>
      ),
    },
    { title: '成员数量', dataIndex: 'memberCount', key: 'memberCount', width: 120, sorter: (a: RoleRecord, b: RoleRecord) => a.memberCount - b.memberCount },
    {
      title: '权限范围', key: 'permissions', width: 260,
      render: (_: unknown, role: RoleRecord) => (
        <Space size={[4, 4]} wrap>
          {getPermissionSummary(role.permissions).map((tag, idx) => (
            <Tag key={idx} color={tag.color}>{tag.label}</Tag>
          ))}
          {role.permissions.length > 0 && role.permissions.length < allPermissions.length && (
            <Text type="secondary" style={{ fontSize: 12 }}>({role.permissions.length}/{allPermissions.length})</Text>
          )}
        </Space>
      ),
    },
    {
      title: '操作', key: 'actions', width: 120,
      render: (_: unknown, role: RoleRecord) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openModal(role)} />
          <Popconfirm title={`确定删除角色 "${role.name}"？`} onConfirm={() => handleDelete(role)} okText="删除" cancelText="取消">
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ], [getPermissionSummary, openModal, handleDelete]);

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Space align="center" style={{ marginBottom: 4 }}>
          <Typography.Title level={4} style={{ margin: 0 }}>角色权限</Typography.Title>
          <Tag color="blue">安全审计</Tag>
        </Space>
        <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
          管理用户角色及对应的功能模块访问权限
        </Typography.Paragraph>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card size="small"><Statistic title="总角色数" value={stats.total} prefix={<SafetyOutlined />} /></Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small"><Statistic title="活跃用户" value={stats.totalMembers} prefix={<TeamOutlined />} /></Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small"><Statistic title="权限项" value={stats.totalPermissions} prefix={<KeyOutlined />} /></Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col flex="auto">
            <Input placeholder="搜索角色名称或描述..." prefix={<SearchOutlined />} value={searchText} onChange={e => setSearchText(e.target.value)} allowClear />
          </Col>
          <Col>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>创建角色</Button>
          </Col>
        </Row>
      </Card>

      <Card>
        <Table<RoleRecord>
          columns={columns}
          dataSource={filteredRoles}
          rowKey="id"
          pagination={{ showSizeChanger: true, showTotal: (total: number, range: [number, number]) => `显示 ${range[0]}-${range[1]} 条，共 ${total} 条` }}
          scroll={{ x: 700 }}
          size="middle"
        />
      </Card>

      <Modal
        title={editingRole ? '编辑角色' : '创建角色'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        okText={editingRole ? '保存' : '创建'}
        cancelText="取消"
        width={600}
        destroyOnClose
      >
        <Form form={form} layout="vertical" initialValues={{ permissions: [] }}>
          <Form.Item name="name" label="角色名称" rules={[{ required: true, message: '请输入角色名称' }]}>
            <Input placeholder="输入角色名称" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={2} placeholder="输入角色描述" />
          </Form.Item>
          <Form.Item name="permissions" label="权限配置">
            <Checkbox.Group style={{ width: '100%' }}>
              {Object.entries(permissionsByCategory).map(([category, perms]) => (
                <div key={category} style={{ marginBottom: 12 }}>
                  <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>{category}</Text>
                  <Row>
                    {perms.map(perm => (
                      <Col span={12} key={perm.id}>
                        <Checkbox value={perm.id}>{perm.name}</Checkbox>
                      </Col>
                    ))}
                  </Row>
                </div>
              ))}
            </Checkbox.Group>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default RolePermissionsPage;
