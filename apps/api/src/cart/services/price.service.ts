import { Injectable, OnModuleInit } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";

@Injectable()
export class PriceService implements OnModuleInit {
  constructor(
    @InjectQueue("price-check") private readonly queue: Queue,
    private readonly config: ConfigService
  ) {}

  async onModuleInit() {
    if (this.config.get("RUN_PRICE_SCHEDULER") === "false") return;
    await this.queue.add("scan", {}, { repeat: { pattern: "0 * * * *" }, jobId: "hourly-price-scan" });
  }
}
