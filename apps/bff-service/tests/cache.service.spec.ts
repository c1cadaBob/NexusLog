import { CacheService } from "../src/bff/cache.service";

describe("CacheService", () => {
  it("returns cached value before TTL expires", async () => {
    const cache = new CacheService();
    let count = 0;

    const loader = async () => {
      count += 1;
      return { value: count };
    };

    const first = await cache.getOrSet("k", 5000, loader);
    const second = await cache.getOrSet("k", 5000, loader);

    expect(first.cacheHit).toBe(false);
    expect(second.cacheHit).toBe(true);
    expect(second.value.value).toBe(1);
  });

  it("can force refresh cache", async () => {
    const cache = new CacheService();
    let count = 0;

    const loader = async () => {
      count += 1;
      return { value: count };
    };

    await cache.getOrSet("k", 5000, loader);
    const refreshed = await cache.getOrSet("k", 5000, loader, true);

    expect(refreshed.cacheHit).toBe(false);
    expect(refreshed.value.value).toBe(2);
  });
});
