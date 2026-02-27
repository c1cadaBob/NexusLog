import { Module } from "@nestjs/common";
import { BffController } from "./bff/bff.controller";
import { BffService } from "./bff/bff.service";
import { CacheService } from "./bff/cache.service";
import { HealthController } from "./health/health.controller";
import { RuntimeConfigService } from "./config/runtime-config";

@Module({
  imports: [],
  controllers: [HealthController, BffController],
  providers: [RuntimeConfigService, CacheService, BffService],
})
export class AppModule {}
