import React, { useState, useMemo } from 'react';
import { Input, Button, Card, Tag, message } from 'antd';
import { useThemeStore } from '../../stores/themeStore';
import { COLORS, DARK_PALETTE, LIGHT_PALETTE } from '../../theme/tokens';

// ============================================================================
// SDK 数据
// ============================================================================

interface SDK {
  id: string;
  name: string;
  language: string;
  version: string;
  status: 'Stable' | 'Beta' | 'Alpha';
  icon: string;
  iconColor: string;
  installCommand: string;
  downloadUrl: string;
  docsUrl: string;
  githubUrl: string;
  description: string;
  featured?: boolean;
}

const sdkList: SDK[] = [
  {
    id: 'java', name: 'Java SDK', language: 'Java', version: '3.1.2', status: 'Stable',
    icon: 'coffee', iconColor: '#f89820',
    installCommand: `<dependency>\n  <groupId>com.logsys</groupId>\n  <artifactId>sdk</artifactId>\n  <version>3.1.2</version>\n</dependency>`,
    downloadUrl: '#', docsUrl: '#', githubUrl: '#',
    description: '适用于 Java 8+ 的官方 SDK，支持同步和异步日志上传', featured: true,
  },
  {
    id: 'python', name: 'Python SDK', language: 'Python', version: '1.0.5', status: 'Stable',
    icon: 'pest_control', iconColor: '#3776AB',
    installCommand: 'pip install log-sys-sdk',
    downloadUrl: '#', docsUrl: '#', githubUrl: '#',
    description: '支持 Python 3.7+，提供异步和同步两种模式', featured: true,
  },
  {
    id: 'nodejs', name: 'Node.js SDK', language: 'JavaScript', version: '2.4.0', status: 'Stable',
    icon: 'javascript', iconColor: '#339933',
    installCommand: 'npm i @log-sys/sdk',
    downloadUrl: '#', docsUrl: '#', githubUrl: '#',
    description: '支持 TypeScript 类型定义，兼容 Node.js 14+',
  },
  {
    id: 'go', name: 'Go SDK', language: 'Go', version: '1.2.0', status: 'Stable',
    icon: 'code', iconColor: '#00ADD8',
    installCommand: 'go get github.com/logsys/sdk-go',
    downloadUrl: '#', docsUrl: '#', githubUrl: '#',
    description: '高性能 Go SDK，支持批量上传和自动重试',
  },
  {
    id: 'rust', name: 'Rust SDK', language: 'Rust', version: '0.8.0', status: 'Beta',
    icon: 'settings', iconColor: '#DEA584',
    installCommand: 'cargo add logsys-sdk',
    downloadUrl: '#', docsUrl: '#', githubUrl: '#',
    description: '零成本抽象的 Rust SDK，适用于高性能场景',
  },
  {
    id: 'dotnet', name: '.NET SDK', language: 'C#', version: '2.0.1', status: 'Stable',
    icon: 'window', iconColor: '#512BD4',
    installCommand: 'dotnet add package LogSys.SDK',
    downloadUrl: '#', docsUrl: '#', githubUrl: '#',
    description: '支持 .NET 6+ 和 .NET Framework 4.7.2+',
  },
  {
    id: 'php', name: 'PHP SDK', language: 'PHP', version: '1.5.0', status: 'Stable',
    icon: 'php', iconColor: '#777BB4',
    installCommand: 'composer require logsys/sdk',
    downloadUrl: '#', docsUrl: '#', githubUrl: '#',
    description: '支持 PHP 7.4+，兼容 Laravel 和 Symfony',
  },
  {
    id: 'ruby', name: 'Ruby SDK', language: 'Ruby', version: '1.1.0', status: 'Stable',
    icon: 'diamond', iconColor: '#CC342D',
    installCommand: 'gem install logsys-sdk',
    downloadUrl: '#', docsUrl: '#', githubUrl: '#',
    description: '支持 Ruby 2.7+，提供 Rails 集成',
  },
];

// ============================================================================
// 组件
// ============================================================================

const SdkDownload: React.FC = () => {
  const isDark = useThemeStore((s) => s.isDark);
  const palette = isDark ? DARK_PALETTE : LIGHT_PALETTE;
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredSdks = useMemo(() =>
    sdkList.filter(sdk =>
      sdk.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sdk.language.toLowerCase().includes(searchQuery.toLowerCase())
    ), [searchQuery]);

  const featuredSdks = filteredSdks.filter(sdk => sdk.featured);
  const otherSdks = filteredSdks.filter(sdk => !sdk.featured);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    message.success('已复制安装命令');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getStatusColor = (status: SDK['status']) => {
    switch (status) {
      case 'Stable': return 'success';
      case 'Beta': return 'warning';
      case 'Alpha': return 'error';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 24 }}>
      {/* 头部 */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>SDK 下载中心 SDK Downloads</h2>
          <p style={{ margin: '8px 0 0', fontSize: 13, color: '#94a3b8' }}>
            官方提供的多语言 SDK，帮助您快速接入日志管理系统。
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Input
            prefix={<span className="material-symbols-outlined" style={{ fontSize: 18, color: '#94a3b8' }}>search</span>}
            placeholder="搜索 SDK (例如: Java)..."
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: 280 }} allowClear
          />
          <Button type="text" icon={<span className="material-symbols-outlined" style={{ fontSize: 20 }}>notifications</span>} />
        </div>
      </div>

      {/* 滚动内容区 */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* 常用语言 */}
        {featuredSdks.length > 0 && (
          <div style={{ marginBottom: 40 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="material-symbols-outlined" style={{ color: COLORS.primary, fontSize: 20 }}>star</span>
              常用语言
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
              {featuredSdks.map(sdk => (
                <Card key={sdk.id} hoverable styles={{ body: { padding: 24 } }}
                  style={{ position: 'relative', overflow: 'hidden' }}>
                  {/* 背景装饰图标 */}
                  <div style={{ position: 'absolute', top: 0, right: 0, padding: 16, opacity: 0.06 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 120 }}>{sdk.icon}</span>
                  </div>
                  {/* 头部 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, position: 'relative', zIndex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ width: 48, height: 48, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${sdk.iconColor}10`, border: `1px solid ${sdk.iconColor}20` }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 28, color: sdk.iconColor }}>{sdk.icon}</span>
                      </div>
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 700 }}>{sdk.name}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                          <Tag color={getStatusColor(sdk.status)}>{sdk.status}</Tag>
                          <span style={{ fontSize: 13, color: '#94a3b8' }}>v{sdk.version}</span>
                        </div>
                      </div>
                    </div>
                    <a href={sdk.docsUrl} style={{ color: COLORS.primary, fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                      快速开始指南 <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span>
                    </a>
                  </div>
                  {/* 描述 */}
                  <p style={{ margin: '0 0 16px', fontSize: 13, color: '#94a3b8', position: 'relative', zIndex: 1 }}>{sdk.description}</p>
                  {/* 安装命令 */}
                  <div style={{ position: 'relative', zIndex: 1, marginBottom: 20, background: isDark ? '#0f172a' : '#f1f5f9', borderRadius: 8, border: `1px solid ${palette.border}`, padding: 12 }}>
                    <code style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: isDark ? '#cbd5e1' : '#475569', whiteSpace: 'pre', display: 'block' }}>
                      {sdk.installCommand}
                    </code>
                    <Button type="text" size="small"
                      style={{ position: 'absolute', top: 8, right: 8 }}
                      icon={<span className="material-symbols-outlined" style={{ fontSize: 16, color: copiedId === sdk.id ? COLORS.success : '#94a3b8' }}>
                        {copiedId === sdk.id ? 'check' : 'content_copy'}
                      </span>}
                      onClick={() => copyToClipboard(sdk.installCommand, sdk.id)}
                    />
                  </div>
                  {/* 操作按钮 */}
                  <div style={{ display: 'flex', gap: 12, position: 'relative', zIndex: 1 }}>
                    <Button type="primary" href={sdk.downloadUrl}
                      icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>download</span>}
                      style={{ flex: 1 }}>
                      下载
                    </Button>
                    <Button href={sdk.docsUrl}>文档</Button>
                    <Button href={sdk.githubUrl}>GitHub</Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* 其他语言 */}
        {otherSdks.length > 0 && (
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="material-symbols-outlined" style={{ color: '#94a3b8', fontSize: 20 }}>grid_view</span>
              其他语言支持
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
              {otherSdks.map(sdk => (
                <Card key={sdk.id} hoverable size="small" styles={{ body: { padding: 20, display: 'flex', flexDirection: 'column', height: '100%' } }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${sdk.iconColor}10`, border: `1px solid ${sdk.iconColor}20` }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 24, color: sdk.iconColor }}>{sdk.icon}</span>
                    </div>
                    <code style={{ fontSize: 11, color: '#94a3b8', background: isDark ? '#0f172a' : '#f1f5f9', padding: '2px 8px', borderRadius: 4 }}>v{sdk.version}</code>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{sdk.name}</div>
                  <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>{sdk.description}</p>
                  <Tag color={getStatusColor(sdk.status)} style={{ marginBottom: 12, width: 'fit-content' }}>{sdk.status}</Tag>
                  {/* 安装命令 */}
                  <div style={{ background: isDark ? '#0f172a' : '#f1f5f9', borderRadius: 6, border: `1px solid ${palette.border}`, padding: 8, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <code style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: isDark ? '#94a3b8' : '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {sdk.installCommand}
                    </code>
                    <Button type="text" size="small"
                      icon={<span className="material-symbols-outlined" style={{ fontSize: 14, color: copiedId === sdk.id ? COLORS.success : '#94a3b8' }}>
                        {copiedId === sdk.id ? 'check' : 'content_copy'}
                      </span>}
                      onClick={() => copyToClipboard(sdk.installCommand, sdk.id)}
                    />
                  </div>
                  {/* 底部链接 */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: `1px solid ${palette.border}`, paddingTop: 12, marginTop: 'auto' }}>
                    <a href={sdk.docsUrl} style={{ fontSize: 12, color: COLORS.primary }}>查看文档</a>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <a href={sdk.downloadUrl} style={{ fontSize: 12, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>download</span> 下载
                      </a>
                      <a href={sdk.githubUrl} style={{ fontSize: 12, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>code</span> 源码
                      </a>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* 空状态 */}
        {filteredSdks.length === 0 && (
          <Card style={{ textAlign: 'center', padding: '48px 0' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 48, color: '#94a3b8', display: 'block', marginBottom: 16 }}>search_off</span>
            <p style={{ fontWeight: 500, marginBottom: 8 }}>未找到匹配的 SDK</p>
            <p style={{ color: '#94a3b8' }}>请尝试其他搜索关键词</p>
          </Card>
        )}

        {/* 底部提示 */}
        <Card style={{ marginTop: 40, background: isDark ? 'linear-gradient(to right, #1e293b, #0f172a)' : 'linear-gradient(to right, #f1f5f9, #ffffff)' }}
          styles={{ body: { padding: 24 } }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <div style={{ width: 40, height: 40, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${COLORS.primary}20` }}>
              <span className="material-symbols-outlined" style={{ color: COLORS.primary }}>lightbulb</span>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>找不到您需要的语言?</div>
              <p style={{ margin: '0 0 16px', fontSize: 13, color: '#94a3b8', maxWidth: 600 }}>
                我们正在不断扩展对新语言的支持。如果您有特定的 SDK 需求，可以提交功能请求，或者查看我们的通用 HTTP API 文档自行封装。
              </p>
              <div style={{ display: 'flex', gap: 16 }}>
                <a href="#" style={{ fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4, color: COLORS.primary }}>
                  提交请求 <span className="material-symbols-outlined" style={{ fontSize: 16 }}>open_in_new</span>
                </a>
                <a href="#" style={{ fontSize: 13, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                  查看通用 HTTP API <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span>
                </a>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default SdkDownload;