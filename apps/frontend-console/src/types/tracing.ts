export interface Trace {
  id: string;
  rootService: string;
  endpoint: string;
  duration: number;
  spans: number;
  timestamp: string;
  status: 'Success' | 'Error';
}

export interface Span {
  id: string;
  parentId?: string;
  service: string;
  operation: string;
  duration: number;
  startOffset: number;
  status: 'success' | 'error';
  depth: number;
  tags?: Record<string, string>;
  error?: { message: string; stack: string };
}

export interface ServiceNode {
  id: string;
  name: string;
  type: 'gateway' | 'service' | 'database' | 'cache';
  protocol: string;
  status: 'healthy' | 'warning' | 'critical';
  metrics: { latency: number; rpm: number; errorRate: number };
}
