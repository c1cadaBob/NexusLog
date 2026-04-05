import React, { useState, useMemo, useCallback } from 'react';
import { Input, Select, Table, Tag, Button, Card, Statistic, Space, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useThemeStore } from '../../stores/themeStore';
import { usePreferencesStore } from '../../stores/preferencesStore';
import { COLORS, DARK_PALETTE, LIGHT_PALETTE } from '../../theme/tokens';
import type { IndexInfo, IndexHealth, IndexStatus } from '../../types/storage';
import { INDEX_HEALTH_CONFIG } from '../../types/storage';

// ============================================================================
// 模拟数据
// ============================================================================

const mockIndices: IndexInfo[] = [
  { name: 'log-nginx-2023.10.25', health: 'Green', status: 'Open', shards: '5 / 1', docs: '1,204,500', size: '450 MB' },
  { name: 'log-app-error-2023.10.25', health: 'Yellow', status: 'Open', shards: '3 / 1', docs: '52,300', size: '120 MB' },
  { name: 'metric-system-2023.10.24', health: 'Red', status: 'Open', shards: '1 / 0', docs: '8,900', size: '45 MB' },
  { name: 'log-old-archive-2023.01', health: 'Unknown', status: 'Closed', shards: '5 / 1', docs: '4,500,000', size: '1.2 GB' },
  { name: 'log-audit-2023.10', health: 'Green', status: 'Open', shards: '3 / 1', docs: '220,110', size: '890 MB' },
];

// ============================================================================
// 组件
// ============================================================================

const IndexManagement: React.FC = () => {
  const isDark = useThemeStore((s) => s.isDark);
  const p = isDark ? DARK_PALETTE : LIGHT_PALETTE;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<IndexStatus | 'all'>('all');
  const [healthFilter, setHealthFilter] = useState<IndexHealth | 'all'>('all');
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const storedPageSize = usePreferencesStore((s) => s.pageSizes['indexManagement'] ?? 10);
  const setStoredPageSize = usePreferencesStore((s) => s.setPageSize);
  const [pageSize, setPageSizeLocal] = useState(storedPageSize);
  const setPageSize = useCallback((size: number) => {
    setPageSizeLocal(size);
    setStoredPageSize('indexManagement', size);
  }, [setStoredPageSize]);

  const filteredIndices = useMemo(() => {
    return mockIndices.filter(idx => {
      if (search && !idx.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter !== 'all' && idx.status !== statusFilter) return false;
      if (healthFilter !== 'all' && idx.health !== healthFilter) return false;
      return true;
    });
  }, [search, statusFilter, healthFilter]);

  // 统计
  const stats = useMemo(() => ({
    total: mockIndices.length,
    green: mockIndices.filter(i => i.health === 'Green').length,
    yellow: mockIndices.filter(i => i.health === 'Yellow').length,
    red: mockIndices.filter(i => i.health === 'Red').length,
  }), []);

  const columns: ColumnsType<IndexInfo> = [
    {
      title: '索引名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => (
        <span style={{ fontWeight: 500, color: COLORS.primary, cursor: 'pointer' }}>{name}</span>
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
            <span style={{
              width: 8, height: 8, borderRadius: '50%', background: cfg.color,
              boxShadow: health === 'Green' ? `0 0 6px ${cfg.color}` : undefined,
            }} />
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
        <Tag color={status === 'Open' ? 'success' : 'default'}>
          {status === 'Open' ? '开启' : '关闭'}
        </Tag>
      ),
    },
    {
      title: '主分片 / 副本',
      dataIndex: 'shards',
      key: 'shards',
      width: 120,
      render: (v: string) => <span style={{ color: p.textSecondary }}>{v}</span>,
    },
    {
      title: '文档数',
      dataIndex: 'docs',
      key: 'docs',
      width: 120,
      align: 'right',
      render: (v: string) => <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{v}</span>,
    },
    {
      title: '存储大小',
      dataIndex: 'size',
      key: 'size',
      width: 110,
      align: 'right',
      render: (v: string) => <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{v}</span>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      align: 'right',
      render: (_, record) => (
        <Space size={4}>
          <Button type="text" size="small" title={record.status === 'Open' ? '关闭索引' : '开启索引'}
            icon={<span className="material-symbols-outlined" style={{ fontSize: 18, color: p.textSecondary }}>{record.status === 'Open' ? 'lock' : 'lock_open'}</span>}
          />
          <Button type="text" size="small" title="删除"
            icon={<span className="material-symbols-outlined" style={{ fontSize: 18, color: p.textSecondary }}>delete</span>}
          />
          <Button type="text" size="small" title="更多"
            icon={<span className="material-symbols-outlined" style={{ fontSize: 18, color: p.textSecondary }}>more_vert</span>}
          />
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, height: '100%' }}>
      {/* 头部 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>索引管理</h2>
          <p style={{ margin: 0, fontSize: 12, color: p.textSecondary }}>管理和监控 Elasticsearch 索引状态、健康度和存储使用情况。</p>
        </div>
        <Space>
          <Button onClick={() => { window.location.hash = '#/help/faq'; }} icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>help</span>}>
            帮助
          </Button>
          <Button
            icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>refresh</span>}
            onClick={() => message.info('正在刷新...')}
          >刷新</Button>
          <Button type="primary"
            icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>}
          >新建索引</Button>
        </Space>
      </div>

      {/* 统计卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <Card size="small" styles={{ body: { padding: '20px' } }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Statistic title="索引总数" value={142} valueStyle={{ fontSize: 28, fontWeight: 700 }}
              suffix={<span style={{ fontSize: 12, color: COLORS.success, fontWeight: 500 }}>+2</span>}
            />
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
                  <span style={{ fontWeight: 700, fontSize: 14, color: COLORS.success }}>{stats.green}</span>
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 4, background: `${COLORS.warning}1a`, border: `1px solid ${COLORS.warning}33` }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: COLORS.warning }} />
                  <span style={{ fontWeight: 700, fontSize: 14, color: COLORS.warning }}>{stats.yellow}</span>
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 4, background: `${COLORS.danger}1a`, border: `1px solid ${COLORS.danger}33` }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: COLORS.danger }} />
                  <span style={{ fontWeight: 700, fontSize: 14, color: COLORS.danger }}>{stats.red}</span>
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
            <Statistic title="文档总数" value="8.4 B" valueStyle={{ fontSize: 28, fontWeight: 700 }} />
            <div style={{ padding: 8, borderRadius: 8, background: `${COLORS.info}1a` }}>
              <span className="material-symbols-outlined" style={{ color: COLORS.info }}>description</span>
            </div>
          </div>
        </Card>
        <Card size="small" styles={{ body: { padding: '20px' } }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Statistic title="存储总量" value="4.2 TB" valueStyle={{ fontSize: 28, fontWeight: 700 }} />
            <div style={{ padding: 8, borderRadius: 8, background: `${COLORS.purple}1a` }}>
              <span className="material-symbols-outlined" style={{ color: COLORS.purple }}>hard_drive</span>
            </div>
          </div>
        </Card>
      </div>

      {/* 主表格卡片 */}
      <Card
        style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' } }}
      >
        {/* 过滤器 */}
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
            ]}
          />
        </div>

        {/* 表格 */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          <Table<IndexInfo>
            rowKey="name"
            columns={columns}
            dataSource={filteredIndices}
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
            scroll={{ x: 800 }}
          />
        </div>
      </Card>
    </div>
  );
};

export default IndexManagement;
