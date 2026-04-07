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

interface ParsedHealthPayload {
  status: string;
  details: string;
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
    const path = service === "control-plane" ? "/api/v1/health" : "/healthz";

    try {
      const response = await fetch(`${upstream.replace(/\/$/, "")}${path}`, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      const latencyMs = Date.now() - startedAt;
      const text = await response.text();
      const parsed = this.parseHealthPayload(text);
      const status = response.ok ? parsed.status : "degraded";
      const available = response.ok && !["degraded", "unhealthy", "unreachable"].includes(status);
      return {
        service,
        upstream,
        available,
        latencyMs,
        statusCode: response.status,
        status,
        details: parsed.details,
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

  private parseHealthPayload(raw: string): ParsedHealthPayload {
    const trimmed = raw.trim();
    if (!trimmed) {
      return { status: "unknown", details: "empty response" };
    }
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      const status = typeof parsed.status === "string" ? parsed.status : "unknown";
      const service = typeof parsed.service === "string" ? parsed.service : "";
      const components = typeof parsed.components === "object" && parsed.components !== null
        ? (parsed.components as Record<string, unknown>)
        : null;
      const reconciler = components && typeof components.operational_es_reconciler === "object" && components.operational_es_reconciler !== null
        ? (components.operational_es_reconciler as Record<string, unknown>)
        : null;
      const reconcilerState = reconciler && typeof reconciler.state === "string" ? reconciler.state : "";
      const reconcilerDetails = reconcilerState ? ` reconciler:${reconcilerState}` : "";
      const base = service ? `${service}:${status}` : status;
      return {
        status,
        details: `${base}${reconcilerDetails}`,
      };
    } catch {
      return {
        status: "unknown",
        details: trimmed.slice(0, 200),
      };
    }
  }
}
