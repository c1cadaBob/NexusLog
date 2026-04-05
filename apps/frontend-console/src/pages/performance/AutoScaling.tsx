import React from 'react';
import { useThemeStore } from '../../stores/themeStore';

const AutoScaling: React.FC = () => {
  const { isDark } = useThemeStore();

  const pageBg = isDark ? 'bg-[#111722]' : 'bg-slate-50';
  const headerBg = isDark ? 'bg-[#111722]/80' : 'bg-white/80';
  const cardBg = isDark ? 'bg-[#1e293b]' : 'bg-white';
  const borderColor = isDark ? 'border-[#2a3441]' : 'border-slate-200';
  const textColor = isDark ? 'text-white' : 'text-slate-900';
  const textSecondary = isDark ? 'text-slate-400' : 'text-slate-600';
  const inputBg = isDark ? 'bg-slate-800' : 'bg-slate-100';
  const hoverBg = isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100';
  const rowHoverBg = isDark ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50';
  const tableHeaderBg = isDark ? 'bg-slate-800/50' : 'bg-slate-100';
  const paginationBg = isDark ? 'bg-slate-800/30' : 'bg-slate-50';
  const tagBg = isDark ? 'bg-slate-800' : 'bg-slate-100';
  const tagBorder = isDark ? 'border-slate-700' : 'border-slate-300';
  const tagText = isDark ? 'text-slate-300' : 'text-slate-700';
  const historyDivider = isDark ? 'bg-slate-700/50' : 'bg-slate-200';
  const switchBg = isDark ? 'bg-slate-700' : 'bg-slate-300';

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
      {/* Top Header */}
      <div className={`h-16 ${headerBg} backdrop-blur-md border-b ${borderColor} flex items-center justify-between px-6 sticky top-0 z-10 -mx-6 -mt-6`}>
        <div className="flex items-center gap-4">
          <button className={`md:hidden ${textSecondary}`}>
            <span className="material-symbols-outlined">menu</span>
          </button>
          <h1 className={`text-2xl font-bold ${textColor}`}>扩缩容策略</h1>
          <span className={`hidden sm:inline-block px-2 py-0.5 rounded-full ${tagBg} border ${tagBorder} text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'} font-medium`}>Auto-Scaling</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { window.location.hash = '#/help/faq'; }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${textSecondary} ${hoverBg} transition-colors`}
          >
            <span className="material-symbols-outlined text-[18px]">help</span>
            <span>帮助</span>
          </button>
          <button className={`flex items-center justify-center size-9 rounded-lg ${textSecondary} ${hoverBg} transition-colors`}>
            <span className="material-symbols-outlined">notifications</span>
          </button>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className={`flex-1 overflow-y-auto ${pageBg} p-4 md:p-8 -mx-6 mb-[-24px] pb-12`}>
        <div className="max-w-6xl mx-auto flex flex-col gap-6">

          {/* Page Header & Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className={`text-2xl font-bold ${textColor} mb-1`}>策略管理</h2>
              <p className={`${textSecondary} text-sm`}>配置系统自动扩缩容规则以应对流量波动，确保高可用性。</p>
            </div>
            <button className="flex items-center gap-2 bg-[#135bec] hover:bg-[#1a6fff] text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-lg shadow-blue-900/20">
              <span className="material-symbols-outlined text-[20px]">add</span>
              <span>新建策略</span>
            </button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={`${cardBg} border ${borderColor} rounded-xl p-5 shadow-sm relative overflow-hidden group`}>
              <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <span className="material-symbols-outlined text-6xl text-[#135bec]">bolt</span>
              </div>
              <p className={`${textSecondary} text-sm font-medium`}>活跃策略</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className={`text-3xl font-bold ${textColor}`}>5</span>
                <span className="text-emerald-500 text-sm font-medium flex items-center">
                  <span className="material-symbols-outlined text-sm">check_circle</span> 运行中
                </span>
              </div>
            </div>
            <div className={`${cardBg} border ${borderColor} rounded-xl p-5 shadow-sm relative overflow-hidden group`}>
              <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <span className="material-symbols-outlined text-6xl text-blue-400">history</span>
              </div>
              <p className={`${textSecondary} text-sm font-medium`}>今日触发次数</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className={`text-3xl font-bold ${textColor}`}>12</span>
                <span className="text-emerald-500 text-sm font-medium flex items-center">
                  <span className="material-symbols-outlined text-sm">trending_up</span> +20%
                </span>
              </div>
            </div>
            <div className={`${cardBg} border ${borderColor} rounded-xl p-5 shadow-sm relative overflow-hidden group`}>
              <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <span className="material-symbols-outlined text-6xl text-purple-400">savings</span>
              </div>
              <p className={`${textSecondary} text-sm font-medium`}>节省资源预估</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className={`text-3xl font-bold ${textColor}`}>24%</span>
                <span className="text-emerald-500 text-sm font-medium flex items-center">
                  <span className="material-symbols-outlined text-sm">arrow_upward</span> +5%
                </span>
              </div>
            </div>
          </div>

          {/* Main Table Card */}
          <div className={`${cardBg} border ${borderColor} rounded-xl overflow-hidden shadow-sm flex flex-col`}>
            <div className={`px-6 py-4 border-b ${borderColor} flex items-center justify-between`}>
              <h3 className={`font-semibold ${textColor} flex items-center gap-2`}>
                <span className="material-symbols-outlined text-[#135bec]">tune</span>
                策略列表
              </h3>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <span className={`material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 ${textSecondary} text-[18px]`}>search</span>
                  <input id="auto-scaling-search" name="autoScalingSearch" className={`${inputBg} border-none ${textColor} text-sm rounded-lg pl-9 pr-4 py-1.5 focus:ring-1 focus:ring-[#135bec] w-48`} placeholder="搜索策略..." type="text" />
                </div>
                <button className={`p-1.5 ${textSecondary} rounded-lg ${hoverBg}`}>
                  <span className="material-symbols-outlined text-[20px]">filter_list</span>
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className={`${tableHeaderBg} border-b ${borderColor} ${isDark ? 'text-slate-400' : 'text-slate-600'} text-xs uppercase tracking-wider`}>
                    <th className="px-6 py-3 font-semibold w-1/5">策略名称</th>
                    <th className="px-6 py-3 font-semibold w-1/4">触发条件</th>
                    <th className="px-6 py-3 font-semibold w-1/5">执行动作</th>
                    <th className="px-6 py-3 font-semibold w-1/6">冷却时间</th>
                    <th className="px-6 py-3 font-semibold w-1/6">状态</th>
                    <th className="px-6 py-3 font-semibold w-24 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-[#2a3441]' : 'divide-slate-200'}`}>
                  {/* Row 1 */}
                  <tr className={`group ${rowHoverBg} transition-colors`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded bg-blue-500/10 text-blue-400">
                          <span className="material-symbols-outlined text-[20px]">hard_drive</span>
                        </div>
                        <div>
                          <div className={`text-sm font-medium ${textColor}`}>磁盘自动扩容</div>
                          <div className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Storage Auto-Expand</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`inline-flex items-center px-2.5 py-1 rounded-md ${tagBg} border ${tagBorder} text-xs font-medium ${tagText}`}>
                        磁盘使用率 &gt; 85%
                      </div>
                    </td>
                    <td className="px-6 py-4"><span className={`text-sm ${tagText}`}>增加 100GB 存储</span></td>
                    <td className="px-6 py-4"><span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>1 小时</span></td>
                    <td className="px-6 py-4">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input id="auto-scaling-policy-storage" name="autoScalingPolicyStorage" type="checkbox" className="sr-only peer" defaultChecked />
                        <div className={`w-9 h-5 ${switchBg} peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#135bec]`}></div>
                        <span className="ml-2 text-xs font-medium text-emerald-400">已启用</span>
                      </label>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className={`${textSecondary} transition-colors`}><span className="material-symbols-outlined text-[20px]">more_vert</span></button>
                    </td>
                  </tr>
                  {/* Row 2 */}
                  <tr className={`group ${rowHoverBg} transition-colors`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded bg-purple-500/10 text-purple-400">
                          <span className="material-symbols-outlined text-[20px]">memory</span>
                        </div>
                        <div>
                          <div className={`text-sm font-medium ${textColor}`}>计算节点扩容</div>
                          <div className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Node Scale-Out</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`inline-flex items-center px-2.5 py-1 rounded-md ${tagBg} border ${tagBorder} text-xs font-medium ${tagText}`}>
                        CPU 负载 &gt; 90% (5m)
                      </div>
                    </td>
                    <td className="px-6 py-4"><span className={`text-sm ${tagText}`}>增加 1 个数据节点</span></td>
                    <td className="px-6 py-4"><span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>30 分钟</span></td>
                    <td className="px-6 py-4">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input id="auto-scaling-policy-compute" name="autoScalingPolicyCompute" type="checkbox" className="sr-only peer" />
                        <div className={`w-9 h-5 ${switchBg} peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#135bec]`}></div>
                        <span className={`ml-2 text-xs font-medium ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>已禁用</span>
                      </label>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className={`${textSecondary} transition-colors`}><span className="material-symbols-outlined text-[20px]">more_vert</span></button>
                    </td>
                  </tr>
                  {/* Row 3 */}
                  <tr className={`group ${rowHoverBg} transition-colors`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded bg-orange-500/10 text-orange-400">
                          <span className="material-symbols-outlined text-[20px]">cleaning_services</span>
                        </div>
                        <div>
                          <div className={`text-sm font-medium ${textColor}`}>内存自动释放</div>
                          <div className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Memory Cleanup</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`inline-flex items-center px-2.5 py-1 rounded-md ${tagBg} border ${tagBorder} text-xs font-medium ${tagText}`}>
                        内存使用率 &gt; 95%
                      </div>
                    </td>
                    <td className="px-6 py-4"><span className={`text-sm ${tagText}`}>重启缓存服务</span></td>
                    <td className="px-6 py-4"><span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>2 小时</span></td>
                    <td className="px-6 py-4">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input id="auto-scaling-policy-memory" name="autoScalingPolicyMemory" type="checkbox" className="sr-only peer" defaultChecked />
                        <div className={`w-9 h-5 ${switchBg} peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#135bec]`}></div>
                        <span className="ml-2 text-xs font-medium text-emerald-400">已启用</span>
                      </label>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className={`${textSecondary} transition-colors`}><span className="material-symbols-outlined text-[20px]">more_vert</span></button>
                    </td>
                  </tr>
                  {/* Row 4 */}
                  <tr className={`group ${rowHoverBg} transition-colors`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded bg-cyan-500/10 text-cyan-400">
                          <span className="material-symbols-outlined text-[20px]">network_check</span>
                        </div>
                        <div>
                          <div className={`text-sm font-medium ${textColor}`}>网络带宽调整</div>
                          <div className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Bandwidth Scaling</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`inline-flex items-center px-2.5 py-1 rounded-md ${tagBg} border ${tagBorder} text-xs font-medium ${tagText}`}>
                        入站流量 &gt; 800Mbps
                      </div>
                    </td>
                    <td className="px-6 py-4"><span className={`text-sm ${tagText}`}>升级带宽至 1Gbps</span></td>
                    <td className="px-6 py-4"><span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>45 分钟</span></td>
                    <td className="px-6 py-4">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input id="auto-scaling-policy-bandwidth" name="autoScalingPolicyBandwidth" type="checkbox" className="sr-only peer" defaultChecked />
                        <div className={`w-9 h-5 ${switchBg} peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#135bec]`}></div>
                        <span className="ml-2 text-xs font-medium text-emerald-400">已启用</span>
                      </label>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className={`${textSecondary} transition-colors`}><span className="material-symbols-outlined text-[20px]">more_vert</span></button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className={`px-6 py-3 border-t ${borderColor} ${paginationBg} flex items-center justify-between`}>
              <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>显示 1 到 4 条，共 4 条记录</span>
              <div className="flex gap-1">
                <button className={`px-2 py-1 rounded border ${borderColor} ${isDark ? 'text-slate-400 hover:bg-slate-700 hover:text-white' : 'text-slate-600 hover:bg-slate-200'} disabled:opacity-50 text-xs`}>上一页</button>
                <button className={`px-2 py-1 rounded border ${borderColor} ${isDark ? 'text-slate-400 hover:bg-slate-700 hover:text-white' : 'text-slate-600 hover:bg-slate-200'} disabled:opacity-50 text-xs`}>下一页</button>
              </div>
            </div>
          </div>

          {/* History Section */}
          <div className="flex flex-col gap-4">
            <h3 className={`text-lg font-bold ${textColor} flex items-center gap-2 px-1`}>
              <span className={`material-symbols-outlined ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>history</span>
              最近扩缩容记录
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* History Item 1 */}
              <div className={`${cardBg} border ${borderColor} rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden`}>
                <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                <div className="flex justify-between items-start">
                  <div className="flex flex-col">
                    <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} font-mono`}>2023-10-27 14:30:00</span>
                    <span className={`text-sm font-semibold ${textColor} mt-1`}>磁盘自动扩容</span>
                  </div>
                  <span className="bg-emerald-500/10 text-emerald-400 text-xs px-2 py-1 rounded-full border border-emerald-500/20 font-medium">成功</span>
                </div>
                <div className={`h-px ${historyDivider} w-full`}></div>
                <div className="flex items-center justify-between text-xs">
                  <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>动作:</span>
                  <span className={isDark ? 'text-slate-200' : 'text-slate-700'}>增加 100GB 存储</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>耗时:</span>
                  <span className={isDark ? 'text-slate-200' : 'text-slate-700'}>45s</span>
                </div>
              </div>
              {/* History Item 2 */}
              <div className={`${cardBg} border ${borderColor} rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden`}>
                <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                <div className="flex justify-between items-start">
                  <div className="flex flex-col">
                    <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} font-mono`}>2023-10-27 12:15:22</span>
                    <span className={`text-sm font-semibold ${textColor} mt-1`}>计算节点扩容</span>
                  </div>
                  <span className="bg-red-500/10 text-red-400 text-xs px-2 py-1 rounded-full border border-red-500/20 font-medium">失败</span>
                </div>
                <div className={`h-px ${historyDivider} w-full`}></div>
                <div className="flex items-center justify-between text-xs">
                  <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>动作:</span>
                  <span className={isDark ? 'text-slate-200' : 'text-slate-700'}>增加 1 数据节点</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>原因:</span>
                  <span className="text-red-400 truncate max-w-[150px]" title="资源配额不足 (Quota Exceeded)">资源配额不足...</span>
                </div>
              </div>
              {/* History Item 3 */}
              <div className={`${cardBg} border ${borderColor} rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden`}>
                <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                <div className="flex justify-between items-start">
                  <div className="flex flex-col">
                    <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} font-mono`}>2023-10-27 09:45:10</span>
                    <span className={`text-sm font-semibold ${textColor} mt-1`}>内存自动释放</span>
                  </div>
                  <span className="bg-emerald-500/10 text-emerald-400 text-xs px-2 py-1 rounded-full border border-emerald-500/20 font-medium">成功</span>
                </div>
                <div className={`h-px ${historyDivider} w-full`}></div>
                <div className="flex items-center justify-between text-xs">
                  <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>动作:</span>
                  <span className={isDark ? 'text-slate-200' : 'text-slate-700'}>重启缓存服务</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>耗时:</span>
                  <span className={isDark ? 'text-slate-200' : 'text-slate-700'}>12s</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AutoScaling;
