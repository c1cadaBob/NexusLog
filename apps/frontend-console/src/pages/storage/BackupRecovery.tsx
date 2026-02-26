import React, { useState } from 'react';
import { Input, Button, Card, Table, Tag, Space, Statistic } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useThemeStore } from '../../stores/themeStore';
import { COLORS, DARK_PALETTE, LIGHT_PALETTE } from '../../theme/tokens';
import type { BackupTask, SnapshotItem } from '../../types/storage';

// ============================================================================
// 模拟数据
// ============================================================================

const mockTasks: BackupTask[] = [
  { id: '1', name: '每日全量备份 (Daily Full)', indices: 'all-indices-*', repoType: 'S3', repoName: 'logs-archive', cron: '0 0 * * *', lastRun: '2023-10-27 00:00:00', status: 'running', icon: 'backup', iconColor: COLORS.info },
  { id: '2', name: '每小时增量备份 (Hourly Inc)', indices: 'app-logs-*', repoType: 'HDFS', repoName: '/user/logs', cron: '0 * * * *', lastRun: '2023-10-27 14:00:00', status: 'idle', icon: 'update', iconColor: COLORS.purple },
  { id: '3', name: '系统日志归档 (Sys Archive)', indices: 'sys-metric-*', repoType: 'S3', repoName: 'sys-archive', cron: '0 0 * * 0', lastRun: '2023-10-22 00:00:00', status: 'paused', icon: 'archive', iconColor: '#a855f7' },
];

const mockSnapshots: SnapshotItem[] = [
  { id: 'snap-20231027-1400', createdAt: '2023-10-27 14:00:23', indices: 'app-logs-*', extraCount: 2, size: '450.2 GB' },
  { id: 'snap-20231027-1300', createdAt: '2023-10-27 13:00:21', indices: 'app-logs-*', extraCount: 2, size: '448.9 GB' },
  { id: 'snap-daily-20231027', createdAt: '2023-10-27 00:00:15', indices: 'all-indices-*', size: '4.2 TB' },
];

const TASK_STATUS_MAP: Record<string, { color: string; label: string }> = {
  running: { color: 'success', label: '运行中' },
  idle: { color: 'success', label: '正常 (Idle)' },
  paused: { color: 'warning', label: '已暂停' },
  failed: { color: 'error', label: '失败' },
};

const REPO_ICON: Record<string, { icon: string; color: string }> = {
  S3: { icon: 'cloud_queue', color: '#fb923c' },
  HDFS: { icon: 'folder_open', color: '#eab308' },
  NFS: { icon: 'dns', color: '#94a3b8' },
};

// ============================================================================
// 组件
// ============================================================================

const BackupRecovery: React.FC = () => {
  const isDark = useThemeStore((s) => s.isDark);
  const p = isDark ? DARK_PALETTE : LIGHT_PALETTE;
  const [activeTab, setActiveTab] = useState<'tasks' | 'snapshots' | 'restore'>('tasks');
  const [taskSearch, setTaskSearch] = useState('');

  const tabs = [
    { key: 'tasks' as const, label: '备份任务 (Backup Tasks)', icon: 'schedule' },
    { key: 'snapshots' as const, label: '快照列表 (Snapshots)', icon: 'camera_alt' },
    { key: 'restore' as const, label: '恢复日志 (Restore Logs)', icon: 'restore' },
  ];

  // 备份任务表格列
  const taskColumns: ColumnsType<BackupTask> = [
    {
      title: '任务名称 (Task Name)',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ padding: 6, borderRadius: 6, background: `${record.iconColor}1a`, color: record.iconColor }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{record.icon}</span>
          </div>
          <div>
            <div style={{ fontWeight: 500 }}>{name}</div>
            <div style={{ fontSize: 12, color: p.textSecondary }}>Indices: {record.indices}</div>
          </div>
        </div>
      ),
    },
    {
      title: '仓库类型 (Repository)',
      dataIndex: 'repoType',
      key: 'repoType',
      width: 180,
      render: (_: string, record) => {
        const ri = REPO_ICON[record.repoType];
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: ri.color }}>{ri.icon}</span>
            {record.repoType} ({record.repoName})
          </div>
        );
      },
    },
    {
      title: '频率 (Cron)',
      dataIndex: 'cron',
      key: 'cron',
      width: 140,
      render: (cron: string) => (
        <code style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, background: isDark ? '#111722' : '#f1f5f9', color: COLORS.primary, fontFamily: 'JetBrains Mono, monospace', border: `1px solid ${p.border}` }}>
          {cron}
        </code>
      ),
    },
    {
      title: '上次运行',
      dataIndex: 'lastRun',
      key: 'lastRun',
      width: 180,
      render: (v: string) => <span style={{ fontSize: 13, color: p.textSecondary }}>{v}</span>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status: string) => {
        const cfg = TASK_STATUS_MAP[status];
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      align: 'right',
      render: () => (
        <Space size={4}>
          <Button type="text" size="small" icon={<span className="material-symbols-outlined" style={{ fontSize: 18, color: p.textSecondary }}>edit</span>} />
          <Button type="text" size="small" icon={<span className="material-symbols-outlined" style={{ fontSize: 18, color: p.textSecondary }}>play_arrow</span>} />
          <Button type="text" size="small" icon={<span className="material-symbols-outlined" style={{ fontSize: 18, color: COLORS.danger }}>delete</span>} />
        </Space>
      ),
    },
  ];

  // 快照表格列
  const snapshotColumns: ColumnsType<SnapshotItem> = [
    {
      title: '快照 ID (Snapshot ID)',
      dataIndex: 'id',
      key: 'id',
      render: (id: string) => <span style={{ color: COLORS.primary, fontFamily: 'JetBrains Mono, monospace', fontSize: 13, cursor: 'pointer' }}>{id}</span>,
    },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 180 },
    {
      title: '包含索引',
      dataIndex: 'indices',
      key: 'indices',
      render: (indices: string, record) => (
        <span>
          <Tag>{indices}</Tag>
          {record.extraCount && <span style={{ fontSize: 12, color: p.textSecondary, marginLeft: 4 }}>+{record.extraCount} more</span>}
        </span>
      ),
    },
    { title: '大小 (Size)', dataIndex: 'size', key: 'size', width: 120 },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      align: 'right',
      render: () => <Button size="small">恢复 (Restore)</Button>,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, height: '100%' }}>
      {/* 头部 */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>备份与恢复</h2>
          <p style={{ margin: 0, fontSize: 13, color: p.textSecondary }}>管理索引快照仓库、自动备份计划及数据恢复</p>
        </div>
        <Space>
          <Button icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>settings</span>}>配置仓库</Button>
          <Button type="primary" icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>add_a_photo</span>}>立即创建快照</Button>
        </Space>
      </div>

      {/* 统计卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <Card size="small" styles={{ body: { padding: '20px' } }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 12, color: p.textSecondary, fontWeight: 500 }}>上次成功备份</div>
              <div style={{ fontSize: 24, fontWeight: 700, marginTop: 8 }}>14 分钟前</div>
              <div style={{ fontSize: 12, color: p.textSecondary, marginTop: 4 }}>Task: hourly-incremental</div>
            </div>
            <div style={{ padding: 6, borderRadius: 8, background: `${COLORS.success}1a` }}>
              <span className="material-symbols-outlined" style={{ color: COLORS.success, fontSize: 20 }}>check_circle</span>
            </div>
          </div>
        </Card>
        <Card size="small" styles={{ body: { padding: '20px' } }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 12, color: p.textSecondary, fontWeight: 500 }}>存储库总量</div>
              <div style={{ fontSize: 24, fontWeight: 700, marginTop: 8 }}>4.2 TB</div>
              <div style={{ fontSize: 12, color: p.textSecondary, marginTop: 4 }}>S3 Bucket: logs-archive-prod</div>
            </div>
            <div style={{ padding: 6, borderRadius: 8, background: `${COLORS.primary}1a` }}>
              <span className="material-symbols-outlined" style={{ color: COLORS.primary, fontSize: 20 }}>cloud</span>
            </div>
          </div>
        </Card>
        <Card size="small" styles={{ body: { padding: '20px' } }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 12, color: p.textSecondary, fontWeight: 500 }}>快照总数</div>
              <div style={{ fontSize: 24, fontWeight: 700, marginTop: 8 }}>128</div>
              <div style={{ fontSize: 12, color: p.textSecondary, marginTop: 4 }}>保留策略: 30天</div>
            </div>
            <div style={{ padding: 6, borderRadius: 8, background: `${COLORS.purple}1a` }}>
              <span className="material-symbols-outlined" style={{ color: COLORS.purple, fontSize: 20 }}>history</span>
            </div>
          </div>
        </Card>
      </div>

      {/* 标签页 */}
      <div style={{ borderBottom: `1px solid ${p.border}`, display: 'flex', gap: 24 }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              paddingBottom: 12, fontSize: 13, fontWeight: 500,
              color: activeTab === tab.key ? p.text : p.textSecondary,
              borderBottom: activeTab === tab.key ? `2px solid ${COLORS.primary}` : '2px solid transparent',
              display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* 备份任务内容 */}
      {activeTab === 'tasks' && (
        <Card
          style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' } }}
        >
          <div style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${p.border}` }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>定期备份计划</span>
            <Input
              prefix={<span className="material-symbols-outlined" style={{ fontSize: 18, color: p.textSecondary }}>search</span>}
              placeholder="搜索任务..."
              value={taskSearch}
              onChange={(e) => setTaskSearch(e.target.value)}
              style={{ width: 240 }}
              allowClear
              size="small"
            />
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            <Table<BackupTask>
              rowKey="id"
              columns={taskColumns}
              dataSource={mockTasks.filter(t => !taskSearch || t.name.toLowerCase().includes(taskSearch.toLowerCase()))}
              size="middle"
              pagination={false}
            />
          </div>
        </Card>
      )}

      {/* 快照列表 */}
      {activeTab === 'snapshots' && (
        <Card
          style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' } }}
        >
          <div style={{ flex: 1, overflow: 'auto' }}>
            <Table<SnapshotItem>
              rowKey="id"
              columns={snapshotColumns}
              dataSource={mockSnapshots}
              size="middle"
              pagination={false}
            />
          </div>
        </Card>
      )}

      {/* 恢复日志占位 */}
      {activeTab === 'restore' && (
        <Card style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', color: p.textSecondary }}>
            <span className="material-symbols-outlined" style={{ fontSize: 48, opacity: 0.3 }}>restore</span>
            <p>暂无恢复日志</p>
          </div>
        </Card>
      )}

      {/* 最近活动快照 */}
      {activeTab === 'tasks' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>最近活动快照</h3>
            <Tag>最近 24 小时</Tag>
          </div>
          <Card styles={{ body: { padding: 0 } }}>
            <Table<SnapshotItem>
              rowKey="id"
              columns={snapshotColumns}
              dataSource={mockSnapshots}
              size="middle"
              pagination={false}
            />
          </Card>
        </div>
      )}
    </div>
  );
};

export default BackupRecovery;
