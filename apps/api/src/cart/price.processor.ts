import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeService } from "../realtime/realtime.service";
import { ActivityService } from "./services/activity.service";
import { RetailPriceService } from "./services/retail-price.service";

@Processor("price-check")
export class PriceProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly activity: ActivityService,
    private readonly retailPrices: RetailPriceService
  ) {
    super();
  }

  async process() {
    const products = await this.prisma.product.findMany({
      where: { productUrl: { not: null } },
      include: { workspace: true }
    });

    for (const product of products) {
      const observed = await this.retailPrices.read(product.productUrl!);
      if (!observed) continue;

      const current = product.currentPrice == null ? null : Number(product.currentPrice);
      const price = new Prisma.Decimal(observed.amount);
      const changed = current !== observed.amount;
      await this.prisma.product.update({
        where: { id: product.id },
        data: { currentPrice: price, ...(observed.currency ? { currency: observed.currency } : {}) }
      });
      const history = await this.prisma.priceHistory.create({ data: { productId: product.id, price } });
      if (!changed) continue;
      const payload = { productId: product.id, currentPrice: observed.amount, history };
      this.realtime.emit(product.workspace.id, "price:updated", payload);
      if (current !== null && observed.amount < current) {
        await this.activity.create(product.workspace.id, product.addedBy, "price_dropped", {
          productId: product.id,
          title: product.title,
          from: current,
          to: observed.amount
        });
      }
    }
  }
}
