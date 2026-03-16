import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, Input, Tag, Button, Row, Col, Space, Empty, Tooltip, App, Modal, Form, Select, Popconfirm, Alert, Pagination } from 'antd';
import { useNavigate } from 'react-router-dom';
import { COLORS } from '../../theme/tokens';
import type { SavedQuery } from '../../types/log';
import { createSavedQuery, deleteSavedQuery, fetchSavedQueries, updateSavedQuery } from '../../api/query';
import { persistPendingRealtimeStartupQuery } from './realtimeStartupQuery';
import { buildRealtimePresetQuery, normalizeRealtimePresetQuery } from './realtimePresetQuery';

type ModalMode = 'create' | 'edit';

const SavedQueries: React.FC = () => {
  const { message: msg } = App.useApp();
  const [form] = Form.useForm();
  const navigate = useNavigate();

  const [savedList, setSavedList] = useState<SavedQuery[]>([]);
  const [knownTags, setKnownTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState('');

  const [searchText, setSearchText] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [editingItem, setEditingItem] = useState<SavedQuery | null>(null);
  const [cleanupSubmitting, setCleanupSubmitting] = useState(false);

  const mergedTags = useMemo(() => {
    const values = new Set<string>(knownTags);
    savedList.forEach((item) => item.tags.forEach((tag) => values.add(tag)));
    if (selectedTag) {
      values.add(selectedTag);
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b, 'zh-CN'));
  }, [knownTags, savedList, selectedTag]);

  const savedQueryDiagnostics = useMemo(() => savedList.map((item) => {
    const normalized = normalizeRealtimePresetQuery(item.query);
    const cleanedQuery = buildRealtimePresetQuery({
      queryText: normalized.queryText,
      filters: normalized.filters,
    });
    return {
      item,
      normalized,
      cleanedQuery,
      needsCleanup: cleanedQuery !== item.query.trim(),
    };
  }), [savedList]);

  const dirtySavedQueries = useMemo(
    () => savedQueryDiagnostics.filter((entry) => entry.needsCleanup),
    [savedQueryDiagnostics],
  );

  // 收藏查询改为真实 API 数据源，页面仅做展示和交互。
  const loadSavedQueries = useCallback(async () => {
    setLoading(true);
    setErrorText('');
    try {
      const result = await fetchSavedQueries({
        page: currentPage,
        pageSize,
        keyword: appliedSearch,
        tag: selectedTag ?? undefined,
      });
      setSavedList(result.items);
      setTotal(result.total);
      setKnownTags((prev) => {
        const merged = new Set(prev);
        result.items.forEach((item) => item.tags.forEach((tag) => merged.add(tag)));
        return Array.from(merged).sort((a, b) => a.localeCompare(b, 'zh-CN'));
      });
      if (result.page !== currentPage) {
        setCurrentPage(result.page);
      }
      if (result.pageSize !== pageSize) {
        setPageSize(result.pageSize);
      }
    } catch (error) {
      const readable = error instanceof Error ? error.message : '加载收藏查询失败';
      setErrorText(readable);
    } finally {
      setLoading(false);
    }
  }, [appliedSearch, currentPage, pageSize, selectedTag]);

  useEffect(() => {
    void loadSavedQueries();
  }, [loadSavedQueries]);

  const openCreateModal = useCallback(() => {
    setModalMode('create');
    setEditingItem(null);
    form.resetFields();
    form.setFieldsValue({ tags: [] });
    setEditModalOpen(true);
  }, [form]);

  const openEditModal = useCallback((item: SavedQuery) => {
    setModalMode('edit');
    setEditingItem(item);
    form.setFieldsValue({
      name: item.name,
      query: item.query,
      tags: item.tags,
    });
    setEditModalOpen(true);
  }, [form]);

  const handleSave = useCallback(async () => {
    try {
      const values = await form.validateFields();
      const rawQuery = String(values.query ?? '').trim();
      const normalized = normalizeRealtimePresetQuery(rawQuery);
      const cleanedQuery = buildRealtimePresetQuery({
        queryText: normalized.queryText,
        filters: normalized.filters,
      });
      const payload = {
        name: String(values.name ?? '').trim(),
        query: cleanedQuery,
        tags: Array.isArray(values.tags)
          ? values.tags.map((tag: unknown) => String(tag).trim()).filter(Boolean)
          : [],
      };
      if (!payload.name || !payload.query) {
        msg.warning('请填写完整查询名称和语句');
        return;
      }

      const normalizedChangedQuery = cleanedQuery !== rawQuery;
      if (modalMode === 'create') {
        await createSavedQuery(payload);
        msg.success(normalizedChangedQuery ? '已创建收藏查询，并自动清洗旧格式时间范围' : '已创建收藏查询');
      } else if (editingItem) {
        await updateSavedQuery(editingItem.id, payload);
        msg.success(normalizedChangedQuery ? '已保存修改，并自动清洗旧格式时间范围' : '已保存修改');
      }

      setEditModalOpen(false);
      setEditingItem(null);
      if (currentPage !== 1 && modalMode === 'create') {
        setCurrentPage(1);
        return;
      }
      void loadSavedQueries();
    } catch (error) {
      if (error instanceof Error && error.message.includes('required')) {
        return;
      }
      const readable = error instanceof Error ? error.message : '保存失败';
      msg.error(readable);
    }
  }, [currentPage, editingItem, form, loadSavedQueries, modalMode, msg]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      const deleted = await deleteSavedQuery(id);
      if (!deleted) {
        msg.warning('记录不存在或已被删除');
        return;
      }
      msg.success('已删除');
      if (savedList.length === 1 && currentPage > 1) {
        setCurrentPage(currentPage - 1);
        return;
      }
      void loadSavedQueries();
    } catch (error) {
      const readable = error instanceof Error ? error.message : '删除失败';
      msg.error(readable);
    }
  }, [currentPage, loadSavedQueries, msg, savedList.length]);

  const handleExecute = useCallback(async (item: SavedQuery) => {
    const normalized = normalizeRealtimePresetQuery(item.query);
    const presetQuery = buildRealtimePresetQuery({
      queryText: normalized.queryText,
      filters: normalized.filters,
    });
    try {
      await navigator.clipboard.writeText(presetQuery);
      msg.success('已执行收藏查询并同步到剪贴板');
    } catch {
      msg.info(`请在实时检索页执行: ${presetQuery}`);
    }
    persistPendingRealtimeStartupQuery(presetQuery);
    navigate('/search/realtime', {
      state: {
        autoRun: true,
        presetQuery,
      },
    });
  }, [msg, navigate]);

  const handleCleanupDirtyQueries = useCallback(async () => {
    if (dirtySavedQueries.length === 0) {
      return;
    }
    setCleanupSubmitting(true);
    try {
      const results = await Promise.allSettled(dirtySavedQueries.map(({ item, cleanedQuery }) => updateSavedQuery(item.id, {
        name: item.name,
        query: cleanedQuery,
        tags: item.tags,
      })));
      let successCount = 0;
      let failedCount = 0;
      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          successCount += 1;
          return;
        }
        failedCount += 1;
      });

      if (successCount > 0) {
        msg.success(`已清洗 ${successCount} 条旧格式收藏查询`);
        void loadSavedQueries();
      }
      if (failedCount > 0) {
        msg.error(`${failedCount} 条收藏查询清洗失败，请稍后重试`);
      }
    } finally {
      setCleanupSubmitting(false);
    }
  }, [dirtySavedQueries, loadSavedQueries, msg]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Input.Search
          id="saved-query-search"
          name="saved-query-search"
          placeholder="搜索查询名称或语句..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onSearch={(value) => {
            setCurrentPage(1);
            setAppliedSearch(value.trim());
          }}
          allowClear
          style={{ width: 300 }}
        />
        <div className="flex items-center gap-2 flex-wrap">
          <Tag
            className="cursor-pointer"
            color={selectedTag === null ? 'blue' : undefined}
            onClick={() => {
              setSelectedTag(null);
              setCurrentPage(1);
            }}
          >
            全部
          </Tag>
          {mergedTags.map((tag) => (
            <Tag
              key={tag}
              className="cursor-pointer"
              color={selectedTag === tag ? 'blue' : undefined}
              onClick={() => {
                setSelectedTag(selectedTag === tag ? null : tag);
                setCurrentPage(1);
              }}
            >
              {tag}
            </Tag>
          ))}
        </div>
        <Button onClick={openCreateModal} type="primary">
          新建收藏
        </Button>
        <Button
          onClick={() => {
            setSearchText('');
            setAppliedSearch('');
            setSelectedTag(null);
            setCurrentPage(1);
          }}
        >
          重置
        </Button>
        <span className="text-sm opacity-50 ml-auto">
          共 {total.toLocaleString()} 个收藏
        </span>
      </div>

      {errorText && (
        <Alert
          type="error"
          showIcon
          message="收藏查询加载失败"
          description={errorText}
          action={<Button size="small" onClick={() => void loadSavedQueries()}>重试</Button>}
        />
      )}

      {dirtySavedQueries.length > 0 && (
        <Alert
          type="warning"
          showIcon
          message={`检测到 ${dirtySavedQueries.length} 条旧格式收藏查询`}
          description="这些查询仍包含历史回放遗留的时间范围，执行时虽然已兼容，但建议一键清洗，避免后续继续传播旧格式。"
          action={(
            <Button size="small" type="primary" loading={cleanupSubmitting} onClick={() => void handleCleanupDirtyQueries()}>
              一键清洗
            </Button>
          )}
        />
      )}

      {savedList.length === 0 && !loading ? (
        <Empty description="没有匹配的收藏查询" />
      ) : (
        <>
          <Row gutter={[16, 16]}>
            {savedQueryDiagnostics.map(({ item, normalized, needsCleanup }) => (
              <Col key={item.id} xs={24} md={12} xl={8}>
                <Card hoverable size="small" styles={{ body: { padding: 16 } }} loading={loading}>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="material-symbols-outlined text-base" style={{ color: COLORS.warning }}>
                          bookmark
                        </span>
                        <span className="text-sm font-medium">{item.name}</span>
                        {needsCleanup && <Tag color="warning" style={{ margin: 0 }}>旧格式</Tag>}
                        {Object.keys(normalized.filters).length > 0 && <Tag color="blue" style={{ margin: 0 }}>含筛选</Tag>}
                      </div>
                      <Space size={0}>
                        <Tooltip title="执行">
                          <Button
                            type="text"
                            size="small"
                            icon={<span className="material-symbols-outlined text-sm">play_arrow</span>}
                            onClick={() => void handleExecute(item)}
                          />
                        </Tooltip>
                        <Tooltip title="编辑">
                          <Button
                            type="text"
                            size="small"
                            icon={<span className="material-symbols-outlined text-sm">edit</span>}
                            onClick={() => openEditModal(item)}
                          />
                        </Tooltip>
                        <Popconfirm
                          title="确认删除"
                          description={`确定要删除「${item.name}」吗？`}
                          onConfirm={() => void handleDelete(item.id)}
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

                    <div
                      className="font-mono text-sm p-2 rounded overflow-hidden text-ellipsis whitespace-nowrap"
                      style={{ backgroundColor: 'rgba(0,0,0,0.06)' }}
                      title={item.query}
                    >
                      {item.query}
                    </div>

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

          <div className="flex justify-start">
            <Pagination
              current={currentPage}
              pageSize={pageSize}
              total={total}
              showSizeChanger
              showQuickJumper
              pageSizeOptions={['6', '12', '24', '48']}
              showTotal={(count) => `共 ${count} 条`}
              onChange={(page, size) => {
                setCurrentPage(page);
                setPageSize(size);
              }}
            />
          </div>
        </>
      )}

      <Modal
        title={modalMode === 'create' ? '新建收藏查询' : '编辑收藏查询'}
        open={editModalOpen}
        onOk={() => void handleSave()}
        onCancel={() => {
          setEditModalOpen(false);
          setEditingItem(null);
        }}
        okText={modalMode === 'create' ? '创建' : '保存'}
        cancelText="取消"
        forceRender
        destroyOnHidden
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item name="name" label="查询名称" rules={[{ required: true, message: '请输入查询名称' }]}>
            <Input placeholder="例如：支付服务错误" />
          </Form.Item>
          <Form.Item name="query" label="查询语句" rules={[{ required: true, message: '请输入查询语句' }]}>
            <Input.TextArea rows={3} placeholder='例如: level:error AND service:"payment-service"' className="font-mono" />
          </Form.Item>
          <Form.Item name="tags" label="标签">
            <Select
              mode="tags"
              placeholder="输入或选择标签"
              options={mergedTags.map((tag) => ({ label: tag, value: tag }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SavedQueries;
