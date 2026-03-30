import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Descriptions, Drawer, Empty, Select, Space, Spin, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { fetchPullTasks, type PullTaskItem } from '../../api/ingest';
import { COLORS } from '../../theme/tokens';

const TASK_STATUS_OPTIONS = [
  { label: '全部状态', value: 'all' },
  { label: '待执行', value: 'pending' },
  { label: '执行中', value: 'running' },
  { label: '成功', value: 'success' },
  { label: '失败', value: 'failed' },
  { label: '已取消', value: 'canceled' },
] as const;

interface PullTaskHistoryDrawerProps {
  open: boolean;
  sourceId?: string;
  sourceName?: string;
  onClose: () => void;
}

function formatDateTime(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN');
}

function getTaskStatusMeta(status?: string) {
  const normalized = String(status ?? '').toLowerCase();
  switch (normalized) {
    case 'success':
      return { label: '成功', color: 'success', dot: COLORS.success };
    case 'running':
      return { label: '执行中', color: 'processing', dot: COLORS.primary };
    case 'pending':
      return { label: '待执行', color: 'default', dot: '#94a3b8' };
    case 'failed':
      return { label: '失败', color: 'error', dot: COLORS.danger };
    case 'canceled':
      return { label: '已取消', color: 'warning', dot: COLORS.warning };
    default:
      return { label: normalized || '-', color: 'default', dot: '#94a3b8' };
  }
}

const PullTaskHistoryDrawer: React.FC<PullTaskHistoryDrawerProps> = ({ open, sourceId, sourceName, onClose }) => {
  const [tasks, setTasks] = useState<PullTaskItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [total, setTotal] = useState(0);

  const loadTasks = useCallback(async () => {
    if (!open || !sourceId) return;
    setLoading(true);
    setError('');
    try {
      const result = await fetchPullTasks({
        source_id: sourceId,
        status: statusFilter === 'all' ? undefined : statusFilter,
        page: 1,
        page_size: 20,
      });
      setTasks(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [open, sourceId, statusFilter]);

  useEffect(() => {
    if (!open) return;
    void loadTasks();
  }, [loadTasks, open]);

  useEffect(() => {
    if (!open) {
      setStatusFilter('all');
      setTasks([]);
      setError('');
      setTotal(0);
    }
  }, [open]);

  const latestTask = tasks[0] ?? null;
  const stats = useMemo(() => ({
    total,
    success: tasks.filter((item) => item.status === 'success').length,
    failed: tasks.filter((item) => item.status === 'failed').length,
    inFlight: tasks.filter((item) => item.status === 'pending' || item.status === 'running').length,
  }), [tasks, total]);

  const columns: ColumnsType<PullTaskItem> = [
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (value?: string) => {
        const meta = getTaskStatusMeta(value);
        return (
          <Tag color={meta.color} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta.dot, display: 'inline-block' }} />
            {meta.label}
          </Tag>
        );
      },
    },
    {
      title: '触发',
      dataIndex: 'trigger_type',
      key: 'trigger_type',
      width: 100,
      render: (value?: string) => value || '-',
    },
    {
      title: '时间',
      key: 'time',
      width: 220,
      render: (_, item) => (
        <div style={{ fontSize: 12 }}>
          <div>调度：{formatDateTime(item.scheduled_at)}</div>
          <div>开始：{formatDateTime(item.started_at)}</div>
          <div>完成：{formatDateTime(item.finished_at)}</div>
        </div>
      ),
    },
    {
      title: '批次 / 请求',
      key: 'ids',
      width: 220,
      render: (_, item) => (
        <div style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}>
          <div>{item.batch_id || '-'}</div>
          <div style={{ color: '#94a3b8' }}>{item.request_id || '-'}</div>
        </div>
      ),
    },
    {
      title: '结果',
      key: 'result',
      render: (_, item) => (
        <div style={{ fontSize: 12 }}>
          <div>{item.error_code || '—'}</div>
          <div style={{ color: item.error_message ? COLORS.danger : '#94a3b8', whiteSpace: 'normal', wordBreak: 'break-all' }}>
            {item.error_message || item.last_cursor || '无错误信息'}
          </div>
        </div>
      ),
    },
  ];

  return (
    <Drawer
      open={open}
      title={sourceName ? `${sourceName} · 任务历史` : '任务历史'}
      width={920}
      onClose={onClose}
      extra={
        <Space>
          <Select
            id="pull-task-status-filter"
            value={statusFilter}
            style={{ width: 140 }}
            options={TASK_STATUS_OPTIONS.map((item) => ({ label: item.label, value: item.value }))}
            onChange={setStatusFilter}
          />
          <Button onClick={() => void loadTasks()}>刷新</Button>
        </Space>
      }
    >
      {!sourceId ? (
        <Empty description="未选择数据源" />
      ) : loading ? (
        <div style={{ padding: '48px 0', display: 'flex', justifyContent: 'center' }}>
          <Spin size="large" />
        </div>
      ) : error ? (
        <Alert type="error" showIcon message="任务历史加载失败" description={error} />
      ) : tasks.length === 0 ? (
        <Empty description="当前筛选条件下暂无任务记录" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {latestTask?.error_message ? (
            <Alert type="warning" showIcon message="最近一次任务返回错误" description={latestTask.error_message} />
          ) : null}

          <Card size="small" title="最近执行结果">
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="最近状态">{getTaskStatusMeta(latestTask?.status).label}</Descriptions.Item>
              <Descriptions.Item label="触发方式">{latestTask?.trigger_type || '-'}</Descriptions.Item>
              <Descriptions.Item label="调度时间">{formatDateTime(latestTask?.scheduled_at)}</Descriptions.Item>
              <Descriptions.Item label="完成时间">{formatDateTime(latestTask?.finished_at || latestTask?.started_at)}</Descriptions.Item>
              <Descriptions.Item label="批次 ID">{latestTask?.batch_id || '-'}</Descriptions.Item>
              <Descriptions.Item label="请求 ID">{latestTask?.request_id || '-'}</Descriptions.Item>
              <Descriptions.Item label="游标 / 错误" span={2}>
                <Typography.Text code style={{ whiteSpace: 'normal', wordBreak: 'break-all' }}>
                  {latestTask?.error_message || latestTask?.last_cursor || '-'}
                </Typography.Text>
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card
            size="small"
            title="最近 20 条任务"
            extra={<span style={{ color: '#94a3b8', fontSize: 12 }}>当前总数：{stats.total} · 成功：{stats.success} · 失败：{stats.failed} · 进行中：{stats.inFlight}</span>}
          >
            <Table<PullTaskItem>
              rowKey={(record) => record.task_id}
              size="small"
              columns={columns}
              dataSource={tasks}
              pagination={false}
              scroll={{ x: 980 }}
            />
          </Card>
        </div>
      )}
    </Drawer>
  );
};

export default PullTaskHistoryDrawer;
