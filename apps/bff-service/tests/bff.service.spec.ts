import { BffService } from "../src/bff/bff.service";
import { CacheService } from "../src/bff/cache.service";
import { RuntimeConfigService } from "../src/config/runtime-config";

describe("BffService", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("aggregates upstream responses and transforms summary", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ status: "ok", service: "mock" }),
    } as unknown as Response);

    const service = new BffService(new RuntimeConfigService(), new CacheService());
    const result = await service.aggregateOverview();

    expect(result.summary.total).toBe(5);
    expect(result.summary.healthy).toBe(5);
    expect(result.summary.availabilityRate).toBe(100);
    expect(result.cache.hit).toBe(false);
  });

  it("returns cached response on repeated call", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ status: "ok", service: "mock" }),
    } as unknown as Response);

    const service = new BffService(new RuntimeConfigService(), new CacheService());
    const first = await service.aggregateOverview();
    const second = await service.aggregateOverview();

    expect(first.cache.hit).toBe(false);
    expect(second.cache.hit).toBe(true);
  });
});
