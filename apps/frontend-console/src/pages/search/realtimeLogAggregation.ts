import type { AggregatedLogGroup, LogEntry } from '../../types/log';

const IMAGE_FILE_PATTERN = /([A-Za-z0-9_@%+=:,./-]+\.(?:png|jpe?g|gif|webp|svg|bmp|ico|avif))(?:\s*->\s*([A-Za-z0-9_@%+=:,./-]+\.(?:png|jpe?g|gif|webp|svg|bmp|ico|avif)))?/i;
const SYSLOG_ACTOR_PATTERN = /^[A-Z][a-z]{2}\s+\d+\s+\d{2}:\d{2}:\d{2}\s+\S+\s+([^:]+):/;
const MIN_IMAGE_BURST_SIZE = 3;

interface ImageAssetDescriptor {
  actor: string;
  directory: string;
  extension: string;
  fileName: string;
  path: string;
  timestampBucket: string;
}

function normalizeTimestampToSecond(timestamp: string): string {
  const parsed = Date.parse(timestamp);
  if (Number.isNaN(parsed)) {
    return String(timestamp ?? '').trim();
  }
  return new Date(parsed).toISOString().slice(0, 19);
}

function extractImageAssetDescriptor(log: LogEntry): ImageAssetDescriptor | null {
  const rawText = [log.message, log.rawLog].filter(Boolean).join('\n');
  const matched = rawText.match(IMAGE_FILE_PATTERN);
  const candidatePath = matched?.[1] ?? matched?.[2] ?? '';
  if (!candidatePath) {
    return null;
  }

  const normalizedPath = candidatePath.replace(/\\/g, '/').trim();
  const segments = normalizedPath.split('/').filter(Boolean);
  const fileName = segments.at(-1) ?? normalizedPath;
  const extension = fileName.includes('.') ? fileName.split('.').at(-1)?.toLowerCase() ?? '' : '';
  if (!fileName || !extension) {
    return null;
  }

  const directory = segments.slice(0, -1).join('/');
  const actor = rawText.match(SYSLOG_ACTOR_PATTERN)?.[1]?.trim() || log.service;
  return {
    actor,
    directory,
    extension,
    fileName,
    path: normalizedPath,
    timestampBucket: normalizeTimestampToSecond(log.timestamp),
  };
}

function buildImageBurstGroupKey(log: LogEntry, descriptor: ImageAssetDescriptor): string {
  return [
    descriptor.timestampBucket,
    log.level,
    log.service,
    log.host,
    log.hostIp,
    descriptor.actor,
    descriptor.directory,
    descriptor.extension,
  ].join('|');
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function formatDirectoryLabel(descriptor: ImageAssetDescriptor): string {
  if (!descriptor.directory) {
    return `*.${descriptor.extension}`;
  }
  const segments = descriptor.directory.split('/').filter(Boolean);
  const lastSegment = segments.at(-1) ?? descriptor.directory;
  return `${lastSegment}/*.${descriptor.extension}`;
}

function buildAggregatedSummary(descriptor: ImageAssetDescriptor, samplePaths: string[], count: number): string {
  const preview = uniqueStrings(samplePaths.map((path) => path.split('/').filter(Boolean).at(-1) ?? path)).slice(0, 3);
  const previewLabel = preview.length > 0 ? `，示例：${preview.join('、')}${count > preview.length ? ' 等' : ''}` : '';
  const actorLabel = descriptor.actor ? `${descriptor.actor} ` : '';
  return `${actorLabel}图片资源日志已聚合（${count} 条，${formatDirectoryLabel(descriptor)}${previewLabel}）`;
}

function buildAggregatedLogEntry(group: LogEntry[], descriptor: ImageAssetDescriptor): LogEntry {
  const first = group[0];
  const samplePaths = uniqueStrings(
    group
      .map((entry) => extractImageAssetDescriptor(entry)?.path ?? '')
      .filter(Boolean),
  );
  const summary = buildAggregatedSummary(descriptor, samplePaths, group.length);
  const aggregated: AggregatedLogGroup = {
    kind: 'image_asset_burst',
    count: group.length,
    summary,
    samplePaths,
    entries: group.map((entry) => ({
      id: entry.id,
      timestamp: entry.timestamp,
      message: entry.message,
      rawLog: entry.rawLog,
    })),
  };

  return {
    ...first,
    id: `aggregated:${descriptor.timestampBucket}:${first.id}`,
    message: summary,
    rawLog: group.map((entry) => entry.rawLog ?? entry.message).join('\n'),
    fields: {
      ...(first.fields ?? {}),
      aggregation_kind: aggregated.kind,
      aggregation_count: aggregated.count,
      aggregation_sample_paths: aggregated.samplePaths,
    },
    aggregated,
  };
}

export function aggregateRealtimeDisplayLogs(logs: LogEntry[]): LogEntry[] {
  const aggregatedLogs: LogEntry[] = [];
  let index = 0;

  while (index < logs.length) {
    const current = logs[index];
    const descriptor = extractImageAssetDescriptor(current);
    if (!descriptor) {
      aggregatedLogs.push(current);
      index += 1;
      continue;
    }

    const groupKey = buildImageBurstGroupKey(current, descriptor);
    const candidateGroup: LogEntry[] = [current];
    let nextIndex = index + 1;

    while (nextIndex < logs.length) {
      const nextLog = logs[nextIndex];
      const nextDescriptor = extractImageAssetDescriptor(nextLog);
      if (!nextDescriptor) {
        break;
      }
      if (buildImageBurstGroupKey(nextLog, nextDescriptor) !== groupKey) {
        break;
      }
      candidateGroup.push(nextLog);
      nextIndex += 1;
    }

    if (candidateGroup.length >= MIN_IMAGE_BURST_SIZE) {
      aggregatedLogs.push(buildAggregatedLogEntry(candidateGroup, descriptor));
    } else {
      aggregatedLogs.push(...candidateGroup);
    }
    index = nextIndex;
  }

  return aggregatedLogs;
}

export function summarizeImageAggregation(logs: LogEntry[]): { groupedRows: number; hiddenRows: number } {
  return logs.reduce(
    (summary, log) => {
      if (!log.aggregated) {
        return summary;
      }
      summary.groupedRows += 1;
      summary.hiddenRows += Math.max(0, log.aggregated.count - 1);
      return summary;
    },
    { groupedRows: 0, hiddenRows: 0 },
  );
}
