import React, { useState } from 'react';
import { useThemeStore } from '../../stores/themeStore';

interface Ticket {
  id: string;
  title: string;
  priority: 'high' | 'medium' | 'low';
  category: string;
  lastUpdate: string;
  status: 'in_progress' | 'pending' | 'resolved';
}

const initialTickets: Ticket[] = [
  { id: 'TK-2023-8492', title: '日志摄取延迟超过阈值', priority: 'high', category: '数据管道', lastUpdate: '10 分钟前', status: 'in_progress' },
  { id: 'TK-2023-8491', title: '告警规则未能触发邮件通知', priority: 'medium', category: '通知服务', lastUpdate: '2 小时前', status: 'pending' },
  { id: 'TK-2023-8488', title: '查询分析页面加载缓慢', priority: 'low', category: '前端性能', lastUpdate: '昨天', status: 'resolved' },
  { id: 'TK-2023-8480', title: 'Elasticsearch 集群扩容请求', priority: 'medium', category: '基础设施', lastUpdate: '3 天前', status: 'resolved' },
];

const categories = ['数据管道', '通知服务', '前端性能', '基础设施', '账户问题', '其他'];

const getPriorityStyle = (priority: string) => {
  switch (priority) {
    case 'high': return { bg: 'bg-[#ef4444]/10', text: 'text-[#ef4444]', border: 'border-[#ef4444]/20', dot: 'bg-[#ef4444]', label: '高 (High)' };
    case 'medium': return { bg: 'bg-[#f59e0b]/10', text: 'text-[#f59e0b]', border: 'border-[#f59e0b]/20', dot: 'bg-[#f59e0b]', label: '中 (Medium)' };
    case 'low': return { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', dot: 'bg-emerald-400', label: '低 (Low)' };
    default: return { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/20', dot: 'bg-slate-400', label: '未知' };
  }
};

const getStatusStyle = (status: string, isDark: boolean) => {
  switch (status) {
    case 'in_progress': return { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20', label: '进行中' };
    case 'pending': return { bg: 'bg-[#f59e0b]/10', text: 'text-[#f59e0b]', border: 'border-[#f59e0b]/20', label: '待处理' };
    case 'resolved': return { bg: isDark ? 'bg-[#232f48]' : 'bg-slate-100', text: isDark ? 'text-[#94a3b8]' : 'text-slate-600', border: isDark ? 'border-[#334155]' : 'border-slate-200', label: '已解决' };
    default: return { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/20', label: '未知' };
  }
};

const TicketPortal: React.FC = () => {
  const isDark = useThemeStore((s) => s.isDark);
  const [tickets, setTickets] = useState<Ticket[]>(initialTickets);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [newTicket, setNewTicket] = useState({ title: '', description: '', priority: 'medium' as 'high' | 'medium' | 'low', category: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pageBg = isDark ? 'bg-[#0b1121]' : 'bg-slate-50';
  const headerBg = isDark ? 'bg-[#111722]/95' : 'bg-white/95';
  const cardBg = isDark ? 'bg-[#111722]' : 'bg-white';
  const tableBg = isDark ? 'bg-[#111722]' : 'bg-white';
  const tableHeaderBg = isDark ? 'bg-[#1e293b]/50' : 'bg-slate-100';
  const borderColor = isDark ? 'border-[#334155]' : 'border-slate-200';
  const textColor = isDark ? 'text-white' : 'text-slate-900';
  const textSecondary = isDark ? 'text-[#94a3b8]' : 'text-slate-600';
  const inputBg = isDark ? 'bg-[#1e293b]' : 'bg-white';
  const hoverBg = isDark ? 'hover:bg-[#1e293b]' : 'hover:bg-slate-50';
  const iconBg = isDark ? 'bg-[#1e293b]' : 'bg-slate-100';

  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = !searchTerm ||
      ticket.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !statusFilter || ticket.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: tickets.length,
    inProgress: tickets.filter(t => t.status === 'in_progress').length,
    pending: tickets.filter(t => t.status === 'pending').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
  };

  const handleSubmitTicket = async () => {
    if (!newTicket.title || !newTicket.category) return;
    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    const ticket: Ticket = {
      id: `TK-2023-${8493 + tickets.length}`,
      title: newTicket.title,
      priority: newTicket.priority,
      category: newTicket.category,
      lastUpdate: '刚刚',
      status: 'pending'
    };
    setTickets([ticket, ...tickets]);
    setNewTicket({ title: '', description: '', priority: 'medium', category: '' });
    setIsDrawerOpen(false);
    setIsSubmitting(false);
  };

  return (
    <div className={`flex flex-col h-full overflow-hidden ${pageBg} -mx-6 -mt-6 -mb-6 relative`}>
      {/* Top Header */}
      <header className={`flex items-center justify-between px-6 py-5 border-b ${borderColor} ${headerBg} backdrop-blur-md sticky top-0 z-20 shrink-0`}>
        <div className="flex flex-col gap-1">
          <h2 className={`${textColor} text-2xl font-bold leading-tight tracking-tight`}>技术工单</h2>
          <p className={`${textSecondary} text-sm`}>提交并管理您的技术支持请求，我们会尽快响应。</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative hidden sm:block">
            <span className={`absolute left-3 top-1/2 -translate-y-1/2 ${textSecondary} material-symbols-outlined text-lg`}>search</span>
            <input
              className={`h-10 w-64 rounded-lg ${inputBg} border ${borderColor} pl-10 pr-4 text-sm ${textColor} placeholder-[#94a3b8] focus:border-[#135bec] focus:ring-1 focus:ring-[#135bec] outline-none transition-all`}
              placeholder="搜索工单 ID 或标题..."
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button onClick={() => setIsDrawerOpen(true)}
            className="flex items-center gap-2 rounded-lg h-10 px-4 bg-[#135bec] hover:bg-[#1048c0] text-white text-sm font-bold shadow-lg shadow-[#135bec]/20 transition-all active:scale-95">
            <span className="material-symbols-outlined text-lg">add</span>
            <span>新建工单</span>
          </button>
        </div>
      </header>

      {/* Scrollable Content */}
      <main className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-7xl flex flex-col gap-6">
          {/* Stats / Filter Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div onClick={() => setStatusFilter(null)}
              className={`p-4 rounded-xl ${cardBg} border ${statusFilter === null ? 'border-[#135bec]' : borderColor} flex items-center justify-between cursor-pointer hover:border-[#135bec]/50 transition-colors group`}>
              <div className="flex flex-col">
                <span className={`${textSecondary} text-sm font-medium`}>全部工单</span>
                <span className={`${textColor} text-2xl font-bold mt-1`}>{stats.total}</span>
              </div>
              <div className={`w-10 h-10 rounded-full ${iconBg} flex items-center justify-center ${textSecondary} group-hover:bg-[#135bec]/20 group-hover:text-[#135bec] transition-colors`}>
                <span className="material-symbols-outlined">list</span>
              </div>
            </div>
            <div onClick={() => setStatusFilter(statusFilter === 'in_progress' ? null : 'in_progress')}
              className={`p-4 rounded-xl ${cardBg} border ${statusFilter === 'in_progress' ? 'border-blue-500' : borderColor} flex items-center justify-between cursor-pointer hover:border-blue-500/50 transition-colors group`}>
              <div className="flex flex-col">
                <span className="text-blue-400 text-sm font-medium">进行中</span>
                <span className={`${textColor} text-2xl font-bold mt-1`}>{stats.inProgress}</span>
              </div>
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400">
                <span className="material-symbols-outlined">play_circle</span>
              </div>
            </div>
            <div onClick={() => setStatusFilter(statusFilter === 'pending' ? null : 'pending')}
              className={`p-4 rounded-xl ${cardBg} border ${statusFilter === 'pending' ? 'border-[#f59e0b]' : borderColor} flex items-center justify-between cursor-pointer hover:border-[#f59e0b]/50 transition-colors group`}>
              <div className="flex flex-col">
                <span className="text-[#f59e0b] text-sm font-medium">待处理</span>
                <span className={`${textColor} text-2xl font-bold mt-1`}>{stats.pending}</span>
              </div>
              <div className="w-10 h-10 rounded-full bg-[#f59e0b]/10 flex items-center justify-center text-[#f59e0b]">
                <span className="material-symbols-outlined">pause_circle</span>
              </div>
            </div>
            <div onClick={() => setStatusFilter(statusFilter === 'resolved' ? null : 'resolved')}
              className={`p-4 rounded-xl ${cardBg} border ${statusFilter === 'resolved' ? 'border-[#10b981]' : borderColor} flex items-center justify-between cursor-pointer hover:border-[#10b981]/50 transition-colors group`}>
              <div className="flex flex-col">
                <span className="text-emerald-400 text-sm font-medium">已解决</span>
                <span className={`${textColor} text-2xl font-bold mt-1`}>{stats.resolved}</span>
              </div>
              <div className="w-10 h-10 rounded-full bg-[#10b981]/10 flex items-center justify-center text-emerald-400">
                <span className="material-symbols-outlined">check_circle</span>
              </div>
            </div>
          </div>

          {/* Ticket Table */}
          <div className={`rounded-xl border ${borderColor} ${tableBg} overflow-hidden flex flex-col`}>
            <div className={`px-6 py-4 border-b ${borderColor} flex items-center justify-between`}>
              <h3 className={`${textColor} font-bold text-lg`}>
                最近工单
                {statusFilter && <span className={`ml-2 text-sm font-normal ${textSecondary}`}>({getStatusStyle(statusFilter, isDark).label})</span>}
              </h3>
              <div className="flex items-center gap-2">
                <button className={`flex items-center gap-1 ${textSecondary} ${isDark ? 'hover:text-white' : 'hover:text-slate-900'} text-sm px-3 py-1.5 rounded-lg ${hoverBg} transition-colors`}>
                  <span className="material-symbols-outlined text-lg">filter_list</span><span>筛选</span>
                </button>
                <button className={`flex items-center gap-1 ${textSecondary} ${isDark ? 'hover:text-white' : 'hover:text-slate-900'} text-sm px-3 py-1.5 rounded-lg ${hoverBg} transition-colors`}>
                  <span className="material-symbols-outlined text-lg">download</span><span>导出</span>
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className={`${tableHeaderBg} ${textSecondary} text-xs uppercase tracking-wider border-b ${borderColor}`}>
                    <th className="px-6 py-3 font-semibold w-1/3">工单信息</th>
                    <th className="px-6 py-3 font-semibold">优先级</th>
                    <th className="px-6 py-3 font-semibold">分类</th>
                    <th className="px-6 py-3 font-semibold">最后更新</th>
                    <th className="px-6 py-3 font-semibold">状态</th>
                    <th className="px-6 py-3 font-semibold text-right">操作</th>
                  </tr>
                </thead>
                <tbody className={`text-sm divide-y ${isDark ? 'divide-[#334155]' : 'divide-slate-200'}`}>
                  {filteredTickets.length === 0 ? (
                    <tr>
                      <td colSpan={6} className={`px-6 py-12 text-center ${textSecondary}`}>
                        <span className="material-symbols-outlined text-4xl mb-2 block">inbox</span>
                        没有找到匹配的工单
                      </td>
                    </tr>
                  ) : (
                    filteredTickets.map((ticket) => {
                      const priorityStyle = getPriorityStyle(ticket.priority);
                      const statusStyle = getStatusStyle(ticket.status, isDark);
                      return (
                        <tr key={ticket.id} className={`group ${hoverBg} transition-colors`}>
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1">
                              <span className={`${textColor} font-medium group-hover:text-[#135bec] transition-colors`}>{ticket.title}</span>
                              <span className={`${textSecondary} text-xs`}>ID: #{ticket.id}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${priorityStyle.bg} ${priorityStyle.text} border ${priorityStyle.border}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${priorityStyle.dot}`}></span>
                              {priorityStyle.label}
                            </span>
                          </td>
                          <td className={`px-6 py-4 ${textSecondary}`}>{ticket.category}</td>
                          <td className={`px-6 py-4 ${textSecondary}`}>{ticket.lastUpdate}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusStyle.bg} ${statusStyle.text} border ${statusStyle.border}`}>
                              {statusStyle.label}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button className={`${textSecondary} ${isDark ? 'hover:text-white hover:bg-[#232f48]' : 'hover:text-slate-900 hover:bg-slate-100'} p-1 rounded`}>
                              <span className="material-symbols-outlined">more_horiz</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            <div className={`px-6 py-4 border-t ${borderColor} flex items-center justify-between`}>
              <span className={`text-sm ${textSecondary}`}>显示 1 到 {filteredTickets.length} 条，共 {filteredTickets.length} 条</span>
              <div className="flex gap-2">
                <button className={`w-8 h-8 flex items-center justify-center rounded-lg border ${borderColor} ${textSecondary} ${hoverBg} ${isDark ? 'hover:text-white' : 'hover:text-slate-900'} disabled:opacity-50`}>
                  <span className="material-symbols-outlined text-sm">chevron_left</span>
                </button>
                <button className={`w-8 h-8 flex items-center justify-center rounded-lg border ${borderColor} bg-[#135bec] text-white`}>1</button>
                <button className={`w-8 h-8 flex items-center justify-center rounded-lg border ${borderColor} ${textSecondary} ${hoverBg} ${isDark ? 'hover:text-white' : 'hover:text-slate-900'}`}>
                  <span className="material-symbols-outlined text-sm">chevron_right</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* New Ticket Drawer */}
      {isDrawerOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setIsDrawerOpen(false)} />
          <div className={`fixed inset-y-0 right-0 w-full sm:w-[500px] ${cardBg} shadow-2xl shadow-black border-l ${borderColor} z-50 flex flex-col`}>
            <div className={`flex items-center justify-between px-6 py-4 border-b ${borderColor}`}>
              <h3 className={`${textColor} text-lg font-bold`}>新建工单</h3>
              <button onClick={() => setIsDrawerOpen(false)}
                className={`${textSecondary} ${isDark ? 'hover:text-white' : 'hover:text-slate-900'} p-1 rounded-lg ${hoverBg}`}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div>
                <label className={`block text-sm font-medium ${textColor} mb-2`}>工单标题 <span className="text-[#ef4444]">*</span></label>
                <input type="text" value={newTicket.title}
                  onChange={(e) => setNewTicket({ ...newTicket, title: e.target.value })}
                  className={`w-full h-10 rounded-lg ${inputBg} border ${borderColor} px-4 text-sm ${textColor} placeholder-[#94a3b8] focus:border-[#135bec] focus:ring-1 focus:ring-[#135bec] outline-none transition-all`}
                  placeholder="简要描述您遇到的问题" />
              </div>
              <div>
                <label className={`block text-sm font-medium ${textColor} mb-2`}>问题分类 <span className="text-[#ef4444]">*</span></label>
                <select value={newTicket.category}
                  onChange={(e) => setNewTicket({ ...newTicket, category: e.target.value })}
                  className={`w-full h-10 rounded-lg ${inputBg} border ${borderColor} px-4 text-sm ${textColor} focus:border-[#135bec] focus:ring-1 focus:ring-[#135bec] outline-none transition-all`}>
                  <option value="">请选择分类</option>
                  {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div>
                <label className={`block text-sm font-medium ${textColor} mb-2`}>优先级</label>
                <div className="flex gap-3">
                  {(['low', 'medium', 'high'] as const).map((priority) => {
                    const style = getPriorityStyle(priority);
                    return (
                      <button key={priority} onClick={() => setNewTicket({ ...newTicket, priority })}
                        className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-all ${
                          newTicket.priority === priority
                            ? `${style.bg} ${style.text} ${style.border}`
                            : `${isDark ? 'bg-[#1e293b] border-[#334155]' : 'bg-white border-slate-200'} ${textSecondary} hover:border-[#135bec]/50`
                        }`}>
                        {style.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className={`block text-sm font-medium ${textColor} mb-2`}>详细描述</label>
                <textarea value={newTicket.description}
                  onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                  rows={6}
                  className={`w-full rounded-lg ${inputBg} border ${borderColor} px-4 py-3 text-sm ${textColor} placeholder-[#94a3b8] focus:border-[#135bec] focus:ring-1 focus:ring-[#135bec] outline-none transition-all resize-none`}
                  placeholder={'请详细描述您遇到的问题，包括：\n- 问题发生的时间\n- 具体的错误信息\n- 已尝试的解决方法'} />
              </div>
              <div className={`p-4 rounded-lg ${isDark ? 'bg-[#1e293b]' : 'bg-slate-100'} border ${borderColor}`}>
                <div className="flex items-center gap-3">
                  <span className={`material-symbols-outlined ${textSecondary}`}>attach_file</span>
                  <div>
                    <p className={`text-sm ${textColor}`}>附件上传</p>
                    <p className={`text-xs ${textSecondary}`}>支持截图、日志文件等（最大 10MB）</p>
                  </div>
                </div>
              </div>
            </div>
            <div className={`px-6 py-4 border-t ${borderColor} flex items-center justify-end gap-3`}>
              <button onClick={() => setIsDrawerOpen(false)}
                className={`px-4 py-2 rounded-lg border ${borderColor} ${textSecondary} ${hoverBg} text-sm font-medium transition-all`}>
                取消
              </button>
              <button onClick={handleSubmitTicket}
                disabled={!newTicket.title || !newTicket.category || isSubmitting}
                className="px-4 py-2 rounded-lg bg-[#135bec] hover:bg-[#1048c0] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold shadow-lg shadow-[#135bec]/20 transition-all flex items-center gap-2">
                {isSubmitting ? (
                  <><span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>提交中...</>
                ) : (
                  <><span className="material-symbols-outlined text-lg">send</span>提交工单</>
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default TicketPortal;
