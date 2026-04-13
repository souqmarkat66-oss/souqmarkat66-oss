import { db, pool } from "./db";
import { 
  ads, channels, liveStreams, chatMessages, likes, comments, follows, 
  adCampaigns, revenueTransactions, reports, uploadedFiles,
  platformSettings, aiUsage, reels, paymentRequests,
  type Ad, type InsertAd, type Channel, type InsertChannel,
  type LiveStream, type InsertLiveStream, type ChatMessage, type Like,
  type Comment, type InsertComment, type Follow, type AdCampaign, 
  type InsertAdCampaign, type RevenueTransaction, type Report, 
  type InsertReport, type UploadedFile, type Reel, type InsertReel,
  type PaymentRequest, type InsertPaymentRequest
} from "@shared/schema";
import { eq, desc, and, sql, ne } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

export interface IStorage {
  // Ads
  getAds(language?: string, userId?: string): Promise<Ad[]>;
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
  recordImpression(campaignId: number, channelId?: number, userId?: string): Promise<{ budgetWarning?: boolean; budgetRatio?: number; advertiserId?: string; campaignName?: string }>;
  recordClick(campaignId: number, channelId?: number, userId?: string): Promise<{ budgetWarning?: boolean; budgetRatio?: number; advertiserId?: string; campaignName?: string }>;

  // Revenue
  getRevenueTransactions(userId: string): Promise<RevenueTransaction[]>;
  getUserBalanceEGP(userId: string): Promise<number>;
  createTransaction(tx: Omit<RevenueTransaction, 'id' | 'createdAt'>): Promise<RevenueTransaction>;

  // Reports
  getReports(status?: string): Promise<Report[]>;
  createReport(report: InsertReport): Promise<Report>;
  updateReport(id: number, status: string, adminNote?: string): Promise<Report | undefined>;

  // File Uploads
  createUploadedFile(file: Omit<UploadedFile, 'id' | 'createdAt'>): Promise<UploadedFile>;
  getUserFiles(userId: string): Promise<UploadedFile[]>;

  // Platform Settings
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;
  getAllSettings(): Promise<Record<string, string>>;

  // AI Usage
  getAiUsageCount(userId: string): Promise<number>;
  recordAiUsage(userId: string, type: string, cost?: number): Promise<void>;

  // Reels
  getReels(userId?: string): Promise<Reel[]>;
  getReel(id: number): Promise<Reel | undefined>;
  createReel(reel: InsertReel): Promise<Reel>;
  updateReel(id: number, data: Partial<InsertReel>): Promise<Reel | undefined>;
  deleteReel(id: number): Promise<void>;

  // Payment Requests
  getPaymentRequests(userId?: string): Promise<PaymentRequest[]>;
  createPaymentRequest(req: InsertPaymentRequest): Promise<PaymentRequest>;
  updatePaymentRequest(id: number, status: string, adminNote?: string): Promise<PaymentRequest | undefined>;

  // Admin
  getAllUsers(): Promise<any[]>;
  getStats(): Promise<any>;
}

export class DatabaseStorage implements IStorage {
  // ─── ADS ──────────────────────────────────────────────────────
  async getAds(language?: string, userId?: string): Promise<Ad[]> {
    if (userId) {
      const rows = await db.execute(
        sql`SELECT * FROM ads WHERE user_id = ${userId} AND (is_admin_promo IS NULL OR is_admin_promo = false) ORDER BY created_at DESC`
      );
      return rows.rows as unknown as Ad[];
    }
    if (language) {
      return db.select().from(ads).where(eq(ads.language, language as any)).orderBy(desc(ads.createdAt));
    }
    return db.select().from(ads).orderBy(desc(ads.createdAt));
  }

  async getAd(id: number): Promise<Ad | undefined> {
    const [ad] = await db.select().from(ads).where(eq(ads.id, id));
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
    if (language) {
      return db.select().from(channels).where(and(eq(channels.status, 'active'), eq(channels.language, language as any))).orderBy(desc(channels.subscriberCount));
    }
    return db.select().from(channels).where(eq(channels.status, 'active')).orderBy(desc(channels.subscriberCount));
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
    const st = status || 'live';
    return db.select().from(liveStreams).where(eq(liveStreams.status, st as any)).orderBy(desc(liveStreams.viewerCount));
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
      if (targetType === 'ad') await db.update(ads).set({ likesCount: sql`GREATEST(0, ${ads.likesCount} - 1)` }).where(eq(ads.id, targetId));
      if (targetType === 'stream') await db.update(liveStreams).set({ likesCount: sql`GREATEST(0, ${liveStreams.likesCount} - 1)` }).where(eq(liveStreams.id, targetId));
      if (targetType === 'reel') await db.update(reels).set({ likesCount: sql`GREATEST(0, ${reels.likesCount} - 1)` }).where(eq(reels.id, targetId));
      return { liked: false };
    } else {
      await db.insert(likes).values({ userId, targetType: targetType as any, targetId });
      if (targetType === 'ad') await db.update(ads).set({ likesCount: sql`${ads.likesCount} + 1` }).where(eq(ads.id, targetId));
      if (targetType === 'stream') await db.update(liveStreams).set({ likesCount: sql`${liveStreams.likesCount} + 1` }).where(eq(liveStreams.id, targetId));
      if (targetType === 'reel') await db.update(reels).set({ likesCount: sql`${reels.likesCount} + 1` }).where(eq(reels.id, targetId));
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
    if (comment.targetType === 'reel') {
      await db.update(reels).set({ commentsCount: sql`${reels.commentsCount} + 1` }).where(eq(reels.id, comment.targetId));
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
    const trackingKey = uuidv4().slice(0, 12);
    const [c] = await db.insert(adCampaigns).values({ ...campaign }).returning();
    const embedCode = `<script src="/api/campaigns/embed.js?id=${c.id}&key=${trackingKey}" async></script>`;
    const clickCode = `<!-- كود تتبع النقرات - Google AdSense Style -->\n<img src="/api/campaigns/${c.id}/click?ref=PUBLISHER_ID" width="1" height="1" style="display:none">`;
    const [updated] = await db.update(adCampaigns).set({ embedCode, clickTrackingCode: clickCode }).where(eq(adCampaigns.id, c.id)).returning();
    return updated;
  }

  async updateAdCampaign(id: number, data: Partial<InsertAdCampaign>): Promise<AdCampaign | undefined> {
    const [c] = await db.update(adCampaigns).set(data as any).where(eq(adCampaigns.id, id)).returning();
    return c;
  }

  async getActiveCampaigns(): Promise<AdCampaign[]> {
    // نُرجع فقط الحملات التي لم تستنزف ميزانيتها بعد
    const all = await db.select().from(adCampaigns).where(eq(adCampaigns.status, 'active'));
    const active: typeof all = [];
    for (const c of all) {
      if (c.budgetEGP && c.budgetEGP > 0 && (c.spentEGP || 0) >= c.budgetEGP) {
        // الميزانية انتهت — أوقف الحملة تلقائياً
        await db.update(adCampaigns).set({ status: 'paused' }).where(eq(adCampaigns.id, c.id));
      } else {
        active.push(c);
      }
    }
    return active;
  }

  // ─── helper: read live platform rates from platform_settings ───
  private async getPlatformRates(): Promise<{ cpmRate: number; cpcRate: number; pubPct: number }> {
    const rows = await db.execute(
      sql`SELECT key, value FROM platform_settings WHERE key IN ('cpm_rate_egp','cpc_rate_egp','publisher_share_pct')`
    );
    const map: Record<string, string> = {};
    for (const r of rows.rows as any[]) map[r.key] = r.value;
    return {
      cpmRate: parseFloat(map['cpm_rate_egp']  || '15'),
      cpcRate: parseFloat(map['cpc_rate_egp']  || '0.75'),
      pubPct:  parseFloat(map['publisher_share_pct'] || '60') / 100,
    };
  }

  async recordImpression(campaignId: number, channelId?: number, userId?: string): Promise<{ budgetWarning?: boolean; budgetRatio?: number; advertiserId?: string; campaignName?: string }> {
    const campaign = await this.getAdCampaign(campaignId);
    if (!campaign) return {};

    // ── أسعار المنصة من لوحة الأدمن (تُحدَّث فوراً) ──
    const { cpmRate, pubPct } = await this.getPlatformRates();
    const revenueEGP = cpmRate / 1000;
    const publisherShareEGP = revenueEGP * pubPct;

    const newSpent = (campaign.spentEGP || 0) + revenueEGP;
    await db.update(adCampaigns).set({
      impressions: sql`${adCampaigns.impressions} + 1`,
      spentEGP: sql`${adCampaigns.spentEGP} + ${revenueEGP}`
    }).where(eq(adCampaigns.id, campaignId));
    if (channelId) {
      const ch = await this.getChannel(channelId);
      if (ch) {
        await db.update(channels).set({ earningsEGP: sql`${channels.earningsEGP} + ${publisherShareEGP}` }).where(eq(channels.id, channelId));
        await db.execute(sql`INSERT INTO revenue_transactions (user_id, type, amount, amount_egp, description, campaign_id, channel_id)
          VALUES (${ch.userId}, 'earning', ${publisherShareEGP}, ${publisherShareEGP}, ${'إيراد إعلان - حملة #' + campaignId + ' (CPM=' + cpmRate + ' ج.م)'}, ${campaignId}, ${channelId})`);
      }
    }
    await db.execute(sql`INSERT INTO revenue_transactions (user_id, type, amount, amount_egp, description, campaign_id)
      VALUES (${campaign.advertiserId}, 'spending', ${revenueEGP}, ${revenueEGP}, ${'تكلفة مشاهدة - حملة ' + campaign.name + ' (CPM=' + cpmRate + ' ج.م)'}, ${campaignId})`);
    const budget = campaign.budgetEGP || 0;
    if (budget > 0) {
      const ratio = newSpent / budget;
      if (ratio >= 0.8) {
        return { budgetWarning: true, budgetRatio: ratio, advertiserId: campaign.advertiserId, campaignName: campaign.name };
      }
    }
    return {};
  }

  async recordClick(campaignId: number, channelId?: number, userId?: string): Promise<{ budgetWarning?: boolean; budgetRatio?: number; advertiserId?: string; campaignName?: string }> {
    const campaign = await this.getAdCampaign(campaignId);
    if (!campaign) return {};

    // ── أسعار المنصة من لوحة الأدمن (تُحدَّث فوراً) ──
    const { cpcRate, pubPct } = await this.getPlatformRates();
    const publisherShareEGP = cpcRate * pubPct;

    await db.update(adCampaigns).set({
      clicks: sql`${adCampaigns.clicks} + 1`,
      spentEGP: sql`${adCampaigns.spentEGP} + ${cpcRate}`
    }).where(eq(adCampaigns.id, campaignId));
    if (channelId) {
      const ch = await this.getChannel(channelId);
      if (ch) {
        await db.update(channels).set({
          earningsEGP: sql`${channels.earningsEGP} + ${publisherShareEGP}`
        }).where(eq(channels.id, channelId));
        await db.execute(sql`INSERT INTO revenue_transactions (user_id, type, amount, amount_egp, description, campaign_id, channel_id)
          VALUES (${ch.userId}, 'earning', ${publisherShareEGP}, ${publisherShareEGP}, ${'إيراد نقرة - حملة #' + campaignId + ' (CPC=' + cpcRate + ' ج.م)'}, ${campaignId}, ${channelId})`);
      }
    }
    await db.execute(sql`INSERT INTO revenue_transactions (user_id, type, amount, amount_egp, description, campaign_id)
      VALUES (${campaign.advertiserId}, 'spending', ${cpcRate}, ${cpcRate}, ${'تكلفة نقرة - حملة ' + campaign.name + ' (CPC=' + cpcRate + ' ج.م)'}, ${campaignId})`);
    const newSpent = (campaign.spentEGP || 0) + cpcRate;
    const budget = campaign.budgetEGP || 0;
    if (budget > 0 && newSpent / budget >= 0.8) {
      return { budgetWarning: true, budgetRatio: newSpent / budget, advertiserId: campaign.advertiserId, campaignName: campaign.name };
    }
    return {};
  }

  // ─── REVENUE ──────────────────────────────────────────────────
  async getRevenueTransactions(userId: string): Promise<RevenueTransaction[]> {
    return db.select().from(revenueTransactions).where(eq(revenueTransactions.userId, userId)).orderBy(desc(revenueTransactions.createdAt));
  }

  async getUserBalanceEGP(userId: string): Promise<number> {
    // Use canonical wallet balance from users.balance_egp (single source of truth)
    const result = await pool.query(
      `SELECT COALESCE(balance_egp, 0) AS balance FROM users WHERE id = $1`,
      [userId]
    );
    return parseFloat(result.rows[0]?.balance || "0");
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

  // ─── PLATFORM SETTINGS ────────────────────────────────────────
  async getSetting(key: string): Promise<string | null> {
    const [s] = await db.select().from(platformSettings).where(eq(platformSettings.key, key));
    return s?.value ?? null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    await db.insert(platformSettings).values({ key, value })
      .onConflictDoUpdate({ target: platformSettings.key, set: { value, updatedAt: new Date() } });
  }

  async getAllSettings(): Promise<Record<string, string>> {
    const settings = await db.select().from(platformSettings);
    return Object.fromEntries(settings.map(s => [s.key, s.value]));
  }

  // ─── AI USAGE ─────────────────────────────────────────────────
  async getAiUsageCount(userId: string): Promise<number> {
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(aiUsage)
      .where(eq(aiUsage.userId, userId));
    return Number(count);
  }

  async recordAiUsage(userId: string, type: string, cost = 0): Promise<void> {
    await db.insert(aiUsage).values({ userId, type: type as any, cost });
  }

  // ─── REELS ────────────────────────────────────────────────────
  async getReels(userId?: string): Promise<Reel[]> {
    if (userId) {
      return db.select().from(reels).where(and(eq(reels.userId, userId), eq(reels.status, 'active'))).orderBy(desc(reels.createdAt));
    }
    return db.select().from(reels).where(eq(reels.status, 'active')).orderBy(desc(reels.createdAt));
  }

  async getReel(id: number): Promise<Reel | undefined> {
    const [r] = await db.select().from(reels).where(eq(reels.id, id));
    if (r) {
      await db.update(reels).set({ viewsCount: sql`${reels.viewsCount} + 1` }).where(eq(reels.id, id));
    }
    return r;
  }

  async createReel(reel: InsertReel): Promise<Reel> {
    const [r] = await db.insert(reels).values(reel).returning();
    return r;
  }

  async updateReel(id: number, data: Partial<InsertReel>): Promise<Reel | undefined> {
    const [r] = await db.update(reels).set(data as any).where(eq(reels.id, id)).returning();
    return r;
  }

  async deleteReel(id: number): Promise<void> {
    await db.delete(reels).where(eq(reels.id, id));
  }

  // ─── PAYMENT REQUESTS ─────────────────────────────────────────
  async getPaymentRequests(userId?: string): Promise<PaymentRequest[]> {
    if (userId) {
      return db.select().from(paymentRequests).where(eq(paymentRequests.userId, userId)).orderBy(desc(paymentRequests.createdAt));
    }
    return db.select().from(paymentRequests).orderBy(desc(paymentRequests.createdAt));
  }

  async createPaymentRequest(req: InsertPaymentRequest): Promise<PaymentRequest> {
    const [r] = await db.insert(paymentRequests).values(req).returning();
    return r;
  }

  async updatePaymentRequest(id: number, status: string, adminNote?: string): Promise<PaymentRequest | undefined> {
    const [r] = await db.update(paymentRequests).set({ status: status as any, adminNote }).where(eq(paymentRequests.id, id)).returning();
    return r;
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
    const [reelsCount] = await db.select({ count: sql<number>`count(*)` }).from(reels);
    const [totalImpressions] = await db.select({ total: sql<number>`sum(impressions)` }).from(adCampaigns);
    const [totalRevenueEGP] = await db.select({ total: sql<number>`sum(spent_egp)` }).from(adCampaigns);
    const [pendingPayments] = await db.select({ count: sql<number>`count(*)` }).from(paymentRequests).where(eq(paymentRequests.status, 'pending'));
    return {
      totalAds: Number(adsCount.count),
      totalChannels: Number(channelsCount.count),
      liveStreams: Number(streamsCount.count),
      activeCampaigns: Number(campaignsCount.count),
      pendingReports: Number(reportsCount.count),
      totalReels: Number(reelsCount.count),
      totalImpressions: Number(totalImpressions.total || 0),
      totalRevenueEGP: Number(totalRevenueEGP.total || 0),
      pendingPayments: Number(pendingPayments.count),
    };
  }
}

export const storage = new DatabaseStorage();
