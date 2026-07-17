import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { CurrentUser, RequestUser } from "../../auth/current-user.decorator";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { CommentDto } from "../dto";
import { CartService } from "../services/cart.service";

@UseGuards(JwtAuthGuard)
@Controller()
export class CommentsController {
  constructor(private readonly cart: CartService) {}

  @Post("products/:id/comments")
  create(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: CommentDto) {
    return this.cart.createComment(id, user.id, dto.body);
  }

  @Get("products/:id/comments")
  list(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.cart.listComments(id, user.id);
  }
}
