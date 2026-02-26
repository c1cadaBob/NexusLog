import React, { useState, useMemo } from 'react';
import { useThemeStore } from '../../stores/themeStore';
import { useNavigate } from 'react-router-dom';

// 追踪数据类型
interface Trace {
  id: string;
  rootService: string;
  endpoint: string;
  duration: number;
  spans: number;
  timestamp: string;
  status: 'Success' | 'Error';
  tags?: Record<string, string>;
}

// 模拟追踪数据
const mockTraces: Trace[] = [
  { id: '14019ac...82b', rootService: 'order-api', endpoint: 'POST /checkout', duration: 1200, spans: 45, timestamp: '2026-02-13 10:30:01', status: 'Error', tags: { error: 'true', env: 'prod' } },
  { id: '89b12cd...33a', rootService: 'user-service', endpoint: 'GET /profile', duration: 45, spans: 12, timestamp: '2026-02-13 10:29:55', status: 'Success', tags: { env: 'prod' } },
  { id: '72a34fe...99c', rootService: 'payment-service', endpoint: 'POST /pay', duration: 850, spans: 28, timestamp: '2026-02-13 10:28:40', status: 'Success', tags: { env: 'prod' } },
  { id: '33c91ba...d12', rootService: 'auth-service', endpoint: 'POST /login', duration: 120, spans: 8, timestamp: '2026-02-13 10:28:12', status: 'Success', tags: { env: 'prod' } },
  { id: '55d82ef...a45', rootService: 'inventory-svc', endpoint: 'GET /stock', duration: 300, spans: 15, timestamp: '2026-02-13 10:27:30', status: 'Success', tags: { env: 'staging' } },
  { id: '99e71ab...f33', rootService: 'notification-svc', endpoint: 'POST /send', duration: 60, spans: 4, timestamp: '2026-02-13 10:26:15', status: 'Success', tags: { env: 'prod' } },
  { id: '11a88bb...c99', rootService: 'checkout-service', endpoint: 'POST /init', duration: 920, spans: 32, timestamp: '2026-02-13 10:25:05', status: 'Error', tags: { error: 'true', env: 'prod' } },
  { id: '82c44dd...e11', rootService: 'analytics-svc', endpoint: 'POST /track', duration: 25, spans: 2, timestamp: '2026-02-13 10:24:50', status: 'Success', tags: { env: 'prod' } },
  { id: 'a3f55ee...b22', rootService: 'order-api', endpoint: 'GET /orders', duration: 180, spans: 10, timestamp: '2026-02-13 10:23:30', status: 'Success', tags: { env: 'prod' } },
  { id: 'c7d88ff...a11', rootService: 'user-service', endpoint: 'PUT /settings', duration: 95, spans: 6, timestamp: '2026-02-13 10:22:15', status: 'Success', tags: { env: 'prod' } },
];

const services = ['All', 'order-api', 'user-service', 'payment-service', 'auth-service', 'inventory-svc', 'notification-svc', 'checkout-service', 'analytics-svc'];
const durationRanges = [
  { label: '全部', min: 0, max: Infinity },
  { label: '<100ms', min: 0, max: 100 },
  { label: '100-500ms', min: 100, max: 500 },
  { label: '>500ms', min: 500, max: Infinity },
  { label: '>1s', min: 1000, max: Infinity },
];
const statusOptions = ['All', 'Success', 'Error'];

const TraceSearch: React.FC = () => {
  const { isDark } = useThemeStore();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedService, setSelectedService] = useState('All');
  const [selectedDurationRange, setSelectedDurationRange] = useState(0);
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [showServiceDropdown, setShowServiceDropdown] = useState(false);
  const [showDurationDropdown, setShowDurationDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  const filteredTraces = useMemo(() => {
    return mockTraces.filter(trace => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesId = trace.id.toLowerCase().includes(query);
        const matchesService = trace.rootService.toLowerCase().includes(query);
        const matchesEndpoint = trace.endpoint.toLowerCase().includes(query);
        const matchesTags = trace.tags && Object.entries(trace.tags).some(
          ([key, value]) => `${key}=${value}`.toLowerCase().includes(query)
        );
        if (!matchesId && !matchesService && !matchesEndpoint && !matchesTags) return false;
      }
      if (selectedService !== 'All' && trace.rootService !== selectedService) return false;
      const range = durationRanges[selectedDurationRange];
      if (trace.duration < range.min || trace.duration >= range.max) return false;
      if (selectedStatus !== 'All' && trace.status !== selectedStatus) return false;
      return true;
    });
  }, [searchQuery, selectedService, selectedDurationRange, selectedStatus]);

  const paginatedTraces = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTraces.slice(start, start + pageSize);
  }, [filteredTraces, currentPage]);

  const totalPages = Math.ceil(filteredTraces.length / pageSize);

  const stats = useMemo(() => {
    const total = filteredTraces.length;
    const errors = filteredTraces.filter(t => t.status === 'Error').length;
    const errorRate = total > 0 ? ((errors / total) * 100).toFixed(1) : '0';
    const durations = filteredTraces.map(t => t.duration).sort((a, b) => a - b);
    const p95Index = Math.floor(durations.length * 0.95);
    const p95 = durations[p95Index] || 0;
    return { total, errorRate, p95 };
  }, [filteredTraces]);

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedService('All');
    setSelectedDurationRange(0);
    setSelectedStatus('All');
    setCurrentPage(1);
  };

  const formatDuration = (ms: number) => ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
  const handleTraceClick = () => navigate('/tracing/analysis');

  const headerBg = isDark ? 'bg-[#111722]/95' : 'bg-white/95';
  const cardBg = isDark ? 'bg-[#1e293b]' : 'bg-white';
  const inputBg = isDark ? 'bg-[#0f172a]' : 'bg-slate-50';
  const borderColor = isDark ? 'border-border-dark' : 'border-slate-200';
  const textColor = isDark ? 'text-white' : 'text-slate-900';
  const textSecondary = isDark ? 'text-text-secondary' : 'text-slate-600';
  const hoverBg = isDark ? 'hover:bg-white/5' : 'hover:bg-slate-50';
  const tableBg = isDark ? 'bg-[#0f172a]/50' : 'bg-slate-50';
  const paginationBg = isDark ? 'bg-[#0f172a]/30' : 'bg-slate-50';
  const dropdownBg = isDark ? 'bg-[#1e293b]' : 'bg-white';

  return (
    <div className="flex flex-col h-full gap-6">
      <div className={`h-16 border-b ${borderColor} ${headerBg} backdrop-blur z-10 flex items-center justify-between px-6 shrink-0 -mx-6 -mt-6`}>
        <div className="flex items-center gap-4">
          <h1 className={`text-xl font-bold ${textColor} tracking-tight flex items-center gap-2`}>
            <span className={`material-symbols-outlined ${textSecondary}`}>search</span>
            Trace 搜索
          </h1>
          <div className={`h-6 w-px ${isDark ? 'bg-border-dark' : 'bg-slate-200'} mx-2`}></div>
          <nav className={`flex text-sm ${textSecondary}`}>
            <span>分布式追踪</span>
            <span className="mx-2">/</span>
            <span className={textColor}>Trace 搜索</span>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <button className={`p-2 ${textSecondary} ${isDark ? 'hover:text-white hover:bg-white/5' : 'hover:text-slate-900 hover:bg-slate-100'} rounded-lg transition-colors`}>
            <span className="material-symbols-outlined">notifications</span>
          </button>
          <button className={`p-2 ${textSecondary} ${isDark ? 'hover:text-white hover:bg-white/5' : 'hover:text-slate-900 hover:bg-slate-100'} rounded-lg transition-colors`}>
            <span className="material-symbols-outlined">help</span>
          </button>
        </div>
      </div>

      <div className={`${cardBg} border ${borderColor} rounded-xl p-5 shadow-sm`}>
        <div className="flex flex-col gap-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className={`material-symbols-outlined ${textSecondary}`}>search</span>
              </div>
              <input 
                className={`block w-full pl-10 pr-3 py-2.5 ${inputBg} border ${borderColor} rounded-lg leading-5 ${textColor} ${isDark ? 'placeholder-slate-500' : 'placeholder-slate-400'} focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm transition-shadow shadow-inner`} 
                placeholder="输入 Trace ID, Span 属性, 或 Tags (e.g. error=true service=payment)..." 
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              />
              <div className="absolute inset-y-0 right-0 pr-2 flex items-center">
                <kbd className={`inline-flex items-center border ${borderColor} rounded px-2 text-xs font-sans font-medium ${textSecondary}`}>⌘K</kbd>
              </div>
            </div>
            <button className="bg-primary hover:bg-primary-hover text-white px-6 py-2.5 rounded-lg text-sm font-medium shadow-lg shadow-primary/20 transition-all flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px]">search</span>
              搜索
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <button 
                onClick={() => { setShowServiceDropdown(!showServiceDropdown); setShowDurationDropdown(false); setShowStatusDropdown(false); }}
                className={`flex items-center gap-2 ${inputBg} border ${borderColor} ${isDark ? 'text-slate-300' : 'text-slate-700'} px-3 py-2 rounded-lg text-sm ${isDark ? 'hover:border-slate-500 hover:text-white' : 'hover:border-slate-400 hover:text-slate-900'} transition-colors`}
              >
                <span className={`material-symbols-outlined text-[18px] ${textSecondary}`}>dns</span>
                <span>服务名称: {selectedService}</span>
                <span className={`material-symbols-outlined text-[18px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>arrow_drop_down</span>
              </button>
              {showServiceDropdown && (
                <div className={`absolute top-full left-0 mt-1 ${dropdownBg} border ${borderColor} rounded-lg shadow-lg z-20 min-w-[180px] py-1`}>
                  {services.map(service => (
                    <button
                      key={service}
                      onClick={() => { setSelectedService(service); setShowServiceDropdown(false); setCurrentPage(1); }}
                      className={`w-full text-left px-3 py-2 text-sm ${selectedService === service ? 'bg-primary/10 text-primary' : `${textColor} ${hoverBg}`}`}
                    >
                      {service}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative">
              <button 
                onClick={() => { setShowDurationDropdown(!showDurationDropdown); setShowServiceDropdown(false); setShowStatusDropdown(false); }}
                className={`flex items-center gap-2 ${inputBg} border ${borderColor} ${isDark ? 'text-slate-300' : 'text-slate-700'} px-3 py-2 rounded-lg text-sm ${isDark ? 'hover:border-slate-500 hover:text-white' : 'hover:border-slate-400 hover:text-slate-900'} transition-colors`}
              >
                <span className={`material-symbols-outlined text-[18px] ${textSecondary}`}>timer</span>
                <span>耗时范围: {durationRanges[selectedDurationRange].label}</span>
                <span className={`material-symbols-outlined text-[18px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>arrow_drop_down</span>
              </button>
              {showDurationDropdown && (
                <div className={`absolute top-full left-0 mt-1 ${dropdownBg} border ${borderColor} rounded-lg shadow-lg z-20 min-w-[150px] py-1`}>
                  {durationRanges.map((range, idx) => (
                    <button
                      key={idx}
                      onClick={() => { setSelectedDurationRange(idx); setShowDurationDropdown(false); setCurrentPage(1); }}
                      className={`w-full text-left px-3 py-2 text-sm ${selectedDurationRange === idx ? 'bg-primary/10 text-primary' : `${textColor} ${hoverBg}`}`}
                    >
                      {range.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative">
              <button 
                onClick={() => { setShowStatusDropdown(!showStatusDropdown); setShowServiceDropdown(false); setShowDurationDropdown(false); }}
                className={`flex items-center gap-2 ${inputBg} border ${borderColor} ${isDark ? 'text-slate-300' : 'text-slate-700'} px-3 py-2 rounded-lg text-sm ${isDark ? 'hover:border-slate-500 hover:text-white' : 'hover:border-slate-400 hover:text-slate-900'} transition-colors`}
              >
                <span className={`material-symbols-outlined text-[18px] ${textSecondary}`}>check_circle</span>
                <span>状态: {selectedStatus}</span>
                <span className={`material-symbols-outlined text-[18px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>arrow_drop_down</span>
              </button>
              {showStatusDropdown && (
                <div className={`absolute top-full left-0 mt-1 ${dropdownBg} border ${borderColor} rounded-lg shadow-lg z-20 min-w-[120px] py-1`}>
                  {statusOptions.map(status => (
                    <button
                      key={status}
                      onClick={() => { setSelectedStatus(status); setShowStatusDropdown(false); setCurrentPage(1); }}
                      className={`w-full text-left px-3 py-2 text-sm ${selectedStatus === status ? 'bg-primary/10 text-primary' : `${textColor} ${hoverBg}`}`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className={`w-px h-6 ${isDark ? 'bg-border-dark' : 'bg-slate-200'} mx-1`}></div>
            <button onClick={clearFilters} className="text-primary text-sm hover:underline">清除筛选</button>
            <div className={`ml-auto flex items-center gap-2 text-sm ${textSecondary}`}>
              <span>最近 1 小时</span>
              <button className={`p-1 ${hoverBg} rounded`}>
                <span className="material-symbols-outlined text-[18px]">refresh</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className={`${cardBg} border ${borderColor} rounded-xl p-4 flex flex-col justify-between h-28 relative overflow-hidden group`}>
          <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <span className="material-symbols-outlined text-6xl">query_stats</span>
          </div>
          <p className={`${textSecondary} text-xs font-medium uppercase tracking-wider`}>总 Trace 数量</p>
          <div className="flex items-end gap-2">
            <span className={`text-3xl font-bold ${textColor}`}>{stats.total.toLocaleString()}</span>
            <span className="text-xs text-green-400 mb-1 flex items-center">
              <span className="material-symbols-outlined text-[14px]">trending_up</span> 12%
            </span>
          </div>
        </div>
        <div className={`${cardBg} border ${borderColor} rounded-xl p-4 flex flex-col justify-between h-28 relative overflow-hidden group`}>
          <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <span className="material-symbols-outlined text-6xl">error</span>
          </div>
          <p className={`${textSecondary} text-xs font-medium uppercase tracking-wider`}>错误率</p>
          <div className="flex items-end gap-2">
            <span className={`text-3xl font-bold ${textColor}`}>{stats.errorRate}%</span>
            <span className="text-xs text-red-400 mb-1 flex items-center">
              <span className="material-symbols-outlined text-[14px]">trending_up</span> 0.4%
            </span>
          </div>
        </div>
        <div className={`${cardBg} border ${borderColor} rounded-xl p-4 flex flex-col justify-between h-28 md:col-span-2 relative overflow-hidden`}>
          <p className={`${textSecondary} text-xs font-medium uppercase tracking-wider mb-2`}>耗时分布 (P95: {formatDuration(stats.p95)})</p>
          <div className="flex items-end h-full gap-1 w-full">
            <div className="flex-1 bg-primary/20 hover:bg-primary/40 transition-colors rounded-sm h-[30%]" title="0-100ms"></div>
            <div className="flex-1 bg-primary/20 hover:bg-primary/40 transition-colors rounded-sm h-[60%]" title="100-300ms"></div>
            <div className="flex-1 bg-primary/20 hover:bg-primary/40 transition-colors rounded-sm h-[80%]" title="300-500ms"></div>
            <div className="flex-1 bg-primary/20 hover:bg-primary/40 transition-colors rounded-sm h-[40%]" title="500-1000ms"></div>
            <div className="flex-1 bg-primary/20 hover:bg-primary/40 transition-colors rounded-sm h-[20%]" title="1s+"></div>
            <div className="flex-1 bg-danger/40 hover:bg-danger/60 transition-colors rounded-sm h-[10%]" title="Error"></div>
          </div>
        </div>
      </div>

      <div className={`${cardBg} border ${borderColor} rounded-xl overflow-hidden flex flex-col shadow-sm`}>
        <div className={`px-5 py-3 border-b ${borderColor} flex justify-between items-center ${cardBg}`}>
          <h3 className={`font-medium ${textColor} flex items-center gap-2`}>
            <span className="material-symbols-outlined text-primary">list_alt</span>
            查询结果
            <span className={`text-xs ${textSecondary} ml-2`}>({filteredTraces.length} 条)</span>
          </h3>
          <div className="flex items-center gap-2">
            <button className={`p-1.5 ${textSecondary} ${isDark ? 'hover:text-white hover:bg-white/5' : 'hover:text-slate-900 hover:bg-slate-100'} rounded transition-colors`}>
              <span className="material-symbols-outlined text-[20px]">download</span>
            </button>
            <button className={`p-1.5 ${textSecondary} ${isDark ? 'hover:text-white hover:bg-white/5' : 'hover:text-slate-900 hover:bg-slate-100'} rounded transition-colors`}>
              <span className="material-symbols-outlined text-[20px]">settings</span>
            </button>
          </div>
        </div>
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className={`${tableBg} ${textSecondary} text-xs uppercase font-semibold tracking-wider border-b ${borderColor}`}>
                <th className="px-5 py-3 w-48">Trace ID</th>
                <th className="px-5 py-3 w-40">入口服务</th>
                <th className="px-5 py-3 w-48">服务端点 (Endpoint)</th>
                <th className="px-5 py-3 w-64">总耗时</th>
                <th className="px-5 py-3 w-24 text-center">Spans</th>
                <th className="px-5 py-3 w-40">时间戳</th>
                <th className="px-5 py-3 w-24 text-right">状态</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-border-dark/50' : 'divide-slate-200'} text-sm`}>
              {paginatedTraces.map((trace, idx) => (
                <tr key={idx} onClick={handleTraceClick} className={`group ${hoverBg} transition-colors cursor-pointer relative`}>
                  <td className="px-5 py-3 font-mono text-primary group-hover:underline font-medium">
                    <div className="flex items-center gap-2">
                      {trace.id}
                      <span className={`material-symbols-outlined text-[14px] opacity-0 group-hover:opacity-100 transition-opacity ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>open_in_new</span>
                    </div>
                  </td>
                  <td className={`px-5 py-3 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{trace.rootService}</td>
                  <td className={`px-5 py-3 ${textSecondary} font-mono text-xs`}>{trace.endpoint}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3 w-full">
                      <div className={`flex-1 h-1.5 ${inputBg} rounded-full overflow-hidden`}>
                        <div 
                          className={`h-full rounded-full ${trace.status === 'Error' ? 'bg-danger' : 'bg-primary'}`} 
                          style={{width: `${Math.min(100, trace.duration / 12)}%`}}
                        ></div>
                      </div>
                      <span className={`${textColor} font-medium w-16 text-right`}>{formatDuration(trace.duration)}</span>
                    </div>
                  </td>
                  <td className={`px-5 py-3 text-center ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{trace.spans}</td>
                  <td className={`px-5 py-3 ${textSecondary} text-xs`}>{trace.timestamp}</td>
                  <td className="px-5 py-3 text-right">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border 
                      ${trace.status === 'Error' ? 'bg-danger/10 text-danger border-danger/20' : 'bg-success/10 text-success border-success/20'}`}>
                      {trace.status === 'Error' ? '错误' : '成功'}
                    </span>
                  </td>
                </tr>
              ))}
              {paginatedTraces.length === 0 && (
                <tr>
                  <td colSpan={7} className={`px-5 py-12 text-center ${textSecondary}`}>
                    <span className="material-symbols-outlined text-4xl mb-2 block opacity-50">search_off</span>
                    没有找到匹配的追踪记录
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className={`px-5 py-3 border-t ${borderColor} ${paginationBg} flex items-center justify-between`}>
          <div className={`text-xs ${textSecondary}`}>
            显示 {((currentPage - 1) * pageSize) + 1} 到 {Math.min(currentPage * pageSize, filteredTraces.length)} 条，共 {filteredTraces.length} 条结果
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className={`flex items-center justify-center w-8 h-8 rounded ${isDark ? 'hover:bg-white/10' : 'hover:bg-slate-200'} ${textSecondary} disabled:opacity-50`}
            >
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map(page => (
              <button 
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`flex items-center justify-center w-8 h-8 rounded text-xs font-medium ${currentPage === page ? 'bg-primary text-white shadow-sm' : `${isDark ? 'hover:bg-white/10' : 'hover:bg-slate-200'} ${textSecondary}`}`}
              >
                {page}
              </button>
            ))}
            {totalPages > 5 && <span className={`${textSecondary} text-xs px-1`}>...</span>}
            <button 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className={`flex items-center justify-center w-8 h-8 rounded ${isDark ? 'hover:bg-white/10' : 'hover:bg-slate-200'} ${textSecondary} disabled:opacity-50`}
            >
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TraceSearch;
