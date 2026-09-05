import { pgTable, text, serial, integer, boolean, timestamp, varchar, real, numeric, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export * from "./models/auth";
export * from "./models/chat";

import { users } from "./models/auth";

// ============================================================
// PLATFORM SETTINGS (Admin controlled)
// ============================================================
export const platformSettings = pgTable("platform_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============================================================
// AI USAGE TABLE
// ============================================================
export const aiUsage = pgTable("ai_usage", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  type: text("type", { enum: ["image", "copy", "video_script", "article"] }).notNull(),
  creditsUsed: integer("credits_used").default(1),
  cost: real("cost").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================================
// ADS TABLE
// ============================================================
export const ads = pgTable("ads", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  mediaUrl: text("media_url").notNull(),
  mediaType: text("media_type", { enum: ["image", "video"] }).notNull(),
  language: text("language", { enum: ["ar", "en"] }).default("ar").notNull(),
  status: text("status", { enum: ["active", "inactive"] }).default("active").notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  likesCount: integer("likes_count").default(0),
  commentsCount: integer("comments_count").default(0),
  viewsCount: integer("views_count").default(0),
  targetRegion: text("target_region"),
  priceEGP: real("price_egp"),
  whatsappNumber: varchar("whatsapp_number", { length: 20 }),
  paymentLink: text("payment_link"),
  appStoreUrl: text("app_store_url"),
  googlePlayUrl: text("google_play_url"),
  appGalleryUrl: text("app_gallery_url"),
  installmentMonths: integer("installment_months"),
  installmentMonthlyEGP: real("installment_monthly_egp"),
  targetLat: real("target_lat"),
  targetLng: real("target_lng"),
  targetRadiusKm: real("target_radius_km"),
  targetInterests: text("target_interests"),
  targetAges: text("target_ages"),
  whatsappClicks: integer("whatsapp_clicks").default(0),
  couponCode: text("coupon_code"),
  couponDiscountType: text("coupon_discount_type"),
  couponDiscountValue: real("coupon_discount_value"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAdSchema = createInsertSchema(ads).omit({ id: true, createdAt: true, likesCount: true, commentsCount: true, viewsCount: true });
export type Ad = typeof ads.$inferSelect;
export type InsertAd = z.infer<typeof insertAdSchema>;

// ============================================================
// REELS TABLE
// ============================================================
export const reels = pgTable("reels", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  channelId: integer("channel_id"),
  title: text("title").notNull(),
  description: text("description"),
  videoUrl: text("video_url").notNull(), // stores single video URL, single image URL, or JSON array of image URLs
  audioUrl: text("audio_url"),           // optional background music for image reels
  thumbnailUrl: text("thumbnail_url"),
  duration: integer("duration").default(30),
  viewsCount: integer("views_count").default(0),
  likesCount: integer("likes_count").default(0),
  commentsCount: integer("comments_count").default(0),
  status: text("status", { enum: ["active", "hidden"] }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertReelSchema = createInsertSchema(reels).omit({ id: true, createdAt: true, viewsCount: true, likesCount: true, commentsCount: true });
export type Reel = typeof reels.$inferSelect;
export type InsertReel = z.infer<typeof insertReelSchema>;

// ============================================================
// CHANNELS TABLE
// ============================================================
export const channels = pgTable("channels", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  avatarUrl: text("avatar_url"),
  bannerUrl: text("banner_url"),
  language: text("language", { enum: ["ar", "en"] }).default("ar"),
  category: text("category").default("general"),
  subscriberCount: integer("subscriber_count").default(0),
  viewsCount: integer("views_count").default(0),
  isVerified: boolean("is_verified").default(false),
  isMonetized: boolean("is_monetized").default(false),
  status: text("status", { enum: ["active", "suspended", "pending"] }).default("active"),
  earnings: real("earnings").default(0),
  earningsEGP: real("earnings_egp").default(0),
  walletNumber: text("wallet_number"),
  walletType: text("wallet_type", { enum: ["vodafone", "etisalat", "instapay", "souq"] }),
  publisherCode: text("publisher_code").unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertChannelSchema = createInsertSchema(channels).omit({ id: true, createdAt: true, subscriberCount: true, viewsCount: true, earnings: true, earningsEGP: true });
export type Channel = typeof channels.$inferSelect;
export type InsertChannel = z.infer<typeof insertChannelSchema>;

// ============================================================
// LIVE STREAMS TABLE
// ============================================================
export const liveStreams = pgTable("live_streams", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").references(() => channels.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  thumbnailUrl: text("thumbnail_url"),
  category: text("category").default("general"),
  language: text("language", { enum: ["ar", "en"] }).default("ar"),
  status: text("status", { enum: ["live", "ended", "scheduled"] }).default("scheduled"),
  viewerCount: integer("viewer_count").default(0),
  peakViewers: integer("peak_viewers").default(0),
  likesCount: integer("likes_count").default(0),
  chatEnabled: boolean("chat_enabled").default(true),
  showAds: boolean("show_ads").default(true),
  totalEarningsEGP: real("total_earnings_egp").default(0),
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  recordingUrl: text("recording_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertLiveStreamSchema = createInsertSchema(liveStreams).omit({ id: true, createdAt: true, viewerCount: true, peakViewers: true, likesCount: true, totalEarningsEGP: true });
export type LiveStream = typeof liveStreams.$inferSelect;
export type InsertLiveStream = z.infer<typeof insertLiveStreamSchema>;

// ============================================================
// LIVE PK BATTLE RESULTS TABLE
// ============================================================
export const liveBattles = pgTable("live_battles", {
  id: serial("id").primaryKey(),
  streamId: integer("stream_id").references(() => liveStreams.id).notNull(),
  mode: text("mode", { enum: ["1v1", "2v2"] }).notNull().default("1v1"),
  startedAt: timestamp("started_at").notNull(),
  endedAt: timestamp("ended_at").defaultNow().notNull(),
  scoreA: integer("score_a").notNull().default(0),
  scoreB: integer("score_b").notNull().default(0),
  winner: text("winner", { enum: ["A", "B", "draw"] }).notNull(),
  // مساهمة كل مشارك: [{ team, userId, name, score }]
  playerScores: jsonb("player_scores"),
  createdAt: timestamp("created_at").defaultNow(),
});
export type LiveBattle = typeof liveBattles.$inferSelect;

// ============================================================
// CHAT MESSAGES TABLE
// ============================================================
export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  streamId: integer("stream_id").references(() => liveStreams.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  userName: text("user_name").notNull(),
  message: text("message").notNull(),
  isVoice: boolean("is_voice").default(false),
  isHidden: boolean("is_hidden").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export type ChatMessage = typeof chatMessages.$inferSelect;

// ============================================================
// LIKES TABLE
// ============================================================
export const likes = pgTable("likes", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  targetType: text("target_type", { enum: ["ad", "stream", "channel", "reel"] }).notNull(),
  targetId: integer("target_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Like = typeof likes.$inferSelect;

// ============================================================
// COMMENTS TABLE
// ============================================================
export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  userName: text("user_name").notNull(),
  targetType: text("target_type", { enum: ["ad", "stream", "reel"] }).notNull(),
  targetId: integer("target_id").notNull(),
  content: text("content").notNull(),
  isVoiceComment: boolean("is_voice_comment").default(false),
  voiceText: text("voice_text"),
  likesCount: integer("likes_count").default(0),
  isHidden: boolean("is_hidden").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCommentSchema = createInsertSchema(comments).omit({ id: true, createdAt: true, likesCount: true });
export type Comment = typeof comments.$inferSelect;
export type InsertComment = z.infer<typeof insertCommentSchema>;

// ============================================================
// FOLLOWS TABLE
// ============================================================
export const follows = pgTable("follows", {
  id: serial("id").primaryKey(),
  followerId: varchar("follower_id").references(() => users.id).notNull(),
  channelId: integer("channel_id").references(() => channels.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Follow = typeof follows.$inferSelect;

// ============================================================
// USER FOLLOWS TABLE (متابعة مستخدم لمستخدم — نظام الأصدقاء)
// ============================================================
export const userFollows = pgTable("user_follows", {
  id: serial("id").primaryKey(),
  followerId: varchar("follower_id").references(() => users.id).notNull(),
  followingId: varchar("following_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type UserFollow = typeof userFollows.$inferSelect;

// ============================================================
// AD CAMPAIGNS TABLE (Meta/AdSense-like)
// ============================================================
export const adCampaigns = pgTable("ad_campaigns", {
  id: serial("id").primaryKey(),
  advertiserId: varchar("advertiser_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  mediaUrl: text("media_url"),
  mediaType: text("media_type", { enum: ["image", "video", "reel"] }).default("image"),
  targetUrl: text("target_url"),
  targetLanguages: text("target_languages").array(),
  targetCategories: text("target_categories").array(),
  targetRegions: text("target_regions").array(),
  targetAgeMin: integer("target_age_min"),
  targetAgeMax: integer("target_age_max"),
  budgetEGP: real("budget_egp").default(0),
  spentEGP: real("spent_egp").default(0),
  cpmRateEGP: real("cpm_rate_egp").default(15.0),
  publisherRevShare: real("publisher_rev_share").default(0.60),
  impressions: integer("impressions").default(0),
  clicks: integer("clicks").default(0),
  status: text("status", { enum: ["active", "paused", "completed", "pending", "rejected"] }).default("pending"),
  embedCode: text("embed_code"),
  clickTrackingCode: text("click_tracking_code"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAdCampaignSchema = createInsertSchema(adCampaigns).omit({ id: true, createdAt: true, spentEGP: true, impressions: true, clicks: true, embedCode: true, clickTrackingCode: true });
export type AdCampaign = typeof adCampaigns.$inferSelect;
export type InsertAdCampaign = z.infer<typeof insertAdCampaignSchema>;

// ============================================================
// REVENUE TRANSACTIONS TABLE
// ============================================================
export const revenueTransactions = pgTable("revenue_transactions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  type: text("type", { enum: ["earning", "spending", "withdrawal", "ai_charge", "wallet_recharge"] }).notNull(),
  amountEGP: real("amount_egp").notNull(),
  description: text("description"),
  campaignId: integer("campaign_id"),
  channelId: integer("channel_id"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  userTypeIdx: index("revenue_transactions_user_id_type_idx").on(table.userId, table.type),
  userCreatedIdx: index("revenue_transactions_user_id_created_at_idx").on(table.userId, table.createdAt),
}));

export type RevenueTransaction = typeof revenueTransactions.$inferSelect;

// COPYandPAY card orders are the payment authority. The optional ledger ids
// allow the activity feed to show the card order once rather than its credit.
export const afsPaymentOrders = pgTable("afs_payment_orders", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  purpose: text("purpose", { enum: ["wallet_top_up", "coin_purchase", "service_payment"] }).notNull(),
  serviceType: text("service_type"),
  serviceReference: jsonb("service_reference"),
  idempotencyKey: text("idempotency_key"),
  packageId: integer("package_id"),
  amountEGP: numeric("amount_egp", { precision: 12, scale: 2 }).notNull(),
  coins: integer("coins"),
  checkoutId: text("checkout_id").notNull().unique(),
  paymentId: text("payment_id").unique(),
  integrity: text("integrity"),
  status: text("status", { enum: ["pending", "paid", "failed"] }).notNull().default("pending"),
  resultCode: text("result_code"),
  resultDescription: text("result_description"),
  paymentBrand: text("payment_brand"),
  last4: text("last4"),
  coinTransactionId: integer("coin_transaction_id"),
  revenueTransactionId: integer("revenue_transaction_id"),
  createdAt: timestamp("created_at").defaultNow(),
  paidAt: timestamp("paid_at"),
  fulfilledAt: timestamp("fulfilled_at"),
});
export type AfsPaymentOrder = typeof afsPaymentOrders.$inferSelect;

// Rejected payment attempts are kept outside the wallet/revenue ledger. They
// are audit records only and never change balances or earnings.
export const paymentFailures = pgTable("payment_failures", {
  id: serial("id").primaryKey(),
  dedupeKey: text("dedupe_key").notNull().unique(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  method: text("method").notNull(),
  serviceType: text("service_type"),
  amountEGP: numeric("amount_egp", { precision: 12, scale: 2 }).notNull().default("0"),
  reasonCode: text("reason_code").notNull(),
  reasonMessage: text("reason_message").notNull(),
  reference: text("reference"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  createdIdx: index("payment_failures_created_at_idx").on(table.createdAt),
  methodIdx: index("payment_failures_method_idx").on(table.method),
}));
export type PaymentFailure = typeof paymentFailures.$inferSelect;

// ============================================================
// REPORTS TABLE
// ============================================================
export const reports = pgTable("reports", {
  id: serial("id").primaryKey(),
  reporterId: varchar("reporter_id").references(() => users.id).notNull(),
  targetType: text("target_type", { enum: ["ad", "stream", "channel", "user", "comment", "reel"] }).notNull(),
  targetId: integer("target_id").notNull(),
  reason: text("reason").notNull(),
  status: text("status", { enum: ["pending", "resolved", "dismissed"] }).default("pending"),
  adminNote: text("admin_note"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertReportSchema = createInsertSchema(reports).omit({ id: true, createdAt: true, status: true, adminNote: true });
export type Report = typeof reports.$inferSelect;
export type InsertReport = z.infer<typeof insertReportSchema>;

// ============================================================
// UPLOADED FILES TABLE
// ============================================================
export const uploadedFiles = pgTable("uploaded_files", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  url: text("url").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type UploadedFile = typeof uploadedFiles.$inferSelect;

// ============================================================
// PAYMENT REQUESTS TABLE
// ============================================================
export const paymentRequests = pgTable("payment_requests", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number").unique(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  adId: integer("ad_id"),
  type: text("type", { enum: ["withdrawal", "top_up"] }).notNull(),
  amountEGP: real("amount_egp").notNull(),
  method: text("method", { enum: ["vodafone", "etisalat", "instapay", "souq", "visa_bank"] }).notNull(),
  phoneNumber: text("phone_number"),
  serviceType: text("service_type"),
  screenshotUrl: text("screenshot_url"),
  status: text("status", { enum: ["pending", "approved", "rejected"] }).default("pending"),
  adminNote: text("admin_note"),
  fulfillmentStatus: text("fulfillment_status"),
  fulfilledAt: timestamp("fulfilled_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Egyptian mobile: 11 digits starting with 010/011/012/015
const EG_PHONE_REGEX = /^01[0125]\d{8}$/;

export const insertPaymentRequestSchema = createInsertSchema(paymentRequests)
  .omit({ id: true, createdAt: true, status: true, adminNote: true, fulfillmentStatus: true, fulfilledAt: true })
  .extend({
    amountEGP: z.coerce.number()
      .positive("المبلغ لازم يكون أكبر من صفر")
      .min(10, "الحد الأدنى للمبلغ هو 10 جنيه")
      .max(1_000_000, "المبلغ كبير جداً، تواصل مع الإدارة"),
    phoneNumber: z.string().trim().optional().nullable(),
    screenshotUrl: z.string().trim().optional().nullable(),
    serviceType: z.string().trim().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    // Payout destination is required except for an in-app balance transfer.
    if (data.method !== "souq") {
      if (!data.phoneNumber || data.phoneNumber.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["phoneNumber"],
          message: "رقم محفظتك مطلوب لإتمام التحويل",
        });
      } else if (data.method !== "visa_bank" && !EG_PHONE_REGEX.test(data.phoneNumber)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["phoneNumber"],
          message: "رقم المحفظة غير صحيح — لازم يبدأ بـ 010/011/012/015 ويكون 11 رقم",
        });
      }
    }
    // Only incoming legacy payments need an uploaded receipt. Withdrawals are
    // validated against the server ledger and therefore have no receipt.
    if (data.type === "top_up" && !data.screenshotUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["screenshotUrl"],
        message: "صورة الإيصال مطلوبة",
      });
    } else if (data.screenshotUrl && !data.screenshotUrl.startsWith("/uploads/")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["screenshotUrl"],
        message: "صورة الإيصال لازم ترفعها من الزرار، مش رابط خارجي",
      });
    }
    // Top-up requires at least one service selected
    if (data.type === "top_up" && (!data.serviceType || data.serviceType.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["serviceType"],
        message: "اختر خدمة واحدة على الأقل",
      });
    }
  });
export type PaymentRequest = typeof paymentRequests.$inferSelect;
export type InsertPaymentRequest = z.infer<typeof insertPaymentRequestSchema>;

// ============================================================
// NOTIFICATIONS TABLE
// ============================================================
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  type: text("type", { enum: ["like", "comment", "payment", "campaign_approved", "campaign_rejected", "new_subscriber", "fraud_alert", "system"] }).notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  link: text("link"),
  voiceUrl: text("voice_url"),
  senderUserId: varchar("sender_user_id"),
  dedupeKey: text("dedupe_key").unique(),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Notification = typeof notifications.$inferSelect;

// ============================================================
// DIRECT MESSAGES TABLE
// ============================================================
export const directMessages = pgTable("direct_messages", {
  id: serial("id").primaryKey(),
  fromUserId: varchar("from_user_id").references(() => users.id).notNull(),
  toUserId: varchar("to_user_id").references(() => users.id).notNull(),
  adId: integer("ad_id"),
  message: text("message").notNull(),
  isVoice: boolean("is_voice").default(false),
  voiceUrl: text("voice_url"),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export type DirectMessage = typeof directMessages.$inferSelect;

// ============================================================
// FAVORITES TABLE
// ============================================================
export const favorites = pgTable("favorites", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  adId: integer("ad_id").references(() => ads.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Favorite = typeof favorites.$inferSelect;

// ============================================================
// RATINGS TABLE
// ============================================================
export const ratings = pgTable("ratings", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  userName: text("user_name").notNull(),
  targetType: text("target_type", { enum: ["ad", "user"] }).notNull(),
  targetId: text("target_id").notNull(),
  rating: integer("rating").notNull(),
  review: text("review"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertRatingSchema = createInsertSchema(ratings).omit({ id: true, createdAt: true });
export type Rating = typeof ratings.$inferSelect;
export type InsertRating = z.infer<typeof insertRatingSchema>;

// ============================================================
// OFFERS TABLE
// ============================================================
export const offers = pgTable("offers", {
  id: serial("id").primaryKey(),
  fromUserId: varchar("from_user_id").references(() => users.id).notNull(),
  fromUserName: text("from_user_name").notNull(),
  adId: integer("ad_id").references(() => ads.id).notNull(),
  offerAmountEGP: real("offer_amount_egp").notNull(),
  message: text("message"),
  status: text("status", { enum: ["pending", "accepted", "rejected"] }).default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertOfferSchema = createInsertSchema(offers).omit({ id: true, createdAt: true, status: true });
export type Offer = typeof offers.$inferSelect;
export type InsertOffer = z.infer<typeof insertOfferSchema>;

// ============================================================
// COUPONS TABLE (AI-generated promo codes)
// ============================================================
export const coupons = pgTable("coupons", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  businessName: text("business_name").notNull(),
  title: text("title").notNull(),
  code: text("code").notNull(),
  discountType: text("discount_type", { enum: ["percentage", "fixed", "free_shipping", "buy_x_get_y"] }).default("percentage"),
  discountValue: real("discount_value"),
  imageUrl: text("image_url"),
  description: text("description"),
  termsAr: text("terms_ar"),
  isActive: boolean("is_active").default(true),
  expiresAt: timestamp("expires_at"),
  usageLimit: integer("usage_limit"),
  usedCount: integer("used_count").default(0),
  amountPaidEGP: real("amount_paid_egp").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCouponSchema = createInsertSchema(coupons).omit({ id: true, createdAt: true, usedCount: true });
export type Coupon = typeof coupons.$inferSelect;
export type InsertCoupon = z.infer<typeof insertCouponSchema>;

// ============================================================
// COIN WALLETS TABLE — user coin balance (real money)
// ============================================================
export const coinWallets = pgTable("coin_wallets", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  balance: integer("balance").default(0).notNull(),
  totalSpent: integer("total_spent").default(0).notNull(),
  totalEarned: integer("total_earned").default(0).notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export type CoinWallet = typeof coinWallets.$inferSelect;

// ============================================================
// COIN PACKAGES TABLE — packages sold (admin sets prices)
// ============================================================
export const coinPackages = pgTable("coin_packages", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  coins: integer("coins").notNull(),
  priceEGP: real("price_egp").notNull(),
  bonusCoins: integer("bonus_coins").default(0),
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertCoinPackageSchema = createInsertSchema(coinPackages).omit({ id: true, createdAt: true });
export type CoinPackage = typeof coinPackages.$inferSelect;
export type InsertCoinPackage = z.infer<typeof insertCoinPackageSchema>;

// ============================================================
// COIN RECHARGE CODES TABLE — admin generates codes for offline payment
// ============================================================
export const coinRechargeCodes = pgTable("coin_recharge_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  coins: integer("coins").notNull(),
  priceEGP: real("price_egp").notNull(),
  usedByUserId: varchar("used_by_user_id").references(() => users.id),
  usedAt: timestamp("used_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
});
export type CoinRechargeCode = typeof coinRechargeCodes.$inferSelect;

// ============================================================
// COIN TRANSACTIONS TABLE — all coin movements
// ============================================================
export const coinTransactions = pgTable("coin_transactions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  type: text("type", { enum: ["recharge", "gift_sent", "gift_received", "purchase", "refund", "admin_grant"] }).notNull(),
  coins: integer("coins").notNull(),
  description: text("description"),
  relatedStreamId: integer("related_stream_id"),
  relatedUserId: varchar("related_user_id"),
  rechargeCodeId: integer("recharge_code_id"),
  createdAt: timestamp("created_at").defaultNow(),
});
export type CoinTransaction = typeof coinTransactions.$inferSelect;

// Canonical, immutable gift record. The unique event id makes a client retry
// idempotent while keeping the broadcaster/platform 60/40 split auditable.
export const giftEvents = pgTable("gift_events", {
  id: serial("id").primaryKey(),
  eventId: text("event_id").notNull().unique(),
  senderUserId: varchar("sender_user_id").references(() => users.id).notNull(),
  recipientUserId: varchar("recipient_user_id").references(() => users.id).notNull(),
  streamId: integer("stream_id").notNull(),
  giftType: text("gift_type").notNull(),
  grossCoins: integer("gross_coins").notNull(),
  broadcasterCoins: integer("broadcaster_coins").notNull(),
  platformCoins: integer("platform_coins").notNull(),
  egpRate: numeric("egp_rate", { precision: 8, scale: 4 }).notNull().default("0.0500"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  senderCreatedIdx: index("gift_events_sender_created_idx").on(table.senderUserId, table.createdAt),
  recipientCreatedIdx: index("gift_events_recipient_created_idx").on(table.recipientUserId, table.createdAt),
  streamCreatedIdx: index("gift_events_stream_created_idx").on(table.streamId, table.createdAt),
}));
export type GiftEvent = typeof giftEvents.$inferSelect;

// ============================================================
// TICKER ADS TABLE — Global breaking-news style ticker ads
// ============================================================
export const tickerAds = pgTable("ticker_ads", {
  id: serial("id").primaryKey(),
  advertiserId: varchar("advertiser_id").references(() => users.id).notNull(),
  text: text("text").notNull(),
  budgetEGP: real("budget_egp").notNull(),
  pricePerSecondEGP: real("price_per_second_egp").notNull(),
  spentEGP: real("spent_egp").default(0).notNull(),
  secondsShown: integer("seconds_shown").default(0).notNull(),
  status: text("status", {
    enum: ["pending", "approved", "active", "paused", "completed", "rejected"],
  }).default("pending").notNull(),
  approvedBy: varchar("approved_by"),
  approvedAt: timestamp("approved_at"),
  startedAt: timestamp("started_at"),
  stoppedAt: timestamp("stopped_at"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTickerAdSchema = createInsertSchema(tickerAds).omit({
  id: true, createdAt: true, spentEGP: true, secondsShown: true,
  status: true, approvedBy: true, approvedAt: true, startedAt: true,
  stoppedAt: true, rejectionReason: true,
});
export type TickerAd = typeof tickerAds.$inferSelect;
export type InsertTickerAd = z.infer<typeof insertTickerAdSchema>;
