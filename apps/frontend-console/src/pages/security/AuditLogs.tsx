import React, { useState, useCallback, useEffect } from 'react';
import { Input, Select, Table, Tag, Button, Card, DatePicker, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useThemeStore } from '../../stores/themeStore';
import { COLORS, DARK_PALETTE, LIGHT_PALETTE } from '../../theme/tokens';
import { fetchAuditLogs, type AuditLogItem, type FetchAuditLogsParams } from '../../api/audit';
import dayjs from 'dayjs';

// ============================================================================
// 辅助
// ============================================================================

const actionTagColor: Record<string, string> = {
  update: 'processing',
  delete: 'error',
  create: 'success',
  login: 'default',
  read: 'default',
};

// ============================================================================
// 组件
// ============================================================================

const AuditLogs: React.FC = () => {
  const isDark = useThemeStore((s) => s.isDark);
  const palette = isDark ? DARK_PALETTE : LIGHT_PALETTE;

  const [userFilter, setUserFilter] = useState('');
  const [actionFilter, setActionFilter] = useState<string | undefined>(undefined);
  const [resourceTypeFilter, setResourceTypeFilter] = useState<string | undefined>(undefined);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const loadData = useCallback(async (pageOverride?: number) => {
    setLoading(true);
    setError(null);
    const p = pageOverride ?? page;
    try {
      const params: FetchAuditLogsParams = {
        page: p,
        page_size: pageSize,
        user_id: userFilter.trim() || undefined,
        action: actionFilter,
        resource_type: resourceTypeFilter,
        from: dateRange[0]?.toISOString(),
        to: dateRange[1]?.toISOString(),
        sort_by: 'created_at',
        sort_order: 'desc',
      };
      const result = await fetchAuditLogs(params);
      setItems(result.items);
      setTotal(result.total);
      if (pageOverride != null) setPage(pageOverride);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载审计日志失败';
      message.error(msg);
      setError(msg);
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, userFilter, actionFilter, resourceTypeFilter, dateRange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSearch = useCallback(() => {
    loadData(1);
  }, [loadData]);

  const handleReset = useCallback(() => {
    setUserFilter('');
    setActionFilter(undefined);
    setResourceTypeFilter(undefined);
    setDateRange([null, null]);
    setPage(1);
  }, []);

  const columns: ColumnsType<AuditLogItem> = [
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (text: string) => (
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: palette.textSecondary }}>
          {text ? dayjs(text).format('YYYY-MM-DD HH:mm:ss') : '-'}
        </span>
      ),
    },
    {
      title: '用户',
      dataIndex: 'user_id',
      key: 'user_id',
      width: 140,
      render: (text: string) => (
        <span style={{ fontWeight: 500, fontSize: 13 }}>{text || '-'}</span>
      ),
    },
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      width: 100,
      render: (action: string) => (
        <Tag color={actionTagColor[(action || '').toLowerCase()] || 'default'}>{action || '-'}</Tag>
      ),
    },
    {
      title: '资源类型',
      dataIndex: 'resource_type',
      key: 'resource_type',
      width: 120,
      render: (text: string) => (
        <span style={{ color: palette.textSecondary, fontSize: 13 }}>{text || '-'}</span>
      ),
    },
    {
      title: '资源ID',
      dataIndex: 'resource_id',
      key: 'resource_id',
      width: 140,
      render: (text: string) => (
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: palette.textSecondary }}>{text || '-'}</span>
      ),
    },
    {
      title: 'IP',
      dataIndex: 'ip_address',
      key: 'ip_address',
      width: 130,
      render: (text: string) => (
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: palette.textSecondary }}>{text || '-'}</span>
      ),
    },
    {
      title: '详情',
      dataIndex: 'detail',
      key: 'detail',
      ellipsis: true,
      render: (detail: Record<string, unknown> | undefined) => {
        if (!detail || Object.keys(detail).length === 0) return '-';
        return (
          <span style={{ fontSize: 12, color: palette.textSecondary }}>
            {JSON.stringify(detail)}
          </span>
        );
      },
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* 顶部栏 */}
      <div style={{ height: 56, padding: '0 24px', borderBottom: `1px solid ${palette.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, background: isDark ? '#111722' : palette.bgContainer }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>审计日志</h2>
          <Tag style={{ fontSize: 10 }}>Audit Logs</Tag>
        </div>
      </div>

      {/* 筛选区域 */}
      <div style={{ padding: '16px 24px', flexShrink: 0 }}>
        <Card size="small" style={{ background: palette.bgContainer, borderColor: palette.border }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16, alignItems: 'end' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>用户</div>
              <Input
                prefix={<span className="material-symbols-outlined" style={{ fontSize: 18, color: palette.textSecondary }}>person</span>}
                placeholder="输入用户ID..."
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                allowClear
              />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>操作类型</div>
              <Select
                placeholder="全部"
                value={actionFilter}
                onChange={setActionFilter}
                allowClear
                style={{ width: '100%' }}
                options={[
                  { value: 'login', label: '登录' },
                  { value: 'create', label: '创建' },
                  { value: 'update', label: '更新' },
                  { value: 'delete', label: '删除' },
                  { value: 'read', label: '读取' },
                ]}
              />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>资源类型</div>
              <Select
                placeholder="全部"
                value={resourceTypeFilter}
                onChange={setResourceTypeFilter}
                allowClear
                style={{ width: '100%' }}
                options={[
                  { value: 'dashboard', label: '仪表盘' },
                  { value: 'alert', label: '告警规则' },
                  { value: 'user', label: '用户' },
                  { value: 'system', label: '系统' },
                ]}
              />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>时间范围</div>
              <DatePicker.RangePicker
                value={dateRange}
                onChange={(dates) => setDateRange(dates as [dayjs.Dayjs | null, dayjs.Dayjs | null])}
                showTime
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button type="primary" onClick={handleSearch} loading={loading}
                icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>search</span>}
              >
                查询
              </Button>
              <Button onClick={handleReset}
                icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>refresh</span>}
              >
                重置
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* 表格 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 24px 24px' }}>
        <Table<AuditLogItem>
          columns={columns}
          dataSource={items}
          rowKey="id"
          size="middle"
          loading={loading}
          locale={{ emptyText: error || '暂无数据' }}
          pagination={{
            current: page,
            pageSize,
            total,
            showTotal: (t, range) => `显示 ${range[0]} 到 ${range[1]} 条，共 ${t} 条记录`,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps ?? 10);
            },
          }}
        />
      </div>
    </div>
  );
};

export default AuditLogs;
