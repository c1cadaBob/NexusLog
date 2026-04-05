import React from 'react';
import { useThemeStore } from '../../stores/themeStore';

const ConfigVersions: React.FC = () => {
  const isDark = useThemeStore((s) => s.isDark);

  // 主题样式
  const headerBg = isDark ? 'bg-[#111722]/95' : 'bg-white/95';
  const cardBg = isDark ? 'bg-[#1e293b]' : 'bg-white';
  const inputBg = isDark ? 'bg-[#1e293b]' : 'bg-white';
  const tableHeaderBg = isDark ? 'bg-[#141b29]' : 'bg-slate-100';
  const paginationBg = isDark ? 'bg-[#1a2230]' : 'bg-slate-50';
  const diffBg = isDark ? 'bg-[#0b1121]' : 'bg-slate-50';
  const diffHeaderBg = isDark ? 'bg-[#1a2230]' : 'bg-slate-100';
  const borderColor = isDark ? 'border-[#334155]' : 'border-slate-200';
  const textColor = isDark ? 'text-white' : 'text-slate-900';
  const textSecondary = isDark ? 'text-[#94a3b8]' : 'text-slate-600';
  const hoverBg = isDark ? 'hover:bg-[#232f48]' : 'hover:bg-slate-50';
  const buttonBg = isDark ? 'bg-[#232f48]' : 'bg-white';
  const versionBg = isDark ? 'bg-slate-700/50' : 'bg-slate-200';
  const versionText = isDark ? 'text-slate-300' : 'text-slate-700';

  // 版本数据
  const versions = [
    { version: 'v1.0.4', type: '日志解析规则 (Log Parsers)', desc: 'Updated regex for nginx logs', operator: 'Li_Ming', color: 'bg-indigo-500', initial: 'L', time: '2023-10-24 14:30:00', status: 'active' as const },
    { version: 'v1.0.3', type: '数据保留策略 (Retention)', desc: 'Changed retention period to 90 days', operator: 'Wang_Wei', color: 'bg-purple-500', initial: 'W', time: '2023-10-22 09:15:22', status: 'inactive' as const },
    { version: 'v1.0.2', type: '告警阈值 (Alert Thresholds)', desc: 'Increased CPU threshold to 85%', operator: 'Zhang_San', color: 'bg-orange-500', initial: 'Z', time: '2023-10-20 16:45:10', status: 'inactive' as const },
    { version: 'v1.0.1', type: '网络设置 (Network)', desc: 'Updated VPC configuration', operator: 'Li_Ming', color: 'bg-indigo-500', initial: 'L', time: '2023-10-18 11:20:05', status: 'inactive' as const },
  ];

  return (
    <div className="flex flex-col min-h-full -m-4 md:-m-6">
      {/* Top Bar */}
      <header className={`flex items-center justify-between px-8 py-4 border-b ${borderColor} ${headerBg} backdrop-blur z-10 shrink-0 sticky top-0`}>
        <div>
          <h2 className={`text-xl font-bold ${textColor} tracking-tight`}>配置历史 (Config History)</h2>
          <p className={`text-xs ${textSecondary}`}>管理系统配置版本，支持对比与回滚 (Manage configuration versions, compare and rollback)</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => { window.location.hash = '#/help/faq'; }} className={`flex items-center gap-2 px-3 py-1.5 text-sm ${versionText} ${isDark ? 'hover:text-white hover:bg-white/5' : 'hover:text-slate-900 hover:bg-slate-100'} rounded-lg transition-colors border ${borderColor}`}>
            <span className="material-symbols-outlined text-[18px]">help</span>
            <span>帮助</span>
          </button>
          <button className="bg-[#135bec] hover:bg-[#1050d0] text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-blue-900/20 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">save</span>
            <span>保存当前配置</span>
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 py-6 px-6 md:px-8">
        {/* Filters & Search */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1 max-w-lg">
            <span className={`material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 ${textSecondary}`}>search</span>
            <input id="config-versions-search" name="configVersionsSearch" className={`w-full ${inputBg} border ${borderColor} ${textColor} rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#135bec] focus:border-[#135bec] placeholder-[#94a3b8] text-sm`} placeholder="搜索版本号、操作员或备注 (Search Version ID, Operator...)" type="text" />
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 md:pb-0">
            {[
              { options: ['配置类型: 全部', '日志解析规则', '数据保留策略', '告警阈值'], icon: 'expand_more' },
              { options: ['时间范围: 最近7天', '最近24小时', '最近30天'], icon: 'calendar_today' },
              { options: ['状态: 全部', '激活 (Active)', '未激活 (Inactive)'], icon: 'filter_list' },
            ].map((filter, idx) => (
              <div key={idx} className="relative group">
                <select
                  id={`config-versions-filter-${idx}`}
                  name={`configVersionsFilter${idx}`}
                  className={`appearance-none ${inputBg} border ${borderColor} ${versionText} rounded-lg pl-3 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec] cursor-pointer min-w-[140px]`}
                >
                  {filter.options.map(opt => <option key={opt}>{opt}</option>)}
                </select>
                <span className={`material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 ${textSecondary} pointer-events-none text-lg`}>{filter.icon}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Versions Table */}
        <div className={`${cardBg} border ${borderColor} rounded-xl overflow-hidden shadow-sm`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className={`${tableHeaderBg} ${textSecondary} text-xs uppercase tracking-wider font-semibold border-b ${borderColor}`}>
                  <th className="px-6 py-4 w-32">版本号 (Version)</th>
                  <th className="px-6 py-4">配置类型 (Type)</th>
                  <th className="px-6 py-4">操作员 (Operator)</th>
                  <th className="px-6 py-4">变更时间 (Timestamp)</th>
                  <th className="px-6 py-4">状态 (Status)</th>
                  <th className="px-6 py-4 text-right">操作 (Actions)</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-[#334155]' : 'divide-slate-200'} text-sm`}>
                {versions.map((v, idx) => (
                  <tr key={v.version} className={`group ${hoverBg} transition-colors`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`font-mono px-2 py-1 rounded text-xs ${v.status === 'active' ? 'text-[#135bec] font-medium bg-[#135bec]/10' : `${versionText} ${versionBg}`}`}>{v.version}</span>
                        {v.status === 'active' && <span className="bg-[#10b981]/20 text-[#10b981] text-[10px] px-1.5 py-0.5 rounded font-bold uppercase">Current</span>}
                      </div>
                    </td>
                    <td className={`px-6 py-4 ${textColor} font-medium`}>
                      {v.type}
                      <p className={`${textSecondary} text-xs font-normal mt-0.5`}>{v.desc}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full ${v.color} flex items-center justify-center text-[10px] text-white font-bold`}>{v.initial}</div>
                        <span className={versionText}>{v.operator}</span>
                      </div>
                    </td>
                    <td className={`px-6 py-4 ${textSecondary} font-mono text-xs`}>{v.time}</td>
                    <td className="px-6 py-4">
                      {v.status === 'active' ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#10b981]/10 border border-[#10b981]/20 text-[#10b981] text-xs font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]"></span>Active
                        </div>
                      ) : (
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${isDark ? 'bg-slate-700/30 border-slate-700 text-slate-400' : 'bg-slate-100 border-slate-300 text-slate-500'} border text-xs font-medium`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isDark ? 'bg-slate-500' : 'bg-slate-400'}`}></span>Inactive
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2 opacity-100 sm:opacity-60 group-hover:opacity-100 transition-opacity">
                        <button className={`p-1.5 ${textSecondary} ${isDark ? 'hover:text-white hover:bg-white/10' : 'hover:text-slate-900 hover:bg-slate-100'} rounded`} title="查看详情 (View)">
                          <span className="material-symbols-outlined text-[20px]">visibility</span>
                        </button>
                        <button className={`p-1.5 ${textSecondary} hover:text-[#135bec] hover:bg-[#135bec]/10 rounded`} title="对比差异 (Compare)">
                          <span className="material-symbols-outlined text-[20px]">difference</span>
                        </button>
                        {v.status !== 'active' && (
                          <button className={`flex items-center gap-1 px-2 py-1 ${textSecondary} hover:text-[#ef4444] hover:bg-[#ef4444]/10 rounded text-xs font-medium transition-colors ml-1`} title="回滚 (Rollback)">
                            <span className="material-symbols-outlined text-[16px]">history</span>
                            回滚
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className={`px-6 py-4 ${paginationBg} border-t ${borderColor} flex items-center justify-between`}>
            <p className={`text-xs ${textSecondary}`}>
              显示第 <span className={`${textColor} font-medium`}>1</span> 到 <span className={`${textColor} font-medium`}>4</span> 条，共 <span className={`${textColor} font-medium`}>24</span> 条记录
            </p>
            <div className="flex items-center gap-2">
              <button className={`p-1 rounded ${isDark ? 'hover:bg-slate-700 text-slate-400 hover:text-white' : 'hover:bg-slate-200 text-slate-500 hover:text-slate-900'} disabled:opacity-50`}>
                <span className="material-symbols-outlined text-[20px]">chevron_left</span>
              </button>
              <button className={`p-1 rounded ${isDark ? 'hover:bg-slate-700 text-slate-400 hover:text-white' : 'hover:bg-slate-200 text-slate-500 hover:text-slate-900'}`}>
                <span className="material-symbols-outlined text-[20px]">chevron_right</span>
              </button>
            </div>
          </div>
        </div>

        {/* Diff Preview Panel */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className={`text-lg font-bold ${textColor} flex items-center gap-2`}>
              <span className="material-symbols-outlined text-[#135bec]">compare_arrows</span>
              版本对比预览 (Diff Preview): v1.0.4 vs v1.0.3
            </h3>
            <span className={`text-xs ${textSecondary} font-mono`}>system_config.yaml</span>
          </div>
          <div className={`${diffBg} border ${borderColor} rounded-xl overflow-hidden font-mono text-sm shadow-lg`}>
            <div className={`grid grid-cols-2 divide-x ${isDark ? 'divide-[#334155]' : 'divide-slate-200'} border-b ${borderColor}`}>
              <div className={`${diffHeaderBg} px-4 py-2 text-xs ${textSecondary} font-semibold text-center`}>Version v1.0.3 (Old)</div>
              <div className={`${diffHeaderBg} px-4 py-2 text-xs ${textSecondary} font-semibold text-center`}>Version v1.0.4 (New)</div>
            </div>
            <div className={`grid grid-cols-2 divide-x ${isDark ? 'divide-[#334155]' : 'divide-slate-200'}`}>
              {/* Left Side (Old) */}
              <div className="py-2 overflow-x-auto">
                <div className={`flex px-4 ${isDark ? 'text-slate-500' : 'text-slate-600'} leading-6`}>
                  <span className="w-6 shrink-0 select-none opacity-50 text-right pr-3">12</span>
                  <span>log_level: info</span>
                </div>
                <div className={`flex px-4 bg-red-900/20 ${isDark ? 'text-slate-400' : 'text-slate-600'} leading-6`}>
                  <span className="w-6 shrink-0 select-none opacity-50 text-right pr-3 text-[#ef4444]">-</span>
                  <span>retention_days: 90</span>
                </div>
                <div className={`flex px-4 ${isDark ? 'text-slate-500' : 'text-slate-600'} leading-6`}>
                  <span className="w-6 shrink-0 select-none opacity-50 text-right pr-3">14</span>
                  <span>max_connections: 1000</span>
                </div>
                <div className={`flex px-4 ${isDark ? 'text-slate-500' : 'text-slate-600'} leading-6`}>
                  <span className="w-6 shrink-0 select-none opacity-50 text-right pr-3">15</span>
                  <span>timeout: 30s</span>
                </div>
              </div>
              {/* Right Side (New) */}
              <div className="py-2 overflow-x-auto">
                <div className={`flex px-4 ${isDark ? 'text-slate-300' : 'text-slate-700'} leading-6`}>
                  <span className="w-6 shrink-0 select-none opacity-50 text-right pr-3">12</span>
                  <span>log_level: info</span>
                </div>
                <div className={`flex px-4 bg-green-900/20 ${isDark ? 'text-green-100' : 'text-green-800'} leading-6`}>
                  <span className="w-6 shrink-0 select-none opacity-50 text-right pr-3 text-[#10b981]">+</span>
                  <span>retention_days: 120</span>
                </div>
                <div className={`flex px-4 ${isDark ? 'text-slate-300' : 'text-slate-700'} leading-6`}>
                  <span className="w-6 shrink-0 select-none opacity-50 text-right pr-3">14</span>
                  <span>max_connections: 1000</span>
                </div>
                <div className={`flex px-4 bg-green-900/20 ${isDark ? 'text-green-100' : 'text-green-800'} leading-6`}>
                  <span className="w-6 shrink-0 select-none opacity-50 text-right pr-3 text-[#10b981]">+</span>
                  <span>timeout: 60s  # Increased for slow queries</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <button className="text-sm text-[#135bec] hover:text-[#1050d0] font-medium flex items-center gap-1">
              查看完整对比 (View Full Diff)
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfigVersions;
