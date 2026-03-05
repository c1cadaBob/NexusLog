import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Table, Input, Button, Tag, DatePicker, Space, Tooltip, App, Popconfirm, Alert, Empty } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Dayjs } from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { usePreferencesStore } from '../../stores/preferencesStore';
import type { QueryHistory } from '../../types/log';
import { createSavedQuery, deleteQueryHistory, fetchQueryHistory } from '../../api/query';

const SearchHistory: React.FC = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();

  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [rows, setRows] = useState<QueryHistory[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const storedPageSize = usePreferencesStore((s) => s.pageSizes['searchHistory'] ?? 15);
  const setStoredPageSize = usePreferencesStore((s) => s.setPageSize);
  const [pageSize, setPageSizeLocal] = useState(storedPageSize);
  const setPageSize = useCallback((size: number) => {
    setPageSizeLocal(size);
    setStoredPageSize('searchHistory', size);
  }, [setStoredPageSize]);

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

  const handleSearch = useCallback((value: string) => {
    setCurrentPage(1);
    setKeyword(value.trim());
  }, []);

  const handleReplay = useCallback(async (record: QueryHistory) => {
    try {
      await navigator.clipboard.writeText(record.query);
      message.success('已执行历史查询并同步到剪贴板');
    } catch {
      message.info(`请在实时检索页执行: ${record.query}`);
    }
    navigate('/search/realtime', {
      state: {
        autoRun: true,
        presetQuery: record.query,
      },
    });
  }, [message, navigate]);

  const handleBookmark = useCallback(async (record: QueryHistory) => {
    try {
      const now = new Date();
      await createSavedQuery({
        name: `历史查询 ${now.toLocaleString('zh-CN')}`,
        query: record.query,
        tags: ['历史查询'],
      });
      message.success('已收藏查询语句');
    } catch (error) {
      const readable = error instanceof Error ? error.message : '收藏失败';
      message.error(readable);
    }
  }, [message]);

  const handleDelete = useCallback(async (historyID: string) => {
    try {
      const deleted = await deleteQueryHistory(historyID);
      if (!deleted) {
        message.warning('记录不存在或已被删除');
        return;
      }
      message.success('已删除');
      // 删除后刷新当前页数据，若当前页为空则回退一页。
      if (rows.length === 1 && currentPage > 1) {
        setCurrentPage(currentPage - 1);
        return;
      }
      void loadHistory();
    } catch (error) {
      const readable = error instanceof Error ? error.message : '删除失败';
      message.error(readable);
    }
  }, [currentPage, loadHistory, message, rows.length]);

  const columns: ColumnsType<QueryHistory> = useMemo(() => [
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
  ], [handleBookmark, handleDelete, handleReplay]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Input.Search
          id="search-history-keyword"
          name="search-history-keyword"
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
            setCurrentPage(1);
            setDateRange(dates as [Dayjs | null, Dayjs | null] | null);
          }}
          placeholder={['开始时间', '结束时间']}
        />
        <Button
          onClick={() => {
            setKeywordInput('');
            setKeyword('');
            setDateRange(null);
            setCurrentPage(1);
          }}
        >
          重置
        </Button>
        <span className="text-xs opacity-50">
          共 {total.toLocaleString()} 条记录
        </span>
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

      <Table<QueryHistory>
        dataSource={rows}
        columns={columns}
        rowKey="id"
        size="small"
        loading={loading}
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
            setCurrentPage(page);
            setPageSize(size);
          },
        }}
      />
    </div>
  );
};

export default SearchHistory;
