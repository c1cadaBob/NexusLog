import type { AggregateBucket } from '../../api/query';

export interface RealtimeHistogramPoint {
  key: string;
  time: string;
  normal: number;
  error: number;
}

function normalizeBucketKey(raw: string): string {
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return raw;
  }
  date.setSeconds(0, 0);
  return date.toISOString().slice(0, 16);
}

function formatBucketTime(raw: string): string {
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return raw;
  }
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

export function buildRealtimeHistogramData(
  totalBuckets: AggregateBucket[],
  errorBuckets: AggregateBucket[],
): RealtimeHistogramPoint[] {
  const points = new Map<string, RealtimeHistogramPoint>();

  totalBuckets.forEach((bucket) => {
    const key = normalizeBucketKey(bucket.key);
    points.set(key, {
      key,
      time: formatBucketTime(bucket.key),
      normal: Math.max(0, Number(bucket.count) || 0),
      error: 0,
    });
  });

  errorBuckets.forEach((bucket) => {
    const key = normalizeBucketKey(bucket.key);
    const current = points.get(key) ?? {
      key,
      time: formatBucketTime(bucket.key),
      normal: 0,
      error: 0,
    };
    const total = current.normal + current.error;
    const error = Math.max(0, Number(bucket.count) || 0);
    current.error = Math.min(total, error);
    current.normal = Math.max(0, total - current.error);
    points.set(key, current);
  });

  return Array.from(points.values()).sort((left, right) => left.key.localeCompare(right.key));
}

export function sumRealtimeHistogramEvents(points: RealtimeHistogramPoint[]): number {
  return points.reduce((sum, point) => sum + point.normal + point.error, 0);
}
