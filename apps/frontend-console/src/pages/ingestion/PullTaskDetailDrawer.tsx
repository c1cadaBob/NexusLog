import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Descriptions, Drawer, Empty, Spin, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { fetchPullPackages, fetchPullTaskById, type PullPackageItem, type PullTaskItem } from '../../api/ingest';
import { hasAnyCapability } from '../../auth/routeAuthorization';
import { useAuthStore } from '../../stores/authStore';
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

function formatBytes(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`;
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

function getPackageStatusMeta(status?: string) {
  const normalized = String(status ?? '').toLowerCase();
  switch (normalized) {
    case 'acked':
      return { label: '已确认', color: 'success', dot: COLORS.success };
    case 'uploaded':
      return { label: '已上传', color: 'processing', dot: COLORS.primary };
    case 'uploading':
      return { label: '上传中', color: 'processing', dot: COLORS.primary };
    case 'created':
      return { label: '待创建', color: 'default', dot: '#94a3b8' };
    case 'nacked':
      return { label: '已拒绝', color: 'warning', dot: COLORS.warning };
    case 'failed':
      return { label: '失败', color: 'error', dot: COLORS.danger };
    case 'dead_lettered':
      return { label: '死信', color: 'error', dot: COLORS.danger };
    default:
      return { label: normalized || '-', color: 'default', dot: '#94a3b8' };
  }
}

const LazyPullPackageDetailDrawer = lazy(() => import('./PullPackageDetailDrawer'));

const basePackageColumns: ColumnsType<PullPackageItem> = [
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 120,
    render: (value?: string) => {
      const meta = getPackageStatusMeta(value);
      return (
        <Tag color={meta.color} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta.dot, display: 'inline-block' }} />
          {meta.label}
        </Tag>
      );
    },
  },
  {
    title: '包编号 / 包 ID',
    key: 'package',
    width: 260,
    render: (_, record) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Typography.Text>{record.package_no || '-'}</Typography.Text>
        <Typography.Text code style={{ whiteSpace: 'normal', wordBreak: 'break-all' }}>
          {record.package_id || '-'}
        </Typography.Text>
      </div>
    ),
  },
  {
    title: '记录 / 文件',
    key: 'counts',
    width: 140,
    render: (_, record) => `${formatNumber(record.record_count)} / ${formatNumber(record.file_count)}`,
  },
  {
    title: '大小',
    dataIndex: 'size_bytes',
    key: 'size_bytes',
    width: 120,
    render: (value?: number) => formatBytes(value),
  },
  {
    title: 'Batch ID / Cursor',
    key: 'tracking',
    render: (_, record) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Typography.Text code style={{ whiteSpace: 'normal', wordBreak: 'break-all' }}>
          {record.batch_id || '-'}
        </Typography.Text>
        <Typography.Text type="secondary" style={{ whiteSpace: 'normal', wordBreak: 'break-all' }}>
          {record.next_cursor || '-'}
        </Typography.Text>
      </div>
    ),
  },
  {
    title: '时间',
    key: 'timestamps',
    width: 220,
    render: (_, record) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span>创建：{formatDateTime(record.created_at)}</span>
        <span>确认：{formatDateTime(record.acked_at)}</span>
      </div>
    ),
  },
];

const PullTaskDetailDrawer: React.FC<PullTaskDetailDrawerProps> = ({ open, taskId, sourceName, onClose }) => {
  const capabilities = useAuthStore((state) => state.capabilities);
  const canReadPackage = useMemo(() => hasAnyCapability(capabilities, ['ingest.package.read']), [capabilities]);

  const [item, setItem] = useState<PullTaskItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [packages, setPackages] = useState<PullPackageItem[]>([]);
  const [packagesTotal, setPackagesTotal] = useState(0);
  const [packagesLoading, setPackagesLoading] = useState(false);
  const [packagesError, setPackagesError] = useState('');
  const [detailPackageId, setDetailPackageId] = useState('');

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

  const loadPackages = useCallback(async () => {
    if (!open || !normalizedTaskId || !canReadPackage) return;
    setPackagesLoading(true);
    setPackagesError('');
    try {
      const result = await fetchPullPackages({
        task_id: normalizedTaskId,
        page: 1,
        page_size: 10,
      });
      setPackages(result.items);
      setPackagesTotal(result.total);
    } catch (err) {
      setPackages([]);
      setPackagesTotal(0);
      setPackagesError(err instanceof Error ? err.message : String(err));
    } finally {
      setPackagesLoading(false);
    }
  }, [canReadPackage, normalizedTaskId, open]);

  const loadData = useCallback(async () => {
    await Promise.allSettled([loadTask(), loadPackages()]);
  }, [loadPackages, loadTask]);

  useEffect(() => {
    if (!open) return;
    void loadData();
  }, [loadData, open]);

  useEffect(() => {
    if (!open) {
      setLoading(false);
      setError('');
      setPackages([]);
      setPackagesTotal(0);
      setPackagesLoading(false);
      setPackagesError('');
      setDetailPackageId('');
    }
  }, [open]);

  const statusMeta = useMemo(() => getTaskStatusMeta(item?.status), [item?.status]);
  const optionsText = useMemo(() => {
    if (!item?.options || Object.keys(item.options).length === 0) return '-';
    return JSON.stringify(item.options, null, 2);
  }, [item?.options]);
  const packageCardTitle = useMemo(() => {
    if (packagesTotal > packages.length) {
      return `关联增量包 (${packages.length}/${packagesTotal})`;
    }
    return `关联增量包 (${packagesTotal || packages.length})`;
  }, [packages.length, packagesTotal]);
  const packageColumns = useMemo<ColumnsType<PullPackageItem>>(
    () => [
      ...basePackageColumns,
      {
        title: '操作',
        key: 'actions',
        width: 88,
        align: 'right',
        render: (_, record) => (
          <Button
            size="small"
            type="link"
            disabled={!record.package_id}
            onClick={() => setDetailPackageId(record.package_id)}
          >
            详情
          </Button>
        ),
      },
    ],
    [],
  );

  return (
    <>
      <Drawer
      open={open}
      title={item?.task_id ? `${sourceName ? `${sourceName} · ` : ''}任务详情` : '任务详情'}
      width={980}
      onClose={onClose}
      extra={<Button onClick={() => void loadData()}>刷新</Button>}
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

          <Card size="small" title={packageCardTitle}>
            {!canReadPackage ? (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'rgba(100, 116, 139, 0.9)' }}>
                当前账号缺少 ingest.package.read 权限，无法查看关联增量包。
              </div>
            ) : packagesLoading ? (
              <div style={{ padding: '24px 0', display: 'flex', justifyContent: 'center' }}>
                <Spin />
              </div>
            ) : packagesError ? (
              <Alert type="error" showIcon message="关联增量包加载失败" description={packagesError} />
            ) : packages.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该任务下暂无增量包" />
            ) : (
              <Table<PullPackageItem>
                rowKey={(record) => record.package_id}
                size="small"
                columns={packageColumns}
                dataSource={packages}
                pagination={false}
                scroll={{ x: 1080 }}
              />
            )}
          </Card>
        </div>
      )}
      </Drawer>

      <Suspense fallback={null}>
        <LazyPullPackageDetailDrawer
          open={Boolean(detailPackageId)}
          packageId={detailPackageId}
          sourceName={sourceName}
          onClose={() => setDetailPackageId('')}
        />
      </Suspense>
    </>
  );
};

export default PullTaskDetailDrawer;
