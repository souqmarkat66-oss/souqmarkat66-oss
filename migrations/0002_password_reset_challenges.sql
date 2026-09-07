CREATE TABLE IF NOT EXISTS "password_reset_challenges" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "user_id" varchar REFERENCES "users"("id") ON DELETE CASCADE,
  "identifier_hash" varchar(64) NOT NULL,
  "channel" varchar(10) NOT NULL,
  "destination_masked" varchar(255) NOT NULL,
  "otp_hash" varchar(64) NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "expires_at" timestamp NOT NULL,
  "last_sent_at" timestamp DEFAULT now() NOT NULL,
  "proof_hash" varchar(64),
  "proof_expires_at" timestamp,
  "verified_at" timestamp,
  "used_at" timestamp,
  "request_ip_hash" varchar(64) NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "password_reset_user_created_idx"
  ON "password_reset_challenges" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "password_reset_expiry_idx"
  ON "password_reset_challenges" ("expires_at");
CREATE INDEX IF NOT EXISTS "password_reset_identifier_created_idx"
  ON "password_reset_challenges" ("identifier_hash", "created_at");