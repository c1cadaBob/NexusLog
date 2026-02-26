import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Tag, Input, Card, Button, Modal, Descriptions, Space, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useThemeStore } from '../../stores/themeStore';
import { COLORS } from '../../theme/tokens';
import type { IncidentArchive as ArchiveType } from '../../types/incident';

// ============================================================================
// 模拟数据
// ============================================================================

const now = Date.now();
const MOCK_ARCHIVES: ArchiveType[] = [
  {
    id: 'arc-001', incidentId: 'INC-20260215-005',
    reportUrl: '/archives/INC-20260215-005/report.pdf',
    logBundleUrl: 's3://nexuslog-archives/INC-20260215-005/logs.tar.gz',
    hash: 'sha256:a1b2c3d4e5f6...', retentionDays: 365,
    archivedBy: '张运维', archivedAt: now - 345600000,
    postmortemSummary: 'Gateway TLS 证书过期导致全部外部 API 不可用约 20 分钟。根因：证书管理流程缺失。已部署 cert-manager 自动续期并建立三级告警。',
  },
  {
    id: 'arc-002', incidentId: 'INC-20260210-010',
    reportUrl: '/archives/INC-20260210-010/report.pdf',
    logBundleUrl: 's3://nexuslog-archives/INC-20260210-010/logs.tar.gz',
    hash: 'sha256:b2c3d4e5f6a1...', retentionDays: 180,
    archivedBy: '李运维', archivedAt: now - 864000000,
    postmortemSummary: 'Redis 主从切换导致缓存击穿，订单服务 QPS 下降 60%。根因：哨兵配置 quorum 值过低。已调整哨兵配置并增加本地缓存兜底。',
  },
  {
    id: 'arc-003', incidentId: 'INC-20260205-015',
    reportUrl: '/archives/INC-20260205-015/report.pdf',
    logBundleUrl: 's3://nexuslog-archives/INC-20260205-015/logs.tar.gz',
    hash: 'sha256:c3d4e5f6a1b2...', retentionDays: 365,
    archivedBy: '王运维', archivedAt: now - 1296000000,
    postmortemSummary: '数据库慢查询导致连接池耗尽。根因：缺少索引的全表扫描。已添加复合索引并优化 SQL。',
  },
  {
    id: 'arc-004', incidentId: 'INC-20260201-020',
    reportUrl: '/archives/INC-20260201-020/report.pdf',
    logBundleUrl: 's3://nexuslog-archives/INC-20260201-020/logs.tar.gz',
    hash: 'sha256:d4e5f6a1b2c3...', retentionDays: 90,
    archivedBy: '赵运维', archivedAt: now - 1641600000,
    postmortemSummary: 'K8s 节点 OOM 导致 Pod 被驱逐。根因：内存 limit 设置过低。已调整资源配额并启用 VPA。',
  },
];


// ============================================================================
// IncidentArchive 主组件
// ============================================================================

const IncidentArchive: React.FC = () => {
  const isDark = useThemeStore((s) => s.isDark);
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<ArchiveType | null>(null);

  const filtered = useMemo(() => {
    if (!search) return MOCK_ARCHIVES;
    const kw = search.toLowerCase();
    return MOCK_ARCHIVES.filter((a) =>
      a.incidentId.toLowerCase().includes(kw) || a.postmortemSummary.toLowerCase().includes(kw),
    );
  }, [search]);

  // 统计
  const stats = useMemo(() => [
    { label: '归档总数', value: MOCK_ARCHIVES.length, icon: 'archive', color: COLORS.primary },
    { label: '长期保留 (≥365天)', value: MOCK_ARCHIVES.filter((a) => a.retentionDays >= 365).length, icon: 'lock_clock', color: COLORS.success },
    { label: '短期保留 (<180天)', value: MOCK_ARCHIVES.filter((a) => a.retentionDays < 180).length, icon: 'schedule', color: COLORS.warning },
    { label: '总存储证据', value: `${MOCK_ARCHIVES.length * 2} 份`, icon: 'folder_zip', color: COLORS.info },
  ], []);

  const columns: ColumnsType<ArchiveType> = useMemo(() => [
    {
      title: '事件 ID',
      dataIndex: 'incidentId',
      key: 'incidentId',
      width: 180,
      render: (v: string) => (
        <Button type="link" size="small" className="font-mono text-xs p-0" onClick={(e) => { e.stopPropagation(); navigate(`/incidents/detail/${v}`); }}>
          {v}
        </Button>
      ),
    },
    {
      title: '复盘摘要',
      dataIndex: 'postmortemSummary',
      key: 'summary',
      render: (v: string) => (
        <Tooltip title={v}>
          <span className="text-sm line-clamp-2">{v}</span>
        </Tooltip>
      ),
    },
    {
      title: '保留期',
      dataIndex: 'retentionDays',
      key: 'retention',
      width: 100,
      sorter: (a, b) => a.retentionDays - b.retentionDays,
      render: (v: number) => (
        <Tag color={v >= 365 ? 'success' : v >= 180 ? 'warning' : 'default'} style={{ margin: 0 }}>
          {v} 天
        </Tag>
      ),
    },
    {
      title: '归档人',
      dataIndex: 'archivedBy',
      key: 'archivedBy',
      width: 100,
    },
    {
      title: '归档时间',
      dataIndex: 'archivedAt',
      key: 'archivedAt',
      width: 160,
      sorter: (a, b) => a.archivedAt - b.archivedAt,
      defaultSortOrder: 'descend',
      render: (v: number) => <span className="text-xs">{new Date(v).toLocaleString('zh-CN')}</span>,
    },
    {
      title: '操作',
      key: 'ops',
      width: 120,
      render: (_: unknown, record: ArchiveType) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button
              type="link"
              size="small"
              icon={<span className="material-symbols-outlined text-sm">visibility</span>}
              onClick={(e) => { e.stopPropagation(); setSelected(record); setDetailOpen(true); }}
            />
          </Tooltip>
          <Tooltip title="下载报告">
            <Button
              type="link"
              size="small"
              icon={<span className="material-symbols-outlined text-sm">download</span>}
              onClick={(e) => e.stopPropagation()}
            />
          </Tooltip>
        </Space>
      ),
    },
  ], []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-lg font-semibold">归档管理</span>
        <span className="text-xs opacity-50">全流程证据留存与合规审计</span>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((s) => (
          <Card key={s.label} size="small" style={{ borderColor: isDark ? '#334155' : '#e2e8f0' }} styles={{ body: { padding: '16px 20px' } }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs opacity-50 mb-1">{s.label}</div>
                <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
              </div>
              <span className="material-symbols-outlined text-2xl" style={{ color: s.color, opacity: 0.6 }}>{s.icon}</span>
            </div>
          </Card>
        ))}
      </div>

      {/* 搜索 */}
      <Input.Search
        placeholder="按事件 ID、复盘摘要搜索..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        allowClear
        style={{ maxWidth: 400 }}
      />

      {/* 归档列表 */}
      <Table<ArchiveType>
        dataSource={filtered}
        columns={columns}
        rowKey="id"
        size="small"
        pagination={false}
        onRow={(record) => ({
          onClick: () => { setSelected(record); setDetailOpen(true); },
          style: { cursor: 'pointer' },
        })}
        scroll={{ x: 800 }}
      />

      {/* 归档详情弹窗 */}
      <Modal
        title={selected ? `归档详情 - ${selected.incidentId}` : '归档详情'}
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        width={640}
        footer={
          <Space>
            <Button icon={<span className="material-symbols-outlined text-sm">download</span>}>下载报告</Button>
            <Button icon={<span className="material-symbols-outlined text-sm">folder_zip</span>}>下载日志包</Button>
            <Button onClick={() => setDetailOpen(false)}>关闭</Button>
          </Space>
        }
      >
        {selected && (
          <Descriptions column={2} size="small" bordered className="mt-4">
            <Descriptions.Item label="归档 ID" span={2}>
              <span className="font-mono text-xs">{selected.id}</span>
            </Descriptions.Item>
            <Descriptions.Item label="事件 ID" span={2}>
              <span className="font-mono text-xs">{selected.incidentId}</span>
            </Descriptions.Item>
            <Descriptions.Item label="复盘摘要" span={2}>
              <span className="text-xs">{selected.postmortemSummary}</span>
            </Descriptions.Item>
            <Descriptions.Item label="归档报告">
              <span className="font-mono text-xs break-all">{selected.reportUrl}</span>
            </Descriptions.Item>
            <Descriptions.Item label="日志包地址">
              <span className="font-mono text-xs break-all">{selected.logBundleUrl}</span>
            </Descriptions.Item>
            <Descriptions.Item label="完整性校验">
              <span className="font-mono text-xs">{selected.hash}</span>
            </Descriptions.Item>
            <Descriptions.Item label="保留期">
              <Tag color={selected.retentionDays >= 365 ? 'success' : 'warning'} style={{ margin: 0 }}>
                {selected.retentionDays} 天
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="归档人">{selected.archivedBy}</Descriptions.Item>
            <Descriptions.Item label="归档时间">{new Date(selected.archivedAt).toLocaleString('zh-CN')}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default IncidentArchive;
