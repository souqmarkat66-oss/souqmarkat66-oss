import { db } from "./db";
import { 
  ads, channels, liveStreams, chatMessages, likes, comments, follows, 
  adCampaigns, revenueTransactions, reports, uploadedFiles,
  platformSettings, aiUsage, aiCreditWallets, reels, paymentRequests, paymentServiceDeliveries, tickerAds,
  type Ad, type InsertAd, type Channel, type InsertChannel,
  type LiveStream, type InsertLiveStream, type ChatMessage, type Like,
  type Comment, type InsertComment, type Follow, type AdCampaign, 
  type InsertAdCampaign, type RevenueTransaction, type Report, 
  type InsertReport, type UploadedFile, type Reel, type InsertReel,
  type PaymentRequest, type InsertPaymentRequest, type PaymentServiceDelivery,
  type TickerAd, type InsertTickerAd
} from "@shared/schema";
import { eq, desc, and, sql, ne, gte, lte, inArray } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { walletEmitter } from "./wallet-events";
import { parseLedgerAmount } from "./wallet-ledger";
import { AUTOMATIC_MANUAL_SERVICES, parseManualServices } from "./manual-payment";
import { canonicalPaymentReference, canonicalPaymentReferenceSql, outgoingTransferReferenceLockKey } from "./payment-proof";

// Legacy conversational rows were historically recorded in ai_usage but were
// never a billable AI-tool credit. Only these tool types consume free,
// purchased, or EGP-backed AI credits.
const BILLABLE_AI_USAGE_TYPES = ["image", "copy", "video_script", "article", "tts", "avatar", "video"] as const;

function labelLegacyPaymentForRead(payment: PaymentRequest): PaymentRequest {
  return payment.status === "approved" && !payment.fulfillmentStatus
    ? { ...payment, fulfillmentStatus: "legacy_review" }
    : payment;
}

export type AiCreditConsumptionResult = {
  consumed: boolean;
  source: "free" | "purchased" | "wallet";
  remainingPurchasedCredits: number;
  walletBalanceEGP?: number;
};

/**
 * Transaction-owned variant for long-running AI providers: callers perform
 * their idempotent completion update and the debit in one transaction. `tx`
 * is intentionally structural so route/job modules need not couple to a
 * Drizzle dialect-specific transaction type.
 */
export async function consumeAiCreditAtomicInTransaction(
  tx: any,
  userId: string,
  type: string,
  freeCredits: number,
  walletPriceEGP: number,
  description: string,
): Promise<AiCreditConsumptionResult> {
  if (!BILLABLE_AI_USAGE_TYPES.includes(type as typeof BILLABLE_AI_USAGE_TYPES[number])) {
    throw new Error("Invalid billable AI usage type");
  }
  const allowedFreeCredits = Math.max(0, Math.floor(freeCredits));
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${'ai-credit:' + userId}, 0))`);
  const [usage] = await tx.select({ count: sql<string>`COUNT(*)::text` })
    .from(aiUsage)
    .where(and(eq(aiUsage.userId, userId), inArray(aiUsage.type, [...BILLABLE_AI_USAGE_TYPES])));
  const uses = Number(usage?.count || 0);
  if (uses < allowedFreeCredits) {
    await tx.insert(aiUsage).values({ userId, type: type as any, creditsUsed: 1, cost: 0 });
    const [wallet] = await tx.select({ balance: aiCreditWallets.balance })
      .from(aiCreditWallets)
      .where(eq(aiCreditWallets.userId, userId));
    return { consumed: true, source: "free", remainingPurchasedCredits: Number(wallet?.balance || 0) };
  }
  const [wallet] = await tx.update(aiCreditWallets)
    .set({
      balance: sql`${aiCreditWallets.balance} - 1`,
      totalConsumed: sql`${aiCreditWallets.totalConsumed} + 1`,
      updatedAt: new Date(),
    })
    .where(and(eq(aiCreditWallets.userId, userId), gte(aiCreditWallets.balance, 1)))
    .returning({ balance: aiCreditWallets.balance });
  if (wallet) {
    await tx.insert(aiUsage).values({ userId, type: type as any, creditsUsed: 1, cost: 0 });
    return { consumed: true, source: "purchased", remainingPurchasedCredits: wallet.balance };
  }

  const walletPrice = parseLedgerAmount(walletPriceEGP, "AI wallet price");
  if (walletPrice <= 0) throw new Error("سعر استخدام الذكاء الاصطناعي غير صالح");
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${'wallet:' + userId}, 0))`);
  const [balanceRow] = await tx.select({
    balance: sql<string>`COALESCE(SUM(
      CASE
        WHEN ${revenueTransactions.type} IN ('earning', 'wallet_recharge') THEN ${revenueTransactions.amountEGP}
        WHEN ${revenueTransactions.type} IN ('spending', 'withdrawal', 'ai_charge') THEN -${revenueTransactions.amountEGP}
        ELSE 0
      END
    ), 0)::numeric`,
  }).from(revenueTransactions).where(eq(revenueTransactions.userId, userId));
  const walletBalanceEGP = parseLedgerAmount(balanceRow?.balance ?? 0, "AI wallet balance");
  if (walletBalanceEGP < walletPrice) {
    return { consumed: false, source: "wallet", remainingPurchasedCredits: 0, walletBalanceEGP };
  }
  await tx.insert(revenueTransactions).values({
    userId,
    type: "ai_charge",
    amountEGP: walletPrice,
    description,
    campaignId: null,
    channelId: null,
  });
  await tx.insert(aiUsage).values({ userId, type: type as any, creditsUsed: 1, cost: walletPrice });
  return {
    consumed: true,
    source: "wallet",
    remainingPurchasedCredits: 0,
    walletBalanceEGP: walletBalanceEGP - walletPrice,
  };
}

export interface IStorage {
  // Ads
  getAds(language?: string, userId?: string): Promise<Ad[]>;
  getAd(id: number): Promise<Ad | undefined>;
  createAd(ad: InsertAd): Promise<Ad>;
  createAdWithWalletDebitAtomic(
    ad: InsertAd,
    amountEGP: number,
    description: string,
    expiresAt: Date,
  ): Promise<{ ad?: Ad; success: boolean; balance: number }>;
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
  getRevenueTransactions(userId: string, options?: { limit?: number; offset?: number; type?: 'earning' | 'spending' | 'withdrawal' | 'ai_charge' | 'wallet_recharge'; channelId?: number; from?: Date; to?: Date }): Promise<RevenueTransaction[]>;
  getRevenueTotals(userId: string, options?: { channelId?: number }): Promise<{ earning: number; spending: number; withdrawal: number; ai_charge: number; wallet_recharge: number }>;
  getUserBalanceEGP(userId: string): Promise<number>;
  debitWalletAtomic(userId: string, amountEGP: number, type: 'spending' | 'ai_charge', description: string): Promise<{ success: boolean; balance: number }>;
  getWithdrawableBalanceEGP(userId: string): Promise<number>;
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
  getAiCreditBalance(userId: string): Promise<number>;
  consumeAiCreditAtomic(userId: string, type: string, freeCredits: number, walletPriceEGP: number, description: string): Promise<{ consumed: boolean; source: 'free' | 'purchased' | 'wallet'; remainingPurchasedCredits: number; walletBalanceEGP?: number }>;

  // Reels
  getReels(userId?: string): Promise<Reel[]>;
  getReel(id: number): Promise<Reel | undefined>;
  createReel(reel: InsertReel): Promise<Reel>;
  updateReel(id: number, data: Partial<InsertReel>): Promise<Reel | undefined>;
  deleteReel(id: number): Promise<void>;

  // Payment Requests
  getPaymentRequests(userId?: string): Promise<PaymentRequest[]>;
  getPaymentServiceDeliveries(paymentRequestId: number): Promise<PaymentServiceDelivery[]>;
  createPaymentRequest(req: InsertPaymentRequest): Promise<PaymentRequest>;
  approvePaymentRequestAtomic(id: number, adminNote?: string, transferReference?: string, adminUserId?: string): Promise<{ payment: PaymentRequest | undefined; alreadyProcessed: boolean; insufficientBalance?: boolean; currentBalanceEGP?: number; transferReferenceRequired?: boolean; transferReferenceDuplicate?: boolean }>;
  completePaymentServiceDeliveryAtomic(paymentRequestId: number, serviceType: string, adminUserId: string, deliveryNote?: string, deliveryResult?: string): Promise<{ payment: PaymentRequest | undefined; delivery: PaymentServiceDelivery | undefined; alreadyCompleted: boolean }>;
  rejectPaymentRequestAtomic(id: number, adminNote?: string): Promise<{ payment: PaymentRequest | undefined; alreadyProcessed: boolean }>;

  // Ticker Ads
  createTickerAd(data: InsertTickerAd): Promise<TickerAd>;
  getTickerAd(id: number): Promise<TickerAd | undefined>;
  getMyTickerAds(advertiserId: string): Promise<TickerAd[]>;
  getAllTickerAds(status?: string): Promise<TickerAd[]>;
  getActiveTickerAds(): Promise<TickerAd[]>;
  updateTickerAd(id: number, data: Partial<TickerAd>): Promise<TickerAd | undefined>;
  deleteTickerAd(id: number): Promise<void>;
  deductTickerAdSecond(id: number, amountEGP: number): Promise<TickerAd | undefined>;
  deductTickerAdSecondAtomic(params: { adId: number; amountEGP: number; advertiserId: string; adminUserId: string; chargeAdvertiser: boolean; creditAdmin: boolean; }): Promise<TickerAd | undefined>;

  // Subscription
  updateUserSubscription(userId: string, endsAt: Date): Promise<void>;
  getUserSubscriptionInfo(userId: string): Promise<{ createdAt: Date; subscriptionEndsAt: Date | null }>;

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

  async createAdWithWalletDebitAtomic(
    insertAd: InsertAd,
    amountEGP: number,
    description: string,
    expiresAt: Date,
  ): Promise<{ ad?: Ad; success: boolean; balance: number }> {
    const amount = parseLedgerAmount(amountEGP, "debit amount");
    if (amount <= 0) throw new Error("createAdWithWalletDebitAtomic: المبلغ يجب أن يكون أكبر من صفر");
    return await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${'wallet:' + insertAd.userId}, 0))`);
      const [row] = await tx
        .select({
          balance: sql<string>`COALESCE(SUM(
            CASE
              WHEN ${revenueTransactions.type} IN ('earning', 'wallet_recharge') THEN ${revenueTransactions.amountEGP}
              WHEN ${revenueTransactions.type} IN ('spending', 'withdrawal', 'ai_charge') THEN -${revenueTransactions.amountEGP}
              ELSE 0
            END
          ), 0)::numeric`,
        })
        .from(revenueTransactions)
        .where(eq(revenueTransactions.userId, insertAd.userId));
      const balance = parseLedgerAmount(row?.balance ?? 0, "wallet balance");
      if (balance < amount) return { success: false, balance };
      await tx.insert(revenueTransactions).values({
        userId: insertAd.userId,
        type: "spending",
        amountEGP: amount,
        description,
        campaignId: null,
        channelId: null,
      });
      const [ad] = await tx.insert(ads).values(insertAd).returning();
      await tx.execute(sql`UPDATE ads SET expires_at = ${expiresAt} WHERE id = ${ad.id}`);
      return { ad, success: true, balance: balance - amount };
    });
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
    // ── أسعار المنصة من لوحة الأدمن (تُحدَّث فوراً) ──
    const { cpmRate, pubPct } = await this.getPlatformRates();
    const revenueEGP = cpmRate / 1000;
    const publisherShareEGP = revenueEGP * pubPct;

    return await db.transaction(async (tx) => {
      // Lock the campaign row to prevent races with concurrent
      // impression/click recording or admin pause/budget updates.
      const [locked] = await tx
        .select()
        .from(adCampaigns)
        .where(eq(adCampaigns.id, campaignId))
        .for("update");
      if (!locked) return {};
      // If the campaign is no longer active, or its budget is exhausted,
      // do not charge for this impression.
      if (locked.status !== 'active') return {};
      // Serialize wallet debits across every campaign owned by this
      // advertiser. A campaign may only spend verified EGP wallet funds.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${'wallet:' + locked.advertiserId}, 0))`);
      const currentSpent = locked.spentEGP || 0;
      const budget = locked.budgetEGP || 0;
      if (budget > 0 && currentSpent + revenueEGP > budget) {
        await tx.update(adCampaigns).set({ status: 'paused' }).where(eq(adCampaigns.id, campaignId));
        return {};
      }
      const [wallet] = await tx.select({
        balance: sql<string>`COALESCE(SUM(CASE
          WHEN ${revenueTransactions.type} IN ('earning', 'wallet_recharge') THEN ${revenueTransactions.amountEGP}
          WHEN ${revenueTransactions.type} IN ('spending', 'withdrawal', 'ai_charge') THEN -${revenueTransactions.amountEGP}
        ELSE 0 END), 0)::numeric`,
      }).from(revenueTransactions).where(eq(revenueTransactions.userId, locked.advertiserId));
      if (parseLedgerAmount(wallet?.balance ?? 0, "wallet balance") < revenueEGP) {
        await tx.update(adCampaigns).set({ status: 'paused' }).where(eq(adCampaigns.id, campaignId));
        return {};
      }

      const newSpent = currentSpent + revenueEGP;
      await tx.update(adCampaigns).set({
        impressions: sql`${adCampaigns.impressions} + 1`,
        spentEGP: sql`${adCampaigns.spentEGP} + ${revenueEGP}`,
      }).where(eq(adCampaigns.id, campaignId));

      if (channelId) {
        const [ch] = await tx.select().from(channels).where(eq(channels.id, channelId)).for("update");
        if (ch) {
          await tx.update(channels).set({
            earningsEGP: sql`${channels.earningsEGP} + ${publisherShareEGP}`,
          }).where(eq(channels.id, channelId));
          await tx.insert(revenueTransactions).values({
            userId: ch.userId,
            type: "earning",
            amountEGP: publisherShareEGP,
            description: `إيراد إعلان - حملة #${campaignId} (CPM=${cpmRate} ج.م)`,
            campaignId,
            channelId,
          });
        }
      }
      await tx.insert(revenueTransactions).values({
        userId: locked.advertiserId,
        type: "spending",
        amountEGP: revenueEGP,
        description: `تكلفة مشاهدة - حملة ${locked.name} (CPM=${cpmRate} ج.م)`,
        campaignId,
        channelId: null,
      });

      if (budget > 0) {
        const ratio = newSpent / budget;
        if (ratio >= 0.8) {
          return { budgetWarning: true, budgetRatio: ratio, advertiserId: locked.advertiserId, campaignName: locked.name };
        }
      }
      return {};
    });
  }

  async recordClick(campaignId: number, channelId?: number, userId?: string): Promise<{ budgetWarning?: boolean; budgetRatio?: number; advertiserId?: string; campaignName?: string }> {
    // ── أسعار المنصة من لوحة الأدمن (تُحدَّث فوراً) ──
    const { cpcRate, pubPct } = await this.getPlatformRates();
    const publisherShareEGP = cpcRate * pubPct;

    return await db.transaction(async (tx) => {
      const [locked] = await tx
        .select()
        .from(adCampaigns)
        .where(eq(adCampaigns.id, campaignId))
        .for("update");
      if (!locked) return {};
      if (locked.status !== 'active') return {};
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${'wallet:' + locked.advertiserId}, 0))`);
      const currentSpent = locked.spentEGP || 0;
      const budget = locked.budgetEGP || 0;
      if (budget > 0 && currentSpent + cpcRate > budget) {
        await tx.update(adCampaigns).set({ status: 'paused' }).where(eq(adCampaigns.id, campaignId));
        return {};
      }
      const [wallet] = await tx.select({
        balance: sql<string>`COALESCE(SUM(CASE
          WHEN ${revenueTransactions.type} IN ('earning', 'wallet_recharge') THEN ${revenueTransactions.amountEGP}
          WHEN ${revenueTransactions.type} IN ('spending', 'withdrawal', 'ai_charge') THEN -${revenueTransactions.amountEGP}
        ELSE 0 END), 0)::numeric`,
      }).from(revenueTransactions).where(eq(revenueTransactions.userId, locked.advertiserId));
      if (parseLedgerAmount(wallet?.balance ?? 0, "wallet balance") < cpcRate) {
        await tx.update(adCampaigns).set({ status: 'paused' }).where(eq(adCampaigns.id, campaignId));
        return {};
      }

      const newSpent = currentSpent + cpcRate;
      await tx.update(adCampaigns).set({
        clicks: sql`${adCampaigns.clicks} + 1`,
        spentEGP: sql`${adCampaigns.spentEGP} + ${cpcRate}`,
      }).where(eq(adCampaigns.id, campaignId));

      if (channelId) {
        const [ch] = await tx.select().from(channels).where(eq(channels.id, channelId)).for("update");
        if (ch) {
          await tx.update(channels).set({
            earningsEGP: sql`${channels.earningsEGP} + ${publisherShareEGP}`,
          }).where(eq(channels.id, channelId));
          await tx.insert(revenueTransactions).values({
            userId: ch.userId,
            type: "earning",
            amountEGP: publisherShareEGP,
            description: `إيراد نقرة - حملة #${campaignId} (CPC=${cpcRate} ج.م)`,
            campaignId,
            channelId,
          });
        }
      }
      await tx.insert(revenueTransactions).values({
        userId: locked.advertiserId,
        type: "spending",
        amountEGP: cpcRate,
        description: `تكلفة نقرة - حملة ${locked.name} (CPC=${cpcRate} ج.م)`,
        campaignId,
        channelId: null,
      });

      if (budget > 0 && newSpent / budget >= 0.8) {
        return { budgetWarning: true, budgetRatio: newSpent / budget, advertiserId: locked.advertiserId, campaignName: locked.name };
      }
      return {};
    });
  }

  // ─── REVENUE ──────────────────────────────────────────────────
  async getRevenueTransactions(
    userId: string,
    options: { limit?: number; offset?: number; type?: 'earning' | 'spending' | 'withdrawal' | 'ai_charge' | 'wallet_recharge'; channelId?: number; from?: Date; to?: Date } = {}
  ): Promise<RevenueTransaction[]> {
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
    const offset = Math.max(options.offset ?? 0, 0);
    const conds = [eq(revenueTransactions.userId, userId)];
    if (options.type) conds.push(eq(revenueTransactions.type, options.type));
    if (options.channelId !== undefined) conds.push(eq(revenueTransactions.channelId, options.channelId));
    if (options.from) conds.push(gte(revenueTransactions.createdAt, options.from));
    if (options.to) conds.push(lte(revenueTransactions.createdAt, options.to));
    return db.select().from(revenueTransactions)
      .where(and(...conds))
      .orderBy(desc(revenueTransactions.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getRevenueTotals(
    userId: string,
    options: { channelId?: number } = {}
  ): Promise<{ earning: number; spending: number; withdrawal: number; ai_charge: number; wallet_recharge: number }> {
    const conds = [eq(revenueTransactions.userId, userId)];
    if (options.channelId !== undefined) conds.push(eq(revenueTransactions.channelId, options.channelId));
    const [row] = await db
      .select({
        earning: sql<number>`COALESCE(SUM(CASE WHEN ${revenueTransactions.type} = 'earning' THEN ${revenueTransactions.amountEGP} ELSE 0 END), 0)`,
        spending: sql<number>`COALESCE(SUM(CASE WHEN ${revenueTransactions.type} = 'spending' THEN ${revenueTransactions.amountEGP} ELSE 0 END), 0)`,
        withdrawal: sql<number>`COALESCE(SUM(CASE WHEN ${revenueTransactions.type} = 'withdrawal' THEN ${revenueTransactions.amountEGP} ELSE 0 END), 0)`,
        ai_charge: sql<number>`COALESCE(SUM(CASE WHEN ${revenueTransactions.type} = 'ai_charge' THEN ${revenueTransactions.amountEGP} ELSE 0 END), 0)`,
        wallet_recharge: sql<number>`COALESCE(SUM(CASE WHEN ${revenueTransactions.type} = 'wallet_recharge' THEN ${revenueTransactions.amountEGP} ELSE 0 END), 0)`,
      })
      .from(revenueTransactions)
      .where(and(...conds));
    return {
      earning: parseLedgerAmount(row?.earning ?? 0, "earning total"),
      spending: parseLedgerAmount(row?.spending ?? 0, "spending total"),
      withdrawal: parseLedgerAmount(row?.withdrawal ?? 0, "withdrawal total"),
      ai_charge: parseLedgerAmount(row?.ai_charge ?? 0, "AI charge total"),
      wallet_recharge: parseLedgerAmount(row?.wallet_recharge ?? 0, "wallet recharge total"),
    };
  }

  async getUserBalanceEGP(userId: string): Promise<number> {
    const [row] = await db
      .select({
        // wallet_recharge = إيداع (موجب) مثل earning
        balance: sql<string>`COALESCE(SUM(
          CASE
            WHEN ${revenueTransactions.type} IN ('earning', 'wallet_recharge') THEN ${revenueTransactions.amountEGP}
            WHEN ${revenueTransactions.type} IN ('spending', 'withdrawal', 'ai_charge') THEN -${revenueTransactions.amountEGP}
            ELSE 0
          END
        ), 0)::numeric`,
      })
      .from(revenueTransactions)
      .where(eq(revenueTransactions.userId, userId));
    return parseLedgerAmount(row?.balance ?? 0, "wallet balance");
  }

  async debitWalletAtomic(
    userId: string,
    amountEGP: number,
    type: 'spending' | 'ai_charge',
    description: string,
  ): Promise<{ success: boolean; balance: number }> {
    const amount = parseLedgerAmount(amountEGP, "debit amount");
    if (amount <= 0) {
      throw new Error("debitWalletAtomic: المبلغ يجب أن يكون أكبر من صفر");
    }
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${'wallet:' + userId}, 0))`);
      const [row] = await tx
        .select({
          balance: sql<string>`COALESCE(SUM(
            CASE
              WHEN ${revenueTransactions.type} IN ('earning', 'wallet_recharge') THEN ${revenueTransactions.amountEGP}
              WHEN ${revenueTransactions.type} IN ('spending', 'withdrawal', 'ai_charge') THEN -${revenueTransactions.amountEGP}
              ELSE 0
            END
          ), 0)::numeric`,
        })
        .from(revenueTransactions)
        .where(eq(revenueTransactions.userId, userId));
      const balance = parseLedgerAmount(row?.balance ?? 0, "wallet balance");
      if (balance < amount) return { success: false, balance };
      await tx.insert(revenueTransactions).values({
        userId,
        type,
        amountEGP: amount,
        description,
        campaignId: null,
        channelId: null,
      });
      return { success: true, balance: balance - amount };
    });
    if (result.success) {
      walletEmitter.emit("wallet:update", {
        userId,
        amountEGP: amount,
        type,
        description,
        newBalance: result.balance,
      });
    }
    return result;
  }

  async getWithdrawableBalanceEGP(userId: string): Promise<number> {
    const [row] = await db
      .select({
        balance: sql<string>`COALESCE(SUM(
          CASE
            WHEN ${revenueTransactions.type} = 'earning' THEN ${revenueTransactions.amountEGP}
            WHEN ${revenueTransactions.type} IN ('spending', 'withdrawal', 'ai_charge') THEN -${revenueTransactions.amountEGP}
            ELSE 0
          END
        ), 0)::numeric`,
      })
      .from(revenueTransactions)
      .where(eq(revenueTransactions.userId, userId));
    return Math.max(0, parseLedgerAmount(row?.balance ?? 0, "withdrawable balance"));
  }

  async createTransaction(tx: Omit<RevenueTransaction, 'id' | 'createdAt'>): Promise<RevenueTransaction> {
    // ── الحارس: لا خصم بقيمة صفر أو سالب ──────────────────────
    if (tx.amountEGP === undefined || tx.amountEGP === null) {
      throw new Error("createTransaction: amountEGP مطلوب");
    }
    const amount = parseLedgerAmount(tx.amountEGP, "transaction amount");
    if (amount <= 0) {
      throw new Error("createTransaction: المبلغ يجب أن يكون أكبر من صفر");
    }

    // ── تسجيل المعاملة في قاعدة البيانات ────────────────────────
    const [t] = await db.insert(revenueTransactions).values(tx).returning();

    // ── حساب الرصيد الجديد وإطلاق حدث لحظي ─────────────────────
    try {
      const newBalance = await this.getUserBalanceEGP(tx.userId);
      walletEmitter.emit("wallet:update", {
        userId: tx.userId,
        amountEGP: amount,
        type: tx.type,
        description: tx.description ?? null,
        newBalance,
      });
    } catch {
      // الـ emit اختياري — لا نوقف العملية لو فشل
    }

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
      .where(and(eq(aiUsage.userId, userId), inArray(aiUsage.type, [...BILLABLE_AI_USAGE_TYPES])));
    return Number(count);
  }

  async recordAiUsage(userId: string, type: string, cost = 0): Promise<void> {
    await db.insert(aiUsage).values({ userId, type: type as any, cost });
  }

  async getAiCreditBalance(userId: string): Promise<number> {
    const [wallet] = await db.select({ balance: aiCreditWallets.balance })
      .from(aiCreditWallets)
      .where(eq(aiCreditWallets.userId, userId));
    return Number(wallet?.balance || 0);
  }

  /**
   * Consume either an earned free use or one specifically purchased AI credit.
   * The usage row and purchased-credit decrement share one transaction and
   * advisory lock, so concurrent tool calls can never overspend credits.
   */
  async consumeAiCreditAtomic(
    userId: string,
    type: string,
    freeCredits: number,
    walletPriceEGP: number,
    description: string,
  ): Promise<{ consumed: boolean; source: 'free' | 'purchased' | 'wallet'; remainingPurchasedCredits: number; walletBalanceEGP?: number }> {
    return db.transaction((tx) =>
      consumeAiCreditAtomicInTransaction(tx, userId, type, freeCredits, walletPriceEGP, description),
    );
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
      const payments = await db.select().from(paymentRequests).where(eq(paymentRequests.userId, userId)).orderBy(desc(paymentRequests.createdAt));
      return payments.map(labelLegacyPaymentForRead);
    }
    const payments = await db.select().from(paymentRequests).orderBy(desc(paymentRequests.createdAt));
    return payments.map(labelLegacyPaymentForRead);
  }

  async getPaymentServiceDeliveries(paymentRequestId: number): Promise<PaymentServiceDelivery[]> {
    return db.select().from(paymentServiceDeliveries)
      .where(eq(paymentServiceDeliveries.paymentRequestId, paymentRequestId))
      .orderBy(paymentServiceDeliveries.id);
  }

  async createPaymentRequest(req: InsertPaymentRequest): Promise<PaymentRequest> {
    const [r] = await db.insert(paymentRequests).values(req).returning();
    return r;
  }

  /**
   * Approve a payment request and write the matching revenue transaction
   * in a single DB transaction so the wallet ledger never drifts.
   * Locks the row and is idempotent: if it's already approved/rejected
   * the existing record is returned and no extra ledger entry is written.
   */
  async approvePaymentRequestAtomic(
    id: number,
    adminNote?: string,
    transferReference?: string,
    adminUserId?: string,
  ): Promise<{ payment: PaymentRequest | undefined; alreadyProcessed: boolean; insufficientBalance?: boolean; currentBalanceEGP?: number; transferReferenceRequired?: boolean; transferReferenceDuplicate?: boolean }> {
    return await db.transaction(async (tx) => {
      const [locked] = await tx
        .select()
        .from(paymentRequests)
        .where(eq(paymentRequests.id, id))
        .for("update");
      if (!locked) return { payment: undefined, alreadyProcessed: false };
      if (locked.status !== 'pending') {
        return { payment: locked, alreadyProcessed: true };
      }

      let canonicalTransferReference: string | null = null;
      if (locked.type === 'withdrawal') {
        canonicalTransferReference = canonicalPaymentReference(transferReference);
        if (!canonicalTransferReference || transferReference!.trim().length > 160) {
          return { payment: locked, alreadyProcessed: false, transferReferenceRequired: true };
        }
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${outgoingTransferReferenceLockKey(canonicalTransferReference)}, 0))`);
        // Serialize concurrent withdrawal approvals for the same user
        // by acquiring a transaction-scoped advisory lock keyed by userId.
        // Uses hashtextextended to map the userId string to a bigint key.
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${'wallet:' + locked.userId}, 0))`);

        const [balRow] = await tx
          .select({
            balance: sql<string>`COALESCE(SUM(CASE WHEN ${revenueTransactions.type} = 'earning' THEN ${revenueTransactions.amountEGP} WHEN ${revenueTransactions.type} IN ('spending', 'withdrawal', 'ai_charge') THEN -${revenueTransactions.amountEGP} ELSE 0 END), 0)::numeric`,
          })
          .from(revenueTransactions)
          .where(eq(revenueTransactions.userId, locked.userId));
        const currentBalanceEGP = parseLedgerAmount(balRow?.balance ?? 0, "wallet balance");
        const requested = parseLedgerAmount(locked.amountEGP ?? 0, "withdrawal amount");
        if (requested > currentBalanceEGP) {
          return { payment: locked, alreadyProcessed: false, insufficientBalance: true, currentBalanceEGP };
        }
        const legacyReferenceUse = await tx.execute(sql`
          SELECT id
          FROM payment_requests
          WHERE type = 'withdrawal'
            AND id <> ${locked.id}
            AND ${sql.raw(canonicalPaymentReferenceSql("transfer_reference"))} = ${canonicalTransferReference}
          LIMIT 1
        `);
        if (legacyReferenceUse.rows.length > 0) {
          return { payment: locked, alreadyProcessed: false, transferReferenceDuplicate: true };
        }
        // Claim only after the balance check. Returning early from a Drizzle
        // transaction commits, so claiming first would poison a retriable
        // insufficient-funds request.
        const claimed = await tx.execute(sql`
          INSERT INTO manual_payment_reference_claims (flow, canonical_reference, source_type, source_id)
          VALUES ('outgoing', ${canonicalTransferReference}, 'payment_request', ${locked.id})
          ON CONFLICT (flow, canonical_reference) DO NOTHING
          RETURNING canonical_reference
        `);
        if (claimed.rows.length !== 1) {
          return { payment: locked, alreadyProcessed: false, transferReferenceDuplicate: true };
        }
      }

      let fulfillmentStatus: string | null = null;
      let fulfilledAt: Date | null = null;
      if (locked.type === 'withdrawal') {
        await tx.insert(revenueTransactions).values({
          userId: locked.userId,
          type: 'withdrawal',
          amountEGP: locked.amountEGP,
          description: `سحب رصيد - ${locked.method}`,
          campaignId: null,
          channelId: null,
        });
        fulfillmentStatus = 'fulfilled';
        fulfilledAt = new Date();
      } else if (locked.type === 'top_up') {
        const services = parseManualServices(locked.serviceType);
        const quantity = Math.max(1, Number(locked.serviceQuantity || 1));
        if (
          quantity > 1
          && !(
            services.length === 1
            && (services[0] === "ai_credits" || services[0] === "coin_package")
          )
        ) {
          throw new Error("الكمية الأكبر من واحد متاحة فقط لرصيد الذكاء الاصطناعي أو الكمية المحسوبة لباقة العملات");
        }
        // Wallet credit must always be explicit. A malformed or legacy request
        // without a service marker must not silently mint spendable balance.
        if (services.length === 0) {
          throw new Error("طلب الدفع لا يحدد شحن محفظة أو خدمة");
        }
        const isWalletRecharge = services.length === 1 && services[0] === "wallet_recharge";
        if (services.includes("wallet_recharge") && !isWalletRecharge) {
          throw new Error("لا يمكن جمع شحن المحفظة مع شراء خدمة في طلب واحد");
        }
        if (isWalletRecharge) {
          await tx.insert(revenueTransactions).values({
            userId: locked.userId,
            type: 'wallet_recharge',
            amountEGP: locked.amountEGP,
            description: `شحن رصيد - ${locked.method}`,
            campaignId: null,
            channelId: null,
          });
          fulfillmentStatus = 'fulfilled';
          fulfilledAt = new Date();
          await tx.insert(paymentServiceDeliveries).values({
            paymentRequestId: locked.id,
            serviceType: "wallet_recharge",
            status: "completed",
            deliveryNote: "تم شحن رصيد المحفظة تلقائياً بعد اعتماد الإدارة",
            deliveryResult: `${Number(locked.amountEGP).toFixed(2)} EGP`,
            completedBy: adminUserId || null,
            completedAt: fulfilledAt,
          });
        } else {
          let completedCount = 0;
          for (const service of services) {
            let deliveryNote: string | null = null;
            let deliveryResult: string | null = null;
            if (service === 'ad_boost') {
              if (!locked.adId) throw new Error("طلب تعزيز الإعلان غير مرتبط بإعلان");
              const result = await tx.execute(sql`
                UPDATE ads
                SET is_boosted = true,
                    boosted_until = GREATEST(COALESCE(boosted_until, NOW()), NOW()) + (${quantity} * INTERVAL '30 days')
                WHERE id = ${locked.adId} AND user_id = ${locked.userId}
                RETURNING id
              `);
              if (result.rows.length === 0) throw new Error("تعذر العثور على الإعلان المطلوب تعزيزه");
              deliveryNote = "تم تعزيز الإعلان تلقائياً";
              deliveryResult = `مدة التعزيز: ${quantity * 30} يوماً`;
            } else if (service === 'renewal') {
              if (!locked.adId) throw new Error("طلب تجديد الإعلان غير مرتبط بإعلان");
              const result = await tx.execute(sql`
                UPDATE ads
                SET status = 'active',
                    expires_at = GREATEST(COALESCE(expires_at, NOW()), NOW()) + (${quantity} * INTERVAL '30 days')
                WHERE id = ${locked.adId} AND user_id = ${locked.userId}
                RETURNING id
              `);
              if (result.rows.length === 0) throw new Error("تعذر العثور على الإعلان المطلوب تجديده");
              deliveryNote = "تم تجديد الإعلان تلقائياً";
              deliveryResult = `مدة التجديد: ${quantity * 30} يوماً`;
            } else if (service === "ai_credits") {
              const credited = quantity;
              await tx.insert(aiCreditWallets).values({
                userId: locked.userId,
                balance: credited,
                totalPurchased: credited,
                totalConsumed: 0,
                updatedAt: new Date(),
              }).onConflictDoUpdate({
                target: aiCreditWallets.userId,
                set: {
                  balance: sql`${aiCreditWallets.balance} + ${credited}`,
                  totalPurchased: sql`${aiCreditWallets.totalPurchased} + ${credited}`,
                  updatedAt: new Date(),
                },
              });
              deliveryNote = "تمت إضافة أرصدة الذكاء الاصطناعي تلقائياً";
              deliveryResult = `${credited} رصيد AI`;
            } else if (service === "coin_package") {
              if (!locked.servicePackageId) throw new Error("طلب باقة العملات لا يحدد الباقة");
              const coins = quantity;
              const wallet = await tx.execute(sql`
                INSERT INTO coin_wallets (user_id, balance, total_spent, total_earned)
                VALUES (${locked.userId}, ${coins}, 0, ${coins})
                ON CONFLICT (user_id) DO UPDATE
                SET balance = coin_wallets.balance + ${coins},
                    total_earned = coin_wallets.total_earned + ${coins},
                    updated_at = NOW()
                RETURNING balance
              `);
              if (wallet.rows.length !== 1) throw new Error("تعذر شحن محفظة العملات");
              await tx.execute(sql`
                INSERT INTO coin_transactions (user_id, type, coins, description)
                VALUES (${locked.userId}, 'purchase', ${coins},
                  ${`شراء باقة عملات #${locked.servicePackageId} — اعتماد دفع يدوي`})
              `);
              deliveryNote = "تمت إضافة باقة العملات تلقائياً";
              deliveryResult = `${coins} عملة`;
            } else {
              // Human-delivered services get a durable pending item. They are
              // intentionally not inferred complete from payment approval.
            }
            const isAutomatic = AUTOMATIC_MANUAL_SERVICES.has(service);
            if (isAutomatic) completedCount++;
            await tx.insert(paymentServiceDeliveries).values({
              paymentRequestId: locked.id,
              serviceType: service,
              status: isAutomatic ? "completed" : "pending",
              deliveryNote,
              deliveryResult,
              completedBy: isAutomatic ? (adminUserId || null) : null,
              completedAt: isAutomatic ? new Date() : null,
            });
          }
          fulfillmentStatus = completedCount === services.length
            ? "fulfilled"
            : completedCount > 0 ? "partial" : "pending";
          if (fulfillmentStatus === "fulfilled") fulfilledAt = new Date();
        }
      }
      const [updated] = await tx.update(paymentRequests)
        .set({
          status: 'approved',
          adminNote,
          fulfillmentStatus,
          fulfilledAt,
          transferReference: locked.type === "withdrawal" ? transferReference!.trim() : null,
          ...(locked.type === 'withdrawal' ? {
            payoutDestinationEncrypted: null,
            payoutDestinationIv: null,
            payoutDestinationAuthTag: null,
          } : {}),
        })
        .where(eq(paymentRequests.id, id))
        .returning();
      return { payment: updated, alreadyProcessed: false };
    });
  }

  async completePaymentServiceDeliveryAtomic(
    paymentRequestId: number,
    serviceType: string,
    adminUserId: string,
    deliveryNote?: string,
    deliveryResult?: string,
  ): Promise<{ payment: PaymentRequest | undefined; delivery: PaymentServiceDelivery | undefined; alreadyCompleted: boolean }> {
    return db.transaction(async (tx) => {
      const [payment] = await tx.select().from(paymentRequests)
        .where(eq(paymentRequests.id, paymentRequestId)).for("update");
      if (!payment || payment.status !== "approved") {
        return { payment: undefined, delivery: undefined, alreadyCompleted: false };
      }
      const [delivery] = await tx.select().from(paymentServiceDeliveries)
        .where(and(
          eq(paymentServiceDeliveries.paymentRequestId, paymentRequestId),
          eq(paymentServiceDeliveries.serviceType, serviceType),
        )).for("update");
      if (!delivery) return { payment, delivery: undefined, alreadyCompleted: false };
      if (delivery.status === "completed") return { payment, delivery, alreadyCompleted: true };
      const [completed] = await tx.update(paymentServiceDeliveries).set({
        status: "completed",
        deliveryNote: deliveryNote?.trim() || null,
        deliveryResult: deliveryResult?.trim() || null,
        completedBy: adminUserId,
        completedAt: new Date(),
      }).where(eq(paymentServiceDeliveries.id, delivery.id)).returning();
      const rows = await tx.select({ status: paymentServiceDeliveries.status })
        .from(paymentServiceDeliveries)
        .where(eq(paymentServiceDeliveries.paymentRequestId, paymentRequestId));
      const pending = rows.filter(row => row.status !== "completed").length;
      const [updatedPayment] = await tx.update(paymentRequests).set({
        fulfillmentStatus: pending === 0 ? "fulfilled" : "partial",
        fulfillmentNote: deliveryNote?.trim() || null,
        fulfillmentResult: deliveryResult?.trim() || null,
        fulfillmentBy: adminUserId,
        fulfilledAt: pending === 0 ? new Date() : null,
      }).where(eq(paymentRequests.id, paymentRequestId)).returning();
      return { payment: updatedPayment, delivery: completed, alreadyCompleted: false };
    });
  }

  /**
   * Reject a payment request atomically and idempotently.
   * No ledger side-effect — just a guarded status update.
   */
  async rejectPaymentRequestAtomic(id: number, adminNote?: string): Promise<{ payment: PaymentRequest | undefined; alreadyProcessed: boolean }> {
    return await db.transaction(async (tx) => {
      const [locked] = await tx
        .select()
        .from(paymentRequests)
        .where(eq(paymentRequests.id, id))
        .for("update");
      if (!locked) return { payment: undefined, alreadyProcessed: false };
      if (locked.status !== 'pending') {
        return { payment: locked, alreadyProcessed: true };
      }
      const [updated] = await tx.update(paymentRequests)
        .set({
          status: 'rejected',
          adminNote,
          ...(locked.type === 'withdrawal' ? {
            payoutDestinationEncrypted: null,
            payoutDestinationIv: null,
            payoutDestinationAuthTag: null,
          } : {}),
        })
        .where(eq(paymentRequests.id, id))
        .returning();
      return { payment: updated, alreadyProcessed: false };
    });
  }

  // ─── ADMIN ────────────────────────────────────────────────────
  async getAllUsers(): Promise<any[]> {
    const { users } = await import("@shared/schema");
    return db.select().from(users).orderBy(desc(users.createdAt));
  }

  // ─── TICKER ADS ───────────────────────────────────────────────
  async createTickerAd(data: InsertTickerAd): Promise<TickerAd> {
    const [t] = await db.insert(tickerAds).values(data).returning();
    return t;
  }

  async getTickerAd(id: number): Promise<TickerAd | undefined> {
    const [t] = await db.select().from(tickerAds).where(eq(tickerAds.id, id));
    return t;
  }

  async getMyTickerAds(advertiserId: string): Promise<TickerAd[]> {
    return db.select().from(tickerAds)
      .where(eq(tickerAds.advertiserId, advertiserId))
      .orderBy(desc(tickerAds.createdAt));
  }

  async getAllTickerAds(status?: string): Promise<TickerAd[]> {
    if (status) {
      return db.select().from(tickerAds)
        .where(eq(tickerAds.status, status as any))
        .orderBy(desc(tickerAds.createdAt));
    }
    return db.select().from(tickerAds).orderBy(desc(tickerAds.createdAt));
  }

  async getActiveTickerAds(): Promise<TickerAd[]> {
    return db.select().from(tickerAds)
      .where(eq(tickerAds.status, 'active'))
      .orderBy(desc(tickerAds.startedAt));
  }

  async updateTickerAd(id: number, data: Partial<TickerAd>): Promise<TickerAd | undefined> {
    const [t] = await db.update(tickerAds).set(data).where(eq(tickerAds.id, id)).returning();
    return t;
  }

  async deleteTickerAd(id: number): Promise<void> {
    await db.delete(tickerAds).where(eq(tickerAds.id, id));
  }

  async deductTickerAdSecond(id: number, amountEGP: number): Promise<TickerAd | undefined> {
    const [t] = await db.update(tickerAds).set({
      spentEGP: sql`${tickerAds.spentEGP} + ${amountEGP}`,
      secondsShown: sql`${tickerAds.secondsShown} + 1`,
    }).where(eq(tickerAds.id, id)).returning();
    return t;
  }

  async deductTickerAdSecondAtomic(params: {
    adId: number;
    amountEGP: number;
    advertiserId: string;
    adminUserId: string;
    chargeAdvertiser: boolean;
    creditAdmin: boolean;
  }): Promise<TickerAd | undefined> {
    const { adId, amountEGP, advertiserId, adminUserId, chargeAdvertiser, creditAdmin } = params;
    return await db.transaction(async (tx) => {
      // Lock the row & verify it's still active before charging.
      // Prevents a race where stopTickerBilling/admin-pause runs between
      // the pre-check and the deduction, causing an extra second to be billed.
      const [locked] = await tx
        .select({ status: tickerAds.status })
        .from(tickerAds)
        .where(eq(tickerAds.id, adId))
        .for("update");
      if (!locked || locked.status !== "active") {
        return undefined;
      }
      if (chargeAdvertiser && amountEGP > 0) {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${'wallet:' + advertiserId}, 0))`);
        const [balanceRow] = await tx
          .select({
            balance: sql<string>`COALESCE(SUM(
              CASE
                WHEN ${revenueTransactions.type} IN ('earning', 'wallet_recharge') THEN ${revenueTransactions.amountEGP}
                WHEN ${revenueTransactions.type} IN ('spending', 'withdrawal', 'ai_charge') THEN -${revenueTransactions.amountEGP}
                ELSE 0
              END
            ), 0)::numeric`,
          })
          .from(revenueTransactions)
          .where(eq(revenueTransactions.userId, advertiserId));
        if (parseLedgerAmount(balanceRow?.balance ?? 0, "wallet balance") < amountEGP) return undefined;
      }
      const [updated] = await tx.update(tickerAds).set({
        spentEGP: sql`${tickerAds.spentEGP} + ${amountEGP}`,
        secondsShown: sql`${tickerAds.secondsShown} + 1`,
      }).where(eq(tickerAds.id, adId)).returning();
      if (chargeAdvertiser && amountEGP > 0) {
        await tx.insert(revenueTransactions).values({
          userId: advertiserId,
          type: "spending",
          amountEGP,
          description: `Ticker ad #${adId} — second`,
          campaignId: null as any,
          channelId: null as any,
        } as any);
      }
      if (creditAdmin && amountEGP > 0) {
        await tx.insert(revenueTransactions).values({
          userId: adminUserId,
          type: "earning",
          amountEGP,
          description: `Ticker ad #${adId} — platform fee`,
          campaignId: null as any,
          channelId: null as any,
        } as any);
      }
      return updated;
    });
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
  // ─── SUBSCRIPTION ─────────────────────────────────────────────
  async updateUserSubscription(userId: string, endsAt: Date): Promise<void> {
    await db.execute(sql`UPDATE users SET subscription_ends_at = ${endsAt} WHERE id = ${userId}`);
  }

  async getUserSubscriptionInfo(userId: string): Promise<{ createdAt: Date; subscriptionEndsAt: Date | null }> {
    const rows = await db.execute(sql`SELECT created_at, subscription_ends_at FROM users WHERE id = ${userId} LIMIT 1`);
    const row = rows.rows[0] as any;
    return {
      createdAt: new Date(row.created_at),
      subscriptionEndsAt: row.subscription_ends_at ? new Date(row.subscription_ends_at) : null,
    };
  }
}

export const storage = new DatabaseStorage();
