import React, { useState, useMemo, useCallback } from 'react';
import { Input, Button, Card, Tag, Space, Modal, Form, Select, message } from 'antd';
import { useThemeStore } from '../../stores/themeStore';
import { COLORS, DARK_PALETTE, LIGHT_PALETTE } from '../../theme/tokens';

// ============================================================================
// 类型与模拟数据
// ============================================================================

interface Plugin {
  id: string;
  name: string;
  version: string;
  author: string;
  category: 'input' | 'output' | 'parser' | 'dashboard';
  description: string;
  downloads: string;
  installed: boolean;
  icon: string;
  iconBg: string;
}

const initialPlugins: Plugin[] = [
  { id: 'kafka-input', name: 'Kafka Input', version: '2.4.0', author: 'Official', category: 'input', description: '高性能 Kafka 消费者插件，支持多 Topic 订阅与 SASL 认证', downloads: '12.5k', installed: true, icon: 'K', iconBg: 'linear-gradient(135deg, #374151, #4b5563)' },
  { id: 'elasticsearch-output', name: 'Elasticsearch Output', version: '8.1.0', author: 'Official', category: 'output', description: '将日志数据输出到 Elasticsearch 集群，支持 8.x 版本', downloads: '9.8k', installed: false, icon: 'E', iconBg: 'linear-gradient(135deg, #eab308, #ca8a04)' },
  { id: 'redis-input', name: 'Redis Input', version: '1.5.2', author: 'Community', category: 'input', description: '从 Redis List/Stream 读取日志数据', downloads: '5.2k', installed: true, icon: 'R', iconBg: 'linear-gradient(135deg, #ef4444, #dc2626)' },
  { id: 'json-parser', name: 'JSON Parser', version: '3.0.0', author: 'Official', category: 'parser', description: '高性能 JSON 解析器，支持嵌套结构和数组展开', downloads: '15.3k', installed: true, icon: 'J', iconBg: 'linear-gradient(135deg, #3b82f6, #2563eb)' },
  { id: 'aws-cloudwatch', name: 'AWS CloudWatch', version: '2.1.0', author: 'Official', category: 'input', description: '从 AWS CloudWatch Logs 采集日志数据', downloads: '8.1k', installed: false, icon: 'A', iconBg: 'linear-gradient(135deg, #f97316, #ea580c)' },
  { id: 'slack-output', name: 'Slack Notification', version: '1.3.0', author: 'Community', category: 'output', description: '将告警和通知发送到 Slack 频道', downloads: '6.7k', installed: false, icon: 'S', iconBg: 'linear-gradient(135deg, #a855f7, #9333ea)' },
  { id: 'grok-parser', name: 'Grok Parser', version: '2.0.1', author: 'Official', category: 'parser', description: '使用 Grok 模式解析非结构化日志', downloads: '11.2k', installed: false, icon: 'G', iconBg: 'linear-gradient(135deg, #22c55e, #16a34a)' },
  { id: 'metrics-dashboard', name: 'Metrics Dashboard', version: '1.0.0', author: 'Official', category: 'dashboard', description: '预置的系统指标监控仪表盘模板', downloads: '4.5k', installed: false, icon: 'M', iconBg: 'linear-gradient(135deg, #06b6d4, #0891b2)' },
];

const categoryLabels: Record<string, string> = {
  input: '输入插件',
  output: '输出插件',
  parser: '解析器',
  dashboard: '仪表盘',
};

// ============================================================================
// 组件
// ============================================================================

const PluginMarket: React.FC = () => {
  const isDark = useThemeStore((s) => s.isDark);
  const palette = isDark ? DARK_PALETTE : LIGHT_PALETTE;
  const [plugins, setPlugins] = useState<Plugin[]>(initialPlugins);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [uninstallModalOpen, setUninstallModalOpen] = useState(false);
  const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null);
  const [isInstalling, setIsInstalling] = useState<string | null>(null);

  // 过滤
  const filteredPlugins = useMemo(() => {
    return plugins.filter(plugin => {
      const matchesSearch = plugin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           plugin.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = activeCategory === 'all' || plugin.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [plugins, searchQuery, activeCategory]);

  // 安装
  const handleInstall = useCallback(async (pluginId: string) => {
    setIsInstalling(pluginId);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setPlugins(prev => prev.map(p => p.id === pluginId ? { ...p, installed: true } : p));
    setIsInstalling(null);
    message.success('插件安装成功');
  }, []);

  // 卸载
  const handleUninstall = useCallback(() => {
    if (!selectedPlugin) return;
    setPlugins(prev => prev.map(p => p.id === selectedPlugin.id ? { ...p, installed: false } : p));
    setUninstallModalOpen(false);
    message.success(`插件 "${selectedPlugin.name}" 已卸载`);
    setSelectedPlugin(null);
  }, [selectedPlugin]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 24 }}>
      {/* 头部 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>插件市场 Plugin Market</h2>
        <Space>
          <Button onClick={() => { window.location.hash = '#/help/faq'; }} icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>help</span>}>
            帮助
          </Button>
          <Button icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>history</span>}>更新日志</Button>
          <Button type="text" style={{ position: 'relative' }}
            icon={<span className="material-symbols-outlined" style={{ fontSize: 20 }}>notifications</span>}>
            <span style={{ position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderRadius: '50%', background: COLORS.danger }} />
          </Button>
        </Space>
      </div>

      {/* 滚动内容区 */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Hero Banner */}
        <Card style={{ marginBottom: 32, background: isDark
          ? 'linear-gradient(135deg, rgba(19,91,236,0.15), rgba(59,130,246,0.08), rgba(139,92,246,0.1))'
          : 'linear-gradient(135deg, rgba(19,91,236,0.08), rgba(59,130,246,0.04), rgba(139,92,246,0.06))',
          borderColor: `${COLORS.primary}30`,
        }} styles={{ body: { padding: 32 } }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
            <div style={{ maxWidth: 600 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Tag color="blue" style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 11 }}>New</Tag>
                <span style={{ color: COLORS.primary, fontWeight: 500, fontSize: 13 }}>Elasticsearch 8.x Connector</span>
              </div>
              <h3 style={{ margin: '0 0 8px', fontSize: 28, fontWeight: 700 }}>发现、集成与扩展您的日志能力</h3>
              <p style={{ margin: 0, fontSize: 16, color: '#94a3b8' }}>浏览超过 200+ 个官方与社区插件，轻松连接上下游数据源。</p>
            </div>
            <Button type="primary" size="large"
              icon={<span className="material-symbols-outlined" style={{ fontSize: 20 }}>rocket_launch</span>}>
              浏览推荐
            </Button>
          </div>
        </Card>

        {/* 分类导航 + 搜索 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingBottom: 16, borderBottom: `1px solid ${palette.border}` }}>
          <Space size={24}>
            {[{ key: 'all', label: '全部' }, ...Object.entries(categoryLabels).map(([k, v]) => ({ key: k, label: v }))].map(item => (
              <span key={item.key}
                onClick={() => setActiveCategory(item.key)}
                style={{
                  cursor: 'pointer', fontSize: 13, fontWeight: activeCategory === item.key ? 600 : 400,
                  color: activeCategory === item.key ? COLORS.primary : '#94a3b8',
                  borderBottom: activeCategory === item.key ? `2px solid ${COLORS.primary}` : '2px solid transparent',
                  paddingBottom: 16, transition: 'all 0.2s',
                }}>
                {item.label}
              </span>
            ))}
          </Space>
          <Space>
            <Input
              prefix={<span className="material-symbols-outlined" style={{ fontSize: 18, color: '#94a3b8' }}>search</span>}
              placeholder="搜索插件 (Kafka, Redis...)"
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: 260 }} allowClear
            />
            <div style={{ display: 'flex', background: palette.bgContainer, borderRadius: 8, padding: 2, border: `1px solid ${palette.border}` }}>
              <Button type={viewMode === 'grid' ? 'primary' : 'text'} size="small"
                icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>grid_view</span>}
                onClick={() => setViewMode('grid')} />
              <Button type={viewMode === 'list' ? 'primary' : 'text'} size="small"
                icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>view_list</span>}
                onClick={() => setViewMode('list')} />
            </div>
          </Space>
        </div>

        {/* 插件列表 */}
        <div style={viewMode === 'grid'
          ? { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }
          : { display: 'flex', flexDirection: 'column', gap: 12 }
        }>
          {filteredPlugins.map(plugin => (
            <Card key={plugin.id} hoverable size="small"
              styles={{ body: { padding: 20, display: 'flex', flexDirection: viewMode === 'list' ? 'row' : 'column', alignItems: viewMode === 'list' ? 'center' : 'stretch', gap: viewMode === 'list' ? 16 : 0 } }}>
              {/* 图标 + 已安装标签 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: viewMode === 'list' ? 'center' : 'flex-start', marginBottom: viewMode === 'list' ? 0 : 16, gap: viewMode === 'list' ? 16 : 0 }}>
                <div style={{ width: 48, height: 48, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`, flexShrink: 0 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 4, background: plugin.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 10, fontWeight: 700 }}>
                    {plugin.icon}
                  </div>
                </div>
                {plugin.installed && viewMode === 'grid' && (
                  <Tag color="success" style={{ fontSize: 11 }}>已安装</Tag>
                )}
              </div>

              {/* 列表模式：名称+描述在中间 */}
              {viewMode === 'list' && (
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{plugin.name}</div>
                  <div style={{ fontSize: 13, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{plugin.description}</div>
                </div>
              )}

              {/* 网格模式：名称+描述 */}
              {viewMode === 'grid' && (
                <>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{plugin.name}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>v{plugin.version} • By {plugin.author}</div>
                  <p style={{ fontSize: 13, color: isDark ? '#94a3b8' : '#64748b', lineHeight: 1.5, marginBottom: 16, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {plugin.description}
                  </p>
                </>
              )}

              {/* 底部操作区 */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                ...(viewMode === 'grid' ? { marginTop: 'auto', paddingTop: 12, borderTop: `1px solid ${palette.border}` } : {}),
                ...(viewMode === 'list' ? { gap: 12 } : {}),
              }}>
                {viewMode === 'grid' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#94a3b8' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>download</span>
                    {plugin.downloads}
                  </div>
                )}
                {viewMode === 'list' && (
                  <>
                    <Tag>{categoryLabels[plugin.category]}</Tag>
                    <span style={{ fontSize: 13, color: '#94a3b8' }}>v{plugin.version}</span>
                    <span style={{ fontSize: 13, color: '#94a3b8' }}>{plugin.downloads} 下载</span>
                    {plugin.installed && <Tag color="success" style={{ fontSize: 11 }}>已安装</Tag>}
                  </>
                )}
                <Space size={8}>
                  {plugin.installed ? (
                    <>
                      <Button size="small" onClick={() => { setSelectedPlugin(plugin); setConfigModalOpen(true); }}>配置</Button>
                      <Button size="small" danger onClick={() => { setSelectedPlugin(plugin); setUninstallModalOpen(true); }}>卸载</Button>
                    </>
                  ) : (
                    <Button type="primary" size="small" loading={isInstalling === plugin.id}
                      icon={<span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>}
                      onClick={() => handleInstall(plugin.id)}>
                      {isInstalling === plugin.id ? '安装中...' : '安装'}
                    </Button>
                  )}
                </Space>
              </div>
            </Card>
          ))}
        </div>

        {/* 空状态 */}
        {filteredPlugins.length === 0 && (
          <Card style={{ textAlign: 'center', padding: '48px 0' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 48, color: '#94a3b8', display: 'block', marginBottom: 16 }}>extension_off</span>
            <p style={{ fontWeight: 500, marginBottom: 8 }}>未找到匹配的插件</p>
            <p style={{ color: '#94a3b8' }}>请尝试其他搜索关键词或分类</p>
          </Card>
        )}

        {/* 分页 */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0', borderTop: `1px solid ${palette.border}`, marginTop: 32 }}>
          <Space>
            <Button icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_left</span>} />
            <Button type="primary">1</Button>
            <Button>2</Button>
            <Button icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_right</span>} />
          </Space>
        </div>
      </div>

      {/* 配置模态框 */}
      <Modal open={configModalOpen} title={`配置 ${selectedPlugin?.name || ''}`}
        onCancel={() => setConfigModalOpen(false)} onOk={() => { setConfigModalOpen(false); message.success('配置已保存'); }}
        okText="保存配置" cancelText="取消" width={520}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
          <Card size="small" style={{ background: isDark ? '#0f172a' : '#f8fafc' }} styles={{ body: { padding: 16 } }}>
            <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 4 }}>插件版本</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>v{selectedPlugin?.version}</div>
          </Card>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 8 }}>连接地址</label>
            <Input placeholder="例如: localhost:9092" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 8 }}>认证方式</label>
            <Select defaultValue="none" style={{ width: '100%' }}
              options={[
                { label: '无认证', value: 'none' },
                { label: 'SASL/PLAIN', value: 'sasl_plain' },
                { label: 'SASL/SCRAM', value: 'sasl_scram' },
                { label: 'SSL/TLS', value: 'ssl' },
              ]}
            />
          </div>
        </div>
      </Modal>

      {/* 卸载确认 */}
      <Modal open={uninstallModalOpen} title="卸载插件"
        onCancel={() => setUninstallModalOpen(false)} onOk={handleUninstall}
        okText="确认卸载" okButtonProps={{ danger: true }} cancelText="取消">
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 48, color: COLORS.danger, display: 'block', marginBottom: 16 }}>warning</span>
          <p>确定要卸载 "<span style={{ fontWeight: 600 }}>{selectedPlugin?.name}</span>" 吗？</p>
          <p style={{ fontSize: 13, color: '#94a3b8' }}>卸载后相关配置将被清除。</p>
        </div>
      </Modal>
    </div>
  );
};

export default PluginMarket;