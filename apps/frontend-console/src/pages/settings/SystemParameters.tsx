import React, { useState, useCallback } from 'react';
import { Button, Select, Switch, Slider, InputNumber, message, Card } from 'antd';
import { useThemeStore } from '../../stores/themeStore';

// 系统参数配置接口
interface SystemConfig {
  maxSearchResults: number;
  queryTimeout: number;
  enableQueryCache: boolean;
  retentionPeriod: string;
  maxStorageLimit: number;
  indexShards: number;
  autoArchive: boolean;
  workerThreads: number;
  batchSize: number;
  enableRateLimit: boolean;
  rateLimitThreshold: number;
  logLevel: string;
  enableDebugMode: boolean;
  connectionTimeout: number;
  maxConnections: number;
  enableCompression: boolean;
  sessionTimeout: number;
  maxLoginAttempts: number;
  enableAuditLog: boolean;
}

const defaultConfig: SystemConfig = {
  maxSearchResults: 1000, queryTimeout: 30, enableQueryCache: true,
  retentionPeriod: '30', maxStorageLimit: 500, indexShards: 5, autoArchive: false,
  workerThreads: 8, batchSize: 500, enableRateLimit: true, rateLimitThreshold: 1000,
  logLevel: 'info', enableDebugMode: false,
  connectionTimeout: 30, maxConnections: 100, enableCompression: true,
  sessionTimeout: 30, maxLoginAttempts: 5, enableAuditLog: true,
};

type CategoryKey = 'general' | 'performance' | 'network' | 'security' | 'notification';

const categories: { key: CategoryKey; label: string; icon: string }[] = [
  { key: 'general', label: '通用设置', icon: 'tune' },
  { key: 'performance', label: '性能参数', icon: 'speed' },
  { key: 'network', label: '网络配置', icon: 'lan' },
  { key: 'security', label: '安全策略', icon: 'security' },
  { key: 'notification', label: '通知设置', icon: 'notifications' },
];

function buildSystemParameterFieldID(fieldKey: string): string {
  return `system-parameter-${fieldKey}`;
}

const SystemParameters: React.FC = () => {
  const isDark = useThemeStore((s) => s.isDark);
  const [config, setConfig] = useState<SystemConfig>(defaultConfig);
  const [activeCategory, setActiveCategory] = useState<CategoryKey>('performance');
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const updateConfig = useCallback(<K extends keyof SystemConfig>(key: K, value: SystemConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
    setSaveMessage(null);
  }, []);

  const handleReset = useCallback(() => {
    setConfig(defaultConfig);
    setHasChanges(true);
    setSaveMessage(null);
  }, []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setHasChanges(false);
      setSaveMessage({ type: 'success', text: '配置已成功保存' });
      message.success('配置已成功保存');
    } catch {
      setSaveMessage({ type: 'error', text: '保存失败，请重试' });
      message.error('保存失败，请重试');
    } finally {
      setIsSaving(false);
    }
  }, []);

  // 主题样式
  const headerBg = isDark ? 'bg-[#111722]' : 'bg-white';
  const cardBg = isDark ? 'bg-[#1e293b]' : 'bg-white';
  const inputBg = isDark ? 'bg-[#0f172a]' : 'bg-slate-50';
  const sidebarBg = isDark ? 'bg-[#111722]/50' : 'bg-slate-50';
  const sectionHeaderBg = isDark ? 'bg-[#111722]/50' : 'bg-slate-100';
  const borderColor = isDark ? 'border-[#334155]' : 'border-slate-200';
  const textColor = isDark ? 'text-white' : 'text-slate-900';
  const textSecondary = isDark ? 'text-[#94a3b8]' : 'text-slate-600';
  const labelColor = isDark ? 'text-slate-200' : 'text-slate-700';
  const buttonBg = isDark ? 'bg-[#1e293b]' : 'bg-slate-100';
  const buttonHover = isDark ? 'hover:bg-[#232f48]' : 'hover:bg-slate-200';
  const navItemActive = isDark ? 'bg-[#1e293b]' : 'bg-slate-200';
  const navItemHover = isDark ? 'hover:bg-white/5' : 'hover:bg-slate-100';
  const unitBg = isDark ? 'bg-[#2a3649]' : 'bg-slate-200';

  // 渲染开关组件
  const renderToggle = (checked: boolean, onChange: (checked: boolean) => void, label: string, description?: string) => (
    <div className="flex items-center justify-between">
      <div className="flex flex-col gap-1">
        <span className={`text-sm font-medium ${labelColor}`}>{label}</span>
        {description && <span className={`text-xs ${textSecondary}`}>{description}</span>}
      </div>
      <Switch checked={checked} onChange={onChange} />
    </div>
  );

  // 渲染数字输入框
  const renderNumberInput = (
    fieldKey: keyof SystemConfig,
    value: number,
    onChange: (value: number) => void,
    label: string,
    unit?: string,
    hint?: string,
    helpText?: string,
  ) => {
    const inputID = buildSystemParameterFieldID(fieldKey);

    return (
      <div className="flex flex-col gap-2">
        <label htmlFor={inputID} className={`text-sm font-medium ${labelColor} flex items-center gap-2`}>
          {label}
          {helpText && <span className={`material-symbols-outlined text-[16px] ${textSecondary} cursor-help`} title={helpText}>help</span>}
        </label>
        <div className="relative">
          <input
            id={inputID}
            name={inputID}
            className={`w-full ${inputBg} border ${borderColor} rounded-lg px-4 py-2.5 ${textColor} focus:ring-1 focus:ring-[#135bec] focus:border-[#135bec] outline-none transition-all`}
            type="number"
            value={value}
            onChange={(e) => onChange(parseInt(e.target.value) || 0)}
          />
          {unit && <span className={`absolute right-4 top-2.5 text-sm ${textSecondary}`}>{unit}</span>}
        </div>
        {hint && <p className={`text-xs ${textSecondary}`}>{hint}</p>}
      </div>
    );
  };

  // 渲染性能参数部分
  const renderPerformanceSection = () => (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className={`${cardBg} rounded-xl border ${borderColor} overflow-hidden`}>
        <div className={`px-6 py-4 border-b ${borderColor} ${sectionHeaderBg} flex items-center gap-3`}>
          <span className="material-symbols-outlined text-[#135bec]">speed</span>
          <h3 className={`text-base font-bold ${textColor}`}>搜索与查询性能</h3>
        </div>
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {renderNumberInput('maxSearchResults', config.maxSearchResults, (v) => updateConfig('maxSearchResults', v), '最大搜索结果数', '条', '建议值: 1000 - 5000', '单次查询返回的最大日志条数')}
            {renderNumberInput('queryTimeout', config.queryTimeout, (v) => updateConfig('queryTimeout', v), '查询超时时间', '秒')}
          </div>
          {renderToggle(config.enableQueryCache, (v) => updateConfig('enableQueryCache', v), '启用查询缓存', '缓存常用查询结果以提高响应速度')}
        </div>
      </div>

      <div className={`${cardBg} rounded-xl border ${borderColor} overflow-hidden`}>
        <div className={`px-6 py-4 border-b ${borderColor} ${sectionHeaderBg} flex items-center gap-3`}>
          <span className="material-symbols-outlined text-[#135bec]">database</span>
          <h3 className={`text-base font-bold ${textColor}`}>数据存储与保留</h3>
        </div>
        <div className="p-6 space-y-6">
          <div className="flex flex-col gap-2">
            <label htmlFor={buildSystemParameterFieldID('retentionPeriod')} className={`text-sm font-medium ${labelColor}`}>默认保留期限</label>
            <div className="relative">
              <select
                id={buildSystemParameterFieldID('retentionPeriod')}
                name={buildSystemParameterFieldID('retentionPeriod')}
                className={`w-full ${inputBg} border ${borderColor} rounded-lg px-4 py-2.5 ${textColor} focus:ring-1 focus:ring-[#135bec] focus:border-[#135bec] outline-none transition-all appearance-none cursor-pointer`}
                value={config.retentionPeriod}
                onChange={(e) => updateConfig('retentionPeriod', e.target.value)}
              >
                <option value="7">7 天</option>
                <option value="30">30 天</option>
                <option value="90">90 天</option>
                <option value="180">180 天</option>
                <option value="365">1 年</option>
                <option value="forever">永久保存</option>
              </select>
              <span className={`absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined ${textSecondary} pointer-events-none`}>expand_more</span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <label htmlFor={buildSystemParameterFieldID('maxStorageLimit')} className={`text-sm font-medium ${labelColor}`}>最大存储空间限制</label>
              <div className="flex">
                <input
                  id={buildSystemParameterFieldID('maxStorageLimit')}
                  name={buildSystemParameterFieldID('maxStorageLimit')}
                  className={`flex-1 ${inputBg} border border-r-0 ${borderColor} rounded-l-lg px-4 py-2.5 ${textColor} focus:ring-1 focus:ring-[#135bec] focus:border-[#135bec] outline-none transition-all`}
                  type="number"
                  value={config.maxStorageLimit}
                  onChange={(e) => updateConfig('maxStorageLimit', parseInt(e.target.value) || 0)}
                />
                <div className={`${unitBg} border ${borderColor} px-4 flex items-center rounded-r-lg text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>GB</div>
              </div>
            </div>
            {renderNumberInput('indexShards', config.indexShards, (v) => updateConfig('indexShards', v), '索引分片数')}
          </div>
          <div className={`border-t ${borderColor} my-4`}></div>
          {renderToggle(config.autoArchive, (v) => updateConfig('autoArchive', v), '自动归档旧数据', '超过保留期限的数据将自动转移到冷存储')}
        </div>
      </div>

      <div className={`${cardBg} rounded-xl border ${borderColor} overflow-hidden`}>
        <div className={`px-6 py-4 border-b ${borderColor} ${sectionHeaderBg} flex items-center gap-3`}>
          <span className="material-symbols-outlined text-[#135bec]">memory</span>
          <h3 className={`text-base font-bold ${textColor}`}>线程与 API 限流</h3>
        </div>
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {renderNumberInput('workerThreads', config.workerThreads, (v) => updateConfig('workerThreads', v), '工作线程数 (Worker Threads)', undefined, '建议设置为 CPU 核心数的 2 倍')}
            {renderNumberInput('batchSize', config.batchSize, (v) => updateConfig('batchSize', v), '批处理大小 (Batch Size)')}
          </div>
          <div className={`border-t ${borderColor} my-4`}></div>
          {renderToggle(config.enableRateLimit, (v) => updateConfig('enableRateLimit', v), 'API 速率限制 (Rate Limiting)', '防止 API 滥用导致系统过载')}
          {config.enableRateLimit && (
            <div className={`${inputBg} rounded-lg p-4 border ${borderColor}`}>
              <div className="flex flex-col gap-3">
                <label htmlFor={buildSystemParameterFieldID('rateLimitThreshold')} className={`text-sm font-medium ${labelColor}`}>限制阈值</label>
                <div className="flex items-center gap-3">
                  <input
                    id={buildSystemParameterFieldID('rateLimitThreshold')}
                    name={buildSystemParameterFieldID('rateLimitThreshold')}
                    className={`w-full h-2 ${unitBg} rounded-lg appearance-none cursor-pointer accent-[#135bec]`}
                    type="range" min="100" max="5000"
                    value={config.rateLimitThreshold}
                    onChange={(e) => updateConfig('rateLimitThreshold', parseInt(e.target.value))}
                  />
                  <div className="min-w-[100px] text-right">
                    <span className={`text-sm font-bold ${textColor}`}>{config.rateLimitThreshold}</span>
                    <span className={`text-xs ${textSecondary} ml-1`}>req/s</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // 渲染通用设置部分
  const renderGeneralSection = () => (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className={`${cardBg} rounded-xl border ${borderColor} overflow-hidden`}>
        <div className={`px-6 py-4 border-b ${borderColor} ${sectionHeaderBg} flex items-center gap-3`}>
          <span className="material-symbols-outlined text-[#135bec]">tune</span>
          <h3 className={`text-base font-bold ${textColor}`}>通用设置</h3>
        </div>
        <div className="p-6 space-y-6">
          <div className="flex flex-col gap-2">
            <label htmlFor={buildSystemParameterFieldID('logLevel')} className={`text-sm font-medium ${labelColor}`}>日志级别</label>
            <div className="relative">
              <select
                id={buildSystemParameterFieldID('logLevel')}
                name={buildSystemParameterFieldID('logLevel')}
                className={`w-full ${inputBg} border ${borderColor} rounded-lg px-4 py-2.5 ${textColor} focus:ring-1 focus:ring-[#135bec] focus:border-[#135bec] outline-none transition-all appearance-none cursor-pointer`}
                value={config.logLevel}
                onChange={(e) => updateConfig('logLevel', e.target.value)}
              >
                <option value="debug">Debug</option>
                <option value="info">Info</option>
                <option value="warn">Warning</option>
                <option value="error">Error</option>
              </select>
              <span className={`absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined ${textSecondary} pointer-events-none`}>expand_more</span>
            </div>
            <p className={`text-xs ${textSecondary}`}>设置系统日志的详细程度</p>
          </div>
          <div className={`border-t ${borderColor} my-4`}></div>
          {renderToggle(config.enableDebugMode, (v) => updateConfig('enableDebugMode', v), '启用调试模式', '开启后将记录更详细的调试信息，可能影响性能')}
        </div>
      </div>
    </div>
  );

  // 渲染网络配置部分
  const renderNetworkSection = () => (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className={`${cardBg} rounded-xl border ${borderColor} overflow-hidden`}>
        <div className={`px-6 py-4 border-b ${borderColor} ${sectionHeaderBg} flex items-center gap-3`}>
          <span className="material-symbols-outlined text-[#135bec]">lan</span>
          <h3 className={`text-base font-bold ${textColor}`}>网络配置</h3>
        </div>
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {renderNumberInput('connectionTimeout', config.connectionTimeout, (v) => updateConfig('connectionTimeout', v), '连接超时时间', '秒', '建议值: 10 - 60')}
            {renderNumberInput('maxConnections', config.maxConnections, (v) => updateConfig('maxConnections', v), '最大连接数', undefined, '建议值: 50 - 500')}
          </div>
          <div className={`border-t ${borderColor} my-4`}></div>
          {renderToggle(config.enableCompression, (v) => updateConfig('enableCompression', v), '启用数据压缩', '压缩传输数据以减少带宽使用')}
        </div>
      </div>
    </div>
  );

  // 渲染安全策略部分
  const renderSecuritySection = () => (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className={`${cardBg} rounded-xl border ${borderColor} overflow-hidden`}>
        <div className={`px-6 py-4 border-b ${borderColor} ${sectionHeaderBg} flex items-center gap-3`}>
          <span className="material-symbols-outlined text-[#135bec]">security</span>
          <h3 className={`text-base font-bold ${textColor}`}>安全策略</h3>
        </div>
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {renderNumberInput('sessionTimeout', config.sessionTimeout, (v) => updateConfig('sessionTimeout', v), '会话超时时间', '分钟', '用户无操作后自动登出的时间')}
            {renderNumberInput('maxLoginAttempts', config.maxLoginAttempts, (v) => updateConfig('maxLoginAttempts', v), '最大登录尝试次数', '次', '超过后账户将被临时锁定')}
          </div>
          <div className={`border-t ${borderColor} my-4`}></div>
          {renderToggle(config.enableAuditLog, (v) => updateConfig('enableAuditLog', v), '启用审计日志', '记录所有用户操作以便安全审计')}
        </div>
      </div>
    </div>
  );

  // 渲染通知设置部分
  const renderNotificationSection = () => (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className={`${cardBg} rounded-xl border ${borderColor} overflow-hidden`}>
        <div className={`px-6 py-4 border-b ${borderColor} ${sectionHeaderBg} flex items-center gap-3`}>
          <span className="material-symbols-outlined text-[#135bec]">notifications</span>
          <h3 className={`text-base font-bold ${textColor}`}>通知设置</h3>
        </div>
        <div className="p-6 space-y-6">
          <p className={`text-sm ${textSecondary}`}>通知相关配置请前往告警管理模块进行设置。</p>
          <a href="/alerts/notification" className="inline-flex items-center gap-2 text-[#135bec] hover:underline text-sm">
            <span>前往告警通知配置</span>
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </a>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeCategory) {
      case 'general': return renderGeneralSection();
      case 'performance': return renderPerformanceSection();
      case 'network': return renderNetworkSection();
      case 'security': return renderSecuritySection();
      case 'notification': return renderNotificationSection();
      default: return renderPerformanceSection();
    }
  };

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Header */}
      <header className={`flex items-center justify-between px-8 py-6 border-b ${borderColor} ${headerBg} shrink-0 -mx-6 -mt-6`}>
        <div className="flex flex-col gap-1">
          <h1 className={`text-2xl font-bold ${textColor} tracking-tight`}>系统参数配置</h1>
          <p className={`text-sm ${textSecondary}`}>管理系统的核心配置，包括性能、网络及安全设置。</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { window.location.hash = '#/help/faq'; }}
            className={`px-4 py-2 text-sm font-medium ${textSecondary} ${buttonBg} border ${borderColor} rounded-lg ${buttonHover} transition-colors flex items-center gap-2`}
          >
            <span className="material-symbols-outlined text-[18px]">help</span>
            帮助
          </button>
          {saveMessage && (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${saveMessage.type === 'success' ? 'bg-[#10b981]/10 text-[#10b981]' : 'bg-[#ef4444]/10 text-[#ef4444]'}`}>
              <span className="material-symbols-outlined text-[18px]">{saveMessage.type === 'success' ? 'check_circle' : 'error'}</span>
              {saveMessage.text}
            </div>
          )}
          {hasChanges && (
            <span className={`text-xs px-2 py-1 rounded ${isDark ? 'bg-yellow-500/10 text-yellow-400' : 'bg-yellow-100 text-yellow-700'}`}>
              未保存的更改
            </span>
          )}
          <button
            onClick={handleReset}
            disabled={isSaving}
            className={`px-4 py-2 text-sm font-medium ${textSecondary} ${buttonBg} border ${borderColor} rounded-lg ${buttonHover} transition-colors flex items-center gap-2 disabled:opacity-50`}
          >
            <span className="material-symbols-outlined text-[18px]">restart_alt</span>
            恢复默认
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            className="px-4 py-2 text-sm font-medium text-white bg-[#135bec] rounded-lg hover:bg-[#1050d0] transition-colors shadow-lg shadow-blue-900/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                保存中...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">save</span>
                保存更改
              </>
            )}
          </button>
        </div>
      </header>

      {/* Content Split Layout */}
      <div className="flex flex-1 overflow-hidden -mx-6">
        {/* Vertical Tabs (Categories) */}
        <div className={`w-64 ${sidebarBg} border-r ${borderColor} p-6 overflow-y-auto hidden md:block`}>
          <h3 className={`text-xs font-bold ${textSecondary} uppercase tracking-wider mb-4 px-3`}>设置类别</h3>
          <nav className="flex flex-col gap-1">
            {categories.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors text-left w-full ${
                  activeCategory === cat.key
                    ? `${navItemActive} ${textColor} shadow-sm ring-1 ${isDark ? 'ring-[#334155]' : 'ring-slate-300'}`
                    : `${textSecondary} ${navItemHover}`
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`material-symbols-outlined text-[18px] ${activeCategory === cat.key ? 'text-[#135bec]' : ''}`}>{cat.icon}</span>
                  <span className="text-sm font-medium">{cat.label}</span>
                </div>
                {activeCategory === cat.key && (
                  <span className="material-symbols-outlined text-[16px] text-[#135bec]">chevron_right</span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Mobile Category Selector */}
        <div className={`md:hidden w-full px-6 py-4 border-b ${borderColor} ${sidebarBg}`}>
          <select
            id="system-parameter-category"
            name="system-parameter-category"
            value={activeCategory}
            onChange={(e) => setActiveCategory(e.target.value as CategoryKey)}
            className={`w-full ${inputBg} border ${borderColor} rounded-lg px-4 py-2.5 ${textColor} focus:ring-1 focus:ring-[#135bec] focus:border-[#135bec] outline-none`}
          >
            {categories.map((cat) => (
              <option key={cat.key} value={cat.key}>{cat.label}</option>
            ))}
          </select>
        </div>

        {/* Scrollable Form Area */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-10">
          {renderContent()}
          <div className="h-20"></div>
        </div>
      </div>
    </div>
  );
};

export default SystemParameters;
