import { createJSONStorage, type StateStorage } from 'zustand/middleware';

export const ACCESS_TOKEN_KEY = 'nexuslog-access-token';
export const REFRESH_TOKEN_KEY = 'nexuslog-refresh-token';
export const TOKEN_EXPIRES_AT_KEY = 'nexuslog-token-expires-at';
export const AUTH_PERSIST_KEY = 'nexuslog-auth';
export const EMERGENCY_ACCESS_TOKEN_PREFIX = 'emergency-access-';
const AUTH_STORAGE_SCOPE_KEY = 'nexuslog-auth-storage-scope';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AuthStorageScope = 'local' | 'session';

const AUTH_SESSION_KEYS = [
  AUTH_PERSIST_KEY,
  ACCESS_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  TOKEN_EXPIRES_AT_KEY,
  AUTH_STORAGE_SCOPE_KEY,
] as const;

function getStorage(scope: AuthStorageScope): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return scope === 'local' ? window.localStorage : window.sessionStorage;
}

function readStorageValue(scope: AuthStorageScope, key: string): string | null {
  try {
    return getStorage(scope)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function removeStorageValue(scope: AuthStorageScope, key: string): void {
  try {
    getStorage(scope)?.removeItem(key);
  } catch {
    // ignore storage cleanup failures
  }
}

function writeStorageValue(scope: AuthStorageScope, key: string, value: string): void {
  try {
    getStorage(scope)?.setItem(key, value);
  } catch {
    // ignore storage write failures
  }
}

function getFallbackScope(scope: AuthStorageScope): AuthStorageScope {
  return scope === 'local' ? 'session' : 'local';
}

export function resolveAuthStorageScope(): AuthStorageScope {
  const localScope = readStorageValue('local', AUTH_STORAGE_SCOPE_KEY)?.trim();
  if (localScope === 'local') {
    return 'local';
  }

  const sessionScope = readStorageValue('session', AUTH_STORAGE_SCOPE_KEY)?.trim();
  if (sessionScope === 'session') {
    return 'session';
  }

  if (readStorageValue('local', ACCESS_TOKEN_KEY) || readStorageValue('local', AUTH_PERSIST_KEY)) {
    return 'local';
  }

  if (readStorageValue('session', ACCESS_TOKEN_KEY) || readStorageValue('session', AUTH_PERSIST_KEY)) {
    return 'session';
  }

  return 'local';
}

export function setActiveAuthStorageScope(scope: AuthStorageScope): void {
  writeStorageValue(scope, AUTH_STORAGE_SCOPE_KEY, scope);
  removeStorageValue(getFallbackScope(scope), AUTH_STORAGE_SCOPE_KEY);
}

export function getAuthStorageItem(key: string): string | null {
  const activeScope = resolveAuthStorageScope();
  const activeValue = readStorageValue(activeScope, key);
  if (activeValue !== null) {
    return activeValue;
  }

  return readStorageValue(getFallbackScope(activeScope), key);
}

export function clearAuthStorage(): void {
  (['local', 'session'] as const).forEach((scope) => {
    AUTH_SESSION_KEYS.forEach((key) => removeStorageValue(scope, key));
  });
}

export function isEmergencyAccessToken(token: string | null | undefined): boolean {
  return typeof token === 'string' && token.startsWith(EMERGENCY_ACCESS_TOKEN_PREFIX);
}

export function deriveDeterministicUUID(seed: string): string {
  const normalized = seed.trim().toLowerCase() || 'nexuslog-user';
  let hashA = 0x811c9dc5;
  let hashB = 0x9e3779b1;
  let hashC = 0x85ebca6b;
  let hashD = 0xc2b2ae35;

  for (let index = 0; index < normalized.length; index += 1) {
    const code = normalized.charCodeAt(index);
    hashA = Math.imul(hashA ^ code, 16777619);
    hashB = Math.imul(hashB ^ (code + index), 2246822519);
    hashC = Math.imul(hashC ^ (code + 17), 3266489917);
    hashD = Math.imul(hashD ^ (code + 31), 668265263);
  }

  const hex = [hashA, hashB, hashC, hashD]
    .map((value) => (value >>> 0).toString(16).padStart(8, '0'))
    .join('');

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

interface PersistedAuthSnapshot {
  state?: {
    user?: {
      id?: string;
      username?: string;
    } | null;
  } | null;
}

export function resolveStoredAuthUserID(): string {
  const raw = getAuthStorageItem(AUTH_PERSIST_KEY)?.trim();
  if (!raw) {
    return '';
  }

  try {
    const parsed = JSON.parse(raw) as PersistedAuthSnapshot;
    const user = parsed?.state?.user;
    const directID = user?.id?.trim() ?? '';
    if (UUID_PATTERN.test(directID)) {
      return directID;
    }
    const fallbackSeed = directID || user?.username?.trim() || '';
    if (!fallbackSeed) {
      return '';
    }
    return deriveDeterministicUUID(`nexuslog-user:${fallbackSeed}`);
  } catch {
    return '';
  }
}

function writeAuthSessionTokens(
  scope: AuthStorageScope,
  params: {
    accessToken: string;
    refreshToken: string;
    expiresAtMs: number;
  },
): void {
  setActiveAuthStorageScope(scope);
  writeStorageValue(scope, ACCESS_TOKEN_KEY, params.accessToken);
  writeStorageValue(scope, REFRESH_TOKEN_KEY, params.refreshToken);
  writeStorageValue(scope, TOKEN_EXPIRES_AT_KEY, String(params.expiresAtMs));
  const fallbackScope = getFallbackScope(scope);
  removeStorageValue(fallbackScope, ACCESS_TOKEN_KEY);
  removeStorageValue(fallbackScope, REFRESH_TOKEN_KEY);
  removeStorageValue(fallbackScope, TOKEN_EXPIRES_AT_KEY);
}

export function persistAuthSession(params: {
  accessToken: string;
  refreshToken: string;
  expiresAtMs: number;
  remember: boolean;
}): void {
  const scope: AuthStorageScope = params.remember ? 'local' : 'session';
  clearAuthStorage();
  writeAuthSessionTokens(scope, params);
}

export function persistRefreshedAuthSession(params: {
  accessToken: string;
  refreshToken: string;
  expiresAtMs: number;
}): void {
  const scope = resolveAuthStorageScope();
  writeAuthSessionTokens(scope, params);
}

const authStateStorage: StateStorage = {
  getItem: (name) => {
    const localValue = readStorageValue('local', name);
    if (localValue !== null) {
      return localValue;
    }

    return readStorageValue('session', name);
  },
  setItem: (name, value) => {
    const scope = resolveAuthStorageScope();
    writeStorageValue(scope, name, value);
    removeStorageValue(getFallbackScope(scope), name);
  },
  removeItem: (name) => {
    removeStorageValue('local', name);
    removeStorageValue('session', name);
  },
};

export const authPersistStorage = createJSONStorage(() => authStateStorage);
