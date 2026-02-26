import React from 'react';
import { useThemeStore } from '../../stores/themeStore';

const HealthCheck: React.FC = () => {
  const { isDark } = useThemeStore();

  const headerBg = isDark ? 'bg-[#111722]/50' : 'bg-white/80';
  const cardBg = isDark ? 'bg-[#1e293b]' : 'bg-white';
  const borderColor = isDark ? 'border-[#2a3441]' : 'border-slate-200';
  const textColor = isDark ? 'text-white' : 'text-slate-900';
  const textSecondary = isDark ? 'text-slate-400' : 'text-slate-600';
  const tableHeaderBg = isDark ? 'bg-[#111722]' : 'bg-slate-100';
  const rowHoverBg = isDark ? 'hover:bg-[#1a2333]' : 'hover:bg-slate-50';
  const iconBg = isDark ? 'bg-[#232f48]' : 'bg-slate-100';
  const progressBg = isDark ? 'bg-[#232f48]' : 'bg-slate-200';
  const paginationBg = isDark ? 'bg-[#111722]/30' : 'bg-slate-50';

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Top Header */}
      <div className={`h-16 border-b ${borderColor} ${headerBg} backdrop-blur flex items-center justify-between px-8 shrink-0 -mx-6 -mt-6`}>
        <div className={`flex items-center gap-2 ${textSecondary}`}>
          <span className="text-sm">性能与高可用</span>
          <span className="material-symbols-outlined text-sm">chevron_right</span>
          <span className={`${textColor} text-sm font-medium`}>健康检查</span>
        </div>
        <div className="flex items-center gap-4">
          <button className={`flex items-center gap-2 ${textSecondary} transition-colors`}>
            <span className="material-symbols-outlined">notifications</span>
          </button>
          <button className={`flex items-center gap-2 ${textSecondary} transition-colors`}>
            <span className="material-symbols-outlined">help</span>
          </button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto space-y-6">

          {/* Cluster Status Banner */}
          <div className={`flex flex-col md:flex-row items-start md:items-center justify-between gap-6 rounded-xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 ${isDark ? 'to-[#111722]' : 'to-white'} p-6 shadow-lg shadow-green-900/10`}>
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-500 shrink-0 animate-pulse">
                <span className="material-symbols-outlined text-3xl">check_circle</span>
              </div>
              <div className="flex flex-col">
                <h2 className={`text-xl font-bold ${textColor} tracking-tight`}>集群健康状态: 运行正常 (Green)</h2>
                <p className={`${textSecondary} text-sm mt-1`}>所有核心服务均在线，上次检查时间：刚刚</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-end mr-4 hidden lg:flex">
                <span className={`text-xs ${textSecondary}`}>健康评分</span>
                <span className={`text-xl font-bold ${textColor}`}>98/100</span>
              </div>
              <div className={`h-8 w-px ${borderColor} mx-2 hidden lg:block`}></div>
              <button className="flex h-10 items-center justify-center gap-2 rounded-lg bg-[#135bec] px-5 text-sm font-medium text-white hover:bg-[#1a6fff] transition-all shadow-lg shadow-blue-900/20 active:scale-95">
                <span className="material-symbols-outlined text-[20px]">refresh</span>
                <span>执行全量诊断</span>
              </button>
            </div>
          </div>

          {/* Engines Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {/* Ingestion Engine */}
            <div className={`group flex flex-col gap-4 rounded-xl border ${borderColor} ${cardBg} p-5 hover:border-[#135bec]/50 transition-all hover:shadow-lg hover:shadow-blue-500/5 cursor-pointer`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded ${iconBg} ${textSecondary} group-hover:text-white group-hover:bg-[#135bec] transition-colors`}>
                    <span className="material-symbols-outlined text-[20px]">input</span>
                  </div>
                  <p className={`${textColor} text-sm font-medium leading-normal`}>采集引擎</p>
                </div>
                <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
              </div>
              <div className="space-y-1">
                <div className="flex items-baseline justify-between">
                  <span className={`${textSecondary} text-xs`}>在线率 (Uptime)</span>
                  <span className={`${textColor} font-mono font-bold`}>99.99%</span>
                </div>
                <div className={`w-full ${progressBg} rounded-full h-1.5`}>
                  <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: '99.99%' }}></div>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-baseline justify-between">
                  <span className={`${textSecondary} text-xs`}>响应延迟</span>
                  <span className="text-emerald-500 font-mono font-bold text-sm">+24ms</span>
                </div>
                <div className="flex items-end gap-[2px] h-6 pt-1 opacity-70">
                  <div className="w-1 bg-emerald-500 h-[40%] rounded-t-sm"></div>
                  <div className="w-1 bg-emerald-500 h-[60%] rounded-t-sm"></div>
                  <div className="w-1 bg-emerald-500 h-[50%] rounded-t-sm"></div>
                  <div className="w-1 bg-emerald-500 h-[70%] rounded-t-sm"></div>
                  <div className="w-1 bg-emerald-500 h-[45%] rounded-t-sm"></div>
                  <div className="w-1 bg-emerald-500 h-[30%] rounded-t-sm"></div>
                  <div className="w-1 bg-emerald-500 h-[60%] rounded-t-sm"></div>
                  <div className="w-1 bg-emerald-500 h-[80%] rounded-t-sm"></div>
                </div>
              </div>
              <div className={`pt-3 border-t ${borderColor} flex items-center justify-between text-xs`}>
                <span className={textSecondary}>依赖组件</span>
                <span className="text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">Kafka: 正常</span>
              </div>
            </div>
            {/* Storage Engine */}
            <div className={`group flex flex-col gap-4 rounded-xl border ${borderColor} ${cardBg} p-5 hover:border-[#135bec]/50 transition-all hover:shadow-lg hover:shadow-blue-500/5 cursor-pointer`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded ${iconBg} ${textSecondary} group-hover:text-white group-hover:bg-[#135bec] transition-colors`}>
                    <span className="material-symbols-outlined text-[20px]">database</span>
                  </div>
                  <p className={`${textColor} text-sm font-medium leading-normal`}>存储引擎</p>
                </div>
                <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
              </div>
              <div className="space-y-1">
                <div className="flex items-baseline justify-between">
                  <span className={`${textSecondary} text-xs`}>在线率 (Uptime)</span>
                  <span className={`${textColor} font-mono font-bold`}>99.95%</span>
                </div>
                <div className={`w-full ${progressBg} rounded-full h-1.5`}>
                  <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: '99.95%' }}></div>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-baseline justify-between">
                  <span className={`${textSecondary} text-xs`}>响应延迟</span>
                  <span className="text-amber-500 font-mono font-bold text-sm">+45ms</span>
                </div>
                <div className="flex items-end gap-[2px] h-6 pt-1 opacity-70">
                  <div className="w-1 bg-amber-500 h-[50%] rounded-t-sm"></div>
                  <div className="w-1 bg-amber-500 h-[60%] rounded-t-sm"></div>
                  <div className="w-1 bg-amber-500 h-[90%] rounded-t-sm"></div>
                  <div className="w-1 bg-amber-500 h-[70%] rounded-t-sm"></div>
                  <div className="w-1 bg-amber-500 h-[85%] rounded-t-sm"></div>
                  <div className="w-1 bg-amber-500 h-[60%] rounded-t-sm"></div>
                  <div className="w-1 bg-amber-500 h-[50%] rounded-t-sm"></div>
                  <div className="w-1 bg-amber-500 h-[55%] rounded-t-sm"></div>
                </div>
              </div>
              <div className={`pt-3 border-t ${borderColor} flex items-center justify-between text-xs`}>
                <span className={textSecondary}>依赖组件</span>
                <span className="text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">Elastic: 正常</span>
              </div>
            </div>
            {/* Alerting Engine */}
            <div className={`group flex flex-col gap-4 rounded-xl border ${borderColor} ${cardBg} p-5 hover:border-[#135bec]/50 transition-all hover:shadow-lg hover:shadow-blue-500/5 cursor-pointer`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded ${iconBg} ${textSecondary} group-hover:text-white group-hover:bg-[#135bec] transition-colors`}>
                    <span className="material-symbols-outlined text-[20px]">notifications_active</span>
                  </div>
                  <p className={`${textColor} text-sm font-medium leading-normal`}>告警引擎</p>
                </div>
                <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
              </div>
              <div className="space-y-1">
                <div className="flex items-baseline justify-between">
                  <span className={`${textSecondary} text-xs`}>在线率 (Uptime)</span>
                  <span className={`${textColor} font-mono font-bold`}>100.00%</span>
                </div>
                <div className={`w-full ${progressBg} rounded-full h-1.5`}>
                  <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: '100%' }}></div>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-baseline justify-between">
                  <span className={`${textSecondary} text-xs`}>响应延迟</span>
                  <span className="text-emerald-500 font-mono font-bold text-sm">+12ms</span>
                </div>
                <div className="flex items-end gap-[2px] h-6 pt-1 opacity-70">
                  <div className="w-1 bg-emerald-500 h-[30%] rounded-t-sm"></div>
                  <div className="w-1 bg-emerald-500 h-[30%] rounded-t-sm"></div>
                  <div className="w-1 bg-emerald-500 h-[40%] rounded-t-sm"></div>
                  <div className="w-1 bg-emerald-500 h-[35%] rounded-t-sm"></div>
                  <div className="w-1 bg-emerald-500 h-[30%] rounded-t-sm"></div>
                  <div className="w-1 bg-emerald-500 h-[30%] rounded-t-sm"></div>
                  <div className="w-1 bg-emerald-500 h-[40%] rounded-t-sm"></div>
                  <div className="w-1 bg-emerald-500 h-[30%] rounded-t-sm"></div>
                </div>
              </div>
              <div className={`pt-3 border-t ${borderColor} flex items-center justify-between text-xs`}>
                <span className={textSecondary}>依赖组件</span>
                <span className="text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">Redis: 正常</span>
              </div>
            </div>
            {/* API Gateway */}
            <div className={`group flex flex-col gap-4 rounded-xl border ${borderColor} ${cardBg} p-5 hover:border-[#135bec]/50 transition-all hover:shadow-lg hover:shadow-blue-500/5 cursor-pointer`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded ${iconBg} ${textSecondary} group-hover:text-white group-hover:bg-[#135bec] transition-colors`}>
                    <span className="material-symbols-outlined text-[20px]">hub</span>
                  </div>
                  <p className={`${textColor} text-sm font-medium leading-normal`}>API 网关</p>
                </div>
                <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
              </div>
              <div className="space-y-1">
                <div className="flex items-baseline justify-between">
                  <span className={`${textSecondary} text-xs`}>在线率 (Uptime)</span>
                  <span className={`${textColor} font-mono font-bold`}>99.90%</span>
                </div>
                <div className={`w-full ${progressBg} rounded-full h-1.5`}>
                  <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: '99.90%' }}></div>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-baseline justify-between">
                  <span className={`${textSecondary} text-xs`}>响应延迟</span>
                  <span className="text-emerald-500 font-mono font-bold text-sm">+15ms</span>
                </div>
                <div className="flex items-end gap-[2px] h-6 pt-1 opacity-70">
                  <div className="w-1 bg-emerald-500 h-[40%] rounded-t-sm"></div>
                  <div className="w-1 bg-emerald-500 h-[50%] rounded-t-sm"></div>
                  <div className="w-1 bg-emerald-500 h-[45%] rounded-t-sm"></div>
                  <div className="w-1 bg-emerald-500 h-[60%] rounded-t-sm"></div>
                  <div className="w-1 bg-emerald-500 h-[50%] rounded-t-sm"></div>
                  <div className="w-1 bg-emerald-500 h-[40%] rounded-t-sm"></div>
                  <div className="w-1 bg-emerald-500 h-[55%] rounded-t-sm"></div>
                  <div className="w-1 bg-emerald-500 h-[45%] rounded-t-sm"></div>
                </div>
              </div>
              <div className={`pt-3 border-t ${borderColor} flex items-center justify-between text-xs`}>
                <span className={textSecondary}>依赖组件</span>
                <span className="text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">Nginx: 正常</span>
              </div>
            </div>
          </div>

          {/* Health Event Log Table */}
          <div className={`rounded-xl border ${borderColor} ${cardBg} overflow-hidden flex flex-col shadow-xl`}>
            <div className={`px-6 py-4 border-b ${borderColor} flex items-center justify-between ${isDark ? 'bg-[#111722]/50' : 'bg-slate-50'}`}>
              <h3 className={`${textColor} text-base font-bold flex items-center gap-2`}>
                <span className={`material-symbols-outlined ${textSecondary} text-[20px]`}>history</span>
                健康事件日志
              </h3>
              <div className="flex gap-2">
                <button className={`px-3 py-1.5 rounded text-xs font-medium ${iconBg} ${textColor} ${isDark ? 'hover:bg-[#324467]' : 'hover:bg-slate-200'} transition-colors`}>导出日志</button>
                <button className={`px-3 py-1.5 rounded text-xs font-medium ${textSecondary} transition-colors`}>配置通知</button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className={`${tableHeaderBg} ${textSecondary} text-xs uppercase font-medium`}>
                  <tr>
                    <th className="px-6 py-3 tracking-wider">时间戳</th>
                    <th className="px-6 py-3 tracking-wider">组件</th>
                    <th className="px-6 py-3 tracking-wider">事件类型</th>
                    <th className="px-6 py-3 tracking-wider w-1/2">消息内容</th>
                    <th className="px-6 py-3 tracking-wider text-right">操作</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-[#232f48]' : 'divide-slate-200'} text-sm`}>
                  <tr className={`${rowHoverBg} transition-colors`}>
                    <td className={`px-6 py-4 whitespace-nowrap ${textSecondary} font-mono text-xs`}>2023-10-27 10:45:00</td>
                    <td className={`px-6 py-4 whitespace-nowrap ${textColor}`}>存储引擎</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-500 border border-blue-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>Info
                      </span>
                    </td>
                    <td className={`px-6 py-4 ${isDark ? 'text-[#d1d5db]' : 'text-slate-600'}`}>自动扩容已触发: 节点 storage-node-04 已加入集群，正在同步数据。</td>
                    <td className="px-6 py-4 text-right">
                      <span className={`material-symbols-outlined ${textSecondary} cursor-pointer text-[18px]`}>visibility</span>
                    </td>
                  </tr>
                  <tr className={`${rowHoverBg} transition-colors`}>
                    <td className={`px-6 py-4 whitespace-nowrap ${textSecondary} font-mono text-xs`}>2023-10-27 10:42:12</td>
                    <td className={`px-6 py-4 whitespace-nowrap ${textColor}`}>API 网关</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-500 border border-emerald-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Success
                      </span>
                    </td>
                    <td className={`px-6 py-4 ${isDark ? 'text-[#d1d5db]' : 'text-slate-600'}`}>定期健康检查通过: 所有端点响应时间 &lt; 200ms。</td>
                    <td className="px-6 py-4 text-right">
                      <span className={`material-symbols-outlined ${textSecondary} cursor-pointer text-[18px]`}>visibility</span>
                    </td>
                  </tr>
                  <tr className={`${rowHoverBg} transition-colors`}>
                    <td className={`px-6 py-4 whitespace-nowrap ${textSecondary} font-mono text-xs`}>2023-10-27 10:30:05</td>
                    <td className={`px-6 py-4 whitespace-nowrap ${textColor}`}>采集引擎</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-500 border border-amber-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>Warning
                      </span>
                    </td>
                    <td className={`px-6 py-4 ${isDark ? 'text-[#d1d5db]' : 'text-slate-600'}`}>检测到轻微延迟增加: Kafka 消费者组 lag &gt; 1000 msg。</td>
                    <td className="px-6 py-4 text-right">
                      <span className={`material-symbols-outlined ${textSecondary} cursor-pointer text-[18px]`}>visibility</span>
                    </td>
                  </tr>
                  <tr className={`${rowHoverBg} transition-colors`}>
                    <td className={`px-6 py-4 whitespace-nowrap ${textSecondary} font-mono text-xs`}>2023-10-27 09:15:22</td>
                    <td className={`px-6 py-4 whitespace-nowrap ${textColor}`}>系统核心</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-500 border border-emerald-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Success
                      </span>
                    </td>
                    <td className={`px-6 py-4 ${isDark ? 'text-[#d1d5db]' : 'text-slate-600'}`}>每日备份任务完成: Backup ID #99283712。</td>
                    <td className="px-6 py-4 text-right">
                      <span className={`material-symbols-outlined ${textSecondary} cursor-pointer text-[18px]`}>visibility</span>
                    </td>
                  </tr>
                  <tr className={`${rowHoverBg} transition-colors`}>
                    <td className={`px-6 py-4 whitespace-nowrap ${textSecondary} font-mono text-xs`}>2023-10-27 08:00:00</td>
                    <td className={`px-6 py-4 whitespace-nowrap ${textColor}`}>告警引擎</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-500 border border-blue-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>Info
                      </span>
                    </td>
                    <td className={`px-6 py-4 ${isDark ? 'text-[#d1d5db]' : 'text-slate-600'}`}>规则重载: 更新了 5 个新的告警规则。</td>
                    <td className="px-6 py-4 text-right">
                      <span className={`material-symbols-outlined ${textSecondary} cursor-pointer text-[18px]`}>visibility</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className={`px-6 py-3 border-t ${isDark ? 'border-[#232f48]' : 'border-slate-200'} ${paginationBg} flex items-center justify-between text-xs ${textSecondary}`}>
              <span>显示 1 至 5 条，共 142 条记录</span>
              <div className="flex gap-1">
                <button className={`p-1 rounded ${isDark ? 'hover:bg-[#232f48]' : 'hover:bg-slate-200'} disabled:opacity-50`} disabled>
                  <span className="material-symbols-outlined text-sm">chevron_left</span>
                </button>
                <button className={`p-1 rounded ${isDark ? 'hover:bg-[#232f48]' : 'hover:bg-slate-200'}`}>
                  <span className="material-symbols-outlined text-sm">chevron_right</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HealthCheck;
