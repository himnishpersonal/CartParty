import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module";
import { CartModule } from "./cart/cart.module";
import { HealthController } from "./health.controller";
import { InternalController } from "./internal.controller";
import { PrismaModule } from "./prisma/prisma.module";
import { RealtimeModule } from "./realtime/realtime.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: { url: config.get("REDIS_URL") ?? "redis://localhost:6379" }
      })
    }),
    PrismaModule,
    RealtimeModule,
    AuthModule,
    CartModule
  ],
  controllers: [HealthController, InternalController]
})
export class AppModule {}
