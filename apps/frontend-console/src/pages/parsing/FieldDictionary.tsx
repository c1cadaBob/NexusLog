import React, { useState, useCallback, useMemo } from 'react';
import { Input, Select, Button, Table, Tag, Modal, Form, Space, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useThemeStore } from '../../stores/themeStore';
import { COLORS, DARK_PALETTE, LIGHT_PALETTE } from '../../theme/tokens';
import type { FieldDefinition, DictionaryFieldType } from '../../types/parsing';
import { DICTIONARY_FIELD_TYPES } from '../../types/parsing';

// ============================================================================
// 模拟数据
// ============================================================================

const initialFields: FieldDefinition[] = [
  { id: '1', name: 'client_ip', aliases: ['remote_addr', 'c_ip'], description: '客户端发起请求的IP地址，通常是用户真实IP。', type: 'IP', references: 14, verified: true },
  { id: '2', name: 'status_code', aliases: ['http_status', 'sc-status'], description: 'HTTP 响应状态码 (例如 200, 404, 500)。', type: 'Integer', references: 28, verified: true },
  { id: '3', name: 'user_agent', aliases: ['agent', 'ua', 'http_user_agent'], description: '浏览器或客户端标识字符串。', type: 'String', references: 10, verified: false },
  { id: '4', name: 'request_time', aliases: ['time_taken', 'duration'], description: '请求处理消耗的时间（毫秒）。', type: 'Float', references: 45, verified: false },
  { id: '5', name: 'method', aliases: ['http_method', 'verb'], description: 'HTTP 请求方法 (GET, POST, etc.)。', type: 'String', references: 32, verified: true },
  { id: '6', name: 'timestamp', aliases: ['@timestamp', 'time', 'datetime'], description: '日志记录的时间戳。', type: 'Timestamp', references: 56, verified: true },
  { id: '7', name: 'user_id', aliases: ['uid', 'userid'], description: '用户唯一标识符。', type: 'Integer', references: 23, verified: true },
  { id: '8', name: 'is_success', aliases: ['success', 'ok'], description: '请求是否成功的布尔标志。', type: 'Boolean', references: 8, verified: false },
];

// ============================================================================
// 组件
// ============================================================================

const FieldDictionary: React.FC = () => {
  const isDark = useThemeStore((s) => s.isDark);
  const palette = isDark ? DARK_PALETTE : LIGHT_PALETTE;

  const [fields, setFields] = useState<FieldDefinition[]>(initialFields);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingField, setEditingField] = useState<FieldDefinition | null>(null);
  const [addForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [aliasInput, setAliasInput] = useState('');
  const [aliases, setAliases] = useState<string[]>([]);

  // 过滤
  const filteredFields = useMemo(() => {
    return fields.filter(field => {
      const matchesSearch = !searchTerm ||
        field.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        field.aliases.some(a => a.toLowerCase().includes(searchTerm.toLowerCase())) ||
        field.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = !typeFilter || field.type === typeFilter;
      const matchesStatus = !statusFilter ||
        (statusFilter === 'active' && field.verified) ||
        (statusFilter === 'deprecated' && !field.verified);
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [fields, searchTerm, typeFilter, statusFilter]);

  // 添加别名
  const handleAddAlias = useCallback(() => {
    if (!aliasInput.trim()) return;
    setAliases(prev => [...prev, aliasInput.trim()]);
    setAliasInput('');
  }, [aliasInput]);

  const handleRemoveAlias = useCallback((alias: string) => {
    setAliases(prev => prev.filter(a => a !== alias));
  }, []);

  // 添加字段
  const handleAdd = useCallback(() => {
    addForm.validateFields().then(values => {
      const field: FieldDefinition = {
        id: Date.now().toString(),
        name: values.name,
        aliases: aliases,
        description: values.description || '',
        type: values.type,
        references: 0,
        verified: false,
      };
      setFields(prev => [...prev, field]);
      addForm.resetFields();
      setAliases([]);
      setAddModalOpen(false);
      message.success('字段已创建');
    });
  }, [addForm, aliases]);

  // 删除
  const handleDelete = useCallback((id: string) => {
    setFields(prev => prev.filter(f => f.id !== id));
    message.success('字段已删除');
  }, []);

  // 编辑
  const handleStartEdit = useCallback((field: FieldDefinition) => {
    setEditingField(field);
    editForm.setFieldsValue(field);
  }, [editForm]);

  const handleSaveEdit = useCallback(() => {
    if (!editingField) return;
    editForm.validateFields().then(values => {
      setFields(prev => prev.map(f => f.id === editingField.id ? { ...editingField, ...values } : f));
      setEditingField(null);
      message.success('字段已更新');
    });
  }, [editingField, editForm]);

  // 表格列
  const columns: ColumnsType<FieldDefinition> = [
    {
      title: '标准字段名',
      dataIndex: 'name',
      key: 'name',
      width: '22%',
      render: (name: string, record) => (
        <Space>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', color: COLORS.primary, fontWeight: 500 }}>{name}</span>
          {record.verified && (
            <span className="material-symbols-outlined" style={{ fontSize: 14, color: COLORS.success }} title="已验证标准">verified</span>
          )}
        </Space>
      ),
    },
    {
      title: '别名',
      dataIndex: 'aliases',
      key: 'aliases',
      width: '20%',
      render: (aliases: string[]) => (
        <Space size={4} wrap>
          {aliases.map(alias => (
            <Tag key={alias} style={{ fontSize: 11, margin: 0 }}>{alias}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      width: '28%',
      render: (desc: string) => <span style={{ color: palette.textSecondary }}>{desc}</span>,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: '10%',
      render: (type: DictionaryFieldType) => {
        const cfg = DICTIONARY_FIELD_TYPES.find(t => t.value === type);
        return <Tag color={cfg?.color || 'default'}>{type}</Tag>;
      },
    },
    {
      title: '引用',
      dataIndex: 'references',
      key: 'references',
      width: '8%',
      align: 'center',
      render: (refs: number) => <span style={{ fontWeight: 500 }}>{refs}</span>,
    },
    {
      title: '操作',
      key: 'actions',
      width: '12%',
      align: 'right',
      render: (_, record) => (
        <Space size={4}>
          <Button type="text" size="small" onClick={() => handleStartEdit(record)} title="编辑"
            icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit</span>} />
          <Button type="text" size="small" onClick={() => handleDelete(record.id)} title="删除"
            icon={<span className="material-symbols-outlined" style={{ fontSize: 18, color: COLORS.danger }}>delete</span>} />
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, height: '100%' }}>
      {/* 头部 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>字段字典</h2>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: palette.textSecondary }}>
            定义标准命名字段，确保不同日志源之间的一致性。
          </p>
        </div>
        <Space>
          <Button icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>upload</span>}>导入字典</Button>
          <Button type="primary" onClick={() => setAddModalOpen(true)}
            icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>}
          >新建字段</Button>
        </Space>
      </div>

      {/* 搜索与筛选 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, padding: 16, background: palette.bgContainer, borderRadius: 12, border: `1px solid ${palette.border}` }}>
        <Input
          id="field-dictionary-search"
          name="fieldDictionarySearch"
          prefix={<span className="material-symbols-outlined" style={{ fontSize: 20, color: palette.textSecondary }}>search</span>}
          placeholder="搜索字段名、别名或描述..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{ flex: 1, minWidth: 240 }}
          allowClear
        />
        <Select
          id="field-dictionary-type-filter"
          aria-label="字段数据类型筛选"
          value={typeFilter}
          onChange={setTypeFilter}
          style={{ minWidth: 140 }}
          options={[
            { value: '', label: '所有数据类型' },
            ...DICTIONARY_FIELD_TYPES.map(t => ({ value: t.value, label: t.value })),
          ]}
        />
        <Select
          id="field-dictionary-status-filter"
          aria-label="字段状态筛选"
          value={statusFilter}
          onChange={setStatusFilter}
          style={{ minWidth: 140 }}
          options={[
            { value: '', label: '所有状态' },
            { value: 'active', label: '已验证' },
            { value: 'deprecated', label: '未验证' },
          ]}
        />
      </div>

      {/* 字段表格 */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <Table<FieldDefinition>
          rowKey="id"
          columns={columns}
          dataSource={filteredFields}
          size="middle"
          pagination={{
            showSizeChanger: true,
            showTotal: (total, range) => `显示 ${range[0]} 到 ${range[1]} 条，共 ${total} 条`,
          }}
          scroll={{ x: 800 }}
        />
      </div>


      {/* 新建字段弹窗 */}
      <Modal
        open={addModalOpen}
        title="新建字段定义"
        onCancel={() => { setAddModalOpen(false); addForm.resetFields(); setAliases([]); }}
        onOk={handleAdd}
        okText="创建"
        cancelText="取消"
        destroyOnHidden
      >
        <Form form={addForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="字段名称" rules={[{ required: true, message: '请输入字段名称' }]}>
            <Input id="name" name="fieldDictionaryAddName" placeholder="例如: client_ip" style={{ fontFamily: 'JetBrains Mono, monospace' }} />
          </Form.Item>
          <Form.Item label="别名">
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <Input
                id="field-dictionary-add-alias"
                name="fieldDictionaryAddAlias"
                value={aliasInput}
                onChange={e => setAliasInput(e.target.value)}
                onPressEnter={handleAddAlias}
                placeholder="输入别名后按回车添加"
                style={{ flex: 1, fontFamily: 'JetBrains Mono, monospace' }}
              />
              <Button onClick={handleAddAlias}>添加</Button>
            </div>
            <Space size={4} wrap>
              {aliases.map(alias => (
                <Tag key={alias} closable onClose={() => handleRemoveAlias(alias)} style={{ fontSize: 11 }}>{alias}</Tag>
              ))}
            </Space>
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea id="description" name="fieldDictionaryAddDescription" placeholder="字段描述..." rows={3} />
          </Form.Item>
          <Form.Item name="type" label="数据类型" initialValue="String">
            <Select id="type" aria-label="新增字段数据类型" options={DICTIONARY_FIELD_TYPES.map(t => ({ value: t.value, label: t.value }))} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑字段弹窗 */}
      <Modal
        open={!!editingField}
        title="编辑字段定义"
        onCancel={() => setEditingField(null)}
        onOk={handleSaveEdit}
        okText="保存"
        cancelText="取消"
        destroyOnHidden
      >
        <Form form={editForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="字段名称" rules={[{ required: true, message: '请输入字段名称' }]}>
            <Input id="name" name="fieldDictionaryEditName" style={{ fontFamily: 'JetBrains Mono, monospace' }} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea id="description" name="fieldDictionaryEditDescription" rows={3} />
          </Form.Item>
          <Form.Item name="type" label="数据类型">
            <Select id="type" aria-label="编辑字段数据类型" options={DICTIONARY_FIELD_TYPES.map(t => ({ value: t.value, label: t.value }))} />
          </Form.Item>
          <Form.Item name="verified" valuePropName="checked" label={null}>
            <label htmlFor="field-dictionary-verified" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                id="field-dictionary-verified"
                name="fieldDictionaryVerified"
                type="checkbox"
                checked={editingField?.verified ?? false}
                onChange={e => {
                  if (editingField) setEditingField({ ...editingField, verified: e.target.checked });
                  editForm.setFieldValue('verified', e.target.checked);
                }}
                style={{ width: 16, height: 16 }}
              />
              标记为已验证标准
            </label>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default FieldDictionary;
