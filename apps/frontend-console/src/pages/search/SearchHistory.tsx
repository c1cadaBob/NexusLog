import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Table, Input, Button, Tag, DatePicker, Space, Tooltip, App, Popconfirm, Alert, Empty } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Dayjs } from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { usePreferencesStore } from '../../stores/preferencesStore';
import type { QueryHistory } from '../../types/log';
import { createSavedQuery, deleteQueryHistory, fetchQueryHistory } from '../../api/query';
import { persistPendingRealtimeStartupQuery } from './realtimeStartupQuery';
import { buildQueryCleanupState } from './queryCleanupState';
import QueryCleanupPreviewContent from './queryCleanupPreviewContent';
import { usePaginationQuickJumperAccessibility } from '../../components/common/usePaginationQuickJumperAccessibility';

const SearchHistory: React.FC = () => {
  const { message, modal } = App.useApp();
  const navigate = useNavigate();

  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [rows, setRows] = useState<QueryHistory[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [batchDeleting, setBatchDeleting] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const storedPageSize = usePreferencesStore((s) => s.pageSizes['searchHistory'] ?? 15);
  const setStoredPageSize = usePreferencesStore((s) => s.setPageSize);
  const [pageSize, setPageSizeLocal] = useState(storedPageSize);
  const setPageSize = useCallback((size: number) => {
    setPageSizeLocal(size);
    setStoredPageSize('searchHistory', size);
  }, [setStoredPageSize]);
  const historyTableRef = usePaginationQuickJumperAccessibility('search-history');

  // 查询历史列表使用服务端分页，确保和后端真实数据一致。
  const loadHistory = useCallback(async () => {
    setLoading(true);
    setErrorText('');
    try {
      const result = await fetchQueryHistory({
        page: currentPage,
        pageSize,
        keyword,
        from: dateRange?.[0]?.toISOString(),
        to: dateRange?.[1]?.toISOString(),
      });
      setRows(result.items);
      setTotal(result.total);
      if (result.page !== currentPage) {
        setCurrentPage(result.page);
      }
      if (result.pageSize !== pageSize) {
        setPageSize(result.pageSize);
      }
    } catch (error) {
      const readable = error instanceof Error ? error.message : '查询历史加载失败';
      setErrorText(readable);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, keyword, dateRange, setPageSize]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const selectedHistoryIDs = useMemo(() => selectedRowKeys.map((key) => String(key)), [selectedRowKeys]);
  const visibleRange = useMemo(() => {
    if (total === 0 || rows.length === 0) {
      return { start: 0, end: 0 };
    }
    const start = (currentPage - 1) * pageSize + 1;
    return {
      start,
      end: start + rows.length - 1,
    };
  }, [currentPage, pageSize, rows.length, total]);

  const refreshAfterDelete = useCallback((deletedCount: number) => {
    setSelectedRowKeys([]);
    if (deletedCount <= 0) {
      void loadHistory();
      return;
    }
    const nextTotal = Math.max(0, total - deletedCount);
    const maxPage = Math.max(1, Math.ceil(nextTotal / pageSize));
    const nextPage = Math.min(currentPage, maxPage);
    if (nextPage !== currentPage) {
      setCurrentPage(nextPage);
      return;
    }
    void loadHistory();
  }, [currentPage, loadHistory, pageSize, total]);

  const handleSearch = useCallback((value: string) => {
    setSelectedRowKeys([]);
    setCurrentPage(1);
    setKeyword(value.trim());
  }, []);

  const handleReplay = useCallback(async (record: QueryHistory) => {
    const cleanupState = buildQueryCleanupState({ rawQuery: record.query });
    const replayQuery = cleanupState.rawQuery.trim();
    const hasHistoricalTimeRange = Boolean(
      cleanupState.normalized.timeRange?.from?.trim() || cleanupState.normalized.timeRange?.to?.trim(),
    );
    const replayMessage = hasHistoricalTimeRange
      ? '已跳转到实时检索并按原时间范围自动执行'
      : '已跳转到实时检索并自动执行';

    try {
      await navigator.clipboard.writeText(replayQuery);
      message.success(`${replayMessage}，并同步到剪贴板`);
    } catch {
      message.info(`${replayMessage}，但未能同步到剪贴板`);
    }

    persistPendingRealtimeStartupQuery(replayQuery);
    navigate('/search/realtime', {
      state: {
        autoRun: true,
        presetQuery: replayQuery,
      },
    });
  }, [message, navigate]);

  const handleBookmark = useCallback((record: QueryHistory) => {
    const now = new Date();
    const cleanupState = buildQueryCleanupState({ rawQuery: record.query });
    const persistBookmark = async () => {
      try {
        await createSavedQuery({
          name: `历史查询 ${now.toLocaleString('zh-CN')}`,
          query: cleanupState.cleanedQuery,
          tags: ['历史查询'],
        });
        message.success(cleanupState.normalized.strippedTimeRange ? '已收藏查询语句，并自动移除历史时间范围' : '已收藏查询语句');
      } catch (error) {
        const readable = error instanceof Error ? error.message : '收藏失败';
        message.error(readable);
      }
    };

    if (!cleanupState.needsCleanup) {
      void persistBookmark();
      return;
    }

    modal.confirm({
      title: '收藏前将清洗旧格式查询',
      okText: '收藏并清洗',
      cancelText: '取消',
      width: 720,
      content: (
        <QueryCleanupPreviewContent
          cleanupState={cleanupState}
          intro="该历史查询包含回放遗留的时间范围。为避免后续继续传播旧格式，收藏时将仅保留可复用的查询语义。"
          sourceQuery={record.query}
        />
      ),
      onOk: async () => {
        await persistBookmark();
      },
    });
  }, [message, modal]);

  const handleDelete = useCallback(async (historyID: string) => {
    try {
      const deleted = await deleteQueryHistory(historyID);
      if (!deleted) {
        message.warning('记录不存在或已被删除');
        return;
      }
      message.success('已删除');
      refreshAfterDelete(1);
    } catch (error) {
      const readable = error instanceof Error ? error.message : '删除失败';
      message.error(readable);
    }
  }, [message, refreshAfterDelete]);

  const handleBatchDelete = useCallback(async () => {
    if (selectedHistoryIDs.length === 0) {
      return;
    }
    setBatchDeleting(true);
    try {
      const results = await Promise.allSettled(selectedHistoryIDs.map((historyID) => deleteQueryHistory(historyID)));
      let deletedCount = 0;
      let missingCount = 0;
      let failedCount = 0;

      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          if (result.value) {
            deletedCount += 1;
          } else {
            missingCount += 1;
          }
          return;
        }
        failedCount += 1;
      });

      if (deletedCount > 0) {
        message.success(`已删除 ${deletedCount} 条记录`);
        refreshAfterDelete(deletedCount);
      } else {
        setSelectedRowKeys([]);
        void loadHistory();
      }

      if (missingCount > 0) {
        message.warning(`${missingCount} 条记录不存在或已被删除`);
      }
      if (failedCount > 0) {
        message.error(`${failedCount} 条记录删除失败，请稍后重试`);
      }
    } finally {
      setBatchDeleting(false);
    }
  }, [loadHistory, message, refreshAfterDelete, selectedHistoryIDs]);

  const columns: ColumnsType<QueryHistory> = useMemo(() => [
    {
      title: '序号',
      key: 'index',
      width: 80,
      align: 'center',
      render: (_: unknown, __: QueryHistory, index: number) => (
        <span className="text-sm opacity-60">
          {(currentPage - 1) * pageSize + index + 1}
        </span>
      ),
    },
    {
      title: '查询语句',
      dataIndex: 'query',
      key: 'query',
      ellipsis: true,
      render: (v: string) => <span className="font-mono text-sm pl-2">{v}</span>,
    },
    {
      title: '执行时间',
      dataIndex: 'executedAt',
      key: 'executedAt',
      width: 180,
      render: (v: string) => (
        <span className="text-sm opacity-70">
          {new Date(v).toLocaleString('zh-CN')}
        </span>
      ),
    },
    {
      title: '耗时',
      dataIndex: 'duration',
      key: 'duration',
      width: 100,
      render: (v: number) => {
        const color = v > 1000 ? 'error' : v > 500 ? 'warning' : 'success';
        return <Tag color={color} style={{ margin: 0, fontSize: 12 }}>{v}ms</Tag>;
      },
    },
    {
      title: '结果数量',
      dataIndex: 'resultCount',
      key: 'resultCount',
      width: 120,
      render: (v: number) => <span className="text-sm">{v.toLocaleString()}</span>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 170,
      render: (_: unknown, record: QueryHistory) => (
        <Space size="small">
          <Tooltip title="重新执行">
            <Button
              type="link"
              size="small"
              icon={<span className="material-symbols-outlined text-sm">replay</span>}
              onClick={() => void handleReplay(record)}
            />
          </Tooltip>
          <Tooltip title="收藏">
            <Button
              type="link"
              size="small"
              icon={<span className="material-symbols-outlined text-sm">bookmark_add</span>}
              onClick={() => void handleBookmark(record)}
            />
          </Tooltip>
          <Popconfirm
            title="确认删除"
            description="删除后不可恢复，是否继续？"
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            onConfirm={() => void handleDelete(record.id)}
          >
            <Tooltip title="删除">
              <Button
                type="link"
                size="small"
                danger
                icon={<span className="material-symbols-outlined text-sm">delete</span>}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ], [currentPage, handleBookmark, handleDelete, handleReplay, pageSize]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Input.Search
          id="search-history-keyword"
          name="search-history-keyword"
          autoComplete="off"
          placeholder="搜索查询语句..."
          value={keywordInput}
          onChange={(e) => setKeywordInput(e.target.value)}
          onSearch={handleSearch}
          allowClear
          style={{ width: 300 }}
        />
        <DatePicker.RangePicker
          id={{ start: 'search-history-start', end: 'search-history-end' }}
          showTime={{ format: 'HH:mm:ss' }}
          format="YYYY-MM-DD HH:mm:ss"
          onChange={(dates) => {
            setSelectedRowKeys([]);
            setCurrentPage(1);
            setDateRange(dates as [Dayjs | null, Dayjs | null] | null);
          }}
          placeholder={['开始时间', '结束时间']}
        />
        <Button
          onClick={() => {
            setSelectedRowKeys([]);
            setKeywordInput('');
            setKeyword('');
            setDateRange(null);
            setCurrentPage(1);
          }}
        >
          重置
        </Button>
        <Popconfirm
          title="确认批量删除"
          description={`将删除选中的 ${selectedHistoryIDs.length} 条查询历史，删除后不可恢复，是否继续？`}
          okText="删除"
          cancelText="取消"
          okButtonProps={{ danger: true, loading: batchDeleting }}
          disabled={selectedHistoryIDs.length === 0}
          onConfirm={() => void handleBatchDelete()}
        >
          <span>
            <Button
              danger
              disabled={selectedHistoryIDs.length === 0}
              loading={batchDeleting}
              icon={<span className="material-symbols-outlined text-sm">delete_sweep</span>}
            >
              批量删除
            </Button>
          </span>
        </Popconfirm>
        <span className="text-xs opacity-50">
          共 {total.toLocaleString()} 条记录
          {total > 0 ? `（当前显示第 ${visibleRange.start}-${visibleRange.end} 条）` : ''}
        </span>
        {selectedHistoryIDs.length > 0 && (
          <span className="text-xs text-blue-500">
            已选择 {selectedHistoryIDs.length} 项
          </span>
        )}
      </div>

      {errorText && (
        <Alert
          type="error"
          showIcon
          message="查询历史加载失败"
          description={errorText}
          action={<Button size="small" onClick={() => void loadHistory()}>重试</Button>}
        />
      )}

      <div ref={historyTableRef}>
        <Table<QueryHistory>
          dataSource={rows}
          columns={columns}
          rowKey="id"
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
            preserveSelectedRowKeys: true,
            getTitleCheckboxProps: () => ({
              id: 'search-history-select-all',
              name: 'search-history-select-all',
              'aria-label': '选择全部查询历史',
            }),
            getCheckboxProps: (record) => ({
              disabled: batchDeleting,
              id: `search-history-select-${record.id}`,
              name: `search-history-select-${record.id}`,
              'aria-label': `选择查询历史 ${record.id}`,
            }),
          }}
          size="small"
          loading={loading || batchDeleting}
          locale={{ emptyText: <Empty description="暂无查询历史" /> }}
          pagination={{
            current: currentPage,
            pageSize,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (count) => `共 ${count} 条`,
            pageSizeOptions: ['10', '15', '20', '50', '100'],
            position: ['bottomLeft'],
            onChange: (page, size) => {
              setSelectedRowKeys([]);
              setCurrentPage(page);
              setPageSize(size);
            },
          }}
        />
      </div>
    </div>
  );
};

export default SearchHistory;
