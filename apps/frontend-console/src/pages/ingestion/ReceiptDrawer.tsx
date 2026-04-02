import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Descriptions, Drawer, Empty, Select, Space, Spin, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { hasAnyCapability } from '../../auth/routeAuthorization';
import {
  fetchReceipts,
  type DeliveryReceiptItem,
  type ReceiptSummary,
} from '../../api/ingest';
import { useAuthStore } from '../../stores/authStore';
import { COLORS } from '../../theme/tokens';
import DeadLetterDrawer from './DeadLetterDrawer';
import PullPackageDetailDrawer from './PullPackageDetailDrawer';

const RECEIPT_STATUS_OPTIONS = [
  { label: '全部状态', value: 'all' },
  { label: 'ACK', value: 'ack' },
  { label: 'NACK', value: 'nack' },
] as const;

const EMPTY_RECEIPT_SUMMARY: ReceiptSummary = {
  ack_count: 0,
  nack_count: 0,
  error_code_buckets: [],
  nack_reason_buckets: [],
};

interface ReceiptDrawerProps {
  open: boolean;
  sourceName?: string;
  sourceRef?: string;
  packageId?: string;
  packageLabel?: string;
  onClose: () => void;
}

interface DeadLetterTarget {
  sourceRef?: string;
  packageId?: string;
  packageLabel?: string;
}

interface PackageDetailTarget {
  packageId?: string;
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

function getReceiptStatusMeta(status?: string) {
  switch (String(status ?? '').toLowerCase()) {
    case 'ack':
      return { label: 'ACK', color: 'success', dot: COLORS.success };
    case 'nack':
      return { label: 'NACK', color: 'error', dot: COLORS.danger };
    default:
      return { label: String(status ?? '-').toUpperCase(), color: 'default', dot: '#94a3b8' };
  }
}

const ReceiptDrawer: React.FC<ReceiptDrawerProps> = ({
  open,
  sourceName,
  sourceRef,
  packageId,
  packageLabel,
  onClose,
}) => {
  const capabilities = useAuthStore((state) => state.capabilities);
  const canReadPackage = useMemo(() => hasAnyCapability(capabilities, ['ingest.package.read']), [capabilities]);
  const canReadDeadLetter = useMemo(() => hasAnyCapability(capabilities, ['ingest.dead_letter.read']), [capabilities]);

  const [items, setItems] = useState<DeliveryReceiptItem[]>([]);
  const [summary, setSummary] = useState<ReceiptSummary>(EMPTY_RECEIPT_SUMMARY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ack' | 'nack'>('all');
  const [errorCodeFilter, setErrorCodeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [deadLetterTarget, setDeadLetterTarget] = useState<DeadLetterTarget | null>(null);
  const [packageDetailTarget, setPackageDetailTarget] = useState<PackageDetailTarget | null>(null);

  const normalizedSourceRef = sourceRef?.trim() || '';
  const normalizedPackageId = packageId?.trim() || '';
  const hasQueryTarget = Boolean(normalizedSourceRef || normalizedPackageId);
  const scopeTotal = summary.ack_count + summary.nack_count;
  const hasAnyReceiptsInScope = scopeTotal > 0;

  const loadReceipts = useCallback(async () => {
    if (!open || !hasQueryTarget) return;
    setLoading(true);
    setError('');
    try {
      const result = await fetchReceipts({
        source_ref: normalizedSourceRef || undefined,
        package_id: normalizedPackageId || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
        error_code: errorCodeFilter || undefined,
        page,
        page_size: pageSize,
      });
      setItems(result.items);
      setTotal(result.total);
      setSummary(result.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setItems([]);
      setTotal(0);
      setSummary(EMPTY_RECEIPT_SUMMARY);
    } finally {
      setLoading(false);
    }
  }, [errorCodeFilter, hasQueryTarget, normalizedPackageId, normalizedSourceRef, open, page, pageSize, statusFilter]);

  useEffect(() => {
    if (!open) return;
    void loadReceipts();
  }, [loadReceipts, open]);

  useEffect(() => {
    if (!open) {
      setItems([]);
      setSummary(EMPTY_RECEIPT_SUMMARY);
      setError('');
      setStatusFilter('all');
      setErrorCodeFilter('');
      setPage(1);
      setPageSize(20);
      setTotal(0);
      setDeadLetterTarget(null);
      setPackageDetailTarget(null);
    }
  }, [open]);

  const latestItem = items[0] ?? null;
  const errorCodeOptions = useMemo(() => ([
    { label: '全部错误码', value: '' },
    ...(summary.error_code_buckets ?? []).map((item) => ({
      label: `${item.error_code} (${formatNumber(item.count)})`,
      value: item.error_code,
    })),
  ]), [summary.error_code_buckets]);

  const openScopeDeadLetters = useCallback(() => {
    setDeadLetterTarget({
      sourceRef: normalizedSourceRef || latestItem?.source_ref,
      packageId: normalizedPackageId || undefined,
      packageLabel: packageLabel || latestItem?.package_no || latestItem?.package_id || undefined,
    });
  }, [latestItem?.package_id, latestItem?.package_no, latestItem?.source_ref, normalizedPackageId, normalizedSourceRef, packageLabel]);

  const openReceiptDeadLetters = useCallback((item: DeliveryReceiptItem) => {
    setDeadLetterTarget({
      sourceRef: item.source_ref || normalizedSourceRef,
      packageId: item.package_id || undefined,
      packageLabel: item.package_no || item.package_id || undefined,
    });
  }, [normalizedSourceRef]);

  const openPackageDetail = useCallback((item?: DeliveryReceiptItem | null) => {
    const nextPackageId = item?.package_id || normalizedPackageId;
    if (!nextPackageId) return;
    setPackageDetailTarget({ packageId: nextPackageId });
  }, [normalizedPackageId]);

  const columns = useMemo<ColumnsType<DeliveryReceiptItem>>(() => {
    const baseColumns: ColumnsType<DeliveryReceiptItem> = [
      {
        title: '状态',
        key: 'status',
        width: 110,
        render: (_, item) => {
          const meta = getReceiptStatusMeta(item.status);
          return (
            <Tag color={meta.color} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta.dot, display: 'inline-block' }} />
              {meta.label}
            </Tag>
          );
        },
      },
      {
        title: '回执 ID / 包',
        key: 'ids',
        width: 260,
        render: (_, item) => (
          <div style={{ fontSize: 12 }}>
            <div style={{ fontFamily: 'JetBrains Mono, monospace' }}>{item.receipt_id || '-'}</div>
            <div style={{ color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }}>{item.package_no || item.package_id || '-'}</div>
          </div>
        ),
      },
      {
        title: '接收时间',
        key: 'time',
        width: 220,
        render: (_, item) => (
          <div style={{ fontSize: 12 }}>
            <div>接收：{formatDateTime(item.received_at)}</div>
            <div>创建：{formatDateTime(item.created_at)}</div>
          </div>
        ),
      },
      {
        title: '错误码 / 原因',
        key: 'reason',
        render: (_, item) => (
          <div style={{ fontSize: 12 }}>
            <div style={{ fontFamily: 'JetBrains Mono, monospace' }}>{item.error_code || '-'}</div>
            <div style={{ whiteSpace: 'normal', wordBreak: 'break-all', color: '#94a3b8' }}>{item.reason || '-'}</div>
          </div>
        ),
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

    if (canReadPackage || canReadDeadLetter) {
      baseColumns.push({
        title: '操作',
        key: 'actions',
        width: 148,
        align: 'right',
        render: (_, item) => (
          <Space size={0}>
            {canReadPackage ? (
              <Button
                size="small"
                type="link"
                disabled={!item.package_id}
                onClick={() => openPackageDetail(item)}
              >
                包详情
              </Button>
            ) : null}
            {canReadDeadLetter ? (
              <Button
                size="small"
                type="link"
                disabled={!item.package_id && !item.source_ref}
                onClick={() => openReceiptDeadLetters(item)}
              >
                死信
              </Button>
            ) : null}
          </Space>
        ),
      });
    }

    return baseColumns;
  }, [canReadDeadLetter, canReadPackage, openPackageDetail, openReceiptDeadLetters]);

  return (
    <>
      <Drawer
        open={open}
        title={packageLabel ? `${packageLabel} · 回执记录` : sourceName ? `${sourceName} · 回执记录` : '回执记录'}
        width={1020}
        onClose={onClose}
        extra={(
          <Space>
            <Select
              id="receipt-status-filter"
              value={statusFilter}
              style={{ width: 140 }}
              options={RECEIPT_STATUS_OPTIONS.map((item) => ({ label: item.label, value: item.value }))}
              onChange={(value) => {
                setStatusFilter(value);
                setPage(1);
              }}
            />
            <Select
              id="receipt-error-code-filter"
              value={errorCodeFilter}
              style={{ width: 220 }}
              options={errorCodeOptions}
              disabled={summary.error_code_buckets.length === 0}
              placeholder="按错误码筛选"
              onChange={(value) => {
                setErrorCodeFilter(value);
                setPage(1);
              }}
            />
            {canReadDeadLetter ? (
              <Button disabled={!normalizedSourceRef && !normalizedPackageId && !latestItem} onClick={openScopeDeadLetters}>
                查看死信
              </Button>
            ) : null}
            <Button onClick={() => void loadReceipts()}>刷新</Button>
          </Space>
        )}
      >
        {!hasQueryTarget ? (
          <Empty description="未找到回执查询条件" />
        ) : loading && !hasAnyReceiptsInScope && items.length === 0 ? (
          <div style={{ padding: '48px 0', display: 'flex', justifyContent: 'center' }}>
            <Spin size="large" />
          </div>
        ) : error ? (
          <Alert type="error" showIcon message="回执记录加载失败" description={error} />
        ) : !hasAnyReceiptsInScope ? (
          <Empty description="当前范围暂无回执记录" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {latestItem && String(latestItem.status).toLowerCase() === 'nack' ? (
              <Alert
                type="warning"
                showIcon
                message="最近回执为 NACK"
                description={canReadDeadLetter ? (
                  <Space wrap>
                    <span>建议结合死信与包明细查看下游拒收原因。</span>
                    <Button size="small" onClick={() => openReceiptDeadLetters(latestItem)}>查看对应死信</Button>
                  </Space>
                ) : '建议结合死信与包明细查看下游拒收原因。'}
              />
            ) : null}

            {!loading && items.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前筛选条件没有命中回执" />
            ) : null}

            <Card size="small" title="范围统计">
              <Descriptions bordered size="small" column={2}>
                <Descriptions.Item label="范围 ACK / NACK">
                  {formatNumber(summary.ack_count)} / {formatNumber(summary.nack_count)}
                </Descriptions.Item>
                <Descriptions.Item label="当前筛选结果">{formatNumber(total)}</Descriptions.Item>
                <Descriptions.Item label="错误码种类">{formatNumber(summary.error_code_buckets.length)}</Descriptions.Item>
                <Descriptions.Item label="范围总数">{formatNumber(scopeTotal)}</Descriptions.Item>
                <Descriptions.Item label="源路径" span={2}>
                  <Typography.Text code style={{ whiteSpace: 'normal', wordBreak: 'break-all' }}>
                    {normalizedSourceRef || latestItem?.source_ref || '-'}
                  </Typography.Text>
                </Descriptions.Item>
                <Descriptions.Item label="Top 错误码" span={2}>
                  {summary.error_code_buckets.length === 0 ? (
                    <span style={{ color: '#94a3b8' }}>暂无错误码聚合</span>
                  ) : (
                    <Space size={[8, 8]} wrap>
                      {summary.error_code_buckets.slice(0, 6).map((item) => (
                        <Tag key={item.error_code} color="error">
                          {item.error_code} · {formatNumber(item.count)}
                        </Tag>
                      ))}
                    </Space>
                  )}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            {latestItem ? (
              <Card
                size="small"
                title="最近回执"
                extra={canReadPackage ? (
                  <Button size="small" type="link" disabled={!latestItem.package_id && !normalizedPackageId} onClick={() => openPackageDetail(latestItem)}>
                    包详情
                  </Button>
                ) : null}
              >
                <Descriptions bordered size="small" column={2}>
                  <Descriptions.Item label="最近状态">{getReceiptStatusMeta(latestItem.status).label}</Descriptions.Item>
                  <Descriptions.Item label="接收时间">{formatDateTime(latestItem.received_at)}</Descriptions.Item>
                  <Descriptions.Item label="包编号">{latestItem.package_no || packageLabel || '-'}</Descriptions.Item>
                  <Descriptions.Item label="包 ID">{latestItem.package_id || normalizedPackageId || '-'}</Descriptions.Item>
                  <Descriptions.Item label="错误码">{latestItem.error_code || '-'}</Descriptions.Item>
                  <Descriptions.Item label="错误原因">{latestItem.reason || '-'}</Descriptions.Item>
                  <Descriptions.Item label="源路径" span={2}>
                    <Typography.Text code style={{ whiteSpace: 'normal', wordBreak: 'break-all' }}>
                      {latestItem.source_ref || normalizedSourceRef || '-'}
                    </Typography.Text>
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            ) : null}

            {summary.nack_reason_buckets.length > 0 ? (
              <Card size="small" title="NACK 原因分布" extra={<span style={{ color: '#94a3b8', fontSize: 12 }}>Top {summary.nack_reason_buckets.length}</span>}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {summary.nack_reason_buckets.map((item, index) => (
                    <div
                      key={`${item.error_code || 'none'}-${item.reason || 'none'}-${index}`}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: 12,
                        paddingBottom: 12,
                        borderBottom: index === summary.nack_reason_buckets.length - 1 ? 'none' : '1px solid rgba(148, 163, 184, 0.18)',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                        <Space wrap>
                          <Tag color="error">{item.error_code || 'NACK'}</Tag>
                        </Space>
                        <Typography.Text style={{ fontSize: 12, whiteSpace: 'normal', wordBreak: 'break-all' }}>
                          {item.reason || '无错误说明'}
                        </Typography.Text>
                      </div>
                      <Typography.Text type="secondary" style={{ whiteSpace: 'nowrap' }}>
                        {formatNumber(item.count)} 次
                      </Typography.Text>
                    </div>
                  ))}
                </div>
              </Card>
            ) : null}

            <Card
              size="small"
              title="回执列表"
              extra={<span style={{ color: '#94a3b8', fontSize: 12 }}>筛选结果：{formatNumber(total)} · 范围 ACK：{formatNumber(summary.ack_count)} · 范围 NACK：{formatNumber(summary.nack_count)}</span>}
            >
              {items.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前筛选条件下暂无回执记录" />
              ) : (
                <Table<DeliveryReceiptItem>
                  rowKey={(record) => record.receipt_id}
                  size="small"
                  columns={columns}
                  dataSource={items}
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
                  scroll={{ x: 1080 }}
                />
              )}
            </Card>
          </div>
        )}
      </Drawer>

      <DeadLetterDrawer
        open={Boolean(deadLetterTarget)}
        sourceName={sourceName}
        sourceRef={deadLetterTarget?.sourceRef || normalizedSourceRef}
        packageId={deadLetterTarget?.packageId}
        packageLabel={deadLetterTarget?.packageLabel}
        onClose={() => setDeadLetterTarget(null)}
      />

      <PullPackageDetailDrawer
        open={Boolean(packageDetailTarget)}
        packageId={packageDetailTarget?.packageId}
        sourceName={sourceName}
        onClose={() => setPackageDetailTarget(null)}
      />
    </>
  );
};

export default ReceiptDrawer;
