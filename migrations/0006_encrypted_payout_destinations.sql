ALTER TABLE "payment_requests"
  ADD COLUMN IF NOT EXISTS "payout_name" text,
  ADD COLUMN IF NOT EXISTS "payout_destination_encrypted" text,
  ADD COLUMN IF NOT EXISTS "payout_destination_iv" text,
  ADD COLUMN IF NOT EXISTS "payout_destination_auth_tag" text,
  ADD COLUMN IF NOT EXISTS "payout_destination_last4" text;