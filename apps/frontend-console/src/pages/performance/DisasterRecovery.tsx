import React from 'react';
import { useThemeStore } from '../../stores/themeStore';

const DisasterRecovery: React.FC = () => {
  const { isDark } = useThemeStore();

  const cardBg = isDark ? 'bg-[#1e293b]' : 'bg-white';
  const borderColor = isDark ? 'border-[#2a3441]' : 'border-slate-200';
  const textColor = isDark ? 'text-white' : 'text-slate-900';
  const textSecondary = isDark ? 'text-slate-400' : 'text-slate-600';
  const labelColor = isDark ? 'text-slate-400' : 'text-slate-500';
  const hoverBg = isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100';
  const tableBg = isDark ? 'bg-[#1a2332]' : 'bg-slate-50';
  const nodeBg = isDark ? 'bg-[#2a3649]' : 'bg-slate-200';

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
      {/* Header / Breadcrumbs */}
      <div className="flex-none p-6 pb-2 -mx-6 -mt-6">
        <div className="flex flex-wrap gap-2 items-center mb-4">
          <span className={`${textSecondary} text-sm font-medium`}>性能与高可用</span>
          <span className={`${textSecondary} text-sm font-medium`}>/</span>
          <span className={`${textSecondary} text-sm font-medium`}>灾备管理</span>
          <span className={`${textSecondary} text-sm font-medium`}>/</span>
          <span className={`${textColor} text-sm font-medium`}>灾备状态</span>
        </div>
        <div className={`flex flex-wrap justify-between items-end gap-4 border-b ${borderColor} pb-6`}>
          <div className="flex flex-col gap-1">
            <h1 className={`${textColor} text-2xl font-bold tracking-tight`}>灾备状态监控</h1>
            <p className={`${textSecondary} text-sm`}>实时监控主备集群同步状态及故障转移就绪情况</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => { window.location.hash = '#/help/faq'; }} className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${borderColor} ${hoverBg} ${textColor} text-sm font-medium transition-colors`}>
              <span className="material-symbols-outlined text-[20px]">help</span>
              帮助
            </button>
            <button className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${borderColor} ${hoverBg} ${textColor} text-sm font-medium transition-colors`}>
              <span className="material-symbols-outlined text-[20px]">edit</span>
              修改复制配置
            </button>
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/50 hover:bg-red-500/20 text-red-500 text-sm font-medium transition-colors group">
              <span className="material-symbols-outlined text-[20px] group-hover:animate-pulse">swap_horiz</span>
              执行主备切换
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-6 pt-2 -mx-6">
        <div className="max-w-[1600px] mx-auto">

          {/* Status Cards Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Card 1 */}
            <div className={`${cardBg} border ${borderColor} rounded-xl p-5 flex flex-col justify-between shadow-sm relative overflow-hidden group hover:border-slate-700 transition-all`}>
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <span className="material-symbols-outlined text-6xl text-emerald-500">health_and_safety</span>
              </div>
              <div>
                <p className={`${labelColor} text-sm font-medium mb-1`}>主区域健康度</p>
                <div className="flex items-baseline gap-2">
                  <p className={`${textColor} text-2xl font-bold`}>100%</p>
                  <span className="text-emerald-500 text-xs font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full">正常</span>
                </div>
              </div>
              <div className={`w-full ${isDark ? 'bg-slate-700/50' : 'bg-slate-200'} rounded-full h-1 mt-4`}>
                <div className="bg-emerald-500 h-1 rounded-full" style={{ width: '100%' }}></div>
              </div>
            </div>
            {/* Card 2 */}
            <div className={`${cardBg} border ${borderColor} rounded-xl p-5 flex flex-col justify-between shadow-sm relative overflow-hidden group hover:border-slate-700 transition-all`}>
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <span className="material-symbols-outlined text-6xl text-blue-500">sync_alt</span>
              </div>
              <div>
                <p className={`${labelColor} text-sm font-medium mb-1`}>复制延迟 (RPO)</p>
                <div className="flex items-baseline gap-2">
                  <p className={`${textColor} text-2xl font-bold`}>15ms</p>
                  <span className="text-blue-500 text-xs font-medium">目标 &lt; 1s</span>
                </div>
              </div>
              <div className="flex gap-1 mt-4">
                <div className="h-1 w-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                <div className="h-1 w-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="h-1 w-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
            {/* Card 3 */}
            <div className={`${cardBg} border ${borderColor} rounded-xl p-5 flex flex-col justify-between shadow-sm relative overflow-hidden group hover:border-slate-700 transition-all`}>
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <span className="material-symbols-outlined text-6xl text-amber-500">timer</span>
              </div>
              <div>
                <p className={`${labelColor} text-sm font-medium mb-1`}>预估恢复时间 (RTO)</p>
                <div className="flex items-baseline gap-2">
                  <p className={`${textColor} text-2xl font-bold`}>2m 30s</p>
                  <span className={`${isDark ? 'text-slate-500' : 'text-slate-400'} text-xs`}>上次: 2m 15s</span>
                </div>
              </div>
              <p className={`${isDark ? 'text-slate-500' : 'text-slate-400'} text-xs mt-4`}>基于当前日志积压量估算</p>
            </div>
            {/* Card 4 */}
            <div className={`${cardBg} border ${borderColor} rounded-xl p-5 flex flex-col justify-between shadow-sm relative overflow-hidden group hover:border-slate-700 transition-all`}>
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <span className="material-symbols-outlined text-6xl text-purple-500">verified_user</span>
              </div>
              <div>
                <p className={`${labelColor} text-sm font-medium mb-1`}>上次演练时间</p>
                <div className="flex items-baseline gap-2">
                  <p className={`${textColor} text-2xl font-bold`}>2023-10-15</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-4">
                <span className="material-symbols-outlined text-emerald-500 text-sm">check_circle</span>
                <span className="text-emerald-500 text-xs font-medium">演练成功 (Pass)</span>
              </div>
            </div>
          </div>

          {/* Topology Map Area */}
          <div className="flex flex-col gap-4 mb-6">
            <div className="flex justify-between items-center px-1">
              <h2 className={`${textColor} text-lg font-bold`}>拓扑视图 (Topology)</h2>
              <div className={`flex gap-2 text-xs ${labelColor}`}>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> 正常</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500"></div> 警告</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"></div> 故障</div>
              </div>
            </div>
            <div className={`relative w-full h-[400px] ${cardBg} rounded-xl border ${borderColor} overflow-hidden`}>
              {/* Background Grid Pattern */}
              <div className="absolute inset-0 opacity-10" style={{
                backgroundImage: `linear-gradient(to right, ${isDark ? '#334155' : '#cbd5e1'} 1px, transparent 1px), linear-gradient(to bottom, ${isDark ? '#334155' : '#cbd5e1'} 1px, transparent 1px)`,
                backgroundSize: '40px 40px'
              }}></div>

              {/* Map Container */}
              <div className="absolute inset-0 flex items-center justify-center p-8">
                {/* Node 1: Main Cluster */}
                <div className="relative z-10 flex flex-col items-center gap-3 w-48">
                  <div className="relative">
                    <div className="w-3 h-3 bg-emerald-500 rounded-full absolute -top-1 -right-1 z-20 shadow-[0_0_10px_rgba(34,197,94,0.6)]"></div>
                    <div className={`w-20 h-20 ${nodeBg} border-2 border-[#135bec] rounded-full flex items-center justify-center shadow-lg shadow-blue-900/20`}>
                      <span className="material-symbols-outlined text-[#135bec] text-4xl">dns</span>
                    </div>
                  </div>
                  <div className="text-center">
                    <h3 className={`${textColor} font-bold text-lg`}>主集群 (Primary)</h3>
                    <p className={`${labelColor} text-xs flex items-center justify-center gap-1`}>
                      <span className="material-symbols-outlined text-[14px]">location_on</span>
                      北京 (Beijing)
                    </p>
                    <div className={`mt-2 ${isDark ? 'bg-green-900/30 text-green-400 border-green-900/50' : 'bg-green-100 text-green-700 border-green-200'} text-xs px-2 py-0.5 rounded border inline-block`}>Online</div>
                  </div>
                </div>

                {/* Connection Line */}
                <div className={`flex-1 h-[2px] ${isDark ? 'bg-slate-700' : 'bg-slate-300'} relative mx-4 max-w-[400px]`}>
                  {/* Central Label Box */}
                  <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${cardBg} border ${borderColor} rounded px-3 py-1.5 flex flex-col items-center shadow-xl z-10`}>
                    <span className={`text-[10px] ${labelColor} uppercase tracking-wider font-semibold`}>Replication</span>
                    <div className="flex items-center gap-1 text-[#135bec]">
                      <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                      <span className="text-xs font-bold">Syncing</span>
                    </div>
                  </div>
                  <div className="absolute top-1/2 left-1/4 w-1.5 h-1.5 bg-blue-500 rounded-full -translate-y-1/2"></div>
                  <div className="absolute top-1/2 right-1/4 w-1.5 h-1.5 bg-blue-500 rounded-full -translate-y-1/2"></div>
                </div>

                {/* Node 2: Standby Cluster */}
                <div className="relative z-10 flex flex-col items-center gap-3 w-48">
                  <div className="relative">
                    <div className="w-3 h-3 bg-emerald-500 rounded-full absolute -top-1 -right-1 z-20 shadow-[0_0_10px_rgba(34,197,94,0.6)]"></div>
                    <div className={`w-20 h-20 ${nodeBg} border-2 ${isDark ? 'border-slate-600' : 'border-slate-400'} rounded-full flex items-center justify-center shadow-lg`}>
                      <span className={`material-symbols-outlined ${labelColor} text-4xl`}>storage</span>
                    </div>
                  </div>
                  <div className="text-center">
                    <h3 className={`${textColor} font-bold text-lg`}>备用集群 (Standby)</h3>
                    <p className={`${labelColor} text-xs flex items-center justify-center gap-1`}>
                      <span className="material-symbols-outlined text-[14px]">location_on</span>
                      上海 (Shanghai)
                    </p>
                    <div className={`mt-2 ${isDark ? 'bg-blue-900/30 text-blue-400 border-blue-900/50' : 'bg-blue-100 text-blue-700 border-blue-200'} text-xs px-2 py-0.5 rounded border inline-block`}>Ready</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Section: Logs & Details */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Event Log */}
            <div className={`lg:col-span-2 ${cardBg} border ${borderColor} rounded-xl p-5 flex flex-col h-full`}>
              <div className="flex justify-between items-center mb-4">
                <h3 className={`${textColor} font-bold text-base`}>复制事件日志 (Replication Events)</h3>
                <button className="text-[#135bec] text-sm hover:underline">查看全部</button>
              </div>
              <div className="overflow-x-auto">
                <table className={`w-full text-left text-sm ${labelColor}`}>
                  <thead className={`border-b ${borderColor} text-xs uppercase ${tableBg} ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                    <tr>
                      <th className="px-3 py-2 font-medium">时间 (Time)</th>
                      <th className="px-3 py-2 font-medium">级别 (Level)</th>
                      <th className="px-3 py-2 font-medium">事件 (Event)</th>
                      <th className="px-3 py-2 font-medium">详情 (Details)</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-200'}`}>
                    <tr className={`${hoverBg} transition-colors`}>
                      <td className="px-3 py-3">10:45:22 AM</td>
                      <td className="px-3 py-3"><span className="bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded text-xs">Info</span></td>
                      <td className={`px-3 py-3 ${textColor}`}>Sync Completed</td>
                      <td className="px-3 py-3">Batch #92831 synchronized successfully</td>
                    </tr>
                    <tr className={`${hoverBg} transition-colors`}>
                      <td className="px-3 py-3">10:44:01 AM</td>
                      <td className="px-3 py-3"><span className="bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded text-xs">Warning</span></td>
                      <td className={`px-3 py-3 ${textColor}`}>Latency Spike</td>
                      <td className="px-3 py-3">Replication lag exceeded 50ms</td>
                    </tr>
                    <tr className={`${hoverBg} transition-colors`}>
                      <td className="px-3 py-3">10:30:15 AM</td>
                      <td className="px-3 py-3"><span className="bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded text-xs">Info</span></td>
                      <td className={`px-3 py-3 ${textColor}`}>Checkpoint</td>
                      <td className="px-3 py-3">Daily consistency checkpoint created</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            {/* Config Summary */}
            <div className={`${cardBg} border ${borderColor} rounded-xl p-5 flex flex-col h-full`}>
              <div className="flex justify-between items-center mb-4">
                <h3 className={`${textColor} font-bold text-base`}>配置概览</h3>
                <span className={`material-symbols-outlined ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>settings</span>
              </div>
              <div className="flex flex-col gap-4">
                <div className={`flex justify-between items-center py-2 border-b ${isDark ? 'border-slate-800/50' : 'border-slate-200'}`}>
                  <span className={`${labelColor} text-sm`}>复制模式 (Mode)</span>
                  <span className={`${textColor} text-sm font-medium`}>异步 (Async)</span>
                </div>
                <div className={`flex justify-between items-center py-2 border-b ${isDark ? 'border-slate-800/50' : 'border-slate-200'}`}>
                  <span className={`${labelColor} text-sm`}>压缩 (Compression)</span>
                  <span className={`${textColor} text-sm font-medium`}>LZ4 Enabled</span>
                </div>
                <div className={`flex justify-between items-center py-2 border-b ${isDark ? 'border-slate-800/50' : 'border-slate-200'}`}>
                  <span className={`${labelColor} text-sm`}>带宽限制 (Bandwidth)</span>
                  <span className={`${textColor} text-sm font-medium`}>No Limit</span>
                </div>
                <div className={`flex justify-between items-center py-2 border-b ${isDark ? 'border-slate-800/50' : 'border-slate-200'}`}>
                  <span className={`${labelColor} text-sm`}>自动故障转移</span>
                  <div className="flex items-center gap-2">
                    <span className="text-red-400 text-sm font-medium">Disabled</span>
                    <div className={`w-8 h-4 ${isDark ? 'bg-slate-700' : 'bg-slate-300'} rounded-full relative cursor-pointer`}>
                      <div className={`absolute left-0.5 top-0.5 w-3 h-3 ${isDark ? 'bg-slate-400' : 'bg-slate-500'} rounded-full`}></div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-auto pt-6">
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 flex gap-3">
                  <span className="material-symbols-outlined text-[#135bec] mt-0.5">info</span>
                  <p className={`text-xs ${isDark ? 'text-blue-200/80' : 'text-blue-700'} leading-relaxed`}>
                    当前配置下，主备切换需要人工确认。建议在业务低峰期进行演练。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DisasterRecovery;
