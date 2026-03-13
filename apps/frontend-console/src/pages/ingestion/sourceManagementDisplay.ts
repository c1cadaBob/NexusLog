import type { PullSource } from '../../api/ingest';

export type SourceDisplayType = 'File / Log' | 'HTTP' | 'Syslog' | 'TCP';

function normalizeText(value: string | null | undefined): string {
  return String(value ?? '').trim();
}

export function compactSourceID(sourceID: string): string {
  const normalized = normalizeText(sourceID);
  if (normalized.length <= 18) {
    return normalized;
  }
  return `${normalized.slice(0, 8)}…${normalized.slice(-8)}`;
}

export function splitSourcePaths(path: string): string[] {
  return normalizeText(path)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function looksLikeFilesystemPath(path: string): boolean {
  const normalized = normalizeText(path);
  if (!normalized) {
    return false;
  }
  return normalized.startsWith('./')
    || normalized.startsWith('../')
    || normalized.startsWith('~/')
    || /(^|,)\s*\/var\/log\//i.test(normalized)
    || /(^|,)\s*\/host-/i.test(normalized)
    || /(^|,)\s*\/tmp\//i.test(normalized)
    || /\*\.log\b/i.test(normalized)
    || /\.log\b/i.test(normalized)
    || /\*\/\*[-_a-z0-9]*json\.log\b/i.test(normalized);
}

export function inferSourceDisplayType(source: Pick<PullSource, 'protocol' | 'path'>): SourceDisplayType {
  const protocol = normalizeText(source.protocol).toLowerCase();
  if (protocol === 'syslog_tcp' || protocol === 'syslog_udp') {
    return 'Syslog';
  }
  if (protocol === 'tcp') {
    return 'TCP';
  }
  if (protocol === 'ssh' || protocol === 'sftp') {
    return 'File / Log';
  }
  if (looksLikeFilesystemPath(source.path)) {
    return 'File / Log';
  }
  return 'HTTP';
}

export function sourceDisplayTypeToFilterGroup(source: Pick<PullSource, 'protocol' | 'path'>): string {
  const displayType = inferSourceDisplayType(source);
  if (displayType === 'File / Log') {
    return 'File';
  }
  return displayType;
}

export function getSourceDisplayIcon(source: Pick<PullSource, 'protocol' | 'path'>): string {
  const displayType = inferSourceDisplayType(source);
  if (displayType === 'File / Log') {
    return 'description';
  }
  if (displayType === 'Syslog') {
    return 'dns';
  }
  if (displayType === 'TCP') {
    return 'cable';
  }
  return 'public';
}

export function summarizeSourcePath(path: string): { label: string; extraCount: number; fullText: string } {
  const paths = splitSourcePaths(path);
  if (paths.length === 0) {
    return { label: '—', extraCount: 0, fullText: '—' };
  }
  return {
    label: paths[0],
    extraCount: Math.max(0, paths.length - 1),
    fullText: paths.join('\n'),
  };
}
