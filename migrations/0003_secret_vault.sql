CREATE TABLE IF NOT EXISTS "secret_vault" (
  "name" text PRIMARY KEY NOT NULL,
  "encrypted_value" text NOT NULL,
  "iv" varchar(24) NOT NULL,
  "auth_tag" varchar(24) NOT NULL,
  "masked_last4" varchar(4) NOT NULL,
  "updated_by" varchar REFERENCES "users"("id") ON DELETE SET NULL,
  "updated_at" timestamp NOT NULL DEFAULT now()
);