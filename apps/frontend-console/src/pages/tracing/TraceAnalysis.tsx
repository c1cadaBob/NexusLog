import React, { useState } from 'react';
import { useThemeStore } from '../../stores/themeStore';

// Span 数据类型
interface Span {
  id: string;
  parentId?: string;
  service: string;
  operation: string;
  duration: number;
  startOffset: number;
  status: 'success' | 'error';
  color: string;
  depth: number;
  tags?: Record<string, string>;
  logs?: Array<{ timestamp: string; message: string }>;
  error?: { message: string; stack: string };
}

// 模拟 Span 数据
const mockSpans: Span[] = [
  { id: 'span-1', service: 'Frontend-Service', operation: 'GET /api/checkout', duration: 245, startOffset: 0, status: 'error', color: 'blue', depth: 0 },
  { id: 'span-2', parentId: 'span-1', service: 'Auth-Service', operation: 'Verify Token', duration: 20, startOffset: 5, status: 'success', color: 'purple', depth: 1 },
  { id: 'span-3', parentId: 'span-1', service: 'Order-Service', operation: 'Create Order', duration: 150, startOffset: 30, status: 'success', color: 'orange', depth: 1 },
  { id: 'span-4', parentId: 'span-3', service: 'Payment-Service', operation: 'Charge Card', duration: 85, startOffset: 50, status: 'error', color: 'pink', depth: 2, error: { message: 'Connection timeout during external API call', stack: 'at com.payment.gateway.Charge(Card card)\nat com.payment.service.Handler.handle(req)\n... 14 more' } },
  { id: 'span-5', parentId: 'span-4', service: 'Database', operation: 'INSERT transactions', duration: 45, startOffset: 55, status: 'success', color: 'emerald', depth: 3 },
  { id: 'span-6', parentId: 'span-1', service: 'Inventory-Service', operation: 'Check Stock', duration: 35, startOffset: 185, status: 'success', color: 'cyan', depth: 1 },
  { id: 'span-7', parentId: 'span-6', service: 'Database', operation: 'SELECT products', duration: 25, startOffset: 190, status: 'success', color: 'emerald', depth: 2 },
];

const TraceAnalysis: React.FC = () => {
  const { isDark } = useThemeStore();
  const [selectedSpan, setSelectedSpan] = useState<Span | null>(mockSpans[3]);
  const [expandedSpans, setExpandedSpans] = useState<Set<string>>(new Set(mockSpans.map(s => s.id)));
  const [activeTab, setActiveTab] = useState<'attributes' | 'logs' | 'process'>('attributes');

  const totalDuration = 245;

  const toggleSpan = (spanId: string) => {
    setExpandedSpans(prev => {
      const next = new Set(prev);
      if (next.has(spanId)) next.delete(spanId);
      else next.add(spanId);
      return next;
    });
  };

  const getBarStyle = (span: Span) => {
    const left = (span.startOffset / totalDuration) * 100;
    const width = (span.duration / totalDuration) * 100;
    return { left: `${left}%`, width: `${Math.max(width, 2)}%` };
  };

  const colorMap: Record<string, { bg: string; border: string; text: string }> = {
    blue: { bg: isDark ? 'bg-blue-500/20' : 'bg-blue-100', border: 'border-blue-500/50', text: isDark ? 'text-blue-200' : 'text-blue-700' },
    purple: { bg: isDark ? 'bg-purple-500/20' : 'bg-purple-100', border: 'border-purple-500/50', text: isDark ? 'text-purple-200' : 'text-purple-700' },
    orange: { bg: isDark ? 'bg-orange-500/20' : 'bg-orange-100', border: 'border-orange-500/50', text: isDark ? 'text-orange-200' : 'text-orange-700' },
    pink: { bg: isDark ? 'bg-pink-500/20' : 'bg-pink-100', border: 'border-pink-500/50', text: isDark ? 'text-pink-200' : 'text-pink-700' },
    emerald: { bg: isDark ? 'bg-emerald-500/20' : 'bg-emerald-100', border: 'border-emerald-500/50', text: isDark ? 'text-emerald-200' : 'text-emerald-700' },
    cyan: { bg: isDark ? 'bg-cyan-500/20' : 'bg-cyan-100', border: 'border-cyan-500/50', text: isDark ? 'text-cyan-200' : 'text-cyan-700' },
  };

  const pageBg = isDark ? 'bg-[#0f172a]' : 'bg-slate-100';
  const headerBg = isDark ? 'bg-[#111722]' : 'bg-white';
  const cardBg = isDark ? 'bg-[#1e293b]' : 'bg-white';
  const cardBgHalf = isDark ? 'bg-[#1e293b]/50' : 'bg-slate-50';
  const borderColor = isDark ? 'border-border-dark' : 'border-slate-200';
  const textColor = isDark ? 'text-white' : 'text-slate-900';
  const textSecondary = isDark ? 'text-text-secondary' : 'text-slate-600';
  const hoverBg = isDark ? 'hover:bg-[#1e293b]/40' : 'hover:bg-slate-100';

  return (
    <div className={`flex flex-col h-full overflow-hidden ${pageBg} -mx-6 -mt-6 -mb-6`}>
      <header className={`${headerBg} border-b ${borderColor} px-6 py-4 shadow-sm z-10 flex-shrink-0`}>
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className={`text-2xl font-bold ${textColor} tracking-tight`}>Trace 详情</h2>
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-danger/20 text-danger border border-danger/30">错误</span>
              </div>
              <div className={`flex items-center gap-2 ${textSecondary} text-sm font-mono`}>
                <span>Trace ID:</span>
                <span className={`${textColor} select-all`}>a1b2c3d4e5f67890</span>
                <button className={`${textSecondary} ${isDark ? 'hover:text-white' : 'hover:text-slate-900'} transition-colors`}>
                  <span className="material-symbols-outlined text-sm">content_copy</span>
                </button>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { window.location.hash = '#/help/faq'; }} className={`flex items-center gap-2 px-3 py-1.5 ${cardBg} ${isDark ? 'hover:bg-[#2a3850]' : 'hover:bg-slate-100'} ${textColor} text-sm font-medium rounded border ${borderColor} transition-colors`}>
                <span className="material-symbols-outlined text-sm">help</span>
                帮助
              </button>
              <button className={`flex items-center gap-2 px-3 py-1.5 ${cardBg} ${isDark ? 'hover:bg-[#2a3850]' : 'hover:bg-slate-100'} ${textColor} text-sm font-medium rounded border ${borderColor} transition-colors`}>
                <span className="material-symbols-outlined text-sm">download</span>
                导出
              </button>
              <button className="flex items-center gap-2 px-3 py-1.5 bg-primary hover:bg-primary-hover text-white text-sm font-medium rounded transition-colors shadow-lg shadow-primary/20">
                <span className="material-symbols-outlined text-sm">refresh</span>
                重放
              </button>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div className={`${cardBgHalf} p-3 rounded border ${isDark ? 'border-border-dark/50' : 'border-slate-200'}`}>
              <p className={`${textSecondary} text-xs uppercase tracking-wide font-semibold`}>开始时间</p>
              <p className={`${textColor} font-mono text-sm mt-1`}>2026-02-13 14:30:05.120</p>
            </div>
            <div className={`${cardBgHalf} p-3 rounded border ${isDark ? 'border-border-dark/50' : 'border-slate-200'}`}>
              <p className={`${textSecondary} text-xs uppercase tracking-wide font-semibold`}>总耗时</p>
              <p className={`${textColor} font-mono text-lg font-bold mt-1`}>{totalDuration}ms</p>
            </div>
            <div className={`${cardBgHalf} p-3 rounded border ${isDark ? 'border-border-dark/50' : 'border-slate-200'}`}>
              <p className={`${textSecondary} text-xs uppercase tracking-wide font-semibold`}>Span 数量</p>
              <p className={`${textColor} font-mono text-lg font-bold mt-1`}>{mockSpans.length}</p>
            </div>
            <div className={`${cardBgHalf} p-3 rounded border border-red-900/30 relative overflow-hidden group`}>
              <div className="absolute inset-0 bg-danger/5 group-hover:bg-danger/10 transition-colors"></div>
              <p className="text-danger text-xs uppercase tracking-wide font-semibold relative z-10">错误数</p>
              <p className="text-danger font-mono text-lg font-bold mt-1 relative z-10">{mockSpans.filter(s => s.status === 'error').length}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className={`flex-1 flex flex-col min-w-0 border-r ${borderColor} ${pageBg} overflow-hidden relative`}>
          <div className={`h-8 ${cardBg} border-b ${borderColor} flex items-center sticky top-0 z-10`}>
            <div className={`w-1/3 px-4 border-r ${borderColor} h-full flex items-center`}>
              <span className={`text-xs ${textSecondary} font-medium`}>服务 & 操作</span>
            </div>
            <div className="flex-1 relative h-full">
              {[0, 25, 50, 75, 100].map(pct => (
                <React.Fragment key={pct}>
                  <div className={`absolute top-0 bottom-0 w-px ${isDark ? 'bg-border-dark/50' : 'bg-slate-300'}`} style={{ left: `${pct}%` }}></div>
                  <span className={`absolute top-1 text-[10px] ${textSecondary}`} style={{ left: pct === 100 ? 'auto' : `${pct}%`, right: pct === 100 ? '4px' : 'auto', marginLeft: pct === 0 ? '4px' : pct === 100 ? 0 : '4px' }}>
                    {Math.round(totalDuration * pct / 100)}ms
                  </span>
                </React.Fragment>
              ))}
            </div>
          </div>
          <div className="overflow-y-auto flex-1 pb-10 custom-scrollbar">
            {mockSpans.map(span => (
              <div
                key={span.id}
                onClick={() => setSelectedSpan(span)}
                className={`group ${hoverBg} transition-colors border-b ${isDark ? 'border-border-dark/30' : 'border-slate-200'} flex h-9 items-center cursor-pointer ${selectedSpan?.id === span.id ? 'bg-primary/5 border-l-4 border-l-primary' : ''}`}
              >
                <div className={`w-1/3 px-4 py-1 flex items-center gap-2 border-r ${isDark ? 'border-border-dark/30' : 'border-slate-200'} truncate h-full relative`} style={{ paddingLeft: `${16 + span.depth * 16}px` }}>
                  {span.depth > 0 && Array.from({ length: span.depth }).map((_, i) => (
                    <div key={i} className={`absolute top-0 bottom-0 w-px ${isDark ? 'bg-border-dark/50' : 'bg-slate-300'}`} style={{ left: `${19 + i * 16}px` }}></div>
                  ))}
                  <button onClick={(e) => { e.stopPropagation(); toggleSpan(span.id); }} className={`material-symbols-outlined ${textSecondary} text-sm ${isDark ? 'hover:text-white' : 'hover:text-slate-900'} z-10 ${pageBg}`}>
                    {expandedSpans.has(span.id) ? 'expand_more' : 'chevron_right'}
                  </button>
                  <div className={`w-2 h-2 rounded-full bg-${span.color}-500 z-10`}></div>
                  <span className={`text-sm ${textColor} font-medium truncate z-10`}>{span.service}</span>
                  <span className={`text-xs ${textSecondary} truncate ml-auto z-10`}>{span.operation}</span>
                  {span.status === 'error' && <span className="material-symbols-outlined text-danger text-[16px] z-10">error</span>}
                </div>
                <div className="flex-1 relative h-full px-2 py-2">
                  <div className="h-full relative w-full">
                    {[25, 50, 75].map(pct => (
                      <div key={pct} className={`absolute inset-y-0 w-px border-l border-dashed ${isDark ? 'border-border-dark/20' : 'border-slate-300'}`} style={{ left: `${pct}%` }}></div>
                    ))}
                    <div
                      className={`absolute h-4 ${span.status === 'error' ? 'bg-danger/20 border-danger/50' : colorMap[span.color]?.bg} border ${span.status === 'error' ? 'border-danger/50' : colorMap[span.color]?.border} rounded flex items-center hover:opacity-80 cursor-pointer ${span.status === 'error' ? 'shadow-[0_0_10px_rgba(239,68,68,0.2)]' : ''}`}
                      style={getBarStyle(span)}
                    >
                      <span className={`text-[10px] ${span.status === 'error' ? 'text-red-200 font-bold' : colorMap[span.color]?.text} px-2 truncate`}>
                        {span.duration}ms{span.status === 'error' ? ' (错误)' : ''}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className={`w-96 ${cardBg} border-l ${borderColor} flex flex-col z-20 shadow-xl`}>
          {selectedSpan ? (
            <>
              <div className={`p-4 border-b ${borderColor} flex justify-between items-start ${cardBg}`}>
                <div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full bg-${selectedSpan.color}-500`}></div>
                    <span className={`text-xs uppercase font-bold ${textSecondary} tracking-wider`}>{selectedSpan.service}</span>
                  </div>
                  <h3 className={`text-lg font-bold ${textColor} mt-1`}>{selectedSpan.operation}</h3>
                  <p className={`text-xs ${textSecondary} mt-0.5`}>Span ID: {selectedSpan.id}</p>
                </div>
                <button onClick={() => setSelectedSpan(null)} className={`${textSecondary} ${isDark ? 'hover:text-white' : 'hover:text-slate-900'}`}>
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <div className={`flex border-b ${borderColor} px-4`}>
                {(['attributes', 'logs', 'process'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-3 text-sm font-medium ${activeTab === tab ? 'text-primary border-b-2 border-primary' : `${textSecondary} ${isDark ? 'hover:text-white' : 'hover:text-slate-900'}`} transition-colors`}
                  >
                    {tab === 'attributes' ? '属性' : tab === 'logs' ? '日志' : '进程'}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                {selectedSpan.error && (
                  <div className="bg-danger/10 border border-danger/30 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="material-symbols-outlined text-danger text-sm">error</span>
                      <span className="text-red-400 font-bold text-sm">检测到错误</span>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <p className="text-[10px] uppercase text-red-400/70 font-semibold">错误信息</p>
                        <p className="text-sm text-red-200 font-mono mt-0.5">{selectedSpan.error.message}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-red-400/70 font-semibold">堆栈跟踪</p>
                        <div className={`${isDark ? 'bg-black/30' : 'bg-red-50'} rounded p-2 mt-1 overflow-x-auto`}>
                          <code className={`text-xs ${isDark ? 'text-red-300/80' : 'text-red-600'} font-mono block whitespace-pre`}>{selectedSpan.error.stack}</code>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div>
                  <h4 className={`text-xs font-bold ${textSecondary} uppercase mb-3 flex items-center gap-2`}>
                    <span className="material-symbols-outlined text-sm">label</span>
                    Span 属性
                  </h4>
                  <div className="space-y-3">
                    {[
                      { key: 'http.method', value: 'POST' },
                      { key: 'http.url', value: 'http://payment-gateway.internal/v1/charge' },
                      { key: 'http.status_code', value: selectedSpan.status === 'error' ? '500' : '200', isError: selectedSpan.status === 'error' },
                      { key: 'component', value: 'gRPC' },
                      { key: 'peer.service', value: 'external-payment-provider' },
                    ].map(attr => (
                      <div key={attr.key} className={`grid grid-cols-[100px_1fr] gap-2 text-sm border-b ${isDark ? 'border-border-dark/50' : 'border-slate-200'} pb-2`}>
                        <span className={`${textSecondary} font-mono text-xs`}>{attr.key}</span>
                        <span className={`${attr.isError ? 'text-red-400 font-bold' : textColor} font-mono text-xs ${!attr.isError ? `${cardBgHalf} px-1.5 py-0.5 rounded w-fit` : ''}`}>{attr.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className={`text-xs font-bold ${textSecondary} uppercase mb-3 flex items-center gap-2`}>
                    <span className="material-symbols-outlined text-sm">schedule</span>
                    时间信息
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className={`${cardBgHalf} p-2 rounded`}>
                      <p className={`text-[10px] ${textSecondary} uppercase`}>开始偏移</p>
                      <p className={`${textColor} font-mono text-sm font-medium`}>{selectedSpan.startOffset}ms</p>
                    </div>
                    <div className={`${cardBgHalf} p-2 rounded`}>
                      <p className={`text-[10px] ${textSecondary} uppercase`}>持续时间</p>
                      <p className={`${textColor} font-mono text-sm font-medium`}>{selectedSpan.duration}ms</p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className={`flex-1 flex items-center justify-center ${textSecondary}`}>
              <div className="text-center">
                <span className="material-symbols-outlined text-4xl mb-2 block opacity-50">touch_app</span>
                <p>点击左侧 Span 查看详情</p>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

export default TraceAnalysis;
