import { Type } from "class-transformer";
import { IsEmail, IsEnum, IsNumber, IsOptional, IsString, IsUUID, IsUrl, Min } from "class-validator";
import { VoteType } from "@prisma/client";

export class CreateWorkspaceDto {
  @IsString()
  name!: string;
}

export class UpdateWorkspaceDto {
  @IsString()
  name!: string;
}

export class InviteMemberDto {
  @IsEmail()
  email!: string;
}

export class CreateProductDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @IsOptional()
  @IsUrl()
  productUrl?: string;

  @IsOptional()
  @IsString()
  storeName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  currentPrice?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @IsOptional()
  @IsUrl()
  productUrl?: string;

  @IsOptional()
  @IsString()
  storeName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  currentPrice?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class VoteDto {
  @IsEnum(VoteType)
  voteType!: VoteType;
}

export class CommentDto {
  @IsString()
  body!: string;
}

export class ExtensionSaveDto extends CreateProductDto {
  @IsUUID()
  workspaceId!: string;
}
