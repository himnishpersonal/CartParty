import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, VoteType } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { RealtimeService } from "../../realtime/realtime.service";
import { ActivityService } from "./activity.service";
import { CreateProductDto, UpdateProductDto } from "../dto";

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly realtime: RealtimeService
  ) {}

  async ensureWorkspaceMember(workspaceId: string, userId: string) {
    const member = await this.prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId } } });
    if (!member) throw new ForbiddenException("Workspace access denied");
    return member;
  }

  async workspaceForProduct(productId: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException("Product not found");
    return product.workspaceId;
  }

  async createWorkspace(userId: string, name: string) {
    return this.prisma.workspace.create({
      data: {
        name,
        ownerId: userId,
        members: { create: { userId, role: "owner" } }
      },
      include: { members: true, _count: { select: { products: true } } }
    });
  }

  async listWorkspaces(userId: string) {
    return this.prisma.workspace.findMany({
      where: { members: { some: { userId } } },
      include: {
        members: { include: { user: { select: { id: true, name: true, email: true } } } },
        _count: { select: { products: true } }
      },
      orderBy: { createdAt: "desc" }
    });
  }

  async getWorkspace(id: string, userId: string) {
    await this.ensureWorkspaceMember(id, userId);
    return this.prisma.workspace.findUnique({
      where: { id },
      include: {
        members: { include: { user: { select: { id: true, name: true, email: true } } } },
        _count: { select: { products: true } }
      }
    });
  }

  async inviteMember(workspaceId: string, actorId: string, email: string) {
    const membership = await this.ensureWorkspaceMember(workspaceId, actorId);
    if (membership.role !== "owner") throw new ForbiddenException("Only workspace owners can invite members");
    const user = await this.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!user) throw new NotFoundException("User must register before they can be invited");
    return this.prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId, userId: user.id } },
      update: { role: "member" },
      create: { workspaceId, userId: user.id, role: "member" },
      include: { user: { select: { id: true, name: true, email: true } } }
    });
  }

  async createProduct(workspaceId: string, userId: string, dto: CreateProductDto) {
    await this.ensureWorkspaceMember(workspaceId, userId);
    const product = await this.prisma.product.create({
      data: {
        workspaceId,
        addedBy: userId,
        title: dto.title,
        imageUrl: dto.imageUrl,
        productUrl: dto.productUrl,
        storeName: dto.storeName,
        currentPrice: dto.currentPrice == null ? undefined : new Prisma.Decimal(dto.currentPrice),
        currency: dto.currency ?? "USD",
        notes: dto.notes
      },
      include: this.productInclude(userId)
    });
    await this.activity.create(workspaceId, userId, "product_added", { productId: product.id, title: product.title });
    this.realtime.emit(workspaceId, "product:added", product);
    return product;
  }

  async listProducts(workspaceId: string, userId: string) {
    await this.ensureWorkspaceMember(workspaceId, userId);
    return this.prisma.product.findMany({
      where: { workspaceId },
      include: this.productInclude(userId),
      orderBy: { createdAt: "desc" }
    });
  }

  async updateProduct(productId: string, userId: string, dto: UpdateProductDto) {
    const workspaceId = await this.workspaceForProduct(productId);
    await this.ensureWorkspaceMember(workspaceId, userId);
    return this.prisma.product.update({
      where: { id: productId },
      data: {
        title: dto.title,
        imageUrl: dto.imageUrl,
        productUrl: dto.productUrl,
        storeName: dto.storeName,
        currentPrice: dto.currentPrice == null ? undefined : new Prisma.Decimal(dto.currentPrice),
        currency: dto.currency,
        notes: dto.notes
      },
      include: this.productInclude(userId)
    });
  }

  async deleteProduct(productId: string, userId: string) {
    const workspaceId = await this.workspaceForProduct(productId);
    await this.ensureWorkspaceMember(workspaceId, userId);
    return this.prisma.product.delete({ where: { id: productId } });
  }

  async upsertVote(productId: string, userId: string, voteType: VoteType) {
    const workspaceId = await this.workspaceForProduct(productId);
    await this.ensureWorkspaceMember(workspaceId, userId);
    await this.prisma.vote.upsert({
      where: { productId_userId: { productId, userId } },
      update: { voteType },
      create: { productId, userId, voteType }
    });
    const counts = await this.voteCounts(productId);
    const product = await this.prisma.product.findUnique({ where: { id: productId }, select: { title: true } });
    await this.activity.create(workspaceId, userId, "vote_cast", { productId, voteType, title: product?.title });
    this.realtime.emit(workspaceId, "vote:updated", { productId, counts, myVote: voteType });
    return { productId, counts, myVote: voteType };
  }

  async deleteVote(productId: string, userId: string) {
    const workspaceId = await this.workspaceForProduct(productId);
    await this.ensureWorkspaceMember(workspaceId, userId);
    await this.prisma.vote.deleteMany({ where: { productId, userId } });
    const counts = await this.voteCounts(productId);
    this.realtime.emit(workspaceId, "vote:updated", { productId, counts, myVote: null });
    return { productId, counts, myVote: null };
  }

  async createComment(productId: string, userId: string, body: string) {
    const workspaceId = await this.workspaceForProduct(productId);
    await this.ensureWorkspaceMember(workspaceId, userId);
    const comment = await this.prisma.comment.create({
      data: { productId, userId, body },
      include: { user: { select: { id: true, name: true, email: true } } }
    });
    const product = await this.prisma.product.findUnique({ where: { id: productId }, select: { title: true } });
    await this.activity.create(workspaceId, userId, "comment_added", { productId, commentId: comment.id, title: product?.title });
    this.realtime.emit(workspaceId, "comment:added", comment);
    return comment;
  }

  async listComments(productId: string, userId: string) {
    const workspaceId = await this.workspaceForProduct(productId);
    await this.ensureWorkspaceMember(workspaceId, userId);
    return this.prisma.comment.findMany({
      where: { productId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" }
    });
  }

  async activityFeed(workspaceId: string, userId: string, cursor?: string) {
    await this.ensureWorkspaceMember(workspaceId, userId);
    return this.prisma.activityEvent.findMany({
      where: { workspaceId },
      include: { actor: { select: { id: true, name: true, email: true } } },
      take: 30,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: "desc" }
    });
  }

  async extensionWorkspaces(userId: string) {
    return this.prisma.workspace.findMany({
      where: { members: { some: { userId } } },
      select: { id: true, name: true },
      orderBy: { createdAt: "desc" }
    });
  }

  private productInclude(userId: string) {
    return {
      votes: true,
      comments: { take: 3, orderBy: { createdAt: "desc" as const }, include: { user: { select: { id: true, name: true } } } },
      priceHistory: { take: 12, orderBy: { recordedAt: "asc" as const } },
      adder: { select: { id: true, name: true, email: true } }
    };
  }

  private async voteCounts(productId: string) {
    const grouped = await this.prisma.vote.groupBy({ by: ["voteType"], where: { productId }, _count: true });
    return grouped.reduce(
      (acc, item) => ({ ...acc, [item.voteType]: item._count }),
      { love: 0, pass: 0, favorite: 0 } as Record<VoteType, number>
    );
  }
}
