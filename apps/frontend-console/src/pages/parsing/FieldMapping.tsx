import React, { useState, useCallback } from 'react';
import { Input, Select, Button, Table, Tag, Modal, Form, Space, message, Alert } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useThemeStore } from '../../stores/themeStore';
import { COLORS, DARK_PALETTE, LIGHT_PALETTE } from '../../theme/tokens';
import type { FieldMapping as FieldMappingType, FieldType, MappingStatus } from '../../types/parsing';
import { FIELD_TYPES } from '../../types/parsing';

// ============================================================================
// 模拟数据
// ============================================================================

const initialMappings: FieldMappingType[] = [
  { id: '1', sourceField: 'request_uri', targetField: 'url.path', fieldType: 'String', status: 'Active' },
  { id: '2', sourceField: 'client_ip', targetField: 'source.ip', fieldType: 'IP Addr', status: 'Active' },
  { id: '3', sourceField: 'response_time', targetField: 'http.response.duration', fieldType: 'Long', status: 'Pending', isEditing: true },
  { id: '4', sourceField: 'created_at', targetField: '@timestamp', fieldType: 'Date', status: 'Error' },
  { id: '5', sourceField: 'user_id', targetField: 'user.id', fieldType: 'Integer', status: 'Active' },
  { id: '6', sourceField: 'request_method', targetField: 'http.method', fieldType: 'String', status: 'Active' },
];

// ============================================================================
// 辅助函数
// ============================================================================

const statusTagColor: Record<MappingStatus, string> = {
  Active: 'success',
  Pending: 'warning',
  Error: 'error',
};

const statusLabel: Record<MappingStatus, string> = {
  Active: 'Active',
  Pending: 'Pending',
  Error: 'Error',
};

// ============================================================================
// 组件
// ============================================================================

const FieldMapping: React.FC = () => {
  const isDark = useThemeStore((s) => s.isDark);
  const palette = isDark ? DARK_PALETTE : LIGHT_PALETTE;

  const [mappings, setMappings] = useState<FieldMappingType[]>(initialMappings);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndex, setSelectedIndex] = useState('production-logs-2023');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTarget, setEditingTarget] = useState('');
  const [editingType, setEditingType] = useState<FieldType>('String');
  const [form] = Form.useForm();

  // 过滤
  const filteredMappings = mappings.filter(m =>
    m.sourceField.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.targetField.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 添加映射
  const handleAdd = useCallback(() => {
    form.validateFields().then(values => {
      const mapping: FieldMappingType = {
        id: Date.now().toString(),
        sourceField: values.sourceField,
        targetField: values.targetField,
        fieldType: values.fieldType,
        status: 'Pending',
      };
      setMappings(prev => [...prev, mapping]);
      form.resetFields();
      setAddModalOpen(false);
      message.success('映射已添加');
    });
  }, [form]);

  // 删除
  const handleDelete = useCallback((id: string) => {
    setMappings(prev => prev.filter(m => m.id !== id));
    message.success('映射已删除');
  }, []);

  // 开始编辑
  const handleStartEdit = useCallback((record: FieldMappingType) => {
    setEditingId(record.id);
    setEditingTarget(record.targetField);
    setEditingType(record.fieldType);
  }, []);

  // 保存编辑
  const handleSaveEdit = useCallback(() => {
    if (!editingId) return;
    setMappings(prev => prev.map(m =>
      m.id === editingId ? { ...m, targetField: editingTarget, fieldType: editingType, status: 'Active' as const, isEditing: false } : m
    ));
    setEditingId(null);
    message.success('映射已更新');
  }, [editingId, editingTarget, editingType]);

  // 自动检测
  const handleAutoDetect = useCallback(() => {
    const detected: FieldMappingType[] = [
      { id: Date.now().toString(), sourceField: 'log_level', targetField: 'log.level', fieldType: 'String', status: 'Pending' },
      { id: (Date.now() + 1).toString(), sourceField: 'message', targetField: 'message', fieldType: 'String', status: 'Pending' },
    ];
    setMappings(prev => [...prev, ...detected]);
    message.success('检测到 2 个新字段映射');
  }, []);

  // 表格列
  const columns: ColumnsType<FieldMappingType> = [
    {
      title: '#',
      width: 50,
      align: 'center',
      render: () => (
        <span className="material-symbols-outlined" style={{ fontSize: 16, color: palette.textSecondary, cursor: 'move' }}>drag_indicator</span>
      ),
    },
    {
      title: '源字段 (Source)',
      dataIndex: 'sourceField',
      key: 'sourceField',
      render: (text: string, record) => (
        <Space>
          <code style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, background: isDark ? '#0f172a' : '#f1f5f9', border: `1px solid ${palette.border}`, fontFamily: 'JetBrains Mono, monospace' }}>
            {text}
          </code>
          {record.status === 'Error' && (
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: COLORS.danger }} title="解析错误">warning</span>
          )}
        </Space>
      ),
    },
    {
      title: '',
      width: 40,
      align: 'center',
      render: () => (
        <span className="material-symbols-outlined" style={{ fontSize: 16, color: palette.textSecondary }}>arrow_forward</span>
      ),
    },
    {
      title: '目标字段 (Target)',
      dataIndex: 'targetField',
      key: 'targetField',
      render: (text: string, record) => {
        if (editingId === record.id) {
          return (
            <Input
              size="small"
              name="fieldMappingEditingTarget"
              aria-label="目标字段编辑"
              value={editingTarget}
              onChange={e => setEditingTarget(e.target.value)}
              style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}
            />
          );
        }
        return <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>{text}</span>;
      },
    },
    {
      title: '类型 (Type)',
      dataIndex: 'fieldType',
      key: 'fieldType',
      width: 140,
      render: (type: FieldType, record) => {
        if (editingId === record.id) {
          return (
            <Select size="small" aria-label="字段类型编辑" value={editingType} onChange={setEditingType} style={{ width: 110 }}>
              {FIELD_TYPES.map(t => <Select.Option key={t.value} value={t.value}>{t.value}</Select.Option>)}
            </Select>
          );
        }
        const cfg = FIELD_TYPES.find(t => t.value === type);
        return <Tag color={cfg?.color || 'default'}>{type}</Tag>;
      },
    },
    {
      title: '状态 (Status)',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: MappingStatus) => (
        <Tag color={statusTagColor[status]}>{statusLabel[status]}</Tag>
      ),
    },
    {
      title: '操作 (Action)',
      key: 'actions',
      width: 120,
      align: 'right',
      render: (_, record) => {
        if (editingId === record.id) {
          return (
            <Space size={4}>
              <Button type="text" size="small" onClick={handleSaveEdit}
                icon={<span className="material-symbols-outlined" style={{ fontSize: 18, color: COLORS.primary }}>check</span>} />
              <Button type="text" size="small" onClick={() => setEditingId(null)}
                icon={<span className="material-symbols-outlined" style={{ fontSize: 18, color: COLORS.danger }}>close</span>} />
            </Space>
          );
        }
        if (record.status === 'Pending' && record.isEditing) {
          return (
            <Space size={4}>
              <Button type="text" size="small"
                onClick={() => setMappings(prev => prev.map(m => m.id === record.id ? { ...m, status: 'Active' as const, isEditing: false } : m))}
                icon={<span className="material-symbols-outlined" style={{ fontSize: 18, color: COLORS.primary }}>check</span>} />
              <Button type="text" size="small" onClick={() => handleDelete(record.id)}
                icon={<span className="material-symbols-outlined" style={{ fontSize: 18, color: COLORS.danger }}>delete</span>} />
            </Space>
          );
        }
        return (
          <Space size={4}>
            <Button type="text" size="small" onClick={() => handleStartEdit(record)}
              icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit</span>} />
            <Button type="text" size="small" onClick={() => handleDelete(record.id)}
              icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>} />
          </Space>
        );
      },
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, height: '100%' }}>
      {/* 头部 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>字段映射 (Field Mapping)</h2>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: palette.textSecondary }}>
            配置源日志字段到目标索引字段的映射规则与类型转换。
          </p>
        </div>
        <Space>
          <Select id="field-mapping-index-select" aria-label="索引选择" value={selectedIndex} onChange={setSelectedIndex} style={{ minWidth: 200 }}
            options={[
              { value: 'production-logs-2023', label: 'production-logs-2023' },
              { value: 'access-logs-web-01', label: 'access-logs-web-01' },
              { value: 'error-logs-backend', label: 'error-logs-backend' },
            ]}
          />
          <Button onClick={handleAutoDetect}
            icon={<span className="material-symbols-outlined" style={{ fontSize: 18, color: COLORS.warning }}>auto_awesome</span>}
          >自动检测 (Auto)</Button>
          <Button type="primary" onClick={() => setAddModalOpen(true)}
            icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>}
          >添加映射 (Add)</Button>
        </Space>
      </div>

      {/* 搜索过滤 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: 16, background: palette.bgContainer, borderRadius: 12, border: `1px solid ${palette.border}` }}>
        <Input
          id="field-mapping-search"
          name="fieldMappingSearch"
          prefix={<span className="material-symbols-outlined" style={{ fontSize: 20, color: palette.textSecondary }}>search</span>}
          placeholder="搜索字段名 (Search fields)..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{ flex: 1, maxWidth: 400 }}
          allowClear
        />
        <Space>
          <Button type="text" icon={<span className="material-symbols-outlined" style={{ fontSize: 20 }}>filter_list</span>} />
          <Button type="text" icon={<span className="material-symbols-outlined" style={{ fontSize: 20 }}>tune</span>} />
        </Space>
      </div>

      {/* 映射表格 */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <Table<FieldMappingType>
          rowKey="id"
          columns={columns}
          dataSource={filteredMappings}
          size="middle"
          pagination={{
            showSizeChanger: true,
            showTotal: (total, range) => `显示 ${range[0]} 到 ${range[1]} 条，共 ${total} 条`,
          }}
          scroll={{ x: 800 }}
          rowClassName={(record) => record.status === 'Pending' ? 'ant-table-row-pending' : ''}
        />
      </div>

      {/* 提示信息 */}
      <Alert
        type="info"
        showIcon
        message="字段映射提示"
        description={
          <span>
            确保目标字段名称符合 Elastic Common Schema (ECS) 标准，以获得最佳兼容性。对于日期字段，您可能需要配置特定的格式模式。
            <a style={{ marginLeft: 4, color: COLORS.primary }}>查看文档</a>
          </span>
        }
      />

      {/* 添加映射弹窗 */}
      <Modal
        open={addModalOpen}
        title="添加字段映射"
        onCancel={() => { setAddModalOpen(false); form.resetFields(); }}
        onOk={handleAdd}
        okText="添加"
        cancelText="取消"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="sourceField" label="源字段名" rules={[{ required: true, message: '请输入源字段名' }]}>
            <Input id="sourceField" name="fieldMappingAddSourceField" placeholder="例如: request_uri" />
          </Form.Item>
          <Form.Item name="targetField" label="目标字段名" rules={[{ required: true, message: '请输入目标字段名' }]}>
            <Input id="targetField" name="fieldMappingAddTargetField" placeholder="例如: url.path" />
          </Form.Item>
          <Form.Item name="fieldType" label="字段类型" initialValue="String">
            <Select id="fieldType" aria-label="新增映射字段类型">
              {FIELD_TYPES.map(t => <Select.Option key={t.value} value={t.value}>{t.value}</Select.Option>)}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default FieldMapping;
