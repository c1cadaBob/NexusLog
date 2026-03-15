export interface KpiData {
  title: string;
  value: string;
  trend: string;
  trendType: 'up' | 'down' | 'neutral';
  trendLabel: string;
  icon: string;
  color: 'primary' | 'success' | 'warning' | 'danger' | 'info';
}

export interface ServiceStatus {
  name: string;
  source?: string;
  host?: string;
  service?: string;
  errorRate: number;
  status: 'critical' | 'warning' | 'healthy';
}

export interface AuditLog {
  time: string;
  user: string;
  action: string;
  target: string;
  type: 'update' | 'create' | 'delete';
}
