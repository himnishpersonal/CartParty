import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentUser, RequestUser } from "../../auth/current-user.decorator";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { CreateWorkspaceDto, InviteMemberDto, UpdateWorkspaceDto } from "../dto";
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

  @Patch(":id")
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateWorkspaceDto) {
    return this.cart.updateWorkspace(id, user.id, dto.name);
  }

  @Delete(":id")
  delete(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.cart.deleteWorkspace(id, user.id);
  }

  @Post(":id/members")
  invite(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: InviteMemberDto) {
    return this.cart.inviteMember(id, user.id, dto.email);
  }
}
