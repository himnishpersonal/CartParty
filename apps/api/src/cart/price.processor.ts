import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeService } from "../realtime/realtime.service";
import { ActivityService } from "./services/activity.service";

@Processor("price-check")
export class PriceProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly activity: ActivityService
  ) {
    super();
  }

  async process() {
    const products = await this.prisma.product.findMany({
      where: { productUrl: { not: null }, currentPrice: { not: null } },
      include: { workspace: true }
    });

    for (const product of products) {
      const current = Number(product.currentPrice);
      const next = this.mockNextPrice(current, product.id);
      if (next === current) continue;
      const price = new Prisma.Decimal(next);
      await this.prisma.product.update({ where: { id: product.id }, data: { currentPrice: price } });
      const history = await this.prisma.priceHistory.create({ data: { productId: product.id, price } });
      const payload = { productId: product.id, currentPrice: next, history };
      this.realtime.emit(product.workspace.id, "price:updated", payload);
      if (next < current) {
        await this.activity.create(product.workspace.id, product.addedBy, "price_dropped", {
          productId: product.id,
          title: product.title,
          from: current,
          to: next
        });
      }
    }
  }

  private mockNextPrice(current: number, productId: string) {
    const seed = productId.charCodeAt(0) + new Date().getHours();
    const pct = ((seed % 9) - 4) / 100;
    return Math.max(1, Number((current * (1 + pct)).toFixed(2)));
  }
}
