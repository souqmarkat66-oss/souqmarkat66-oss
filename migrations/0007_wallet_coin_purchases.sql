-- Atomic EGP-wallet purchases of gift coins.
-- This migration is intentionally separate from immutable 0001 reconciliation.
CREATE TABLE IF NOT EXISTS wallet_coin_purchases (
  id serial PRIMARY KEY,
  user_id varchar NOT NULL REFERENCES users(id),
  package_id integer NOT NULL,
  coins integer NOT NULL CHECK (coins > 0),
  amount_egp numeric(12,2) NOT NULL CHECK (amount_egp > 0),
  idempotency_key text NOT NULL,
  revenue_transaction_id integer NOT NULL,
  coin_transaction_id integer NOT NULL,
  coin_balance integer NOT NULL CHECK (coin_balance >= 0),
  wallet_balance_egp numeric(12,2) NOT NULL,
  created_at timestamp DEFAULT now(),
  CONSTRAINT wallet_coin_purchases_user_key UNIQUE (user_id, idempotency_key)
);