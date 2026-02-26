import React, { useState, useCallback, useMemo } from 'react';
import { Input, Select, Button, Card, Form, Steps, Checkbox, message } from 'antd';
import { useThemeStore } from '../../stores/themeStore';
import { COLORS } from '../../theme/tokens';
import type { SourceType, SourceConfig, WizardAgentConfig, ParsingConfig } from '../../types/ingestion';

// ============================================================================
// 常量
// ============================================================================

const WIZARD_STEPS = [
  { title: '选择来源', description: '选择数据源类型' },
  { title: '配置 Agent', description: '配置采集参数' },
  { title: '解析设置', description: '配置日志解析规则' },
  { title: '完成', description: '确认并创建' },
];

const SOURCE_TYPES = [
  { id: 'java' as const, name: 'Java 应用', icon: 'coffee', color: '#f89820', description: 'Use Agent to auto-discover and collect standard output and error logs from JVM.', tags: ['Auto-Discovery'] },
  { id: 'nginx' as const, name: 'Nginx', icon: 'dns', color: '#009639', description: 'Built-in templates for access.log and error.log parsing and visualization.', tags: ['Template'] },
  { id: 'kubernetes' as const, name: 'Kubernetes', icon: 'view_column', color: '#326ce5', description: 'Collect Pod logs, events, and metrics directly from the cluster via DaemonSet.', tags: ['Cluster'] },
  { id: 'mysql' as const, name: 'MySQL', icon: 'storage', color: '#00758f', description: 'Slow query logs and error logs analysis for database performance tuning.', tags: ['Database'] },
  { id: 'custom' as const, name: '文本日志 (Custom)', icon: 'description', color: '#64748b', description: 'Specify file paths and patterns to collect logs from any custom application.', tags: ['Flexible'] },
  { id: 'syslog' as const, name: 'Syslog', icon: 'terminal', color: '#64748b', description: 'Collect standard Syslog messages via UDP/TCP from servers and network devices.', tags: ['Network'] },
  { id: 'docker' as const, name: 'Docker', icon: 'layers', color: '#0db7ed', description: 'Collect container stdout/stderr logs directly from the Docker daemon.', tags: ['Container'] },
];

const ENCODING_OPTIONS = [
  { label: 'UTF-8', value: 'utf-8' },
  { label: 'GBK', value: 'gbk' },
  { label: 'ISO-8859-1', value: 'iso-8859-1' },
  { label: 'ASCII', value: 'ascii' },
];

const PARSER_OPTIONS = [
  { label: 'JSON', value: 'json' },
  { label: '正则表达式', value: 'regex' },
  { label: 'Grok', value: 'grok' },
  { label: 'CSV', value: 'csv' },
  { label: '无解析', value: 'none' },
];

const AGENT_OPTIONS = [
  { label: 'agent-web-01 (192.168.1.105)', value: 'agent-001' },
  { label: 'agent-db-01 (10.0.4.212)', value: 'agent-002' },
  { label: 'agent-app-01 (192.168.1.108)', value: 'agent-004' },
];

// ============================================================================
// 组件
// ============================================================================

const AccessWizard: React.FC = () => {
  const isDark = useThemeStore((s) => s.isDark);

  const [currentStep, setCurrentStep] = useState(0);
  const [sourceConfig, setSourceConfig] = useState<SourceConfig>({ sourceType: null, sourceName: '', targetIndex: '', description: '' });
  const [agentConfig, setAgentConfig] = useState<WizardAgentConfig>({ agentId: '', logPath: '', encoding: 'utf-8', multiline: false, multilinePattern: '' });
  const [parsingConfig, setParsingConfig] = useState<ParsingConfig>({ parserType: 'json', timestampField: '@timestamp', timestampFormat: 'ISO8601', customPattern: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const filteredSourceTypes = useMemo(() => {
    let result = SOURCE_TYPES;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q));
    }
    if (categoryFilter === 'app') result = result.filter(s => ['java', 'custom'].includes(s.id));
    else if (categoryFilter === 'middleware') result = result.filter(s => ['nginx', 'mysql'].includes(s.id));
    else if (categoryFilter === 'cloud') result = result.filter(s => ['kubernetes', 'docker'].includes(s.id));
    return result;
  }, [searchQuery, categoryFilter]);

  const selectedSourceInfo = useMemo(() => SOURCE_TYPES.find(s => s.id === sourceConfig.sourceType), [sourceConfig.sourceType]);

  const validateStep = useCallback((step: number): boolean => {
    const newErrors: Record<string, string> = {};
    if (step === 0) {
      if (!sourceConfig.sourceType) newErrors.sourceType = '请选择数据源类型';
    } else if (step === 1) {
      if (!sourceConfig.sourceName.trim()) newErrors.sourceName = '请输入数据源名称';
      else if (sourceConfig.sourceName.length < 3) newErrors.sourceName = '名称至少需要3个字符';
      if (!sourceConfig.targetIndex.trim()) newErrors.targetIndex = '请输入目标索引';
      else if (!/^[a-z][a-z0-9_]*$/.test(sourceConfig.targetIndex)) newErrors.targetIndex = '索引名称必须以小写字母开头，只能包含小写字母、数字和下划线';
      if (!agentConfig.agentId) newErrors.agentId = '请选择 Agent';
      if (!agentConfig.logPath.trim()) newErrors.logPath = '请输入日志路径';
      if (agentConfig.multiline && !agentConfig.multilinePattern.trim()) newErrors.multilinePattern = '启用多行模式时需要指定匹配模式';
    } else if (step === 2) {
      if ((parsingConfig.parserType === 'regex' || parsingConfig.parserType === 'grok') && !parsingConfig.customPattern.trim()) {
        newErrors.customPattern = parsingConfig.parserType === 'regex' ? '请输入正则表达式' : '请输入 Grok 模式';
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [sourceConfig, agentConfig, parsingConfig]);

  const handleNext = useCallback(() => {
    if (validateStep(currentStep) && currentStep < 3) {
      setCurrentStep(prev => prev + 1);
      setErrors({});
    }
  }, [currentStep, validateStep]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) { setCurrentStep(prev => prev - 1); setErrors({}); }
  }, [currentStep]);

  const handleComplete = useCallback(() => {
    message.success('数据源创建成功！');
    setCurrentStep(0);
    setSourceConfig({ sourceType: null, sourceName: '', targetIndex: '', description: '' });
    setAgentConfig({ agentId: '', logPath: '', encoding: 'utf-8', multiline: false, multilinePattern: '' });
    setParsingConfig({ parserType: 'json', timestampField: '@timestamp', timestampFormat: 'ISO8601', customPattern: '' });
  }, []);

  const handleSelectSourceType = useCallback((type: SourceType) => {
    setSourceConfig(prev => ({ ...prev, sourceType: type }));
    setErrors({});
  }, []);

  const handleReset = useCallback(() => {
    setCurrentStep(0);
    setSourceConfig({ sourceType: null, sourceName: '', targetIndex: '', description: '' });
    setAgentConfig({ agentId: '', logPath: '', encoding: 'utf-8', multiline: false, multilinePattern: '' });
    setParsingConfig({ parserType: 'json', timestampField: '@timestamp', timestampFormat: 'ISO8601', customPattern: '' });
    setErrors({});
  }, []);

  // ========== 步骤 1：选择来源 ==========
  const renderStep1 = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 8, background: isDark ? '#1e293b' : '#f1f5f9' }}>
          {[{ key: 'all', label: '全部' }, { key: 'app', label: '应用日志' }, { key: 'middleware', label: '中间件' }, { key: 'cloud', label: '云服务' }].map(cat => (
            <Button key={cat.key} type={categoryFilter === cat.key ? 'primary' : 'text'} size="small"
              onClick={() => setCategoryFilter(cat.key)} style={{ borderRadius: 6 }}>
              {cat.label}
            </Button>
          ))}
        </div>
        <Input prefix={<span className="material-symbols-outlined" style={{ fontSize: 18, color: '#94a3b8' }}>search</span>}
          placeholder="搜索数据来源 (e.g. Nginx, K8s)..." value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)} style={{ width: 280 }} allowClear />
      </div>

      {errors.sourceType && (
        <div style={{ padding: 12, borderRadius: 8, background: `${COLORS.danger}1a`, border: `1px solid ${COLORS.danger}33`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="material-symbols-outlined" style={{ color: COLORS.danger }}>error</span>
          <span style={{ color: COLORS.danger, fontSize: 13 }}>{errors.sourceType}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260, 1fr))', gap: 16 }}>
        {filteredSourceTypes.map(source => (
          <Card key={source.id} hoverable onClick={() => handleSelectSourceType(source.id)}
            style={{ cursor: 'pointer', borderColor: sourceConfig.sourceType === source.id ? COLORS.primary : undefined,
              boxShadow: sourceConfig.sourceType === source.id ? `0 0 0 2px ${COLORS.primary}33` : undefined }}
            styles={{ body: { padding: 20, display: 'flex', flexDirection: 'column', height: '100%' } }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${source.color}1a` }}>
                <span className="material-symbols-outlined" style={{ fontSize: 28, color: source.color }}>{source.icon}</span>
              </div>
              {sourceConfig.sourceType === source.id ? (
                <span className="material-symbols-outlined" style={{ color: COLORS.primary }}>check_circle</span>
              ) : (
                <span className="material-symbols-outlined" style={{ color: '#64748b' }}>arrow_forward</span>
              )}
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{source.name}</h3>
            <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6, flex: 1, marginBottom: 16 }}>{source.description}</p>
            <div style={{ display: 'flex', gap: 8, borderTop: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, paddingTop: 12 }}>
              {source.tags.map(tag => (
                <span key={tag} style={{ fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 4, background: `${COLORS.primary}1a`, color: COLORS.primary, border: `1px solid ${COLORS.primary}33` }}>{tag}</span>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );

  // ========== 步骤 2：配置 Agent ==========
  const renderStep2 = () => (
    <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {selectedSourceInfo && (
        <Card size="small" styles={{ body: { padding: 16, display: 'flex', alignItems: 'center', gap: 16 } }}>
          <div style={{ width: 48, height: 48, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${selectedSourceInfo.color}1a` }}>
            <span className="material-symbols-outlined" style={{ fontSize: 24, color: selectedSourceInfo.color }}>{selectedSourceInfo.icon}</span>
          </div>
          <div>
            <div style={{ fontWeight: 500 }}>{selectedSourceInfo.name}</div>
            <div style={{ fontSize: 13, color: '#94a3b8' }}>{selectedSourceInfo.description}</div>
          </div>
        </Card>
      )}

      <Card title={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span className="material-symbols-outlined" style={{ color: COLORS.primary }}>info</span>基本信息</span>}>
        <Form layout="vertical">
          <Form.Item label="数据源名称" required validateStatus={errors.sourceName ? 'error' : ''} help={errors.sourceName}>
            <Input placeholder="例如: Nginx-Access-Logs-Prod" value={sourceConfig.sourceName}
              onChange={(e) => setSourceConfig(prev => ({ ...prev, sourceName: e.target.value }))} />
          </Form.Item>
          <Form.Item label="目标索引" required validateStatus={errors.targetIndex ? 'error' : ''} help={errors.targetIndex || '索引名称必须以小写字母开头'}>
            <Input placeholder="例如: idx_nginx_prod" value={sourceConfig.targetIndex}
              onChange={(e) => setSourceConfig(prev => ({ ...prev, targetIndex: e.target.value }))} />
          </Form.Item>
          <Form.Item label="描述">
            <Input.TextArea placeholder="可选：描述此数据源的用途" rows={2} value={sourceConfig.description}
              onChange={(e) => setSourceConfig(prev => ({ ...prev, description: e.target.value }))} />
          </Form.Item>
        </Form>
      </Card>

      <Card title={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span className="material-symbols-outlined" style={{ color: COLORS.primary }}>dns</span>Agent 配置</span>}>
        <Form layout="vertical">
          <Form.Item label="选择 Agent" required validateStatus={errors.agentId ? 'error' : ''} help={errors.agentId}>
            <Select placeholder="选择一个 Agent" options={AGENT_OPTIONS} value={agentConfig.agentId || undefined}
              onChange={(v) => setAgentConfig(prev => ({ ...prev, agentId: v }))} />
          </Form.Item>
          <Form.Item label="日志路径" required validateStatus={errors.logPath ? 'error' : ''} help={errors.logPath || '支持通配符，如 /var/log/*.log'}>
            <Input placeholder="例如: /var/log/nginx/access.log" value={agentConfig.logPath}
              onChange={(e) => setAgentConfig(prev => ({ ...prev, logPath: e.target.value }))} />
          </Form.Item>
          <Form.Item label="文件编码">
            <Select options={ENCODING_OPTIONS} value={agentConfig.encoding}
              onChange={(v) => setAgentConfig(prev => ({ ...prev, encoding: v }))} />
          </Form.Item>
          <Form.Item>
            <Checkbox checked={agentConfig.multiline}
              onChange={(e) => setAgentConfig(prev => ({ ...prev, multiline: e.target.checked }))}>
              启用多行日志模式
            </Checkbox>
          </Form.Item>
          {agentConfig.multiline && (
            <Form.Item label="多行匹配模式" validateStatus={errors.multilinePattern ? 'error' : ''} help={errors.multilinePattern || '用于识别新日志条目开始的正则表达式'}>
              <Input placeholder={'例如: ^\\d{4}-\\d{2}-\\d{2}'} value={agentConfig.multilinePattern}
                onChange={(e) => setAgentConfig(prev => ({ ...prev, multilinePattern: e.target.value }))} />
            </Form.Item>
          )}
        </Form>
      </Card>
    </div>
  );

  // ========== 步骤 3：解析设置 ==========
  const renderStep3 = () => (
    <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Card title={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span className="material-symbols-outlined" style={{ color: COLORS.primary }}>code</span>解析配置</span>}>
        <Form layout="vertical">
          <Form.Item label="解析器类型">
            <Select options={PARSER_OPTIONS} value={parsingConfig.parserType}
              onChange={(v) => setParsingConfig(prev => ({ ...prev, parserType: v }))} />
          </Form.Item>
          {(parsingConfig.parserType === 'regex' || parsingConfig.parserType === 'grok') && (
            <Form.Item label={parsingConfig.parserType === 'regex' ? '正则表达式' : 'Grok 模式'} required
              validateStatus={errors.customPattern ? 'error' : ''} help={errors.customPattern}>
              <Input.TextArea rows={3} value={parsingConfig.customPattern}
                placeholder={parsingConfig.parserType === 'regex'
                  ? '例如: ^(?<timestamp>\\S+) (?<level>\\w+) (?<message>.*)'
                  : '例如: %{TIMESTAMP_ISO8601:timestamp} %{LOGLEVEL:level} %{GREEDYDATA:message}'}
                onChange={(e) => setParsingConfig(prev => ({ ...prev, customPattern: e.target.value }))}
                style={{ fontFamily: 'JetBrains Mono, monospace' }} />
            </Form.Item>
          )}
          <Form.Item label="时间戳字段" extra="指定日志中的时间戳字段名">
            <Input placeholder="@timestamp" value={parsingConfig.timestampField}
              onChange={(e) => setParsingConfig(prev => ({ ...prev, timestampField: e.target.value }))} />
          </Form.Item>
          <Form.Item label="时间戳格式" extra="例如: ISO8601, yyyy-MM-dd HH:mm:ss">
            <Input placeholder="ISO8601" value={parsingConfig.timestampFormat}
              onChange={(e) => setParsingConfig(prev => ({ ...prev, timestampFormat: e.target.value }))} />
          </Form.Item>
        </Form>
      </Card>

      <Card title={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span className="material-symbols-outlined" style={{ color: COLORS.primary }}>preview</span>解析预览</span>}>
        <Card size="small" style={{ background: isDark ? '#0f172a' : '#f8fafc' }} styles={{ body: { padding: 16 } }}>
          <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>示例输入:</p>
          <pre style={{ fontSize: 13, fontFamily: 'JetBrains Mono, monospace', color: isDark ? '#cbd5e1' : '#475569', marginBottom: 16, overflowX: 'auto' }}>
            2026-02-10 10:30:00 INFO Application started successfully
          </pre>
          <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>解析结果:</p>
          <pre style={{ fontSize: 13, fontFamily: 'JetBrains Mono, monospace', color: '#10b981', margin: 0, overflowX: 'auto' }}>
{`{
  "timestamp": "2026-02-10 10:30:00",
  "level": "INFO",
  "message": "Application started successfully"
}`}
          </pre>
        </Card>
      </Card>
    </div>
  );

  // ========== 步骤 4：完成 ==========
  const renderStep4 = () => (
    <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ textAlign: 'center', padding: '32px 0' }}>
        <span className="material-symbols-outlined" style={{ fontSize: 64, color: COLORS.success, display: 'block', marginBottom: 16 }}>check_circle</span>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>配置完成</h2>
        <p style={{ color: '#94a3b8' }}>请确认以下配置信息，然后点击"创建数据源"完成设置。</p>
      </div>

      <Card>
        {/* 数据源信息 */}
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span className="material-symbols-outlined" style={{ color: COLORS.primary, fontSize: 18 }}>dns</span>数据源信息
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
            <div><span style={{ color: '#94a3b8' }}>类型:</span> {selectedSourceInfo?.name}</div>
            <div><span style={{ color: '#94a3b8' }}>名称:</span> {sourceConfig.sourceName}</div>
            <div><span style={{ color: '#94a3b8' }}>目标索引:</span> <code style={{ fontFamily: 'monospace' }}>{sourceConfig.targetIndex}</code></div>
            <div><span style={{ color: '#94a3b8' }}>描述:</span> {sourceConfig.description || '-'}</div>
          </div>
        </div>

        <div style={{ borderTop: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, margin: '0 0 24px' }} />

        {/* Agent 配置 */}
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span className="material-symbols-outlined" style={{ color: COLORS.primary, fontSize: 18 }}>settings</span>Agent 配置
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
            <div><span style={{ color: '#94a3b8' }}>Agent:</span> {AGENT_OPTIONS.find(a => a.value === agentConfig.agentId)?.label || '-'}</div>
            <div><span style={{ color: '#94a3b8' }}>日志路径:</span> <code style={{ fontFamily: 'monospace' }}>{agentConfig.logPath}</code></div>
            <div><span style={{ color: '#94a3b8' }}>编码:</span> {agentConfig.encoding}</div>
            <div><span style={{ color: '#94a3b8' }}>多行模式:</span> {agentConfig.multiline ? '是' : '否'}</div>
          </div>
        </div>

        <div style={{ borderTop: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, margin: '0 0 24px' }} />

        {/* 解析配置 */}
        <div>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span className="material-symbols-outlined" style={{ color: COLORS.primary, fontSize: 18 }}>code</span>解析配置
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
            <div><span style={{ color: '#94a3b8' }}>解析器:</span> {PARSER_OPTIONS.find(p => p.value === parsingConfig.parserType)?.label}</div>
            <div><span style={{ color: '#94a3b8' }}>时间戳字段:</span> {parsingConfig.timestampField}</div>
            <div><span style={{ color: '#94a3b8' }}>时间戳格式:</span> {parsingConfig.timestampFormat}</div>
          </div>
        </div>
      </Card>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* 头部 */}
      <div style={{ padding: '8px 16px 24px', background: isDark ? '#0f172a' : '#f8fafc' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 28, fontWeight: 700, marginBottom: 4 }}>新建接入</h2>
              <p style={{ margin: 0, fontSize: 13, color: '#94a3b8' }}>Follow the steps to configure your new data source ingestion pipeline.</p>
            </div>
            <Button icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>history</span>}>History</Button>
          </div>
          <Steps current={currentStep} items={WIZARD_STEPS} />
        </div>
      </div>

      {/* 内容 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '32px 16px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          {currentStep === 0 && renderStep1()}
          {currentStep === 1 && renderStep2()}
          {currentStep === 2 && renderStep3()}
          {currentStep === 3 && renderStep4()}
        </div>
      </div>

      {/* 底部操作栏 */}
      <div style={{ padding: '16px 24px', borderTop: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, background: isDark ? '#111722' : '#f8fafc',
        display: 'flex', justifyContent: 'space-between' }}>
        <Button disabled={currentStep === 0} onClick={handlePrev}>上一步</Button>
        <div style={{ display: 'flex', gap: 12 }}>
          <Button onClick={handleReset}>取消</Button>
          {currentStep < 3 ? (
            <Button type="primary" onClick={handleNext}>下一步</Button>
          ) : (
            <Button type="primary" style={{ background: COLORS.success, borderColor: COLORS.success }} onClick={handleComplete}>创建数据源</Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccessWizard;
