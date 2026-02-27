import { Controller, Get } from "@nestjs/common";

@Controller()
export class HealthController {
  @Get("/healthz")
  healthz() {
    return {
      status: "ok",
      service: "bff-service",
      timestamp: new Date().toISOString(),
    };
  }
}
