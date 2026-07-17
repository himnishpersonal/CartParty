import { Injectable } from "@nestjs/common";
import { WorkspaceGateway } from "./workspace.gateway";

@Injectable()
export class RealtimeService {
  constructor(private readonly gateway: WorkspaceGateway) {}

  emit(workspaceId: string, event: string, payload: unknown) {
    this.gateway.emitToWorkspace(workspaceId, event, payload);
  }
}
