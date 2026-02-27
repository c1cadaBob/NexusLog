import { Injectable } from "@nestjs/common";

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface CacheResult<T> {
  value: T;
  cacheHit: boolean;
}

@Injectable()
export class CacheService {
  private readonly store = new Map<string, CacheEntry<unknown>>();
  private readonly maxEntries = 1000;

  async getOrSet<T>(key: string, ttlMs: number, loader: () => Promise<T>, forceRefresh = false): Promise<CacheResult<T>> {
    const now = Date.now();
    const current = this.store.get(key) as CacheEntry<T> | undefined;

    if (!forceRefresh && current && current.expiresAt > now) {
      return { value: current.value, cacheHit: true };
    }

    const loaded = await loader();
    this.store.set(key, {
      value: loaded,
      expiresAt: now + ttlMs,
    });
    this.evictIfNeeded();
    return { value: loaded, cacheHit: false };
  }

  private evictIfNeeded(): void {
    if (this.store.size <= this.maxEntries) {
      return;
    }
    const keys = this.store.keys();
    const first = keys.next();
    if (!first.done) {
      this.store.delete(first.value);
    }
  }
}
