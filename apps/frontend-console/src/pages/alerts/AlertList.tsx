import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input, Select, Table, Tag, Button, Card, Statistic, Space, Modal, message, Badge, Spin, Empty, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useThemeStore } from '../../stores/themeStore';
import { usePreferencesStore } from '../../stores/preferencesStore';
import { useAlertStore } from '../../stores/alertStore';
import { COLORS } from '../../theme/tokens';
import type { AlertSummary, AlertSeverity, AlertStatus } from '../../types/alert';
import { ALERT_SEVERITY_CONFIG, ALERT_STATUS_CONFIG } from '../../types/alert';
import {
  acknowledgeAlertEvent,
  fetchAlertEvents,
  resolveAlertEvent,
  silenceAlertEvent,
  type AlertEventListSummary,
  type AlertEventSummary,
  type AlertNotificationSummary,
} from '../../api/alert';
import { persistPendingRealtimeStartupQuery } from '../search/realtimeStartupQuery';

const formatTimeAgo = (timestamp: number): string => {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}秒前`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return `${days}天前`;
};

const severityTagColor: Record<AlertSeverity, string> = {
  critical: 'error',
  high: 'warning',
  medium: 'processing',
  low: 'success',
};

const mapStatusFilterToApi = (s: AlertStatus | 'all'): 'firing' | 'acknowledged' | 'resolved' | 'silenced' | undefined => {
  if (s === 'all') return undefined;
  if (s === 'active') return 'firing';
  if (s === 'acknowledged') return 'acknowledged';
  if (s === 'resolved') return 'resolved';
  if (s === 'silenced') return 'silenced';
  return undefined;
};

const POLL_INTERVAL_MS = 30000;

const notificationStatusConfig: Record<string, { label: string; color: string }> = {
  sent: { label: '发送成功', color: 'success' },
  partial: { label: '部分成功', color: 'warning' },
  failed: { label: '发送失败', color: 'error' },
  skipped: { label: '已跳过', color: 'default' },
  no_channels: { label: '未配置渠道', color: 'default' },
  silenced: { label: '已静默', color: 'default' },
  unknown: { label: '未知', color: 'default' },
};

const emptyAlertSummary: AlertEventListSummary = {
  pending: 0,
  critical: 0,
  warning: 0,
  silenced: 0,
};

const getNotificationStatusMeta = (summary?: AlertNotificationSummary): { label: string; color: string } => {
  if (!summary) {
    return { label: '未发送', color: 'default' };
  }
  return notificationStatusConfig[summary.status] ?? notificationStatusConfig.unknown;
};

const formatNotificationTooltip = (summary?: AlertNotificationSummary): string => {
  if (!summary) {
    return '当前告警尚无通知分发记录';
  }
  const lines = [
    `状态：${getNotificationStatusMeta(summary).label}`,
    `成功渠道：${summary.successfulChannels}`,
    `尝试渠道：${summary.attemptedChannels}`,
  ];
  if (summary.lastAttemptAt) {
    lines.push(`最后尝试：${new Date(summary.lastAttemptAt).toLocaleString('zh-CN')}`);
  }
  return lines.join('\n');
};

const AlertList: React.FC = () => {
  const navigate = useNavigate();
  const isDark = useThemeStore((s) => s.isDark);
  const markAllAsRead = useAlertStore((s) => s.markAllAsRead);

  useEffect(() => {
    markAllAsRead();
  }, [markAllAsRead]);

  const [alerts, setAlerts] = useState<AlertEventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<AlertStatus | 'all'>('all');
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [silenceModalOpen, setSilenceModalOpen] = useState(false);
  const [silenceDuration, setSilenceDuration] = useState(3600);
  const [silenceReason, setSilenceReason] = useState('');
  const [batchRunning, setBatchRunning] = useState(false);
  const [singleSilenceTargetID, setSingleSilenceTargetID] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loadRequestRef = useRef<{ key: string; promise: Promise<void>; seq: number } | null>(null);
  const latestLoadSeqRef = useRef(0);

  const storedPageSize = usePreferencesStore((s) => s.pageSizes['alertList'] ?? 10);
  const setStoredPageSize = usePreferencesStore((s) => s.setPageSize);
  const [pageSize, setPageSizeLocal] = useState(storedPageSize);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalAlerts, setTotalAlerts] = useState(0);
  const [stats, setStats] = useState<AlertEventListSummary>(emptyAlertSummary);
  const setPageSize = useCallback(
    (size: number) => {
      setPageSizeLocal(size);
      setStoredPageSize('alertList', size);
    },
    [setStoredPageSize],
  );

  const clearPollTimer = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const loadAlerts = useCallback(async (options: { force?: boolean; silent?: boolean } = {}) => {
    const statusParam = mapStatusFilterToApi(statusFilter);
    const severityParam = severityFilter === 'all' ? undefined : severityFilter;
    const queryParam = search.trim();
    const requestKey = JSON.stringify({
      page: currentPage,
      pageSize,
      status: statusParam ?? '',
      severity: severityParam ?? '',
      query: queryParam,
    });

    if (!options.force && loadRequestRef.current?.key === requestKey) {
      return loadRequestRef.current.promise;
    }

    const currentSeq = latestLoadSeqRef.current + 1;
    latestLoadSeqRef.current = currentSeq;
    setLoading(true);
    setError(null);

    const request = (async () => {
      try {
        const { items, total, summary } = await fetchAlertEvents(currentPage, pageSize, {
          status: statusParam,
          severity: severityParam,
          query: queryParam || undefined,
        });
        if (latestLoadSeqRef.current !== currentSeq) {
          return;
        }
        setAlerts(items);
        setTotalAlerts(total);
        setStats(summary);
        setSelectedRowKeys((previous) => previous.filter((key) => items.some((item) => item.id === String(key))));
      } catch (err) {
        if (latestLoadSeqRef.current !== currentSeq) {
          return;
        }
        const msg = err instanceof Error ? err.message : '加载告警列表失败';
        setError(msg);
        setAlerts([]);
        setTotalAlerts(0);
        setStats(emptyAlertSummary);
        setSelectedRowKeys([]);
        if (!options.silent) {
          message.error(msg);
        }
      } finally {
        if (loadRequestRef.current?.seq === currentSeq) {
          loadRequestRef.current = null;
        }
        if (latestLoadSeqRef.current === currentSeq) {
          setLoading(false);
        }
      }
    })();

    loadRequestRef.current = { key: requestKey, promise: request, seq: currentSeq };
    return request;
  }, [currentPage, pageSize, search, severityFilter, statusFilter]);

  const startPollTimer = useCallback(() => {
    clearPollTimer();
    if (document.hidden) {
      return;
    }
    pollRef.current = setInterval(() => {
      void loadAlerts({ silent: true });
    }, POLL_INTERVAL_MS);
  }, [clearPollTimer, loadAlerts]);

  useEffect(() => {
    void loadAlerts();
  }, [loadAlerts]);

  useEffect(() => {
    startPollTimer();
    return clearPollTimer;
  }, [clearPollTimer, startPollTimer]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        clearPollTimer();
        return;
      }
      void loadAlerts({ silent: true });
      startPollTimer();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [clearPollTimer, loadAlerts, startPollTimer]);


  const handleAcknowledge = useCallback(async (id: string) => {
    try {
      await acknowledgeAlertEvent(id);
      message.success('告警已确认');
      await loadAlerts({ force: true });
    } catch (err) {
      message.error(err instanceof Error ? err.message : '确认告警失败');
    }
  }, [loadAlerts]);

  const handleResolve = useCallback(async (id: string) => {
    try {
      await resolveAlertEvent(id);
      message.success('告警已解决');
      await loadAlerts({ force: true });
    } catch (err) {
      message.error(err instanceof Error ? err.message : '解决告警失败');
    }
  }, [loadAlerts]);

  const handleSilence = useCallback((id: string) => {
    setSingleSilenceTargetID(id);
    setSilenceReason('');
    setSilenceDuration(3600);
    setSilenceModalOpen(true);
  }, []);

  const handleViewLogs = useCallback((record: AlertEventSummary) => {
    const presetQuery = [record.ruleId, record.source !== '-' ? record.source : '', record.name]
      .map((item) => item?.trim() ?? '')
      .find((item) => item.length > 0) ?? '';

    persistPendingRealtimeStartupQuery(presetQuery);
    navigate('/search/realtime', {
      state: {
        autoRun: true,
        presetQuery,
      },
    });
  }, [navigate]);

  const executeBatch = useCallback(
    async (type: 'acknowledge' | 'resolve' | 'silence') => {
      const targetIDs = selectedRowKeys.map((item) => String(item));
      if (targetIDs.length === 0) return;
      setBatchRunning(true);
      try {
        if (type === 'acknowledge') {
          await Promise.all(targetIDs.map((id) => acknowledgeAlertEvent(id)));
          message.success(`已确认 ${targetIDs.length} 条告警`);
        } else if (type === 'resolve') {
          await Promise.all(targetIDs.map((id) => resolveAlertEvent(id)));
          message.success(`已解决 ${targetIDs.length} 条告警`);
        } else {
          await Promise.all(targetIDs.map((id) => silenceAlertEvent(id, { reason: silenceReason, durationSeconds: silenceDuration })));
          message.success(`已静默 ${targetIDs.length} 条告警`);
        }
        setSelectedRowKeys([]);
        await loadAlerts({ force: true });
      } catch (err) {
        message.error(err instanceof Error ? err.message : '批量操作失败');
      } finally {
        setBatchRunning(false);
      }
    },
    [loadAlerts, selectedRowKeys, silenceDuration, silenceReason],
  );

  const confirmBatchSilence = useCallback(async () => {
    try {
      if (singleSilenceTargetID) {
        setBatchRunning(true);
        await silenceAlertEvent(singleSilenceTargetID, { reason: silenceReason, durationSeconds: silenceDuration });
        message.success('告警已静默');
        await loadAlerts({ force: true });
      } else {
        await executeBatch('silence');
      }
      setSilenceModalOpen(false);
      setSingleSilenceTargetID(null);
      setSilenceReason('');
    } catch (err) {
      message.error(err instanceof Error ? err.message : '静默告警失败');
    } finally {
      setBatchRunning(false);
    }
  }, [executeBatch, loadAlerts, silenceDuration, silenceReason, singleSilenceTargetID]);

  const columns: ColumnsType<AlertEventSummary> = [
    {
      title: '等级',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (severity: AlertSeverity) => (
        <Tag
          icon={
            <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: 'middle', marginRight: 2 }}>
              {ALERT_SEVERITY_CONFIG[severity].icon}
            </span>
          }
          color={severityTagColor[severity]}
        >
          {ALERT_SEVERITY_CONFIG[severity].label}
        </Tag>
      ),
    },
    {
      title: '告警名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <span style={{ fontWeight: 500 }}>{name}</span>,
    },
    {
      title: '来源',
      dataIndex: 'source',
      key: 'source',
      render: (source: string) => (
        <code style={{ fontSize: 12, padding: '2px 6px', borderRadius: 4, background: isDark ? '#232f48' : '#f1f5f9' }}>
          {source}
        </code>
      ),
    },
    {
      title: '触发次数',
      dataIndex: 'count',
      key: 'count',
      width: 100,
      render: (count: number) => <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{count}</span>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: AlertStatus) => (
        <Badge
          status={status === 'active' ? 'error' : status === 'acknowledged' ? 'warning' : status === 'resolved' ? 'success' : 'default'}
          text={ALERT_STATUS_CONFIG[status].label}
          style={{ whiteSpace: 'nowrap' }}
        />
      ),
    },
    {
      title: '最后触发',
      dataIndex: 'lastTriggeredAt',
      key: 'lastTriggeredAt',
      width: 120,
      render: (ts: number) => (
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{formatTimeAgo(ts)}</span>
      ),
    },
    {
      title: '通知结果',
      dataIndex: 'notificationSummary',
      key: 'notificationSummary',
      width: 180,
      render: (summary?: AlertNotificationSummary) => {
        const meta = getNotificationStatusMeta(summary);
        return (
          <Tooltip title={<span style={{ whiteSpace: 'pre-line' }}>{formatNotificationTooltip(summary)}</span>}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Tag color={meta.color} style={{ width: 'fit-content', marginInlineEnd: 0 }}>{meta.label}</Tag>
              {summary && (
                <span style={{ fontSize: 12, color: '#94a3b8' }}>
                  {summary.successfulChannels}/{summary.attemptedChannels} 渠道成功
                  {summary.lastAttemptAt ? ` · ${formatTimeAgo(summary.lastAttemptAt)}` : ''}
                </span>
              )}
            </div>
          </Tooltip>
        );
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      align: 'right',
      render: (_, record) => (
        <Space size={4}>
          {record.status === 'active' && (
            <Button
              type="text"
              size="small"
              onClick={() => handleAcknowledge(record.id)}
              title="确认"
              icon={
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: COLORS.warning }}>
                  check_circle
                </span>
              }
            />
          )}
          {(record.status === 'active' || record.status === 'acknowledged') && (
            <Button
              type="text"
              size="small"
              onClick={() => handleResolve(record.id)}
              title="解决"
              icon={
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: COLORS.success }}>
                  task_alt
                </span>
              }
            />
          )}
          {record.status !== 'silenced' && record.status !== 'resolved' && (
            <Button
              type="text"
              size="small"
              onClick={() => handleSilence(record.id)}
              title="静默"
              icon={
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: COLORS.info }}>
                  notifications_off
                </span>
              }
            />
          )}
          <Button
            type="text"
            size="small"
            title="查看日志"
            onClick={() => handleViewLogs(record)}
            icon={
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: COLORS.primary }}>
                description
              </span>
            }
          />
        </Space>
      ),
    },
  ];

  if (loading && alerts.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error && alerts.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 16 }}>
        <Empty description={error} />
        <Button type="primary" onClick={() => { void loadAlerts({ force: true }); }}>
          重试
        </Button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>告警列表</h2>
          <Tag color="blue">Live</Tag>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button
            type="text"
            shape="circle"
            icon={<span className="material-symbols-outlined" style={{ fontSize: 20 }}>refresh</span>}
            onClick={() => { void loadAlerts({ force: true }); }}
          />
          <Badge status="success" text="系统正常" />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <Card size="small" styles={{ body: { padding: '20px' } }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Statistic title="待处理告警" value={stats.pending} valueStyle={{ fontSize: 28, fontWeight: 700 }} />
            <div style={{ padding: 8, borderRadius: 8, background: `${COLORS.primary}1a` }}>
              <span className="material-symbols-outlined" style={{ color: COLORS.primary }}>pending_actions</span>
            </div>
          </div>
        </Card>
        <Card size="small" styles={{ body: { padding: '20px' } }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Statistic
              title="严重告警"
              value={stats.critical}
              valueStyle={{ fontSize: 28, fontWeight: 700, color: COLORS.danger }}
            />
            <div style={{ padding: 8, borderRadius: 8, background: `${COLORS.danger}1a` }}>
              <span className="material-symbols-outlined" style={{ color: COLORS.danger }}>gpp_maybe</span>
            </div>
          </div>
        </Card>
        <Card size="small" styles={{ body: { padding: '20px' } }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Statistic
              title="警告告警"
              value={stats.warning}
              valueStyle={{ fontSize: 28, fontWeight: 700, color: COLORS.warning }}
            />
            <div style={{ padding: 8, borderRadius: 8, background: `${COLORS.warning}1a` }}>
              <span className="material-symbols-outlined" style={{ color: COLORS.warning }}>warning</span>
            </div>
          </div>
        </Card>
        <Card size="small" styles={{ body: { padding: '20px' } }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Statistic title="静默中" value={stats.silenced} valueStyle={{ fontSize: 28, fontWeight: 700 }} />
            <div style={{ padding: 8, borderRadius: 8, background: isDark ? '#334155' : '#f1f5f9' }}>
              <span className="material-symbols-outlined" style={{ color: '#94a3b8' }}>notifications_paused</span>
            </div>
          </div>
        </Card>
      </div>

      <Card
        style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' } }}
      >
        <div
          style={{
            padding: '16px 24px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 12,
            borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
          }}
        >
          <Input
            id="alert-list-search"
            name="alert-list-search"
            prefix={<span className="material-symbols-outlined" style={{ fontSize: 20, color: '#94a3b8' }}>search</span>}
            placeholder="按告警名称、来源搜索..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            style={{ flex: 1, minWidth: 240 }}
            allowClear
          />
          <Select
            id="alert-list-severity-filter"
            aria-label="告警等级筛选"
            value={severityFilter}
            onChange={(value) => {
              setSeverityFilter(value);
              setCurrentPage(1);
            }}
            style={{ width: 140 }}
            options={[
              { value: 'all', label: '所有等级' },
              { value: 'critical', label: '严重 (Critical)' },
              { value: 'high', label: '高 (High)' },
              { value: 'medium', label: '中 (Medium)' },
              { value: 'low', label: '低 (Low)' },
            ]}
          />
          <Select
            id="alert-list-status-filter"
            aria-label="告警状态筛选"
            value={statusFilter}
            onChange={(value) => {
              setStatusFilter(value);
              setCurrentPage(1);
            }}
            style={{ width: 160 }}
            options={[
              { value: 'all', label: '状态: 全部' },
              { value: 'active', label: '活跃 (Active)' },
              { value: 'acknowledged', label: '已确认' },
              { value: 'resolved', label: '已解决' },
              { value: 'silenced', label: '静默' },
            ]}
          />
          {selectedRowKeys.length > 0 && (
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: '#94a3b8' }}>已选择 {selectedRowKeys.length} 项</span>
              <Button
                size="small"
                onClick={() => executeBatch('acknowledge')}
                loading={batchRunning}
                style={{ background: `${COLORS.warning}33`, borderColor: `${COLORS.warning}4d`, color: COLORS.warning }}
                icon={<span className="material-symbols-outlined" style={{ fontSize: 16 }}>check_circle</span>}
              >
                批量确认
              </Button>
              <Button
                size="small"
                onClick={() => executeBatch('resolve')}
                loading={batchRunning}
                style={{ background: `${COLORS.success}33`, borderColor: `${COLORS.success}4d`, color: COLORS.success }}
                icon={<span className="material-symbols-outlined" style={{ fontSize: 16 }}>task_alt</span>}
              >
                批量解决
              </Button>
              <Button
                size="small"
                onClick={() => {
                  setSingleSilenceTargetID(null);
                  setSilenceReason('');
                  setSilenceDuration(3600);
                  setSilenceModalOpen(true);
                }}
                loading={batchRunning}
                style={{ background: `${COLORS.info}33`, borderColor: `${COLORS.info}4d`, color: COLORS.info }}
                icon={<span className="material-symbols-outlined" style={{ fontSize: 16 }}>notifications_off</span>}
              >
                批量静默
              </Button>
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflow: 'auto' }}>
          {!loading && totalAlerts === 0 ? (
            <Empty style={{ margin: 48 }} description="暂无告警" />
          ) : (
            <Table<AlertEventSummary>
              rowKey="id"
              columns={columns}
              dataSource={alerts}
              size="middle"
              rowSelection={{
                selectedRowKeys,
                onChange: setSelectedRowKeys,
                getTitleCheckboxProps: () => ({
                  name: 'alert-list-select-all',
                  'aria-label': '选择全部告警',
                }),
                getCheckboxProps: (record) => ({
                  name: `alert-list-select-${record.id}`,
                  'aria-label': `选择告警 ${record.id}`,
                }),
              }}
              pagination={{
                current: currentPage,
                total: totalAlerts,
                pageSize,
                showSizeChanger: true,
                showQuickJumper: totalAlerts > pageSize,
                pageSizeOptions: ['10', '20', '50', '100', '200'],
                showTotal: (total, range) => `显示 ${range[0]} 到 ${range[1]} 条，共 ${total} 条`,
                onChange: (page, size) => {
                  const nextPageSize = size ?? pageSize;
                  if (nextPageSize !== pageSize) {
                    setPageSize(nextPageSize);
                    setCurrentPage(1);
                    return;
                  }
                  setCurrentPage(page);
                },
              }}
              scroll={{ x: 800 }}
              loading={loading}
            />
          )}
        </div>
      </Card>

      <Modal
        open={silenceModalOpen}
        title={singleSilenceTargetID ? '静默告警' : '批量静默告警'}
        onCancel={() => {
          setSilenceModalOpen(false);
          setSingleSilenceTargetID(null);
          setSilenceReason('');
        }}
        onOk={confirmBatchSilence}
        okText="确认静默"
        cancelText="取消"
        destroyOnHidden
        confirmLoading={batchRunning}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ color: '#94a3b8' }}>
            {singleSilenceTargetID ? (
              <>将对当前告警执行静默操作</>
            ) : (
              <>
                将对 <span style={{ fontWeight: 500 }}>{selectedRowKeys.length}</span> 条告警执行静默操作
              </>
            )}
          </p>
          <div>
            <label htmlFor="alert-list-silence-duration" style={{ display: 'block', marginBottom: 8, fontWeight: 500, fontSize: 14 }}>静默时长</label>
            <Select
              id="alert-list-silence-duration"
              aria-label="静默时长"
              value={silenceDuration}
              onChange={setSilenceDuration}
              style={{ width: '100%' }}
              options={[
                { value: 1800, label: '30 分钟' },
                { value: 3600, label: '1 小时' },
                { value: 7200, label: '2 小时' },
                { value: 14400, label: '4 小时' },
                { value: 28800, label: '8 小时' },
                { value: 86400, label: '24 小时' },
              ]}
            />
          </div>
          <div>
            <label htmlFor="alert-list-silence-reason" style={{ display: 'block', marginBottom: 8, fontWeight: 500, fontSize: 14 }}>备注（可选）</label>
            <Input.TextArea
              id="alert-list-silence-reason"
              name="alertListSilenceReason"
              aria-label="静默备注"
              placeholder="请输入静默原因..."
              rows={3}
              value={silenceReason}
              onChange={(event) => setSilenceReason(event.target.value)}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AlertList;
