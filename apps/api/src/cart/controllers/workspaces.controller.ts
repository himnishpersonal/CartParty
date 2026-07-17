import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { CurrentUser, RequestUser } from "../../auth/current-user.decorator";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { CreateWorkspaceDto, InviteMemberDto } from "../dto";
import { CartService } from "../services/cart.service";

@UseGuards(JwtAuthGuard)
@Controller("workspaces")
export class WorkspacesController {
  constructor(private readonly cart: CartService) {}

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateWorkspaceDto) {
    return this.cart.createWorkspace(user.id, dto.name);
  }

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.cart.listWorkspaces(user.id);
  }

  @Get(":id")
  get(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.cart.getWorkspace(id, user.id);
  }

  @Post(":id/members")
  invite(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: InviteMemberDto) {
    return this.cart.inviteMember(id, user.id, dto.email);
  }
}
