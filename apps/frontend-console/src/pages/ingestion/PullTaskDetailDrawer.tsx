import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Descriptions, Drawer, Empty, Spin, Tag, Typography } from 'antd';
import { fetchPullTaskById, type PullTaskItem } from '../../api/ingest';
import { COLORS } from '../../theme/tokens';

interface PullTaskDetailDrawerProps {
  open: boolean;
  taskId?: string;
  sourceName?: string;
  onClose: () => void;
}

function formatDateTime(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN');
}

function formatNumber(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  return value.toLocaleString('zh-CN');
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

const PullTaskDetailDrawer: React.FC<PullTaskDetailDrawerProps> = ({ open, taskId, sourceName, onClose }) => {
  const [item, setItem] = useState<PullTaskItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const normalizedTaskId = taskId?.trim() || '';

  const loadTask = useCallback(async () => {
    if (!open || !normalizedTaskId) return;
    setLoading(true);
    setError('');
    try {
      const result = await fetchPullTaskById(normalizedTaskId);
      setItem(result);
    } catch (err) {
      setItem(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [normalizedTaskId, open]);

  useEffect(() => {
    if (!open) return;
    void loadTask();
  }, [loadTask, open]);

  useEffect(() => {
    if (!open) {
      setLoading(false);
      setError('');
    }
  }, [open]);

  const statusMeta = useMemo(() => getTaskStatusMeta(item?.status), [item?.status]);
  const optionsText = useMemo(() => {
    if (!item?.options || Object.keys(item.options).length === 0) return '-';
    return JSON.stringify(item.options, null, 2);
  }, [item?.options]);

  return (
    <Drawer
      open={open}
      title={item?.task_id ? `${sourceName ? `${sourceName} · ` : ''}任务详情` : '任务详情'}
      width={880}
      onClose={onClose}
      extra={<Button onClick={() => void loadTask()}>刷新</Button>}
    >
      {!normalizedTaskId ? (
        <Empty description="未选择任务" />
      ) : loading ? (
        <div style={{ padding: '48px 0', display: 'flex', justifyContent: 'center' }}>
          <Spin size="large" />
        </div>
      ) : error ? (
        <Alert type="error" showIcon message="任务详情加载失败" description={error} />
      ) : !item ? (
        <Empty description="未查询到任务详情" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {item.error_message ? (
            <Alert type="warning" showIcon message="该任务存在执行异常" description={item.error_message} />
          ) : null}

          <Card size="small" title="任务摘要">
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="状态">
                <Tag color={statusMeta.color} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusMeta.dot, display: 'inline-block' }} />
                  {statusMeta.label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="触发方式">{item.trigger_type || '-'}</Descriptions.Item>
              <Descriptions.Item label="任务 ID">{item.task_id || '-'}</Descriptions.Item>
              <Descriptions.Item label="数据源 ID">{item.source_id || '-'}</Descriptions.Item>
              <Descriptions.Item label="调度时间">{formatDateTime(item.scheduled_at)}</Descriptions.Item>
              <Descriptions.Item label="创建时间">{formatDateTime(item.created_at)}</Descriptions.Item>
              <Descriptions.Item label="开始时间">{formatDateTime(item.started_at)}</Descriptions.Item>
              <Descriptions.Item label="完成时间">{formatDateTime(item.finished_at)}</Descriptions.Item>
              <Descriptions.Item label="重试次数">{formatNumber(item.retry_count)}</Descriptions.Item>
              <Descriptions.Item label="Batch ID">{item.batch_id || '-'}</Descriptions.Item>
              <Descriptions.Item label="请求 ID" span={2}>
                <Typography.Text code style={{ whiteSpace: 'normal', wordBreak: 'break-all' }}>
                  {item.request_id || '-'}
                </Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="最近游标" span={2}>
                <Typography.Text code style={{ whiteSpace: 'normal', wordBreak: 'break-all' }}>
                  {item.last_cursor || '-'}
                </Typography.Text>
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card size="small" title="错误与参数">
            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label="错误码">
                <Typography.Text code>{item.error_code || '-'}</Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="错误说明">
                <Typography.Text code style={{ whiteSpace: 'normal', wordBreak: 'break-all' }}>
                  {item.error_message || '-'}
                </Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="执行参数">
                <Typography.Text code style={{ display: 'block', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  {optionsText}
                </Typography.Text>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </div>
      )}
    </Drawer>
  );
};

export default PullTaskDetailDrawer;
