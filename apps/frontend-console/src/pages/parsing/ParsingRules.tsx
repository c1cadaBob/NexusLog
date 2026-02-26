import React, { useState, useCallback } from 'react';
import { Input, Button, Tag, Modal, Form, Select, Space, message } from 'antd';
import { useThemeStore } from '../../stores/themeStore';
import { COLORS, DARK_PALETTE, LIGHT_PALETTE } from '../../theme/tokens';
import type { ParsingRule, ParserType } from '../../types/parsing';

// ============================================================================
// 模拟数据
// ============================================================================

const sampleLogs: Record<string, string> = {
  apache_access: '192.168.1.105 - - [10/Oct/2023:13:55:36 +0000] "GET /api/v1/user/profile HTTP/1.1" 200 2326 "https://logmaster.io/dashboard" "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"',
  backend_service: '2023-10-10 13:55:36 ERROR com.app.UserService - Failed to authenticate user: invalid credentials',
  nginx_error: '{"time":"2023-10-10T13:55:36Z","level":"error","msg":"upstream timed out (110: Connection timed out)"}',
  app_v2_core: 'timestamp=2023-10-10T13:55:36Z|level=INFO|user_id=1001|action=login|status=success',
};

const initialRules: ParsingRule[] = [
  { id: '1', name: 'Apache Access Log', source: 'apache_access', parserType: 'GROK', pattern: '%{COMBINEDAPACHELOG}', status: 'Passed', lastUpdated: '2h ago' },
  { id: '2', name: 'Java Exception', source: 'backend_service', parserType: 'REGEX', pattern: '^(?<timestamp>\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}) (?<level>\\w+) (?<class>[\\w.]+) - (?<message>.*)', status: 'Passed', lastUpdated: '1d ago' },
  { id: '3', name: 'Nginx Error Log', source: 'nginx_error', parserType: 'JSON', pattern: '{ "timestamp": "$.time", "level": "$.level", "message": "$.msg" }', status: 'Failed', lastUpdated: '3d ago' },
  { id: '4', name: 'Custom App V2', source: 'app_v2_core', parserType: 'KEY-VALUE', pattern: 'key=value separator="|"', status: 'Untested', lastUpdated: '5m ago' },
];

// 模拟解析结果
const mockResults: Record<string, Record<string, unknown>> = {
  apache_access: { client_ip: '192.168.1.105', timestamp: '10/Oct/2023:13:55:36 +0000', method: 'GET', path: '/api/v1/user/profile', protocol: 'HTTP/1.1', status_code: 200, response_size: 2326, referrer: 'https://logmaster.io/dashboard', user_agent: { raw: 'Mozilla/5.0...', browser: 'Chrome', os: 'Windows 10' } },
  backend_service: { timestamp: '2023-10-10 13:55:36', level: 'ERROR', class: 'com.app.UserService', message: 'Failed to authenticate user: invalid credentials' },
  nginx_error: { time: '2023-10-10T13:55:36Z', level: 'error', msg: 'upstream timed out (110: Connection timed out)' },
  app_v2_core: { timestamp: '2023-10-10T13:55:36Z', level: 'INFO', user_id: '1001', action: 'login', status: 'success' },
};

// ============================================================================
// 辅助：渲染 JSON
// ============================================================================

const RenderJson: React.FC<{ obj: Record<string, unknown>; indent?: number; palette: typeof DARK_PALETTE | typeof LIGHT_PALETTE }> = ({ obj, indent = 0, palette }) => {
  const entries = Object.entries(obj);
  return (
    <>
      {'{'}
      <div style={{ paddingLeft: (indent + 1) * 16 }}>
        {entries.map(([key, value], i) => (
          <div key={key}>
            <span style={{ color: '#60a5fa' }}>"{key}"</span>
            <span style={{ color: palette.textSecondary }}>: </span>
            {typeof value === 'object' && value !== null ? (
              <RenderJson obj={value as Record<string, unknown>} indent={indent + 1} palette={palette} />
            ) : typeof value === 'number' ? (
              <span style={{ color: '#fb923c' }}>{value}</span>
            ) : (
              <span style={{ color: '#4ade80' }}>"{String(value)}"</span>
            )}
            {i < entries.length - 1 && <span style={{ color: palette.textSecondary }}>,</span>}
          </div>
        ))}
      </div>
      {'}'}
    </>
  );
};

// ============================================================================
// 组件
// ============================================================================

const ParsingRules: React.FC = () => {
  const isDark = useThemeStore((s) => s.isDark);
  const palette = isDark ? DARK_PALETTE : LIGHT_PALETTE;

  const [rules, setRules] = useState<ParsingRule[]>(initialRules);
  const [selectedRule, setSelectedRule] = useState<ParsingRule>(initialRules[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [inputLog, setInputLog] = useState(sampleLogs.apache_access);
  const [editingPattern, setEditingPattern] = useState(initialRules[0].pattern);
  const [outputResult, setOutputResult] = useState<Record<string, unknown> | null>(null);
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [form] = Form.useForm();

  const filteredRules = rules.filter(r =>
    r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.source.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelectRule = useCallback((rule: ParsingRule) => {
    setSelectedRule(rule);
    setInputLog(sampleLogs[rule.source] || '');
    setEditingPattern(rule.pattern);
    setOutputResult(null);
  }, []);

  const handleRunTest = useCallback(() => {
    setIsTestRunning(true);
    setTimeout(() => {
      setOutputResult(mockResults[selectedRule.source] || {});
      setIsTestRunning(false);
      setRules(prev => prev.map(r => r.id === selectedRule.id ? { ...r, status: 'Passed' as const } : r));
      setSelectedRule(prev => ({ ...prev, status: 'Passed' }));
    }, 800);
  }, [selectedRule]);

  const handleAddRule = useCallback(() => {
    form.validateFields().then(values => {
      const rule: ParsingRule = {
        id: Date.now().toString(),
        name: values.name,
        source: values.source,
        parserType: values.parserType,
        pattern: values.pattern,
        status: 'Untested',
        lastUpdated: 'just now',
      };
      setRules(prev => [...prev, rule]);
      form.resetFields();
      setAddModalOpen(false);
      message.success('规则已创建');
    });
  }, [form]);

  const handleDeleteRule = useCallback((id: string) => {
    setRules(prev => prev.filter(r => r.id !== id));
    if (selectedRule.id === id && rules.length > 1) {
      const remaining = rules.filter(r => r.id !== id);
      setSelectedRule(remaining[0]);
    }
    message.success('规则已删除');
  }, [selectedRule, rules]);

  const handleCopyRule = useCallback((rule: ParsingRule) => {
    const copy: ParsingRule = { ...rule, id: Date.now().toString(), name: `${rule.name} (Copy)`, status: 'Untested', lastUpdated: 'just now' };
    setRules(prev => [...prev, copy]);
    message.success('规则已复制');
  }, []);

  const statusColor = (s: string) => s === 'Passed' ? 'success' : s === 'Failed' ? 'error' : 'default';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* 顶部栏 */}
      <div style={{ height: 56, padding: '0 24px', borderBottom: `1px solid ${palette.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, background: isDark ? '#111722' : palette.bgContainer }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>解析规则</h2>
          <Tag color="blue" style={{ fontSize: 10 }}>{rules.filter(r => r.status === 'Passed').length} 个活跃规则</Tag>
        </div>
        <Space>
          <Input
            prefix={<span className="material-symbols-outlined" style={{ fontSize: 18, color: palette.textSecondary }}>search</span>}
            placeholder="搜索规则名称..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ width: 240 }}
            allowClear
          />
          <Button type="primary" onClick={() => setAddModalOpen(true)}
            icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>}
          >新建规则</Button>
        </Space>
      </div>

      {/* 主体：左右分栏 */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* 左侧：规则列表 */}
        <div style={{ width: '50%', minWidth: 380, borderRight: `1px solid ${palette.border}`, background: isDark ? '#101622' : '#f8fafc', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filteredRules.map(rule => (
              <div
                key={rule.id}
                onClick={() => handleSelectRule(rule)}
                style={{
                  position: 'relative',
                  padding: 16,
                  borderRadius: 12,
                  border: `1px solid ${selectedRule.id === rule.id ? `${COLORS.primary}66` : palette.border}`,
                  background: selectedRule.id === rule.id ? (isDark ? '#1a2332' : '#fff') : palette.bgContainer,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: selectedRule.id === rule.id ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
                }}
              >
                {selectedRule.id === rule.id && (
                  <div style={{ position: 'absolute', left: 0, top: 16, bottom: 16, width: 3, borderRadius: '0 3px 3px 0', background: COLORS.primary }} />
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingLeft: selectedRule.id === rule.id ? 12 : 4 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>{rule.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 12, color: palette.textSecondary }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>source</span>
                      Source: {rule.source}
                    </div>
                  </div>
                  <Tag color={statusColor(rule.status)} style={{ fontSize: 11 }}>{rule.status}</Tag>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingLeft: selectedRule.id === rule.id ? 12 : 4 }}>
                  <Space size={8}>
                    <Tag style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}>{rule.parserType}</Tag>
                    <span style={{ fontSize: 12, color: palette.textSecondary }}>更新于: {rule.lastUpdated}</span>
                  </Space>
                  <Space size={4}>
                    <Button type="text" size="small" onClick={e => { e.stopPropagation(); handleSelectRule(rule); }}
                      icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit</span>} />
                    <Button type="text" size="small" onClick={e => { e.stopPropagation(); handleCopyRule(rule); }}
                      icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>content_copy</span>} />
                    <Button type="text" size="small" onClick={e => { e.stopPropagation(); handleDeleteRule(rule.id); }}
                      icon={<span className="material-symbols-outlined" style={{ fontSize: 18, color: COLORS.danger }}>delete</span>} />
                  </Space>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 右侧：Playground */}
        <div style={{ width: '50%', display: 'flex', flexDirection: 'column', background: isDark ? '#0b1121' : '#f1f5f9' }}>
          {/* Playground 头部 */}
          <div style={{ height: 44, padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${palette.border}`, background: isDark ? '#111722' : palette.bgContainer }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20, color: COLORS.primary }}>science</span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>规则调试台 (Playground)</span>
            </div>
            <Space>
              <span style={{ fontSize: 12, color: palette.textSecondary }}>
                状态: <span style={{ color: outputResult ? COLORS.success : palette.textSecondary, fontWeight: 500 }}>
                  {outputResult ? '解析成功' : '等待测试'}
                </span>
              </span>
              <Button size="small" onClick={handleRunTest} loading={isTestRunning}
                icon={<span className="material-symbols-outlined" style={{ fontSize: 14 }}>{isTestRunning ? 'hourglass_empty' : 'play_arrow'}</span>}
              >{isTestRunning ? '测试中...' : '测试运行'}</Button>
            </Space>
          </div>

          {/* 解析模式编辑器 */}
          <div style={{ padding: 12, borderBottom: `1px solid ${palette.border}`, background: isDark ? '#161e2c' : '#e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 1 }}>解析模式 ({selectedRule.parserType})</span>
              <span style={{ fontSize: 12, color: palette.textSecondary }}>{selectedRule.name}</span>
            </div>
            <textarea
              value={editingPattern}
              onChange={e => setEditingPattern(e.target.value)}
              spellCheck={false}
              style={{
                width: '100%', height: 56, padding: 8, borderRadius: 6,
                border: `1px solid ${palette.border}`, resize: 'none',
                background: isDark ? '#0b1121' : '#f8fafc',
                color: palette.text, fontFamily: 'JetBrains Mono, monospace', fontSize: 12,
                outline: 'none',
              }}
            />
          </div>

          {/* 输入/输出区域 */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* 输入 */}
            <div style={{ height: '50%', display: 'flex', flexDirection: 'column', borderBottom: `1px solid ${palette.border}`, position: 'relative' }}>
              <div style={{ height: 28, padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: isDark ? '#161e2c' : '#e2e8f0', borderBottom: `1px solid ${palette.border}` }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 1 }}>原始日志 (Input)</span>
                <button onClick={() => setInputLog('')} style={{ background: 'none', border: 'none', color: palette.textSecondary, fontSize: 10, cursor: 'pointer' }}>清空</button>
              </div>
              <textarea
                value={inputLog}
                onChange={e => setInputLog(e.target.value)}
                spellCheck={false}
                placeholder="在此输入要测试的日志内容..."
                style={{
                  flex: 1, width: '100%', padding: 16, resize: 'none', border: 'none',
                  background: 'transparent', color: isDark ? '#cbd5e1' : '#334155',
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 12, lineHeight: 1.6, outline: 'none',
                }}
              />
            </div>

            {/* 输出 */}
            <div style={{ height: '50%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
              <div style={{ height: 28, padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: isDark ? '#161e2c' : '#e2e8f0', borderBottom: `1px solid ${palette.border}` }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 1 }}>解析结果 (Output)</span>
                <button
                  onClick={() => outputResult && navigator.clipboard.writeText(JSON.stringify(outputResult, null, 2))}
                  style={{ background: 'none', border: 'none', color: palette.textSecondary, fontSize: 10, cursor: 'pointer' }}
                >复制 JSON</button>
              </div>
              <div style={{ flex: 1, padding: 16, overflow: 'auto', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, lineHeight: 1.6 }}>
                {isTestRunning ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: palette.textSecondary }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16, animation: 'spin 1s linear infinite' }}>progress_activity</span>
                    正在解析...
                  </div>
                ) : outputResult ? (
                  <div style={{ color: isDark ? '#cbd5e1' : '#334155' }}>
                    <RenderJson obj={outputResult} palette={palette} />
                  </div>
                ) : (
                  <div style={{ color: palette.textSecondary }}>点击"测试运行"查看解析结果</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 新建规则弹窗 */}
      <Modal
        open={addModalOpen}
        title="新建解析规则"
        onCancel={() => { setAddModalOpen(false); form.resetFields(); }}
        onOk={handleAddRule}
        okText="创建"
        cancelText="取消"
        width={520}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="规则名称" rules={[{ required: true, message: '请输入规则名称' }]}>
            <Input placeholder="例如: Apache Access Log" />
          </Form.Item>
          <Form.Item name="source" label="数据源" rules={[{ required: true, message: '请输入数据源' }]}>
            <Input placeholder="例如: apache_access" />
          </Form.Item>
          <Form.Item name="parserType" label="解析器类型" initialValue="GROK">
            <Select options={[
              { value: 'GROK', label: 'GROK' },
              { value: 'REGEX', label: 'REGEX' },
              { value: 'JSON', label: 'JSON' },
              { value: 'KEY-VALUE', label: 'KEY-VALUE' },
              { value: 'CSV', label: 'CSV' },
            ]} />
          </Form.Item>
          <Form.Item name="pattern" label="解析模式" rules={[{ required: true, message: '请输入解析模式' }]}>
            <Input.TextArea placeholder="输入解析模式..." rows={4} style={{ fontFamily: 'JetBrains Mono, monospace' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ParsingRules;
