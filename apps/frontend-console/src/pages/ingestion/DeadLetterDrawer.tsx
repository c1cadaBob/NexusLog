import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, App, Button, Card, Descriptions, Drawer, Empty, Input, Modal, Select, Space, Spin, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { fetchDeadLetters, replayDeadLetters, type DeadLetterItem } from '../../api/ingest';
import { hasAnyCapability } from '../../auth/routeAuthorization';
import { useAuthStore } from '../../stores/authStore';
import { COLORS } from '../../theme/tokens';

const REPLAYED_OPTIONS = [
  { label: '全部状态', value: 'all' },
  { label: '待处理', value: 'no' },
  { label: '已重放', value: 'yes' },
] as const;

interface DeadLetterDrawerProps {
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

function getReplayMeta(record?: Pick<DeadLetterItem, 'replayed_at'> | null) {
  if (record?.replayed_at) {
    return { label: '已重放', color: 'processing', dot: COLORS.primary };
  }
  return { label: '待处理', color: 'warning', dot: COLORS.warning };
}

const DeadLetterDrawer: React.FC<DeadLetterDrawerProps> = ({
  open,
  sourceName,
  sourceRef,
  packageId,
  packageLabel,
  onClose,
}) => {
  const { message: messageApi } = App.useApp();
  const capabilities = useAuthStore((state) => state.capabilities);
  const canReplayDeadLetter = useMemo(() => hasAnyCapability(capabilities, ['ingest.dead_letter.replay']), [capabilities]);

  const [items, setItems] = useState<DeadLetterItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [replayedFilter, setReplayedFilter] = useState<'all' | 'yes' | 'no'>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [replayModalOpen, setReplayModalOpen] = useState(false);
  const [replayReason, setReplayReason] = useState('');
  const [replaySubmitting, setReplaySubmitting] = useState(false);

  const normalizedSourceRef = sourceRef?.trim() || '';
  const normalizedPackageId = packageId?.trim() || '';
  const hasQueryTarget = Boolean(normalizedSourceRef || normalizedPackageId);

  const loadDeadLetters = useCallback(async () => {
    if (!open || !hasQueryTarget) return;
    setLoading(true);
    setError('');
    try {
      const result = await fetchDeadLetters({
        source_ref: normalizedSourceRef || undefined,
        package_id: normalizedPackageId || undefined,
        replayed: replayedFilter === 'all' ? undefined : replayedFilter,
        page,
        page_size: pageSize,
      });
      setItems(result.items);
      setTotal(result.total);
      setSelectedRowKeys((current) => current.filter((key) => result.items.some((item) => item.dead_letter_id === key)));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [hasQueryTarget, normalizedPackageId, normalizedSourceRef, open, page, pageSize, replayedFilter]);

  useEffect(() => {
    if (!open) return;
    void loadDeadLetters();
  }, [loadDeadLetters, open]);

  useEffect(() => {
    if (!open) {
      setItems([]);
      setError('');
      setReplayedFilter('all');
      setPage(1);
      setPageSize(20);
      setTotal(0);
      setSelectedRowKeys([]);
      setReplayModalOpen(false);
      setReplayReason('');
      setReplaySubmitting(false);
    }
  }, [open]);

  const latestItem = items[0] ?? null;
  const stats = useMemo(() => ({
    pending: items.filter((item) => !item.replayed_at).length,
    replayed: items.filter((item) => Boolean(item.replayed_at)).length,
    retries: items.reduce((sum, item) => sum + (item.retry_count || 0), 0),
  }), [items]);

  const handleReplay = useCallback(async () => {
    const deadLetterIds = selectedRowKeys.map((item) => String(item));
    const reason = replayReason.trim();
    if (deadLetterIds.length === 0) {
      messageApi.warning('请先选择需要重放的死信');
      return;
    }
    if (!reason) {
      messageApi.warning('请输入重放原因');
      return;
    }

    setReplaySubmitting(true);
    try {
      const result = await replayDeadLetters({
        dead_letter_ids: deadLetterIds,
        reason,
      });
      messageApi.success(`已提交死信重放：${result.replayed_count} 条 · ${result.replay_batch_id}`);
      setReplayModalOpen(false);
      setReplayReason('');
      setSelectedRowKeys([]);
      void loadDeadLetters();
    } catch (err) {
      messageApi.error(`死信重放失败：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setReplaySubmitting(false);
    }
  }, [loadDeadLetters, messageApi, replayReason, selectedRowKeys]);

  const columns: ColumnsType<DeadLetterItem> = [
    {
      title: '状态',
      key: 'replayed',
      width: 110,
      render: (_, item) => {
        const meta = getReplayMeta(item);
        return (
          <Tag color={meta.color} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta.dot, display: 'inline-block' }} />
            {meta.label}
          </Tag>
        );
      },
    },
    {
      title: '死信 ID / 包',
      key: 'ids',
      width: 240,
      render: (_, item) => (
        <div style={{ fontSize: 12 }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace' }}>{item.dead_letter_id}</div>
          <div style={{ color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }}>{item.package_id || '-'}</div>
        </div>
      ),
    },
    {
      title: '失败时间',
      dataIndex: 'failed_at',
      key: 'failed_at',
      width: 180,
      render: (value?: string) => formatDateTime(value),
    },
    {
      title: '错误信息',
      key: 'error',
      render: (_, item) => (
        <div style={{ fontSize: 12 }}>
          <div>{item.error_code || '-'}</div>
          <div style={{ color: item.error_message ? COLORS.danger : '#94a3b8', whiteSpace: 'normal', wordBreak: 'break-all' }}>
            {item.error_message || '无错误说明'}
          </div>
        </div>
      ),
    },
    {
      title: '重放',
      key: 'replay',
      width: 220,
      render: (_, item) => (
        <div style={{ fontSize: 12 }}>
          <div>次数：{formatNumber(item.retry_count)}</div>
          <div>{formatDateTime(item.replayed_at)}</div>
          <div style={{ color: '#94a3b8', whiteSpace: 'normal', wordBreak: 'break-all' }}>{item.replay_reason || item.replay_batch_id || '-'}</div>
        </div>
      ),
    },
  ];

  return (
    <Drawer
      open={open}
      title={packageLabel ? `${packageLabel} · 死信记录` : sourceName ? `${sourceName} · 死信记录` : '死信记录'}
      width={980}
      destroyOnHidden
      onClose={onClose}
      extra={(
        <Space>
          <Select
            id="dead-letter-replayed-filter"
            value={replayedFilter}
            style={{ width: 140 }}
            options={REPLAYED_OPTIONS.map((item) => ({ label: item.label, value: item.value }))}
            onChange={(value) => {
              setReplayedFilter(value);
              setPage(1);
            }}
          />
          <Button onClick={() => void loadDeadLetters()}>刷新</Button>
        </Space>
      )}
    >
      {!hasQueryTarget ? (
        <Empty description="未找到死信查询条件" />
      ) : loading ? (
        <div style={{ padding: '48px 0', display: 'flex', justifyContent: 'center' }}>
          <Spin size="large" />
        </div>
      ) : error ? (
        <Alert type="error" showIcon message="死信记录加载失败" description={error} />
      ) : items.length === 0 ? (
        <Empty description="当前筛选条件下暂无死信记录" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {latestItem && !latestItem.replayed_at ? (
            <Alert type="warning" showIcon message="存在待处理死信" description="建议检查错误信息后执行重放，确认链路是否恢复。" />
          ) : null}

          <Card size="small" title="最近死信">
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="状态">{getReplayMeta(latestItem).label}</Descriptions.Item>
              <Descriptions.Item label="失败时间">{formatDateTime(latestItem?.failed_at)}</Descriptions.Item>
              <Descriptions.Item label="包 ID">{latestItem?.package_id || normalizedPackageId || '-'}</Descriptions.Item>
              <Descriptions.Item label="重试次数">{formatNumber(latestItem?.retry_count)}</Descriptions.Item>
              <Descriptions.Item label="错误码">{latestItem?.error_code || '-'}</Descriptions.Item>
              <Descriptions.Item label="最近重放">{formatDateTime(latestItem?.replayed_at)}</Descriptions.Item>
              <Descriptions.Item label="源路径" span={2}>
                <Typography.Text code style={{ whiteSpace: 'normal', wordBreak: 'break-all' }}>
                  {latestItem?.source_ref || normalizedSourceRef || '-'}
                </Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="错误说明" span={2}>
                <Typography.Text code style={{ whiteSpace: 'normal', wordBreak: 'break-all' }}>
                  {latestItem?.error_message || '-'}
                </Typography.Text>
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {canReplayDeadLetter ? (
            <Card size="small">
              <Space style={{ width: '100%', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <span style={{ color: '#94a3b8', fontSize: 13 }}>已选择 {selectedRowKeys.length} 条死信</span>
                <Button type="primary" disabled={selectedRowKeys.length === 0} onClick={() => setReplayModalOpen(true)}>
                  重放选中
                </Button>
              </Space>
            </Card>
          ) : null}

          <Card
            size="small"
            title="死信列表"
            extra={<span style={{ color: '#94a3b8', fontSize: 12 }}>总数：{total} · 待处理：{stats.pending} · 已重放：{stats.replayed} · 当前页重试次数：{stats.retries}</span>}
          >
            <Table<DeadLetterItem>
              rowKey={(record) => record.dead_letter_id}
              size="small"
              columns={columns}
              dataSource={items}
              rowSelection={canReplayDeadLetter ? {
                selectedRowKeys,
                onChange: setSelectedRowKeys,
              } : undefined}
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

      <Modal
        title="重放死信"
        open={replayModalOpen}
        onCancel={() => setReplayModalOpen(false)}
        onOk={() => void handleReplay()}
        confirmLoading={replaySubmitting}
        okText="确认重放"
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <div style={{ color: '#94a3b8', fontSize: 13 }}>将重放 {selectedRowKeys.length} 条死信记录。</div>
          <Input.TextArea
            value={replayReason}
            rows={3}
            maxLength={200}
            placeholder="请输入本次重放原因，例如：已修复下游写入异常"
            onChange={(event) => setReplayReason(event.target.value)}
          />
        </Space>
      </Modal>
    </Drawer>
  );
};

export default DeadLetterDrawer;
