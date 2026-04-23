/* @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/config/runtime-config', () => ({
  getRuntimeConfig: () => ({
    apiBaseUrl: '/api/v1',
    tenantId: '11111111-1111-1111-1111-111111111111',
  }),
}));

vi.mock('../src/utils/authStorage', () => ({
  getAuthStorageItem: vi.fn((key: string) => (key === 'nexuslog-access-token' ? 'test-access-token' : '')),
  resolveStoredAuthUserID: vi.fn(() => '11111111-1111-1111-1111-111111111111'),
}));

describe('deletePullSource timeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
    window.localStorage.setItem('nexuslog-tenant-id', '11111111-1111-1111-1111-111111111111');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('aborts stuck delete requests after 15 seconds', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        reject(new DOMException('The operation was aborted.', 'AbortError'));
      }, { once: true });
    }));
    vi.stubGlobal('fetch', fetchMock);

    const { deletePullSource } = await import('../src/api/ingest');
    const deletionPromise = deletePullSource('source-timeout-test');
    const timeoutExpectation = expect(deletionPromise).rejects.toMatchObject({
      code: 'INGEST_API_TIMEOUT',
      message: 'ingest api request timed out after 15s',
    });

    await vi.advanceTimersByTimeAsync(15_000);
    await timeoutExpectation;

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/ingest/pull-sources/source-timeout-test',
      expect.objectContaining({
        method: 'DELETE',
        signal: expect.any(AbortSignal),
      }),
    );
    const signal = fetchMock.mock.calls[0]?.[1]?.signal as AbortSignal;
    expect(signal.aborted).toBe(true);
  });
});
