-- Reconcile legacy runtime-provisioned schema with the versioned migration set.
-- Every change is additive and safe to re-run.

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone varchar(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role text DEFAULT 'user';
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS governorate text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS interests text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS birthday date;
ALTER TABLE users ADD COLUMN IF NOT EXISTS job_title text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS company text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS relationship_status text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_ends_at timestamp;

ALTER TABLE ads ADD COLUMN IF NOT EXISTS is_admin_promo boolean DEFAULT false;
ALTER TABLE ads ADD COLUMN IF NOT EXISTS coupon_code text;
ALTER TABLE ads ADD COLUMN IF NOT EXISTS coupon_discount_type text;
ALTER TABLE ads ADD COLUMN IF NOT EXISTS coupon_discount_value real;

ALTER TABLE reels ADD COLUMN IF NOT EXISTS audio_url text;

ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS reply_to_id integer;
ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS reply_to_text text;
ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS is_payment_proof boolean DEFAULT false;

CREATE TABLE IF NOT EXISTS afs_payment_orders (
  id serial PRIMARY KEY,
  user_id varchar NOT NULL REFERENCES users(id),
  purpose text NOT NULL,
  service_type text,
  service_reference jsonb,
  idempotency_key text,
  package_id integer,
  amount_egp numeric(12,2) NOT NULL,
  coins integer,
  checkout_id text NOT NULL UNIQUE,
  payment_id text UNIQUE,
  integrity text,
  status text NOT NULL DEFAULT 'pending',
  result_code text,
  result_description text,
  payment_brand text,
  last4 text,
  coin_transaction_id integer,
  revenue_transaction_id integer,
  created_at timestamp DEFAULT now(),
  paid_at timestamp,
  fulfilled_at timestamp,
  CONSTRAINT afs_payment_orders_purpose_check
    CHECK (purpose IN ('wallet_top_up', 'coin_purchase', 'service_payment')),
  CONSTRAINT afs_payment_orders_status_check
    CHECK (status IN ('pending', 'paid', 'failed'))
);
CREATE UNIQUE INDEX IF NOT EXISTS afs_payment_orders_user_idempotency_idx
  ON afs_payment_orders(user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS gift_events (
  id serial PRIMARY KEY,
  event_id text NOT NULL UNIQUE,
  sender_user_id varchar NOT NULL REFERENCES users(id),
  recipient_user_id varchar NOT NULL REFERENCES users(id),
  stream_id integer NOT NULL,
  gift_type text NOT NULL,
  gross_coins integer NOT NULL,
  broadcaster_coins integer NOT NULL,
  platform_coins integer NOT NULL,
  egp_rate numeric(8,4) NOT NULL DEFAULT 0.0500,
  created_at timestamp DEFAULT now(),
  CONSTRAINT gift_events_gross_coins_check CHECK (gross_coins > 0),
  CONSTRAINT gift_events_broadcaster_coins_check CHECK (broadcaster_coins >= 0),
  CONSTRAINT gift_events_platform_coins_check CHECK (platform_coins >= 0),
  CONSTRAINT gift_events_split_check CHECK (gross_coins = broadcaster_coins + platform_coins),
  CONSTRAINT gift_events_broadcaster_sixty_percent_check CHECK (broadcaster_coins * 5 = gross_coins * 3),
  CONSTRAINT gift_events_platform_forty_percent_check CHECK (platform_coins * 5 = gross_coins * 2)
);
CREATE INDEX IF NOT EXISTS gift_events_sender_created_idx
  ON gift_events(sender_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS gift_events_recipient_created_idx
  ON gift_events(recipient_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS gift_events_stream_created_idx
  ON gift_events(stream_id, created_at DESC);

CREATE TABLE IF NOT EXISTS payment_failures (
  id serial PRIMARY KEY,
  dedupe_key text NOT NULL UNIQUE,
  user_id varchar NOT NULL REFERENCES users(id),
  method text NOT NULL,
  service_type text,
  amount_egp numeric(12,2) NOT NULL DEFAULT 0,
  reason_code text NOT NULL,
  reason_message text NOT NULL,
  reference text,
  created_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payment_failures_created_at_idx
  ON payment_failures(created_at DESC);
CREATE INDEX IF NOT EXISTS payment_failures_method_idx
  ON payment_failures(method);

-- Some early VPS installs used ticker_ads as a generic key/value table. Keep
-- those legacy columns for rollback compatibility while adding the live-ad
-- columns expected by current and immediately previous releases.
ALTER TABLE ticker_ads ADD COLUMN IF NOT EXISTS advertiser_id varchar;
ALTER TABLE ticker_ads ADD COLUMN IF NOT EXISTS text text;
ALTER TABLE ticker_ads ADD COLUMN IF NOT EXISTS budget_egp real;
ALTER TABLE ticker_ads ADD COLUMN IF NOT EXISTS price_per_second_egp real;
ALTER TABLE ticker_ads ADD COLUMN IF NOT EXISTS spent_egp real DEFAULT 0 NOT NULL;
ALTER TABLE ticker_ads ADD COLUMN IF NOT EXISTS seconds_shown integer DEFAULT 0 NOT NULL;
ALTER TABLE ticker_ads ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending' NOT NULL;
ALTER TABLE ticker_ads ADD COLUMN IF NOT EXISTS approved_by varchar;
ALTER TABLE ticker_ads ADD COLUMN IF NOT EXISTS approved_at timestamp;
ALTER TABLE ticker_ads ADD COLUMN IF NOT EXISTS started_at timestamp;
ALTER TABLE ticker_ads ADD COLUMN IF NOT EXISTS stopped_at timestamp;
ALTER TABLE ticker_ads ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE ticker_ads ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now();
DO $ticker_ads_fk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.ticker_ads'::regclass
      AND conname = 'ticker_ads_advertiser_id_users_id_fk'
  ) THEN
    ALTER TABLE ticker_ads
      ADD CONSTRAINT ticker_ads_advertiser_id_users_id_fk
      FOREIGN KEY (advertiser_id) REFERENCES users(id);
  END IF;
END
$ticker_ads_fk$;

CREATE TABLE IF NOT EXISTS coupons (
  id serial PRIMARY KEY,
  user_id varchar REFERENCES users(id) NOT NULL,
  business_name text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  code text NOT NULL,
  discount_type text DEFAULT 'percentage',
  discount_value real,
  image_url text,
  description text,
  terms_ar text,
  is_active boolean DEFAULT true,
  expires_at timestamp,
  usage_limit integer,
  used_count integer DEFAULT 0,
  amount_paid_egp real DEFAULT 0,
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_activity_log (
  id serial PRIMARY KEY,
  admin_id varchar,
  action text,
  target text,
  details text,
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS consultations (
  id serial PRIMARY KEY,
  user_id text NOT NULL,
  user_name text,
  package_id text NOT NULL,
  package_label text,
  amount_egp numeric(10,2) DEFAULT 0,
  title text NOT NULL,
  description text,
  file_urls text,
  status text DEFAULT 'pending',
  admin_note text,
  reply text,
  payment_ref text,
  payment_method text,
  payment_screenshot_url text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

INSERT INTO platform_settings (key, value) VALUES
  ('coupon_price_egp', '15'),
  ('platform_name', 'شبكة سوق للإعلانات'),
  ('platform_tagline', 'أفضل منصة إعلانية في مصر والعالم العربي'),
  ('app_play_store', 'https://play.google.com/store/apps/details?id=com.apmo.souqmarket'),
  ('app_app_store', 'https://apps.apple.com/eg/app/as-souqmarket/id6740153334'),
  ('app_huawei', 'https://app.as-souqmarkat.com/?from-splash=false'),
  ('contact_vodafone_cash', '01098553911'),
  ('contact_instapay', '01285558567'),
  ('contact_whatsapp', '01126665741'),
  ('listing_price_7d', '400'),
  ('listing_price_15d', '700'),
  ('listing_price_30d', '900'),
  ('feature_ads', '1'),
  ('feature_reels', '1'),
  ('feature_channels', '1'),
  ('feature_livestream', '1'),
  ('feature_messages', '1'),
  ('feature_campaigns', '1'),
  ('feature_ai', '1'),
  ('feature_registration', '1'),
  ('feature_boost', '1'),
  ('feature_assistant', '1'),
  ('fire_price_egp', '100'),
  ('renewal_price_7d', '20'),
  ('renewal_price_15d', '35'),
  ('renewal_price_30d', '60'),
  ('subscription_price_egp', '250'),
  ('boost_price_egp', '250'),
  ('promo_banner_enabled', '1'),
  ('promo_banner_text', '🎉 قسّط على 18 شهر بدون فوائد | حمّل تطبيق سوق ماركات | واتساب: 01126665741 | InstaPay: 01285558567 | ads-as.com'),
  ('promo_banner_url', 'https://play.google.com/store/apps/details?id=com.apmo.souqmarket')
ON CONFLICT (key) DO NOTHING;
