import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Descriptions, Drawer, Empty, Space, Spin, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { fetchPullPackageById, type PullPackageFile, type PullPackageItem } from '../../api/ingest';
import { hasAnyCapability } from '../../auth/routeAuthorization';
import { useAuthStore } from '../../stores/authStore';
import { COLORS } from '../../theme/tokens';
import DeadLetterDrawer from './DeadLetterDrawer';
import PullTaskDetailDrawer from './PullTaskDetailDrawer';

interface PullPackageDetailDrawerProps {
  open: boolean;
  packageId?: string;
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

const fileColumns: ColumnsType<PullPackageFile> = [
  {
    title: '文件路径',
    dataIndex: 'file_path',
    key: 'file_path',
    render: (value?: string) => (
      <Typography.Text code style={{ whiteSpace: 'normal', wordBreak: 'break-all' }}>
        {value || '-'}
      </Typography.Text>
    ),
  },
  {
    title: '偏移范围',
    key: 'offsets',
    width: 180,
    render: (_, item) => `${formatNumber(item.from_offset)} ~ ${formatNumber(item.to_offset)}`,
  },
  {
    title: '行数',
    dataIndex: 'line_count',
    key: 'line_count',
    width: 120,
    render: (value?: number) => formatNumber(value),
  },
  {
    title: '大小',
    dataIndex: 'size_bytes',
    key: 'size_bytes',
    width: 120,
    render: (value?: number) => formatBytes(value),
  },
  {
    title: '校验和',
    dataIndex: 'checksum',
    key: 'checksum',
    width: 220,
    render: (value?: string) => (
      <Typography.Text code style={{ whiteSpace: 'normal', wordBreak: 'break-all' }}>
        {value || '-'}
      </Typography.Text>
    ),
  },
];

const PullPackageDetailDrawer: React.FC<PullPackageDetailDrawerProps> = ({ open, packageId, sourceName, onClose }) => {
  const capabilities = useAuthStore((state) => state.capabilities);
  const canReadTask = useMemo(() => hasAnyCapability(capabilities, ['ingest.task.read']), [capabilities]);
  const canReadDeadLetter = useMemo(() => hasAnyCapability(capabilities, ['ingest.dead_letter.read']), [capabilities]);

  const [item, setItem] = useState<PullPackageItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [taskDetailOpen, setTaskDetailOpen] = useState(false);
  const [deadLetterOpen, setDeadLetterOpen] = useState(false);

  const normalizedPackageId = packageId?.trim() || '';

  const loadPackage = useCallback(async () => {
    if (!open || !normalizedPackageId) return;
    setLoading(true);
    setError('');
    try {
      const result = await fetchPullPackageById(normalizedPackageId);
      setItem(result);
    } catch (err) {
      setItem(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [normalizedPackageId, open]);

  useEffect(() => {
    if (!open) return;
    void loadPackage();
  }, [loadPackage, open]);

  useEffect(() => {
    if (!open) {
      setLoading(false);
      setError('');
      setTaskDetailOpen(false);
      setDeadLetterOpen(false);
    }
  }, [open]);

  const statusMeta = useMemo(() => getPackageStatusMeta(item?.status), [item?.status]);
  const metadataText = useMemo(() => {
    if (!item?.metadata || Object.keys(item.metadata).length === 0) return '-';
    return JSON.stringify(item.metadata, null, 2);
  }, [item?.metadata]);

  return (
    <>
      <Drawer
        open={open}
        title={item?.package_no ? `${sourceName ? `${sourceName} · ` : ''}${item.package_no} · 包详情` : '包详情'}
        width={1040}
        onClose={onClose}
        extra={(
          <Space wrap>
            {canReadTask ? (
              <Button disabled={!item?.task_id} onClick={() => setTaskDetailOpen(true)}>
                查看任务
              </Button>
            ) : null}
            {canReadDeadLetter ? (
              <Button disabled={!item?.package_id} onClick={() => setDeadLetterOpen(true)}>
                查看死信
              </Button>
            ) : null}
            <Button onClick={() => void loadPackage()}>刷新</Button>
          </Space>
        )}
      >
        {!normalizedPackageId ? (
          <Empty description="未选择增量包" />
        ) : loading ? (
          <div style={{ padding: '48px 0', display: 'flex', justifyContent: 'center' }}>
            <Spin size="large" />
          </div>
        ) : error ? (
          <Alert type="error" showIcon message="包详情加载失败" description={error} />
        ) : !item ? (
          <Empty description="未查询到增量包详情" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {['failed', 'nacked', 'dead_lettered'].includes(String(item.status ?? '').toLowerCase()) ? (
              <Alert type="warning" showIcon message="该增量包存在异常状态" description="建议继续检查任务详情、死信记录与回执结果。" />
            ) : null}

            <Card size="small" title="包摘要">
              <Descriptions bordered size="small" column={2}>
                <Descriptions.Item label="状态">
                  <Tag color={statusMeta.color} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusMeta.dot, display: 'inline-block' }} />
                    {statusMeta.label}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="包编号">{item.package_no || '-'}</Descriptions.Item>
                <Descriptions.Item label="包 ID">{item.package_id || '-'}</Descriptions.Item>
                <Descriptions.Item label="任务 ID">{item.task_id || '-'}</Descriptions.Item>
                <Descriptions.Item label="数据源 ID">{item.source_id || '-'}</Descriptions.Item>
                <Descriptions.Item label="Agent ID">{item.agent_id || '-'}</Descriptions.Item>
                <Descriptions.Item label="创建时间">{formatDateTime(item.created_at)}</Descriptions.Item>
                <Descriptions.Item label="发送时间">{formatDateTime(item.sent_at)}</Descriptions.Item>
                <Descriptions.Item label="确认时间">{formatDateTime(item.acked_at)}</Descriptions.Item>
                <Descriptions.Item label="记录数">{formatNumber(item.record_count)}</Descriptions.Item>
                <Descriptions.Item label="文件数">{formatNumber(item.file_count)}</Descriptions.Item>
                <Descriptions.Item label="包大小">{formatBytes(item.size_bytes)}</Descriptions.Item>
                <Descriptions.Item label="偏移范围" span={2}>{formatNumber(item.from_offset)} ~ {formatNumber(item.to_offset)}</Descriptions.Item>
                <Descriptions.Item label="Batch ID" span={2}>{item.batch_id || '-'}</Descriptions.Item>
                <Descriptions.Item label="Request ID" span={2}>{item.request_id || '-'}</Descriptions.Item>
                <Descriptions.Item label="源路径" span={2}>
                  <Typography.Text code style={{ whiteSpace: 'normal', wordBreak: 'break-all' }}>
                    {item.source_ref || '-'}
                  </Typography.Text>
                </Descriptions.Item>
                <Descriptions.Item label="Next Cursor" span={2}>
                  <Typography.Text code style={{ whiteSpace: 'normal', wordBreak: 'break-all' }}>
                    {item.next_cursor || '-'}
                  </Typography.Text>
                </Descriptions.Item>
                <Descriptions.Item label="校验和" span={2}>
                  <Typography.Text code style={{ whiteSpace: 'normal', wordBreak: 'break-all' }}>
                    {item.checksum || '-'}
                  </Typography.Text>
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card size="small" title={`文件明细 (${item.files?.length ?? 0})`}>
              {(item.files?.length ?? 0) === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该包暂无文件明细" />
              ) : (
                <Table<PullPackageFile>
                  rowKey={(record) => `${record.file_path}-${record.from_offset}-${record.to_offset}`}
                  size="small"
                  columns={fileColumns}
                  dataSource={item.files}
                  pagination={false}
                  scroll={{ x: 980 }}
                />
              )}
            </Card>

            <Card size="small" title="Metadata / 扩展信息">
              <Typography.Text code style={{ display: 'block', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {metadataText}
              </Typography.Text>
            </Card>
          </div>
        )}
      </Drawer>

      <PullTaskDetailDrawer
        open={taskDetailOpen}
        taskId={item?.task_id}
        sourceName={sourceName}
        onClose={() => setTaskDetailOpen(false)}
      />

      <DeadLetterDrawer
        open={deadLetterOpen}
        sourceName={sourceName}
        sourceRef={item?.source_ref}
        packageId={item?.package_id}
        packageLabel={item?.package_no || item?.package_id}
        onClose={() => setDeadLetterOpen(false)}
      />
    </>
  );
};

export default PullPackageDetailDrawer;
