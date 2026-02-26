import React, { useState, useMemo, useCallback } from 'react';
import { Table, Input, Button, Tag, DatePicker, Space, Tooltip, App } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Dayjs } from 'dayjs';
import { usePreferencesStore } from '../../stores/preferencesStore';
import type { QueryHistory } from '../../types/log';

// ============================================================================
// 模拟数据
// ============================================================================
const MOCK_HISTORY: QueryHistory[] = Array.from({ length: 30 }, (_, i) => {
  const queries = [
    'level:error AND service:payment-service',
    'status:500 OR status:502',
    'service:order-api AND message:"timeout"',
    'level:warn AND host:node-03',
    'service:auth-service AND level:error',
    'message:"connection refused"',
    'service:gateway AND duration:>1000',
    'level:info AND service:user-service',
    'status:429 AND service:*',
    'message:"OOM" OR message:"out of memory"',
  ];
  const ts = new Date(Date.now() - i * 3600000 - Math.random() * 1800000);
  return {
    id: `qh-${String(i + 1).padStart(3, '0')}`,
    query: queries[i % queries.length],
    executedAt: ts.toISOString(),
    duration: Math.floor(50 + Math.random() * 2000),
    resultCount: Math.floor(Math.random() * 5000),
  };
});

// ============================================================================
// SearchHistory 主组件
// ============================================================================
const SearchHistory: React.FC = () => {
  const { message } = App.useApp();

  // 筛选状态
  const [keyword, setKeyword] = useState('');
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const storedPageSize = usePreferencesStore((s) => s.pageSizes['searchHistory'] ?? 15);
  const setStoredPageSize = usePreferencesStore((s) => s.setPageSize);
  const [pageSize, setPageSizeLocal] = useState(storedPageSize);
  const setPageSize = useCallback((size: number) => {
    setPageSizeLocal(size);
    setStoredPageSize('searchHistory', size);
  }, [setStoredPageSize]);

  // 筛选后的数据
  const filteredData = useMemo(() => {
    let data = MOCK_HISTORY;
    if (keyword.trim()) {
      const kw = keyword.toLowerCase();
      data = data.filter((item) => item.query.toLowerCase().includes(kw));
    }
    if (dateRange && dateRange[0] && dateRange[1]) {
      const start = dateRange[0].startOf('day').valueOf();
      const end = dateRange[1].endOf('day').valueOf();
      data = data.filter((item) => {
        const t = new Date(item.executedAt).getTime();
        return t >= start && t <= end;
      });
    }
    return data;
  }, [keyword, dateRange]);

  // 表格列定义
  const columns: ColumnsType<QueryHistory> = useMemo(() => [
    {
      title: '查询语句',
      dataIndex: 'query',
      key: 'query',
      ellipsis: true,
      render: (v: string) => (
        <span className="font-mono text-sm pl-2">{v}</span>
      ),
    },
    {
      title: '执行时间',
      dataIndex: 'executedAt',
      key: 'executedAt',
      width: 170,
      sorter: (a, b) => new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime(),
      defaultSortOrder: 'descend',
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
      sorter: (a, b) => a.duration - b.duration,
      render: (v: number) => {
        const color = v > 1000 ? 'error' : v > 500 ? 'warning' : 'success';
        return <Tag color={color} style={{ margin: 0, fontSize: 12 }}>{v}ms</Tag>;
      },
    },
    {
      title: '结果数量',
      dataIndex: 'resultCount',
      key: 'resultCount',
      width: 110,
      sorter: (a, b) => a.resultCount - b.resultCount,
      render: (v: number) => <span className="text-sm">{v.toLocaleString()}</span>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      render: (_: unknown, record: QueryHistory) => (
        <Space size="small">
          <Tooltip title="重新执行">
            <Button
              type="link"
              size="small"
              icon={<span className="material-symbols-outlined text-sm">replay</span>}
              onClick={() => message.info(`重新执行: ${record.query}`)}
            />
          </Tooltip>
          <Tooltip title="收藏">
            <Button
              type="link"
              size="small"
              icon={<span className="material-symbols-outlined text-sm">bookmark_add</span>}
              onClick={() => message.success(`已收藏: ${record.query}`)}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Button
              type="link"
              size="small"
              danger
              icon={<span className="material-symbols-outlined text-sm">delete</span>}
              onClick={() => message.success('已删除')}
            />
          </Tooltip>
        </Space>
      ),
    },
  ], [message]);

  return (
    <div className="flex flex-col gap-4">
      {/* 筛选栏 */}
      <div className="flex items-center gap-3 flex-wrap">
        <Input.Search
          placeholder="搜索查询语句..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          allowClear
          style={{ width: 300 }}
        />
        <DatePicker.RangePicker
          showTime={{ format: 'HH:mm:ss' }}
          format="YYYY-MM-DD HH:mm:ss"
          onChange={(dates) => setDateRange(dates as [Dayjs | null, Dayjs | null] | null)}
          placeholder={['开始时间', '结束时间']}
        />
        <span className="text-xs opacity-50">
          共 {filteredData.length} 条记录
        </span>
      </div>

      {/* 查询历史表格 */}
      <Table<QueryHistory>
        dataSource={filteredData}
        columns={columns}
        rowKey="id"
        size="small"
        pagination={{
          current: currentPage,
          pageSize,
          total: filteredData.length,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条`,
          pageSizeOptions: ['10', '15', '20', '50', '100'],
          position: ['bottomLeft'],
          onChange: (page, size) => { setCurrentPage(page); setPageSize(size); },
        }}
      />
    </div>
  );
};

export default SearchHistory;
