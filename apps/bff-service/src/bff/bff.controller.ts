import { Controller, Get, Query } from "@nestjs/common";
import { BffService } from "./bff.service";

@Controller("api/v1/bff")
export class BffController {
  constructor(private readonly bffService: BffService) {}

  @Get("overview")
  async overview(@Query("refresh") refresh?: string): Promise<unknown> {
    const forceRefresh = refresh === "1" || refresh === "true";
    return this.bffService.aggregateOverview(forceRefresh);
  }
}
