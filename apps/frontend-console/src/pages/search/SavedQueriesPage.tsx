/**
 * 保存的查询页面
 * 
 * 提供查询语句保存和管理功能：
 * - 查询列表（Ant Design Table）
 * - 创建/编辑查询
 * - 执行保存的查询
 * - 分享查询
 * 
 * @requirements 9.2
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Typography,
  Modal,
  Form,
  Input,
  Switch,
  message,
  Tooltip,
  Empty,
  Dropdown,
  Badge,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  ShareAltOutlined,
  StarOutlined,
  StarFilled,
  MoreOutlined,
  SaveOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { MenuProps } from 'antd';
import type { SavedQuery } from '@/types';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Search } = Input;

// ============================================================================
// 模拟数据
// ============================================================================

const MOCK_SAVED_QUERIES: SavedQuery[] = [
  {
    id: '1',
    name: '生产环境错误日志',
    description: '查询生产环境所有 ERROR 级别的日志',
    query: 'level:ERROR AND env:production',
    filters: [
      { field: 'level', operator: 'eq', value: 'ERROR' },
      { field: 'env', operator: 'eq', value: 'production' },
    ],
    tags: ['生产', '错误'],
    isPublic: true,
    createdBy: 'user-001',
    createdAt: Date.now() - 86400000 * 7,
    updatedAt: Date.now() - 86400000,
    lastUsedAt: Date.now() - 3600000,
    useCount: 156,
  },
  {
    id: '2',
    name: '订单服务慢查询',
    description: '查询订单服务响应时间超过 1 秒的请求',
    query: 'service:order-service AND response_time:>1000',
    filters: [
      { field: 'service', operator: 'eq', value: 'order-service' },
      { field: 'response_time', operator: 'gt', value: 1000 },
    ],
    tags: ['性能', '订单'],
    isPublic: false,
    createdBy: 'user-001',
    createdAt: Date.now() - 86400000 * 14,
    updatedAt: Date.now() - 86400000 * 3,
    lastUsedAt: Date.now() - 86400000,
    useCount: 42,
  },
  {
    id: '3',
    name: '支付失败追踪',
    description: '追踪所有支付失败的交易日志',
    query: 'service:payment-service AND status:failed',
    filters: [
      { field: 'service', operator: 'eq', value: 'payment-service' },
      { field: 'status', operator: 'eq', value: 'failed' },
    ],
    tags: ['支付', '失败'],
    isPublic: true,
    createdBy: 'user-002',
    createdAt: Date.now() - 86400000 * 30,
    updatedAt: Date.now() - 86400000 * 7,
    useCount: 89,
  },
  {
    id: '4',
    name: '用户登录异常',
    description: '监控用户登录失败和异常行为',
    query: 'action:login AND (status:failed OR status:blocked)',
    filters: [
      { field: 'action', operator: 'eq', value: 'login' },
    ],
    tags: ['安全', '登录'],
    isPublic: false,
    createdBy: 'user-001',
    createdAt: Date.now() - 86400000 * 5,
    updatedAt: Date.now() - 86400000 * 2,
    lastUsedAt: Date.now() - 7200000,
    useCount: 234,
  },
];

// ============================================================================
// 辅助函数
// ============================================================================

/** 格式化相对时间 */
const formatRelativeTime = (ts?: number) => {
  if (!ts) return '从未使用';
  const diff = Date.now() - ts;
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  return `${Math.floor(diff / 86400000)} 天前`;
};

// ============================================================================
// 主组件
// ============================================================================

export const SavedQueriesPage: React.FC = () => {
  const [queries, setQueries] = useState<SavedQuery[]>(MOCK_SAVED_QUERIES);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingQuery, setEditingQuery] = useState<SavedQuery | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set(['1', '4']));
  const [form] = Form.useForm();

  // 过滤后的查询列表
  const filteredQueries = useMemo(() => {
    if (!searchText) return queries;
    const lowerSearch = searchText.toLowerCase();
    return queries.filter(item =>
      item.name.toLowerCase().includes(lowerSearch) ||
      item.query.toLowerCase().includes(lowerSearch) ||
      item.description?.toLowerCase().includes(lowerSearch) ||
      item.tags?.some(tag => tag.toLowerCase().includes(lowerSearch))
    );
  }, [queries, searchText]);

  // 打开创建/编辑弹窗
  const handleOpenModal = useCallback((query?: SavedQuery) => {
    setEditingQuery(query || null);
    if (query) {
      form.setFieldsValue({
        name: query.name,
        description: query.description,
        query: query.query,
        tags: query.tags?.join(', '),
        isPublic: query.isPublic,
      });
    } else {
      form.resetFields();
    }
    setModalOpen(true);
  }, [form]);

  // 保存查询
  const handleSave = useCallback(async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const tags = values.tags
        ? values.tags.split(',').map((t: string) => t.trim()).filter(Boolean)
        : [];
      
      if (editingQuery) {
        // 更新
        setQueries(prev => prev.map(q =>
          q.id === editingQuery.id
            ? {
                ...q,
                name: values.name,
                description: values.description,
                query: values.query,
                tags,
                isPublic: values.isPublic,
                updatedAt: Date.now(),
              }
            : q
        ));
        message.success('查询已更新');
      } else {
        // 创建
        const newQuery: SavedQuery = {
          id: `query_${Date.now()}`,
          name: values.name,
          description: values.description,
          query: values.query,
          filters: [],
          tags,
          isPublic: values.isPublic || false,
          createdBy: 'current-user',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          useCount: 0,
        };
        setQueries(prev => [newQuery, ...prev]);
        message.success('查询已保存');
      }
      
      setModalOpen(false);
      form.resetFields();
    } catch {
      // 表单验证失败
    } finally {
      setLoading(false);
    }
  }, [form, editingQuery]);

  // 删除查询
  const handleDelete = useCallback((id: string) => {
    setQueries(prev => prev.filter(q => q.id !== id));
    setFavorites(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    message.success('已删除');
  }, []);

  // 执行查询
  const handleRun = useCallback((query: SavedQuery) => {
    message.info(`正在执行查询: ${query.name}`);
    // 实际实现中会跳转到实时搜索页面并执行查询
  }, []);

  // 复制查询
  const handleCopy = useCallback((query: SavedQuery) => {
    navigator.clipboard.writeText(query.query);
    message.success('查询语句已复制到剪贴板');
  }, []);

  // 切换收藏
  const handleToggleFavorite = useCallback((id: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        message.info('已取消收藏');
      } else {
        next.add(id);
        message.success('已添加到收藏');
      }
      return next;
    });
  }, []);

  // 分享查询
  const handleShare = useCallback((query: SavedQuery) => {
    message.info(`分享功能开发中: ${query.name}`);
  }, []);

  // 更多操作菜单
  const getMoreMenuItems = (record: SavedQuery): MenuProps['items'] => [
    {
      key: 'copy',
      icon: <CopyOutlined />,
      label: '复制查询语句',
      onClick: () => handleCopy(record),
    },
    {
      key: 'share',
      icon: <ShareAltOutlined />,
      label: '分享',
      onClick: () => handleShare(record),
    },
    { type: 'divider' },
    {
      key: 'delete',
      icon: <DeleteOutlined />,
      label: '删除',
      danger: true,
      onClick: () => handleDelete(record.id),
    },
  ];

  // 表格列定义
  const columns: ColumnsType<SavedQuery> = useMemo(() => [
    {
      title: '',
      key: 'favorite',
      width: 40,
      render: (_, record) => (
        <Button
          type="text"
          size="small"
          icon={favorites.has(record.id) ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />}
          onClick={() => handleToggleFavorite(record.id)}
        />
      ),
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (name: string, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{name}</Text>
          {record.description && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.description}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: '查询语句',
      dataIndex: 'query',
      key: 'query',
      ellipsis: true,
      render: (query: string) => (
        <Tooltip title={query}>
          <Text code style={{ fontSize: 12 }}>{query}</Text>
        </Tooltip>
      ),
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      width: 160,
      render: (tags?: string[]) => (
        <Space wrap size={[4, 4]}>
          {tags?.map(tag => (
            <Tag key={tag} color="blue">{tag}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '可见性',
      dataIndex: 'isPublic',
      key: 'isPublic',
      width: 80,
      render: (isPublic: boolean) => (
        <Tag color={isPublic ? 'green' : 'default'}>
          {isPublic ? '公开' : '私有'}
        </Tag>
      ),
      filters: [
        { text: '公开', value: true },
        { text: '私有', value: false },
      ],
      onFilter: (value, record) => record.isPublic === value,
    },
    {
      title: '使用次数',
      dataIndex: 'useCount',
      key: 'useCount',
      width: 100,
      align: 'right',
      render: (count: number) => (
        <Badge count={count} showZero overflowCount={999} style={{ backgroundColor: '#52c41a' }} />
      ),
      sorter: (a, b) => a.useCount - b.useCount,
    },
    {
      title: '最近使用',
      dataIndex: 'lastUsedAt',
      key: 'lastUsedAt',
      width: 120,
      render: (ts?: number) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {formatRelativeTime(ts)}
        </Text>
      ),
      sorter: (a, b) => (a.lastUsedAt || 0) - (b.lastUsedAt || 0),
    },
    {
      title: '操作',
      key: 'actions',
      width: 140,
      render: (_, record) => (
        <Space>
          <Tooltip title="执行">
            <Button
              type="link"
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() => handleRun(record)}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleOpenModal(record)}
            />
          </Tooltip>
          <Dropdown menu={{ items: getMoreMenuItems(record) }} trigger={['click']}>
            <Button type="link" size="small" icon={<MoreOutlined />} />
          </Dropdown>
        </Space>
      ),
    },
  ], [favorites, handleToggleFavorite, handleRun, handleOpenModal, handleDelete, handleCopy, handleShare]);

  return (
    <div>
      {/* 页面标题 */}
      <div style={{ marginBottom: 16 }}>
        <Space align="center">
          <Typography.Title level={4} style={{ margin: 0 }}>
            <SaveOutlined style={{ marginRight: 8 }} />
            保存的查询
          </Typography.Title>
          <Tag color="blue">日志检索</Tag>
        </Space>
        <Paragraph type="secondary" style={{ margin: 0 }}>
          管理已保存的查询语句
        </Paragraph>
      </div>

      {/* 操作栏 */}
      <Card style={{ marginBottom: 16 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Search
            placeholder="搜索查询名称、语句或标签..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 350 }}
            allowClear
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => handleOpenModal()}
          >
            新建查询
          </Button>
        </Space>
      </Card>

      {/* 查询列表 */}
      <Card>
        {filteredQueries.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={searchText ? '没有匹配的查询' : '暂无保存的查询'}
          >
            {!searchText && (
              <Button type="primary" onClick={() => handleOpenModal()}>
                创建第一个查询
              </Button>
            )}
          </Empty>
        ) : (
          <Table<SavedQuery>
            columns={columns}
            dataSource={filteredQueries}
            rowKey="id"
            loading={loading}
            pagination={{
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => `显示 ${range[0]}-${range[1]} 条，共 ${total} 条`,
            }}
            size="middle"
          />
        )}
      </Card>

      {/* 创建/编辑弹窗 */}
      <Modal
        title={editingQuery ? '编辑查询' : '新建查询'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        confirmLoading={loading}
        okText="保存"
        cancelText="取消"
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ isPublic: false }}
        >
          <Form.Item
            name="name"
            label="查询名称"
            rules={[{ required: true, message: '请输入查询名称' }]}
          >
            <Input placeholder="例如：生产环境错误日志" />
          </Form.Item>
          
          <Form.Item
            name="description"
            label="描述"
          >
            <Input placeholder="简要描述此查询的用途" />
          </Form.Item>
          
          <Form.Item
            name="query"
            label="查询语句"
            rules={[{ required: true, message: '请输入查询语句' }]}
          >
            <TextArea
              rows={3}
              placeholder="例如：level:ERROR AND service:order-service"
              style={{ fontFamily: 'monospace' }}
            />
          </Form.Item>
          
          <Form.Item
            name="tags"
            label="标签"
            extra="多个标签用逗号分隔"
          >
            <Input placeholder="例如：生产, 错误, 监控" />
          </Form.Item>
          
          <Form.Item
            name="isPublic"
            label="公开查询"
            valuePropName="checked"
            extra="公开的查询可被团队其他成员查看和使用"
          >
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SavedQueriesPage;
