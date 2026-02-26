export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  service: string;
  message: string;
  fields?: Record<string, unknown>;
  /** 原始日志文本 */
  rawLog?: string;
}

export interface SavedQuery {
  id: string;
  name: string;
  query: string;
  tags: string[];
  createdAt: string;
}

export interface QueryHistory {
  id: string;
  query: string;
  executedAt: string;
  duration: number;
  resultCount: number;
}
