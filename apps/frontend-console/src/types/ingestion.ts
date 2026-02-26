export interface DataSource {
  id: string;
  name: string;
  type: 'Kafka' | 'File' | 'HTTP' | 'Syslog';
  index: string;
  volume: string;
  status: 'Running' | 'Paused' | 'Error';
  health: 'Healthy' | 'Error' | 'Neutral';
  createdAt: string;
  description?: string;
}

export interface DataSourceFormData {
  name: string;
  type: 'Kafka' | 'File' | 'HTTP' | 'Syslog';
  index: string;
  description: string;
}

export interface Agent {
  id: string;
  ip: string;
  hostname: string;
  version: string;
  cpu: number;
  mem: number;
  throughput: string;
  status: 'Online' | 'Offline' | 'High Load';
  hasUpdate: boolean;
  lastSeen: string;
  config: AgentConfig;
}

export interface AgentConfig {
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  maxCpu: number;
  maxMem: number;
  batchSize: number;
  flushInterval: number;
}

export interface SourceStatusData {
  id: string;
  name: string;
  type: 'Kafka' | 'HTTP' | 'File' | 'Syslog';
  status: 'Running' | 'Lagging' | 'Disconnected';
  eps: string;
  latency: string;
  lag: string;
  health: 'Healthy' | 'Warning' | 'Error';
}

export type SourceType = 'java' | 'nginx' | 'kubernetes' | 'mysql' | 'custom' | 'syslog' | 'docker' | null;

export interface WizardStep {
  id: number;
  title: string;
  description: string;
}

export interface SourceConfig {
  sourceType: SourceType;
  sourceName: string;
  targetIndex: string;
  description: string;
}

export interface WizardAgentConfig {
  agentId: string;
  logPath: string;
  encoding: string;
  multiline: boolean;
  multilinePattern: string;
}

export interface ParsingConfig {
  parserType: 'json' | 'regex' | 'grok' | 'csv' | 'none';
  timestampField: string;
  timestampFormat: string;
  customPattern: string;
}
