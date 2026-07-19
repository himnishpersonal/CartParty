ALTER TABLE "users" ADD COLUMN "onboarding_completed_at" TIMESTAMP(3);

-- Existing accounts should continue directly to their current Parties.
UPDATE "users" SET "onboarding_completed_at" = CURRENT_TIMESTAMP
WHERE "onboarding_completed_at" IS NULL;
