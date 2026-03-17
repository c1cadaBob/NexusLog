import React, { useState, useRef } from 'react';
import { Switch } from 'antd';
import { useThemeStore } from '../../stores/themeStore';

interface BrandConfig {
  logoUrl: string;
  faviconUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  systemName: string;
  defaultLanguage: string;
  defaultTimezone: string;
}

const colorPresets = [
  { name: '默认蓝', primary: '#3b82f6', secondary: '#64748b', accent: '#10b981' },
  { name: '深邃紫', primary: '#8b5cf6', secondary: '#6b7280', accent: '#f59e0b' },
  { name: '活力橙', primary: '#f97316', secondary: '#78716c', accent: '#06b6d4' },
  { name: '专业绿', primary: '#22c55e', secondary: '#71717a', accent: '#ec4899' },
];

const GlobalConfig: React.FC = () => {
  const isDark = useThemeStore((s) => s.isDark);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  const [brandConfig, setBrandConfig] = useState<BrandConfig>({
    logoUrl: '', faviconUrl: '',
    primaryColor: '#3b82f6', secondaryColor: '#64748b', accentColor: '#10b981',
    systemName: 'NexusLog Pro', defaultLanguage: 'zh-CN', defaultTimezone: 'Asia/Shanghai',
  });

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setBrandConfig(prev => ({ ...prev, logoUrl: reader.result as string }));
      reader.readAsDataURL(file);
    }
  };

  const handleFaviconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setBrandConfig(prev => ({ ...prev, faviconUrl: reader.result as string }));
      reader.readAsDataURL(file);
    }
  };

  const applyColorPreset = (preset: typeof colorPresets[0]) => {
    setBrandConfig(prev => ({ ...prev, primaryColor: preset.primary, secondaryColor: preset.secondary, accentColor: preset.accent }));
  };

  // 主题样式
  const headerBg = isDark ? 'bg-[#111722]' : 'bg-white';
  const cardBg = isDark ? 'bg-[#1e293b]' : 'bg-white';
  const inputBg = isDark ? 'bg-[#111722]' : 'bg-slate-50';
  const borderColor = isDark ? 'border-[#334155]' : 'border-slate-200';
  const textColor = isDark ? 'text-white' : 'text-slate-900';
  const textSecondary = isDark ? 'text-[#94a3b8]' : 'text-slate-600';
  const buttonBg = isDark ? 'bg-[#232f48]' : 'bg-slate-100';
  const buttonHover = isDark ? 'hover:bg-[#2c3b59]' : 'hover:bg-slate-200';
  const dividerColor = isDark ? 'border-[#334155]/50' : 'border-slate-200';
  const uploadBg = isDark ? 'bg-[#0f172a]' : 'bg-slate-100';

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <header className={`flex flex-col gap-4 border-b ${borderColor} ${headerBg} px-6 py-5 sticky top-0 z-10 shadow-lg ${isDark ? 'shadow-black/20' : 'shadow-slate-200/50'} shrink-0 -mx-6 -mt-6`}>
        <div className="flex items-center gap-2 text-sm text-[#94a3b8]">
          <span>系统设置</span>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className={`${textColor} font-medium`}>全局配置</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className={`${textColor} text-3xl font-bold tracking-tight`}>全局配置</h1>
            <p className={`${textSecondary} mt-1`}>管理集群元数据、存储后端、邮件服务及外部认证设置。</p>
          </div>
          <div className="flex gap-3">
            <button className={`flex items-center justify-center h-10 px-4 rounded-lg ${buttonBg} ${buttonHover} ${textColor} text-sm font-bold transition-colors`}>
              重置
            </button>
            <button className="flex items-center justify-center gap-2 h-10 px-6 rounded-lg bg-[#135bec] hover:bg-[#1050d0] text-white text-sm font-bold shadow-lg shadow-blue-900/20 transition-all">
              <span className="material-symbols-outlined text-[20px]">save</span>
              <span>保存更改</span>
            </button>
          </div>
        </div>
      </header>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-6 lg:p-10 space-y-8">
        {/* 品牌定制 */}
        <section className="space-y-4 max-w-5xl">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-[#135bec] text-[28px]">palette</span>
            <h2 className={`${textColor} text-xl font-bold`}>品牌定制 (Brand Customization)</h2>
          </div>
          <div className={`${cardBg} p-6 rounded-xl border ${borderColor} space-y-6`}>
            {/* 系统名称 */}
            <div className="flex flex-col gap-2">
              <label htmlFor="global-config-system-name" className={`${textColor} text-sm font-medium`}>系统名称 (System Name)</label>
              <input
                id="global-config-system-name"
                name="globalConfigSystemName"
                className={`rounded-lg ${inputBg} border ${borderColor} ${textColor} px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec] focus:border-transparent transition-all placeholder:text-gray-600 max-w-md`}
                type="text"
                value={brandConfig.systemName}
                onChange={(e) => setBrandConfig(prev => ({ ...prev, systemName: e.target.value }))}
              />
              <p className={`text-xs ${textSecondary}`}>显示在浏览器标签和登录页面的系统名称</p>
            </div>

            {/* Logo & Favicon Upload */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Logo Upload */}
              <div className="flex flex-col gap-3">
                <label htmlFor="global-config-logo" className={`${textColor} text-sm font-medium`}>系统 Logo</label>
                <div
                  className={`${uploadBg} border-2 border-dashed ${borderColor} rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer hover:border-[#135bec] transition-colors min-h-[160px]`}
                  onClick={() => logoInputRef.current?.click()}
                >
                  {brandConfig.logoUrl ? (
                    <div className="relative group">
                      <img src={brandConfig.logoUrl} alt="Logo Preview" className="max-h-20 max-w-full object-contain" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded">
                        <span className="material-symbols-outlined text-white">edit</span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <span className={`material-symbols-outlined text-[40px] ${textSecondary} mb-2`}>cloud_upload</span>
                      <p className={`text-sm ${textSecondary} text-center`}>点击上传 Logo</p>
                      <p className={`text-xs ${textSecondary} mt-1`}>推荐尺寸: 200x50px, PNG/SVG</p>
                    </>
                  )}
                </div>
                <input id="global-config-logo" name="globalConfigLogo" ref={logoInputRef} type="file" accept="image/png,image/svg+xml,image/jpeg" className="hidden" onChange={handleLogoUpload} />
                {brandConfig.logoUrl && (
                  <button className={`text-xs ${textSecondary} hover:text-[#ef4444] transition-colors self-start`} onClick={() => setBrandConfig(prev => ({ ...prev, logoUrl: '' }))}>
                    移除 Logo
                  </button>
                )}
              </div>

              {/* Favicon Upload */}
              <div className="flex flex-col gap-3">
                <label htmlFor="global-config-favicon" className={`${textColor} text-sm font-medium`}>网站图标 (Favicon)</label>
                <div
                  className={`${uploadBg} border-2 border-dashed ${borderColor} rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer hover:border-[#135bec] transition-colors min-h-[160px]`}
                  onClick={() => faviconInputRef.current?.click()}
                >
                  {brandConfig.faviconUrl ? (
                    <div className="relative group">
                      <img src={brandConfig.faviconUrl} alt="Favicon Preview" className="w-16 h-16 object-contain" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded">
                        <span className="material-symbols-outlined text-white">edit</span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <span className={`material-symbols-outlined text-[40px] ${textSecondary} mb-2`}>tab</span>
                      <p className={`text-sm ${textSecondary} text-center`}>点击上传 Favicon</p>
                      <p className={`text-xs ${textSecondary} mt-1`}>推荐尺寸: 32x32px, ICO/PNG</p>
                    </>
                  )}
                </div>
                <input id="global-config-favicon" name="globalConfigFavicon" ref={faviconInputRef} type="file" accept="image/x-icon,image/png,image/svg+xml" className="hidden" onChange={handleFaviconUpload} />
                {brandConfig.faviconUrl && (
                  <button className={`text-xs ${textSecondary} hover:text-[#ef4444] transition-colors self-start`} onClick={() => setBrandConfig(prev => ({ ...prev, faviconUrl: '' }))}>
                    移除 Favicon
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        <hr className={dividerColor} />

        {/* 颜色自定义 */}
        <section className="space-y-4 max-w-5xl">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-[#135bec] text-[28px]">format_color_fill</span>
            <h2 className={`${textColor} text-xl font-bold`}>颜色自定义 (Color Customization)</h2>
          </div>
          <div className={`${cardBg} p-6 rounded-xl border ${borderColor} space-y-6`}>
            {/* 预设配色方案 */}
            <div className="flex flex-col gap-3">
              <label className={`${textColor} text-sm font-medium`}>预设配色方案</label>
              <div className="flex flex-wrap gap-3">
                {colorPresets.map((preset) => (
                  <button key={preset.name} onClick={() => applyColorPreset(preset)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border ${borderColor} ${buttonBg} ${buttonHover} transition-all`}>
                    <div className="flex -space-x-1">
                      <div className="w-4 h-4 rounded-full border-2 border-white" style={{ backgroundColor: preset.primary }}></div>
                      <div className="w-4 h-4 rounded-full border-2 border-white" style={{ backgroundColor: preset.secondary }}></div>
                      <div className="w-4 h-4 rounded-full border-2 border-white" style={{ backgroundColor: preset.accent }}></div>
                    </div>
                    <span className={`text-sm ${textColor}`}>{preset.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 自定义颜色 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { key: 'primaryColor' as const, label: '主色调 (Primary)', desc: '按钮、链接、高亮元素' },
                { key: 'secondaryColor' as const, label: '辅助色 (Secondary)', desc: '次要文本、边框' },
                { key: 'accentColor' as const, label: '强调色 (Accent)', desc: '成功状态、图标' },
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex flex-col gap-2">
                  <label htmlFor={`brand-color-${key}-value`} className={`${textColor} text-sm font-medium`}>{label}</label>
                  <div className="flex items-center gap-3">
                    <input
                      id={`brand-color-${key}-picker`}
                      name={`brandColor${key}Picker`}
                      type="color"
                      value={brandConfig[key]}
                      onChange={(e) => setBrandConfig(prev => ({ ...prev, [key]: e.target.value }))}
                      className="w-12 h-12 rounded-lg cursor-pointer border-0 p-0"
                    />
                    <input
                      id={`brand-color-${key}-value`}
                      name={`brandColor${key}Value`}
                      type="text"
                      value={brandConfig[key]}
                      onChange={(e) => setBrandConfig(prev => ({ ...prev, [key]: e.target.value }))}
                      className={`flex-1 rounded-lg ${inputBg} border ${borderColor} ${textColor} px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#135bec] uppercase`}
                    />
                  </div>
                  <p className={`text-xs ${textSecondary}`}>{desc}</p>
                </div>
              ))}
            </div>

            {/* 颜色预览 */}
            <div className={`${inputBg} rounded-lg p-4 border ${borderColor}`}>
              <p className={`text-xs ${textSecondary} mb-3 uppercase font-medium`}>颜色预览</p>
              <div className="flex items-center gap-4">
                <button className="px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors" style={{ backgroundColor: brandConfig.primaryColor }}>主要按钮</button>
                <button className="px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors" style={{ backgroundColor: brandConfig.secondaryColor }}>次要按钮</button>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-white" style={{ backgroundColor: brandConfig.accentColor }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                  状态标签
                </span>
              </div>
            </div>
          </div>
        </section>

        <hr className={dividerColor} />

        {/* 默认设置 */}
        <section className="space-y-4 max-w-5xl">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-[#135bec] text-[28px]">settings</span>
            <h2 className={`${textColor} text-xl font-bold`}>默认设置 (Default Settings)</h2>
          </div>
          <div className={`${cardBg} p-6 rounded-xl border ${borderColor} space-y-6`}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label htmlFor="global-config-default-language" className={`${textColor} text-sm font-medium`}>默认语言 (Default Language)</label>
                <div className="relative">
                  <select id="global-config-default-language" name="globalConfigDefaultLanguage" className={`w-full appearance-none rounded-lg ${inputBg} border ${borderColor} ${textColor} px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec] focus:border-transparent`}
                    value={brandConfig.defaultLanguage} onChange={(e) => setBrandConfig(prev => ({ ...prev, defaultLanguage: e.target.value }))}>
                    <option value="zh-CN">简体中文</option>
                    <option value="zh-TW">繁體中文</option>
                    <option value="en-US">English (US)</option>
                    <option value="ja-JP">日本語</option>
                    <option value="ko-KR">한국어</option>
                  </select>
                  <div className={`pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 ${textColor}`}>
                    <span className="material-symbols-outlined text-[20px]">expand_more</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="global-config-default-timezone" className={`${textColor} text-sm font-medium`}>默认时区 (Default Timezone)</label>
                <div className="relative">
                  <select id="global-config-default-timezone" name="globalConfigDefaultTimezone" className={`w-full appearance-none rounded-lg ${inputBg} border ${borderColor} ${textColor} px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec] focus:border-transparent`}
                    value={brandConfig.defaultTimezone} onChange={(e) => setBrandConfig(prev => ({ ...prev, defaultTimezone: e.target.value }))}>
                    <option value="Asia/Shanghai">Asia/Shanghai (UTC+8)</option>
                    <option value="Asia/Tokyo">Asia/Tokyo (UTC+9)</option>
                    <option value="Asia/Hong_Kong">Asia/Hong_Kong (UTC+8)</option>
                    <option value="America/New_York">America/New_York (UTC-5)</option>
                    <option value="America/Los_Angeles">America/Los_Angeles (UTC-8)</option>
                    <option value="Europe/London">Europe/London (UTC+0)</option>
                    <option value="UTC">UTC (UTC+0)</option>
                  </select>
                  <div className={`pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 ${textColor}`}>
                    <span className="material-symbols-outlined text-[20px]">expand_more</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <hr className={dividerColor} />

        {/* 集群元数据 */}
        <section className="space-y-4 max-w-5xl">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-[#135bec] text-[28px]">dns</span>
            <h2 className={`${textColor} text-xl font-bold`}>集群元数据 (Cluster Metadata)</h2>
          </div>
          <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${cardBg} p-6 rounded-xl border ${borderColor}`}>
            <div className="flex flex-col gap-2">
              <label htmlFor="global-config-cluster-id" className={`${textColor} text-sm font-medium`}>集群 ID (Cluster ID)</label>
              <div className="flex gap-2">
                <input id="global-config-cluster-id" name="globalConfigClusterId" className={`flex-1 rounded-lg ${inputBg} border ${borderColor} ${textSecondary} px-4 py-2.5 text-sm focus:outline-none cursor-not-allowed font-mono`} readOnly defaultValue="c-782j1-log-prod-v2" />
                <button className={`p-2.5 rounded-lg ${buttonBg} ${textSecondary} ${isDark ? 'hover:text-white' : 'hover:text-slate-900'} transition-colors`} title="Copy ID">
                  <span className="material-symbols-outlined text-[20px]">content_copy</span>
                </button>
              </div>
              <p className={`text-xs ${textSecondary}`}>系统自动生成的唯一标识符，不可修改。</p>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="global-config-cluster-name" className={`${textColor} text-sm font-medium`}>集群名称 (Cluster Name)</label>
              <input id="global-config-cluster-name" name="globalConfigClusterName" className={`rounded-lg ${inputBg} border ${borderColor} ${textColor} px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec] focus:border-transparent transition-all placeholder:text-gray-600`} type="text" defaultValue="Enterprise Log Center HK" />
            </div>
          </div>
        </section>

        <hr className={dividerColor} />

        {/* 存储后端 */}
        <section className="space-y-4 max-w-5xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#135bec] text-[28px]">database</span>
              <h2 className={`${textColor} text-xl font-bold`}>存储后端 (Storage Backend)</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-[#10b981]/10 px-2.5 py-0.5 text-xs font-medium text-[#10b981] ring-1 ring-inset ring-[#10b981]/20">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] mr-1.5 animate-pulse"></span>
                Connected
              </span>
            </div>
          </div>
          <div className={`${cardBg} p-6 rounded-xl border ${borderColor} space-y-6`}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex flex-col gap-2">
                <label htmlFor="global-config-storage-type" className={`${textColor} text-sm font-medium`}>存储类型 (Type)</label>
                <div className="relative">
                  <select id="global-config-storage-type" name="globalConfigStorageType" className={`w-full appearance-none rounded-lg ${inputBg} border ${borderColor} ${textColor} px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec] focus:border-transparent`}>
                    <option value="elasticsearch">ElasticSearch</option>
                    <option value="doris">Apache Doris</option>
                    <option value="clickhouse">ClickHouse</option>
                  </select>
                  <div className={`pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 ${textColor}`}>
                    <span className="material-symbols-outlined text-[20px]">expand_more</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2 md:col-span-2">
                <label htmlFor="global-config-storage-endpoint" className={`${textColor} text-sm font-medium`}>连接地址 (Endpoint)</label>
                <input id="global-config-storage-endpoint" name="globalConfigStorageEndpoint" className={`rounded-lg ${inputBg} border ${borderColor} ${textColor} px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec] focus:border-transparent font-mono`} type="text" defaultValue="http://es-cluster-01.internal:9200" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label htmlFor="global-config-storage-username" className={`${textColor} text-sm font-medium`}>用户名 (Username)</label>
                <input id="global-config-storage-username" name="globalConfigStorageUsername" className={`rounded-lg ${inputBg} border ${borderColor} ${textColor} px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec] focus:border-transparent`} placeholder="optional" type="text" />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="global-config-storage-password" className={`${textColor} text-sm font-medium`}>密码 (Password)</label>
                <form className="relative" onSubmit={(event) => event.preventDefault()}>
                  <input type="text" name="globalConfigStorageFormUsername" autoComplete="username" className="hidden" tabIndex={-1} aria-hidden="true" />
                  <input id="global-config-storage-password" name="globalConfigStoragePassword" autoComplete="new-password" className={`w-full rounded-lg ${inputBg} border ${borderColor} ${textColor} px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec] focus:border-transparent`} type="password" defaultValue="supersecretpassword" />
                  <button type="button" className={`absolute inset-y-0 right-0 flex items-center px-3 ${textSecondary} ${isDark ? 'hover:text-white' : 'hover:text-slate-900'}`}>
                    <span className="material-symbols-outlined text-[20px]">visibility_off</span>
                  </button>
                </form>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button className={`flex items-center gap-2 px-4 py-2 rounded-lg ${buttonBg} ${buttonHover} ${textColor} text-sm font-medium transition-colors border ${borderColor}`}>
                <span className="material-symbols-outlined text-[18px]">wifi_tethering</span>
                测试连接 (Test Connection)
              </button>
            </div>
          </div>
        </section>

        <hr className={dividerColor} />

        {/* 邮件服务 */}
        <section className="space-y-4 max-w-5xl">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-[#135bec] text-[28px]">mail</span>
            <h2 className={`${textColor} text-xl font-bold`}>邮件服务 (SMTP Server)</h2>
          </div>
          <div className={`${cardBg} p-6 rounded-xl border ${borderColor} space-y-6`}>
            <div className="flex items-center justify-between">
              <p className={`${textSecondary} text-sm`}>配置用于发送告警和系统通知的邮件服务器。</p>
              <div className="flex items-center gap-3">
                <Switch defaultChecked />
                <span className={`text-sm font-medium ${textColor}`}>启用邮件通知</span>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="flex flex-col gap-2 md:col-span-3">
                <label htmlFor="global-config-smtp-host" className={`${textColor} text-sm font-medium`}>SMTP 主机 (Host)</label>
                <input id="global-config-smtp-host" name="globalConfigSmtpHost" className={`rounded-lg ${inputBg} border ${borderColor} ${textColor} px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec] focus:border-transparent font-mono`} placeholder="smtp.example.com" type="text" />
              </div>
              <div className="flex flex-col gap-2 md:col-span-1">
                <label htmlFor="global-config-smtp-port" className={`${textColor} text-sm font-medium`}>端口 (Port)</label>
                <input id="global-config-smtp-port" name="globalConfigSmtpPort" className={`rounded-lg ${inputBg} border ${borderColor} ${textColor} px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec] focus:border-transparent font-mono`} placeholder="587" type="number" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label htmlFor="global-config-smtp-sender" className={`${textColor} text-sm font-medium`}>发件人地址 (Sender Email)</label>
                <input id="global-config-smtp-sender" name="globalConfigSmtpSender" className={`rounded-lg ${inputBg} border ${borderColor} ${textColor} px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec] focus:border-transparent`} placeholder="alerts@company.com" type="email" />
              </div>
              <div className="flex flex-col gap-2">
                <label className={`${textColor} text-sm font-medium`}>加密方式 (Encryption)</label>
                <div className="flex gap-4 pt-2">
                  {['TLS', 'SSL', 'None'].map((enc, i) => {
                    const encryptionId = `global-config-smtp-encryption-${enc.toLowerCase()}`;
                    return (
                      <label key={enc} htmlFor={encryptionId} className="flex items-center gap-2 cursor-pointer">
                        <input id={encryptionId} name="globalConfigSmtpEncryption" type="radio" className={`text-[#135bec] ${inputBg} border-gray-600 focus:ring-[#135bec] focus:ring-2`} defaultChecked={i === 0} />
                        <span className={`${textColor} text-sm`}>{enc}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button className={`flex items-center gap-2 px-4 py-2 rounded-lg ${buttonBg} ${buttonHover} ${textColor} text-sm font-medium transition-colors border ${borderColor} opacity-50 cursor-not-allowed`}>
                <span className="material-symbols-outlined text-[18px]">send</span>
                发送测试邮件
              </button>
            </div>
          </div>
        </section>

        <hr className={dividerColor} />

        {/* 外部认证 */}
        <section className="space-y-4 max-w-5xl pb-10">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-[#135bec] text-[28px]">security</span>
            <h2 className={`${textColor} text-xl font-bold`}>外部认证 (External Auth)</h2>
          </div>
          <div className={`${cardBg} rounded-xl border ${borderColor} overflow-hidden`}>
            {/* Tabs */}
            <div className={`flex border-b ${borderColor} ${headerBg}`}>
              <button className={`px-6 py-3 text-sm font-medium ${textColor} border-b-2 border-[#135bec] bg-[#135bec]/10`}>
                LDAP / AD
              </button>
              <button className={`px-6 py-3 text-sm font-medium ${textSecondary} ${isDark ? 'hover:text-white' : 'hover:text-slate-900'} ${isDark ? 'hover:bg-[#1a2333]' : 'hover:bg-slate-100'} transition-colors border-b-2 border-transparent`}>
                OIDC (OpenID Connect)
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <p className={`${textSecondary} text-sm`}>启用 LDAP 以允许用户使用企业目录凭证登录。</p>
                <div className="flex items-center gap-3">
                  <Switch />
                  <span className={`text-sm font-medium ${textColor}`}>启用 LDAP</span>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 opacity-50 pointer-events-none select-none grayscale" aria-disabled="true">
                <div className="flex flex-col gap-2 md:col-span-2">
                  <label htmlFor="global-config-ldap-server-url" className={`${textColor} text-sm font-medium`}>LDAP 服务器地址 (Server URL)</label>
                  <input id="global-config-ldap-server-url" name="globalConfigLdapServerUrl" className={`rounded-lg ${inputBg} border ${borderColor} ${textColor} px-4 py-2.5 text-sm`} placeholder="ldap://dc1.company.local:389" type="text" />
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="global-config-ldap-bind-dn" className={`${textColor} text-sm font-medium`}>Bind DN</label>
                  <input id="global-config-ldap-bind-dn" name="globalConfigLdapBindDn" className={`rounded-lg ${inputBg} border ${borderColor} ${textColor} px-4 py-2.5 text-sm`} placeholder="cn=admin,dc=example,dc=org" type="text" />
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="global-config-ldap-bind-password" className={`${textColor} text-sm font-medium`}>Bind Password</label>
                  <form onSubmit={(event) => event.preventDefault()}>
                    <input type="text" name="globalConfigLdapFormUsername" autoComplete="username" className="hidden" tabIndex={-1} aria-hidden="true" />
                    <input id="global-config-ldap-bind-password" name="globalConfigLdapBindPassword" autoComplete="new-password" className={`rounded-lg ${inputBg} border ${borderColor} ${textColor} px-4 py-2.5 text-sm`} placeholder="••••••••" type="password" />
                  </form>
                </div>
                <div className="flex flex-col gap-2 md:col-span-2">
                  <label htmlFor="global-config-ldap-base-dn" className={`${textColor} text-sm font-medium`}>用户搜索基准 (Base DN)</label>
                  <input id="global-config-ldap-base-dn" name="globalConfigLdapBaseDn" className={`rounded-lg ${inputBg} border ${borderColor} ${textColor} px-4 py-2.5 text-sm`} placeholder="ou=users,dc=example,dc=org" type="text" />
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default GlobalConfig;
