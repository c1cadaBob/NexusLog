import type { IngestAgentItem, PullSource } from '../../api/ingest';

interface PullSourceOverlapCandidate {
  agent_base_url?: string;
  path: string;
  status?: string;
}

function normalizeAgentBaseUrl(raw?: string): string {
  return (raw ?? '').trim().toLowerCase().replace(/\/+$/, '');
}

function splitSourcePathPatterns(raw: string): string[] {
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function hasWildcard(pattern: string): boolean {
  return pattern.includes('*') || pattern.includes('?') || pattern.includes('[');
}

function buildGlobRegExp(pattern: string): RegExp | null {
  let source = '^';

  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];

    if (char === '*') {
      source += '.*';
      continue;
    }
    if (char === '?') {
      source += '.';
      continue;
    }
    if (char === '[') {
      const closeIndex = pattern.indexOf(']', index + 1);
      if (closeIndex <= index + 1) {
        source += '\\[';
        continue;
      }
      const charClass = pattern.slice(index, closeIndex + 1);
      source += charClass;
      index = closeIndex;
      continue;
    }

    source += char.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&');
  }

  source += '$';

  try {
    return new RegExp(source);
  } catch {
    return null;
  }
}

function patternStaticPrefix(pattern: string): string {
  const index = pattern.search(/[*?\[]/);
  return index >= 0 ? pattern.slice(0, index) : pattern;
}

function patternOverlaps(left: string, right: string): boolean {
  const normalizedLeft = left.trim();
  const normalizedRight = right.trim();

  if (!normalizedLeft || !normalizedRight) {
    return true;
  }
  if (normalizedLeft === normalizedRight) {
    return true;
  }

  const leftHasWildcard = hasWildcard(normalizedLeft);
  const rightHasWildcard = hasWildcard(normalizedRight);

  if (!leftHasWildcard && !rightHasWildcard) {
    return false;
  }
  if (leftHasWildcard && !rightHasWildcard) {
    return buildGlobRegExp(normalizedLeft)?.test(normalizedRight) ?? false;
  }
  if (!leftHasWildcard && rightHasWildcard) {
    return buildGlobRegExp(normalizedRight)?.test(normalizedLeft) ?? false;
  }

  const leftPrefix = patternStaticPrefix(normalizedLeft);
  const rightPrefix = patternStaticPrefix(normalizedRight);
  if (!leftPrefix || !rightPrefix) {
    return true;
  }
  return leftPrefix.startsWith(rightPrefix) || rightPrefix.startsWith(leftPrefix);
}

export function pullSourcePathsOverlap(leftPath: string, rightPath: string): boolean {
  const leftPatterns = splitSourcePathPatterns(leftPath);
  const rightPatterns = splitSourcePathPatterns(rightPath);

  if (!leftPatterns.length || !rightPatterns.length) {
    return true;
  }

  return leftPatterns.some((left) => rightPatterns.some((right) => patternOverlaps(left, right)));
}

export function buildAgentOptionValue(agent: Pick<IngestAgentItem, 'agent_id' | 'agent_base_url'>): string {
  return `${agent.agent_id.trim()}@@${normalizeAgentBaseUrl(agent.agent_base_url)}`;
}

export function buildAgentOptionLabel(agent: IngestAgentItem): string {
  const primary = agent.hostname || agent.host || agent.agent_id || '未知 Agent';
  const endpoint = agent.agent_base_url?.trim() || '未上报 endpoint';
  const status = agent.live_connected ? `${agent.status} / 在线` : agent.status;
  return `${primary} · ${endpoint} (${status})`;
}

export function findOverlappingActivePullSource(
  existingSources: PullSource[],
  candidate: PullSourceOverlapCandidate,
): PullSource | null {
  if ((candidate.status ?? 'active').trim().toLowerCase() !== 'active') {
    return null;
  }

  const candidateIdentity = normalizeAgentBaseUrl(candidate.agent_base_url);
  if (!candidateIdentity) {
    return null;
  }

  return existingSources.find((source) => {
    if (source.status.trim().toLowerCase() !== 'active') {
      return false;
    }
    if (normalizeAgentBaseUrl(source.agent_base_url) !== candidateIdentity) {
      return false;
    }
    return pullSourcePathsOverlap(candidate.path, source.path);
  }) ?? null;
}

export function buildPullSourceOverlapMessage(conflict: PullSource | null): string {
  if (!conflict) {
    return '当前 Agent 地址下已存在启用中的采集源，且采集路径与当前配置重叠。请改用不同路径，或到“采集源管理”停用/编辑现有采集源后再保存。';
  }

  return `当前 Agent 地址下已存在启用中的采集源“${conflict.name}”，其路径“${conflict.path}”与当前配置重叠。请改用不同路径，或到“采集源管理”停用/编辑这条采集源后再保存。`;
}

export function buildPullSourceSavedAsPausedMessage(conflict: PullSource | null, savedSourceName: string): string {
  if (!conflict) {
    return `采集源配置 ${savedSourceName} 已按“待启用”状态保存。部署完成后，可到“采集源管理”检查并启用。`;
  }

  return `当前 Agent 地址与启用中的采集源“${conflict.name}”存在路径重叠，已将 ${savedSourceName} 按“待启用”状态保存。部署完成后，可到“采集源管理”检查并按需启用。`;
}
