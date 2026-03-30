import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Descriptions, Drawer, Empty, Select, Space, Spin, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { fetchReceipts, type DeliveryReceiptItem } from '../../api/ingest';
import { COLORS } from '../../theme/tokens';

const RECEIPT_STATUS_OPTIONS = [
  { label: '全部状态', value: 'all' },
  { label: 'ACK', value: 'ack' },
  { label: 'NACK', value: 'nack' },
] as const;

interface ReceiptDrawerProps {
  open: boolean;
  sourceName?: string;
  sourceRef?: string;
  packageId?: string;
  packageLabel?: string;
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
  const [items, setItems] = useState<DeliveryReceiptItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ack' | 'nack'>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);

  const normalizedSourceRef = sourceRef?.trim() || '';
  const normalizedPackageId = packageId?.trim() || '';
  const hasQueryTarget = Boolean(normalizedSourceRef || normalizedPackageId);

  const loadReceipts = useCallback(async () => {
    if (!open || !hasQueryTarget) return;
    setLoading(true);
    setError('');
    try {
      const result = await fetchReceipts({
        source_ref: normalizedSourceRef || undefined,
        package_id: normalizedPackageId || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
        page,
        page_size: pageSize,
      });
      setItems(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [hasQueryTarget, normalizedPackageId, normalizedSourceRef, open, page, pageSize, statusFilter]);

  useEffect(() => {
    if (!open) return;
    void loadReceipts();
  }, [loadReceipts, open]);

  useEffect(() => {
    if (!open) {
      setItems([]);
      setError('');
      setStatusFilter('all');
      setPage(1);
      setPageSize(20);
      setTotal(0);
    }
  }, [open]);

  const latestItem = items[0] ?? null;
  const stats = useMemo(() => ({
    acked: items.filter((item) => String(item.status).toLowerCase() === 'ack').length,
    nacked: items.filter((item) => String(item.status).toLowerCase() === 'nack').length,
  }), [items]);

  const columns: ColumnsType<DeliveryReceiptItem> = [
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

  return (
    <Drawer
      open={open}
      title={packageLabel ? `${packageLabel} · 回执记录` : sourceName ? `${sourceName} · 回执记录` : '回执记录'}
      width={980}
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
          <Button onClick={() => void loadReceipts()}>刷新</Button>
        </Space>
      )}
    >
      {!hasQueryTarget ? (
        <Empty description="未找到回执查询条件" />
      ) : loading ? (
        <div style={{ padding: '48px 0', display: 'flex', justifyContent: 'center' }}>
          <Spin size="large" />
        </div>
      ) : error ? (
        <Alert type="error" showIcon message="回执记录加载失败" description={error} />
      ) : items.length === 0 ? (
        <Empty description="当前筛选条件下暂无回执记录" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {latestItem && String(latestItem.status).toLowerCase() === 'nack' ? (
            <Alert type="warning" showIcon message="最近回执为 NACK" description="建议结合死信与包明细查看下游拒收原因。" />
          ) : null}

          <Card size="small" title="最近回执">
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="最近状态">{getReceiptStatusMeta(latestItem?.status).label}</Descriptions.Item>
              <Descriptions.Item label="接收时间">{formatDateTime(latestItem?.received_at)}</Descriptions.Item>
              <Descriptions.Item label="包编号">{latestItem?.package_no || packageLabel || '-'}</Descriptions.Item>
              <Descriptions.Item label="包 ID">{latestItem?.package_id || normalizedPackageId || '-'}</Descriptions.Item>
              <Descriptions.Item label="错误码">{latestItem?.error_code || '-'}</Descriptions.Item>
              <Descriptions.Item label="本页 ACK / NACK">{formatNumber(stats.acked)} / {formatNumber(stats.nacked)}</Descriptions.Item>
              <Descriptions.Item label="源路径" span={2}>
                <Typography.Text code style={{ whiteSpace: 'normal', wordBreak: 'break-all' }}>
                  {latestItem?.source_ref || normalizedSourceRef || '-'}
                </Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="错误原因" span={2}>
                <Typography.Text code style={{ whiteSpace: 'normal', wordBreak: 'break-all' }}>
                  {latestItem?.reason || '-'}
                </Typography.Text>
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card
            size="small"
            title="回执列表"
            extra={<span style={{ color: '#94a3b8', fontSize: 12 }}>总数：{total} · ACK：{stats.acked} · NACK：{stats.nacked}</span>}
          >
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
              scroll={{ x: 980 }}
            />
          </Card>
        </div>
      )}
    </Drawer>
  );
};

export default ReceiptDrawer;
