import React, { useState } from 'react';
import { Input, Button, Card, Tag, message } from 'antd';
import { useThemeStore } from '../../stores/themeStore';
import { COLORS, DARK_PALETTE, LIGHT_PALETTE } from '../../theme/tokens';

// ============================================================================
// API 端点数据
// ============================================================================

const apiEndpoints = {
  authentication: [
    { id: 'get-token', method: 'POST', path: '/v1/auth/token', name: '获取 Token', description: '通过 API Key 和 Secret Key 换取临时的访问令牌' },
    { id: 'refresh-token', method: 'POST', path: '/v1/auth/refresh', name: '刷新 Token', description: '使用 refresh_token 获取新的访问令牌' },
  ],
  ingestion: [
    { id: 'ingest-single', method: 'POST', path: '/v1/ingest', name: '上传单条日志', description: '上传单条日志记录到指定项目' },
    { id: 'ingest-batch', method: 'POST', path: '/v1/ingest/batch', name: '批量上传日志', description: '批量上传日志数据，单次请求不超过 5MB' },
  ],
  search: [
    { id: 'execute-query', method: 'GET', path: '/v1/search/query', name: '执行查询语句', description: '执行 LQL 查询语句并返回结果' },
    { id: 'get-history', method: 'GET', path: '/v1/search/history', name: '获取查询历史', description: '获取当前用户的查询历史记录' },
  ],
  alerts: [
    { id: 'list-alerts', method: 'GET', path: '/v1/alerts', name: '获取告警列表', description: '获取所有告警规则列表' },
    { id: 'create-alert', method: 'POST', path: '/v1/alerts', name: '创建告警规则', description: '创建新的告警规则' },
  ],
};

const methodColorMap: Record<string, string> = {
  GET: '#3b82f6',
  POST: '#f59e0b',
  PUT: '#f97316',
  DELETE: '#ef4444',
};

interface ApiParameter {
  name: string;
  type: string;
  required: boolean;
  description: string;
  defaultValue?: string;
}

const endpointDetails: Record<string, { params: ApiParameter[]; requestExample: string; responseExample: string }> = {
  'get-token': {
    params: [
      { name: 'api_key', type: 'string', required: true, description: '您在控制台申请的 API 密钥 ID' },
      { name: 'secret_key', type: 'string', required: true, description: '您在控制台申请的 API 密钥 Secret' },
      { name: 'grant_type', type: 'string', required: false, description: '授权类型，固定值为 client_credentials', defaultValue: 'client_credentials' },
    ],
    requestExample: `curl -X POST https://api.logsystem.com/v1/auth/token \\
  -H "Content-Type: application/json" \\
  -d '{
    "api_key": "ls_ak_837291038475",
    "secret_key": "ls_sk_928374650192837465",
    "grant_type": "client_credentials"
  }'`,
    responseExample: `{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 7200,
  "refresh_token": "rt_8f92k3j4h5g6..."
}`,
  },
  'ingest-batch': {
    params: [
      { name: 'project_id', type: 'string', required: true, description: '目标项目 ID' },
      { name: 'logs', type: 'array', required: true, description: '日志记录数组，每条记录包含 timestamp、level、message 等字段' },
    ],
    requestExample: `curl -X POST https://api.logsystem.com/v1/ingest/batch \\
  -H "Authorization: Bearer <access_token>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "project_id": "prj_882910",
    "logs": [
      {"timestamp": 1678901234, "level": "ERROR", "message": "Database connection timeout"}
    ]
  }'`,
    responseExample: `{
  "success": true,
  "ingested_count": 1,
  "request_id": "req_9f8e7d6c5b4a"
}`,
  },
};

const sectionLabels: Record<string, string> = {
  authentication: 'Authentication (鉴权)',
  ingestion: 'Ingestion (数据摄入)',
  search: 'Search (查询)',
  alerts: 'Alerts (告警)',
};

// ============================================================================
// 组件
// ============================================================================

const ApiDocs: React.FC = () => {
  const isDark = useThemeStore((s) => s.isDark);
  const palette = isDark ? DARK_PALETTE : LIGHT_PALETTE;
  const [selectedEndpoint, setSelectedEndpoint] = useState<string>('get-token');
  const [activeTab, setActiveTab] = useState<'request' | 'response'>('request');
  const [searchQuery, setSearchQuery] = useState('');
  const [tryItParams, setTryItParams] = useState<Record<string, string>>({});
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<string | null>(null);

  // 获取当前选中的端点信息
  const getCurrentEndpoint = () => {
    for (const [, endpoints] of Object.entries(apiEndpoints)) {
      const found = endpoints.find(e => e.id === selectedEndpoint);
      if (found) return found;
    }
    return null;
  };

  const currentEndpoint = getCurrentEndpoint();
  const currentDetails = endpointDetails[selectedEndpoint];

  // 过滤端点
  const filterEndpoints = (endpoints: typeof apiEndpoints.authentication) => {
    if (!searchQuery) return endpoints;
    return endpoints.filter(e =>
      e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.path.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  // 模拟 API 调用
  const handleTryIt = async () => {
    setIsExecuting(true);
    setExecutionResult(null);
    await new Promise(resolve => setTimeout(resolve, 1000));
    if (currentDetails?.responseExample) {
      setExecutionResult(currentDetails.responseExample);
    } else {
      setExecutionResult('{"success": true, "message": "API 调用成功"}');
    }
    setIsExecuting(false);
    setActiveTab('response');
  };

  // 复制到剪贴板
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    message.success('已复制到剪贴板');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 24 }}>
      {/* 头部 */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>API 参考文档 API Reference</h2>
          <p style={{ margin: '8px 0 0', fontSize: 13, color: '#94a3b8' }}>
            集成与开放平台 / <span style={{ color: COLORS.primary }}>API</span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Button onClick={() => { window.location.hash = '#/help/faq'; }} icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>help</span>}>
            帮助
          </Button>
          <Button icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>vpn_key</span>}>
            API 密钥管理
          </Button>
          <Button type="primary" icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>play_circle</span>}>
            Run in Postman
          </Button>
        </div>
      </div>

      {/* 主体：左侧导航 + 右侧内容 */}
      <div style={{ display: 'flex', flex: 1, gap: 0, overflow: 'hidden', borderRadius: 12, border: `1px solid ${palette.border}` }}>
        {/* 左侧导航 */}
        <aside style={{ width: 260, background: isDark ? '#111722' : '#f8fafc', borderRight: `1px solid ${palette.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: 16, borderBottom: `1px solid ${palette.border}` }}>
            <Input
              prefix={<span className="material-symbols-outlined" style={{ fontSize: 18, color: '#94a3b8' }}>search</span>}
              placeholder="搜索 API..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              allowClear
            />
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
            {Object.entries(apiEndpoints).map(([section, endpoints]) => {
              const filtered = filterEndpoints(endpoints);
              if (filtered.length === 0) return null;
              return (
                <div key={section} style={{ marginBottom: 16 }}>
                  <div style={{ padding: '8px 16px', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>
                    {sectionLabels[section]}
                  </div>
                  {filtered.map(endpoint => {
                    const isActive = selectedEndpoint === endpoint.id;
                    const mColor = methodColorMap[endpoint.method];
                    return (
                      <div
                        key={endpoint.id}
                        onClick={() => setSelectedEndpoint(endpoint.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '8px 16px', cursor: 'pointer',
                          background: isActive ? palette.bgContainer : 'transparent',
                          borderLeft: isActive ? `2px solid ${COLORS.primary}` : '2px solid transparent',
                          color: isActive ? palette.text : '#94a3b8',
                          fontSize: 13, transition: 'all 0.2s',
                        }}
                      >
                        <span style={{ fontSize: 10, fontWeight: 700, color: mColor, fontFamily: 'monospace', minWidth: 36 }}>{endpoint.method}</span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{endpoint.name}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </aside>

        {/* 右侧内容 */}
        <main style={{ flex: 1, overflowY: 'auto', padding: 32, background: palette.bgContainer }}>
          {currentEndpoint && (
            <div style={{ maxWidth: 1000, margin: '0 auto' }}>
              {/* 端点头部 */}
              <div style={{ paddingBottom: 24, borderBottom: `1px solid ${palette.border}`, marginBottom: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <Tag color={currentEndpoint.method === 'GET' ? 'blue' : currentEndpoint.method === 'POST' ? 'gold' : currentEndpoint.method === 'DELETE' ? 'red' : 'orange'}
                    style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 12 }}>
                    {currentEndpoint.method}
                  </Tag>
                  <h3 style={{ margin: 0, fontSize: 22, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>{currentEndpoint.path}</h3>
                </div>
                <p style={{ margin: 0, fontSize: 16, color: '#94a3b8' }}>{currentEndpoint.description}</p>
              </div>

              {/* 双栏：参数 + 代码示例 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
                {/* 左：参数说明 */}
                <div>
                  <h4 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>参数说明</h4>
                  {currentDetails?.params ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {currentDetails.params.map(param => (
                        <Card key={param.name} size="small" styles={{ body: { padding: 16 } }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                            <code style={{ color: COLORS.primary, fontWeight: 700, fontSize: 13 }}>{param.name}</code>
                            <span style={{ fontSize: 12, color: '#94a3b8' }}>{param.type}</span>
                            {param.required && <Tag color="error" style={{ fontSize: 11 }}>required</Tag>}
                          </div>
                          <p style={{ margin: '0 0 12px', fontSize: 13, color: '#94a3b8' }}>{param.description}</p>
                          <Input
                            size="small"
                            placeholder={param.defaultValue || `输入 ${param.name}...`}
                            value={tryItParams[param.name] || ''}
                            onChange={(e) => setTryItParams(prev => ({ ...prev, [param.name]: e.target.value }))}
                          />
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <p style={{ color: '#94a3b8' }}>此端点暂无详细参数文档</p>
                  )}
                  <Button
                    type="primary" block
                    loading={isExecuting}
                    onClick={handleTryIt}
                    icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>play_arrow</span>}
                    style={{ marginTop: 20, height: 44 }}
                  >
                    {isExecuting ? '执行中...' : 'Try it out'}
                  </Button>
                </div>

                {/* 右：代码示例 */}
                <div style={{ borderRadius: 12, overflow: 'hidden', border: `1px solid ${palette.border}`, display: 'flex', flexDirection: 'column' }}>
                  {/* Tab 头 */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: isDark ? '#111722' : '#f1f5f9', borderBottom: `1px solid ${palette.border}` }}>
                    <div style={{ display: 'flex', gap: 16 }}>
                      {(['request', 'response'] as const).map(tab => (
                        <span
                          key={tab}
                          onClick={() => setActiveTab(tab)}
                          style={{
                            fontSize: 12, fontWeight: 500, cursor: 'pointer', paddingBottom: 4,
                            borderBottom: activeTab === tab ? `2px solid ${COLORS.primary}` : '2px solid transparent',
                            color: activeTab === tab ? palette.text : '#94a3b8',
                          }}
                        >
                          {tab === 'request' ? 'Request' : 'Response'}
                        </span>
                      ))}
                      {executionResult && (
                        <span style={{ fontSize: 12, color: COLORS.success, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: COLORS.success, display: 'inline-block' }} />
                          Live Result
                        </span>
                      )}
                    </div>
                    <Button
                      type="text" size="small"
                      icon={<span className="material-symbols-outlined" style={{ fontSize: 16 }}>content_copy</span>}
                      onClick={() => copyToClipboard(activeTab === 'request' ? (currentDetails?.requestExample || '') : (executionResult || currentDetails?.responseExample || ''))}
                    >
                      复制
                    </Button>
                  </div>
                  {/* 代码内容 */}
                  <div style={{ padding: 16, background: isDark ? '#0b1121' : '#1e293b', flex: 1, minHeight: 200, maxHeight: 400, overflowY: 'auto' }}>
                    <pre style={{ margin: 0, color: '#cbd5e1', fontSize: 13, fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                      {activeTab === 'request'
                        ? (currentDetails?.requestExample || '// 暂无请求示例')
                        : (executionResult || currentDetails?.responseExample || '// 暂无响应示例')
                      }
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default ApiDocs;