import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Descriptions, Drawer, Empty, Select, Space, Spin, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { fetchPullPackages, type PullPackageFile, type PullPackageItem } from '../../api/ingest';
import { hasAnyCapability } from '../../auth/routeAuthorization';
import { useAuthStore } from '../../stores/authStore';
import { COLORS } from '../../theme/tokens';
import DeadLetterDrawer from './DeadLetterDrawer';
import ReceiptDrawer from './ReceiptDrawer';

const PACKAGE_STATUS_OPTIONS = [
  { label: '全部状态', value: 'all' },
  { label: '待创建', value: 'created' },
  { label: '上传中', value: 'uploading' },
  { label: '已上传', value: 'uploaded' },
  { label: '已确认', value: 'acked' },
  { label: '已拒绝', value: 'nacked' },
  { label: '失败', value: 'failed' },
  { label: '死信', value: 'dead_lettered' },
] as const;

interface PullPackageHistoryDrawerProps {
  open: boolean;
  sourceName?: string;
  agentId?: string;
  sourceRef?: string;
  onClose: () => void;
}

interface ReceiptTarget {
  packageId?: string;
  packageLabel?: string;
}

interface DeadLetterTarget {
  packageId?: string;
  packageLabel?: string;
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

function isAbnormalPackageStatus(status?: string) {
  return ['failed', 'nacked', 'dead_lettered'].includes(String(status ?? '').toLowerCase());
}

const fileColumns: ColumnsType<PullPackageFile> = [
  {
    title: '文件',
    dataIndex: 'file_path',
    key: 'file_path',
    render: (value: string) => (
      <Typography.Text code style={{ whiteSpace: 'normal', wordBreak: 'break-all' }}>
        {value || '-'}
      </Typography.Text>
    ),
  },
  {
    title: '范围',
    key: 'offsets',
    width: 180,
    render: (_, item) => `${formatNumber(item.from_offset)} ~ ${formatNumber(item.to_offset)}`,
  },
  {
    title: '行数',
    dataIndex: 'line_count',
    key: 'line_count',
    width: 100,
    align: 'right',
    render: (value?: number) => formatNumber(value),
  },
  {
    title: '大小',
    dataIndex: 'size_bytes',
    key: 'size_bytes',
    width: 120,
    align: 'right',
    render: (value?: number) => formatBytes(value),
  },
  {
    title: '序列',
    key: 'sequence',
    width: 180,
    render: (_, item) => `${formatNumber(item.first_sequence)} ~ ${formatNumber(item.last_sequence)}`,
  },
];

const PullPackageHistoryDrawer: React.FC<PullPackageHistoryDrawerProps> = ({
  open,
  sourceName,
  agentId,
  sourceRef,
  onClose,
}) => {
  const capabilities = useAuthStore((state) => state.capabilities);
  const canReadReceipt = useMemo(() => hasAnyCapability(capabilities, ['ingest.package.read']), [capabilities]);
  const canReadDeadLetter = useMemo(() => hasAnyCapability(capabilities, ['ingest.dead_letter.read']), [capabilities]);

  const [packages, setPackages] = useState<PullPackageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [receiptTarget, setReceiptTarget] = useState<ReceiptTarget | null>(null);
  const [deadLetterTarget, setDeadLetterTarget] = useState<DeadLetterTarget | null>(null);

  const normalizedAgentId = agentId?.trim() || '';
  const normalizedSourceRef = sourceRef?.trim() || '';
  const hasQueryTarget = Boolean(normalizedAgentId || normalizedSourceRef);

  const loadPackages = useCallback(async () => {
    if (!open || !hasQueryTarget) return;
    setLoading(true);
    setError('');
    try {
      const baseParams = {
        source_ref: normalizedSourceRef || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
        page,
        page_size: pageSize,
      };
      let result = await fetchPullPackages({
        ...baseParams,
        agent_id: normalizedAgentId || undefined,
      });
      if (result.total === 0 && normalizedAgentId && normalizedSourceRef) {
        result = await fetchPullPackages(baseParams);
      }
      setPackages(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [hasQueryTarget, normalizedAgentId, normalizedSourceRef, open, page, pageSize, statusFilter]);

  useEffect(() => {
    if (!open) return;
    void loadPackages();
  }, [loadPackages, open]);

  useEffect(() => {
    if (!open) {
      setStatusFilter('all');
      setPackages([]);
      setError('');
      setPage(1);
      setPageSize(20);
      setTotal(0);
      setReceiptTarget(null);
      setDeadLetterTarget(null);
    }
  }, [open]);

  const latestPackage = packages[0] ?? null;
  const pageStats = useMemo(() => ({
    acked: packages.filter((item) => item.status === 'acked').length,
    failed: packages.filter((item) => isAbnormalPackageStatus(item.status)).length,
    inFlight: packages.filter((item) => item.status === 'created' || item.status === 'uploading' || item.status === 'uploaded').length,
  }), [packages]);

  const columns: ColumnsType<PullPackageItem> = useMemo(() => {
    const baseColumns: ColumnsType<PullPackageItem> = [
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: 110,
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
        title: '包编号',
        key: 'package_no',
        width: 220,
        render: (_, item) => (
          <div style={{ fontSize: 12 }}>
            <div style={{ fontFamily: 'JetBrains Mono, monospace' }}>{item.package_no || '-'}</div>
            <div style={{ color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }}>{item.package_id || '-'}</div>
          </div>
        ),
      },
      {
        title: '时间',
        key: 'time',
        width: 220,
        render: (_, item) => (
          <div style={{ fontSize: 12 }}>
            <div>创建：{formatDateTime(item.created_at)}</div>
            <div>确认：{formatDateTime(item.acked_at)}</div>
          </div>
        ),
      },
      {
        title: '记录 / 文件 / 大小',
        key: 'metrics',
        width: 180,
        render: (_, item) => (
          <div style={{ fontSize: 12 }}>
            <div>记录：{formatNumber(item.record_count)}</div>
            <div>文件：{formatNumber(item.file_count)}</div>
            <div>大小：{formatBytes(item.size_bytes)}</div>
          </div>
        ),
      },
      {
        title: 'Batch / Cursor',
        key: 'cursor',
        width: 220,
        render: (_, item) => (
          <div style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}>
            <div>{item.batch_id || '-'}</div>
            <div style={{ color: '#94a3b8', whiteSpace: 'normal', wordBreak: 'break-all' }}>{item.next_cursor || '-'}</div>
          </div>
        ),
      },
      {
        title: '源路径',
        dataIndex: 'source_ref',
        key: 'source_ref',
        render: (value?: string) => (
          <Typography.Text code style={{ whiteSpace: 'normal', wordBreak: 'break-all' }}>
            {value || '-'}
          </Typography.Text>
        ),
      },
    ];

    if (canReadReceipt || canReadDeadLetter) {
      baseColumns.push({
        title: '操作',
        key: 'actions',
        width: 156,
        align: 'right',
        render: (_, item) => (
          <Space size={0}>
            {canReadReceipt ? (
              <Button
                size="small"
                type="link"
                disabled={!item.package_id}
                onClick={() => setReceiptTarget({ packageId: item.package_id, packageLabel: item.package_no || item.package_id })}
              >
                回执
              </Button>
            ) : null}
            {canReadDeadLetter ? (
              <Button
                size="small"
                type="link"
                disabled={!item.package_id}
                onClick={() => setDeadLetterTarget({ packageId: item.package_id, packageLabel: item.package_no || item.package_id })}
              >
                死信
              </Button>
            ) : null}
          </Space>
        ),
      });
    }

    return baseColumns;
  }, [canReadDeadLetter, canReadReceipt]);

  return (
    <Drawer
      open={open}
      title={sourceName ? `${sourceName} · 包历史` : '包历史'}
      width={1080}
      onClose={onClose}
      extra={(
        <Space>
          <Select
            id="pull-package-status-filter"
            value={statusFilter}
            style={{ width: 140 }}
            options={PACKAGE_STATUS_OPTIONS.map((item) => ({ label: item.label, value: item.value }))}
            onChange={(value) => {
              setStatusFilter(value);
              setPage(1);
            }}
          />
          {canReadReceipt ? (
            <Button onClick={() => setReceiptTarget({})}>源级回执</Button>
          ) : null}
          {canReadDeadLetter ? (
            <Button onClick={() => setDeadLetterTarget({})}>源级死信</Button>
          ) : null}
          <Button onClick={() => void loadPackages()}>刷新</Button>
        </Space>
      )}
    >
      {!hasQueryTarget ? (
        <Empty description="未找到可用于查询包历史的 Agent 或路径" />
      ) : loading ? (
        <div style={{ padding: '48px 0', display: 'flex', justifyContent: 'center' }}>
          <Spin size="large" />
        </div>
      ) : error ? (
        <Alert type="error" showIcon message="包历史加载失败" description={error} />
      ) : packages.length === 0 ? (
        <Empty description="当前筛选条件下暂无增量包记录" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {latestPackage && isAbnormalPackageStatus(latestPackage.status) ? (
            <Alert
              type="warning"
              showIcon
              message="最近增量包存在异常状态"
              description={`最新包状态为 ${getPackageStatusMeta(latestPackage.status).label}，建议查看文件明细、死信和游标推进情况。`}
            />
          ) : null}

          <Card size="small" title="最近增量包">
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="最近状态">{getPackageStatusMeta(latestPackage?.status).label}</Descriptions.Item>
              <Descriptions.Item label="包编号">{latestPackage?.package_no || '-'}</Descriptions.Item>
              <Descriptions.Item label="创建时间">{formatDateTime(latestPackage?.created_at)}</Descriptions.Item>
              <Descriptions.Item label="确认时间">{formatDateTime(latestPackage?.acked_at)}</Descriptions.Item>
              <Descriptions.Item label="记录数">{formatNumber(latestPackage?.record_count)}</Descriptions.Item>
              <Descriptions.Item label="文件数">{formatNumber(latestPackage?.file_count)}</Descriptions.Item>
              <Descriptions.Item label="包大小">{formatBytes(latestPackage?.size_bytes)}</Descriptions.Item>
              <Descriptions.Item label="Batch ID">{latestPackage?.batch_id || '-'}</Descriptions.Item>
              <Descriptions.Item label="Next Cursor" span={2}>
                <Typography.Text code style={{ whiteSpace: 'normal', wordBreak: 'break-all' }}>
                  {latestPackage?.next_cursor || '-'}
                </Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="源路径" span={2}>
                <Typography.Text code style={{ whiteSpace: 'normal', wordBreak: 'break-all' }}>
                  {latestPackage?.source_ref || normalizedSourceRef || '-'}
                </Typography.Text>
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card
            size="small"
            title="增量包列表"
            extra={<span style={{ color: '#94a3b8', fontSize: 12 }}>总数：{total} · 已确认：{pageStats.acked} · 异常：{pageStats.failed} · 处理中：{pageStats.inFlight}</span>}
          >
            <Table<PullPackageItem>
              rowKey={(record) => record.package_id}
              size="small"
              columns={columns}
              dataSource={packages}
              expandable={{
                expandedRowRender: (item) => (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <Descriptions bordered size="small" column={2}>
                      <Descriptions.Item label="偏移范围">{formatNumber(item.from_offset)} ~ {formatNumber(item.to_offset)}</Descriptions.Item>
                      <Descriptions.Item label="校验和">{item.checksum || '-'}</Descriptions.Item>
                      <Descriptions.Item label="Task ID">{item.task_id || '-'}</Descriptions.Item>
                      <Descriptions.Item label="Request ID">{item.request_id || '-'}</Descriptions.Item>
                      <Descriptions.Item label="Metadata" span={2}>
                        <Typography.Text code style={{ whiteSpace: 'normal', wordBreak: 'break-all' }}>
                          {item.metadata && Object.keys(item.metadata).length > 0 ? JSON.stringify(item.metadata) : '-'}
                        </Typography.Text>
                      </Descriptions.Item>
                    </Descriptions>
                    <Card size="small" type="inner" title={`文件明细 (${item.files?.length ?? 0})`}>
                      {(item.files?.length ?? 0) === 0 ? (
                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该包未返回文件明细" />
                      ) : (
                        <Table<PullPackageFile>
                          rowKey={(record) => `${item.package_id}-${record.file_path}-${record.from_offset}`}
                          size="small"
                          columns={fileColumns}
                          dataSource={item.files}
                          pagination={false}
                          scroll={{ x: 920 }}
                        />
                      )}
                    </Card>
                  </div>
                ),
                rowExpandable: (item) => Boolean((item.files?.length ?? 0) > 0 || (item.metadata && Object.keys(item.metadata).length > 0)),
              }}
              pagination={{
                current: page,
                pageSize,
                total,
                showSizeChanger: true,
                pageSizeOptions: [10, 20, 50],
                showTotal: (value) => `共 ${value} 条`,
                onChange: (nextPage, nextPageSize) => {
                  if (nextPageSize !== pageSize) {
                    setPageSize(nextPageSize);
                    setPage(1);
                    return;
                  }
                  setPage(nextPage);
                },
              }}
              scroll={{ x: 1240 }}
            />
          </Card>
        </div>
      )}

      <ReceiptDrawer
        open={Boolean(receiptTarget)}
        sourceName={sourceName}
        sourceRef={normalizedSourceRef}
        packageId={receiptTarget?.packageId}
        packageLabel={receiptTarget?.packageLabel}
        onClose={() => setReceiptTarget(null)}
      />

      <DeadLetterDrawer
        open={Boolean(deadLetterTarget)}
        sourceName={sourceName}
        sourceRef={normalizedSourceRef}
        packageId={deadLetterTarget?.packageId}
        packageLabel={deadLetterTarget?.packageLabel}
        onClose={() => setDeadLetterTarget(null)}
      />
    </Drawer>
  );
};

export default PullPackageHistoryDrawer;
