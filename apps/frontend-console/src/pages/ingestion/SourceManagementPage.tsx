/**
 * 数据源管理页面
 * 
 * 管理日志采集来源，支持 CRUD 操作、过滤搜索、分页、状态切换
 * 
 * @requirements 9.5
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Row, Col, Card, Typography, Space, Button, Table, Tag, Input, Modal,
  Form, Select, Statistic, Tooltip, Popconfirm, message,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, ReloadOutlined, EditOutlined,
  DeleteOutlined, PauseCircleOutlined, PlayCircleOutlined,
  CloudServerOutlined, CheckCircleOutlined, ExclamationCircleOutlined,
  DatabaseOutlined, HddOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text } = Typography;

// ============================================================================
// 类型定义
// ============================================================================

interface DataSource {
  id: string;
  name: string;
  type: 'Kafka' | 'File' | 'HTTP' | 'Syslog';
  index: string;
  volume: string;
  volumePercent: number;
  status: 'Running' | 'Paused' | 'Error';
  health: 'Healthy' | 'Error' | 'Neutral';
  createdAt: string;
  description?: string;
}

interface SourceFormData {
  name: string;
  type: 'Kafka' | 'File' | 'HTTP' | 'Syslog';
  index: string;
  description: string;
}

// ============================================================================
// 模拟数据
// ============================================================================

const initialSources: DataSource[] = [
  { id: 'src-8f2k9x', name: 'Nginx-Access-Logs-Prod', type: 'File', index: 'idx_nginx_prod_2023', volume: '45.2 GB', volumePercent: 45, status: 'Running', health: 'Healthy', createdAt: '2025-12-01', description: 'Nginx 生产环境访问日志' },
  { id: 'src-km39v2', name: 'Kafka-Order-Topic', type: 'Kafka', index: 'idx_orders_raw', volume: '128.5 GB', volumePercent: 85, status: 'Running', health: 'Healthy', createdAt: '2025-11-15', description: 'Kafka 订单主题日志' },
  { id: 'src-fw772b', name: 'Syslog-Firewall-Main', type: 'Syslog', index: 'idx_fw_logs', volume: '12.1 GB', volumePercent: 12, status: 'Error', health: 'Error', createdAt: '2025-10-20', description: '防火墙系统日志' },
  { id: 'src-trc92x', name: 'App-Error-Trace', type: 'HTTP', index: 'idx_app_errors', volume: '2.4 GB', volumePercent: 5, status: 'Running', health: 'Healthy', createdAt: '2025-09-10', description: '应用错误追踪日志' },
  { id: 'src-db001z', name: 'Legacy-DB-Audit', type: 'File', index: 'idx_db_audit_arch', volume: '0 B', volumePercent: 0, status: 'Paused', health: 'Neutral', createdAt: '2025-08-05', description: '数据库审计日志（已归档）' },
];

const typeOptions = [
  { label: 'Kafka', value: 'Kafka' },
  { label: 'File / Log', value: 'File' },
  { label: 'HTTP', value: 'HTTP' },
  { label: 'Syslog', value: 'Syslog' },
];


// ============================================================================
// 主组件
// ============================================================================

export const SourceManagementPage: React.FC = () => {
  const [sources, setSources] = useState<DataSource[]>(initialSources);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<DataSource | null>(null);
  const [form] = Form.useForm<SourceFormData>();

  // 统计数据
  const stats = useMemo(() => {
    const total = sources.length;
    const running = sources.filter(s => s.status === 'Running').length;
    const errors = sources.filter(s => s.health === 'Error').length;
    const totalVolume = sources.reduce((acc, s) => {
      const match = s.volume.match(/^([\d.]+)/);
      return acc + (match?.[1] ? parseFloat(match[1]) : 0);
    }, 0);
    return { total, running, errors, totalVolume: `${totalVolume.toFixed(1)} GB` };
  }, [sources]);

  // 过滤后的数据
  const filteredSources = useMemo(() => {
    let result = sources;
    if (activeFilter !== 'all') {
      result = result.filter(s => s.type === activeFilter);
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(s =>
        s.name.toLowerCase().includes(query) ||
        s.id.toLowerCase().includes(query) ||
        s.index.toLowerCase().includes(query)
      );
    }
    return result;
  }, [sources, activeFilter, searchQuery]);

  // 打开创建/编辑模态框
  const handleOpenModal = useCallback((source?: DataSource) => {
    if (source) {
      setEditingSource(source);
      form.setFieldsValue({ name: source.name, type: source.type, index: source.index, description: source.description || '' });
    } else {
      setEditingSource(null);
      form.resetFields();
    }
    setIsModalOpen(true);
  }, [form]);

  // 提交表单
  const handleSubmit = useCallback(async () => {
    try {
      const values = await form.validateFields();
      if (editingSource) {
        setSources(prev => prev.map(s =>
          s.id === editingSource.id ? { ...s, ...values } : s
        ));
        message.success('数据源更新成功');
      } else {
        const newSource: DataSource = {
          id: `src-${Math.random().toString(36).substring(2, 8)}`,
          name: values.name,
          type: values.type,
          index: values.index,
          description: values.description,
          volume: '0 B',
          volumePercent: 0,
          status: 'Running',
          health: 'Healthy',
          createdAt: new Date().toISOString().split('T')[0] ?? '',
        };
        setSources(prev => [newSource, ...prev]);
        message.success('数据源创建成功');
      }
      setIsModalOpen(false);
      form.resetFields();
      setEditingSource(null);
    } catch {
      // 表单验证失败
    }
  }, [form, editingSource]);

  // 删除数据源
  const handleDelete = useCallback((id: string) => {
    setSources(prev => prev.filter(s => s.id !== id));
    message.success('数据源已删除');
  }, []);

  // 切换状态
  const handleToggleStatus = useCallback((source: DataSource) => {
    setSources(prev => prev.map(s =>
      s.id === source.id
        ? { ...s, status: s.status === 'Running' ? 'Paused' as const : 'Running' as const }
        : s
    ));
  }, []);

  // 表格列定义
  const columns: ColumnsType<DataSource> = [
    {
      title: '采集源名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record) => (
        <div>
          <Text strong style={{ display: 'block' }}>{name}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>ID: {record.id}</Text>
        </div>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type: string) => {
        const iconMap: Record<string, React.ReactNode> = {
          Kafka: <CloudServerOutlined />,
          HTTP: <DatabaseOutlined />,
          Syslog: <HddOutlined />,
          File: <HddOutlined />,
        };
        return <Space size={4}>{iconMap[type]}<Text>{type}</Text></Space>;
      },
    },
    {
      title: '目标索引',
      dataIndex: 'index',
      key: 'index',
      render: (index: string) => <Text code style={{ fontSize: 12 }}>{index}</Text>,
    },
    {
      title: '24h 数据量',
      dataIndex: 'volume',
      key: 'volume',
      width: 140,
      render: (volume: string, record) => (
        <div>
          <Text>{volume}</Text>
          <div style={{ width: 80, height: 4, background: '#f0f0f0', borderRadius: 2, marginTop: 4 }}>
            <div style={{ width: `${record.volumePercent}%`, height: '100%', background: '#1677ff', borderRadius: 2 }} />
          </div>
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const configMap: Record<string, { color: string; icon: React.ReactNode }> = {
          Running: { color: 'success', icon: <CheckCircleOutlined /> },
          Paused: { color: 'warning', icon: <PauseCircleOutlined /> },
          Error: { color: 'error', icon: <ExclamationCircleOutlined /> },
        };
        const c = configMap[status] ?? { color: 'default', icon: null };
        return <Tag color={c.color} icon={c.icon}>{status}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      align: 'right',
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title={record.status === 'Running' ? '暂停' : '启动'}>
            <Button
              type="text"
              size="small"
              icon={record.status === 'Running' ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
              onClick={() => handleToggleStatus(record)}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleOpenModal(record)} />
          </Tooltip>
          <Popconfirm
            title="确认删除"
            description={`确定要删除数据源 "${record.name}" 吗？此操作不可撤销。`}
            onConfirm={() => handleDelete(record.id)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="删除">
              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 过滤按钮
  const filterTypes = ['all', 'Kafka', 'File', 'HTTP', 'Syslog'];

  return (
    <div>
      {/* 页面标题 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>采集源管理</Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            管理所有日志采集来源，监控数据接入状态与健康指标
          </Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
          新建采集源
        </Button>
      </div>

      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="总数据源" value={stats.total} prefix={<CloudServerOutlined style={{ color: '#1677ff' }} />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="运行中" value={stats.running} valueStyle={{ color: '#52c41a' }} prefix={<CheckCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="异常" value={stats.errors} valueStyle={{ color: '#ff4d4f' }} prefix={<ExclamationCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="总数据量" value={stats.totalVolume} prefix={<DatabaseOutlined style={{ color: '#722ed1' }} />} />
          </Card>
        </Col>
      </Row>

      {/* 过滤器和搜索 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Space size={8} wrap>
          {filterTypes.map(type => (
            <Button
              key={type}
              type={activeFilter === type ? 'primary' : 'default'}
              size="small"
              onClick={() => setActiveFilter(type)}
            >
              {type === 'all' ? '全部' : type === 'File' ? 'File / Log' : type}
            </Button>
          ))}
        </Space>
        <Space>
          <Input
            placeholder="搜索数据源..."
            prefix={<SearchOutlined />}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: 200 }}
            size="small"
            allowClear
          />
          <Button icon={<ReloadOutlined />} size="small" />
        </Space>
      </div>

      {/* 数据表格 */}
      <Card styles={{ body: { padding: 0 } }}>
        <Table
          dataSource={filteredSources}
          columns={columns}
          rowKey="id"
          size="small"
          pagination={{
            pageSize: 5,
            showTotal: (total, range) => `显示 ${range[0]}-${range[1]} 条，共 ${total} 条`,
            showSizeChanger: false,
          }}
        />
      </Card>

      {/* 创建/编辑模态框 */}
      <Modal
        title={editingSource ? '编辑采集源' : '新建采集源'}
        open={isModalOpen}
        onOk={handleSubmit}
        onCancel={() => { setIsModalOpen(false); setEditingSource(null); form.resetFields(); }}
        okText={editingSource ? '保存' : '创建'}
        cancelText="取消"
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="数据源名称"
            rules={[
              { required: true, message: '请输入数据源名称' },
              { min: 3, message: '名称至少需要3个字符' },
            ]}
          >
            <Input placeholder="例如: Nginx-Access-Logs-Prod" />
          </Form.Item>
          <Form.Item name="type" label="数据源类型" rules={[{ required: true }]}>
            <Select options={typeOptions} placeholder="选择类型" />
          </Form.Item>
          <Form.Item
            name="index"
            label="目标索引"
            rules={[
              { required: true, message: '请输入目标索引' },
              { pattern: /^[a-z][a-z0-9_]*$/, message: '索引名称必须以小写字母开头，只能包含小写字母、数字和下划线' },
            ]}
          >
            <Input placeholder="例如: idx_nginx_prod" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea placeholder="可选：描述此数据源的用途" rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SourceManagementPage;
