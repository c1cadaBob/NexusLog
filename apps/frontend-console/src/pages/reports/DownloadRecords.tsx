import React, { useState, useMemo } from 'react';
import { useThemeStore } from '../../stores/themeStore';

interface DownloadRecord {
  id: string; fileName: string; description: string; format: 'excel' | 'pdf' | 'csv' | 'zip';
  size: string; createdDate: string; createdTime: string; status: 'ready' | 'expiring' | 'expired'; expiresIn?: string;
}

const mockRecords: DownloadRecord[] = [
  { id: 'DL-001', fileName: 'System_Audit_Log_2023Q4.xlsx', description: '安全审计报表', format: 'excel', size: '2.4 MB', createdDate: '2023-10-24', createdTime: '14:30:05', status: 'ready' },
  { id: 'DL-002', fileName: 'User_Access_History_Oct.pdf', description: '访问日志报表', format: 'pdf', size: '8.1 MB', createdDate: '2023-10-24', createdTime: '10:15:22', status: 'ready' },
  { id: 'DL-003', fileName: 'Performance_Metrics_Sept.csv', description: '性能监控报表', format: 'csv', size: '156 KB', createdDate: '2023-10-18', createdTime: '09:00:00', status: 'expiring', expiresIn: '剩余 12 小时' },
  { id: 'DL-004', fileName: 'Error_Logs_Archive_Q3.zip', description: '系统错误归档', format: 'zip', size: '45.2 MB', createdDate: '2023-10-10', createdTime: '11:20:45', status: 'expired' },
  { id: 'DL-005', fileName: 'Network_Traffic_Analysis.xlsx', description: '网络流量分析', format: 'excel', size: '5.6 MB', createdDate: '2023-10-23', createdTime: '08:45:10', status: 'ready' },
];

const formatConfig: Record<DownloadRecord['format'], { label: string; bgClass: string; textClass: string; icon: string }> = {
  excel: { label: 'EXCEL', bgClass: 'bg-emerald-900/30', textClass: 'text-emerald-300', icon: 'table_view' },
  pdf: { label: 'PDF', bgClass: 'bg-red-900/30', textClass: 'text-red-300', icon: 'picture_as_pdf' },
  csv: { label: 'CSV', bgClass: 'bg-blue-900/30', textClass: 'text-blue-300', icon: 'description' },
  zip: { label: 'ZIP', bgClass: 'bg-gray-700', textClass: 'text-gray-300', icon: 'folder_zip' },
};

const DownloadRecords: React.FC = () => {
  const { isDark } = useThemeStore();
  const [records, setRecords] = useState<DownloadRecord[]>(mockRecords);
  const [searchQuery, setSearchQuery] = useState('');
  const [formatFilter, setFormatFilter] = useState<string>('all');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

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

  const filteredRecords = useMemo(() => {
    let r = [...records];
    if (searchQuery) r = r.filter(rec => rec.fileName.toLowerCase().includes(searchQuery.toLowerCase()));
    if (formatFilter !== 'all') r = r.filter(rec => rec.format === formatFilter);
    return r;
  }, [records, searchQuery, formatFilter]);

  const handleDownload = (record: DownloadRecord) => { if (record.status !== 'expired') console.log(`下载文件: ${record.fileName}`); };
  const handleDelete = (id: string) => { setRecords(prev => prev.filter(r => r.id !== id)); setShowDeleteConfirm(null); };
  const handleRefresh = () => { setRecords([...mockRecords]); };
  const getStatusStyle = (status: DownloadRecord['status']) => {
    if (status === 'ready') return { dot: 'bg-emerald-500', text: 'text-emerald-400', label: '可下载', animate: true };
    if (status === 'expiring') return { dot: 'bg-amber-500', text: 'text-amber-400', label: '即将过期', animate: false };
    return { dot: isDark ? 'bg-gray-400' : 'bg-slate-400', text: isDark ? 'text-slate-400' : 'text-slate-500', label: '已过期', animate: false };
  };

  return (
    <div className={`flex flex-col h-full overflow-hidden ${pageBg}`}>
      <header className={`w-full px-8 py-6 border-b ${borderColor} ${headerBg} shrink-0 z-10 -mx-6 -mt-6`}>
        <div className="flex flex-col gap-1 mb-6">
          <div className="flex items-center justify-between">
            <h1 className={`text-2xl md:text-3xl font-bold ${textColor} tracking-tight`}>下载记录</h1>
            <button onClick={handleRefresh} className={`flex items-center gap-2 px-4 py-2 ${buttonBg} ${buttonHoverBg} ${textColor} text-sm font-medium rounded-lg`}>
              <span className="material-symbols-outlined text-[20px]">refresh</span>刷新列表
            </button>
          </div>
          <div className={`flex items-center gap-2 text-sm ${textSecondary}`}><span className="material-symbols-outlined text-[18px]">info</span><p>系统将自动清理生成超过 7 天的文件</p></div>
        </div>
        <div className={`flex flex-wrap items-center gap-4 ${filterBg} p-1.5 rounded-xl`}>
          <div className="relative group flex-1 min-w-[200px]">
            <span className={`absolute left-3 top-1/2 -translate-y-1/2 ${textSecondary} group-focus-within:text-primary material-symbols-outlined`}>search</span>
            <input className={`w-full h-10 pl-10 pr-4 ${inputBg} border-none rounded-lg text-sm ${textColor} focus:ring-2 focus:ring-primary placeholder-text-secondary shadow-sm`} placeholder="搜索文件名..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <div className={`h-6 w-px ${isDark ? 'bg-[#2d3748]' : 'bg-slate-300'}`}></div>
          <div className="relative min-w-[140px]">
            <select className={`w-full h-10 pl-3 pr-8 ${inputBg} border-none rounded-lg text-sm ${textColor} focus:ring-2 focus:ring-primary appearance-none cursor-pointer shadow-sm`} value={formatFilter} onChange={(e) => setFormatFilter(e.target.value)}>
              <option value="all">所有格式</option><option value="pdf">PDF 文档</option><option value="excel">Excel 表格</option><option value="csv">CSV 数据</option><option value="zip">ZIP 压缩包</option>
            </select>
            <span className={`absolute right-2 top-1/2 -translate-y-1/2 ${textSecondary} pointer-events-none material-symbols-outlined text-[20px]`}>expand_more</span>
          </div>
          <div className="relative min-w-[160px]">
            <div className={`flex items-center w-full h-10 px-3 ${inputBg} rounded-lg text-sm ${textColor} cursor-pointer shadow-sm hover:ring-2 hover:ring-primary/50`}>
              <span className={`material-symbols-outlined ${textSecondary} mr-2 text-[20px]`}>calendar_today</span><span className="flex-1 truncate">最近 30 天</span><span className={`material-symbols-outlined ${textSecondary} ml-2 text-[20px]`}>expand_more</span>
            </div>
          </div>
          <button className="h-10 px-6 bg-primary hover:bg-primary-hover text-white text-sm font-medium rounded-lg shadow-lg shadow-primary/20 flex items-center gap-2"><span className="material-symbols-outlined text-[20px]">filter_list</span>筛选</button>
        </div>
      </header>

      <main className="flex-1 overflow-auto pt-4">
        <div className={`w-full ${cardBg} rounded-xl border ${borderColor} shadow-sm overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className={`${tableHeaderBg} border-b ${borderColor}`}>
                  <th className={`py-4 px-6 text-xs font-semibold ${textSecondary} uppercase tracking-wider w-[35%]`}>文件名</th>
                  <th className={`py-4 px-6 text-xs font-semibold ${textSecondary} uppercase tracking-wider`}>格式</th>
                  <th className={`py-4 px-6 text-xs font-semibold ${textSecondary} uppercase tracking-wider`}>大小</th>
                  <th className={`py-4 px-6 text-xs font-semibold ${textSecondary} uppercase tracking-wider`}>生成时间</th>
                  <th className={`py-4 px-6 text-xs font-semibold ${textSecondary} uppercase tracking-wider`}>状态</th>
                  <th className={`py-4 px-6 text-xs font-semibold ${textSecondary} uppercase tracking-wider text-right`}>操作</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-[#2d3748]' : 'divide-slate-200'}`}>
                {filteredRecords.map((record) => {
                  const format = formatConfig[record.format];
                  const status = getStatusStyle(record.status);
                  const isExpired = record.status === 'expired';
                  return (
                    <tr key={record.id} className={`group ${hoverBg} transition-colors ${isExpired ? 'opacity-60 hover:opacity-100' : ''}`}>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${isExpired ? (isDark ? 'bg-gray-800 text-gray-500' : 'bg-slate-200 text-slate-400') : format.bgClass} ${isExpired ? '' : format.textClass}`}>
                            <span className="material-symbols-outlined">{isExpired ? 'folder_off' : format.icon}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className={`text-sm font-medium ${isExpired ? (isDark ? 'text-slate-400' : 'text-slate-500') : textColor}`}>{record.fileName}</span>
                            <span className={`text-xs ${isExpired ? (isDark ? 'text-slate-500' : 'text-slate-400') : textSecondary}`}>{record.description}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6"><span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${isExpired ? (isDark ? 'bg-gray-700 text-gray-300' : 'bg-slate-200 text-slate-500') : `${format.bgClass} ${format.textClass}`}`}>{format.label}</span></td>
                      <td className="py-4 px-6"><span className={`text-sm ${isExpired ? (isDark ? 'text-slate-500' : 'text-slate-400') : textSecondary} font-mono`}>{record.size}</span></td>
                      <td className="py-4 px-6">
                        <div className="flex flex-col">
                          <span className={`text-sm ${isExpired ? (isDark ? 'text-slate-400' : 'text-slate-500') : textColor} font-mono`}>{record.createdDate}</span>
                          <span className={`text-xs ${isExpired ? (isDark ? 'text-slate-600' : 'text-slate-400') : textSecondary} font-mono`}>{record.createdTime}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-1.5 group/tooltip relative">
                          <span className="relative flex h-2 w-2">
                            {status.animate && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                            <span className={`relative inline-flex rounded-full h-2 w-2 ${status.dot}`}></span>
                          </span>
                          <span className={`text-sm font-medium ${status.text}`}>{status.label}</span>
                          {record.expiresIn && <div className={`absolute left-0 bottom-full mb-2 hidden group-hover/tooltip:block ${isDark ? 'bg-black' : 'bg-slate-800'} text-white text-xs px-2 py-1 rounded whitespace-nowrap z-50`}>{record.expiresIn}</div>}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex justify-end gap-2">
                          {!isExpired ? (
                            <button onClick={() => handleDownload(record)} className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary/10 hover:bg-primary text-primary hover:text-white text-sm font-medium rounded-lg transition-all"><span className="material-symbols-outlined text-[18px]">download</span>下载</button>
                          ) : (
                            <button className={`inline-flex items-center gap-1 px-3 py-1.5 ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-slate-200 text-slate-400'} text-sm font-medium rounded-lg cursor-not-allowed`} disabled><span className="material-symbols-outlined text-[18px]">block</span>不可用</button>
                          )}
                          <button onClick={() => setShowDeleteConfirm(record.id)} className="inline-flex items-center gap-1 px-2 py-1.5 hover:bg-danger/10 text-danger/70 hover:text-danger text-sm font-medium rounded-lg transition-all"><span className="material-symbols-outlined text-[18px]">delete</span></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className={`flex items-center justify-between px-6 py-4 ${tableHeaderBg} border-t ${borderColor}`}>
            <p className={`text-sm ${textSecondary}`}>显示 <span className={`font-medium ${textColor}`}>1</span> 到 <span className={`font-medium ${textColor}`}>{filteredRecords.length}</span> 条，共 <span className={`font-medium ${textColor}`}>{records.length}</span> 条记录</p>
            <div className="flex gap-2">
              <button className={`px-3 py-1 text-sm font-medium rounded-md ${cardBg} border ${borderColor} ${textSecondary} ${hoverBg} disabled:opacity-50`}>上一页</button>
              <button className="px-3 py-1 text-sm font-medium rounded-md bg-primary text-white border border-transparent shadow-sm">1</button>
              <button className={`px-3 py-1 text-sm font-medium rounded-md ${cardBg} border ${borderColor} ${textSecondary} ${hoverBg}`}>下一页</button>
            </div>
          </div>
        </div>
      </main>
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className={`w-full max-w-sm rounded-xl ${modalBg} border ${borderColor} shadow-2xl`}>
            <div className="p-6 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-danger/10 flex items-center justify-center mb-4"><span className="material-symbols-outlined text-danger text-2xl">warning</span></div>
              <h3 className={`text-lg font-bold ${textColor} mb-2`}>确认删除</h3>
              <p className={`text-sm ${textSecondary}`}>确定要删除这条下载记录吗？此操作无法撤销。</p>
            </div>
            <div className={`flex gap-3 px-6 py-4 border-t ${borderColor}`}>
              <button onClick={() => setShowDeleteConfirm(null)} className={`flex-1 px-4 py-2 rounded-lg border ${borderColor} ${textSecondary} ${hoverBg} text-sm font-medium`}>取消</button>
              <button onClick={() => handleDelete(showDeleteConfirm)} className="flex-1 px-4 py-2 rounded-lg bg-danger hover:bg-danger/90 text-white text-sm font-medium">删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DownloadRecords;
