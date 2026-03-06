import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Tag, Input, Card, Button, Modal, Descriptions, Space, Tooltip, Spin, Empty, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useThemeStore } from '../../stores/themeStore';
import { COLORS } from '../../theme/tokens';
import { fetchIncidents } from '../../api/incident';
import type { Incident } from '../../types/incident';

/** 归档展示项（从 Incident 映射） */
interface ArchiveDisplay {
  id: string;
  incidentId: string;
  postmortemSummary: string;
  retentionDays: number;
  archivedBy: string;
  archivedAt: number;
}

function mapIncidentToArchive(inc: Incident): ArchiveDisplay {
  return {
    id: inc.id,
    incidentId: inc.id,
    postmortemSummary: inc.verdict || inc.description || '-',
    retentionDays: 365,
    archivedBy: inc.assignee || '-',
    archivedAt: inc.archivedAt ?? inc.updatedAt,
  };
}

// ============================================================================
// IncidentArchive 主组件
// ============================================================================

const IncidentArchive: React.FC = () => {
  const isDark = useThemeStore((s) => s.isDark);
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<ArchiveDisplay | null>(null);

  const [archives, setArchives] = useState<ArchiveDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);


  const loadArchives = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { items } = await fetchIncidents(1, 200, { status: 'archived' });
      setArchives(items.map(mapIncidentToArchive));
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载归档列表失败';
      setError(msg);
      message.error(msg);
      setArchives([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadArchives();
  }, [loadArchives]);

  const filtered = useMemo(() => {
    if (!search) return archives;
    const kw = search.toLowerCase();
    return archives.filter(
      (a) =>
        a.incidentId.toLowerCase().includes(kw) || a.postmortemSummary.toLowerCase().includes(kw),
    );
  }, [archives, search]);

  const stats = useMemo(
    () => [
      { label: '归档总数', value: archives.length, icon: 'archive', color: COLORS.primary },
      {
        label: '长期保留 (≥365天)',
        value: archives.filter((a) => a.retentionDays >= 365).length,
        icon: 'lock_clock',
        color: COLORS.success,
      },
      {
        label: '短期保留 (<180天)',
        value: archives.filter((a) => a.retentionDays < 180).length,
        icon: 'schedule',
        color: COLORS.warning,
      },
      { label: '总存储证据', value: `${archives.length * 2} 份`, icon: 'folder_zip', color: COLORS.info },
    ],
    [archives],
  );


  const columns: ColumnsType<ArchiveDisplay> = useMemo(
    () => [
      {
        title: '事件 ID',
        dataIndex: 'incidentId',
        key: 'incidentId',
        width: 180,
        render: (v: string) => (
          <Button
            type="link"
            size="small"
            className="font-mono text-xs p-0"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/incidents/detail/${v}`);
            }}
          >
            {v}
          </Button>
        ),
      },
      {
        title: '研判结论',
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
        render: (_: unknown, record: ArchiveDisplay) => (
          <Space size="small">
            <Tooltip title="查看详情">
              <Button
                type="link"
                size="small"
                icon={<span className="material-symbols-outlined text-sm">visibility</span>}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelected(record);
                  setDetailOpen(true);
                }}
              />
            </Tooltip>
          </Space>
        ),
      },
    ],
    [navigate],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-lg font-semibold">归档管理</span>
        <span className="text-xs opacity-50">全流程证据留存与合规审计</span>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((s) => (
          <Card
            key={s.label}
            size="small"
            style={{ borderColor: isDark ? '#334155' : '#e2e8f0' }}
            styles={{ body: { padding: '16px 20px' } }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs opacity-50 mb-1">{s.label}</div>
                <div className="text-2xl font-bold" style={{ color: s.color }}>
                  {s.value}
                </div>
              </div>
              <span
                className="material-symbols-outlined text-2xl"
                style={{ color: s.color, opacity: 0.6 }}
              >
                {s.icon}
              </span>
            </div>
          </Card>
        ))}
      </div>

      {/* 搜索 */}
      <Input.Search
        placeholder="按事件 ID、研判结论搜索..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        allowClear
        style={{ maxWidth: 400 }}
      />

      {/* 归档列表 */}
      {error ? (
        <Empty description={error} />
      ) : (
        <Table<ArchiveDisplay>
          dataSource={filtered}
          columns={columns}
          rowKey="id"
          size="small"
          loading={loading}
          pagination={false}
          onRow={(record) => ({
            onClick: () => {
              setSelected(record);
              setDetailOpen(true);
            },
            style: { cursor: 'pointer' },
          })}
          scroll={{ x: 800 }}
          locale={{ emptyText: loading ? <Spin size="small" /> : <Empty description="暂无归档记录" /> }}
        />
      )}

      {/* 归档详情弹窗 */}
      <Modal
        title={selected ? `归档详情 - ${selected.incidentId}` : '归档详情'}
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        width={640}
        footer={<Button onClick={() => setDetailOpen(false)}>关闭</Button>}
      >
        {selected && (
          <Descriptions column={2} size="small" bordered className="mt-4">
            <Descriptions.Item label="归档 ID" span={2}>
              <span className="font-mono text-xs">{selected.id}</span>
            </Descriptions.Item>
            <Descriptions.Item label="事件 ID" span={2}>
              <span className="font-mono text-xs">{selected.incidentId}</span>
            </Descriptions.Item>
            <Descriptions.Item label="研判结论" span={2}>
              <span className="text-xs">{selected.postmortemSummary}</span>
            </Descriptions.Item>
            <Descriptions.Item label="保留期">
              <Tag color={selected.retentionDays >= 365 ? 'success' : 'warning'} style={{ margin: 0 }}>
                {selected.retentionDays} 天
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="归档人">{selected.archivedBy}</Descriptions.Item>
            <Descriptions.Item label="归档时间">
              {new Date(selected.archivedAt).toLocaleString('zh-CN')}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default IncidentArchive;
