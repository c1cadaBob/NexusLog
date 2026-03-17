import React, { useCallback, useMemo, useState } from 'react';
import { Alert, message, Tooltip } from 'antd';
import { useAuthStore } from '../../stores/authStore';
import { useThemeStore } from '../../stores/themeStore';
import { resolveReportManagementActionAccess } from './reportManagementAuthorization';

interface Report {
  id: string;
  name: string;
  description: string;
  type: 'system' | 'security' | 'performance' | 'custom';
  status: 'active' | 'draft' | 'archived';
  creator: string;
  lastGenerated: string | null;
  createdAt: string;
}

const mockReports: Report[] = [
  { id: 'RPT-001', name: '系统健康周报', description: '每周系统运行状态概览及关键指标分析', type: 'system', status: 'active', creator: 'Admin', lastGenerated: '2小时前', createdAt: '2023-10-01' },
  { id: 'RPT-002', name: '错误日志分析', description: 'Critical级别错误统计与来源追踪', type: 'system', status: 'active', creator: '李四', lastGenerated: '昨天', createdAt: '2023-09-15' },
  { id: 'RPT-003', name: 'API 响应时间监控', description: '核心接口P95/P99延迟监控报表', type: 'performance', status: 'active', creator: 'OpsTeam', lastGenerated: '10分钟前', createdAt: '2023-08-20' },
  { id: 'RPT-004', name: '安全审计月报', description: '登录尝试与权限变更记录', type: 'security', status: 'draft', creator: 'SecAdmin', lastGenerated: null, createdAt: '2023-10-20' },
  { id: 'RPT-005', name: '用户访问流量分析', description: 'PV/UV 每日趋势对比', type: 'custom', status: 'active', creator: '运营组', lastGenerated: '2023-10-24', createdAt: '2023-07-10' },
  { id: 'RPT-006', name: '自定义 SQL 报表', description: '复杂查询结果导出模板', type: 'custom', status: 'active', creator: 'DBA', lastGenerated: '3天前', createdAt: '2023-06-01' },
];

const statusLabels: Record<Report['status'], string> = {
  active: 'Active',
  draft: 'Draft',
  archived: 'Archived',
};

const typeLabels: Record<Report['type'], string> = {
  system: '系统日志',
  security: '安全审计',
  performance: '性能监控',
  custom: '自定义',
};

const ReportManagement: React.FC = () => {
  const { isDark } = useThemeStore();
  const capabilities = useAuthStore((state) => state.capabilities);
  const [reports, setReports] = useState<Report[]>(mockReports);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('time');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showModal, setShowModal] = useState(false);
  const [editingReport, setEditingReport] = useState<Report | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const actionAccess = useMemo(
    () => resolveReportManagementActionAccess({ capabilities }),
    [capabilities],
  );
  const missingReportActions = useMemo(() => {
    const restrictions: string[] = [];
    if (!actionAccess.canCreateReport) {
      restrictions.push('创建报表');
    }
    if (!actionAccess.canUpdateReport) {
      restrictions.push('编辑报表');
    }
    if (!actionAccess.canGenerateReport) {
      restrictions.push('生成报表');
    }
    if (!actionAccess.canDeleteReport) {
      restrictions.push('删除报表');
    }
    return restrictions;
  }, [actionAccess.canCreateReport, actionAccess.canDeleteReport, actionAccess.canGenerateReport, actionAccess.canUpdateReport]);

  const headerBg = isDark ? 'bg-[#111722]' : 'bg-white';
  const cardBg = isDark ? 'bg-[#1e293b]' : 'bg-white';
  const inputBg = isDark ? 'bg-[#1e293b]' : 'bg-slate-50';
  const borderColor = isDark ? 'border-border-dark' : 'border-slate-200';
  const textColor = isDark ? 'text-white' : 'text-slate-900';
  const textSecondary = isDark ? 'text-text-secondary' : 'text-slate-600';
  const hoverBg = isDark ? 'hover:bg-[#232f48]' : 'hover:bg-slate-100';
  const thumbnailBg = isDark ? 'bg-[#111722]' : 'bg-slate-100';
  const modalBg = isDark ? 'bg-[#1e293b]' : 'bg-white';

  const filteredReports = useMemo(() => {
    let result = [...reports];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((report) =>
        report.name.toLowerCase().includes(q) ||
        report.id.toLowerCase().includes(q) ||
        report.creator.toLowerCase().includes(q),
      );
    }
    if (typeFilter !== 'all') {
      result = result.filter((report) => report.type === typeFilter);
    }
    result.sort((a, b) =>
      sortBy === 'name'
        ? a.name.localeCompare(b.name)
        : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return result;
  }, [reports, searchQuery, sortBy, typeFilter]);

  const closeModal = useCallback(() => {
    setShowModal(false);
    setEditingReport(null);
  }, []);

  const handleCreate = useCallback(() => {
    if (!actionAccess.canCreateReport) {
      message.warning('当前会话缺少报表创建权限');
      return;
    }
    setEditingReport(null);
    setShowModal(true);
  }, [actionAccess.canCreateReport]);

  const handleEdit = useCallback((report: Report) => {
    if (!actionAccess.canUpdateReport) {
      message.warning('当前会话缺少报表编辑权限');
      return;
    }
    setEditingReport(report);
    setShowModal(true);
  }, [actionAccess.canUpdateReport]);

  const requestDelete = useCallback((id: string) => {
    if (!actionAccess.canDeleteReport) {
      message.warning('当前会话缺少报表删除权限');
      return;
    }
    setShowDeleteConfirm(id);
  }, [actionAccess.canDeleteReport]);

  const handleDelete = useCallback((id: string) => {
    if (!actionAccess.canDeleteReport) {
      message.warning('当前会话缺少报表删除权限');
      return;
    }
    setReports((prev) => prev.filter((report) => report.id !== id));
    setShowDeleteConfirm(null);
    message.success('报表已删除');
  }, [actionAccess.canDeleteReport]);

  const handleGenerate = useCallback((id: string) => {
    if (!actionAccess.canGenerateReport) {
      message.warning('当前会话缺少报表生成功能权限');
      return;
    }
    setReports((prev) => prev.map((report) => (report.id === id ? { ...report, lastGenerated: '刚刚' } : report)));
    message.success('报表已加入生成队列');
  }, [actionAccess.canGenerateReport]);

  const handleSave = useCallback((data: Partial<Report>) => {
    const isEditing = Boolean(editingReport);
    if (isEditing && !actionAccess.canUpdateReport) {
      message.warning('当前会话缺少报表编辑权限');
      return;
    }
    if (!isEditing && !actionAccess.canCreateReport) {
      message.warning('当前会话缺少报表创建权限');
      return;
    }

    if (editingReport) {
      setReports((prev) => prev.map((report) => (report.id === editingReport.id ? { ...report, ...data } : report)));
      message.success('报表已保存');
    } else {
      setReports((prev) => [
        ...prev,
        {
          id: `RPT-${String(prev.length + 1).padStart(3, '0')}`,
          name: data.name || '新报表',
          description: data.description || '',
          type: data.type || 'custom',
          status: 'draft',
          creator: 'Current User',
          lastGenerated: null,
          createdAt: new Date().toISOString().split('T')[0],
        },
      ]);
      message.success('报表已创建');
    }

    closeModal();
  }, [actionAccess.canCreateReport, actionAccess.canUpdateReport, closeModal, editingReport]);

  const getStatusStyle = (status: Report['status']) => {
    if (status === 'active') return 'bg-success/10 text-success border-success/20';
    if (status === 'draft') return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
    return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
  };

  const getThumbnailGradient = (type: Report['type']) => {
    if (type === 'system') return 'from-primary';
    if (type === 'security') return 'from-yellow-500';
    if (type === 'performance') return 'from-blue-400';
    return 'from-purple-500';
  };

  return (
    <div className="flex flex-col h-full gap-6">
      <div className={`flex flex-col gap-4 border-b ${borderColor} ${headerBg} px-6 py-5 shrink-0 z-10 -mx-6 -mt-6`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className={`text-2xl font-bold leading-tight ${textColor}`}>报表管理</h1>
            <p className={`text-sm ${textSecondary} mt-1`}>管理和预览您的系统日志报表模板</p>
          </div>
          <Tooltip title={actionAccess.canCreateReport ? undefined : '当前会话缺少 report.create 能力'}>
            <span>
              <button
                onClick={handleCreate}
                disabled={!actionAccess.canCreateReport}
                className="flex items-center gap-2 rounded-lg bg-primary hover:bg-primary-hover text-white px-5 py-2.5 text-sm font-bold transition-all shadow-lg shadow-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[20px]">add</span>
                <span>创建报表</span>
              </button>
            </span>
          </Tooltip>
        </div>
        <div className="space-y-3">
          {actionAccess.isViewOnly ? (
            <Alert
              showIcon
              type="info"
              message="当前会话为查看模式"
              description="你可以查看报表模板，但创建、编辑、生成和删除报表需要额外的报表管理能力。"
            />
          ) : null}
          {!actionAccess.isViewOnly && missingReportActions.length > 0 ? (
            <Alert
              showIcon
              type="info"
              message="当前会话存在报表动作限制"
              description={`当前会话仍可查看报表列表；${missingReportActions.join('、')}需要额外能力。`}
            />
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-4 mt-2">
          <div className="relative flex-1 min-w-[280px] max-w-md group">
            <div className={`absolute left-3 top-1/2 -translate-y-1/2 ${textSecondary} group-focus-within:text-primary transition-colors`}>
              <span className="material-symbols-outlined text-[20px]">search</span>
            </div>
            <input
              id="report-management-search"
              name="report_management_search"
              className={`w-full rounded-lg border ${borderColor} ${inputBg} py-2.5 pl-10 pr-4 text-sm ${textColor} placeholder-text-secondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary`}
              placeholder="搜索报表名称、ID或创建人..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <select
                id="report-management-type-filter"
                name="report_management_type_filter"
                className={`h-10 appearance-none rounded-lg border ${borderColor} ${inputBg} pl-4 pr-10 text-sm font-medium ${textColor} focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer`}
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
              >
                <option value="all">所有类型</option>
                <option value="system">系统日志</option>
                <option value="security">安全审计</option>
                <option value="performance">性能监控</option>
                <option value="custom">自定义</option>
              </select>
              <div className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 ${textSecondary}`}>
                <span className="material-symbols-outlined text-[20px]">expand_more</span>
              </div>
            </div>
            <div className="relative">
              <select
                id="report-management-sort"
                name="report_management_sort"
                className={`h-10 appearance-none rounded-lg border ${borderColor} ${inputBg} pl-4 pr-10 text-sm font-medium ${textColor} focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer`}
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
              >
                <option value="time">按时间排序</option>
                <option value="name">按名称排序</option>
              </select>
              <div className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 ${textSecondary}`}>
                <span className="material-symbols-outlined text-[20px]">sort</span>
              </div>
            </div>
            <div className={`h-8 w-px ${isDark ? 'bg-border-dark' : 'bg-slate-200'} mx-1`}></div>
            <button
              className={`flex h-10 w-10 items-center justify-center rounded-lg border ${viewMode === 'grid' ? 'border-primary bg-primary/10 text-primary' : `${borderColor} ${inputBg} ${textSecondary}`} hover:text-primary hover:border-primary transition-colors`}
              onClick={() => setViewMode('grid')}
            >
              <span className="material-symbols-outlined text-[20px]">grid_view</span>
            </button>
            <button
              className={`flex h-10 w-10 items-center justify-center rounded-lg border ${viewMode === 'list' ? 'border-primary bg-primary/10 text-primary' : `border-transparent bg-transparent ${textSecondary}`} ${hoverBg} transition-colors`}
              onClick={() => setViewMode('list')}
            >
              <span className="material-symbols-outlined text-[20px]">list</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-10">
            {filteredReports.map((report) => (
              <div
                key={report.id}
                className={`group flex flex-col rounded-xl ${cardBg} border ${borderColor} shadow-sm hover:shadow-lg hover:border-primary/50 transition-all duration-200 overflow-hidden`}
              >
                <div className={`relative h-40 w-full ${thumbnailBg} p-4 flex items-center justify-center overflow-hidden`}>
                  <div className={`absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] ${getThumbnailGradient(report.type)} ${isDark ? 'via-[#111722] to-[#111722]' : 'via-slate-100 to-slate-100'}`}></div>
                  <div
                    className="w-full h-full bg-contain bg-center bg-no-repeat transform group-hover:scale-105 transition-transform duration-500"
                    style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'100%25\' height=\'100%25\' viewBox=\'0 0 200 100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M10,90 Q50,10 90,50 T190,30\' fill=\'none\' stroke=\'%23135bec\' stroke-width=\'3\'/%3E%3Crect x=\'20\' y=\'60\' width=\'20\' height=\'30\' fill=\'%23324467\'/%3E%3Crect x=\'50\' y=\'40\' width=\'20\' height=\'50\' fill=\'%23324467\'/%3E%3Crect x=\'80\' y=\'70\' width=\'20\' height=\'20\' fill=\'%23324467\'/%3E%3Crect x=\'110\' y=\'30\' width=\'20\' height=\'60\' fill=\'%23324467\'/%3E%3Crect x=\'140\' y=\'50\' width=\'20\' height=\'40\' fill=\'%23135bec\'/%3E%3C/svg%3E")' }}
                  ></div>
                  <div className="absolute top-3 right-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border ${getStatusStyle(report.status)}`}>
                      <span className="mr-1 h-1.5 w-1.5 rounded-full bg-current"></span>
                      {statusLabels[report.status]}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col p-4 gap-3 flex-1">
                  <div>
                    <h3 className={`text-base font-bold ${textColor} group-hover:text-primary transition-colors`}>{report.name}</h3>
                    <p className={`text-xs ${textSecondary} line-clamp-1 mt-1`}>{report.description}</p>
                  </div>
                  <div className={`flex items-center justify-between text-xs mt-auto pt-3 border-t ${borderColor}`}>
                    <div className="flex flex-col gap-0.5">
                      <span className={textSecondary}>创建人: {report.creator}</span>
                      <span className={`${textSecondary} opacity-70`}>上次生成: {report.lastGenerated || '未生成'}</span>
                    </div>
                    <div className="flex gap-1">
                      <Tooltip title={actionAccess.canUpdateReport ? '编辑报表' : '当前会话缺少 report.update 能力'}>
                        <span>
                          <button
                            className={`p-1.5 rounded-md ${hoverBg} ${textSecondary} disabled:opacity-50 disabled:cursor-not-allowed`}
                            onClick={() => handleEdit(report)}
                            disabled={!actionAccess.canUpdateReport}
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                        </span>
                      </Tooltip>
                      <Tooltip title={actionAccess.canGenerateReport ? '生成报表' : '当前会话缺少 report.generate 能力'}>
                        <span>
                          <button
                            className="p-1.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={() => handleGenerate(report.id)}
                            disabled={!actionAccess.canGenerateReport}
                          >
                            <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                          </button>
                        </span>
                      </Tooltip>
                      <Tooltip title={actionAccess.canDeleteReport ? '删除报表' : '当前会话缺少 report.delete 能力'}>
                        <span>
                          <button
                            className="p-1.5 rounded-md hover:bg-danger/10 text-danger/70 hover:text-danger disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={() => requestDelete(report.id)}
                            disabled={!actionAccess.canDeleteReport}
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </span>
                      </Tooltip>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <Tooltip title={actionAccess.canCreateReport ? undefined : '当前会话缺少 report.create 能力'}>
              <span>
                <button
                  onClick={handleCreate}
                  disabled={!actionAccess.canCreateReport}
                  className={`group flex flex-col items-center justify-center rounded-xl bg-transparent border border-dashed ${borderColor} hover:border-primary hover:bg-primary/5 transition-all min-h-[280px] w-full disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div className={`h-14 w-14 rounded-full ${cardBg} group-hover:bg-primary group-hover:text-white flex items-center justify-center ${textSecondary} transition-all mb-4`}>
                    <span className="material-symbols-outlined text-[32px]">add</span>
                  </div>
                  <span className={`text-sm font-bold ${textColor}`}>新建空白报表</span>
                  <span className={`text-xs ${textSecondary} mt-1`}>从头开始自定义配置</span>
                </button>
              </span>
            </Tooltip>
          </div>
        ) : (
          <div className={`rounded-xl border ${borderColor} ${cardBg} overflow-hidden`}>
            <table className="w-full">
              <thead className={isDark ? 'bg-[#1a2332]' : 'bg-slate-100'}>
                <tr>
                  <th className={`px-6 py-4 text-left text-xs font-semibold ${textSecondary} uppercase`}>报表名称</th>
                  <th className={`px-6 py-4 text-left text-xs font-semibold ${textSecondary} uppercase`}>类型</th>
                  <th className={`px-6 py-4 text-left text-xs font-semibold ${textSecondary} uppercase`}>状态</th>
                  <th className={`px-6 py-4 text-left text-xs font-semibold ${textSecondary} uppercase`}>创建人</th>
                  <th className={`px-6 py-4 text-left text-xs font-semibold ${textSecondary} uppercase`}>上次生成</th>
                  <th className={`px-6 py-4 text-right text-xs font-semibold ${textSecondary} uppercase`}>操作</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-border-dark' : 'divide-slate-200'}`}>
                {filteredReports.map((report) => (
                  <tr key={report.id} className={`${hoverBg} transition-colors`}>
                    <td className="px-6 py-4">
                      <span className={`font-medium ${textColor}`}>{report.name}</span>
                      <br />
                      <span className={`text-xs ${textSecondary}`}>{report.id}</span>
                    </td>
                    <td className={`px-6 py-4 text-sm ${textSecondary}`}>{typeLabels[report.type]}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border ${getStatusStyle(report.status)}`}>
                        {statusLabels[report.status]}
                      </span>
                    </td>
                    <td className={`px-6 py-4 text-sm ${textSecondary}`}>{report.creator}</td>
                    <td className={`px-6 py-4 text-sm ${textSecondary}`}>{report.lastGenerated || '未生成'}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Tooltip title={actionAccess.canUpdateReport ? '编辑报表' : '当前会话缺少 report.update 能力'}>
                          <span>
                            <button
                              className={`p-1.5 rounded-md ${hoverBg} ${textSecondary} disabled:opacity-50 disabled:cursor-not-allowed`}
                              onClick={() => handleEdit(report)}
                              disabled={!actionAccess.canUpdateReport}
                            >
                              <span className="material-symbols-outlined text-[18px]">edit</span>
                            </button>
                          </span>
                        </Tooltip>
                        <Tooltip title={actionAccess.canGenerateReport ? '生成报表' : '当前会话缺少 report.generate 能力'}>
                          <span>
                            <button
                              className="p-1.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                              onClick={() => handleGenerate(report.id)}
                              disabled={!actionAccess.canGenerateReport}
                            >
                              <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                            </button>
                          </span>
                        </Tooltip>
                        <Tooltip title={actionAccess.canDeleteReport ? '删除报表' : '当前会话缺少 report.delete 能力'}>
                          <span>
                            <button
                              className="p-1.5 rounded-md hover:bg-danger/10 text-danger/70 hover:text-danger disabled:opacity-50 disabled:cursor-not-allowed"
                              onClick={() => requestDelete(report.id)}
                              disabled={!actionAccess.canDeleteReport}
                            >
                              <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                          </span>
                        </Tooltip>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className={`w-full max-w-lg rounded-xl ${modalBg} border ${borderColor} shadow-2xl`}>
            <div className={`flex items-center justify-between px-6 py-4 border-b ${borderColor}`}>
              <h2 className={`text-lg font-bold ${textColor}`}>{editingReport ? '编辑报表' : '创建报表'}</h2>
              <button onClick={closeModal} className={`p-1 rounded-md ${hoverBg} ${textSecondary}`}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                handleSave({
                  name: formData.get('name') as string,
                  description: formData.get('description') as string,
                  type: formData.get('type') as Report['type'],
                });
              }}
            >
              <div className="p-6 space-y-4">
                <div>
                  <label htmlFor="report-management-form-name" className={`block text-sm font-medium ${textColor} mb-1`}>报表名称</label>
                  <input
                    id="report-management-form-name"
                    name="name"
                    defaultValue={editingReport?.name || ''}
                    className={`w-full rounded-lg border ${borderColor} ${inputBg} py-2.5 px-4 text-sm ${textColor} focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary`}
                    placeholder="输入报表名称"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="report-management-form-description" className={`block text-sm font-medium ${textColor} mb-1`}>描述</label>
                  <textarea
                    id="report-management-form-description"
                    name="description"
                    defaultValue={editingReport?.description || ''}
                    className={`w-full rounded-lg border ${borderColor} ${inputBg} py-2.5 px-4 text-sm ${textColor} focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none`}
                    placeholder="输入报表描述"
                    rows={3}
                  />
                </div>
                <div>
                  <label htmlFor="report-management-form-type" className={`block text-sm font-medium ${textColor} mb-1`}>类型</label>
                  <select
                    id="report-management-form-type"
                    name="type"
                    defaultValue={editingReport?.type || 'custom'}
                    className={`w-full rounded-lg border ${borderColor} ${inputBg} py-2.5 px-4 text-sm ${textColor} focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary`}
                  >
                    <option value="system">系统日志</option>
                    <option value="security">安全审计</option>
                    <option value="performance">性能监控</option>
                    <option value="custom">自定义</option>
                  </select>
                </div>
              </div>
              <div className={`flex justify-end gap-3 px-6 py-4 border-t ${borderColor}`}>
                <button type="button" onClick={closeModal} className={`px-4 py-2 rounded-lg border ${borderColor} ${textSecondary} ${hoverBg} text-sm font-medium`}>
                  取消
                </button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-medium">
                  {editingReport ? '保存' : '创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {showDeleteConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className={`w-full max-w-sm rounded-xl ${modalBg} border ${borderColor} shadow-2xl`}>
            <div className="p-6 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-danger/10 flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-danger text-2xl">warning</span>
              </div>
              <h3 className={`text-lg font-bold ${textColor} mb-2`}>确认删除</h3>
              <p className={`text-sm ${textSecondary}`}>确定要删除这个报表吗？此操作无法撤销。</p>
            </div>
            <div className={`flex gap-3 px-6 py-4 border-t ${borderColor}`}>
              <button onClick={() => setShowDeleteConfirm(null)} className={`flex-1 px-4 py-2 rounded-lg border ${borderColor} ${textSecondary} ${hoverBg} text-sm font-medium`}>
                取消
              </button>
              <button onClick={() => handleDelete(showDeleteConfirm)} className="flex-1 px-4 py-2 rounded-lg bg-danger hover:bg-danger/90 text-white text-sm font-medium">
                删除
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ReportManagement;
