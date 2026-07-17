import { Body, Controller, Delete, Param, Post, UseGuards } from "@nestjs/common";
import { CurrentUser, RequestUser } from "../../auth/current-user.decorator";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { VoteDto } from "../dto";
import { CartService } from "../services/cart.service";

@UseGuards(JwtAuthGuard)
@Controller()
export class VotesController {
  constructor(private readonly cart: CartService) {}

  @Post("products/:id/votes")
  upsert(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: VoteDto) {
    return this.cart.upsertVote(id, user.id, dto.voteType);
  }

  @Delete("products/:id/votes")
  delete(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.cart.deleteVote(id, user.id);
  }
}
