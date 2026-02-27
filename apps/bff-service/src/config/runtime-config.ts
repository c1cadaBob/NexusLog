import { Injectable } from "@nestjs/common";

export interface BffRuntimeConfig {
  controlPlaneBaseUrl: string;
  apiServiceBaseUrl: string;
  dataQueryBaseUrl: string;
  dataAuditBaseUrl: string;
  dataExportBaseUrl: string;
  requestTimeoutMs: number;
  cacheTtlMs: number;
}

@Injectable()
export class RuntimeConfigService {
  get config(): BffRuntimeConfig {
    return {
      controlPlaneBaseUrl: process.env.CONTROL_PLANE_BASE_URL ?? "http://control-plane:8080",
      apiServiceBaseUrl: process.env.API_SERVICE_BASE_URL ?? "http://api-service:8080",
      dataQueryBaseUrl: process.env.DATA_QUERY_BASE_URL ?? "http://query-api:8082",
      dataAuditBaseUrl: process.env.DATA_AUDIT_BASE_URL ?? "http://audit-api:8083",
      dataExportBaseUrl: process.env.DATA_EXPORT_BASE_URL ?? "http://export-api:8084",
      requestTimeoutMs: this.parseNumber("BFF_REQUEST_TIMEOUT_MS", 2500),
      cacheTtlMs: this.parseNumber("BFF_CACHE_TTL_MS", 10_000),
    };
  }

  private parseNumber(name: string, fallback: number): number {
    const raw = process.env[name];
    if (!raw) {
      return fallback;
    }
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
