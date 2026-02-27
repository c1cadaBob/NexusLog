import { Injectable } from "@nestjs/common";
import { RuntimeConfigService } from "../config/runtime-config";
import { CacheService } from "./cache.service";

interface ServiceProbe {
  service: string;
  upstream: string;
  available: boolean;
  latencyMs: number;
  statusCode: number;
  status: string;
  details: string;
}

interface AggregatePayload {
  generatedAt: string;
  services: {
    controlPlane: ServiceProbe;
    apiService: ServiceProbe;
    dataServices: {
      queryApi: ServiceProbe;
      auditApi: ServiceProbe;
      exportApi: ServiceProbe;
    };
  };
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    availabilityRate: number;
  };
}

@Injectable()
export class BffService {
  constructor(
    private readonly runtimeConfig: RuntimeConfigService,
    private readonly cacheService: CacheService,
  ) {}

  async aggregateOverview(forceRefresh = false): Promise<AggregatePayload & { cache: { hit: boolean; ttlMs: number } }> {
    const cfg = this.runtimeConfig.config;
    const cache = await this.cacheService.getOrSet(
      "overview:default",
      cfg.cacheTtlMs,
      async () => this.buildOverview(),
      forceRefresh,
    );

    return {
      ...cache.value,
      cache: {
        hit: cache.cacheHit,
        ttlMs: cfg.cacheTtlMs,
      },
    };
  }

  private async buildOverview(): Promise<AggregatePayload> {
    const cfg = this.runtimeConfig.config;

    const [controlPlane, apiService, queryApi, auditApi, exportApi] = await Promise.all([
      this.probe("control-plane", cfg.controlPlaneBaseUrl),
      this.probe("api-service", cfg.apiServiceBaseUrl),
      this.probe("query-api", cfg.dataQueryBaseUrl),
      this.probe("audit-api", cfg.dataAuditBaseUrl),
      this.probe("export-api", cfg.dataExportBaseUrl),
    ]);

    const all = [controlPlane, apiService, queryApi, auditApi, exportApi];
    const healthy = all.filter((it) => it.available).length;
    const total = all.length;

    return {
      generatedAt: new Date().toISOString(),
      services: {
        controlPlane,
        apiService,
        dataServices: {
          queryApi,
          auditApi,
          exportApi,
        },
      },
      summary: {
        total,
        healthy,
        degraded: total - healthy,
        availabilityRate: Number(((healthy / total) * 100).toFixed(2)),
      },
    };
  }

  private async probe(service: string, upstream: string): Promise<ServiceProbe> {
    const startedAt = Date.now();
    const timeoutMs = this.runtimeConfig.config.requestTimeoutMs;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${upstream.replace(/\/$/, "")}/healthz`, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      const latencyMs = Date.now() - startedAt;
      const text = await response.text();
      const details = this.transformDetails(text);
      return {
        service,
        upstream,
        available: response.ok,
        latencyMs,
        statusCode: response.status,
        status: response.ok ? "healthy" : "degraded",
        details,
      };
    } catch (error) {
      const latencyMs = Date.now() - startedAt;
      return {
        service,
        upstream,
        available: false,
        latencyMs,
        statusCode: 0,
        status: "unreachable",
        details: error instanceof Error ? error.message : "unknown error",
      };
    } finally {
      clearTimeout(timer);
    }
  }

  private transformDetails(raw: string): string {
    const trimmed = raw.trim();
    if (!trimmed) {
      return "empty response";
    }
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      const status = typeof parsed.status === "string" ? parsed.status : "unknown";
      const service = typeof parsed.service === "string" ? parsed.service : "";
      return service ? `${service}:${status}` : status;
    } catch {
      return trimmed.slice(0, 200);
    }
  }
}
