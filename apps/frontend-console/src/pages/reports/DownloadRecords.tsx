import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { message, Empty, Modal, Form, Input, Select, Button, Pagination, Tooltip } from 'antd';
import { useAuthStore } from '../../stores/authStore';
import { useThemeStore } from '../../stores/themeStore';
import {
  createExportJob,
  fetchExportJobs,
  downloadExportFile,
  type ExportJobItem,
  type CreateExportJobParams,
} from '../../api/export';
import { resolveDownloadRecordsActionAccess } from './downloadRecordsAuthorization';
import InlineLoadingState from '../../components/common/InlineLoadingState';
import { useUnnamedFormFieldAccessibility } from '../../components/common/useUnnamedFormFieldAccessibility';

const FORMAT_OPTIONS = [
  { value: 'csv', label: 'CSV' },
  { value: 'json', label: 'JSON' },
];

const formatConfig: Record<string, { label: string; bgClass: string; textClass: string; icon: string }> = {
  csv: { label: 'CSV', bgClass: 'bg-blue-900/30', textClass: 'text-blue-300', icon: 'description' },
  json: { label: 'JSON', bgClass: 'bg-emerald-900/30', textClass: 'text-emerald-300', icon: 'code' },
};

const statusConfig: Record<string, { label: string; dot: string; text: string; animate: boolean }> = {
  pending: { label: '排队中', dot: 'bg-amber-500', text: 'text-amber-400', animate: true },
  running: { label: '导出中', dot: 'bg-blue-500', text: 'text-blue-400', animate: true },
  completed: { label: '可下载', dot: 'bg-emerald-500', text: 'text-emerald-400', animate: true },
  failed: { label: '失败', dot: 'bg-red-500', text: 'text-red-400', animate: false },
};

function formatFileSize(bytes?: number): string {
  if (bytes == null || bytes === 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateTime(iso?: string): { date: string; time: string } {
  if (!iso) return { date: '-', time: '' };
  try {
    const d = new Date(iso);
    return {
      date: d.toLocaleDateString('zh-CN'),
      time: d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
  } catch {
    return { date: iso, time: '' };
  }
}

const DownloadRecords: React.FC = () => {
  const { isDark } = useThemeStore();
  const permissions = useAuthStore((state) => state.permissions);
  const capabilities = useAuthStore((state) => state.capabilities);
  const [jobs, setJobs] = useState<ExportJobItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formatFilter, setFormatFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const createExportModalRef = useUnnamedFormFieldAccessibility('download-records-create-export');
  const [createLoading, setCreateLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState<string | null>(null);
  const [form] = Form.useForm();

  const authorization = useMemo(
    () => ({ permissions, capabilities }),
    [capabilities, permissions],
  );
  const actionAccess = useMemo(
    () => resolveDownloadRecordsActionAccess(authorization),
    [authorization],
  );
  const missingExportActions = useMemo(() => {
    const restrictions: string[] = [];
    if (!actionAccess.canCreateExportJob) {
      restrictions.push('新建导出任务');
    }
    if (!actionAccess.canDownloadExportJob) {
      restrictions.push('下载导出文件');
    }
    return restrictions;
  }, [actionAccess.canCreateExportJob, actionAccess.canDownloadExportJob]);

  const pageBg = isDark ? 'bg-background-dark' : 'bg-slate-50';
  const headerBg = isDark ? 'bg-[#111722]' : 'bg-white';
  const cardBg = isDark ? 'bg-[#1a202c]' : 'bg-white';
  const inputBg = isDark ? 'bg-[#111722]' : 'bg-white';
  const tableHeaderBg = isDark ? 'bg-[#232b38]' : 'bg-slate-100';
  const borderColor = isDark ? 'border-[#2d3748]' : 'border-slate-200';
  const textColor = isDark ? 'text-white' : 'text-slate-900';
  const textSecondary = isDark ? 'text-text-secondary' : 'text-slate-600';
  const hoverBg = isDark ? 'hover:bg-[#232b38]' : 'hover:bg-slate-50';
  const buttonBg = isDark ? 'bg-[#2d3748]' : 'bg-slate-100';
  const buttonHoverBg = isDark ? 'hover:bg-[#374151]' : 'hover:bg-slate-200';
  const filterBg = isDark ? 'bg-[#1a202c]' : 'bg-slate-100';
  const modalBg = isDark ? 'bg-[#1e293b]' : 'bg-white';

  const loadJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchExportJobs(page, pageSize);
      setJobs(res.items);
      setTotal(res.total);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载失败';
      setError(msg);
      message.error(msg);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  // Auto-refresh when there are pending/running jobs
  const hasInProgress = useMemo(() => jobs.some((j) => j.status === 'pending' || j.status === 'running'), [jobs]);
  useEffect(() => {
    if (!hasInProgress) return;
    const timer = setInterval(loadJobs, 3000);
    return () => clearInterval(timer);
  }, [hasInProgress, loadJobs]);

  const filteredJobs = useMemo(() => {
    let r = [...jobs];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      r = r.filter((j) => j.id.toLowerCase().includes(q));
    }
    if (formatFilter !== 'all') r = r.filter((j) => j.format === formatFilter);
    return r;
  }, [jobs, searchQuery, formatFilter]);

  const openCreateExportModal = useCallback(() => {
    if (!actionAccess.canCreateExportJob) {
      message.warning('当前会话缺少新建导出任务权限');
      return;
    }
    setShowCreateModal(true);
  }, [actionAccess.canCreateExportJob]);

  const handleCreateExport = async () => {
    if (!actionAccess.canCreateExportJob) {
      message.warning('当前会话缺少新建导出任务权限');
      return;
    }
    try {
      const values = await form.validateFields();
      setCreateLoading(true);
      let queryParams: Record<string, unknown> = {};
      if (values.query_params?.trim()) {
        try {
          queryParams = JSON.parse(values.query_params);
        } catch {
          queryParams = {};
        }
      }
      const params: CreateExportJobParams = {
        query_params: queryParams,
        format: (values.format ?? 'csv') as 'csv' | 'json',
      };
      await createExportJob(params);
      message.success('导出任务已创建，请稍候刷新查看');
      setShowCreateModal(false);
      form.resetFields();
      loadJobs();
    } catch (err) {
      if (err instanceof Error && err.message.includes('validateFields')) return;
      const msg = err instanceof Error ? err.message : '创建失败';
      message.error(msg);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDownload = async (job: ExportJobItem) => {
    if (job.status !== 'completed') return;
    if (!actionAccess.canDownloadExportJob) {
      message.warning('当前会话缺少导出文件下载权限');
      return;
    }
    setDownloadLoading(job.id);
    try {
      const blob = await downloadExportFile(job.id);
      const ext = job.format === 'csv' ? '.csv' : '.json';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nexuslog-export-${job.id}${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      message.success('下载成功');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '下载失败';
      message.error(msg);
    } finally {
      setDownloadLoading(null);
    }
  };

  const handleRefresh = () => loadJobs();

  const getStatusStyle = (status: string) => {
    return statusConfig[status] ?? statusConfig.pending;
  };

  return (
    <div className={`flex flex-col h-full overflow-hidden ${pageBg}`}>
      <header className={`w-full px-8 py-6 border-b ${borderColor} ${headerBg} shrink-0 z-10 -mx-6 -mt-6`}>
        <div className="flex flex-col gap-1 mb-6">
          <div className="flex items-center justify-between">
            <h1 className={`text-2xl md:text-3xl font-bold ${textColor} tracking-tight`}>下载记录</h1>
            <div className="flex items-center gap-2">
              <Tooltip title={actionAccess.canCreateExportJob ? undefined : '当前会话缺少 export.job.create / logs:export 能力'}>
                <span>
                  <button
                    onClick={openCreateExportModal}
                    disabled={!actionAccess.canCreateExportJob}
                    className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="material-symbols-outlined text-[20px]">add</span>新建导出
                  </button>
                </span>
              </Tooltip>
              <button
                onClick={handleRefresh}
                disabled={loading}
                className={`flex items-center gap-2 px-4 py-2 ${buttonBg} ${buttonHoverBg} ${textColor} text-sm font-medium rounded-lg`}
              >
                <span className={`material-symbols-outlined text-[20px] ${loading ? 'animate-spin' : ''}`}>refresh</span>
                刷新列表
              </button>
            </div>
          </div>
          <div className={`flex items-center gap-2 text-sm ${textSecondary}`}>
            <span className="material-symbols-outlined text-[18px]">info</span>
            <p>系统将自动清理生成超过 7 天的文件</p>
          </div>
        </div>
        <div className={`flex flex-wrap items-center gap-4 ${filterBg} p-1.5 rounded-xl`}>
          <div className="relative group flex-1 min-w-[200px]">
            <span className={`absolute left-3 top-1/2 -translate-y-1/2 ${textSecondary} group-focus-within:text-primary material-symbols-outlined`}>
              search
            </span>
            <input
              id="download-records-search"
              name="download_records_search"
              className={`w-full h-10 pl-10 pr-4 ${inputBg} border-none rounded-lg text-sm ${textColor} focus:ring-2 focus:ring-primary placeholder-text-secondary shadow-sm`}
              placeholder="搜索任务 ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className={`h-6 w-px ${isDark ? 'bg-[#2d3748]' : 'bg-slate-300'}`}></div>
          <div className="relative min-w-[140px]">
            <select
              id="download-records-format-filter"
              name="download_records_format_filter"
              className={`w-full h-10 pl-3 pr-8 ${inputBg} border-none rounded-lg text-sm ${textColor} focus:ring-2 focus:ring-primary appearance-none cursor-pointer shadow-sm`}
              value={formatFilter}
              onChange={(e) => setFormatFilter(e.target.value)}
            >
              <option value="all">所有格式</option>
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
            </select>
            <span className={`absolute right-2 top-1/2 -translate-y-1/2 ${textSecondary} pointer-events-none material-symbols-outlined text-[20px]`}>
              expand_more
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto pt-4">
        <div className={`w-full ${cardBg} rounded-xl border ${borderColor} shadow-sm overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className={`${tableHeaderBg} border-b ${borderColor}`}>
                  <th className={`py-4 px-6 text-xs font-semibold ${textSecondary} uppercase tracking-wider w-[25%]`}>任务 ID</th>
                  <th className={`py-4 px-6 text-xs font-semibold ${textSecondary} uppercase tracking-wider`}>格式</th>
                  <th className={`py-4 px-6 text-xs font-semibold ${textSecondary} uppercase tracking-wider`}>大小</th>
                  <th className={`py-4 px-6 text-xs font-semibold ${textSecondary} uppercase tracking-wider`}>生成时间</th>
                  <th className={`py-4 px-6 text-xs font-semibold ${textSecondary} uppercase tracking-wider`}>状态</th>
                  <th className={`py-4 px-6 text-xs font-semibold ${textSecondary} uppercase tracking-wider text-right`}>操作</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-[#2d3748]' : 'divide-slate-200'}`}>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center">
                      <InlineLoadingState tip="加载中..." />
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={6} className="py-16">
                      <Empty description={error} image={Empty.PRESENTED_IMAGE_SIMPLE} />
                    </td>
                  </tr>
                ) : filteredJobs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16">
                      <Empty description="暂无导出记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                    </td>
                  </tr>
                ) : (
                  filteredJobs.map((job) => {
                    const format = formatConfig[job.format] ?? formatConfig.csv;
                    const status = getStatusStyle(job.status);
                    const dt = formatDateTime(job.completed_at || job.created_at);
                    const jobReadyForDownload = job.status === 'completed';
                    const canDownload = jobReadyForDownload && actionAccess.canDownloadExportJob;
                    const downloadDisabledReason = !jobReadyForDownload
                      ? '任务尚未完成，暂不可下载'
                      : !actionAccess.canDownloadExportJob
                        ? '当前会话缺少 export.job.download / logs:export 能力'
                        : undefined;
                    return (
                      <tr key={job.id} className={`group ${hoverBg} transition-colors`}>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${format.bgClass} ${format.textClass}`}>
                              <span className="material-symbols-outlined">{format.icon}</span>
                            </div>
                            <span className={`text-sm font-medium font-mono ${textColor}`}>{job.id}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${format.bgClass} ${format.textClass}`}>
                            {format.label}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <span className={`text-sm ${textSecondary} font-mono`}>
                            {formatFileSize(job.file_size_bytes)}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex flex-col">
                            <span className={`text-sm ${textColor} font-mono`}>{dt.date}</span>
                            <span className={`text-xs ${textSecondary} font-mono`}>{dt.time}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-1.5">
                            <span className="relative flex h-2 w-2">
                              {status.animate && (
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              )}
                              <span className={`relative inline-flex rounded-full h-2 w-2 ${status.dot}`}></span>
                            </span>
                            <span className={`text-sm font-medium ${status.text}`}>{status.label}</span>
                          </div>
                          {job.error_message && (
                            <div className={`text-xs ${isDark ? 'text-red-400' : 'text-red-600'} mt-1 truncate max-w-[200px]`} title={job.error_message}>
                              {job.error_message}
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <Tooltip title={downloadDisabledReason}>
                            <span>
                              <button
                                onClick={() => handleDownload(job)}
                                disabled={!canDownload || downloadLoading === job.id}
                                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${canDownload ? 'bg-primary/10 hover:bg-primary text-primary hover:text-white' : isDark ? 'bg-gray-800 text-gray-400' : 'bg-slate-200 text-slate-400'}`}
                              >
                                {canDownload && downloadLoading === job.id ? (
                                  <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                                ) : (
                                  <span className="material-symbols-outlined text-[18px]">{canDownload ? 'download' : 'block'}</span>
                                )}
                                {canDownload ? '下载' : '不可用'}
                              </button>
                            </span>
                          </Tooltip>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {!loading && !error && filteredJobs.length > 0 && (
            <div className={`flex items-center justify-between px-6 py-4 ${tableHeaderBg} border-t ${borderColor}`}>
              <p className={`text-sm ${textSecondary}`}>
                显示 <span className={`font-medium ${textColor}`}>{(page - 1) * pageSize + 1}</span> 到{' '}
                <span className={`font-medium ${textColor}`}>{Math.min(page * pageSize, total)}</span> 条，共{' '}
                <span className={`font-medium ${textColor}`}>{total}</span> 条记录
              </p>
              <Pagination
                current={page}
                pageSize={pageSize}
                total={total}
                showSizeChanger={false}
                onChange={setPage}
                size="small"
              />
            </div>
          )}
        </div>
      </main>

      <Modal
        title="新建导出任务"
        open={showCreateModal}
        onCancel={() => setShowCreateModal(false)}
        footer={null}
        destroyOnHidden
        forceRender
      >
        <div ref={createExportModalRef}>
          <Form form={form} layout="vertical" onFinish={handleCreateExport}>
          <Form.Item
            name="query_params"
            label="查询参数 (JSON)"
            rules={[
              {
                validator: (_, value) => {
                  if (!value?.trim()) return Promise.resolve();
                  try {
                    JSON.parse(value);
                    return Promise.resolve();
                  } catch {
                    return Promise.reject(new Error('请输入有效的 JSON'));
                  }
                },
              },
            ]}
          >
            <Input.TextArea
              id="query_params"
              name="downloadRecordsCreateQueryParams"
              rows={4}
              placeholder='{"keywords": "", "time_range": {"from": "", "to": ""}}'
            />
          </Form.Item>
          <Form.Item name="format" label="导出格式" initialValue="csv">
            <Select id="format" aria-label="导出格式" options={FORMAT_OPTIONS} />
          </Form.Item>
          <Form.Item>
            <div className="flex justify-end gap-2">
              <Button onClick={() => setShowCreateModal(false)}>取消</Button>
              <Button type="primary" htmlType="submit" loading={createLoading}>
                创建
              </Button>
            </div>
          </Form.Item>
          </Form>
        </div>
      </Modal>
    </div>
  );
};

export default DownloadRecords;
