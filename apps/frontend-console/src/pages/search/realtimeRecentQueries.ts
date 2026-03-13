const RECENT_QUERY_STORAGE_KEY = 'nexuslog-realtime-recent-queries';
const MAX_RECENT_QUERIES = 5;

export const DEFAULT_RECENT_QUERIES = [
  'level:error AND service:payment',
  'status:500',
  'service:order-api',
  'message:"timeout"',
  'level:warn',
] as const;

function normalizeRecentQueries(input: Iterable<string>): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const candidate of input) {
    const value = candidate.trim();
    if (!value || seen.has(value)) {
      continue;
    }
    seen.add(value);
    normalized.push(value);
    if (normalized.length >= MAX_RECENT_QUERIES) {
      break;
    }
  }

  return normalized;
}

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readStoredRecentQueries(): string[] {
  if (!canUseStorage()) {
    return [...DEFAULT_RECENT_QUERIES];
  }

  try {
    const raw = window.localStorage.getItem(RECENT_QUERY_STORAGE_KEY)?.trim();
    if (!raw) {
      return [...DEFAULT_RECENT_QUERIES];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [...DEFAULT_RECENT_QUERIES];
    }
    const normalized = normalizeRecentQueries(parsed.filter((item): item is string => typeof item === 'string'));
    return normalized.length > 0 ? normalized : [...DEFAULT_RECENT_QUERIES];
  } catch {
    return [...DEFAULT_RECENT_QUERIES];
  }
}

function writeStoredRecentQueries(queries: string[]): void {
  if (!canUseStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(RECENT_QUERY_STORAGE_KEY, JSON.stringify(normalizeRecentQueries(queries)));
  } catch {
    // ignore storage write failures
  }
}

export function readRealtimeRecentQueries(): string[] {
  return readStoredRecentQueries();
}

export function recordRealtimeRecentQuery(query: string): string[] {
  const trimmedQuery = query.trim();
  const current = readStoredRecentQueries();
  if (!trimmedQuery) {
    return current;
  }

  const next = normalizeRecentQueries([trimmedQuery, ...current]);
  writeStoredRecentQueries(next);
  return next;
}

export function clearRealtimeRecentQueries(): void {
  if (!canUseStorage()) {
    return;
  }

  try {
    window.localStorage.removeItem(RECENT_QUERY_STORAGE_KEY);
  } catch {
    // ignore storage cleanup failures
  }
}
