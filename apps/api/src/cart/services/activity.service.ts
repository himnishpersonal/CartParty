import { Injectable } from "@nestjs/common";
import { ActivityType, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { RealtimeService } from "../../realtime/realtime.service";

@Injectable()
export class ActivityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService
  ) {}

  async create(workspaceId: string, actorId: string, eventType: ActivityType, metadata: Prisma.InputJsonObject) {
    const event = await this.prisma.activityEvent.create({
      data: { workspaceId, actorId, eventType, metadata },
      include: { actor: { select: { id: true, name: true, email: true } } }
    });
    this.realtime.emit(workspaceId, "activity:new", event);
    return event;
  }
}
