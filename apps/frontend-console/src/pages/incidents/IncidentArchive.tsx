import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { App, Button, Card, Empty, Input, Modal, Select, Table, Tag, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { fetchIncidentTimeline, fetchIncidents } from '../../api/incident';
import { usePreferencesStore } from '../../stores/preferencesStore';
import { useThemeStore } from '../../stores/themeStore';
import { useAuthStore } from '../../stores/authStore';
import { usePaginationQuickJumperAccessibility } from '../../components/common/usePaginationQuickJumperAccessibility';
import { COLORS } from '../../theme/tokens';
import {
  buildIncidentArchivePrintRoute,
  downloadIncidentArchiveMarkdown,
  shouldAllowIncidentArchiveReport,
} from '../../utils/incidentArchiveReport';
import {
  getIncidentPermissionDeniedReason,
  resolveIncidentActionAccess,
} from './incidentAuthorization';
import type { Incident, IncidentSeverity } from '../../types/incident';

const SEVERITY_CONFIG: Record<IncidentSeverity, { color: string; label: string }> = {
  P0: { color: COLORS.danger, label: 'P0 紧急' },
  P1: { color: '#f97316', label: 'P1 严重' },
  P2: { color: COLORS.warning, label: 'P2 一般' },
  P3: { color: COLORS.info, label: 'P3 提示' },
};

function summarizeText(value?: string, maxLength: number = 80): string {
  const normalized = (value || '').trim();
  if (!normalized) return '-';
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}…`;
}

function formatDateTime(value?: number | null): string {
  if (!value) return '-';
  return new Date(value).toLocaleString('zh-CN');
}

const IncidentArchive: React.FC = () => {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const isDark = useThemeStore((s) => s.isDark);
  const permissions = useAuthStore((state) => state.permissions);
  const capabilities = useAuthStore((state) => state.capabilities);
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<IncidentSeverity | 'all'>('all');
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [previewIncident, setPreviewIncident] = useState<Incident | null>(null);
  const [exportingKey, setExportingKey] = useState<string | null>(null);
  const tableRef = usePaginationQuickJumperAccessibility('incident-archive');
  const authorization = useMemo(() => ({ permissions, capabilities }), [capabilities, permissions]);
  const actionAccess = useMemo(() => resolveIncidentActionAccess(authorization), [authorization]);

  const storedPageSize = usePreferencesStore((s) => s.pageSizes['incidentArchive'] ?? 20);
  const setStoredPageSize = usePreferencesStore((s) => s.setPageSize);
  const [pageSize, setPageSizeState] = useState(storedPageSize);
  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    setStoredPageSize('incidentArchive', size);
  }, [setStoredPageSize]);

  const loadIncidents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: { status: string; severity?: string; query?: string } = { status: 'archived' };
      if (severityFilter !== 'all') filters.severity = severityFilter;
      if (search.trim()) filters.query = search.trim();
      const response = await fetchIncidents(currentPage, pageSize, filters);
      setIncidents(response.items);
      setTotal(response.total);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载归档列表失败';
      setError(msg);
      setIncidents([]);
      setTotal(0);
      message.error(msg);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, search, severityFilter]);

  const handleDownloadMarkdown = useCallback(async (incident: Incident) => {
    if (!shouldAllowIncidentArchiveReport(incident)) {
      message.warning('仅支持导出已归档事件报告');
      return;
    }
    const exportKey = `${incident.id}:markdown`;
    setExportingKey(exportKey);
    try {
      const timeline = await fetchIncidentTimeline(incident.id);
      downloadIncidentArchiveMarkdown(incident, timeline);
      message.success('Markdown 报告已开始下载');
    } catch (err) {
      const nextError = err instanceof Error ? err.message : '导出 Markdown 报告失败';
      message.error(nextError);
    } finally {
      setExportingKey((current) => (current === exportKey ? null : current));
    }
  }, []);

  const handleOpenPdfReport = useCallback((incident: Incident) => {
    if (!shouldAllowIncidentArchiveReport(incident)) {
      message.warning('仅支持导出已归档事件报告');
      return;
    }
    const targetPath = buildIncidentArchivePrintRoute(incident.id, true);
    const popup = window.open(targetPath, '_blank', 'noopener,noreferrer');
    if (!popup) {
      navigate(targetPath.replace('/#', ''));
      message.info('浏览器阻止了新窗口，已在当前页打开报告');
    }
  }, [navigate]);

  useEffect(() => {
    void loadIncidents();
  }, [loadIncidents]);

  const stats = useMemo(() => {
    const withVerdict = incidents.filter((incident) => Boolean(incident.verdict?.trim())).length;
    const archivedRecently = incidents.filter((incident) => {
      if (!incident.archivedAt) return false;
      return Date.now() - incident.archivedAt <= 7 * 24 * 60 * 60 * 1000;
    }).length;
    return [
      { label: '归档总数', value: total, icon: 'archive', color: '#64748b' },
      { label: '当前页有结论', value: withVerdict, icon: 'fact_check', color: COLORS.success },
      { label: '近 7 天归档', value: archivedRecently, icon: 'history', color: COLORS.primary },
      { label: '当前页待补结论', value: Math.max(incidents.length - withVerdict, 0), icon: 'edit_note', color: COLORS.warning },
    ];
  }, [incidents, total]);

  const columns: ColumnsType<Incident> = useMemo(() => [
    {
      title: '事件 ID',
      dataIndex: 'id',
      key: 'id',
      width: 180,
      render: (value: string) => (
        <Button type="link" size="small" className="font-mono text-xs p-0" onClick={() => navigate(`/incidents/detail/${value}`)}>
          {value}
        </Button>
      ),
    },
    {
      title: '级别',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (value: IncidentSeverity) => <Tag color={SEVERITY_CONFIG[value].color}>{SEVERITY_CONFIG[value].label}</Tag>,
    },
    {
      title: '事件标题',
      dataIndex: 'title',
      key: 'title',
      render: (value: string, record: Incident) => (
        <div>
          <div className="text-sm font-medium">{value}</div>
          <div className="text-xs opacity-50 mt-0.5">{record.source}</div>
        </div>
      ),
    },
    {
      title: '归档时间',
      dataIndex: 'archivedAt',
      key: 'archivedAt',
      width: 180,
      render: (value?: number | null) => <span className="text-xs opacity-70">{formatDateTime(value)}</span>,
    },
    {
      title: '研判结论',
      dataIndex: 'verdict',
      key: 'verdict',
      render: (value?: string) => <span className="text-xs">{summarizeText(value)}</span>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 220,
      render: (_: unknown, record: Incident) => (
        <div className="flex items-center gap-1 flex-wrap">
          <Tooltip title="预览归档结论">
            <Button type="link" size="small" icon={<span className="material-symbols-outlined text-sm">visibility</span>} onClick={() => setPreviewIncident(record)} />
          </Tooltip>
          <Tooltip title={actionAccess.canReadIncident ? '打开详情' : getIncidentPermissionDeniedReason('read')}>
            <Button type="link" size="small" disabled={!actionAccess.canReadIncident} icon={<span className="material-symbols-outlined text-sm">open_in_new</span>} onClick={() => navigate(`/incidents/detail/${record.id}`)} />
          </Tooltip>
          <Tooltip title="导出 Markdown 报告">
            <Button
              type="link"
              size="small"
              loading={exportingKey === `${record.id}:markdown`}
              icon={<span className="material-symbols-outlined text-sm">description</span>}
              onClick={() => { void handleDownloadMarkdown(record); }}
            />
          </Tooltip>
          <Tooltip title="保存为 PDF 报告">
            <Button
              type="link"
              size="small"
              icon={<span className="material-symbols-outlined text-sm">picture_as_pdf</span>}
              onClick={() => handleOpenPdfReport(record)}
            />
          </Tooltip>
        </div>
      ),
    },
  ], [actionAccess.canReadIncident, exportingKey, handleDownloadMarkdown, handleOpenPdfReport, navigate]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-lg font-semibold">归档管理</div>
          <div className="text-xs opacity-50 mt-1">展示已归档事件及其研判结论，支持跳转查看完整处理闭环</div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={() => void loadIncidents()} icon={<span className="material-symbols-outlined text-sm">refresh</span>}>
            刷新
          </Button>
          <Button
            type="primary"
            disabled={!previewIncident || !shouldAllowIncidentArchiveReport(previewIncident)}
            icon={<span className="material-symbols-outlined text-sm">description</span>}
            onClick={() => {
              if (!previewIncident) return;
              void handleDownloadMarkdown(previewIncident);
            }}
          >
            导出当前预览
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((item) => (
          <Card key={item.label} size="small" style={{ borderColor: isDark ? '#334155' : '#e2e8f0' }} styles={{ body: { padding: '16px 20px' } }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs opacity-50 mb-1">{item.label}</div>
                <div className="text-2xl font-bold" style={{ color: item.color }}>{item.value}</div>
              </div>
              <span className="material-symbols-outlined text-2xl" style={{ color: item.color, opacity: 0.6 }}>{item.icon}</span>
            </div>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Input.Search
          id="incident-archive-search"
          name="incident-archive-search"
          placeholder="按事件 ID、标题、结论搜索..."
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setCurrentPage(1);
          }}
          allowClear
          style={{ flex: 1, minWidth: 260 }}
        />
        <Select
          value={severityFilter}
          onChange={(value) => {
            setSeverityFilter(value);
            setCurrentPage(1);
          }}
          style={{ width: 140 }}
          options={[
            { value: 'all', label: '所有级别' },
            { value: 'P0', label: 'P0 紧急' },
            { value: 'P1', label: 'P1 严重' },
            { value: 'P2', label: 'P2 一般' },
            { value: 'P3', label: 'P3 提示' },
          ]}
        />
      </div>

      {error ? (
        <Empty description={error} />
      ) : (
        <div ref={tableRef}>
          <Table<Incident>
            rowKey="id"
            columns={columns}
            dataSource={incidents}
            loading={loading}
            pagination={{
              current: currentPage,
              pageSize,
              total,
              showSizeChanger: true,
              showQuickJumper: total > pageSize,
              pageSizeOptions: ['10', '20', '50', '100'],
              showTotal: (count, range) => `显示 ${range[0]}-${range[1]} 条，共 ${count} 条`,
              onChange: (page, size) => {
                const nextSize = size ?? pageSize;
                if (nextSize !== pageSize) {
                  setPageSize(nextSize);
                  setCurrentPage(1);
                  return;
                }
                setCurrentPage(page);
              },
              position: ['bottomLeft'],
            }}
            scroll={{ x: 1200 }}
            locale={{ emptyText: loading ? '加载中...' : '暂无归档事件' }}
          />
        </div>
      )}

      <Modal
        open={previewIncident !== null}
        title="归档结论预览"
        onCancel={() => setPreviewIncident(null)}
        footer={previewIncident ? [
          <Button key="markdown" icon={<span className="material-symbols-outlined text-sm">description</span>} loading={exportingKey === `${previewIncident.id}:markdown`} onClick={() => { void handleDownloadMarkdown(previewIncident); }}>导出 Markdown</Button>,
          <Button key="pdf" icon={<span className="material-symbols-outlined text-sm">picture_as_pdf</span>} onClick={() => handleOpenPdfReport(previewIncident)}>保存为 PDF</Button>,
          <Button key="detail" type="primary" disabled={!actionAccess.canReadIncident} onClick={() => navigate(`/incidents/detail/${previewIncident.id}`)}>打开详情</Button>,
        ] : null}
        destroyOnHidden
      >
        <div className="flex flex-col gap-3">
          <div>
            <div className="text-xs opacity-50 mb-1">事件 ID</div>
            <div className="font-mono text-xs break-all">{previewIncident?.id}</div>
          </div>
          <div>
            <div className="text-xs opacity-50 mb-1">归档时间</div>
            <div className="text-sm">{formatDateTime(previewIncident?.archivedAt)}</div>
          </div>
          <div>
            <div className="text-xs opacity-50 mb-1">研判结论</div>
            <div className="text-sm whitespace-pre-wrap">{previewIncident?.verdict || '暂无研判结论'}</div>
          </div>
          {previewIncident && (
            <div className="flex justify-end">
              <Button type="primary" disabled={!actionAccess.canReadIncident} onClick={() => navigate(`/incidents/detail/${previewIncident.id}`)}>
                打开详情
              </Button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default IncidentArchive;
