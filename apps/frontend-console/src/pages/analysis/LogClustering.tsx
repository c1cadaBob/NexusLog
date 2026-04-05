import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  App,
  Button,
  Card,
  Descriptions,
  Drawer,
  Empty,
  Input,
  Segmented,
  Space,
  Statistic,
  Tabs,
  Tag,
} from 'antd';
import {
  fetchLogClusters,
  type FetchLogClustersParams,
  type FetchLogClustersResult,
  type LogClusterPattern,
  type LogClusterSample,
  type QueryResultFallbackInfo,
} from '../../api/query';
import AnalysisPageHeader from '../../components/common/AnalysisPageHeader';
import { useThemeStore } from '../../stores/themeStore';
import { COLORS } from '../../theme/tokens';

const NUMBER_FORMATTER = new Intl.NumberFormat('zh-CN');

type ClusterTimeRange = FetchLogClustersParams['timeRange'];
type LevelFilter = 'all' | 'error' | 'warn' | 'info' | 'debug';

const EMPTY_RESULT: FetchLogClustersResult = {
  summary: {
    analyzed_logs_total: 0,
    sampled_logs: 0,
    unique_patterns: 0,
    new_patterns_today: 0,
  },
  patterns: [],
};

const TIME_RANGE_OPTIONS: Array<{ value: ClusterTimeRange; label: string }> = [
  { value: '1h', label: '1 小时' },
  { value: '24h', label: '24 小时' },
  { value: '7d', label: '7 天' },
];

const LEVEL_FILTER_OPTIONS: Array<{ value: LevelFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'error', label: 'ERROR' },
  { value: 'warn', label: 'WARN' },
  { value: 'info', label: 'INFO' },
  { value: 'debug', label: 'DEBUG' },
];

const LEVEL_CONFIG: Record<string, { color: string; tagColor: string; label: string }> = {
  error: { color: COLORS.danger, tagColor: 'error', label: 'ERROR' },
  warn: { color: COLORS.warning, tagColor: 'warning', label: 'WARN' },
  info: { color: COLORS.info, tagColor: 'processing', label: 'INFO' },
  debug: { color: COLORS.purple, tagColor: 'purple', label: 'DEBUG' },
};

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function formatCount(value: number): string {
  return NUMBER_FORMATTER.format(Number.isFinite(value) ? value : 0);
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value || '-';
  }
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function buildRequestFilters(levelFilter: LevelFilter): Record<string, unknown> {
  if (levelFilter === 'all') {
    return {};
  }
  return { level: levelFilter };
}

function renderTemplate(template: string) {
  return template.split(/(\{[^}]+\})/).map((part, index) => (
    /\{[^}]+\}/.test(part)
      ? (
        <Tag key={`${part}-${index}`} color="blue" style={{ margin: '0 2px', fontSize: 11, lineHeight: '18px', padding: '0 4px' }}>
          {part}
        </Tag>
      )
      : <span key={`${part}-${index}`}>{part}</span>
  ));
}

function renderSampleMessage(message: string, sample: LogClusterSample) {
  let segments: Array<{ text: string; highlighted: boolean }> = [{ text: message, highlighted: false }];
  Object.values(sample.variables ?? {}).forEach((rawValue) => {
    const value = String(rawValue ?? '').trim();
    if (!value) {
      return;
    }
    segments = segments.flatMap((segment) => {
      if (segment.highlighted || !segment.text.includes(value)) {
        return [segment];
      }
      const parts = segment.text.split(value);
      return parts.flatMap((part, index) => {
        const items: Array<{ text: string; highlighted: boolean }> = [];
        if (part) {
          items.push({ text: part, highlighted: false });
        }
        if (index < parts.length - 1) {
          items.push({ text: value, highlighted: true });
        }
        return items;
      });
    });
  });

  return segments.map((segment, index) => (
    segment.highlighted
      ? <span key={`${segment.text}-${index}`} style={{ color: COLORS.warning }}>{segment.text}</span>
      : <span key={`${segment.text}-${index}`}>{segment.text}</span>
  ));
}

function renderTrendBars(pattern: LogClusterPattern, isDark: boolean, height = 56) {
  const maxCount = Math.max(1, ...pattern.trend.map((point) => Number(point.count || 0)));
  return (
    <div>
      <div className="flex items-end gap-1" style={{ height }}>
        {pattern.trend.map((point, index) => {
          const value = Number(point.count || 0);
          const percentage = Math.max(6, Math.round((value / maxCount) * 100));
          return (
            <div
              key={`${pattern.id}-${point.time}-${index}`}
              style={{
                flex: 1,
                height: `${percentage}%`,
                borderRadius: '8px 8px 0 0',
                backgroundColor: value === maxCount ? COLORS.primary : `${COLORS.primary}80`,
                minHeight: value > 0 ? 8 : 4,
              }}
              title={`${formatDateTime(point.time)}：${formatCount(value)} 条`}
            />
          );
        })}
      </div>
      <div className="flex items-center justify-between mt-2 text-xs" style={{ opacity: 0.55 }}>
        <span>{formatDateTime(pattern.trend[0]?.time ?? '')}</span>
        <span>{formatDateTime(pattern.trend[pattern.trend.length - 1]?.time ?? '')}</span>
      </div>
    </div>
  );
}

function downloadAsJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
}

const LogClustering: React.FC = () => {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const isDark = useThemeStore((state) => state.isDark);

  const [timeRange, setTimeRange] = useState<ClusterTimeRange>('7d');
  const [keywordInput, setKeywordInput] = useState('');
  const [keywords, setKeywords] = useState('');
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');
  const [refreshToken, setRefreshToken] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<FetchLogClustersResult>(EMPTY_RESULT);
  const [fallbackInfo, setFallbackInfo] = useState<QueryResultFallbackInfo | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const hasSuccessfulResultRef = useRef(false);
  const [selectedPatternID, setSelectedPatternID] = useState<string | null>(null);
  const [hiddenPatternIDs, setHiddenPatternIDs] = useState<string[]>([]);

  const requestFilters = useMemo(() => buildRequestFilters(levelFilter), [levelFilter]);

  const loadClusters = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError('');
    try {
      const nextResult = await fetchLogClusters({
        timeRange,
        keywords,
        filters: requestFilters,
        limit: 24,
        sampleSize: 400,
        signal,
      });
      if (signal?.aborted) {
        return;
      }
      hasSuccessfulResultRef.current = true;
      setResult(nextResult);
      setFallbackInfo(nextResult.fallbackInfo ?? null);
      setLastUpdatedAt(new Date());
    } catch (loadError) {
      if (isAbortError(loadError)) {
        return;
      }
      if (!hasSuccessfulResultRef.current) {
        setResult(EMPTY_RESULT);
        setFallbackInfo(null);
      }
      setError(loadError instanceof Error ? loadError.message : '聚类分析加载失败，请稍后重试');
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [keywords, requestFilters, timeRange]);

  useEffect(() => {
    const controller = new AbortController();
    void loadClusters(controller.signal);
    return () => controller.abort();
  }, [loadClusters, refreshToken]);

  const visiblePatterns = useMemo(
    () => result.patterns.filter((pattern) => !hiddenPatternIDs.includes(pattern.id)),
    [hiddenPatternIDs, result.patterns],
  );

  const selectedPattern = useMemo(
    () => visiblePatterns.find((pattern) => pattern.id === selectedPatternID) ?? null,
    [selectedPatternID, visiblePatterns],
  );

  useEffect(() => {
    if (selectedPatternID && !visiblePatterns.some((pattern) => pattern.id === selectedPatternID)) {
      setSelectedPatternID(null);
    }
  }, [selectedPatternID, visiblePatterns]);

  const selectedVariables = useMemo<Record<string, Set<string>>>(() => {
    if (!selectedPattern) {
      return {} as Record<string, Set<string>>;
    }
    return selectedPattern.samples.reduce<Record<string, Set<string>>>((accumulator, sample) => {
      Object.entries(sample.variables ?? {}).forEach(([name, value]) => {
        if (!accumulator[name]) {
          accumulator[name] = new Set<string>();
        }
        accumulator[name].add(String(value ?? '').trim());
      });
      return accumulator;
    }, {} as Record<string, Set<string>>);
  }, [selectedPattern]);

  const selectedVariableEntries = useMemo(
    () => Object.entries(selectedVariables).map(([name, values]) => [name, Array.from(values).filter(Boolean)] as const),
    [selectedVariables],
  );

  const handleRefresh = useCallback(() => {
    setRefreshToken((current) => current + 1);
  }, []);

  const hasRetainedResult = Boolean(lastUpdatedAt);
  const staleResultVisible = Boolean(error && hasRetainedResult);

  const handleApplySearch = useCallback((value: string) => {
    const normalized = value.trim();
    setKeywordInput(value);
    setKeywords(normalized);
  }, []);

  const handleExportReport = useCallback(() => {
    if (visiblePatterns.length === 0) {
      message.info('当前没有可导出的聚类结果');
      return;
    }
    downloadAsJson(`log-clustering-${Date.now()}.json`, {
      filters: {
        timeRange,
        keywords,
        levelFilter,
      },
      summary: result.summary,
      patterns: visiblePatterns,
    });
    message.success('已导出当前聚类报告');
  }, [keywords, levelFilter, message, result.summary, timeRange, visiblePatterns]);

  const handleExportPattern = useCallback((pattern: LogClusterPattern | null) => {
    if (!pattern) {
      return;
    }
    downloadAsJson(`log-cluster-${pattern.id}.json`, pattern);
    message.success('已导出当前模式详情');
  }, [message]);

  const handleExcludePattern = useCallback((pattern: LogClusterPattern | null) => {
    if (!pattern) {
      return;
    }
    setHiddenPatternIDs((current) => (current.includes(pattern.id) ? current : [...current, pattern.id]));
    setSelectedPatternID(null);
    message.success('已在当前会话中隐藏该模式');
  }, [message]);

  const handleCreateAlert = useCallback(() => {
    message.info('告警规则预填入口将在下一步接入');
  }, [message]);

  return (
    <div className="flex flex-col gap-4">
      <AnalysisPageHeader
        title="聚类分析"
        subtitle="基于真实日志样本的模式聚合与相似分析"
        lastUpdatedAt={lastUpdatedAt}
        showRetainedResultTag={staleResultVisible}
        fallbackLabel={fallbackInfo?.label ?? null}
        actions={(
          <>
            <Segmented
              value={timeRange}
              onChange={(value) => setTimeRange(value as ClusterTimeRange)}
              options={TIME_RANGE_OPTIONS}
              size="small"
            />
            <Button
              size="small"
              onClick={() => navigate('/help/faq')}
              icon={<span className="material-symbols-outlined text-sm">support_agent</span>}
            >
              帮助
            </Button>
            <Button size="small" onClick={handleRefresh} loading={loading} icon={<span className="material-symbols-outlined text-sm">refresh</span>}>
              刷新数据
            </Button>
            <Button
              size="small"
              type="primary"
              onClick={handleExportReport}
              icon={<span className="material-symbols-outlined text-sm">download</span>}
            >
              导出报告
            </Button>
          </>
        )}
      />

      {hiddenPatternIDs.length > 0 && (
        <div className="text-xs opacity-60">
          当前会话已隐藏 {hiddenPatternIDs.length} 个模式，可点击“刷新数据”重新拉取全部结果。
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <Statistic
            title="匹配事件总量"
            value={formatCount(result.summary.analyzed_logs_total)}
            prefix={<span className="material-symbols-outlined text-base" style={{ color: COLORS.primary }}>monitoring</span>}
          />
        </Card>
        <Card>
          <Statistic
            title="已分析样本"
            value={formatCount(result.summary.sampled_logs)}
            prefix={<span className="material-symbols-outlined text-base" style={{ color: COLORS.purple }}>data_usage</span>}
          />
        </Card>
        <Card>
          <Statistic
            title="唯一模式数"
            value={formatCount(result.summary.unique_patterns)}
            prefix={<span className="material-symbols-outlined text-base" style={{ color: COLORS.info }}>category</span>}
          />
        </Card>
        <Card>
          <Statistic
            title="近 24h 新模式"
            value={formatCount(result.summary.new_patterns_today)}
            prefix={<span className="material-symbols-outlined text-base" style={{ color: COLORS.warning }}>new_releases</span>}
          />
        </Card>
      </div>

      <Card
        title={(
          <div>
            <div className="text-base font-bold">日志模式</div>
            <div className="text-xs font-normal mt-0.5" style={{ opacity: 0.55 }}>
              对最近时间窗内的真实日志做模板归一化，并输出高频模式、样本和趋势
            </div>
          </div>
        )}
        extra={(
          <Space wrap>
            <Input.Search
              name="cluster_keywords"
              placeholder="输入关键词后回车，例如 timeout / login / audit"
              value={keywordInput}
              onChange={(event) => {
                const nextValue = event.target.value;
                setKeywordInput(nextValue);
                if (!nextValue.trim()) {
                  setKeywords('');
                }
              }}
              onSearch={handleApplySearch}
              style={{ width: 320 }}
              size="small"
              allowClear
            />
            <Segmented
              value={levelFilter}
              onChange={(value) => setLevelFilter(value as LevelFilter)}
              options={LEVEL_FILTER_OPTIONS}
              size="small"
            />
          </Space>
        )}
        styles={{ body: { padding: visiblePatterns.length === 0 ? 24 : 16 } }}
      >
        {error && !hasRetainedResult && (
          <Alert
            type="error"
            showIcon
            message="聚类分析加载失败"
            description={error}
            style={{ marginBottom: 16 }}
          />
        )}

        {staleResultVisible && (
          <Alert
            type="warning"
            showIcon
            message="当前结果为最近一次成功查询的数据"
            description={error}
            style={{ marginBottom: 16 }}
          />
        )}

        {fallbackInfo && (
          <Alert
            type="warning"
            showIcon
            message={fallbackInfo.label}
            description={fallbackInfo.description}
            style={{ marginBottom: 16 }}
          />
        )}

        {loading && result.patterns.length === 0 ? (
          <Card loading variant="borderless" styles={{ body: { padding: 0 } }} />
        ) : visiblePatterns.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="当前筛选条件下暂无聚类模式，请尝试调整时间范围、级别或关键词。"
          />
        ) : (
          <div className="flex flex-col gap-4">
            {visiblePatterns.map((pattern) => {
              const levelConfig = LEVEL_CONFIG[pattern.level] ?? LEVEL_CONFIG.info;
              return (
                <Card key={pattern.id} size="small">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-[280px]">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <Tag color={levelConfig.tagColor}>{levelConfig.label}</Tag>
                        <span className="text-xs" style={{ opacity: 0.55 }}>相似度 {pattern.similarity}%</span>
                        <span className="text-xs" style={{ opacity: 0.55 }}>首次出现 {formatDateTime(pattern.first_seen)}</span>
                        <span className="text-xs" style={{ opacity: 0.55 }}>最后出现 {formatDateTime(pattern.last_seen)}</span>
                      </div>

                      <div
                        className="font-mono text-sm break-all leading-relaxed p-3 rounded-lg"
                        style={{
                          backgroundColor: isDark ? 'rgba(0,0,0,0.22)' : 'rgba(0,0,0,0.03)',
                          border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                        }}
                      >
                        {renderTemplate(pattern.template)}
                      </div>

                      <div className="mt-3">
                        {renderTrendBars(pattern, isDark)}
                      </div>

                      {pattern.samples.length > 0 && (
                        <div className="mt-3 text-xs" style={{ opacity: 0.8 }}>
                          <div style={{ marginBottom: 8 }}>样本预览</div>
                          <div
                            className="font-mono rounded-lg p-3"
                            style={{
                              backgroundColor: isDark ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.02)',
                              border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                            }}
                          >
                            {renderSampleMessage(pattern.samples[0].message, pattern.samples[0])}
                          </div>
                        </div>
                      )}
                    </div>

                    <div style={{ width: 180, minWidth: 160 }}>
                      <Card size="small" styles={{ body: { padding: 12 } }}>
                        <Statistic title="出现次数" value={formatCount(pattern.occurrences)} valueStyle={{ fontSize: 24, color: levelConfig.color }} />
                      </Card>
                      <div className="flex flex-col gap-2 mt-3">
                        <Button type="primary" onClick={() => setSelectedPatternID(pattern.id)}>查看详情</Button>
                        <Button onClick={() => handleExcludePattern(pattern)}>隐藏模式</Button>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </Card>

      <Drawer
        title={selectedPattern ? '模式详情' : '模式详情'}
        open={Boolean(selectedPattern)}
        onClose={() => setSelectedPatternID(null)}
        width={560}
        footer={selectedPattern ? (
          <Space style={{ width: '100%' }}>
            <Button type="primary" block onClick={handleCreateAlert}>创建告警规则</Button>
            <Button block onClick={() => handleExcludePattern(selectedPattern)}>排除此模式</Button>
            <Button onClick={() => handleExportPattern(selectedPattern)} icon={<span className="material-symbols-outlined text-sm">download</span>} />
          </Space>
        ) : null}
      >
        {selectedPattern && (
          <div className="flex flex-col gap-4">
            <div
              className="p-3 rounded-lg font-mono text-sm break-all leading-relaxed"
              style={{
                backgroundColor: isDark ? 'rgba(0,0,0,0.22)' : 'rgba(0,0,0,0.03)',
                border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
              }}
            >
              {renderTemplate(selectedPattern.template)}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Card size="small">
                <Statistic title="出现次数" value={formatCount(selectedPattern.occurrences)} valueStyle={{ fontSize: 18 }} />
              </Card>
              <Card size="small">
                <Statistic title="相似度" value={selectedPattern.similarity} suffix="%" valueStyle={{ fontSize: 18 }} />
              </Card>
            </div>

            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="日志级别">{(LEVEL_CONFIG[selectedPattern.level] ?? LEVEL_CONFIG.info).label}</Descriptions.Item>
              <Descriptions.Item label="样本数量">{selectedPattern.samples.length}</Descriptions.Item>
              <Descriptions.Item label="首次出现">{formatDateTime(selectedPattern.first_seen)}</Descriptions.Item>
              <Descriptions.Item label="最后出现">{formatDateTime(selectedPattern.last_seen)}</Descriptions.Item>
            </Descriptions>

            <Tabs
              defaultActiveKey="samples"
              size="small"
              items={[
                {
                  key: 'samples',
                  label: '日志样本',
                  children: (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between text-xs mb-1" style={{ opacity: 0.55 }}>
                        <span>原始日志样本</span>
                        <span>显示 {selectedPattern.samples.length} / {formatCount(selectedPattern.occurrences)} 条</span>
                      </div>
                      {selectedPattern.samples.map((sample, index) => (
                        <div
                          key={`${selectedPattern.id}-sample-${index}`}
                          className="p-3 rounded-lg font-mono text-xs break-all"
                          style={{
                            backgroundColor: isDark ? 'rgba(0,0,0,0.22)' : 'rgba(0,0,0,0.03)',
                            border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                          }}
                        >
                          <div className="flex items-center justify-between mb-1.5 gap-4 flex-wrap">
                            <span style={{ opacity: 0.45 }}>{formatDateTime(sample.timestamp)}</span>
                            <Space size={4}>
                              {sample.host && <Tag style={{ margin: 0 }}>{sample.host}</Tag>}
                              {sample.service && <Tag style={{ margin: 0 }}>{sample.service}</Tag>}
                            </Space>
                          </div>
                          <div>{renderSampleMessage(sample.message, sample)}</div>
                        </div>
                      ))}
                    </div>
                  ),
                },
                {
                  key: 'variables',
                  label: '变量分析',
                  children: selectedVariableEntries.length === 0 ? (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该模式未提取到变量占位符。" />
                  ) : (
                    <div className="flex flex-col gap-3">
                      {selectedVariableEntries.map(([name, values]) => (
                        <Card
                          key={name}
                          size="small"
                          title={<span style={{ color: COLORS.primary }}>{`{${name}}`}</span>}
                          extra={<span className="text-xs" style={{ opacity: 0.55 }}>{values.length} 个唯一值</span>}
                        >
                          <div className="flex flex-wrap gap-1.5">
                            {values.map((value) => (
                              <Tag key={`${name}-${value}`} style={{ margin: 0 }}>
                                <span className="font-mono text-xs">{value}</span>
                              </Tag>
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
                      <div className="text-xs mb-2" style={{ opacity: 0.55 }}>模式出现频率趋势</div>
                      <div
                        className="p-4 rounded-lg"
                        style={{
                          backgroundColor: isDark ? 'rgba(0,0,0,0.22)' : 'rgba(0,0,0,0.03)',
                          border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                        }}
                      >
                        {renderTrendBars(selectedPattern, isDark, 120)}
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
