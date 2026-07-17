import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { CurrentUser, RequestUser } from "../../auth/current-user.decorator";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { CartService } from "../services/cart.service";
import { PrismaService } from "../../prisma/prisma.service";

@UseGuards(JwtAuthGuard)
@Controller()
export class PriceController {
  constructor(
    private readonly cart: CartService,
    private readonly prisma: PrismaService
  ) {}

  @Get("products/:id/price-history")
  async list(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    await this.cart.ensureWorkspaceMember(await this.cart.workspaceForProduct(id), user.id);
    return this.prisma.priceHistory.findMany({ where: { productId: id }, orderBy: { recordedAt: "asc" } });
  }
}
