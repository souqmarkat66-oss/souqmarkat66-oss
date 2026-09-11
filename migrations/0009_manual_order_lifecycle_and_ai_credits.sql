-- Forward-only wallet/service completion hardening.  This migration is
-- intentionally additive: it never posts a ledger entry or replays a service.

CREATE TABLE IF NOT EXISTS ai_credit_wallets (
  user_id varchar PRIMARY KEY REFERENCES users(id),
  balance integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  total_purchased integer NOT NULL DEFAULT 0 CHECK (total_purchased >= 0),
  total_consumed integer NOT NULL DEFAULT 0 CHECK (total_consumed >= 0),
  updated_at timestamp NOT NULL DEFAULT now()
);

ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS service_quantity integer;
ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS service_package_id integer;
ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS canonical_payment_ref text;
ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS fulfillment_status text;
ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS fulfillment_note text;
ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS fulfillment_result text;
ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS fulfillment_by varchar;
ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS fulfilled_at timestamp;
ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS transfer_reference text;
ALTER TABLE coin_purchase_orders ADD COLUMN IF NOT EXISTS canonical_payment_ref text;

-- New manual amounts are stored as exact Egyptian-piaster values.
ALTER TABLE payment_requests
  ALTER COLUMN amount_egp TYPE numeric(12,2)
  USING round(amount_egp::numeric, 2);

-- Earnings may have CPM/CPC/revenue-share fractions below a piaster.  Avoid
-- real-number rounding while retaining all historical values exactly.
ALTER TABLE revenue_transactions
  ALTER COLUMN amount_egp TYPE numeric(24,10)
  USING amount_egp::text::numeric;

-- Do not backfill or constrain historical refs: legacy duplicate rows remain
-- readable. New submissions write canonical values and claim them below.
CREATE INDEX IF NOT EXISTS payment_requests_canonical_payment_ref_idx ON payment_requests(canonical_payment_ref);
CREATE INDEX IF NOT EXISTS coin_purchase_orders_canonical_payment_ref_idx ON coin_purchase_orders(canonical_payment_ref);

CREATE TABLE IF NOT EXISTS manual_payment_reference_claims (
  flow text NOT NULL CHECK (flow IN ('incoming', 'outgoing')),
  canonical_reference text NOT NULL,
  source_type text NOT NULL,
  source_id integer NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY (flow, canonical_reference)
);

CREATE TABLE IF NOT EXISTS payment_service_deliveries (
  id serial PRIMARY KEY,
  payment_request_id integer NOT NULL REFERENCES payment_requests(id) ON DELETE CASCADE,
  service_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  delivery_note text,
  delivery_result text,
  completed_by varchar REFERENCES users(id) ON DELETE SET NULL,
  completed_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT payment_service_deliveries_request_service_unique
    UNIQUE(payment_request_id, service_type)
);

CREATE INDEX IF NOT EXISTS payment_service_deliveries_request_idx
  ON payment_service_deliveries(payment_request_id);

-- Historical approved rows are labelled legacy_review at read time; this
-- forward-only migration intentionally does not mutate production history.