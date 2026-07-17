import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentUser, RequestUser } from "../../auth/current-user.decorator";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { CreateProductDto, UpdateProductDto } from "../dto";
import { CartService } from "../services/cart.service";

@UseGuards(JwtAuthGuard)
@Controller()
export class ProductsController {
  constructor(private readonly cart: CartService) {}

  @Post("workspaces/:id/products")
  create(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: CreateProductDto) {
    return this.cart.createProduct(id, user.id, dto);
  }

  @Get("workspaces/:id/products")
  list(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.cart.listProducts(id, user.id);
  }

  @Patch("products/:id")
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateProductDto) {
    return this.cart.updateProduct(id, user.id, dto);
  }

  @Delete("products/:id")
  delete(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.cart.deleteProduct(id, user.id);
  }
}
