import React, { useState, useMemo, useCallback } from 'react';
import { Card, Input, Tag, Button, Row, Col, Space, Empty, Tooltip, App, Modal, Form, Select, Popconfirm } from 'antd';
import { COLORS } from '../../theme/tokens';
import type { SavedQuery } from '../../types/log';

// ============================================================================
// 模拟数据
// ============================================================================
const ALL_TAGS = ['生产环境', '错误排查', '性能分析', '安全审计', '日常巡检'];

const INITIAL_SAVED: SavedQuery[] = [
  { id: 'sq-001', name: '支付服务错误', query: 'level:error AND service:payment-service', tags: ['生产环境', '错误排查'], createdAt: '2026-02-18T10:30:00Z' },
  { id: 'sq-002', name: '5xx 状态码', query: 'status:>=500', tags: ['错误排查'], createdAt: '2026-02-17T14:20:00Z' },
  { id: 'sq-003', name: '慢查询日志', query: 'duration:>2000 AND service:*', tags: ['性能分析'], createdAt: '2026-02-16T09:15:00Z' },
  { id: 'sq-004', name: '认证失败', query: 'service:auth-service AND message:"authentication failed"', tags: ['安全审计'], createdAt: '2026-02-15T16:45:00Z' },
  { id: 'sq-005', name: '网关超时', query: 'service:gateway AND message:"timeout"', tags: ['生产环境', '错误排查'], createdAt: '2026-02-14T11:00:00Z' },
  { id: 'sq-006', name: 'OOM 事件', query: 'message:"OutOfMemoryError" OR message:"OOM"', tags: ['错误排查', '性能分析'], createdAt: '2026-02-13T08:30:00Z' },
  { id: 'sq-007', name: '订单 API 警告', query: 'level:warn AND service:order-api', tags: ['日常巡检'], createdAt: '2026-02-12T13:10:00Z' },
  { id: 'sq-008', name: '数据库连接池', query: 'message:"connection pool" AND level:warn', tags: ['性能分析', '日常巡检'], createdAt: '2026-02-11T17:25:00Z' },
];

// ============================================================================
// SavedQueries 主组件
// ============================================================================
const SavedQueries: React.FC = () => {
  const { message: msg } = App.useApp();
  const [form] = Form.useForm();

  // 数据状态（可增删改）
  const [savedList, setSavedList] = useState<SavedQuery[]>(INITIAL_SAVED);

  // 筛选状态
  const [searchText, setSearchText] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // 编辑弹窗
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SavedQuery | null>(null);

  // 筛选后的数据
  const filteredData = useMemo(() => {
    let data = savedList;
    if (searchText.trim()) {
      const kw = searchText.toLowerCase();
      data = data.filter(
        (item) =>
          item.name.toLowerCase().includes(kw) ||
          item.query.toLowerCase().includes(kw),
      );
    }
    if (selectedTag) {
      data = data.filter((item) => item.tags.includes(selectedTag));
    }
    return data;
  }, [savedList, searchText, selectedTag]);

  // 打开编辑弹窗
  const handleEdit = useCallback((item: SavedQuery) => {
    setEditingItem(item);
    form.setFieldsValue({ name: item.name, query: item.query, tags: item.tags });
    setEditModalOpen(true);
  }, [form]);

  // 保存编辑
  const handleEditSave = useCallback(() => {
    form.validateFields().then((values) => {
      if (!editingItem) return;
      setSavedList((prev) =>
        prev.map((it) =>
          it.id === editingItem.id
            ? { ...it, name: values.name, query: values.query, tags: values.tags ?? [] }
            : it,
        ),
      );
      setEditModalOpen(false);
      setEditingItem(null);
      msg.success('已保存修改');
    });
  }, [editingItem, form, msg]);

  // 删除
  const handleDelete = useCallback((id: string) => {
    setSavedList((prev) => prev.filter((it) => it.id !== id));
    msg.success('已删除');
  }, [msg]);

  return (
    <div className="flex flex-col gap-4">
      {/* 筛选栏 */}
      <div className="flex items-center gap-3 flex-wrap">
        <Input.Search
          placeholder="搜索查询名称或语句..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
          style={{ width: 300 }}
        />
        <div className="flex items-center gap-2 flex-wrap">
          <Tag
            className="cursor-pointer"
            color={selectedTag === null ? 'blue' : undefined}
            onClick={() => setSelectedTag(null)}
          >
            全部
          </Tag>
          {ALL_TAGS.map((tag) => (
            <Tag
              key={tag}
              className="cursor-pointer"
              color={selectedTag === tag ? 'blue' : undefined}
              onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
            >
              {tag}
            </Tag>
          ))}
        </div>
        <span className="text-sm opacity-50 ml-auto">
          共 {filteredData.length} 个收藏
        </span>
      </div>

      {/* 收藏查询卡片列表 */}
      {filteredData.length === 0 ? (
        <Empty description="没有匹配的收藏查询" />
      ) : (
        <Row gutter={[16, 16]}>
          {filteredData.map((item) => (
            <Col key={item.id} xs={24} md={12} xl={8}>
              <Card hoverable size="small" styles={{ body: { padding: 16 } }}>
                <div className="flex flex-col gap-3">
                  {/* 标题行 */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-base" style={{ color: COLORS.warning }}>
                        bookmark
                      </span>
                      <span className="text-sm font-medium">{item.name}</span>
                    </div>
                    <Space size={0}>
                      <Tooltip title="执行">
                        <Button
                          type="text"
                          size="small"
                          icon={<span className="material-symbols-outlined text-sm">play_arrow</span>}
                          onClick={() => msg.info(`执行: ${item.query}`)}
                        />
                      </Tooltip>
                      <Tooltip title="编辑">
                        <Button
                          type="text"
                          size="small"
                          icon={<span className="material-symbols-outlined text-sm">edit</span>}
                          onClick={() => handleEdit(item)}
                        />
                      </Tooltip>
                      <Popconfirm
                        title="确认删除"
                        description={`确定要删除「${item.name}」吗？`}
                        onConfirm={() => handleDelete(item.id)}
                        okText="删除"
                        cancelText="取消"
                        okButtonProps={{ danger: true }}
                      >
                        <Tooltip title="删除">
                          <Button
                            type="text"
                            size="small"
                            danger
                            icon={<span className="material-symbols-outlined text-sm">delete</span>}
                          />
                        </Tooltip>
                      </Popconfirm>
                    </Space>
                  </div>

                  {/* 查询语句 */}
                  <div
                    className="font-mono text-sm p-2 rounded overflow-hidden text-ellipsis whitespace-nowrap"
                    style={{ backgroundColor: 'rgba(0,0,0,0.06)' }}
                    title={item.query}
                  >
                    {item.query}
                  </div>

                  {/* 底部：标签 + 时间 */}
                  <div className="flex items-center justify-between">
                    <div className="flex gap-1 flex-wrap">
                      {item.tags.map((tag) => (
                        <Tag key={tag} style={{ fontSize: 12, margin: 0, lineHeight: '18px', padding: '0 6px' }}>
                          {tag}
                        </Tag>
                      ))}
                    </div>
                    <span className="text-xs opacity-40 shrink-0">
                      {new Date(item.createdAt).toLocaleDateString('zh-CN')}
                    </span>
                  </div>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* 编辑弹窗 */}
      <Modal
        title="编辑收藏查询"
        open={editModalOpen}
        onOk={handleEditSave}
        onCancel={() => { setEditModalOpen(false); setEditingItem(null); }}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item name="name" label="查询名称" rules={[{ required: true, message: '请输入查询名称' }]}>
            <Input placeholder="例如：支付服务错误" />
          </Form.Item>
          <Form.Item name="query" label="查询语句" rules={[{ required: true, message: '请输入查询语句' }]}>
            <Input.TextArea rows={3} placeholder='例如: level:error AND service:"payment-service"' className="font-mono" />
          </Form.Item>
          <Form.Item name="tags" label="标签">
            <Select mode="multiple" placeholder="选择标签" options={ALL_TAGS.map((t) => ({ label: t, value: t }))} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SavedQueries;
