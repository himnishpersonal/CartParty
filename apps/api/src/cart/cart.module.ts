import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { RealtimeModule } from "../realtime/realtime.module";
import { ActivityController } from "./controllers/activity.controller";
import { CommentsController } from "./controllers/comments.controller";
import { ExtensionController } from "./controllers/extension.controller";
import { PriceController } from "./controllers/price.controller";
import { ProductsController } from "./controllers/products.controller";
import { VotesController } from "./controllers/votes.controller";
import { WorkspacesController } from "./controllers/workspaces.controller";
import { PriceProcessor } from "./price.processor";
import { ActivityService } from "./services/activity.service";
import { CartService } from "./services/cart.service";
import { PriceService } from "./services/price.service";
import { RetailPriceService } from "./services/retail-price.service";

@Module({
  imports: [
    BullModule.registerQueue({
      name: "price-check",
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: 100,
        removeOnFail: 500
      }
    }),
    RealtimeModule
  ],
  controllers: [
    WorkspacesController,
    ProductsController,
    VotesController,
    CommentsController,
    PriceController,
    ActivityController,
    ExtensionController
  ],
  providers: [CartService, ActivityService, PriceService, RetailPriceService, PriceProcessor],
  exports: [PriceService]
})
export class CartModule {}
