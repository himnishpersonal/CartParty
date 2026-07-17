import { Controller, Headers, Post, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PriceService } from "./cart/services/price.service";

@Controller("internal")
export class InternalController {
  constructor(
    private readonly config: ConfigService,
    private readonly priceService: PriceService
  ) {}

  @Post("price-scan")
  async enqueuePriceScan(@Headers("x-cartparty-price-secret") secret?: string) {
    const expectedSecret = this.config.get<string>("PRICE_SCAN_SECRET");
    if (!expectedSecret || secret !== expectedSecret) throw new UnauthorizedException();
    await this.priceService.enqueueScan();
    return { accepted: true };
  }
}
