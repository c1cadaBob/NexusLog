import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Empty, message, Tooltip } from 'antd';
import { fetchSavedQueries, createSavedQuery, updateSavedQuery, deleteSavedQuery } from '../../api/query';
import { createExportJob } from '../../api/export';
import { useAuthStore } from '../../stores/authStore';
import { useThemeStore } from '../../stores/themeStore';
import { resolveReportManagementActionAccess } from './reportManagementAuthorization';
import type { SavedQuery } from '../../types/log';

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  query: string;
  filters: Record<string, unknown>;
  type: 'system' | 'security' | 'performance' | 'custom';
  status: 'active' | 'draft' | 'archived';
  tags: string[];
  createdAt: string;
  updatedAt: string;
  runCount: number;
}

const REPORT_TEMPLATE_TAG = 'report-template';
const REPORT_TYPE_TAG_PREFIX = 'report-type:';
const REPORT_STATUS_TAG_PREFIX = 'report-status:';

const statusLabels: Record<ReportTemplate['status'], string> = {
  active: '启用中',
  draft: '草稿',
  archived: '已归档',
};

const typeLabels: Record<ReportTemplate['type'], string> = {
  system: '系统日志',
  security: '安全审计',
  performance: '性能监控',
  custom: '自定义',
};

function resolveReportType(tags: string[]): ReportTemplate['type'] {
  const raw = tags.find((tag) => tag.startsWith(REPORT_TYPE_TAG_PREFIX))?.slice(REPORT_TYPE_TAG_PREFIX.length);
  switch (raw) {
    case 'system':
    case 'security':
    case 'performance':
    case 'custom':
      return raw;
    default:
      return 'custom';
  }
}

function resolveReportStatus(tags: string[]): ReportTemplate['status'] {
  const raw = tags.find((tag) => tag.startsWith(REPORT_STATUS_TAG_PREFIX))?.slice(REPORT_STATUS_TAG_PREFIX.length);
  switch (raw) {
    case 'active':
    case 'draft':
    case 'archived':
      return raw;
    default:
      return 'active';
  }
}

function buildReportTags(type: ReportTemplate['type'], status: ReportTemplate['status'], existingTags: string[] = []): string[] {
  const passthrough = existingTags.filter((tag) => (
    tag !== REPORT_TEMPLATE_TAG
    && !tag.startsWith(REPORT_TYPE_TAG_PREFIX)
    && !tag.startsWith(REPORT_STATUS_TAG_PREFIX)
  ));
  return [
    REPORT_TEMPLATE_TAG,
    `${REPORT_TYPE_TAG_PREFIX}${type}`,
    `${REPORT_STATUS_TAG_PREFIX}${status}`,
    ...passthrough,
  ];
}

function normalizeReportTemplate(item: SavedQuery): ReportTemplate {
  return {
    id: item.id,
    name: item.name,
    description: item.description?.trim() ?? '',
    query: item.query,
    filters: item.filters && typeof item.filters === 'object' ? item.filters : {},
    type: resolveReportType(item.tags),
    status: resolveReportStatus(item.tags),
    tags: item.tags,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt ?? item.createdAt,
    runCount: Number(item.runCount ?? 0),
  };
}

function formatDateTime(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return value || '—';
  }
  return new Date(timestamp).toLocaleString('zh-CN');
}

const ReportManagement: React.FC = () => {
  const { isDark } = useThemeStore();
  const capabilities = useAuthStore((state) => state.capabilities);
  const [reports, setReports] = useState<ReportTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingID, setGeneratingID] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | ReportTemplate['type']>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ReportTemplate['status']>('all');
  const [showModal, setShowModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [editingReport, setEditingReport] = useState<ReportTemplate | null>(null);
  const [formState, setFormState] = useState({
    name: '',
    description: '',
    type: 'custom' as ReportTemplate['type'],
    status: 'active' as ReportTemplate['status'],
    query: '',
  });

  const actionAccess = useMemo(
    () => resolveReportManagementActionAccess({ capabilities }),
    [capabilities],
  );

  const headerBg = isDark ? 'bg-[#111722]' : 'bg-white';
  const cardBg = isDark ? 'bg-[#1e293b]' : 'bg-white';
  const inputBg = isDark ? 'bg-[#1e293b]' : 'bg-slate-50';
  const borderColor = isDark ? 'border-border-dark' : 'border-slate-200';
  const textColor = isDark ? 'text-white' : 'text-slate-900';
  const textSecondary = isDark ? 'text-text-secondary' : 'text-slate-600';
  const hoverBg = isDark ? 'hover:bg-[#232f48]' : 'hover:bg-slate-100';
  const modalBg = isDark ? 'bg-[#1e293b]' : 'bg-white';

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchSavedQueries({ page: 1, pageSize: 200, tag: REPORT_TEMPLATE_TAG });
      setReports(result.items.map(normalizeReportTemplate));
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载报表模板失败';
      setError(msg);
      message.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const filteredReports = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    return [...reports]
      .filter((report) => {
        if (keyword) {
          const matchesKeyword = report.name.toLowerCase().includes(keyword)
            || report.description.toLowerCase().includes(keyword)
            || report.query.toLowerCase().includes(keyword)
            || report.id.toLowerCase().includes(keyword);
          if (!matchesKeyword) {
            return false;
          }
        }
        if (typeFilter !== 'all' && report.type !== typeFilter) {
          return false;
        }
        if (statusFilter !== 'all' && report.status !== statusFilter) {
          return false;
        }
        return true;
      })
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
  }, [reports, searchQuery, typeFilter, statusFilter]);

  const openCreateModal = useCallback(() => {
    if (!actionAccess.canCreateReport) {
      message.warning('当前会话缺少报表模板创建权限');
      return;
    }
    setEditingReport(null);
    setFormState({
      name: '',
      description: '',
      type: 'custom',
      status: 'active',
      query: '',
    });
    setShowModal(true);
  }, [actionAccess.canCreateReport]);

  const openEditModal = useCallback((report: ReportTemplate) => {
    if (!actionAccess.canUpdateReport) {
      message.warning('当前会话缺少报表模板编辑权限');
      return;
    }
    setEditingReport(report);
    setFormState({
      name: report.name,
      description: report.description,
      type: report.type,
      status: report.status,
      query: report.query,
    });
    setShowModal(true);
  }, [actionAccess.canUpdateReport]);

  const closeModal = useCallback(() => {
    setShowModal(false);
    setEditingReport(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (!formState.name.trim()) {
      message.warning('请输入报表名称');
      return;
    }
    if (!formState.query.trim()) {
      message.warning('请输入报表查询语句');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formState.name.trim(),
        description: formState.description.trim(),
        query: formState.query.trim(),
        filters: editingReport?.filters ?? {},
        tags: buildReportTags(formState.type, formState.status, editingReport?.tags ?? []),
      };
      if (editingReport) {
        await updateSavedQuery(editingReport.id, payload);
        message.success('报表模板已更新');
      } else {
        await createSavedQuery(payload);
        message.success('报表模板已创建');
      }
      closeModal();
      await loadReports();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '保存报表模板失败';
      message.error(msg);
    } finally {
      setSaving(false);
    }
  }, [closeModal, editingReport, formState, loadReports]);

  const handleDelete = useCallback(async (reportID: string) => {
    if (!actionAccess.canDeleteReport) {
      message.warning('当前会话缺少报表模板删除权限');
      return;
    }
    try {
      await deleteSavedQuery(reportID);
      setShowDeleteConfirm(null);
      message.success('报表模板已删除');
      await loadReports();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '删除报表模板失败';
      message.error(msg);
    }
  }, [actionAccess.canDeleteReport, loadReports]);

  const handleGenerate = useCallback(async (report: ReportTemplate) => {
    if (!actionAccess.canGenerateReport) {
      message.warning('当前会话缺少报表生成权限');
      return;
    }
    setGeneratingID(report.id);
    try {
      await createExportJob({
        query_params: {
          keywords: report.query,
          filters: report.filters,
          sort: [{ field: '@timestamp', order: 'desc' }],
          source: 'report-management',
          report_template_id: report.id,
          report_template_name: report.name,
        },
        format: 'csv',
      });
      message.success('报表导出任务已创建，正在跳转到下载记录');
      window.location.hash = '#/reports/downloads';
    } catch (err) {
      const msg = err instanceof Error ? err.message : '生成报表失败';
      message.error(msg);
    } finally {
      setGeneratingID(null);
    }
  }, [actionAccess.canGenerateReport]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className={`flex h-16 items-center justify-between border-b px-6 ${borderColor} ${headerBg}`}>
        <div className="flex items-center gap-3">
          <h2 className={`m-0 text-2xl font-bold ${textColor}`}>报表管理</h2>
          <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">真实模板</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { window.location.hash = '#/help/faq'; }}
            className={`rounded-lg border px-4 py-2 text-sm ${borderColor} ${textSecondary} ${hoverBg}`}
          >
            帮助
          </button>
          <button
            onClick={() => { void loadReports(); }}
            className={`rounded-lg border px-4 py-2 text-sm ${borderColor} ${textSecondary} ${hoverBg}`}
          >
            刷新
          </button>
          <Tooltip title={actionAccess.canCreateReport ? undefined : '当前会话缺少 report.create / query.saved.read 能力'}>
            <span>
              <button
                onClick={openCreateModal}
                disabled={!actionAccess.canCreateReport}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                新建模板
              </button>
            </span>
          </Tooltip>
        </div>
      </div>

      <div className="flex flex-col gap-4 p-6">
        <div className={`grid grid-cols-1 gap-3 rounded-xl border p-4 md:grid-cols-[2fr_1fr_1fr] ${borderColor} ${cardBg}`}>
          <input
            id="report-template-search"
            name="report_template_search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="搜索名称、描述、查询语句或模板 ID"
            className={`w-full rounded-lg border px-4 py-2.5 text-sm outline-none ${borderColor} ${inputBg} ${textColor}`}
          />
          <select
            id="report-template-type-filter"
            name="report_template_type_filter"
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as 'all' | ReportTemplate['type'])}
            className={`rounded-lg border px-4 py-2.5 text-sm outline-none ${borderColor} ${inputBg} ${textColor}`}
          >
            <option value="all">全部类型</option>
            <option value="system">系统日志</option>
            <option value="security">安全审计</option>
            <option value="performance">性能监控</option>
            <option value="custom">自定义</option>
          </select>
          <select
            id="report-template-status-filter"
            name="report_template_status_filter"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as 'all' | ReportTemplate['status'])}
            className={`rounded-lg border px-4 py-2.5 text-sm outline-none ${borderColor} ${inputBg} ${textColor}`}
          >
            <option value="all">全部状态</option>
            <option value="active">启用中</option>
            <option value="draft">草稿</option>
            <option value="archived">已归档</option>
          </select>
        </div>

        {error ? (
          <div className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">{error}</div>
        ) : null}

        {loading ? (
          <div className={`rounded-xl border p-8 text-center text-sm ${borderColor} ${cardBg} ${textSecondary}`}>正在加载报表模板...</div>
        ) : filteredReports.length === 0 ? (
          <div className={`rounded-xl border p-8 ${borderColor} ${cardBg}`}>
            <Empty description="暂无报表模板" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {filteredReports.map((report) => (
              <div key={report.id} className={`rounded-xl border p-5 shadow-sm ${borderColor} ${cardBg}`}>
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="mb-1 flex items-center gap-2">
                      <h3 className={`m-0 truncate text-lg font-semibold ${textColor}`}>{report.name}</h3>
                      <span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">{typeLabels[report.type]}</span>
                      <span className={`rounded-full px-2 py-1 text-xs ${report.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : report.status === 'draft' ? 'bg-amber-500/10 text-amber-500' : 'bg-slate-500/10 text-slate-500'}`}>{statusLabels[report.status]}</span>
                    </div>
                    <div className={`mb-2 text-xs ${textSecondary}`}>模板 ID：<code>{report.id}</code></div>
                    <p className={`m-0 text-sm ${textSecondary}`}>{report.description || '未填写模板说明'}</p>
                  </div>
                </div>

                <div className={`mb-4 rounded-lg border p-3 ${borderColor} ${inputBg}`}>
                  <div className={`mb-2 text-xs font-medium ${textSecondary}`}>查询语句</div>
                  <pre className={`m-0 whitespace-pre-wrap break-all text-xs ${textColor}`} style={{ fontFamily: 'JetBrains Mono, monospace' }}>{report.query}</pre>
                </div>

                <div className={`mb-4 grid grid-cols-1 gap-2 text-xs ${textSecondary} md:grid-cols-2`}>
                  <div>创建时间：{formatDateTime(report.createdAt)}</div>
                  <div>更新时间：{formatDateTime(report.updatedAt)}</div>
                  <div>运行次数：{report.runCount}</div>
                  <div>附加标签：{report.tags.filter((tag) => tag !== REPORT_TEMPLATE_TAG && !tag.startsWith(REPORT_TYPE_TAG_PREFIX) && !tag.startsWith(REPORT_STATUS_TAG_PREFIX)).join('、') || '无'}</div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Tooltip title={actionAccess.canUpdateReport ? '编辑模板' : '当前会话缺少 report.update / query.saved.read 能力'}>
                    <span>
                      <button
                        onClick={() => openEditModal(report)}
                        disabled={!actionAccess.canUpdateReport}
                        className={`rounded-lg border px-3 py-2 text-sm ${borderColor} ${textSecondary} ${hoverBg} disabled:cursor-not-allowed disabled:opacity-50`}
                      >
                        编辑
                      </button>
                    </span>
                  </Tooltip>
                  <Tooltip title={actionAccess.canGenerateReport ? '生成导出任务' : '当前会话缺少 report.generate / export.job.create 能力'}>
                    <span>
                      <button
                        onClick={() => { void handleGenerate(report); }}
                        disabled={!actionAccess.canGenerateReport || generatingID === report.id}
                        className="rounded-lg bg-primary px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {generatingID === report.id ? '生成中...' : '生成报表'}
                      </button>
                    </span>
                  </Tooltip>
                  <Tooltip title={actionAccess.canDeleteReport ? '删除模板' : '当前会话缺少 report.delete / query.saved.read 能力'}>
                    <span>
                      <button
                        onClick={() => setShowDeleteConfirm(report.id)}
                        disabled={!actionAccess.canDeleteReport}
                        className="rounded-lg border border-danger/30 px-3 py-2 text-sm text-danger disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        删除
                      </button>
                    </span>
                  </Tooltip>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className={`w-full max-w-2xl rounded-xl border shadow-2xl ${borderColor} ${modalBg}`}>
            <div className={`flex items-center justify-between border-b px-6 py-4 ${borderColor}`}>
              <h3 className={`m-0 text-lg font-bold ${textColor}`}>{editingReport ? '编辑报表模板' : '新建报表模板'}</h3>
              <button onClick={closeModal} className={`rounded-md p-1 ${hoverBg} ${textSecondary}`}>关闭</button>
            </div>
            <div className="grid gap-4 p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="report-template-name" className={`mb-1 block text-sm font-medium ${textColor}`}>模板名称</label>
                  <input
                    id="report-template-name"
                    value={formState.name}
                    onChange={(event) => setFormState((previous) => ({ ...previous, name: event.target.value }))}
                    className={`w-full rounded-lg border px-4 py-2.5 text-sm outline-none ${borderColor} ${inputBg} ${textColor}`}
                    placeholder="例如：核心服务错误周报"
                  />
                </div>
                <div>
                  <label htmlFor="report-template-type" className={`mb-1 block text-sm font-medium ${textColor}`}>类型</label>
                  <select
                    id="report-template-type"
                    value={formState.type}
                    onChange={(event) => setFormState((previous) => ({ ...previous, type: event.target.value as ReportTemplate['type'] }))}
                    className={`w-full rounded-lg border px-4 py-2.5 text-sm outline-none ${borderColor} ${inputBg} ${textColor}`}
                  >
                    <option value="system">系统日志</option>
                    <option value="security">安全审计</option>
                    <option value="performance">性能监控</option>
                    <option value="custom">自定义</option>
                  </select>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="report-template-status" className={`mb-1 block text-sm font-medium ${textColor}`}>状态</label>
                  <select
                    id="report-template-status"
                    value={formState.status}
                    onChange={(event) => setFormState((previous) => ({ ...previous, status: event.target.value as ReportTemplate['status'] }))}
                    className={`w-full rounded-lg border px-4 py-2.5 text-sm outline-none ${borderColor} ${inputBg} ${textColor}`}
                  >
                    <option value="active">启用中</option>
                    <option value="draft">草稿</option>
                    <option value="archived">已归档</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="report-template-description" className={`mb-1 block text-sm font-medium ${textColor}`}>模板说明</label>
                  <input
                    id="report-template-description"
                    value={formState.description}
                    onChange={(event) => setFormState((previous) => ({ ...previous, description: event.target.value }))}
                    className={`w-full rounded-lg border px-4 py-2.5 text-sm outline-none ${borderColor} ${inputBg} ${textColor}`}
                    placeholder="说明模板适用场景和输出目标"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="report-template-query" className={`mb-1 block text-sm font-medium ${textColor}`}>查询语句</label>
                <textarea
                  id="report-template-query"
                  value={formState.query}
                  onChange={(event) => setFormState((previous) => ({ ...previous, query: event.target.value }))}
                  rows={6}
                  className={`w-full rounded-lg border px-4 py-3 text-sm outline-none ${borderColor} ${inputBg} ${textColor}`}
                  placeholder="例如：level:error service:gateway"
                />
              </div>
            </div>
            <div className={`flex justify-end gap-3 border-t px-6 py-4 ${borderColor}`}>
              <button onClick={closeModal} className={`rounded-lg border px-4 py-2 text-sm ${borderColor} ${textSecondary} ${hoverBg}`}>取消</button>
              <button onClick={() => { void handleSave(); }} disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">
                {saving ? '保存中...' : editingReport ? '保存' : '创建'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showDeleteConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className={`w-full max-w-sm rounded-xl border shadow-2xl ${borderColor} ${modalBg}`}>
            <div className="p-6 text-center">
              <h3 className={`mb-2 text-lg font-bold ${textColor}`}>确认删除</h3>
              <p className={`m-0 text-sm ${textSecondary}`}>删除后将无法恢复该报表模板。</p>
            </div>
            <div className={`flex gap-3 border-t px-6 py-4 ${borderColor}`}>
              <button onClick={() => setShowDeleteConfirm(null)} className={`flex-1 rounded-lg border px-4 py-2 text-sm ${borderColor} ${textSecondary} ${hoverBg}`}>取消</button>
              <button onClick={() => { void handleDelete(showDeleteConfirm); }} className="flex-1 rounded-lg bg-danger px-4 py-2 text-sm text-white">删除</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ReportManagement;
