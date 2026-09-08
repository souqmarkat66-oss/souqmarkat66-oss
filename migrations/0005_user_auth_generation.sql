ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "auth_generation" integer NOT NULL DEFAULT 0;