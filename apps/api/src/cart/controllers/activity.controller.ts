import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { CurrentUser, RequestUser } from "../../auth/current-user.decorator";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { CartService } from "../services/cart.service";

@UseGuards(JwtAuthGuard)
@Controller()
export class ActivityController {
  constructor(private readonly cart: CartService) {}

  @Get("workspaces/:id/activity")
  list(@CurrentUser() user: RequestUser, @Param("id") id: string, @Query("cursor") cursor?: string) {
    return this.cart.activityFeed(id, user.id, cursor);
  }
}
