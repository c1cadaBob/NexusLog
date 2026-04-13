// ============================================================================
// 索引管理类型
// ============================================================================

export type IndexHealth = 'Green' | 'Yellow' | 'Red' | 'Unknown';
export type IndexStatus = 'Open' | 'Closed';

export interface IndexInfo {
  name: string;
  health: IndexHealth;
  status: IndexStatus;
  shards: string;
  docs: string;
  size: string;
  primaryShards: number;
  replicaShards: number;
  docsCount: number;
  storeSizeBytes: number;
}

export interface IndexSummary {
  total: number;
  green: number;
  yellow: number;
  red: number;
  docsCount: number;
  storeSizeBytes: number;
  refreshedAt?: number;
}

export const INDEX_HEALTH_CONFIG: Record<IndexHealth, { color: string; label: string }> = {
  Green: { color: '#10b981', label: 'Green' },
  Yellow: { color: '#f59e0b', label: 'Yellow' },
  Red: { color: '#ef4444', label: 'Red' },
  Unknown: { color: '#6b7280', label: 'Unknown' },
};

// ============================================================================
// 生命周期策略类型
// ============================================================================

export type PolicyStatus = 'Active' | 'Error' | 'Disabled';
export type LifecyclePhase = 'Hot' | 'Warm' | 'Cold' | 'Delete';

export interface PhaseTransition {
  from: LifecyclePhase;
  to: LifecyclePhase;
  condition: string;
}

export interface LifecyclePolicyItem {
  name: string;
  status: PolicyStatus;
  indexCount: number;
  updatedAgo: string;
  phases: PhaseTransition[];
  lastRunStatus: 'Success' | 'Failed';
  lastRunMessage?: string;
}

// ============================================================================
// 备份恢复类型
// ============================================================================

export type BackupTaskStatus = 'running' | 'idle' | 'paused' | 'failed';
export type RepositoryType = 'S3' | 'HDFS' | 'NFS';

export interface BackupTask {
  id: string;
  name: string;
  indices: string;
  repoType: RepositoryType;
  repoName: string;
  cron: string;
  lastRun: string;
  status: BackupTaskStatus;
  icon: string;
  iconColor: string;
}

export interface SnapshotItem {
  id: string;
  createdAt: string;
  indices: string;
  extraCount?: number;
  size: string;
}

// ============================================================================
// 容量监控类型
// ============================================================================

export interface GrowthDataPoint {
  day: string;
  value: number | null;
  predict: number | null;
}

export interface TopIndexItem {
  name: string;
  category: string;
  size: string;
  percent: number;
}
