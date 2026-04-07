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
    global.fetch = jest.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("control-plane") && url.endsWith("/api/v1/health")) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            status: "healthy",
            service: "control-plane",
            components: {
              operational_es_reconciler: { state: "healthy" },
            },
          }),
        } as unknown as Response;
      }
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ status: "ok", service: "mock" }),
      } as unknown as Response;
    });

    const service = new BffService(new RuntimeConfigService(), new CacheService());
    const result = await service.aggregateOverview();

    expect(result.summary.total).toBe(5);
    expect(result.summary.healthy).toBe(5);
    expect(result.summary.availabilityRate).toBe(100);
    expect(result.services.controlPlane.details).toContain("reconciler:healthy");
    expect(result.cache.hit).toBe(false);
  });

  it("marks degraded control-plane health when reconciler is degraded", async () => {
    global.fetch = jest.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("control-plane") && url.endsWith("/api/v1/health")) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            status: "degraded",
            service: "control-plane",
            components: {
              operational_es_reconciler: { state: "degraded" },
            },
          }),
        } as unknown as Response;
      }
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ status: "healthy", service: "mock" }),
      } as unknown as Response;
    });

    const service = new BffService(new RuntimeConfigService(), new CacheService());
    const result = await service.aggregateOverview();

    expect(result.services.controlPlane.status).toBe("degraded");
    expect(result.services.controlPlane.available).toBe(false);
    expect(result.summary.healthy).toBe(4);
    expect(result.summary.degraded).toBe(1);
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
