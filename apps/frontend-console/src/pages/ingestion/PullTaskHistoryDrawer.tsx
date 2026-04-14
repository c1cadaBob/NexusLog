import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Drawer, Empty, Select, Tag, Typography } from 'antd';
import type { PullTaskItem } from '../../api/ingest';
import { COLORS } from '../../theme/tokens';
import PullTaskDetailDrawer from './PullTaskDetailDrawer';

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
  sourceName?: string;
  tasks: PullTaskItem[];
  total: number;
  error?: string;
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

const PullTaskHistoryDrawer: React.FC<PullTaskHistoryDrawerProps> = ({ open, sourceName, tasks, total, error, onClose }) => {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [detailTaskId, setDetailTaskId] = useState('');

  useEffect(() => {
    if (!open) {
      setStatusFilter('all');
      setDetailTaskId('');
    }
  }, [open]);

  const filteredTasks = useMemo(() => {
    if (statusFilter === 'all') return tasks;
    return tasks.filter((item) => String(item.status ?? '').toLowerCase() === statusFilter);
  }, [statusFilter, tasks]);

  const latestTask = filteredTasks[0] ?? tasks[0] ?? null;
  const stats = useMemo(() => {
    const base = filteredTasks.length ? filteredTasks : tasks;
    return {
      total,
      visible: filteredTasks.length,
      success: base.filter((item) => item.status === 'success').length,
      failed: base.filter((item) => item.status === 'failed').length,
      inFlight: base.filter((item) => item.status === 'pending' || item.status === 'running').length,
    };
  }, [filteredTasks, tasks, total]);

  return (
    <Drawer
      open={open}
      title={sourceName ? `${sourceName} · 任务历史` : '任务历史'}
      width={920}
      destroyOnHidden
      onClose={onClose}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Select
            id="pull-task-status-filter"
            value={statusFilter}
            style={{ width: 140 }}
            options={TASK_STATUS_OPTIONS.map((item) => ({ label: item.label, value: item.value }))}
            onChange={setStatusFilter}
          />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            展示打开时预取的最近 20 条任务快照；如需刷新，请关闭后重新打开。
          </Typography.Text>
        </div>

        {error ? <Alert type="error" showIcon message="任务历史加载失败" description={error} /> : null}
        {latestTask?.error_message ? <Alert type="warning" showIcon message="最近一次任务返回错误" description={latestTask.error_message} /> : null}

        {filteredTasks.length === 0 ? (
          <Empty description={tasks.length === 0 ? '暂无任务记录' : '当前筛选条件下暂无任务记录'} />
        ) : (
          <>
            {latestTask ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16, border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: 12, background: 'rgba(15, 23, 42, 0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <Typography.Title level={5} style={{ margin: 0 }}>最近执行结果</Typography.Title>
                  {latestTask.task_id ? (
                    <Button size="small" type="link" onClick={() => setDetailTaskId(latestTask.task_id)}>
                      查看详情
                    </Button>
                  ) : null}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, fontSize: 13 }}>
                  <div>最近状态：{getTaskStatusMeta(latestTask.status).label}</div>
                  <div>触发方式：{latestTask.trigger_type || '-'}</div>
                  <div>调度时间：{formatDateTime(latestTask.scheduled_at)}</div>
                  <div>完成时间：{formatDateTime(latestTask.finished_at || latestTask.started_at)}</div>
                  <div>批次 ID：{latestTask.batch_id || '-'}</div>
                  <div>请求 ID：{latestTask.request_id || '-'}</div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    游标 / 错误：
                    <Typography.Text code style={{ marginLeft: 8, whiteSpace: 'normal', wordBreak: 'break-all' }}>
                      {latestTask.error_message || latestTask.last_cursor || '-'}
                    </Typography.Text>
                  </div>
                </div>
              </div>
            ) : null}

            <div style={{ color: '#94a3b8', fontSize: 12 }}>
              当前总数：{stats.total} · 当前显示：{stats.visible} · 成功：{stats.success} · 失败：{stats.failed} · 进行中：{stats.inFlight}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filteredTasks.map((item) => {
                const meta = getTaskStatusMeta(item.status);
                return (
                  <div key={item.task_id} style={{ border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <Tag color={meta.color} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginInlineEnd: 0 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta.dot, display: 'inline-block' }} />
                        {meta.label}
                      </Tag>
                      <Button size="small" type="link" onClick={() => setDetailTaskId(item.task_id)}>
                        详情
                      </Button>
                    </div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>
                      触发：{item.trigger_type || '-'} · 调度：{formatDateTime(item.scheduled_at)} · 完成：{formatDateTime(item.finished_at || item.started_at)}
                    </div>
                    <div style={{ fontSize: 12 }}>
                      Batch：{item.batch_id || '-'} · Request：{item.request_id || '-'}
                    </div>
                    <div style={{ fontSize: 12, whiteSpace: 'normal', wordBreak: 'break-all' }}>
                      {item.error_message || item.last_cursor || '无错误信息'}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <PullTaskDetailDrawer
        open={Boolean(detailTaskId)}
        taskId={detailTaskId}
        sourceName={sourceName}
        onClose={() => setDetailTaskId('')}
      />
    </Drawer>
  );
};

export default PullTaskHistoryDrawer;
