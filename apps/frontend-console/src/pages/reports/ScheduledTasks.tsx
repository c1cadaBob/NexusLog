import React, { useState, useMemo } from 'react';
import { useThemeStore } from '../../stores/themeStore';

// 定时任务类型定义
interface ScheduledTask {
  id: string;
  name: string;
  reportName: string;
  reportId: string;
  frequency: string;
  frequencyIcon: string;
  channels: Array<{ type: 'email' | 'dingtalk' | 'webhook'; icon: string }>;
  lastResult: 'success' | 'failed' | 'pending';
  nextRun: string;
  remainingTime: string;
  enabled: boolean;
  iconBg: string;
  iconColor: string;
  icon: string;
}

// 模拟任务数据
const mockTasks: ScheduledTask[] = [
  {
    id: 'Task-001',
    name: '每周安全审计报告',
    reportName: '安全日志汇总_v2',
    reportId: 'RPT-001',
    frequency: '每周一 08:00',
    frequencyIcon: 'calendar_month',
    channels: [
      { type: 'email', icon: 'mail' },
      { type: 'dingtalk', icon: 'notifications_active' },
    ],
    lastResult: 'success',
    nextRun: '2023-10-30 08:00',
    remainingTime: '剩余 2 天',
    enabled: true,
    iconBg: 'bg-primary/20',
    iconColor: 'text-primary',
    icon: 'shield',
  },
  {
    id: 'Task-002',
    name: '每日流量分析',
    reportName: '流量监控报表_Main',
    reportId: 'RPT-002',
    frequency: '每天 00:00',
    frequencyIcon: 'update',
    channels: [{ type: 'email', icon: 'mail' }],
    lastResult: 'failed',
    nextRun: '2023-10-24 00:00',
    remainingTime: '已逾期',
    enabled: false,
    iconBg: 'bg-purple-500/20',
    iconColor: 'text-purple-400',
    icon: 'monitoring',
  },
  {
    id: 'Task-005',
    name: '月度系统性能',
    reportName: '性能指标统计_Oct',
    reportId: 'RPT-003',
    frequency: '每月 1日 02:00',
    frequencyIcon: 'event_repeat',
    channels: [{ type: 'dingtalk', icon: 'notifications_active' }],
    lastResult: 'success',
    nextRun: '2023-11-01 02:00',
    remainingTime: '剩余 5 天',
    enabled: true,
    iconBg: 'bg-cyan-500/20',
    iconColor: 'text-cyan-400',
    icon: 'speed',
  },
  {
    id: 'Task-008',
    name: '异常登录监控',
    reportName: '登录行为分析_Realtime',
    reportId: 'RPT-004',
    frequency: '每小时',
    frequencyIcon: 'hourglass_empty',
    channels: [
      { type: 'email', icon: 'mail' },
      { type: 'dingtalk', icon: 'notifications_active' },
      { type: 'webhook', icon: 'webhook' },
    ],
    lastResult: 'success',
    nextRun: '2023-10-24 14:00',
    remainingTime: '立即执行',
    enabled: false,
    iconBg: 'bg-orange-500/20',
    iconColor: 'text-orange-400',
    icon: 'warning',
  },
  {
    id: 'Task-012',
    name: '数据库备份检查',
    reportName: 'DB状态报告_Full',
    reportId: 'RPT-005',
    frequency: '每天 03:00',
    frequencyIcon: 'alarm',
    channels: [{ type: 'email', icon: 'mail' }],
    lastResult: 'success',
    nextRun: '2023-10-25 03:00',
    remainingTime: '剩余 12 小时',
    enabled: true,
    iconBg: 'bg-indigo-500/20',
    iconColor: 'text-indigo-400',
    icon: 'database',
  },
];

const ScheduledTasks: React.FC = () => {
  const { isDark } = useThemeStore();

  // 状态管理
  const [tasks, setTasks] = useState<ScheduledTask[]>(mockTasks);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'running' | 'paused'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<ScheduledTask | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  // 主题样式
  const headerBg = isDark ? 'bg-[#111722]/50' : 'bg-white/95';
  const cardBg = isDark ? 'bg-[#1e293b]' : 'bg-white';
  const inputBg = isDark ? 'bg-[#1e293b]' : 'bg-white';
  const borderColor = isDark ? 'border-border-dark' : 'border-slate-200';
  const textColor = isDark ? 'text-white' : 'text-slate-900';
  const textSecondary = isDark ? 'text-text-secondary' : 'text-slate-600';
  const hoverBg = isDark ? 'hover:bg-[#232f48]' : 'hover:bg-slate-50';
  const tableHeaderBg = isDark ? 'bg-[#1a2332]' : 'bg-slate-100';
  const frequencyBg = isDark ? 'bg-[#232f48]' : 'bg-slate-100';
  const pageBg = isDark ? 'bg-background-dark' : 'bg-slate-50';
  const modalBg = isDark ? 'bg-[#1e293b]' : 'bg-white';

  // 统计数据
  const stats = useMemo(() => ({
    total: tasks.length,
    successToday: tasks.filter(t => t.lastResult === 'success').length,
    failed: tasks.filter(t => t.lastResult === 'failed').length,
    upcoming: tasks.filter(t => t.enabled && t.lastResult !== 'failed').length,
  }), [tasks]);

  // 过滤任务
  const filteredTasks = useMemo(() => {
    let result = [...tasks];
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(t => t.name.toLowerCase().includes(query));
    }
    if (statusFilter === 'running') {
      result = result.filter(t => t.enabled);
    } else if (statusFilter === 'paused') {
      result = result.filter(t => !t.enabled);
    }
    return result;
  }, [tasks, searchQuery, statusFilter]);

  // 切换启用状态
  const handleToggle = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, enabled: !t.enabled } : t));
  };

  // 创建任务
  const handleCreate = () => { setEditingTask(null); setShowModal(true); };

  // 编辑任务
  const handleEdit = (task: ScheduledTask) => { setEditingTask(task); setShowModal(true); };

  // 删除任务
  const handleDelete = (id: string) => { setTasks(prev => prev.filter(t => t.id !== id)); setShowDeleteConfirm(null); };

  // 保存任务
  const handleSave = (data: Partial<ScheduledTask>) => {
    if (editingTask) {
      setTasks(prev => prev.map(t => t.id === editingTask.id ? { ...t, ...data } : t));
    } else {
      const newTask: ScheduledTask = {
        id: `Task-${String(tasks.length + 1).padStart(3, '0')}`,
        name: data.name || '新任务',
        reportName: data.reportName || '未选择报表',
        reportId: data.reportId || '',
        frequency: data.frequency || '每天 00:00',
        frequencyIcon: 'schedule',
        channels: [{ type: 'email', icon: 'mail' }],
        lastResult: 'pending',
        nextRun: new Date().toISOString().split('T')[0] + ' 00:00',
        remainingTime: '待执行',
        enabled: true,
        iconBg: 'bg-blue-500/20',
        iconColor: 'text-blue-400',
        icon: 'schedule',
      };
      setTasks(prev => [...prev, newTask]);
    }
    setShowModal(false);
  };

  return (
    <div className={`flex flex-col h-full overflow-hidden ${pageBg}`}>
      {/* Header */}
      <header className={`h-16 border-b ${borderColor} ${headerBg} backdrop-blur-sm px-8 flex items-center justify-between shrink-0 -mx-6 -mt-6`}>
        <div className="flex flex-col">
          <h1 className={`${textColor} text-lg font-display font-semibold leading-tight`}>定时任务管理</h1>
          <p className={`${textSecondary} text-xs font-normal`}>管理和监控自动生成的报表任务</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary text-lg">search</span>
            <input
              className={`h-9 w-64 rounded-lg ${inputBg} border ${borderColor} pl-10 pr-4 text-sm ${textColor} placeholder-text-secondary focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all`}
              placeholder="搜索任务名称..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 h-9 px-4 bg-primary hover:bg-primary-hover text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-primary/20"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            <span>新建任务</span>
          </button>
        </div>
      </header>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto pt-6 pb-8">
        <div className="max-w-[1400px] mx-auto flex flex-col gap-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className={`${cardBg} border ${borderColor} rounded-xl p-4 flex items-center gap-4`}>
              <div className="p-3 bg-blue-500/10 rounded-lg text-blue-500">
                <span className="material-symbols-outlined">schedule</span>
              </div>
              <div>
                <p className={`${textSecondary} text-xs`}>总任务数</p>
                <p className={`text-2xl font-display font-bold ${textColor}`}>{stats.total}</p>
              </div>
            </div>
            <div className={`${cardBg} border ${borderColor} rounded-xl p-4 flex items-center gap-4`}>
              <div className="p-3 bg-emerald-500/10 rounded-lg text-emerald-500">
                <span className="material-symbols-outlined">check_circle</span>
              </div>
              <div>
                <p className={`${textSecondary} text-xs`}>执行成功</p>
                <p className={`text-2xl font-display font-bold ${textColor}`}>{stats.successToday}</p>
              </div>
            </div>
            <div className={`${cardBg} border ${borderColor} rounded-xl p-4 flex items-center gap-4`}>
              <div className="p-3 bg-rose-500/10 rounded-lg text-rose-500">
                <span className="material-symbols-outlined">error</span>
              </div>
              <div>
                <p className={`${textSecondary} text-xs`}>执行失败</p>
                <p className={`text-2xl font-display font-bold ${textColor}`}>{stats.failed}</p>
              </div>
            </div>
            <div className={`${cardBg} border ${borderColor} rounded-xl p-4 flex items-center gap-4`}>
              <div className="p-3 bg-purple-500/10 rounded-lg text-purple-500">
                <span className="material-symbols-outlined">update</span>
              </div>
              <div>
                <p className={`${textSecondary} text-xs`}>即将执行</p>
                <p className={`text-2xl font-display font-bold ${textColor}`}>{stats.upcoming}</p>
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className={`flex flex-col overflow-hidden rounded-xl border ${borderColor} ${cardBg} shadow-sm`}>
            {/* Table Filters */}
            <div className={`flex items-center justify-between p-4 border-b ${borderColor} ${cardBg}`}>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md ${statusFilter === 'all' ? 'bg-primary/10 text-primary border border-primary/20' : `bg-transparent ${textSecondary} ${hoverBg} border border-transparent`}`}
                >
                  全部 ({tasks.length})
                </button>
                <button
                  onClick={() => setStatusFilter('running')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md ${statusFilter === 'running' ? 'bg-primary/10 text-primary border border-primary/20' : `bg-transparent ${textSecondary} ${hoverBg} border border-transparent`}`}
                >
                  运行中 ({tasks.filter(t => t.enabled).length})
                </button>
                <button
                  onClick={() => setStatusFilter('paused')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md ${statusFilter === 'paused' ? 'bg-primary/10 text-primary border border-primary/20' : `bg-transparent ${textSecondary} ${hoverBg} border border-transparent`}`}
                >
                  已暂停 ({tasks.filter(t => !t.enabled).length})
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button className={`p-1.5 ${textSecondary} ${isDark ? 'hover:text-white' : 'hover:text-slate-900'} ${hoverBg} rounded-md transition-colors`}>
                  <span className="material-symbols-outlined text-xl">refresh</span>
                </button>
              </div>
            </div>
            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className={`${tableHeaderBg} text-xs uppercase ${textSecondary}`}>
                  <tr>
                    <th className="px-6 py-4 font-semibold tracking-wider w-64">任务名称</th>
                    <th className="px-6 py-4 font-semibold tracking-wider">关联报表</th>
                    <th className="px-6 py-4 font-semibold tracking-wider">执行频率</th>
                    <th className="px-6 py-4 font-semibold tracking-wider">通知渠道</th>
                    <th className="px-6 py-4 font-semibold tracking-wider">上次运行结果</th>
                    <th className="px-6 py-4 font-semibold tracking-wider">下次执行时间</th>
                    <th className="px-6 py-4 font-semibold tracking-wider text-right">启用</th>
                    <th className="px-6 py-4 font-semibold tracking-wider w-16"></th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-border-dark' : 'divide-slate-200'} text-sm`}>
                  {filteredTasks.map((task) => (
                    <tr key={task.id} className={`group ${hoverBg} transition-colors`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`h-8 w-8 rounded ${task.iconBg} flex items-center justify-center ${task.iconColor}`}>
                            <span className="material-symbols-outlined text-lg">{task.icon}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className={`font-medium ${textColor}`}>{task.name}</span>
                            <span className={`text-xs ${textSecondary}`}>ID: {task.id}</span>
                          </div>
                        </div>
                      </td>
                      <td className={`px-6 py-4 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                        <a className="hover:text-primary underline decoration-slate-600 underline-offset-4 hover:decoration-primary transition-all" href="#">{task.reportName}</a>
                      </td>
                      <td className="px-6 py-4">
                        <div className={`flex items-center gap-1.5 ${isDark ? 'text-slate-300' : 'text-slate-600'} ${frequencyBg} px-2 py-1 rounded w-fit`}>
                          <span className={`material-symbols-outlined text-xs ${textSecondary}`}>{task.frequencyIcon}</span>
                          <span className="text-xs font-medium">{task.frequency}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex -space-x-2">
                          {task.channels.slice(0, 2).map((channel, idx) => (
                            <div key={idx} className={`flex h-8 w-8 items-center justify-center rounded-full ${channel.type === 'dingtalk' ? (isDark ? 'bg-blue-900/50' : 'bg-blue-100') : (isDark ? 'bg-slate-700' : 'bg-slate-200')} ring-2 ${isDark ? 'ring-[#1e293b]' : 'ring-white'}`}>
                              <span className={`material-symbols-outlined text-sm ${channel.type === 'dingtalk' ? (isDark ? 'text-blue-400' : 'text-blue-600') : (isDark ? 'text-slate-300' : 'text-slate-600')}`}>{channel.icon}</span>
                            </div>
                          ))}
                          {task.channels.length > 2 && (
                            <div className={`flex h-8 w-8 items-center justify-center rounded-full ${isDark ? 'bg-[#111722]' : 'bg-slate-100'} ring-2 ${isDark ? 'ring-[#1e293b]' : 'ring-white'} text-xs ${textSecondary} font-medium`}>
                              +{task.channels.length - 2}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border ${
                          task.lastResult === 'success'
                            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                            : task.lastResult === 'failed'
                            ? 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                            : 'bg-gray-500/10 text-gray-500 border-gray-500/20'
                        }`}>
                          {task.lastResult === 'success' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>}
                          {task.lastResult === 'failed' && <span className="material-symbols-outlined text-sm">error</span>}
                          {task.lastResult === 'success' ? '成功' : task.lastResult === 'failed' ? '失败' : '待执行'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className={isDark ? 'text-slate-300' : 'text-slate-600'}>{task.nextRun}</span>
                          <span className={`text-xs ${task.remainingTime === '已逾期' ? 'text-rose-400 font-medium' : task.remainingTime === '立即执行' ? 'text-primary cursor-pointer hover:underline' : textSecondary}`}>
                            {task.remainingTime}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={task.enabled}
                            onChange={() => handleToggle(task.id)}
                          />
                          <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => handleEdit(task)}
                            className={`${textSecondary} ${isDark ? 'hover:text-white' : 'hover:text-slate-900'} p-1 rounded ${hoverBg} transition-colors`}
                            title="编辑"
                          >
                            <span className="material-symbols-outlined text-lg">edit</span>
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(task.id)}
                            className="text-danger/70 hover:text-danger p-1 rounded hover:bg-danger/10 transition-colors"
                            title="删除"
                          >
                            <span className="material-symbols-outlined text-lg">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Footer / Pagination */}
            <div className={`flex items-center justify-between px-6 py-4 border-t ${borderColor} ${cardBg}`}>
              <div className={`text-sm ${textSecondary}`}>
                显示 1 到 {filteredTasks.length} 条，共 {tasks.length} 条记录
              </div>
              <div className="flex items-center gap-2">
                <button className={`p-2 rounded-lg ${hoverBg} ${textSecondary} disabled:opacity-50 disabled:cursor-not-allowed`}>
                  <span className="material-symbols-outlined text-lg">chevron_left</span>
                </button>
                <button className="h-8 w-8 rounded-lg bg-primary text-white text-sm font-medium flex items-center justify-center">1</button>
                <button className={`p-2 rounded-lg ${hoverBg} ${textSecondary} transition-colors`}>
                  <span className="material-symbols-outlined text-lg">chevron_right</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className={`w-full max-w-lg rounded-xl ${modalBg} border ${borderColor} shadow-2xl`}>
            <div className={`flex items-center justify-between px-6 py-4 border-b ${borderColor}`}>
              <h2 className={`text-lg font-bold ${textColor}`}>
                {editingTask ? '编辑任务' : '创建任务'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className={`p-1 rounded-md ${hoverBg} ${textSecondary}`}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              handleSave({
                name: formData.get('name') as string,
                reportName: formData.get('reportName') as string,
                frequency: formData.get('frequency') as string,
              });
            }}>
              <div className="p-6 space-y-4">
                <div>
                  <label className={`block text-sm font-medium ${textColor} mb-1`}>任务名称</label>
                  <input
                    name="name"
                    defaultValue={editingTask?.name || ''}
                    className={`w-full rounded-lg border ${borderColor} ${inputBg} py-2.5 px-4 text-sm ${textColor} focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary`}
                    placeholder="输入任务名称"
                    required
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${textColor} mb-1`}>关联报表</label>
                  <input
                    name="reportName"
                    defaultValue={editingTask?.reportName || ''}
                    className={`w-full rounded-lg border ${borderColor} ${inputBg} py-2.5 px-4 text-sm ${textColor} focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary`}
                    placeholder="选择关联报表"
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${textColor} mb-1`}>执行频率</label>
                  <select
                    name="frequency"
                    defaultValue={editingTask?.frequency || '每天 00:00'}
                    className={`w-full rounded-lg border ${borderColor} ${inputBg} py-2.5 px-4 text-sm ${textColor} focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary`}
                  >
                    <option value="每小时">每小时</option>
                    <option value="每天 00:00">每天 00:00</option>
                    <option value="每天 08:00">每天 08:00</option>
                    <option value="每周一 08:00">每周一 08:00</option>
                    <option value="每月 1日 02:00">每月 1日 02:00</option>
                  </select>
                </div>
              </div>
              <div className={`flex justify-end gap-3 px-6 py-4 border-t ${borderColor}`}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className={`px-4 py-2 rounded-lg border ${borderColor} ${textSecondary} ${hoverBg} text-sm font-medium transition-colors`}
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors"
                >
                  {editingTask ? '保存' : '创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className={`w-full max-w-sm rounded-xl ${modalBg} border ${borderColor} shadow-2xl`}>
            <div className="p-6 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-danger/10 flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-danger text-2xl">warning</span>
              </div>
              <h3 className={`text-lg font-bold ${textColor} mb-2`}>确认删除</h3>
              <p className={`text-sm ${textSecondary}`}>
                确定要删除这个定时任务吗？此操作无法撤销。
              </p>
            </div>
            <div className={`flex gap-3 px-6 py-4 border-t ${borderColor}`}>
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className={`flex-1 px-4 py-2 rounded-lg border ${borderColor} ${textSecondary} ${hoverBg} text-sm font-medium transition-colors`}
              >
                取消
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                className="flex-1 px-4 py-2 rounded-lg bg-danger hover:bg-danger/90 text-white text-sm font-medium transition-colors"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScheduledTasks;
