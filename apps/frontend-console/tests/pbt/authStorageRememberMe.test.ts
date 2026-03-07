import { beforeEach, describe, expect, it } from 'vitest';
import {
  ACCESS_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  TOKEN_EXPIRES_AT_KEY,
  clearAuthStorage,
  getAuthStorageItem,
  persistAuthSession,
  resolveAuthStorageScope,
} from '../../src/utils/authStorage';

type StorageMock = Storage & {
  clear: () => void;
};

function createStorageMock(): StorageMock {
  const storage = new Map<string, string>();

  return {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
    clear: () => {
      storage.clear();
    },
    key: (index: number) => Array.from(storage.keys())[index] ?? null,
    get length() {
      return storage.size;
    },
  } as StorageMock;
}

const localStorageMock = createStorageMock();
const sessionStorageMock = createStorageMock();

Object.defineProperty(globalThis, 'window', {
  value: {
    localStorage: localStorageMock,
    sessionStorage: sessionStorageMock,
  },
  configurable: true,
});

describe('authStorage remember-me persistence', () => {
  beforeEach(() => {
    localStorageMock.clear();
    sessionStorageMock.clear();
    clearAuthStorage();
  });

  it('stores auth tokens in sessionStorage when remember is disabled', () => {
    persistAuthSession({
      accessToken: 'session-access',
      refreshToken: 'session-refresh',
      expiresAtMs: 1700000000000,
      remember: false,
    });

    expect(resolveAuthStorageScope()).toBe('session');
    expect(sessionStorageMock.getItem(ACCESS_TOKEN_KEY)).toBe('session-access');
    expect(sessionStorageMock.getItem(REFRESH_TOKEN_KEY)).toBe('session-refresh');
    expect(sessionStorageMock.getItem(TOKEN_EXPIRES_AT_KEY)).toBe('1700000000000');
    expect(localStorageMock.getItem(ACCESS_TOKEN_KEY)).toBeNull();
    expect(getAuthStorageItem(ACCESS_TOKEN_KEY)).toBe('session-access');
  });

  it('stores auth tokens in localStorage when remember is enabled', () => {
    persistAuthSession({
      accessToken: 'local-access',
      refreshToken: 'local-refresh',
      expiresAtMs: 1800000000000,
      remember: true,
    });

    expect(resolveAuthStorageScope()).toBe('local');
    expect(localStorageMock.getItem(ACCESS_TOKEN_KEY)).toBe('local-access');
    expect(localStorageMock.getItem(REFRESH_TOKEN_KEY)).toBe('local-refresh');
    expect(localStorageMock.getItem(TOKEN_EXPIRES_AT_KEY)).toBe('1800000000000');
    expect(sessionStorageMock.getItem(ACCESS_TOKEN_KEY)).toBeNull();
    expect(getAuthStorageItem(ACCESS_TOKEN_KEY)).toBe('local-access');
  });
});
