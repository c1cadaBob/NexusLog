import React from 'react';
import { useThemeStore } from '../../stores/themeStore';

const PerformanceMonitoring: React.FC = () => {
  const { isDark } = useThemeStore();

  const headerBg = isDark ? 'bg-[#111722]' : 'bg-white';
  const cardBg = isDark ? 'bg-[#1e293b]' : 'bg-white';
  const borderColor = isDark ? 'border-[#2a3441]' : 'border-slate-200';
  const textColor = isDark ? 'text-white' : 'text-slate-900';
  const textSecondary = isDark ? 'text-slate-400' : 'text-slate-600';
  const tableHeaderBg = isDark ? 'bg-[#1a2332]' : 'bg-slate-100';
  const rowHoverBg = isDark ? 'hover:bg-[#232f48]' : 'hover:bg-slate-50';
  const chartGridBg = isDark ? 'border-[#2a3441]/30' : 'border-slate-200';
  const progressBg = isDark ? 'bg-slate-700' : 'bg-slate-200';
  const tagBg = isDark ? 'bg-[#232f48]' : 'bg-slate-100';

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Header */}
      <div className={`flex items-center justify-between px-6 py-4 border-b ${borderColor} ${headerBg} shrink-0 -mx-6 -mt-6`}>
        <div className="flex flex-col">
          <h2 className={`text-xl font-bold ${textColor} tracking-tight`}>实时系统性能 (Real-time System Performance)</h2>
          <p className={`text-sm ${textSecondary} mt-1`}>监控集群健康状态、资源使用率及关键性能指标</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center px-3 py-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-bold uppercase tracking-wider">Cluster Healthy</span>
          </div>
          <div className={`h-8 w-px ${borderColor} mx-1`}></div>
          <div className={`flex ${cardBg} rounded-md p-1 border ${borderColor}`}>
            <button className={`px-3 py-1 text-xs font-medium rounded ${isDark ? 'bg-[#334155]' : 'bg-slate-200'} shadow-sm ${textColor}`}>15m</button>
            <button className={`px-3 py-1 text-xs font-medium rounded ${isDark ? 'hover:bg-[#334155]' : 'hover:bg-slate-200'} ${textSecondary} transition-colors`}>1h</button>
            <button className={`px-3 py-1 text-xs font-medium rounded ${isDark ? 'hover:bg-[#334155]' : 'hover:bg-slate-200'} ${textSecondary} transition-colors`}>24h</button>
          </div>
          <button className="flex items-center justify-center h-8 w-8 rounded-md bg-[#135bec] hover:bg-[#1a6fff] text-white transition-colors">
            <span className="material-symbols-outlined text-[18px]">refresh</span>
          </button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto pr-2">
        <div className="max-w-[1600px] mx-auto flex flex-col gap-6">

          {/* Metrics Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1 */}
            <div className={`${cardBg} p-5 rounded-lg border ${borderColor} shadow-sm flex flex-col justify-between h-32 relative overflow-hidden group`}>
              <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <span className="material-symbols-outlined text-[64px]">search</span>
              </div>
              <div>
                <p className={`${textSecondary} text-xs font-medium uppercase tracking-wider`}>Global Search Latency (P99)</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <h3 className={`text-2xl font-bold ${textColor}`}>145ms</h3>
                  <span className="text-xs font-medium text-emerald-500 flex items-center bg-emerald-500/10 px-1.5 py-0.5 rounded">
                    <span className="material-symbols-outlined text-[12px] mr-0.5">trending_down</span>12%
                  </span>
                </div>
              </div>
              <div className="h-10 w-full mt-2 flex items-end gap-0.5">
                {[40, 60, 30, 80, 50, 70, 45, 65, 90, 55, 35, 25].map((h, i) => (
                  <div key={i} className={`w-1/12 bg-[#135bec]${i > 9 ? '' : '/20'} rounded-t-sm`} style={{ height: `${h}%` }}></div>
                ))}
              </div>
            </div>
            {/* Card 2 */}
            <div className={`${cardBg} p-5 rounded-lg border ${borderColor} shadow-sm flex flex-col justify-between h-32 relative overflow-hidden group`}>
              <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <span className="material-symbols-outlined text-[64px]">history_edu</span>
              </div>
              <div>
                <p className={`${textSecondary} text-xs font-medium uppercase tracking-wider`}>Indexing Rate (Docs/s)</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <h3 className={`text-2xl font-bold ${textColor}`}>24.5k</h3>
                  <span className="text-xs font-medium text-emerald-500 flex items-center bg-emerald-500/10 px-1.5 py-0.5 rounded">
                    <span className="material-symbols-outlined text-[12px] mr-0.5">trending_up</span>5%
                  </span>
                </div>
              </div>
              <div className="h-10 w-full mt-2 relative">
                <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 40">
                  <path d="M0 30 Q 10 35, 20 25 T 40 20 T 60 28 T 80 15 T 100 10" fill="none" stroke="#135bec" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                  <path d="M0 30 Q 10 35, 20 25 T 40 20 T 60 28 T 80 15 T 100 10 V 40 H 0 Z" fill="url(#gradientIndex)" opacity="0.2" />
                  <defs><linearGradient id="gradientIndex" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#135bec" /><stop offset="100%" stopColor="#135bec" stopOpacity="0" /></linearGradient></defs>
                </svg>
              </div>
            </div>
            {/* Card 3 */}
            <div className={`${cardBg} p-5 rounded-lg border ${borderColor} shadow-sm flex flex-col justify-between h-32 relative overflow-hidden group`}>
              <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <span className="material-symbols-outlined text-[64px]">memory</span>
              </div>
              <div>
                <p className={`${textSecondary} text-xs font-medium uppercase tracking-wider`}>Heap Memory Usage</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <h3 className={`text-2xl font-bold ${textColor}`}>68%</h3>
                  <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'} flex items-center ${isDark ? 'bg-slate-500/10' : 'bg-slate-200'} px-1.5 py-0.5 rounded`}>
                    <span className="material-symbols-outlined text-[12px] mr-0.5">remove</span>Stable
                  </span>
                </div>
              </div>
              <div className="h-10 w-full mt-2 flex flex-col justify-end gap-1">
                <div className={`flex justify-between text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  <span>Used</span><span>Max: 32GB</span>
                </div>
                <div className={`w-full ${progressBg} h-2 rounded-full overflow-hidden`}>
                  <div className="bg-amber-500 h-full rounded-full" style={{ width: '68%' }}></div>
                </div>
              </div>
            </div>
            {/* Card 4 */}
            <div className={`${cardBg} p-5 rounded-lg border ${borderColor} shadow-sm flex flex-col justify-between h-32 relative overflow-hidden group`}>
              <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <span className="material-symbols-outlined text-[64px]">gpp_bad</span>
              </div>
              <div>
                <p className={`${textSecondary} text-xs font-medium uppercase tracking-wider`}>Thread Pool Rejections</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <h3 className={`text-2xl font-bold ${textColor}`}>0</h3>
                  <span className="text-xs font-medium text-emerald-500 flex items-center bg-emerald-500/10 px-1.5 py-0.5 rounded">
                    <span className="material-symbols-outlined text-[12px] mr-0.5">check_circle</span>Healthy
                  </span>
                </div>
              </div>
              <div className="h-10 w-full mt-2 relative">
                <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 40">
                  <line stroke="#10b981" strokeWidth="2" x1="0" x2="100" y1="35" y2="35" />
                </svg>
              </div>
            </div>
          </div>

          {/* Charts Area */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* CPU Load Chart */}
            <div className={`${cardBg} rounded-lg border ${borderColor} p-5 shadow-sm`}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className={`text-base font-semibold ${textColor}`}>集群 CPU 负载趋势 (Cluster CPU Load)</h3>
                  <p className={`text-xs ${textSecondary}`}>所有节点的平均负载与峰值</p>
                </div>
                <button className={`${textSecondary}`}><span className="material-symbols-outlined text-[20px]">more_horiz</span></button>
              </div>
              <div className="h-64 w-full relative">
                <div className={`absolute inset-0 flex flex-col justify-between text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'} border-l border-b ${borderColor} pl-2 pb-6 box-border`}>
                  <div className={`flex w-full border-t ${chartGridBg} border-dashed h-full items-start pt-1`}><span>100%</span></div>
                  <div className={`flex w-full border-t ${chartGridBg} border-dashed h-full items-start pt-1`}><span>75%</span></div>
                  <div className={`flex w-full border-t ${chartGridBg} border-dashed h-full items-start pt-1`}><span>50%</span></div>
                  <div className={`flex w-full border-t ${chartGridBg} border-dashed h-full items-start pt-1`}><span>25%</span></div>
                  <div className="flex w-full h-0 items-end"><span>0%</span></div>
                </div>
                <svg className="absolute inset-0 h-full w-full pl-8 pb-6 pt-2" preserveAspectRatio="none" viewBox="0 0 400 100">
                  <path d="M0 60 Q 40 55, 80 70 T 160 50 T 240 65 T 320 40 T 400 55" fill="none" stroke="#135bec" strokeWidth="2" />
                  <path d="M0 75 Q 40 80, 80 65 T 160 70 T 240 75 T 320 60 T 400 70" fill="none" opacity="0.6" stroke="#10b981" strokeDasharray="4 2" strokeWidth="2" />
                  <path d="M0 85 Q 40 90, 80 85 T 160 88 T 240 82 T 320 85 T 400 80" fill="none" opacity="0.6" stroke="#f59e0b" strokeWidth="2" />
                </svg>
                <div className={`absolute bottom-0 left-8 right-0 flex justify-between text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'} pt-2`}>
                  <span>10:00</span><span>10:05</span><span>10:10</span><span>10:15</span><span>10:20</span><span>10:25</span>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-2 justify-end text-xs">
                <div className="flex items-center gap-1.5"><span className="w-3 h-1 bg-[#135bec] rounded-full"></span><span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Master-01</span></div>
                <div className="flex items-center gap-1.5"><span className="w-3 h-1 bg-[#10b981] rounded-full opacity-60"></span><span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Data-01</span></div>
                <div className="flex items-center gap-1.5"><span className="w-3 h-1 bg-[#f59e0b] rounded-full opacity-60"></span><span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Data-02</span></div>
              </div>
            </div>

            {/* IO Wait Trends */}
            <div className={`${cardBg} rounded-lg border ${borderColor} p-5 shadow-sm`}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className={`text-base font-semibold ${textColor}`}>I/O 等待时间 (I/O Wait Trends)</h3>
                  <p className={`text-xs ${textSecondary}`}>磁盘 I/O 延迟监控</p>
                </div>
                <button className={`${textSecondary}`}><span className="material-symbols-outlined text-[20px]">more_horiz</span></button>
              </div>
              <div className="h-64 w-full relative">
                <div className={`absolute inset-0 flex flex-col justify-between text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'} border-l border-b ${borderColor} pl-2 pb-6 box-border`}>
                  <div className={`flex w-full border-t ${chartGridBg} border-dashed h-full items-start pt-1`}><span>20ms</span></div>
                  <div className={`flex w-full border-t ${chartGridBg} border-dashed h-full items-start pt-1`}><span>15ms</span></div>
                  <div className={`flex w-full border-t ${chartGridBg} border-dashed h-full items-start pt-1`}><span>10ms</span></div>
                  <div className={`flex w-full border-t ${chartGridBg} border-dashed h-full items-start pt-1`}><span>5ms</span></div>
                  <div className="flex w-full h-0 items-end"><span>0ms</span></div>
                </div>
                <svg className="absolute inset-0 h-full w-full pl-8 pb-6 pt-2" preserveAspectRatio="none" viewBox="0 0 400 100">
                  <defs><linearGradient id="gradientIO" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.5" /><stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" /></linearGradient></defs>
                  <path d="M0 80 Q 50 85, 100 70 T 200 60 T 300 75 T 400 65 V 100 H 0 Z" fill="url(#gradientIO)" />
                  <path d="M0 80 Q 50 85, 100 70 T 200 60 T 300 75 T 400 65" fill="none" stroke="#8b5cf6" strokeWidth="2" />
                </svg>
                <div className={`absolute bottom-0 left-8 right-0 flex justify-between text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'} pt-2`}>
                  <span>10:00</span><span>10:05</span><span>10:10</span><span>10:15</span><span>10:20</span><span>10:25</span>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-2 justify-end text-xs">
                <div className="flex items-center gap-1.5"><span className="w-3 h-1 bg-[#8b5cf6] rounded-full"></span><span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Avg Wait Time</span></div>
              </div>
            </div>
          </div>

          {/* Node Performance List */}
          <div className={`${cardBg} rounded-lg border ${borderColor} shadow-sm overflow-hidden mb-6`}>
            <div className={`px-5 py-4 border-b ${borderColor} flex justify-between items-center`}>
              <h3 className={`text-base font-semibold ${textColor}`}>节点性能详情 (Node Performance Breakdown)</h3>
              <div className="flex gap-2">
                <button className={`p-1 ${textSecondary} hover:text-[#135bec] transition-colors`}><span className="material-symbols-outlined text-[18px]">filter_list</span></button>
                <button className={`p-1 ${textSecondary} hover:text-[#135bec] transition-colors`}><span className="material-symbols-outlined text-[18px]">download</span></button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className={`w-full text-sm text-left ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                <thead className={`text-xs ${textSecondary} uppercase ${tableHeaderBg} border-b ${borderColor}`}>
                  <tr>
                    <th className="px-6 py-3 font-medium">Node Name (节点名称)</th>
                    <th className="px-6 py-3 font-medium">Role (角色)</th>
                    <th className="px-6 py-3 font-medium">Load (1m / 5m / 15m)</th>
                    <th className="px-6 py-3 font-medium">JVM Heap</th>
                    <th className="px-6 py-3 font-medium">Disk Usage</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-[#2a3441]' : 'divide-slate-200'}`}>
                  <tr className={`${cardBg} ${rowHoverBg} transition-colors`}>
                    <td className={`px-6 py-4 font-medium ${textColor} whitespace-nowrap`}>
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-[#135bec]">dns</span>
                        es-master-01
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-[#135bec]/10 text-[#135bec] text-xs font-medium px-2 py-0.5 rounded border border-[#135bec]/20">Master</span>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs">0.45 / 0.55 / 0.48</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-16 ${progressBg} h-1.5 rounded-full overflow-hidden`}>
                          <div className="bg-emerald-500 h-full rounded-full" style={{ width: '45%' }}></div>
                        </div>
                        <span className="text-xs">45%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-16 ${progressBg} h-1.5 rounded-full overflow-hidden`}>
                          <div className={`${isDark ? 'bg-slate-400' : 'bg-slate-500'} h-full rounded-full`} style={{ width: '22%' }}></div>
                        </div>
                        <span className="text-xs">22%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                        <span className="text-emerald-500 text-xs font-medium">Online</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-[#135bec] hover:underline text-xs font-medium">Details</button>
                    </td>
                  </tr>
                  <tr className={`${cardBg} ${rowHoverBg} transition-colors`}>
                    <td className={`px-6 py-4 font-medium ${textColor} whitespace-nowrap`}>
                      <div className="flex items-center gap-2">
                        <span className={`material-symbols-outlined text-[18px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>dns</span>
                        es-data-01
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`${tagBg} ${isDark ? 'text-slate-300' : 'text-slate-600'} text-xs font-medium px-2 py-0.5 rounded border ${borderColor}`}>Data</span>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs">1.20 / 1.15 / 1.05</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-16 ${progressBg} h-1.5 rounded-full overflow-hidden`}>
                          <div className="bg-amber-500 h-full rounded-full" style={{ width: '78%' }}></div>
                        </div>
                        <span className="text-xs">78%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-16 ${progressBg} h-1.5 rounded-full overflow-hidden`}>
                          <div className={`${isDark ? 'bg-slate-400' : 'bg-slate-500'} h-full rounded-full`} style={{ width: '65%' }}></div>
                        </div>
                        <span className="text-xs">65%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                        <span className="text-emerald-500 text-xs font-medium">Online</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-[#135bec] hover:underline text-xs font-medium">Details</button>
                    </td>
                  </tr>
                  <tr className={`${cardBg} ${rowHoverBg} transition-colors`}>
                    <td className={`px-6 py-4 font-medium ${textColor} whitespace-nowrap`}>
                      <div className="flex items-center gap-2">
                        <span className={`material-symbols-outlined text-[18px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>dns</span>
                        es-data-02
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`${tagBg} ${isDark ? 'text-slate-300' : 'text-slate-600'} text-xs font-medium px-2 py-0.5 rounded border ${borderColor}`}>Data</span>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs">0.85 / 0.90 / 0.88</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-16 ${progressBg} h-1.5 rounded-full overflow-hidden`}>
                          <div className="bg-emerald-500 h-full rounded-full" style={{ width: '62%' }}></div>
                        </div>
                        <span className="text-xs">62%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-16 ${progressBg} h-1.5 rounded-full overflow-hidden`}>
                          <div className={`${isDark ? 'bg-slate-400' : 'bg-slate-500'} h-full rounded-full`} style={{ width: '58%' }}></div>
                        </div>
                        <span className="text-xs">58%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                        <span className="text-emerald-500 text-xs font-medium">Online</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-[#135bec] hover:underline text-xs font-medium">Details</button>
                    </td>
                  </tr>
                  <tr className={`${cardBg} ${rowHoverBg} transition-colors`}>
                    <td className={`px-6 py-4 font-medium ${textColor} whitespace-nowrap`}>
                      <div className="flex items-center gap-2">
                        <span className={`material-symbols-outlined text-[18px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>dns</span>
                        es-ingest-01
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`${tagBg} ${isDark ? 'text-slate-300' : 'text-slate-600'} text-xs font-medium px-2 py-0.5 rounded border ${borderColor}`}>Ingest</span>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs">2.10 / 1.80 / 1.50</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-16 ${progressBg} h-1.5 rounded-full overflow-hidden`}>
                          <div className="bg-emerald-500 h-full rounded-full" style={{ width: '40%' }}></div>
                        </div>
                        <span className="text-xs">40%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-16 ${progressBg} h-1.5 rounded-full overflow-hidden`}>
                          <div className={`${isDark ? 'bg-slate-400' : 'bg-slate-500'} h-full rounded-full`} style={{ width: '10%' }}></div>
                        </div>
                        <span className="text-xs">10%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full bg-amber-500"></div>
                        <span className="text-amber-500 text-xs font-medium">High Load</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-[#135bec] hover:underline text-xs font-medium">Details</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerformanceMonitoring;
