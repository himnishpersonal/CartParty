import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { PrismaService } from "../prisma/prisma.service";

type PresenceUser = { id: string; name: string; email: string };
type PresenceEntry = { user: PresenceUser; sockets: Set<string> };

@WebSocketGateway({ cors: { origin: "*" } })
export class WorkspaceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(WorkspaceGateway.name);
  private readonly presence = new Map<string, Map<string, PresenceEntry>>();

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService
  ) {}

  async handleConnection(socket: Socket) {
    if (!this.isAllowedOrigin(socket.handshake.headers.origin)) {
      socket.disconnect(true);
      return;
    }

    const token = socket.handshake.auth?.token;
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; email: string }>(token, {
        secret: this.config.get("JWT_ACCESS_SECRET") ?? "dev-access-secret"
      });
      socket.data.userId = payload.sub;
    } catch {
      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: Socket) {
    for (const [workspaceId, users] of this.presence.entries()) {
      const userId = socket.data.userId as string | undefined;
      if (!userId) continue;
      const entry = users.get(userId);
      entry?.sockets.delete(socket.id);
      if (entry && entry.sockets.size === 0) users.delete(userId);
      if (users.size === 0) this.presence.delete(workspaceId);
      this.emitPresence(workspaceId);
    }
  }

  @SubscribeMessage("join_workspace")
  async joinWorkspace(@MessageBody() body: { workspaceId: string }, @ConnectedSocket() socket: Socket) {
    const userId = socket.data.userId as string | undefined;
    if (!body?.workspaceId || !userId) return { ok: false };
    const member = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: body.workspaceId, userId } },
      include: { user: { select: { id: true, name: true, email: true } } }
    });
    if (!member) return { ok: false };

    socket.join(`workspace:${body.workspaceId}`);
    const users = this.presence.get(body.workspaceId) ?? new Map<string, PresenceEntry>();
    const entry = users.get(userId) ?? { user: member.user, sockets: new Set<string>() };
    entry.sockets.add(socket.id);
    users.set(userId, entry);
    this.presence.set(body.workspaceId, users);
    this.emitPresence(body.workspaceId);
    this.logger.debug(`User ${userId} joined workspace:${body.workspaceId}`);
    return { ok: true };
  }

  emitToWorkspace(workspaceId: string, event: string, payload: unknown) {
    this.server?.to(`workspace:${workspaceId}`).emit(event, payload);
  }

  private emitPresence(workspaceId: string) {
    const users = [...(this.presence.get(workspaceId)?.values() ?? [])].map((entry) => entry.user);
    this.emitToWorkspace(workspaceId, "presence:updated", users);
  }

  private isAllowedOrigin(origin: string | undefined) {
    const frontendUrl = this.config.get("FRONTEND_URL") ?? "http://localhost:5173";
    return !origin || origin === frontendUrl || origin.startsWith("chrome-extension://");
  }
}
