CREATE TABLE "ad_campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"advertiser_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"media_url" text,
	"media_type" text DEFAULT 'image',
	"target_url" text,
	"target_languages" text[],
	"target_categories" text[],
	"target_regions" text[],
	"target_age_min" integer,
	"target_age_max" integer,
	"budget_egp" real DEFAULT 0,
	"spent_egp" real DEFAULT 0,
	"cpm_rate_egp" real DEFAULT 15,
	"publisher_rev_share" real DEFAULT 0.6,
	"impressions" integer DEFAULT 0,
	"clicks" integer DEFAULT 0,
	"status" text DEFAULT 'pending',
	"embed_code" text,
	"click_tracking_code" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ads" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"media_url" text NOT NULL,
	"media_type" text NOT NULL,
	"language" text DEFAULT 'ar' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"user_id" varchar NOT NULL,
	"likes_count" integer DEFAULT 0,
	"comments_count" integer DEFAULT 0,
	"views_count" integer DEFAULT 0,
	"target_region" text,
	"price_egp" real,
	"whatsapp_number" varchar(20),
	"payment_link" text,
	"app_store_url" text,
	"google_play_url" text,
	"app_gallery_url" text,
	"installment_months" integer,
	"installment_monthly_egp" real,
	"target_lat" real,
	"target_lng" real,
	"target_radius_km" real,
	"target_interests" text,
	"target_ages" text,
	"whatsapp_clicks" integer DEFAULT 0,
	"coupon_code" text,
	"coupon_discount_type" text,
	"coupon_discount_value" real,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "afs_payment_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"purpose" text NOT NULL,
	"service_type" text,
	"service_reference" jsonb,
	"idempotency_key" text,
	"package_id" integer,
	"amount_egp" numeric(12, 2) NOT NULL,
	"coins" integer,
	"checkout_id" text NOT NULL,
	"payment_id" text,
	"integrity" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"result_code" text,
	"result_description" text,
	"payment_brand" text,
	"last4" text,
	"coin_transaction_id" integer,
	"revenue_transaction_id" integer,
	"created_at" timestamp DEFAULT now(),
	"paid_at" timestamp,
	"fulfilled_at" timestamp,
	CONSTRAINT "afs_payment_orders_checkout_id_unique" UNIQUE("checkout_id"),
	CONSTRAINT "afs_payment_orders_payment_id_unique" UNIQUE("payment_id")
);
--> statement-breakpoint
CREATE TABLE "ai_usage" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"type" text NOT NULL,
	"credits_used" integer DEFAULT 1,
	"cost" real DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "channels" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"avatar_url" text,
	"banner_url" text,
	"language" text DEFAULT 'ar',
	"category" text DEFAULT 'general',
	"subscriber_count" integer DEFAULT 0,
	"views_count" integer DEFAULT 0,
	"is_verified" boolean DEFAULT false,
	"is_monetized" boolean DEFAULT false,
	"status" text DEFAULT 'active',
	"earnings" real DEFAULT 0,
	"earnings_egp" real DEFAULT 0,
	"wallet_number" text,
	"wallet_type" text,
	"publisher_code" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "channels_publisher_code_unique" UNIQUE("publisher_code")
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"stream_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"user_name" text NOT NULL,
	"message" text NOT NULL,
	"is_voice" boolean DEFAULT false,
	"is_hidden" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "coin_packages" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"coins" integer NOT NULL,
	"price_egp" real NOT NULL,
	"bonus_coins" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "coin_recharge_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"coins" integer NOT NULL,
	"price_egp" real NOT NULL,
	"used_by_user_id" varchar,
	"used_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "coin_recharge_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "coin_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"type" text NOT NULL,
	"coins" integer NOT NULL,
	"description" text,
	"related_stream_id" integer,
	"related_user_id" varchar,
	"recharge_code_id" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "coin_wallets" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"total_spent" integer DEFAULT 0 NOT NULL,
	"total_earned" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "coin_wallets_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"user_name" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" integer NOT NULL,
	"content" text NOT NULL,
	"is_voice_comment" boolean DEFAULT false,
	"voice_text" text,
	"likes_count" integer DEFAULT 0,
	"is_hidden" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"business_name" text NOT NULL,
	"title" text NOT NULL,
	"code" text NOT NULL,
	"discount_type" text DEFAULT 'percentage',
	"discount_value" real,
	"image_url" text,
	"description" text,
	"terms_ar" text,
	"is_active" boolean DEFAULT true,
	"expires_at" timestamp,
	"usage_limit" integer,
	"used_count" integer DEFAULT 0,
	"amount_paid_egp" real DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "direct_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_user_id" varchar NOT NULL,
	"to_user_id" varchar NOT NULL,
	"ad_id" integer,
	"message" text NOT NULL,
	"is_voice" boolean DEFAULT false,
	"voice_url" text,
	"is_read" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"ad_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "follows" (
	"id" serial PRIMARY KEY NOT NULL,
	"follower_id" varchar NOT NULL,
	"channel_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "gift_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"sender_user_id" varchar NOT NULL,
	"recipient_user_id" varchar NOT NULL,
	"stream_id" integer NOT NULL,
	"gift_type" text NOT NULL,
	"gross_coins" integer NOT NULL,
	"broadcaster_coins" integer NOT NULL,
	"platform_coins" integer NOT NULL,
	"egp_rate" numeric(8, 4) DEFAULT '0.0500' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "gift_events_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
CREATE TABLE "likes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"target_type" text NOT NULL,
	"target_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "live_battles" (
	"id" serial PRIMARY KEY NOT NULL,
	"stream_id" integer NOT NULL,
	"mode" text DEFAULT '1v1' NOT NULL,
	"started_at" timestamp NOT NULL,
	"ended_at" timestamp DEFAULT now() NOT NULL,
	"score_a" integer DEFAULT 0 NOT NULL,
	"score_b" integer DEFAULT 0 NOT NULL,
	"winner" text NOT NULL,
	"player_scores" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "live_streams" (
	"id" serial PRIMARY KEY NOT NULL,
	"channel_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"thumbnail_url" text,
	"category" text DEFAULT 'general',
	"language" text DEFAULT 'ar',
	"status" text DEFAULT 'scheduled',
	"viewer_count" integer DEFAULT 0,
	"peak_viewers" integer DEFAULT 0,
	"likes_count" integer DEFAULT 0,
	"chat_enabled" boolean DEFAULT true,
	"show_ads" boolean DEFAULT true,
	"total_earnings_egp" real DEFAULT 0,
	"started_at" timestamp,
	"ended_at" timestamp,
	"recording_url" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"link" text,
	"voice_url" text,
	"sender_user_id" varchar,
	"dedupe_key" text,
	"is_read" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "notifications_dedupe_key_unique" UNIQUE("dedupe_key")
);
--> statement-breakpoint
CREATE TABLE "offers" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_user_id" varchar NOT NULL,
	"from_user_name" text NOT NULL,
	"ad_id" integer NOT NULL,
	"offer_amount_egp" real NOT NULL,
	"message" text,
	"status" text DEFAULT 'pending',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payment_failures" (
	"id" serial PRIMARY KEY NOT NULL,
	"dedupe_key" text NOT NULL,
	"user_id" varchar NOT NULL,
	"method" text NOT NULL,
	"service_type" text,
	"amount_egp" numeric(12, 2) DEFAULT '0' NOT NULL,
	"reason_code" text NOT NULL,
	"reason_message" text NOT NULL,
	"reference" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "payment_failures_dedupe_key_unique" UNIQUE("dedupe_key")
);
--> statement-breakpoint
CREATE TABLE "payment_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_number" text,
	"user_id" varchar NOT NULL,
	"ad_id" integer,
	"type" text NOT NULL,
	"amount_egp" real NOT NULL,
	"method" text NOT NULL,
	"phone_number" text,
	"service_type" text,
	"screenshot_url" text,
	"status" text DEFAULT 'pending',
	"admin_note" text,
	"fulfillment_status" text,
	"fulfilled_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "payment_requests_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "platform_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "ratings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"user_name" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"rating" integer NOT NULL,
	"review" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "reels" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"channel_id" integer,
	"title" text NOT NULL,
	"description" text,
	"video_url" text NOT NULL,
	"audio_url" text,
	"thumbnail_url" text,
	"duration" integer DEFAULT 30,
	"views_count" integer DEFAULT 0,
	"likes_count" integer DEFAULT 0,
	"comments_count" integer DEFAULT 0,
	"status" text DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"reporter_id" varchar NOT NULL,
	"target_type" text NOT NULL,
	"target_id" integer NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'pending',
	"admin_note" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "revenue_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"type" text NOT NULL,
	"amount_egp" real NOT NULL,
	"description" text,
	"campaign_id" integer,
	"channel_id" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ticker_ads" (
	"id" serial PRIMARY KEY NOT NULL,
	"advertiser_id" varchar NOT NULL,
	"text" text NOT NULL,
	"budget_egp" real NOT NULL,
	"price_per_second_egp" real NOT NULL,
	"spent_egp" real DEFAULT 0 NOT NULL,
	"seconds_shown" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"approved_by" varchar,
	"approved_at" timestamp,
	"started_at" timestamp,
	"stopped_at" timestamp,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "uploaded_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"filename" text NOT NULL,
	"original_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"url" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_follows" (
	"id" serial PRIMARY KEY NOT NULL,
	"follower_id" varchar NOT NULL,
	"following_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"phone" varchar(20),
	"password_hash" text,
	"is_banned" boolean DEFAULT false,
	"role" text DEFAULT 'user',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"subscription_ends_at" timestamp,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ad_campaigns" ADD CONSTRAINT "ad_campaigns_advertiser_id_users_id_fk" FOREIGN KEY ("advertiser_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ads" ADD CONSTRAINT "ads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "afs_payment_orders" ADD CONSTRAINT "afs_payment_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channels" ADD CONSTRAINT "channels_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_stream_id_live_streams_id_fk" FOREIGN KEY ("stream_id") REFERENCES "public"."live_streams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coin_recharge_codes" ADD CONSTRAINT "coin_recharge_codes_used_by_user_id_users_id_fk" FOREIGN KEY ("used_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coin_transactions" ADD CONSTRAINT "coin_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coin_wallets" ADD CONSTRAINT "coin_wallets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_ad_id_ads_id_fk" FOREIGN KEY ("ad_id") REFERENCES "public"."ads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_id_users_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_events" ADD CONSTRAINT "gift_events_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_events" ADD CONSTRAINT "gift_events_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "likes" ADD CONSTRAINT "likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_battles" ADD CONSTRAINT "live_battles_stream_id_live_streams_id_fk" FOREIGN KEY ("stream_id") REFERENCES "public"."live_streams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_streams" ADD CONSTRAINT "live_streams_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_streams" ADD CONSTRAINT "live_streams_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_ad_id_ads_id_fk" FOREIGN KEY ("ad_id") REFERENCES "public"."ads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_failures" ADD CONSTRAINT "payment_failures_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reels" ADD CONSTRAINT "reels_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revenue_transactions" ADD CONSTRAINT "revenue_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticker_ads" ADD CONSTRAINT "ticker_ads_advertiser_id_users_id_fk" FOREIGN KEY ("advertiser_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploaded_files" ADD CONSTRAINT "uploaded_files_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_follows" ADD CONSTRAINT "user_follows_follower_id_users_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_follows" ADD CONSTRAINT "user_follows_following_id_users_id_fk" FOREIGN KEY ("following_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gift_events_sender_created_idx" ON "gift_events" USING btree ("sender_user_id","created_at");--> statement-breakpoint
CREATE INDEX "gift_events_recipient_created_idx" ON "gift_events" USING btree ("recipient_user_id","created_at");--> statement-breakpoint
CREATE INDEX "gift_events_stream_created_idx" ON "gift_events" USING btree ("stream_id","created_at");--> statement-breakpoint
CREATE INDEX "payment_failures_created_at_idx" ON "payment_failures" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "payment_failures_method_idx" ON "payment_failures" USING btree ("method");--> statement-breakpoint
CREATE INDEX "revenue_transactions_user_id_type_idx" ON "revenue_transactions" USING btree ("user_id","type");--> statement-breakpoint
CREATE INDEX "revenue_transactions_user_id_created_at_idx" ON "revenue_transactions" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");