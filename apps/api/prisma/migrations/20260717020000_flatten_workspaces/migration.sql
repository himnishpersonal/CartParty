-- Preserve existing product ownership while flattening collections into workspaces.
ALTER TABLE "products" ADD COLUMN "workspace_id" UUID;

UPDATE "products"
SET "workspace_id" = "collections"."workspace_id"
FROM "collections"
WHERE "products"."collection_id" = "collections"."id";

ALTER TABLE "products" ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "products" ADD CONSTRAINT "products_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "products_workspace_id_idx" ON "products"("workspace_id");

ALTER TABLE "products" DROP CONSTRAINT "products_collection_id_fkey";
DROP INDEX "products_collection_id_idx";
ALTER TABLE "products" DROP COLUMN "collection_id";
DROP TABLE "collections";
