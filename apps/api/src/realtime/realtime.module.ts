import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { WorkspaceGateway } from "./workspace.gateway";
import { RealtimeService } from "./realtime.service";

@Module({
  imports: [JwtModule.register({})],
  providers: [WorkspaceGateway, RealtimeService],
  exports: [RealtimeService]
})
export class RealtimeModule {}
