ALTER TABLE "password_reset_challenges"
  ALTER COLUMN "user_id" DROP NOT NULL;

ALTER TABLE "password_reset_challenges"
  ADD COLUMN IF NOT EXISTS "identifier_hash" varchar(64);

-- Recovery challenges are short-lived and must not survive a schema transition.
-- Removing legacy rows allows the new privacy-preserving key to be mandatory
-- without fabricating values that were never derived from the original email.
DELETE FROM "password_reset_challenges"
  WHERE "identifier_hash" IS NULL;

ALTER TABLE "password_reset_challenges"
  ALTER COLUMN "identifier_hash" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "password_reset_identifier_created_idx"
  ON "password_reset_challenges" ("identifier_hash", "created_at");