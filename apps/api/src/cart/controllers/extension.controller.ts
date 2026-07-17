import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { CurrentUser, RequestUser } from "../../auth/current-user.decorator";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { ExtensionSaveDto } from "../dto";
import { CartService } from "../services/cart.service";

@UseGuards(JwtAuthGuard)
@Controller("extension")
export class ExtensionController {
  constructor(private readonly cart: CartService) {}

  @Get("workspaces")
  workspaces(@CurrentUser() user: RequestUser) {
    return this.cart.extensionWorkspaces(user.id);
  }

  @Post("save")
  save(@CurrentUser() user: RequestUser, @Body() dto: ExtensionSaveDto) {
    return this.cart.createProduct(dto.workspaceId, user.id, dto);
  }
}
