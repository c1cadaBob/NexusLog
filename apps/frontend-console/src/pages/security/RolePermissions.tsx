import React, { useState, useMemo, useCallback } from 'react';
import { Input, Table, Tag, Button, Card, Space, Modal, Form, Checkbox, Statistic, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useThemeStore } from '../../stores/themeStore';
import { COLORS, DARK_PALETTE, LIGHT_PALETTE } from '../../theme/tokens';

// ============================================================================
// 类型定义
// ============================================================================

interface Permission {
  id: string;
  name: string;
  description: string;
  category: string;
}

interface Role {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  permissions: string[];
  icon: string;
  color: string;
}

// ============================================================================
// 模拟数据
// ============================================================================

const allPermissions: Permission[] = [
  { id: 'dashboard_view', name: '仪表盘查看', description: '查看系统仪表盘', category: '仪表盘' },
  { id: 'dashboard_edit', name: '仪表盘编辑', description: '编辑仪表盘配置', category: '仪表盘' },
  { id: 'logs_view', name: '日志查看', description: '查看系统日志', category: '日志' },
  { id: 'logs_export', name: '日志导出', description: '导出日志数据', category: '日志' },
  { id: 'alerts_view', name: '告警查看', description: '查看告警信息', category: '告警' },
  { id: 'alerts_manage', name: '告警管理', description: '创建和管理告警规则', category: '告警' },
  { id: 'users_view', name: '用户查看', description: '查看用户列表', category: '用户管理' },
  { id: 'users_manage', name: '用户管理', description: '创建、编辑、删除用户', category: '用户管理' },
  { id: 'roles_manage', name: '角色管理', description: '管理角色和权限', category: '用户管理' },
  { id: 'system_config', name: '系统配置', description: '修改系统配置', category: '系统' },
  { id: 'audit_view', name: '审计日志', description: '查看审计日志', category: '系统' },
];

const initialRoles: Role[] = [
  { id: '001', name: '超级管理员', description: '拥有系统的所有操作权限，包括用户管理、系统配置及数据删除。', memberCount: 3, permissions: allPermissions.map(p => p.id), icon: 'admin_panel_settings', color: 'purple' },
  { id: '002', name: '日志审计员', description: '负责审查安全日志和操作记录，无系统配置权限。', memberCount: 8, permissions: ['logs_view', 'logs_export', 'audit_view'], icon: 'security', color: 'blue' },
  { id: '003', name: '运维人员', description: '监控系统运行状态和告警，可重启非核心服务。', memberCount: 12, permissions: ['dashboard_view', 'logs_view', 'alerts_view', 'alerts_manage'], icon: 'engineering', color: 'orange' },
  { id: '004', name: '开发人员', description: '查看应用日志用于调试，无法访问敏感安全日志。', memberCount: 25, permissions: ['dashboard_view', 'logs_view'], icon: 'code', color: 'default' },
  { id: '005', name: '访客', description: '仅限查看公开仪表盘，无权进行任何修改。', memberCount: 0, permissions: ['dashboard_view'], icon: 'person', color: 'default' },
];

// ============================================================================
// 辅助函数
// ============================================================================

const iconColorMap: Record<string, { bg: string; text: string }> = {
  purple: { bg: 'rgba(139,92,246,0.15)', text: '#a78bfa' },
  blue: { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa' },
  orange: { bg: 'rgba(249,115,22,0.15)', text: '#fb923c' },
  default: { bg: 'rgba(100,116,139,0.15)', text: '#94a3b8' },
};

const getPermissionTags = (permissions: string[]) => {
  if (permissions.length === allPermissions.length) return [{ label: '完全控制', color: 'error' as const }];
  if (permissions.length === 0) return [{ label: '无权限', color: 'default' as const }];
  const categories = [...new Set(allPermissions.filter(p => permissions.includes(p.id)).map(p => p.category))];
  return categories.slice(0, 3).map(cat => ({ label: cat, color: 'processing' as const }));
};

// 按分类分组权限
const groupedPermissions = allPermissions.reduce<Record<string, Permission[]>>((acc, p) => {
  if (!acc[p.category]) acc[p.category] = [];
  acc[p.category].push(p);
  return acc;
}, {});

// ============================================================================
// 组件
// ============================================================================

const RolePermissions: React.FC = () => {
  const isDark = useThemeStore((s) => s.isDark);
  const palette = isDark ? DARK_PALETTE : LIGHT_PALETTE;

  const [roles, setRoles] = useState<Role[]>(initialRoles);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [currentRole, setCurrentRole] = useState<Role | null>(null);
  const [form] = Form.useForm();
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  const filteredRoles = useMemo(() => roles.filter(role =>
    role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    role.description.toLowerCase().includes(searchTerm.toLowerCase())
  ), [roles, searchTerm]);

  const handleCreateRole = useCallback(() => {
    form.validateFields().then(values => {
      const newRole: Role = {
        id: String(Date.now()),
        name: values.name,
        description: values.description || '',
        memberCount: 0,
        permissions: selectedPermissions,
        icon: 'badge',
        color: 'blue',
      };
      setRoles(prev => [...prev, newRole]);
      setIsCreateModalOpen(false);
      form.resetFields();
      setSelectedPermissions([]);
      message.success('角色创建成功');
    });
  }, [form, selectedPermissions]);

  const handleEditRole = useCallback(() => {
    if (!currentRole) return;
    form.validateFields().then(values => {
      setRoles(prev => prev.map(r => r.id === currentRole.id ? { ...r, name: values.name, description: values.description || '', permissions: selectedPermissions } : r));
      setIsEditModalOpen(false);
      setCurrentRole(null);
      form.resetFields();
      setSelectedPermissions([]);
      message.success('角色已更新');
    });
  }, [currentRole, form, selectedPermissions]);

  const handleDeleteRole = useCallback(() => {
    if (!currentRole) return;
    setRoles(prev => prev.filter(r => r.id !== currentRole.id));
    setIsDeleteModalOpen(false);
    setCurrentRole(null);
    message.success('角色已删除');
  }, [currentRole]);

  const openEditModal = useCallback((role: Role) => {
    setCurrentRole(role);
    form.setFieldsValue({ name: role.name, description: role.description });
    setSelectedPermissions(role.permissions);
    setIsEditModalOpen(true);
  }, [form]);

  const openDeleteModal = useCallback((role: Role) => {
    setCurrentRole(role);
    setIsDeleteModalOpen(true);
  }, []);

  const columns: ColumnsType<Role> = [
    {
      title: '角色名称',
      dataIndex: 'name',
      key: 'name',
      width: '20%',
      render: (_, record) => {
        const colors = iconColorMap[record.color] || iconColorMap.default;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: colors.bg, color: colors.text, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{record.icon}</span>
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
      render: (text: string) => <span style={{ color: palette.textSecondary, fontSize: 13 }}>{text}</span>,
    },
    {
      title: '成员数量',
      dataIndex: 'memberCount',
      key: 'memberCount',
      width: '15%',
      render: (count: number) => <span style={{ fontWeight: 700, fontSize: 16 }}>{count}</span>,
    },
    {
      title: '权限范围',
      key: 'permissions',
      width: '25%',
      render: (_, record) => (
        <Space size={4} wrap>
          {getPermissionTags(record.permissions).map((tag, idx) => (
            <Tag key={idx} color={tag.color}>{tag.label}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: '10%',
      align: 'right',
      render: (_, record) => (
        <Space size={4}>
          <Button type="text" size="small" title="编辑" onClick={() => openEditModal(record)}
            icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit</span>} />
          <Button type="text" size="small" danger title="删除" onClick={() => openDeleteModal(record)}
            icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>} />
        </Space>
      ),
    },
  ];

  // 权限选择器渲染
  const renderPermissionSelector = () => (
    <div style={{ maxHeight: 240, overflowY: 'auto', border: `1px solid ${palette.border}`, borderRadius: 8, padding: 12 }}>
      {Object.entries(groupedPermissions).map(([category, perms]) => (
        <div key={category} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: palette.textSecondary, textTransform: 'uppercase', marginBottom: 6 }}>{category}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            {perms.map(perm => (
              <Checkbox
                key={perm.id}
                checked={selectedPermissions.includes(perm.id)}
                onChange={e => {
                  setSelectedPermissions(prev =>
                    e.target.checked ? [...prev, perm.id] : prev.filter(p => p !== perm.id)
                  );
                }}
              >{perm.name}</Checkbox>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* 顶部栏 */}
      <div style={{ padding: '16px 24px', borderBottom: `1px solid ${palette.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexShrink: 0, background: isDark ? '#111722' : palette.bgContainer }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>角色权限</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: palette.textSecondary }}>管理用户角色及对应的功能模块访问权限</p>
        </div>
        <Space>
          <Input
            prefix={<span className="material-symbols-outlined" style={{ fontSize: 18, color: palette.textSecondary }}>search</span>}
            placeholder="搜索角色..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ width: 220 }}
            allowClear
          />
          <Button type="primary" onClick={() => { form.resetFields(); setSelectedPermissions([]); setIsCreateModalOpen(true); }}
            icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>}
          >创建角色</Button>
        </Space>
      </div>

      {/* 统计卡片 */}
      <div style={{ padding: '16px 24px 0', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, flexShrink: 0 }}>
        <Card size="small" style={{ background: palette.bgContainer, borderColor: palette.border }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Statistic title={<span style={{ color: palette.textSecondary }}>总角色数</span>} value={roles.length} valueStyle={{ fontSize: 28, fontWeight: 700 }} />
            <div style={{ padding: 8, borderRadius: 8, background: `${COLORS.primary}15`, color: COLORS.primary }}>
              <span className="material-symbols-outlined">badge</span>
            </div>
          </div>
        </Card>
        <Card size="small" style={{ background: palette.bgContainer, borderColor: palette.border }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Statistic title={<span style={{ color: palette.textSecondary }}>活跃用户</span>} value={roles.reduce((sum, r) => sum + r.memberCount, 0)} valueStyle={{ fontSize: 28, fontWeight: 700 }} />
            <div style={{ padding: 8, borderRadius: 8, background: `${COLORS.success}15`, color: COLORS.success }}>
              <span className="material-symbols-outlined">group</span>
            </div>
          </div>
        </Card>
        <Card size="small" style={{ background: palette.bgContainer, borderColor: palette.border }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Statistic title={<span style={{ color: palette.textSecondary }}>权限项</span>} value={allPermissions.length} valueStyle={{ fontSize: 28, fontWeight: 700 }} />
            <div style={{ padding: 8, borderRadius: 8, background: `${COLORS.warning}15`, color: COLORS.warning }}>
              <span className="material-symbols-outlined">key</span>
            </div>
          </div>
        </Card>
      </div>

      {/* 表格 */}
      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        <Table<Role>
          columns={columns}
          dataSource={filteredRoles}
          rowKey="id"
          size="middle"
          pagination={{
            showTotal: (total, range) => `显示 ${range[0]} 到 ${range[1]}，共 ${total} 条`,
            pageSize: 10,
            showSizeChanger: false,
          }}
        />
      </div>

      {/* 创建角色模态框 */}
      <Modal
        open={isCreateModalOpen}
        title="创建角色"
        onCancel={() => { setIsCreateModalOpen(false); form.resetFields(); setSelectedPermissions([]); }}
        onOk={handleCreateRole}
        okText="创建"
        cancelText="取消"
        width={560}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="角色名称" rules={[{ required: true, message: '请输入角色名称' }]}>
            <Input placeholder="输入角色名称" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea placeholder="输入角色描述" rows={2} />
          </Form.Item>
          <Form.Item label="权限配置">
            {renderPermissionSelector()}
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑角色模态框 */}
      <Modal
        open={isEditModalOpen}
        title="编辑角色"
        onCancel={() => { setIsEditModalOpen(false); setCurrentRole(null); form.resetFields(); setSelectedPermissions([]); }}
        onOk={handleEditRole}
        okText="保存"
        cancelText="取消"
        width={560}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="角色名称" rules={[{ required: true, message: '请输入角色名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item label="权限配置">
            {renderPermissionSelector()}
          </Form.Item>
        </Form>
      </Modal>

      {/* 删除确认模态框 */}
      <Modal
        open={isDeleteModalOpen}
        title="确认删除"
        onCancel={() => { setIsDeleteModalOpen(false); setCurrentRole(null); }}
        onOk={handleDeleteRole}
        okText="删除"
        cancelText="取消"
        okButtonProps={{ danger: true }}
        width={420}
      >
        <p style={{ color: palette.textSecondary }}>
          确定要删除角色 <span style={{ fontWeight: 500, color: palette.text }}>{currentRole?.name}</span> 吗？此操作不可撤销。
        </p>
      </Modal>
    </div>
  );
};

export default RolePermissions;
