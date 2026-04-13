import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Empty, Input, Select, Space, Statistic, Table, Tag, Tooltip, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { fetchStorageIndices, formatStorageBytes, formatStorageCount } from '../../api/storage';
import { useThemeStore } from '../../stores/themeStore';
import { usePreferencesStore } from '../../stores/preferencesStore';
import { COLORS, DARK_PALETTE, LIGHT_PALETTE } from '../../theme/tokens';
import type { IndexInfo, IndexHealth, IndexStatus, IndexSummary } from '../../types/storage';
import { INDEX_HEALTH_CONFIG } from '../../types/storage';

const MAINTENANCE_TOOLTIP = '当前版本仅接入真实索引读取，索引维护动作暂未开放';

const EMPTY_SUMMARY: IndexSummary = {
  total: 0,
  green: 0,
  yellow: 0,
  red: 0,
  docsCount: 0,
  storeSizeBytes: 0,
  refreshedAt: undefined,
};

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  return '加载索引列表失败';
}

function formatRefreshTime(timestamp?: number): string {
  if (!timestamp || Number.isNaN(timestamp)) {
    return '-';
  }
  return new Date(timestamp).toLocaleString('zh-CN', { hour12: false });
}

const IndexManagement: React.FC = () => {
  const isDark = useThemeStore((s) => s.isDark);
  const p = isDark ? DARK_PALETTE : LIGHT_PALETTE;

  const [items, setItems] = useState<IndexInfo[]>([]);
  const [summary, setSummary] = useState<IndexSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<IndexStatus | 'all'>('all');
  const [healthFilter, setHealthFilter] = useState<IndexHealth | 'all'>('all');
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const storedPageSize = usePreferencesStore((s) => s.pageSizes.indexManagement ?? 10);
  const setStoredPageSize = usePreferencesStore((s) => s.setPageSize);
  const [pageSize, setPageSizeLocal] = useState(storedPageSize);

  const setPageSize = useCallback((size: number) => {
    setPageSizeLocal(size);
    setStoredPageSize('indexManagement', size);
  }, [setStoredPageSize]);

  const loadIndices = useCallback(async (options?: { showSuccess?: boolean; showError?: boolean }) => {
    setLoading(true);
    try {
      const result = await fetchStorageIndices();
      setItems(result.items);
      setSummary(result.summary);
      setLoadError(null);
      if (options?.showSuccess) {
        message.success(`索引列表已刷新，共 ${result.summary.total} 个索引`);
      }
    } catch (error) {
      const nextError = normalizeErrorMessage(error);
      setLoadError(nextError);
      if (options?.showError !== false) {
        message.error(nextError);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadIndices({ showError: false });
  }, [loadIndices]);

  const filteredIndices = useMemo(() => {
    return items.filter((item) => {
      if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (healthFilter !== 'all' && item.health !== healthFilter) return false;
      return true;
    });
  }, [healthFilter, items, search, statusFilter]);

  const columns: ColumnsType<IndexInfo> = [
    {
      title: '索引名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => (
        <span style={{ fontWeight: 500, color: COLORS.primary }}>{name}</span>
      ),
    },
    {
      title: '健康度',
      dataIndex: 'health',
      key: 'health',
      width: 100,
      render: (health: IndexHealth) => {
        const cfg = INDEX_HEALTH_CONFIG[health];
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: cfg.color,
                boxShadow: health === 'Green' ? `0 0 6px ${cfg.color}` : undefined,
              }}
            />
            <span style={{ fontSize: 12, fontWeight: 500, color: cfg.color }}>{cfg.label}</span>
          </div>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status: IndexStatus) => (
        <Tag color={status === 'Open' ? 'success' : 'default'}>{status === 'Open' ? '开启' : '关闭'}</Tag>
      ),
    },
    {
      title: '主分片 / 副本',
      dataIndex: 'shards',
      key: 'shards',
      width: 120,
      render: (value: string) => <span style={{ color: p.textSecondary }}>{value}</span>,
    },
    {
      title: '文档数',
      dataIndex: 'docs',
      key: 'docs',
      width: 120,
      align: 'right',
      render: (value: string) => <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{value}</span>,
    },
    {
      title: '存储大小',
      dataIndex: 'size',
      key: 'size',
      width: 120,
      align: 'right',
      render: (value: string) => <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{value}</span>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 140,
      align: 'right',
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title={MAINTENANCE_TOOLTIP}>
            <span>
              <Button
                type="text"
                size="small"
                disabled
                aria-label={`${record.status === 'Open' ? '关闭' : '开启'}索引 ${record.name}`}
                icon={
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: p.textSecondary }}>
                    {record.status === 'Open' ? 'lock' : 'lock_open'}
                  </span>
                }
              />
            </span>
          </Tooltip>
          <Tooltip title={MAINTENANCE_TOOLTIP}>
            <span>
              <Button
                type="text"
                size="small"
                disabled
                aria-label={`删除索引 ${record.name}`}
                icon={<span className="material-symbols-outlined" style={{ fontSize: 18, color: p.textSecondary }}>delete</span>}
              />
            </span>
          </Tooltip>
          <Tooltip title={MAINTENANCE_TOOLTIP}>
            <span>
              <Button
                type="text"
                size="small"
                disabled
                aria-label={`更多索引操作 ${record.name}`}
                icon={<span className="material-symbols-outlined" style={{ fontSize: 18, color: p.textSecondary }}>more_vert</span>}
              />
            </span>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>索引管理</h2>
          <div style={{ marginTop: 8, color: p.textSecondary, fontSize: 14 }}>
            实时展示 Elasticsearch 索引状态、健康度与存储使用情况。
          </div>
          <div style={{ marginTop: 8, color: p.textSecondary, fontSize: 12 }}>
            最近更新：{formatRefreshTime(summary.refreshedAt)}
          </div>
        </div>
        <Space wrap>
          <Button
            icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>help</span>}
            onClick={() => message.info('当前页已接入真实索引列表，索引维护动作将在后续版本开放')}
          >
            帮助
          </Button>
          <Button
            icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>refresh</span>}
            loading={loading}
            onClick={() => void loadIndices({ showSuccess: true, showError: true })}
          >
            刷新
          </Button>
          <Tooltip title={MAINTENANCE_TOOLTIP}>
            <span>
              <Button
                type="primary"
                disabled
                icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>}
              >
                新建索引
              </Button>
            </span>
          </Tooltip>
        </Space>
      </div>

      <Alert
        type="info"
        showIcon
        message="当前页已接入真实索引列表"
        description="索引维护动作（新建 / 开关 / 删除）尚未接入后端安全控制，当前版本保持只读展示。"
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16 }}>
        <Card size="small" styles={{ body: { padding: '20px' } }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Statistic title="索引总数" value={summary.total} valueStyle={{ fontSize: 28, fontWeight: 700 }} />
            <div style={{ padding: 8, borderRadius: 8, background: `${COLORS.primary}1a` }}>
              <span className="material-symbols-outlined" style={{ color: COLORS.primary }}>list_alt</span>
            </div>
          </div>
        </Card>
        <Card size="small" styles={{ body: { padding: '20px' } }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 12, color: p.textSecondary, marginBottom: 8 }}>集群健康</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 4, background: `${COLORS.success}1a`, border: `1px solid ${COLORS.success}33` }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: COLORS.success }} />
                  <span style={{ fontWeight: 700, fontSize: 14, color: COLORS.success }}>{summary.green}</span>
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 4, background: `${COLORS.warning}1a`, border: `1px solid ${COLORS.warning}33` }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: COLORS.warning }} />
                  <span style={{ fontWeight: 700, fontSize: 14, color: COLORS.warning }}>{summary.yellow}</span>
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 4, background: `${COLORS.danger}1a`, border: `1px solid ${COLORS.danger}33` }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: COLORS.danger }} />
                  <span style={{ fontWeight: 700, fontSize: 14, color: COLORS.danger }}>{summary.red}</span>
                </span>
              </div>
            </div>
            <div style={{ padding: 8, borderRadius: 8, background: `${COLORS.success}1a` }}>
              <span className="material-symbols-outlined" style={{ color: COLORS.success }}>health_and_safety</span>
            </div>
          </div>
        </Card>
        <Card size="small" styles={{ body: { padding: '20px' } }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Statistic title="文档总数" value={formatStorageCount(summary.docsCount)} valueStyle={{ fontSize: 28, fontWeight: 700 }} />
            <div style={{ padding: 8, borderRadius: 8, background: `${COLORS.info}1a` }}>
              <span className="material-symbols-outlined" style={{ color: COLORS.info }}>description</span>
            </div>
          </div>
        </Card>
        <Card size="small" styles={{ body: { padding: '20px' } }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Statistic title="存储总量" value={formatStorageBytes(summary.storeSizeBytes)} valueStyle={{ fontSize: 28, fontWeight: 700 }} />
            <div style={{ padding: 8, borderRadius: 8, background: `${COLORS.purple}1a` }}>
              <span className="material-symbols-outlined" style={{ color: COLORS.purple }}>hard_drive</span>
            </div>
          </div>
        </Card>
      </div>

      <Card
        style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' } }}
      >
        <div style={{ padding: '16px 24px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, borderBottom: `1px solid ${p.border}` }}>
          <Input
            id="index-management-search"
            name="index-management-search"
            prefix={<span className="material-symbols-outlined" style={{ fontSize: 20, color: p.textSecondary }}>search</span>}
            placeholder="输入索引名称..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 240, maxWidth: 400 }}
            allowClear
          />
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 140 }}
            options={[
              { value: 'all', label: '全部状态' },
              { value: 'Open', label: '开启 (Open)' },
              { value: 'Closed', label: '关闭 (Closed)' },
            ]}
          />
          <Select
            value={healthFilter}
            onChange={setHealthFilter}
            style={{ width: 150 }}
            options={[
              { value: 'all', label: '全部健康度' },
              { value: 'Green', label: '🟢 绿色 (Green)' },
              { value: 'Yellow', label: '🟡 黄色 (Yellow)' },
              { value: 'Red', label: '🔴 红色 (Red)' },
              { value: 'Unknown', label: '⚪ 未知 (Unknown)' },
            ]}
          />
        </div>

        <div style={{ padding: loadError ? '16px 24px 0' : '0 24px', flexShrink: 0 }}>
          {loadError ? (
            <Alert
              type="warning"
              showIcon
              message="索引列表加载失败"
              description={loadError}
              action={<Button size="small" onClick={() => void loadIndices({ showError: true })}>重试</Button>}
            />
          ) : null}
        </div>

        <div style={{ flex: 1, overflow: 'auto' }}>
          <Table<IndexInfo>
            rowKey="name"
            columns={columns}
            dataSource={filteredIndices}
            loading={loading}
            size="middle"
            rowSelection={{
              selectedRowKeys,
              onChange: setSelectedRowKeys,
              getTitleCheckboxProps: () => ({
                name: 'index-management-select-all',
                'aria-label': '选择全部索引',
              }),
              getCheckboxProps: (record) => ({
                name: `index-management-select-${record.name}`,
                'aria-label': `选择索引 ${record.name}`,
              }),
            }}
            pagination={{
              pageSize,
              showSizeChanger: true,
              showTotal: (total, range) => `显示 ${range[0]} 到 ${range[1]} 条，共 ${total} 条结果`,
              onShowSizeChange: (_, size) => setPageSize(size),
            }}
            locale={{
              emptyText: <Empty description={loading ? '正在加载索引...' : '暂无索引数据'} />,
            }}
            scroll={{ x: 860 }}
          />
        </div>
      </Card>
    </div>
  );
};

export default IndexManagement;
