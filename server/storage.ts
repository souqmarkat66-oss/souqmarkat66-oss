import { db } from "./db";
import { 
  ads, channels, liveStreams, chatMessages, likes, comments, follows, 
  adCampaigns, revenueTransactions, reports, uploadedFiles,
  type Ad, type InsertAd, type Channel, type InsertChannel,
  type LiveStream, type InsertLiveStream, type ChatMessage, type Like,
  type Comment, type InsertComment, type Follow, type AdCampaign, 
  type InsertAdCampaign, type RevenueTransaction, type Report, 
  type InsertReport, type UploadedFile
} from "@shared/schema";
import { eq, desc, and, sql, ne } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

export interface IStorage {
  // Ads
  getAds(language?: string): Promise<Ad[]>;
  getAd(id: number): Promise<Ad | undefined>;
  createAd(ad: InsertAd): Promise<Ad>;
  updateAd(id: number, ad: Partial<InsertAd>): Promise<Ad | undefined>;
  deleteAd(id: number): Promise<void>;

  // Channels
  getChannels(language?: string): Promise<Channel[]>;
  getChannel(id: number): Promise<Channel | undefined>;
  getChannelByUserId(userId: string): Promise<Channel | undefined>;
  createChannel(channel: InsertChannel): Promise<Channel>;
  updateChannel(id: number, data: Partial<InsertChannel>): Promise<Channel | undefined>;
  deleteChannel(id: number): Promise<void>;

  // Live Streams
  getLiveStreams(status?: string): Promise<LiveStream[]>;
  getLiveStream(id: number): Promise<LiveStream | undefined>;
  getLiveStreamsByChannel(channelId: number): Promise<LiveStream[]>;
  createLiveStream(stream: InsertLiveStream): Promise<LiveStream>;
  updateLiveStream(id: number, data: Partial<InsertLiveStream>): Promise<LiveStream | undefined>;

  // Chat Messages
  getChatMessages(streamId: number, limit?: number): Promise<ChatMessage[]>;
  createChatMessage(msg: Omit<ChatMessage, 'id' | 'createdAt'>): Promise<ChatMessage>;

  // Likes
  getLike(userId: string, targetType: string, targetId: number): Promise<Like | undefined>;
  toggleLike(userId: string, targetType: string, targetId: number): Promise<{ liked: boolean }>;
  getLikesCount(targetType: string, targetId: number): Promise<number>;

  // Comments
  getComments(targetType: string, targetId: number): Promise<Comment[]>;
  createComment(comment: InsertComment): Promise<Comment>;
  deleteComment(id: number): Promise<void>;
  hideComment(id: number): Promise<void>;

  // Follows
  getFollow(followerId: string, channelId: number): Promise<Follow | undefined>;
  toggleFollow(followerId: string, channelId: number): Promise<{ following: boolean }>;
  getFollowersCount(channelId: number): Promise<number>;

  // Ad Campaigns
  getAdCampaigns(advertiserId?: string): Promise<AdCampaign[]>;
  getAllAdCampaigns(): Promise<AdCampaign[]>;
  getAdCampaign(id: number): Promise<AdCampaign | undefined>;
  createAdCampaign(campaign: InsertAdCampaign): Promise<AdCampaign>;
  updateAdCampaign(id: number, data: Partial<InsertAdCampaign>): Promise<AdCampaign | undefined>;
  getActiveCampaigns(): Promise<AdCampaign[]>;
  recordImpression(campaignId: number, channelId?: number, userId?: string): Promise<void>;
  recordClick(campaignId: number, channelId?: number, userId?: string): Promise<void>;

  // Revenue
  getRevenueTransactions(userId: string): Promise<RevenueTransaction[]>;
  getUserBalance(userId: string): Promise<number>;
  createTransaction(tx: Omit<RevenueTransaction, 'id' | 'createdAt'>): Promise<RevenueTransaction>;

  // Reports
  getReports(status?: string): Promise<Report[]>;
  createReport(report: InsertReport): Promise<Report>;
  updateReport(id: number, status: string, adminNote?: string): Promise<Report | undefined>;

  // File Uploads
  createUploadedFile(file: Omit<UploadedFile, 'id' | 'createdAt'>): Promise<UploadedFile>;
  getUserFiles(userId: string): Promise<UploadedFile[]>;

  // Admin
  getAllUsers(): Promise<any[]>;
  getStats(): Promise<any>;
}

export class DatabaseStorage implements IStorage {
  // ─── ADS ──────────────────────────────────────────────────────
  async getAds(language?: string): Promise<Ad[]> {
    const q = db.select().from(ads).orderBy(desc(ads.createdAt));
    if (language) return (q as any).where(eq(ads.language, language as any));
    return q;
  }

  async getAd(id: number): Promise<Ad | undefined> {
    const [ad] = await db.select().from(ads).where(eq(ads.id, id));
    // Increment view count
    if (ad) await db.update(ads).set({ viewsCount: (ad.viewsCount || 0) + 1 }).where(eq(ads.id, id));
    return ad;
  }

  async createAd(insertAd: InsertAd): Promise<Ad> {
    const [ad] = await db.insert(ads).values(insertAd).returning();
    return ad;
  }

  async updateAd(id: number, updates: Partial<InsertAd>): Promise<Ad | undefined> {
    const [updated] = await db.update(ads).set(updates).where(eq(ads.id, id)).returning();
    return updated;
  }

  async deleteAd(id: number): Promise<void> {
    await db.delete(ads).where(eq(ads.id, id));
  }

  // ─── CHANNELS ─────────────────────────────────────────────────
  async getChannels(language?: string): Promise<Channel[]> {
    const q = db.select().from(channels).where(eq(channels.status, 'active')).orderBy(desc(channels.subscriberCount));
    if (language) return (q as any).where(and(eq(channels.status, 'active'), eq(channels.language, language as any)));
    return q;
  }

  async getChannel(id: number): Promise<Channel | undefined> {
    const [ch] = await db.select().from(channels).where(eq(channels.id, id));
    return ch;
  }

  async getChannelByUserId(userId: string): Promise<Channel | undefined> {
    const [ch] = await db.select().from(channels).where(eq(channels.userId, userId));
    return ch;
  }

  async createChannel(channel: InsertChannel): Promise<Channel> {
    const [ch] = await db.insert(channels).values(channel).returning();
    return ch;
  }

  async updateChannel(id: number, data: Partial<InsertChannel>): Promise<Channel | undefined> {
    const [updated] = await db.update(channels).set(data).where(eq(channels.id, id)).returning();
    return updated;
  }

  async deleteChannel(id: number): Promise<void> {
    await db.delete(channels).where(eq(channels.id, id));
  }

  // ─── LIVE STREAMS ─────────────────────────────────────────────
  async getLiveStreams(status?: string): Promise<LiveStream[]> {
    if (status) {
      return db.select().from(liveStreams).where(eq(liveStreams.status, status as any)).orderBy(desc(liveStreams.viewerCount));
    }
    return db.select().from(liveStreams).where(eq(liveStreams.status, 'live')).orderBy(desc(liveStreams.viewerCount));
  }

  async getLiveStream(id: number): Promise<LiveStream | undefined> {
    const [s] = await db.select().from(liveStreams).where(eq(liveStreams.id, id));
    return s;
  }

  async getLiveStreamsByChannel(channelId: number): Promise<LiveStream[]> {
    return db.select().from(liveStreams).where(eq(liveStreams.channelId, channelId)).orderBy(desc(liveStreams.createdAt));
  }

  async createLiveStream(stream: InsertLiveStream): Promise<LiveStream> {
    const [s] = await db.insert(liveStreams).values(stream).returning();
    return s;
  }

  async updateLiveStream(id: number, data: Partial<InsertLiveStream>): Promise<LiveStream | undefined> {
    const [s] = await db.update(liveStreams).set(data as any).where(eq(liveStreams.id, id)).returning();
    return s;
  }

  // ─── CHAT MESSAGES ────────────────────────────────────────────
  async getChatMessages(streamId: number, limit = 100): Promise<ChatMessage[]> {
    return db.select().from(chatMessages)
      .where(and(eq(chatMessages.streamId, streamId), eq(chatMessages.isHidden, false)))
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);
  }

  async createChatMessage(msg: Omit<ChatMessage, 'id' | 'createdAt'>): Promise<ChatMessage> {
    const [m] = await db.insert(chatMessages).values(msg).returning();
    return m;
  }

  // ─── LIKES ────────────────────────────────────────────────────
  async getLike(userId: string, targetType: string, targetId: number): Promise<Like | undefined> {
    const [like] = await db.select().from(likes).where(
      and(eq(likes.userId, userId), eq(likes.targetType, targetType as any), eq(likes.targetId, targetId))
    );
    return like;
  }

  async toggleLike(userId: string, targetType: string, targetId: number): Promise<{ liked: boolean }> {
    const existing = await this.getLike(userId, targetType, targetId);
    if (existing) {
      await db.delete(likes).where(eq(likes.id, existing.id));
      // Decrement count
      if (targetType === 'ad') await db.update(ads).set({ likesCount: sql`GREATEST(0, ${ads.likesCount} - 1)` }).where(eq(ads.id, targetId));
      if (targetType === 'stream') await db.update(liveStreams).set({ likesCount: sql`GREATEST(0, ${liveStreams.likesCount} - 1)` }).where(eq(liveStreams.id, targetId));
      return { liked: false };
    } else {
      await db.insert(likes).values({ userId, targetType: targetType as any, targetId });
      if (targetType === 'ad') await db.update(ads).set({ likesCount: sql`${ads.likesCount} + 1` }).where(eq(ads.id, targetId));
      if (targetType === 'stream') await db.update(liveStreams).set({ likesCount: sql`${liveStreams.likesCount} + 1` }).where(eq(liveStreams.id, targetId));
      return { liked: true };
    }
  }

  async getLikesCount(targetType: string, targetId: number): Promise<number> {
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(likes)
      .where(and(eq(likes.targetType, targetType as any), eq(likes.targetId, targetId)));
    return Number(count);
  }

  // ─── COMMENTS ─────────────────────────────────────────────────
  async getComments(targetType: string, targetId: number): Promise<Comment[]> {
    return db.select().from(comments)
      .where(and(eq(comments.targetType, targetType as any), eq(comments.targetId, targetId), eq(comments.isHidden, false)))
      .orderBy(desc(comments.createdAt));
  }

  async createComment(comment: InsertComment): Promise<Comment> {
    const [c] = await db.insert(comments).values(comment).returning();
    if (comment.targetType === 'ad') {
      await db.update(ads).set({ commentsCount: sql`${ads.commentsCount} + 1` }).where(eq(ads.id, comment.targetId));
    }
    return c;
  }

  async deleteComment(id: number): Promise<void> {
    await db.delete(comments).where(eq(comments.id, id));
  }

  async hideComment(id: number): Promise<void> {
    await db.update(comments).set({ isHidden: true }).where(eq(comments.id, id));
  }

  // ─── FOLLOWS ──────────────────────────────────────────────────
  async getFollow(followerId: string, channelId: number): Promise<Follow | undefined> {
    const [f] = await db.select().from(follows).where(and(eq(follows.followerId, followerId), eq(follows.channelId, channelId)));
    return f;
  }

  async toggleFollow(followerId: string, channelId: number): Promise<{ following: boolean }> {
    const existing = await this.getFollow(followerId, channelId);
    if (existing) {
      await db.delete(follows).where(eq(follows.id, existing.id));
      await db.update(channels).set({ subscriberCount: sql`GREATEST(0, ${channels.subscriberCount} - 1)` }).where(eq(channels.id, channelId));
      return { following: false };
    } else {
      await db.insert(follows).values({ followerId, channelId });
      await db.update(channels).set({ subscriberCount: sql`${channels.subscriberCount} + 1` }).where(eq(channels.id, channelId));
      return { following: true };
    }
  }

  async getFollowersCount(channelId: number): Promise<number> {
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(follows).where(eq(follows.channelId, channelId));
    return Number(count);
  }

  // ─── AD CAMPAIGNS ─────────────────────────────────────────────
  async getAdCampaigns(advertiserId?: string): Promise<AdCampaign[]> {
    if (advertiserId) {
      return db.select().from(adCampaigns).where(eq(adCampaigns.advertiserId, advertiserId)).orderBy(desc(adCampaigns.createdAt));
    }
    return db.select().from(adCampaigns).orderBy(desc(adCampaigns.createdAt));
  }

  async getAllAdCampaigns(): Promise<AdCampaign[]> {
    return db.select().from(adCampaigns).orderBy(desc(adCampaigns.createdAt));
  }

  async getAdCampaign(id: number): Promise<AdCampaign | undefined> {
    const [c] = await db.select().from(adCampaigns).where(eq(adCampaigns.id, id));
    return c;
  }

  async createAdCampaign(campaign: InsertAdCampaign): Promise<AdCampaign> {
    const embedCode = `<script src="${process.env.REPL_URL || ''}/api/campaigns/embed.js?id=CAMPAIGN_ID&key=${uuidv4().slice(0,8)}" async></script>`;
    const [c] = await db.insert(adCampaigns).values({ ...campaign, embedCode }).returning();
    const code = `<script src="/api/campaigns/embed.js?id=${c.id}&key=${uuidv4().slice(0,8)}" async></script>`;
    const [updated] = await db.update(adCampaigns).set({ embedCode: code }).where(eq(adCampaigns.id, c.id)).returning();
    return updated;
  }

  async updateAdCampaign(id: number, data: Partial<InsertAdCampaign>): Promise<AdCampaign | undefined> {
    const [c] = await db.update(adCampaigns).set(data as any).where(eq(adCampaigns.id, id)).returning();
    return c;
  }

  async getActiveCampaigns(): Promise<AdCampaign[]> {
    return db.select().from(adCampaigns).where(eq(adCampaigns.status, 'active'));
  }

  async recordImpression(campaignId: number, channelId?: number, userId?: string): Promise<void> {
    await db.update(adCampaigns).set({ impressions: sql`${adCampaigns.impressions} + 1` }).where(eq(adCampaigns.id, campaignId));
    const campaign = await this.getAdCampaign(campaignId);
    if (!campaign) return;
    const revenue = campaign.cpmRate / 1000;
    const publisherShare = revenue * campaign.publisherRevShare;
    await db.update(adCampaigns).set({ spent: sql`${adCampaigns.spent} + ${revenue}` }).where(eq(adCampaigns.id, campaignId));
    // Credit publisher if channel known
    if (channelId) {
      const ch = await this.getChannel(channelId);
      if (ch) {
        await db.update(channels).set({ earnings: sql`${channels.earnings} + ${publisherShare}` }).where(eq(channels.id, channelId));
      }
    }
  }

  async recordClick(campaignId: number, channelId?: number, userId?: string): Promise<void> {
    await db.update(adCampaigns).set({ clicks: sql`${adCampaigns.clicks} + 1` }).where(eq(adCampaigns.id, campaignId));
  }

  // ─── REVENUE ──────────────────────────────────────────────────
  async getRevenueTransactions(userId: string): Promise<RevenueTransaction[]> {
    return db.select().from(revenueTransactions).where(eq(revenueTransactions.userId, userId)).orderBy(desc(revenueTransactions.createdAt));
  }

  async getUserBalance(userId: string): Promise<number> {
    const txs = await this.getRevenueTransactions(userId);
    return txs.reduce((sum, tx) => tx.type === 'spending' ? sum - tx.amount : sum + tx.amount, 0);
  }

  async createTransaction(tx: Omit<RevenueTransaction, 'id' | 'createdAt'>): Promise<RevenueTransaction> {
    const [t] = await db.insert(revenueTransactions).values(tx).returning();
    return t;
  }

  // ─── REPORTS ──────────────────────────────────────────────────
  async getReports(status?: string): Promise<Report[]> {
    if (status) {
      return db.select().from(reports).where(eq(reports.status, status as any)).orderBy(desc(reports.createdAt));
    }
    return db.select().from(reports).orderBy(desc(reports.createdAt));
  }

  async createReport(report: InsertReport): Promise<Report> {
    const [r] = await db.insert(reports).values(report).returning();
    return r;
  }

  async updateReport(id: number, status: string, adminNote?: string): Promise<Report | undefined> {
    const [r] = await db.update(reports).set({ status: status as any, adminNote }).where(eq(reports.id, id)).returning();
    return r;
  }

  // ─── FILE UPLOADS ─────────────────────────────────────────────
  async createUploadedFile(file: Omit<UploadedFile, 'id' | 'createdAt'>): Promise<UploadedFile> {
    const [f] = await db.insert(uploadedFiles).values(file).returning();
    return f;
  }

  async getUserFiles(userId: string): Promise<UploadedFile[]> {
    return db.select().from(uploadedFiles).where(eq(uploadedFiles.userId, userId)).orderBy(desc(uploadedFiles.createdAt));
  }

  // ─── ADMIN ────────────────────────────────────────────────────
  async getAllUsers(): Promise<any[]> {
    const { users } = await import("@shared/schema");
    return db.select().from(users).orderBy(desc(users.createdAt));
  }

  async getStats(): Promise<any> {
    const [adsCount] = await db.select({ count: sql<number>`count(*)` }).from(ads);
    const [channelsCount] = await db.select({ count: sql<number>`count(*)` }).from(channels);
    const [streamsCount] = await db.select({ count: sql<number>`count(*)` }).from(liveStreams).where(eq(liveStreams.status, 'live'));
    const [campaignsCount] = await db.select({ count: sql<number>`count(*)` }).from(adCampaigns).where(eq(adCampaigns.status, 'active'));
    const [reportsCount] = await db.select({ count: sql<number>`count(*)` }).from(reports).where(eq(reports.status, 'pending'));
    const [totalImpressions] = await db.select({ total: sql<number>`sum(impressions)` }).from(adCampaigns);
    const [totalRevenue] = await db.select({ total: sql<number>`sum(spent)` }).from(adCampaigns);
    return {
      totalAds: Number(adsCount.count),
      totalChannels: Number(channelsCount.count),
      liveStreams: Number(streamsCount.count),
      activeCampaigns: Number(campaignsCount.count),
      pendingReports: Number(reportsCount.count),
      totalImpressions: Number(totalImpressions?.total || 0),
      totalRevenue: Number(totalRevenue?.total || 0).toFixed(2),
    };
  }
}

export const storage = new DatabaseStorage();
