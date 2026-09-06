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
