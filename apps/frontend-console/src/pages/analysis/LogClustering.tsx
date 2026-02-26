import React, { useState, useMemo, useCallback } from 'react';
import { Card, Tag, Input, Button, Statistic, Drawer, Tabs, Space, Segmented, Descriptions } from 'antd';
import { useThemeStore } from '../../stores/themeStore';
import { COLORS } from '../../theme/tokens';

// ============================================================================
// 类型定义
// ============================================================================

interface LogSample {
  timestamp: string;
  message: string;
  variables: Record<string, string>;
}

interface LogPattern {
  id: string;
  template: string;
  similarity: number;
  occurrences: number;
  trend: number[];
  firstSeen: string;
  lastSeen: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  samples: LogSample[];
}

// ============================================================================
// 模拟数据
// ============================================================================

const LOG_PATTERNS: LogPattern[] = [
  {
    id: '1',
    template: 'Error: Connection timed out to database {IP_ADDRESS} at port {PORT}',
    similarity: 98,
    occurrences: 15240,
    trend: [20, 40, 30, 60, 45, 80, 90, 100],
    firstSeen: '2023-10-27 10:00:01',
    lastSeen: '刚刚',
    level: 'error',
    samples: [
      { timestamp: 'Oct 27 10:45:01', message: 'Error: Connection timed out to database 192.168.1.100 at port 5432', variables: { IP_ADDRESS: '192.168.1.100', PORT: '5432' } },
      { timestamp: 'Oct 27 10:45:05', message: 'Error: Connection timed out to database 192.168.1.101 at port 5432', variables: { IP_ADDRESS: '192.168.1.101', PORT: '5432' } },
      { timestamp: 'Oct 27 10:46:12', message: 'Error: Connection timed out to database 10.0.0.50 at port 3306', variables: { IP_ADDRESS: '10.0.0.50', PORT: '3306' } },
    ],
  },
  {
    id: '2',
    template: 'User {USER_ID} failed login attempt from {SOURCE_IP}',
    similarity: 100,
    occurrences: 340,
    trend: [20, 20, 20, 25, 20, 20, 20, 20],
    firstSeen: '2023-10-26 14:20:00',
    lastSeen: '2 分钟前',
    level: 'warn',
    samples: [
      { timestamp: 'Oct 27 10:45:01', message: 'User admin_01 failed login attempt from 192.168.1.105', variables: { USER_ID: 'admin_01', SOURCE_IP: '192.168.1.105' } },
      { timestamp: 'Oct 27 10:45:05', message: 'User guest_user failed login attempt from 10.0.0.52', variables: { USER_ID: 'guest_user', SOURCE_IP: '10.0.0.52' } },
      { timestamp: 'Oct 27 10:46:12', message: 'User service_acc failed login attempt from 172.16.254.1', variables: { USER_ID: 'service_acc', SOURCE_IP: '172.16.254.1' } },
    ],
  },
  {
    id: '3',
    template: 'INFO: Batch job {JOB_ID} completed in {DURATION} ms',
    similarity: 85,
    occurrences: 8902,
    trend: [50, 50, 50, 50, 50, 50, 50, 50],
    firstSeen: '2023-10-20 08:00:00',
    lastSeen: '1 小时前',
    level: 'info',
    samples: [
      { timestamp: 'Oct 27 09:00:00', message: 'INFO: Batch job job_001 completed in 1234 ms', variables: { JOB_ID: 'job_001', DURATION: '1234' } },
      { timestamp: 'Oct 27 09:15:00', message: 'INFO: Batch job job_002 completed in 2345 ms', variables: { JOB_ID: 'job_002', DURATION: '2345' } },
      { timestamp: 'Oct 27 09:30:00', message: 'INFO: Batch job job_003 completed in 987 ms', variables: { JOB_ID: 'job_003', DURATION: '987' } },
    ],
  },
  {
    id: '4',
    template: 'DEBUG: Processing request {REQUEST_ID} for user {USER_ID}',
    similarity: 92,
    occurrences: 45230,
    trend: [60, 70, 65, 80, 75, 85, 90, 88],
    firstSeen: '2023-10-15 00:00:00',
    lastSeen: '刚刚',
    level: 'debug',
    samples: [
      { timestamp: 'Oct 27 10:50:01', message: 'DEBUG: Processing request req_abc123 for user user_001', variables: { REQUEST_ID: 'req_abc123', USER_ID: 'user_001' } },
      { timestamp: 'Oct 27 10:50:02', message: 'DEBUG: Processing request req_def456 for user user_002', variables: { REQUEST_ID: 'req_def456', USER_ID: 'user_002' } },
    ],
  },
];

// ============================================================================
// 辅助函数
// ============================================================================

const LEVEL_CONFIG: Record<string, { color: string; tagColor: string; label: string }> = {
  error: { color: COLORS.danger, tagColor: 'error', label: 'ERROR' },
  warn: { color: COLORS.warning, tagColor: 'warning', label: 'WARN' },
  info: { color: COLORS.info, tagColor: 'processing', label: 'INFO' },
  debug: { color: COLORS.purple, tagColor: 'purple', label: 'DEBUG' },
};

/** 渲染模板字符串，高亮变量占位符 */
const renderTemplate = (template: string) =>
  template.split(/(\{[^}]+\})/).map((part, i) =>
    part.match(/\{[^}]+\}/) ? (
      <Tag key={i} color="blue" style={{ margin: '0 2px', fontSize: 11, lineHeight: '18px', padding: '0 4px' }}>{part}</Tag>
    ) : (
      <span key={i}>{part}</span>
    ),
  );

/** 渲染样本消息，高亮变量值 */
const renderSampleMessage = (message: string) =>
  message.split(/(\b\d+\.\d+\.\d+\.\d+\b|\b[a-zA-Z_]+_\d+\b|\b\d{3,}\b)/).map((part, i) =>
    part.match(/\d+\.\d+\.\d+\.\d+/) || part.match(/[a-zA-Z_]+_\d+/) || part.match(/^\d{3,}$/) ? (
      <span key={i} style={{ color: COLORS.warning }}>{part}</span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );

// ============================================================================
// 主组件
// ============================================================================

const LogClustering: React.FC = () => {
  const isDark = useThemeStore((s) => s.isDark);

  const [expandedId, setExpandedId] = useState<string | null>('2');
  const [selectedPattern, setSelectedPattern] = useState<LogPattern | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [timeRange, setTimeRange] = useState('24h');

  const handleToggle = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  // 过滤模式
  const filteredPatterns = useMemo(() => {
    return LOG_PATTERNS.filter((p) => {
      const matchSearch = !searchQuery || p.template.toLowerCase().includes(searchQuery.toLowerCase());
      const matchLevel = levelFilter === 'all' || p.level === levelFilter;
      return matchSearch && matchLevel;
    });
  }, [searchQuery, levelFilter]);

  // 统计
  const totalLogs = LOG_PATTERNS.reduce((sum, p) => sum + p.occurrences, 0);

  // 下钻面板中提取所有变量
  const allVariables = useMemo(() => {
    if (!selectedPattern) return {};
    return selectedPattern.samples.reduce((acc, sample) => {
      Object.entries(sample.variables).forEach(([key, value]) => {
        if (!acc[key]) acc[key] = new Set<string>();
        acc[key].add(value);
      });
      return acc;
    }, {} as Record<string, Set<string>>);
  }, [selectedPattern]);

  return (
    <div className="flex flex-col gap-4">
      {/* 页面头部 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold m-0">聚类分析</h2>
          <span className="text-xs opacity-50">Log Clustering</span>
        </div>
        <Space wrap>
          <Segmented
            value={timeRange}
            onChange={(v) => setTimeRange(v as string)}
            options={[
              { value: '1h', label: '1 小时' },
              { value: '24h', label: '24 小时' },
              { value: '7d', label: '7 天' },
            ]}
            size="small"
          />
          <Button
            type="primary"
            size="small"
            icon={<span className="material-symbols-outlined text-sm">download</span>}
          >
            导出报告
          </Button>
        </Space>
      </div>

      {/* KPI 卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <Statistic
            title="分析日志总量"
            value={`${(totalLogs / 1000000).toFixed(1)}M`}
            prefix={<span className="material-symbols-outlined text-base" style={{ color: COLORS.primary }}>data_usage</span>}
            suffix={<span className="text-xs text-green-500 ml-1">↑ 2.4%</span>}
          />
        </Card>
        <Card>
          <Statistic
            title="唯一模式数"
            value={LOG_PATTERNS.length}
            prefix={<span className="material-symbols-outlined text-base" style={{ color: COLORS.purple }}>category</span>}
          />
        </Card>
        <Card>
          <Statistic
            title="今日新增模式"
            value="+15"
            prefix={<span className="material-symbols-outlined text-base" style={{ color: COLORS.warning }}>new_releases</span>}
            suffix={<span className="text-xs text-red-500 ml-1">↑ 5.2%</span>}
          />
        </Card>
      </div>

      {/* 模式列表 */}
      <Card
        title={
          <div>
            <div className="text-base font-bold">日志模式</div>
            <div className="text-xs opacity-50 font-normal mt-0.5">自动将数百万条日志聚合为模式模板</div>
          </div>
        }
        extra={
          <Space wrap>
            <Input.Search
              placeholder="搜索模式内容..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: 240 }}
              size="small"
              allowClear
            />
            <Segmented
              value={levelFilter}
              onChange={(v) => setLevelFilter(v as string)}
              options={[
                { value: 'all', label: '全部' },
                { value: 'error', label: 'ERROR' },
                { value: 'warn', label: 'WARN' },
                { value: 'info', label: 'INFO' },
                { value: 'debug', label: 'DEBUG' },
              ]}
              size="small"
            />
          </Space>
        }
        styles={{ body: { padding: 0 } }}
      >
        {filteredPatterns.map((pattern) => {
          const levelCfg = LEVEL_CONFIG[pattern.level];
          const isExpanded = expandedId === pattern.id;

          return (
            <div key={pattern.id}>
              {/* 模式行 */}
              <div
                onClick={() => handleToggle(pattern.id)}
                className="flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors"
                style={{
                  borderBottom: `1px solid ${isDark ? '#334155' : '#f0f0f0'}`,
                  backgroundColor: isExpanded ? (isDark ? 'rgba(19,91,236,0.04)' : 'rgba(19,91,236,0.02)') : 'transparent',
                }}
              >
                {/* 展开箭头 */}
                <span
                  className="material-symbols-outlined text-base opacity-40 mt-0.5 transition-transform"
                  style={{ transform: isExpanded ? 'rotate(90deg)' : 'none' }}
                >
                  chevron_right
                </span>

                {/* 级别标签 */}
                <Tag color={levelCfg.tagColor} style={{ margin: 0, fontSize: 10, flexShrink: 0 }}>{levelCfg.label}</Tag>

                {/* 模板内容 */}
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-sm break-all leading-relaxed">
                    {renderTemplate(pattern.template)}
                  </div>
                  <div className="text-xs opacity-40 mt-1">
                    首次: {pattern.firstSeen} · 最后: {pattern.lastSeen}
                  </div>
                </div>

                {/* 相似度 */}
                <div className="flex items-center gap-1.5 flex-shrink-0" style={{ width: 80 }}>
                  <div className="w-12 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: isDark ? '#334155' : '#e2e8f0' }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pattern.similarity}%`,
                        backgroundColor: pattern.similarity >= 95 ? COLORS.success : pattern.similarity >= 80 ? COLORS.warning : COLORS.danger,
                      }}
                    />
                  </div>
                  <span className="text-xs">{pattern.similarity}%</span>
                </div>

                {/* 出现次数 */}
                <div className="text-sm font-medium flex-shrink-0" style={{ width: 70, textAlign: 'right' }}>
                  {pattern.occurrences.toLocaleString()}
                </div>

                {/* 趋势迷你图 */}
                <div className="flex items-end gap-0.5 h-6 flex-shrink-0" style={{ width: 64 }}>
                  {pattern.trend.map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-sm"
                      style={{ height: `${h}%`, backgroundColor: h > 50 ? COLORS.primary : `${COLORS.primary}80` }}
                    />
                  ))}
                </div>

                {/* 操作按钮 */}
                <Space size={4} className="flex-shrink-0">
                  <Button
                    type="text"
                    size="small"
                    onClick={(e) => { e.stopPropagation(); setSelectedPattern(pattern); }}
                    icon={<span className="material-symbols-outlined text-base">zoom_in</span>}
                    title="下钻分析"
                  />
                  <Button
                    type="text"
                    size="small"
                    icon={<span className="material-symbols-outlined text-base">notifications_active</span>}
                    title="创建告警"
                  />
                </Space>
              </div>

              {/* 展开的样本面板 */}
              {isExpanded && (
                <div
                  className="px-4 py-3"
                  style={{
                    backgroundColor: isDark ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.02)',
                    borderBottom: `1px solid ${isDark ? '#334155' : '#f0f0f0'}`,
                  }}
                >
                  <div className="ml-8">
                    <Card
                      size="small"
                      title={
                        <span className="flex items-center gap-1.5 text-xs">
                          <span className="material-symbols-outlined text-sm" style={{ color: COLORS.primary }}>list_alt</span>
                          模式 #{pattern.id} 的原始日志样本
                        </span>
                      }
                      extra={
                        <Button type="link" size="small" onClick={() => setSelectedPattern(pattern)}>
                          查看全部日志
                        </Button>
                      }
                    >
                      <div className="flex flex-col gap-1.5">
                        {pattern.samples.slice(0, 3).map((sample, idx) => (
                          <div
                            key={idx}
                            className="flex gap-3 p-2 rounded text-xs font-mono"
                            style={{
                              backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.03)',
                              border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                            }}
                          >
                            <span className="opacity-40 whitespace-nowrap">{sample.timestamp}</span>
                            <span className="break-all">{renderSampleMessage(sample.message)}</span>
                          </div>
                        ))}
                      </div>
                      <div
                        className="flex items-center justify-between mt-3 pt-3 text-xs"
                        style={{ borderTop: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}
                      >
                        <span className="opacity-40">
                          显示 {Math.min(3, pattern.samples.length)} / {pattern.occurrences.toLocaleString()} 条
                        </span>
                        <Space size={8}>
                          <Button size="small" type="default">创建告警规则</Button>
                          <Button size="small" type="default">排除此模式</Button>
                        </Space>
                      </div>
                    </Card>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* 底部分页信息 */}
        <div
          className="flex items-center justify-between px-4 py-3 text-sm"
          style={{ borderTop: `1px solid ${isDark ? '#334155' : '#f0f0f0'}` }}
        >
          <span className="opacity-50">
            显示 {filteredPatterns.length} / {LOG_PATTERNS.length} 个模式
          </span>
        </div>
      </Card>

      {/* 下钻详情抽屉 */}
      <Drawer
        title={
          selectedPattern ? (
            <div className="flex items-center gap-2">
              <Tag color={LEVEL_CONFIG[selectedPattern.level].tagColor} style={{ margin: 0 }}>
                {LEVEL_CONFIG[selectedPattern.level].label}
              </Tag>
              <span className="text-xs opacity-50">Pattern #{selectedPattern.id}</span>
            </div>
          ) : '模式详情'
        }
        open={!!selectedPattern}
        onClose={() => setSelectedPattern(null)}
        width={560}
        footer={
          selectedPattern && (
            <Space style={{ width: '100%' }}>
              <Button type="primary" block>创建告警规则</Button>
              <Button block>排除此模式</Button>
              <Button icon={<span className="material-symbols-outlined text-sm">download</span>} />
            </Space>
          )
        }
      >
        {selectedPattern && (
          <div className="flex flex-col gap-4">
            {/* 模板 */}
            <div
              className="p-3 rounded-lg font-mono text-sm break-all leading-relaxed"
              style={{
                backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.03)',
                border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
              }}
            >
              {renderTemplate(selectedPattern.template)}
            </div>

            {/* 统计信息 */}
            <div className="grid grid-cols-2 gap-3">
              <Card size="small">
                <Statistic title="出现次数" value={selectedPattern.occurrences.toLocaleString()} valueStyle={{ fontSize: 18 }} />
              </Card>
              <Card size="small">
                <Statistic title="相似度" value={selectedPattern.similarity} suffix="%" valueStyle={{ fontSize: 18 }} />
              </Card>
            </div>

            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="首次出现">{selectedPattern.firstSeen}</Descriptions.Item>
              <Descriptions.Item label="最后出现">{selectedPattern.lastSeen}</Descriptions.Item>
            </Descriptions>

            {/* Tabs: 日志样本 / 变量分析 / 时间线 */}
            <Tabs
              defaultActiveKey="samples"
              size="small"
              items={[
                {
                  key: 'samples',
                  label: '日志样本',
                  children: (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between text-xs opacity-50 mb-1">
                        <span>原始日志样本</span>
                        <span>显示 {selectedPattern.samples.length} / {selectedPattern.occurrences.toLocaleString()} 条</span>
                      </div>
                      {selectedPattern.samples.map((sample, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-lg font-mono text-xs break-all"
                          style={{
                            backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.03)',
                            border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                          }}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="opacity-40">{sample.timestamp}</span>
                            <Button type="link" size="small" style={{ fontSize: 11, padding: 0, height: 'auto' }}>复制</Button>
                          </div>
                          <div>{renderSampleMessage(sample.message)}</div>
                        </div>
                      ))}
                    </div>
                  ),
                },
                {
                  key: 'variables',
                  label: '变量分析',
                  children: (
                    <div className="flex flex-col gap-3">
                      {Object.entries(allVariables).map(([varName, values]) => (
                        <Card key={varName} size="small" title={<span style={{ color: COLORS.primary }}>{`{${varName}}`}</span>} extra={<span className="text-xs opacity-50">{values.size} 个唯一值</span>}>
                          <div className="flex flex-wrap gap-1.5">
                            {Array.from(values).map((value, idx) => (
                              <Tag key={idx} style={{ margin: 0 }}><span className="font-mono text-xs">{value}</span></Tag>
                            ))}
                          </div>
                        </Card>
                      ))}
                    </div>
                  ),
                },
                {
                  key: 'timeline',
                  label: '时间线',
                  children: (
                    <div>
                      <div className="text-xs opacity-50 mb-2">出现频率趋势</div>
                      <div
                        className="p-4 rounded-lg"
                        style={{
                          backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.03)',
                          border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                        }}
                      >
                        <div className="flex items-end gap-1 h-32">
                          {selectedPattern.trend.map((h, i) => (
                            <div
                              key={i}
                              className="flex-1 rounded-t transition-colors"
                              style={{ height: `${h}%`, backgroundColor: h > 50 ? COLORS.primary : `${COLORS.primary}80` }}
                            />
                          ))}
                        </div>
                        <div className="flex justify-between mt-2 text-xs opacity-40">
                          <span>24h 前</span>
                          <span>现在</span>
                        </div>
                      </div>
                    </div>
                  ),
                },
              ]}
            />
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default LogClustering;
