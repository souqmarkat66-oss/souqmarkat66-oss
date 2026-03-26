import { pgTable, text, serial, integer, boolean, timestamp, varchar, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export * from "./models/auth";
export * from "./models/chat";

import { users } from "./models/auth";

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
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAdSchema = createInsertSchema(ads).omit({ id: true, createdAt: true, likesCount: true, commentsCount: true, viewsCount: true });
export type Ad = typeof ads.$inferSelect;
export type InsertAd = z.infer<typeof insertAdSchema>;

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
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertChannelSchema = createInsertSchema(channels).omit({ id: true, createdAt: true, subscriberCount: true, viewsCount: true, earnings: true });
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
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertLiveStreamSchema = createInsertSchema(liveStreams).omit({ id: true, createdAt: true, viewerCount: true, peakViewers: true, likesCount: true });
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
  targetType: text("target_type", { enum: ["ad", "stream", "channel"] }).notNull(),
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
  targetType: text("target_type", { enum: ["ad", "stream"] }).notNull(),
  targetId: integer("target_id").notNull(),
  content: text("content").notNull(),
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
  mediaType: text("media_type", { enum: ["image", "video"] }).default("image"),
  targetUrl: text("target_url"),
  targetLanguages: text("target_languages").array(),
  targetCategories: text("target_categories").array(),
  budget: real("budget").default(0),
  spent: real("spent").default(0),
  cpmRate: real("cpm_rate").default(5.0),
  publisherRevShare: real("publisher_rev_share").default(0.60),
  impressions: integer("impressions").default(0),
  clicks: integer("clicks").default(0),
  status: text("status", { enum: ["active", "paused", "completed", "pending", "rejected"] }).default("pending"),
  embedCode: text("embed_code"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAdCampaignSchema = createInsertSchema(adCampaigns).omit({ id: true, createdAt: true, spent: true, impressions: true, clicks: true, embedCode: true });
export type AdCampaign = typeof adCampaigns.$inferSelect;
export type InsertAdCampaign = z.infer<typeof insertAdCampaignSchema>;

// ============================================================
// REVENUE TRANSACTIONS TABLE
// ============================================================
export const revenueTransactions = pgTable("revenue_transactions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  type: text("type", { enum: ["earning", "spending", "withdrawal"] }).notNull(),
  amount: real("amount").notNull(),
  description: text("description"),
  campaignId: integer("campaign_id"),
  channelId: integer("channel_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type RevenueTransaction = typeof revenueTransactions.$inferSelect;

// ============================================================
// REPORTS TABLE (Admin moderation)
// ============================================================
export const reports = pgTable("reports", {
  id: serial("id").primaryKey(),
  reporterId: varchar("reporter_id").references(() => users.id).notNull(),
  targetType: text("target_type", { enum: ["ad", "stream", "channel", "user", "comment"] }).notNull(),
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
// RELATIONS
// ============================================================
export const adsRelations = relations(ads, ({ one }) => ({
  user: one(users, { fields: [ads.userId], references: [users.id] }),
}));

export const channelsRelations = relations(channels, ({ one, many }) => ({
  user: one(users, { fields: [channels.userId], references: [users.id] }),
  streams: many(liveStreams),
  followers: many(follows),
}));

export const liveStreamsRelations = relations(liveStreams, ({ one, many }) => ({
  channel: one(channels, { fields: [liveStreams.channelId], references: [channels.id] }),
  user: one(users, { fields: [liveStreams.userId], references: [users.id] }),
  messages: many(chatMessages),
}));

export const followsRelations = relations(follows, ({ one }) => ({
  follower: one(users, { fields: [follows.followerId], references: [users.id] }),
  channel: one(channels, { fields: [follows.channelId], references: [channels.id] }),
}));
