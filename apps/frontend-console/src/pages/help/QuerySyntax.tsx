import React, { useState, useCallback } from 'react';
import { useThemeStore } from '../../stores/themeStore';

const exampleQueries = [
  { query: '"error" AND "timeout"', description: '查找同时包含 error 和 timeout 的日志' },
  { query: 'status:500 AND method:POST', description: '查找 POST 请求中状态码为 500 的日志' },
  { query: 'env:prod OR env:staging', description: '查找生产或预发布环境的日志' },
  { query: 'latency_ms > 1000 AND service:"checkout"', description: '查找 checkout 服务中延迟超过 1 秒的请求' },
  { query: '* | stats count() by host', description: '按主机统计日志数量' },
];

const sampleLogs = [
  { level: 'ERROR', message: 'Timeout in connection to database', host: 'server-01', timestamp: '2026-02-14 10:23:45' },
  { level: 'ERROR', message: 'Failed to load resource: net::ERR_CONNECTION_REFUSED', host: 'server-02', timestamp: '2026-02-14 10:23:44' },
  { level: 'WARN', message: 'Deprecated API usage detected', host: 'server-01', timestamp: '2026-02-14 10:23:43' },
  { level: 'INFO', message: 'Request completed successfully', host: 'server-03', timestamp: '2026-02-14 10:23:42' },
  { level: 'ERROR', message: 'Connection timeout after 30000ms', host: 'server-02', timestamp: '2026-02-14 10:23:41' },
  { level: 'DEBUG', message: 'Cache hit for key: user_session_123', host: 'server-01', timestamp: '2026-02-14 10:23:40' },
];

const QuerySyntax: React.FC = () => {
  const isDark = useThemeStore((s) => s.isDark);
  const [playgroundQuery, setPlaygroundQuery] = useState('');
  const [queryResults, setQueryResults] = useState<typeof sampleLogs>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const executeQuery = useCallback(() => {
    setIsRunning(true);
    const startTime = Date.now();
    setTimeout(() => {
      const query = playgroundQuery.toLowerCase();
      let results = [...sampleLogs];
      if (query.includes('error')) results = results.filter(log => log.level === 'ERROR' || log.message.toLowerCase().includes('error'));
      if (query.includes('warn')) results = results.filter(log => log.level === 'WARN');
      if (query.includes('timeout')) results = results.filter(log => log.message.toLowerCase().includes('timeout'));
      if (query.includes('level:error')) results = results.filter(log => log.level === 'ERROR');
      if (query.includes('host:')) {
        const hostMatch = query.match(/host:["']?([^"'\s]+)["']?/);
        if (hostMatch) results = results.filter(log => log.host.includes(hostMatch[1]));
      }
      setQueryResults(results);
      setExecutionTime(Date.now() - startTime + Math.random() * 20);
      setIsRunning(false);
    }, 300);
  }, [playgroundQuery]);

  const copyToClipboard = useCallback((text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  }, []);

  const loadExample = useCallback((query: string) => {
    setPlaygroundQuery(query);
  }, []);

  const pageBg = isDark ? 'bg-[#0f172a]' : 'bg-slate-50';
  const headerBg = isDark ? 'bg-[#111722]/95' : 'bg-white/95';
  const sidebarBg = isDark ? 'bg-[#111722]/50' : 'bg-white';
  const cardBg = isDark ? 'bg-[#1e293b]' : 'bg-white';
  const surfaceBg = isDark ? 'bg-[#111722]' : 'bg-slate-100';
  const borderColor = isDark ? 'border-[#334155]' : 'border-slate-200';
  const textColor = isDark ? 'text-white' : 'text-slate-900';
  const textSecondary = isDark ? 'text-[#94a3b8]' : 'text-slate-600';
  const inputBg = isDark ? 'bg-[#1e293b]' : 'bg-white';
  const codeBg = isDark ? 'bg-[#111722]' : 'bg-slate-100';
  const codeTextColor = isDark ? 'text-slate-300' : 'text-slate-700';
  const playgroundBg = isDark ? 'bg-[#0b1121]' : 'bg-slate-100';

  return (
    <div className={`flex flex-col h-full overflow-hidden ${pageBg}`}>
      {/* Header */}
      <header className={`h-16 border-b ${borderColor} ${headerBg} backdrop-blur-sm px-8 flex items-center justify-between shrink-0 -mx-6 -mt-6 z-10`}>
        <div className="flex items-center gap-2 text-sm">
          <span className={textSecondary}>帮助中心</span>
          <span className={`material-symbols-outlined text-[14px] ${textSecondary}`}>chevron_right</span>
          <span className={`${textColor} font-medium`}>查询语法指南</span>
        </div>
        <div className="relative w-96">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className={`material-symbols-outlined ${textSecondary} text-[20px]`}>search</span>
          </span>
          <input
            id="query-syntax-search"
            name="querySyntaxSearch"
            className={`block w-full rounded-lg border ${borderColor} ${inputBg} py-1.5 pl-10 pr-3 ${textColor} placeholder-[#94a3b8] focus:border-[#135bec] focus:ring-1 focus:ring-[#135bec] sm:text-sm sm:leading-6 focus:outline-none transition-all`}
            placeholder="搜索文档内容 (Ctrl+K)..."
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <kbd className={`inline-flex items-center rounded border ${borderColor} px-1 font-mono text-[10px] font-medium ${textSecondary}`}>⌘K</kbd>
          </div>
        </div>
      </header>

      {/* Content Area */}
      <div className="flex flex-1 overflow-hidden -mx-6">
        {/* TOC Sidebar */}
        <nav className={`hidden lg:block w-64 shrink-0 overflow-y-auto border-r ${borderColor} ${sidebarBg} p-6`}>
          <h3 className={`text-xs font-bold ${textColor} mb-4 uppercase tracking-wider`}>本页内容</h3>
          <ul className={`space-y-1 border-l ${borderColor}`}>
            <li><a className="block pl-4 py-1.5 text-sm font-medium text-[#135bec] border-l-2 border-[#135bec] -ml-[1px]" href="#basic-search">基础查询 (Basic Search)</a></li>
            <li><a className={`block pl-4 py-1.5 text-sm ${textSecondary} ${isDark ? 'hover:text-white' : 'hover:text-slate-900'} hover:border-[#94a3b8] border-l-2 border-transparent transition-all`} href="#operators">布尔运算符 (Operators)</a></li>
            <li><a className={`block pl-4 py-1.5 text-sm ${textSecondary} ${isDark ? 'hover:text-white' : 'hover:text-slate-900'} hover:border-[#94a3b8] border-l-2 border-transparent transition-all`} href="#fields">字段查询 (Field Search)</a></li>
            <li><a className={`block pl-4 py-1.5 text-sm ${textSecondary} ${isDark ? 'hover:text-white' : 'hover:text-slate-900'} hover:border-[#94a3b8] border-l-2 border-transparent transition-all`} href="#aggregations">聚合分析 (Aggregations)</a></li>
            <li><a className={`block pl-4 py-1.5 text-sm ${textSecondary} ${isDark ? 'hover:text-white' : 'hover:text-slate-900'} hover:border-[#94a3b8] border-l-2 border-transparent transition-all`} href="#regex">正则表达式 (RegEx)</a></li>
          </ul>
          <div className="mt-8 p-4 rounded-xl bg-[#135bec]/10 border border-[#135bec]/20">
            <div className="flex items-center gap-2 text-[#135bec] mb-2">
              <span className="material-symbols-outlined text-[20px]">lightbulb</span>
              <span className="text-sm font-bold">提示</span>
            </div>
            <p className={`text-xs ${textSecondary} leading-relaxed`}>查询性能受时间范围影响。建议在测试复杂语法时，先缩短时间范围。</p>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-10 scroll-smooth">
          <div className="max-w-3xl mx-auto pb-32">
            <div className="mb-10">
              <h1 className={`text-4xl font-extrabold ${textColor} tracking-tight mb-4`}>查询语法指南</h1>
              <p className={`text-lg ${textSecondary} leading-relaxed`}>掌握 Log System 的查询语法 (LQL)，帮助您快速从海量日志中定位问题、分析趋势。</p>
            </div>

            {/* Section: Basic Search */}
            <section className="mb-12 scroll-mt-24" id="basic-search">
              <div className="flex items-center gap-3 mb-4">
                <span className="material-symbols-outlined text-[#135bec] text-2xl">search</span>
                <h2 className={`text-2xl font-bold ${textColor}`}>基础查询</h2>
              </div>
              <p className={`${textSecondary} mb-6`}>最简单的查询方式是直接输入关键词。系统将返回包含该关键词的所有日志。</p>
              <div className={`rounded-xl border ${borderColor} ${cardBg} overflow-hidden shadow-sm group`}>
                <div className={`flex items-center justify-between px-4 py-2 ${surfaceBg} border-b ${borderColor}`}>
                  <span className={`text-xs font-mono ${textSecondary}`}>Example Query</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => loadExample('"error" AND "timeout"')} className="text-xs text-[#135bec] hover:text-[#1048c0] flex items-center gap-1 transition-opacity">
                      <span className="material-symbols-outlined text-[14px]">play_arrow</span> 试一试
                    </button>
                    <button onClick={() => copyToClipboard('"error" AND "timeout"', 0)}
                      className={`text-xs ${copiedIndex === 0 ? 'text-[#10b981]' : textSecondary} ${isDark ? 'hover:text-white' : 'hover:text-slate-900'} flex items-center gap-1 transition-all`}>
                      <span className="material-symbols-outlined text-[14px]">{copiedIndex === 0 ? 'check' : 'content_copy'}</span>
                      {copiedIndex === 0 ? '已复制' : 'Copy'}
                    </button>
                  </div>
                </div>
                <div className="p-4 font-mono text-sm">
                  <span className="text-yellow-400">"error"</span> <span className="text-[#135bec] font-bold">AND</span> <span className="text-yellow-400">"timeout"</span>
                </div>
              </div>
            </section>

            {/* Section: Operators */}
            <section className="mb-12 scroll-mt-24" id="operators">
              <div className="flex items-center gap-3 mb-4">
                <span className="material-symbols-outlined text-[#135bec] text-2xl">calculate</span>
                <h2 className={`text-2xl font-bold ${textColor}`}>布尔运算符</h2>
              </div>
              <p className={`${textSecondary} mb-6`}>
                使用布尔逻辑组合多个条件。支持 <code className={`${cardBg} px-1.5 py-0.5 rounded text-[#135bec] border ${borderColor} font-mono text-xs`}>AND</code>, <code className={`${cardBg} px-1.5 py-0.5 rounded text-[#135bec] border ${borderColor} font-mono text-xs`}>OR</code>, <code className={`${cardBg} px-1.5 py-0.5 rounded text-[#135bec] border ${borderColor} font-mono text-xs`}>NOT</code>。
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={`p-5 rounded-xl border ${borderColor} ${cardBg} hover:border-[#135bec]/50 transition-colors`}>
                  <h3 className={`font-bold ${textColor} mb-2 flex items-center gap-2`}><span className="text-[#135bec]">AND</span> (与)</h3>
                  <p className={`text-sm ${textSecondary} mb-3`}>同时满足两个条件。</p>
                  <div className={`${codeBg} p-3 rounded-lg font-mono text-xs border ${borderColor} ${codeTextColor} mb-2`}>
                    status:500 <span className="text-[#135bec] font-bold">AND</span> method:POST
                  </div>
                  <button onClick={() => loadExample('status:500 AND method:POST')} className="text-xs text-[#135bec] hover:text-[#1048c0] flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">play_arrow</span> 在 Playground 中试试
                  </button>
                </div>
                <div className={`p-5 rounded-xl border ${borderColor} ${cardBg} hover:border-[#135bec]/50 transition-colors`}>
                  <h3 className={`font-bold ${textColor} mb-2 flex items-center gap-2`}><span className="text-[#135bec]">OR</span> (或)</h3>
                  <p className={`text-sm ${textSecondary} mb-3`}>满足任一条件。</p>
                  <div className={`${codeBg} p-3 rounded-lg font-mono text-xs border ${borderColor} ${codeTextColor} mb-2`}>
                    env:prod <span className="text-[#135bec] font-bold">OR</span> env:staging
                  </div>
                  <button onClick={() => loadExample('env:prod OR env:staging')} className="text-xs text-[#135bec] hover:text-[#1048c0] flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">play_arrow</span> 在 Playground 中试试
                  </button>
                </div>
              </div>
            </section>

            {/* Section: Fields */}
            <section className="mb-12 scroll-mt-24" id="fields">
              <div className="flex items-center gap-3 mb-4">
                <span className="material-symbols-outlined text-[#135bec] text-2xl">data_object</span>
                <h2 className={`text-2xl font-bold ${textColor}`}>字段查询</h2>
              </div>
              <p className={`${textSecondary} mb-6`}>
                指定特定字段的值进行精确匹配。支持数字比较 <code className={`${cardBg} px-1.5 py-0.5 rounded ${codeTextColor} border ${borderColor} font-mono text-xs`}>&gt;=</code>, <code className={`${cardBg} px-1.5 py-0.5 rounded ${codeTextColor} border ${borderColor} font-mono text-xs`}>&lt;=</code> 等。
              </p>
              <div className={`rounded-xl border ${borderColor} ${cardBg} overflow-hidden shadow-sm group`}>
                <div className={`flex items-center justify-between px-4 py-2 ${surfaceBg} border-b ${borderColor}`}>
                  <span className={`text-xs font-mono ${textSecondary}`}>LQL Syntax</span>
                </div>
                <div className="p-4 font-mono text-sm leading-7">
                  <span className={textSecondary}>// 查找响应时间大于 1000ms 的请求</span><br/>
                  <span className="text-blue-300">latency_ms</span> &gt; <span className="text-green-300">1000</span> <span className="text-[#135bec] font-bold">AND</span> <span className="text-blue-300">service</span>:<span className="text-yellow-400">"checkout"</span>
                </div>
              </div>
            </section>

            {/* Section: Aggregations */}
            <section className="mb-12 scroll-mt-24" id="aggregations">
              <div className="flex items-center gap-3 mb-4">
                <span className="material-symbols-outlined text-[#135bec] text-2xl">bar_chart</span>
                <h2 className={`text-2xl font-bold ${textColor}`}>聚合分析</h2>
              </div>
              <p className={`${textSecondary} mb-6`}>
                使用管道符 <code className={`${cardBg} px-1.5 py-0.5 rounded ${codeTextColor} border ${borderColor} font-mono text-xs`}>|</code> 对查询结果进行统计。
              </p>
              <div className={`rounded-xl border ${borderColor} ${cardBg} overflow-hidden shadow-sm group`}>
                <div className={`p-4 font-mono text-sm ${codeTextColor}`}>
                  <span className="text-[#135bec] font-bold">*</span> | <span className="text-[#135bec] font-bold">stats</span> count() by <span className="text-blue-300">host</span>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>

      {/* Syntax Playground (Sticky Bottom) */}
      <div className={`border-t ${borderColor} ${surfaceBg} ${isDark ? 'shadow-[0_-10px_40px_rgba(0,0,0,0.5)]' : 'shadow-lg'} z-30 shrink-0 -mx-6`}>
        <div className="w-full px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#135bec] text-[20px]">terminal</span>
              <span className={`text-sm font-bold ${textColor}`}>Syntax Playground (在线测试)</span>
              <span className={`px-2 py-0.5 rounded-full ${isDark ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-slate-200 text-slate-600 border-slate-300'} text-[10px] font-bold border uppercase tracking-wide`}>Sample Data</span>
            </div>
            <button onClick={() => { setPlaygroundQuery(''); setQueryResults([]); setExecutionTime(null); }}
              className={`text-xs ${textSecondary} ${isDark ? 'hover:text-white' : 'hover:text-slate-900'} underline decoration-slate-600 underline-offset-4`}>
              Reset
            </button>
          </div>
          <div className="flex gap-4">
            <div className="flex-1 relative group">
              <div className="absolute inset-y-0 left-0 pl-3 pt-3 pointer-events-none">
                <span className="text-[#135bec] font-mono font-bold">&gt;</span>
              </div>
              <textarea
                id="query-syntax-playground"
                name="querySyntaxPlayground"
                className={`block w-full h-24 rounded-lg ${playgroundBg} border ${borderColor} ${isDark ? 'text-slate-200' : 'text-slate-800'} font-mono text-sm pl-8 pt-3 focus:border-[#135bec] focus:ring-1 focus:ring-[#135bec] resize-none outline-none`}
                placeholder="输入查询语句进行测试... 例如: level:ERROR"
                value={playgroundQuery}
                onChange={(e) => setPlaygroundQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); executeQuery(); }
                }}
              />
              <div className="absolute bottom-3 right-3 flex items-center gap-2">
                <span className={`text-xs ${textSecondary}`}>Ctrl+Enter 运行</span>
                <button onClick={executeQuery} disabled={isRunning || !playgroundQuery.trim()}
                  className="bg-[#135bec] hover:bg-[#1048c0] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold py-1.5 px-4 rounded-md shadow-lg shadow-blue-900/20 transition-all flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">{isRunning ? 'hourglass_empty' : 'play_arrow'}</span>
                  {isRunning ? '运行中...' : '运行 (Run)'}
                </button>
              </div>
            </div>
            {/* Mini Results Preview */}
            <div className={`w-1/3 hidden xl:block ${playgroundBg} border ${borderColor} rounded-lg overflow-hidden flex flex-col`}>
              <div className={`px-3 py-1.5 ${cardBg} border-b ${borderColor} flex justify-between items-center`}>
                <span className={`text-[10px] uppercase font-bold ${textSecondary}`}>Preview Output</span>
                {executionTime !== null && <span className="text-[10px] text-green-400 font-mono">{executionTime.toFixed(0)}ms</span>}
              </div>
              <div className={`p-3 font-mono text-[10px] ${textSecondary} overflow-y-auto h-full space-y-1`}>
                {queryResults.length > 0 ? (
                  queryResults.map((log, index) => (
                    <div key={index} className="flex gap-2">
                      <span className={isDark ? 'text-slate-600' : 'text-slate-400'}>{index + 1}.</span>
                      <span>[<span className={log.level === 'ERROR' ? 'text-[#ef4444]' : log.level === 'WARN' ? 'text-[#f59e0b]' : 'text-[#10b981]'}>{log.level}</span>] {log.message.substring(0, 35)}...</span>
                    </div>
                  ))
                ) : (
                  <div className={`flex items-center justify-center h-full ${textSecondary}`}>
                    {playgroundQuery ? '点击运行查看结果' : '输入查询语句开始测试'}
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* Quick Examples */}
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className={`text-xs ${textSecondary}`}>快速示例:</span>
            {exampleQueries.slice(0, 3).map((example, index) => (
              <button key={index} onClick={() => loadExample(example.query)}
                className={`text-xs px-2 py-1 rounded ${isDark ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-200 hover:bg-slate-300'} ${textSecondary} ${isDark ? 'hover:text-white' : 'hover:text-slate-900'} transition-colors`}
                title={example.description}>
                {example.query.length > 25 ? example.query.substring(0, 25) + '...' : example.query}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuerySyntax;
