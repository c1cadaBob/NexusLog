import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Drawer, Empty, Select, Tag, Typography } from 'antd';
import type { PullPackageItem } from '../../api/ingest';
import { COLORS } from '../../theme/tokens';
import PullPackageDetailDrawer from './PullPackageDetailDrawer';

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
  packages: PullPackageItem[];
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

const PullPackageHistoryDrawer: React.FC<PullPackageHistoryDrawerProps> = ({ open, sourceName, packages, total, error, onClose }) => {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [detailPackageId, setDetailPackageId] = useState('');

  useEffect(() => {
    if (!open) {
      setStatusFilter('all');
      setDetailPackageId('');
    }
  }, [open]);

  const filteredPackages = useMemo(() => {
    if (statusFilter === 'all') return packages;
    return packages.filter((item) => String(item.status ?? '').toLowerCase() === statusFilter);
  }, [packages, statusFilter]);

  const stats = useMemo(() => {
    const base = filteredPackages.length ? filteredPackages : packages;
    return {
      total,
      visible: filteredPackages.length,
      acked: base.filter((item) => item.status === 'acked').length,
      failed: base.filter((item) => item.status === 'failed' || item.status === 'dead_lettered' || item.status === 'nacked').length,
      uploaded: base.filter((item) => item.status === 'uploaded' || item.status === 'uploading').length,
    };
  }, [filteredPackages, packages, total]);

  return (
    <Drawer
      open={open}
      title={sourceName ? `${sourceName} · 包历史` : '包历史'}
      width={1080}
      destroyOnHidden
      onClose={onClose}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Select
            id="pull-package-status-filter"
            value={statusFilter}
            style={{ width: 140 }}
            options={PACKAGE_STATUS_OPTIONS.map((item) => ({ label: item.label, value: item.value }))}
            onChange={setStatusFilter}
          />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            展示打开时预取的最近 20 个增量包快照；如需刷新，请关闭后重新打开。
          </Typography.Text>
        </div>

        {error ? <Alert type="error" showIcon message="包历史加载失败" description={error} /> : null}

        {filteredPackages.length === 0 ? (
          <Empty description={packages.length === 0 ? '暂无包记录' : '当前筛选条件下暂无包记录'} />
        ) : (
          <>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>
              当前总数：{stats.total} · 当前显示：{stats.visible} · 已确认：{stats.acked} · 上传中/已上传：{stats.uploaded} · 异常：{stats.failed}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filteredPackages.map((item) => {
                const meta = getPackageStatusMeta(item.status);
                return (
                  <div key={item.package_id} style={{ border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <Tag color={meta.color} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginInlineEnd: 0 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta.dot, display: 'inline-block' }} />
                        {meta.label}
                      </Tag>
                      <Button size="small" type="link" disabled={!item.package_id} onClick={() => setDetailPackageId(item.package_id)}>
                        详情
                      </Button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, fontSize: 12 }}>
                      <div>
                        包编号：
                        <Typography.Text style={{ marginLeft: 6 }}>{item.package_no || '-'}</Typography.Text>
                      </div>
                      <div>
                        包 ID：
                        <Typography.Text code style={{ marginLeft: 6, whiteSpace: 'normal', wordBreak: 'break-all' }}>{item.package_id || '-'}</Typography.Text>
                      </div>
                      <div>记录数：{formatNumber(item.record_count)}</div>
                      <div>文件数：{formatNumber(item.file_count)}</div>
                      <div>大小：{formatBytes(item.size_bytes)}</div>
                      <div>来源：{item.source_ref || '-'}</div>
                      <div>创建时间：{formatDateTime(item.created_at)}</div>
                      <div>确认时间：{formatDateTime(item.acked_at)}</div>
                    </div>

                    <div style={{ fontSize: 12 }}>
                      <div>Batch：{item.batch_id || '-'}</div>
                      <div style={{ color: '#94a3b8', whiteSpace: 'normal', wordBreak: 'break-all' }}>Cursor：{item.next_cursor || '-'}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <PullPackageDetailDrawer
        open={Boolean(detailPackageId)}
        packageId={detailPackageId}
        sourceName={sourceName}
        onClose={() => setDetailPackageId('')}
      />
    </Drawer>
  );
};

export default PullPackageHistoryDrawer;
