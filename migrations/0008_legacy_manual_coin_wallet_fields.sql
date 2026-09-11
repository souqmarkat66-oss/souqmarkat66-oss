-- Forward-only compatibility for the legacy manual wallet/coin flow.
-- Every operation is additive and leaves existing financial rows untouched.
CREATE TABLE IF NOT EXISTS coin_purchase_orders (
  id serial PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id),
  user_name text,
  package_id integer,
  coins integer NOT NULL,
  amount_egp numeric(12,2) NOT NULL,
  payment_method text NOT NULL,
  payment_ref text,
  proof_digest text,
  screenshot_url text,
  status text NOT NULL DEFAULT 'pending',
  admin_note text,
  created_at timestamp DEFAULT now(),
  reviewed_at timestamp,
  reviewed_by text
);

ALTER TABLE coin_purchase_orders
  ADD COLUMN IF NOT EXISTS payment_ref text;
ALTER TABLE coin_purchase_orders
  ADD COLUMN IF NOT EXISTS proof_digest text;
ALTER TABLE coin_purchase_orders
  ADD COLUMN IF NOT EXISTS screenshot_url text;
ALTER TABLE coin_purchase_orders
  ADD COLUMN IF NOT EXISTS reviewed_at timestamp;
ALTER TABLE coin_purchase_orders
  ADD COLUMN IF NOT EXISTS reviewed_by text;

ALTER TABLE payment_requests
  ADD COLUMN IF NOT EXISTS payment_ref text;
ALTER TABLE payment_requests
  ADD COLUMN IF NOT EXISTS proof_digest text;
ALTER TABLE payment_requests
  ADD COLUMN IF NOT EXISTS fulfillment_status text;
ALTER TABLE payment_requests
  ADD COLUMN IF NOT EXISTS fulfilled_at timestamp;

CREATE INDEX IF NOT EXISTS coin_purchase_orders_payment_ref_idx
  ON coin_purchase_orders(payment_ref);
CREATE INDEX IF NOT EXISTS coin_purchase_orders_created_at_idx
  ON coin_purchase_orders(created_at DESC);