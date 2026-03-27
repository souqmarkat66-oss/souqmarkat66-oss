import { pgTable, text, serial, integer, boolean, timestamp, varchar, real, jsonb } from "drizzle-orm/pg-core";
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
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertLiveStreamSchema = createInsertSchema(liveStreams).omit({ id: true, createdAt: true, viewerCount: true, peakViewers: true, likesCount: true, totalEarningsEGP: true });
export type LiveStream = typeof liveStreams.$inferSelect;
export type InsertLiveStream = z.infer<typeof insertLiveStreamSchema>;

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
  type: text("type", { enum: ["earning", "spending", "withdrawal", "ai_charge"] }).notNull(),
  amountEGP: real("amount_egp").notNull(),
  description: text("description"),
  campaignId: integer("campaign_id"),
  channelId: integer("channel_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type RevenueTransaction = typeof revenueTransactions.$inferSelect;

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
  method: text("method", { enum: ["vodafone", "etisalat", "instapay", "souq"] }).notNull(),
  phoneNumber: text("phone_number"),
  status: text("status", { enum: ["pending", "approved", "rejected"] }).default("pending"),
  adminNote: text("admin_note"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPaymentRequestSchema = createInsertSchema(paymentRequests).omit({ id: true, createdAt: true, status: true, adminNote: true });
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
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export type DirectMessage = typeof directMessages.$inferSelect;
