import React, { useState } from 'react';
import { useThemeStore } from '../../stores/themeStore';

// 服务节点类型
interface ServiceNode {
  id: string;
  name: string;
  type: 'gateway' | 'service' | 'database' | 'cache';
  protocol: string;
  status: 'healthy' | 'warning' | 'critical';
  position: { top: string; left: string };
  metrics: {
    latency: number;
    rpm: number;
    errorRate: number;
  };
}

// 连接类型
interface ServiceLink {
  from: string;
  to: string;
  status: 'healthy' | 'error';
}

// 模拟服务节点数据
const mockNodes: ServiceNode[] = [
  { id: 'gateway', name: 'API Gateway', type: 'gateway', protocol: 'HTTP / JSON', status: 'healthy', position: { top: '45%', left: '15%' }, metrics: { latency: 45, rpm: 2500, errorRate: 0.1 } },
  { id: 'auth', name: 'Auth Service', type: 'service', protocol: 'gRPC', status: 'healthy', position: { top: '25%', left: '45%' }, metrics: { latency: 25, rpm: 1200, errorRate: 0.05 } },
  { id: 'payment', name: 'Payment Service', type: 'service', protocol: 'gRPC', status: 'critical', position: { top: '65%', left: '45%' }, metrics: { latency: 320, rpm: 850, errorRate: 2.4 } },
  { id: 'userdb', name: 'User DB', type: 'database', protocol: 'PostgreSQL', status: 'healthy', position: { top: '25%', left: '75%' }, metrics: { latency: 8, rpm: 1200, errorRate: 0 } },
  { id: 'orderdb', name: 'Order DB', type: 'database', protocol: 'MongoDB', status: 'healthy', position: { top: '65%', left: '75%' }, metrics: { latency: 15, rpm: 420, errorRate: 0 } },
  { id: 'redis', name: 'Redis Cluster', type: 'cache', protocol: 'Redis', status: 'healthy', position: { top: '88%', left: '58%' }, metrics: { latency: 2, rpm: 5000, errorRate: 0 } },
];

// 模拟连接数据
const mockLinks: ServiceLink[] = [
  { from: 'gateway', to: 'auth', status: 'healthy' },
  { from: 'gateway', to: 'payment', status: 'error' },
  { from: 'auth', to: 'userdb', status: 'healthy' },
  { from: 'payment', to: 'orderdb', status: 'healthy' },
  { from: 'payment', to: 'redis', status: 'healthy' },
];

const ServiceTopology: React.FC = () => {
  const { isDark } = useThemeStore();
  const [selectedNode, setSelectedNode] = useState<ServiceNode | null>(mockNodes.find(n => n.id === 'payment') || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'2d' | 'list'>('2d');

  const filteredNodes = mockNodes.filter(node => 
    node.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getNodeIcon = (type: ServiceNode['type']) => {
    switch (type) {
      case 'gateway': return 'language';
      case 'service': return 'payments';
      case 'database': return 'database';
      case 'cache': return 'memory';
      default: return 'dns';
    }
  };

  const getStatusColor = (status: ServiceNode['status']) => {
    switch (status) {
      case 'healthy': return 'success';
      case 'warning': return 'warning';
      case 'critical': return 'danger';
      default: return 'success';
    }
  };

  const pageBg = isDark ? 'bg-[#0b0e14]' : 'bg-slate-100';
  const headerBg = isDark ? 'bg-[#111722]' : 'bg-white';
  const cardBg = isDark ? 'bg-[#1a2230]' : 'bg-white';
  const cardBgHalf = isDark ? 'bg-[#1a2230]/80' : 'bg-white/90';
  const borderColor = isDark ? 'border-border-dark' : 'border-slate-200';
  const textColor = isDark ? 'text-white' : 'text-slate-900';
  const textSecondary = isDark ? 'text-text-secondary' : 'text-slate-600';
  const hoverBg = isDark ? 'hover:bg-[#232f48]' : 'hover:bg-slate-100';
  const buttonBg = isDark ? 'bg-[#2a3649]' : 'bg-slate-200';
  const buttonHover = isDark ? 'hover:bg-[#324467]' : 'hover:bg-slate-300';
  const asideBg = isDark ? 'bg-[#111722]' : 'bg-white';
  const nodeBg = isDark ? 'bg-[#1a2230]' : 'bg-white';

  return (
    <div className={`flex flex-col h-full overflow-hidden relative -mx-6 -mt-6 -mb-6 ${pageBg}`}>
      <header className={`min-h-[80px] border-b ${borderColor} ${headerBg} flex flex-wrap items-start justify-between gap-4 px-6 py-4 z-10 shrink-0`}>
        <div className="flex flex-wrap items-center gap-4">
          <h1 className={`text-2xl font-bold ${textColor} font-display tracking-tight`}>服务拓扑图</h1>
          <div className={`h-6 w-px ${isDark ? 'bg-border-dark' : 'bg-slate-200'}`}></div>
          <div className="relative group">
            <button className={`flex items-center gap-2 text-sm ${textSecondary} font-medium px-3 py-1.5 rounded ${cardBg} border ${borderColor}`}>
              <span className="w-2 h-2 rounded-full bg-success"></span>
              生产环境 (Production)
              <span className="material-symbols-outlined text-sm">expand_more</span>
            </button>
          </div>
        </div>
        <div className="flex items-center flex-wrap justify-end gap-3">
          <button
            onClick={() => { window.location.hash = '#/help/faq'; }}
            className={`flex items-center gap-2 px-3 py-1.5 text-sm ${textSecondary} font-medium rounded ${cardBg} border ${borderColor}`}
          >
            <span className="material-symbols-outlined text-[18px]">help</span>
            帮助
          </button>
          <div className="relative">
            <span className={`material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 ${textSecondary} text-[18px]`}>search</span>
            <input 
              id="service-topology-search"
              name="serviceTopologySearch"
              className={`${cardBg} border ${borderColor} ${textColor} text-sm rounded-lg pl-9 pr-3 py-1.5 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-64 placeholder-text-secondary`} 
              placeholder="搜索服务..." 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className={`flex ${cardBg} p-1 rounded-lg border ${borderColor}`}>
            <button 
              onClick={() => setViewMode('2d')}
              className={`px-3 py-1 rounded text-xs font-medium ${viewMode === '2d' ? `${buttonBg} ${textColor} shadow-sm` : textSecondary}`}
            >
              2D 视图
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`px-3 py-1 rounded text-xs font-medium ${viewMode === 'list' ? `${buttonBg} ${textColor} shadow-sm` : textSecondary}`}
            >
              列表
            </button>
          </div>
          <div className={`flex items-center gap-2 border-l ${borderColor} pl-3 ml-1`}>
            <button className="flex items-center gap-2 text-sm font-medium text-white bg-primary hover:bg-primary-hover px-4 py-1.5 rounded-lg transition-colors">
              <span className="material-symbols-outlined text-[18px]">refresh</span>
              刷新
            </button>
            <button className={`p-1.5 ${textSecondary} rounded-lg ${hoverBg}`}>
              <span className="material-symbols-outlined">more_vert</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {viewMode === '2d' ? (
          <div className="flex-1 relative overflow-hidden topology-grid">
            <div className="absolute bottom-6 left-6 flex flex-col gap-2 z-10">
              <div className={`${cardBg} border ${borderColor} rounded-lg flex flex-col p-1 shadow-lg`}>
                <button className={`p-2 ${textSecondary} ${hoverBg} rounded`}><span className="material-symbols-outlined">add</span></button>
                <button className={`p-2 ${textSecondary} ${hoverBg} rounded`}><span className="material-symbols-outlined">remove</span></button>
                <div className={`h-px ${isDark ? 'bg-border-dark' : 'bg-slate-200'} my-1 mx-2`}></div>
                <button className={`p-2 ${textSecondary} ${hoverBg} rounded`}><span className="material-symbols-outlined">fit_screen</span></button>
              </div>
            </div>
            
            <div className={`absolute top-6 left-6 ${cardBgHalf} backdrop-blur-sm border ${borderColor} rounded-lg p-3 z-10 shadow-lg`}>
              <h4 className={`text-xs font-bold ${textSecondary} uppercase mb-2 tracking-wider`}>图例</h4>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-success"></span>
                  <span className={`text-xs ${textColor}`}>正常 (Healthy)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-warning"></span>
                  <span className={`text-xs ${textColor}`}>警告 (Warning)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-danger"></span>
                  <span className={`text-xs ${textColor}`}>错误 (Critical)</span>
                </div>
              </div>
            </div>

            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
              <defs>
                <linearGradient id="grad-healthy" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#324467" stopOpacity="0.2" />
                  <stop offset="50%" stopColor="#135bec" stopOpacity="1" />
                  <stop offset="100%" stopColor="#324467" stopOpacity="0.2" />
                </linearGradient>
                <linearGradient id="grad-error" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#324467" stopOpacity="0.2" />
                  <stop offset="50%" stopColor="#ef4444" stopOpacity="1" />
                  <stop offset="100%" stopColor="#324467" stopOpacity="0.2" />
                </linearGradient>
              </defs>
              {mockLinks.map((link, idx) => {
                const fromNode = mockNodes.find(n => n.id === link.from);
                const toNode = mockNodes.find(n => n.id === link.to);
                if (!fromNode || !toNode) return null;
                return (
                  <g key={idx}>
                    <line x1={fromNode.position.left} y1={fromNode.position.top} x2={toNode.position.left} y2={toNode.position.top} stroke="#324467" strokeWidth="2" />
                    <line x1={fromNode.position.left} y1={fromNode.position.top} x2={toNode.position.left} y2={toNode.position.top} stroke={`url(#grad-${link.status === 'error' ? 'error' : 'healthy'})`} strokeWidth="2" className="flow-path" />
                  </g>
                );
              })}
            </svg>

            <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 2 }}>
              {filteredNodes.map(node => {
                const isSelected = selectedNode?.id === node.id;
                const statusColor = getStatusColor(node.status);
                const nodeSize = node.type === 'gateway' ? 'w-20 h-20' : node.type === 'cache' ? 'w-12 h-12' : 'w-16 h-16';
                const iconSize = node.type === 'gateway' ? 'text-3xl' : node.type === 'cache' ? 'text-lg' : 'text-2xl';
                
                return (
                  <div 
                    key={node.id}
                    onClick={() => setSelectedNode(node)}
                    className="absolute pointer-events-auto group cursor-pointer" 
                    style={{ top: node.position.top, left: node.position.left, transform: 'translate(-50%, -50%)' }}
                  >
                    <div className="flex flex-col items-center gap-2 relative">
                      {isSelected && (
                        <div className="w-24 h-24 rounded-full border border-primary/50 absolute -top-2 left-1/2 -translate-x-1/2 animate-pulse"></div>
                      )}
                      <div className={`${nodeSize} ${nodeBg} rounded-full border-${isSelected ? '4' : '2'} border-${isSelected ? 'primary' : statusColor} flex items-center justify-center shadow-[0_0_${node.status === 'critical' ? '30' : '20'}px_rgba(${node.status === 'critical' ? '239,68,68' : '34,197,94'},${node.status === 'critical' ? '0.4' : '0.2'})] hover:scale-110 transition-transform duration-300 relative z-10`}>
                        {node.status === 'critical' && (
                          <div className={`absolute -top-1 -right-1 w-5 h-5 bg-danger rounded-full border-2 ${isDark ? 'border-[#1a2230]' : 'border-white'} flex items-center justify-center`}>
                            <span className="material-symbols-outlined text-[12px] text-white font-bold">priority_high</span>
                          </div>
                        )}
                        <span className={`material-symbols-outlined text-${statusColor} ${iconSize}`}>{getNodeIcon(node.type)}</span>
                      </div>
                      <div className={`${isSelected ? 'bg-primary/90' : `${cardBgHalf} backdrop-blur`} px-3 py-1 rounded-full border ${isSelected ? 'border-transparent' : borderColor} text-center shadow-lg z-10`}>
                        <p className={`${isSelected ? 'text-white' : textColor} text-sm font-bold whitespace-nowrap`}>{node.name}</p>
                        <p className={`${isSelected ? 'text-white/80' : textSecondary} text-xs`}>{node.protocol}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className={`flex-1 overflow-auto p-6 ${pageBg}`}>
            <div className={`${cardBg} border ${borderColor} rounded-xl overflow-hidden`}>
              <table className="w-full">
                <thead>
                  <tr className={`${isDark ? 'bg-[#0f172a]/50' : 'bg-slate-50'} ${textSecondary} text-xs uppercase font-semibold tracking-wider border-b ${borderColor}`}>
                    <th className="px-5 py-3 text-left">服务名称</th>
                    <th className="px-5 py-3 text-left">类型</th>
                    <th className="px-5 py-3 text-left">协议</th>
                    <th className="px-5 py-3 text-center">状态</th>
                    <th className="px-5 py-3 text-right">延迟 (P99)</th>
                    <th className="px-5 py-3 text-right">吞吐量</th>
                    <th className="px-5 py-3 text-right">错误率</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-border-dark/50' : 'divide-slate-200'}`}>
                  {filteredNodes.map(node => (
                    <tr 
                      key={node.id} 
                      onClick={() => setSelectedNode(node)}
                      className={`${hoverBg} cursor-pointer ${selectedNode?.id === node.id ? 'bg-primary/5' : ''}`}
                    >
                      <td className={`px-5 py-3 ${textColor} font-medium`}>
                        <div className="flex items-center gap-2">
                          <span className={`material-symbols-outlined text-${getStatusColor(node.status)}`}>{getNodeIcon(node.type)}</span>
                          {node.name}
                        </div>
                      </td>
                      <td className={`px-5 py-3 ${textSecondary} capitalize`}>{node.type}</td>
                      <td className={`px-5 py-3 ${textSecondary} font-mono text-xs`}>{node.protocol}</td>
                      <td className="px-5 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-${getStatusColor(node.status)}/10 text-${getStatusColor(node.status)} border border-${getStatusColor(node.status)}/20`}>
                          {node.status === 'healthy' ? '正常' : node.status === 'warning' ? '警告' : '错误'}
                        </span>
                      </td>
                      <td className={`px-5 py-3 text-right ${textColor} font-mono`}>{node.metrics.latency}ms</td>
                      <td className={`px-5 py-3 text-right ${textColor} font-mono`}>{node.metrics.rpm.toLocaleString()}</td>
                      <td className={`px-5 py-3 text-right font-mono ${node.metrics.errorRate > 1 ? 'text-danger font-bold' : textColor}`}>{node.metrics.errorRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <aside className={`w-80 ${asideBg} border-l ${borderColor} flex flex-col shadow-2xl shrink-0`}>
          {selectedNode ? (
            <>
              <div className={`p-5 border-b ${borderColor} flex items-start justify-between`}>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2 h-2 rounded-full bg-${getStatusColor(selectedNode.status)} ${selectedNode.status === 'critical' ? 'animate-pulse' : ''}`}></span>
                    <h3 className={`text-lg font-bold ${textColor} font-display`}>{selectedNode.name}</h3>
                  </div>
                  <p className={`${textSecondary} text-xs font-mono`}>ID: {selectedNode.id}</p>
                </div>
                <button onClick={() => setSelectedNode(null)} className={textSecondary}>
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6">
                {selectedNode.status === 'critical' && (
                  <div className="p-4 bg-danger/10 border border-danger/30 rounded-lg flex items-start gap-3">
                    <span className="material-symbols-outlined text-danger mt-0.5">warning</span>
                    <div>
                      <p className="text-red-400 text-sm font-bold">检测到高错误率</p>
                      <p className="text-red-300/70 text-xs mt-1 leading-relaxed">该服务在过去 5 分钟内错误率激增，主要集中在 checkout 接口。</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className={`col-span-2 p-3 ${cardBg} rounded-lg border ${borderColor}`}>
                    <p className={`${textSecondary} text-xs mb-1`}>平均响应时间 (P99)</p>
                    <div className="flex items-end justify-between">
                      <span className={`text-2xl font-bold ${textColor} font-display`}>{selectedNode.metrics.latency}ms</span>
                      <span className={`text-xs ${selectedNode.metrics.latency > 100 ? 'text-warning' : 'text-success'} font-medium flex items-center`}>
                        <span className="material-symbols-outlined text-[14px]">{selectedNode.metrics.latency > 100 ? 'arrow_upward' : 'arrow_downward'}</span> 
                        {selectedNode.metrics.latency > 100 ? '+12ms' : '-5ms'}
                      </span>
                    </div>
                    <div className="h-8 mt-2 flex items-end gap-0.5 opacity-80">
                      {[30, 50, 40, 60, 40, 30].map((h, i) => (
                        <div key={i} className={`w-1/6 ${i === 3 && selectedNode.metrics.latency > 100 ? 'bg-warning' : 'bg-blue-500/40'} rounded-sm`} style={{ height: `${h}%` }}></div>
                      ))}
                    </div>
                  </div>
                  <div className={`p-3 ${cardBg} rounded-lg border ${borderColor}`}>
                    <p className={`${textSecondary} text-xs mb-1`}>吞吐量 (RPM)</p>
                    <span className={`text-xl font-bold ${textColor} font-display`}>{(selectedNode.metrics.rpm / 1000).toFixed(1)}k</span>
                    <p className="text-xs text-success font-medium mt-1">+5.2%</p>
                  </div>
                  <div className={`p-3 ${cardBg} rounded-lg border ${borderColor}`}>
                    <p className={`${textSecondary} text-xs mb-1`}>错误率</p>
                    <span className={`text-xl font-bold ${selectedNode.metrics.errorRate > 1 ? 'text-danger' : textColor} font-display`}>{selectedNode.metrics.errorRate}%</span>
                    <p className={`text-xs ${selectedNode.metrics.errorRate > 1 ? 'text-danger' : 'text-success'} font-medium mt-1`}>
                      {selectedNode.metrics.errorRate > 1 ? '+1.8%' : '-0.1%'}
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className={`text-sm font-bold ${textColor} mb-3 flex items-center gap-2`}>
                    调用链概览
                    <span className={`${buttonBg} ${textSecondary} text-[10px] px-1.5 py-0.5 rounded`}>Incoming</span>
                  </h4>
                  <div className="space-y-2">
                    {mockLinks.filter(l => l.to === selectedNode.id).map(link => {
                      const fromNode = mockNodes.find(n => n.id === link.from);
                      if (!fromNode) return null;
                      return (
                        <div key={link.from} className={`flex items-center justify-between p-2 rounded ${cardBg} ${hoverBg} cursor-pointer transition-colors border border-transparent`}>
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full ${buttonBg} flex items-center justify-center ${textSecondary}`}>
                              <span className="material-symbols-outlined text-sm">{getNodeIcon(fromNode.type)}</span>
                            </div>
                            <div>
                              <p className={`text-sm ${textColor} font-medium`}>{fromNode.name}</p>
                              <p className={`text-[10px] ${textSecondary}`}>{fromNode.metrics.rpm} rpm</p>
                            </div>
                          </div>
                          <span className={`text-xs ${textSecondary} font-mono`}>{fromNode.metrics.latency}ms</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <h4 className={`text-sm font-bold ${textColor} mb-3 flex items-center gap-2`}>
                    下游服务
                    <span className={`${buttonBg} ${textSecondary} text-[10px] px-1.5 py-0.5 rounded`}>Outgoing</span>
                  </h4>
                  <div className="space-y-2">
                    {mockLinks.filter(l => l.from === selectedNode.id).map(link => {
                      const toNode = mockNodes.find(n => n.id === link.to);
                      if (!toNode) return null;
                      return (
                        <div key={link.to} className={`flex items-center justify-between p-2 rounded ${cardBg} ${hoverBg} cursor-pointer transition-colors border border-transparent`}>
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full ${buttonBg} flex items-center justify-center ${textSecondary}`}>
                              <span className="material-symbols-outlined text-sm">{getNodeIcon(toNode.type)}</span>
                            </div>
                            <div>
                              <p className={`text-sm ${textColor} font-medium`}>{toNode.name}</p>
                              <p className={`text-[10px] ${textSecondary}`}>{toNode.metrics.rpm} rpm</p>
                            </div>
                          </div>
                          <span className={`text-xs text-success font-medium font-mono`}>{toNode.metrics.latency}ms</span>
                        </div>
                      );
                    })}
                    {mockLinks.filter(l => l.from === selectedNode.id).length === 0 && (
                      <p className={`text-sm ${textSecondary} text-center py-4`}>无下游服务</p>
                    )}
                  </div>
                </div>
              </div>

              <div className={`p-5 border-t ${borderColor} ${cardBgHalf} mt-auto`}>
                <button className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-white font-medium py-2 px-4 rounded-lg transition-colors mb-3 shadow-lg shadow-primary/20">
                  <span className="material-symbols-outlined text-[20px]">list_alt</span>
                  查看调用日志
                </button>
                <button className={`w-full flex items-center justify-center gap-2 ${buttonBg} ${buttonHover} ${textColor} font-medium py-2 px-4 rounded-lg transition-colors border ${borderColor}`}>
                  <span className="material-symbols-outlined text-[20px]">timeline</span>
                  查看追踪详情
                </button>
              </div>
            </>
          ) : (
            <div className={`flex-1 flex items-center justify-center ${textSecondary}`}>
              <div className="text-center">
                <span className="material-symbols-outlined text-4xl mb-2 block opacity-50">touch_app</span>
                <p>点击节点查看详情</p>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

export default ServiceTopology;
