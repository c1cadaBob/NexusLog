import { beforeEach, describe, expect, it } from 'vitest';
import { AUTH_PERSIST_KEY, deriveDeterministicUUID, resolveStoredAuthUserID } from '../src/utils/authStorage';

const localStorageMock = (() => {
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
  };
})();

const sessionStorageMock = (() => {
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
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  configurable: true,
});
Object.defineProperty(globalThis, 'sessionStorage', {
  value: sessionStorageMock,
  configurable: true,
});
Object.defineProperty(globalThis, 'window', {
  value: { localStorage: localStorageMock, sessionStorage: sessionStorageMock },
  configurable: true,
});

describe('authStorage identity helpers', () => {
  beforeEach(() => {
    localStorageMock.clear();
    sessionStorageMock.clear();
  });

  it('keeps a persisted UUID user id unchanged', () => {
    localStorageMock.setItem(
      AUTH_PERSIST_KEY,
      JSON.stringify({
        state: {
          user: {
            id: '11111111-2222-3333-4444-555555555555',
            username: 'demo-user',
          },
        },
        version: 0,
      }),
    );

    expect(resolveStoredAuthUserID()).toBe('11111111-2222-3333-4444-555555555555');
  });

  it('derives a UUID from legacy non-UUID emergency user ids', () => {
    localStorageMock.setItem(
      AUTH_PERSIST_KEY,
      JSON.stringify({
        state: {
          user: {
            id: 'emergency-demo',
            username: 'demo-user',
          },
        },
        version: 0,
      }),
    );

    expect(resolveStoredAuthUserID()).toBe(deriveDeterministicUUID('nexuslog-user:emergency-demo'));
  });
});
