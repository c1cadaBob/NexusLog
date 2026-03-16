const REALTIME_STARTUP_QUERY_STORAGE_KEY = 'nexuslog-realtime-startup-query';
const STARTUP_QUERY_MAX_AGE_MS = 60_000;

interface PendingRealtimeStartupQuery {
  presetQuery?: string;
  createdAt?: number;
}

function canUseSessionStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

export function persistPendingRealtimeStartupQuery(presetQuery: string): void {
  const normalizedQuery = presetQuery.trim();
  if (!normalizedQuery || !canUseSessionStorage()) {
    return;
  }

  try {
    window.sessionStorage.setItem(
      REALTIME_STARTUP_QUERY_STORAGE_KEY,
      JSON.stringify({
        presetQuery: normalizedQuery,
        createdAt: Date.now(),
      } satisfies PendingRealtimeStartupQuery),
    );
  } catch {
    // ignore storage write failures
  }
}

export function readPendingRealtimeStartupQuery(): string {
  if (!canUseSessionStorage()) {
    return '';
  }

  try {
    const raw = window.sessionStorage.getItem(REALTIME_STARTUP_QUERY_STORAGE_KEY)?.trim();
    if (!raw) {
      return '';
    }

    const parsed = JSON.parse(raw) as PendingRealtimeStartupQuery;
    const presetQuery = parsed?.presetQuery?.trim() ?? '';
    const createdAt = Number(parsed?.createdAt ?? 0);
    const isExpired = !Number.isFinite(createdAt) || Date.now() - createdAt > STARTUP_QUERY_MAX_AGE_MS;
    if (!presetQuery || isExpired) {
      window.sessionStorage.removeItem(REALTIME_STARTUP_QUERY_STORAGE_KEY);
      return '';
    }

    return presetQuery;
  } catch {
    return '';
  }
}

export function clearPendingRealtimeStartupQuery(): void {
  if (!canUseSessionStorage()) {
    return;
  }

  try {
    window.sessionStorage.removeItem(REALTIME_STARTUP_QUERY_STORAGE_KEY);
  } catch {
    // ignore storage cleanup failures
  }
}
