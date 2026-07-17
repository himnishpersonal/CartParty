import { z } from "zod";

export const voteTypes = ["love", "pass", "favorite"] as const;
export const workspaceRoles = ["owner", "member"] as const;
export const activityTypes = ["product_added", "vote_cast", "comment_added", "price_dropped"] as const;

export type VoteType = (typeof voteTypes)[number];
export type WorkspaceRole = (typeof workspaceRoles)[number];
export type ActivityType = (typeof activityTypes)[number];

export const createProductSchema = z.object({
  title: z.string().min(1),
  imageUrl: z.string().url().optional().nullable(),
  productUrl: z.string().url().optional().nullable(),
  storeName: z.string().min(1).optional().nullable(),
  currentPrice: z.coerce.number().positive().optional().nullable(),
  currency: z.string().default("USD"),
  notes: z.string().optional().nullable()
});

export const extensionSaveSchema = createProductSchema.extend({
  workspaceId: z.string().uuid()
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type ExtensionSaveInput = z.infer<typeof extensionSaveSchema>;
