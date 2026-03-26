import type { Express } from "express";
import { createServer, type Server } from "http";
import { Server as SocketServer } from "socket.io";
import { storage } from "./storage";
import { z } from "zod";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { registerImageRoutes, openai } from "./replit_integrations/image";
import { upload } from "./upload";
import path from "path";
import fs from "fs";
import { db } from "./db";
import { sql } from "drizzle-orm";
import express from "express";

// Admin user ID
const ADMIN_USER_ID = "54219806";

function isAdminUser(req: any): boolean {
  return req.user?.claims?.sub === ADMIN_USER_ID;
}

async function requireAdmin(req: any, res: any, next: any) {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  if (!isAdminUser(req)) return res.status(403).json({ message: "Admin access required" });
  next();
}

// AI credit check middleware
async function checkAiCredits(req: any, res: any, next: any) {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  const userId = req.user.claims.sub;
  const freeCredits = parseInt(await storage.getSetting('ai_free_credits') || '3');
  const usageCount = await storage.getAiUsageCount(userId);
  if (usageCount >= freeCredits && !isAdminUser(req)) {
    const pricePerCredit = parseFloat(await storage.getSetting('ai_price_per_credit_egp') || '5');
    const balance = await storage.getUserBalanceEGP(userId);
    if (balance < pricePerCredit) {
      return res.status(402).json({
        message: "insufficient_credits",
        usageCount,
        freeCredits,
        pricePerCredit,
        balance
      });
    }
    req.aiChargeEGP = pricePerCredit;
  }
  req.aiUsageCount = usageCount;
  req.aiFreeCredits = freeCredits;
  next();
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);
  registerImageRoutes(app);

  // Serve uploads directory
  const uploadsDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  app.use("/uploads", express.static(uploadsDir));

  // ================================================================
  // SOCKET.IO - Live Streaming & Real-time Chat
  // ================================================================
  const io = new SocketServer(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
  });

  const streamRooms: Map<string, { broadcasterId: string | null; viewers: Set<string> }> = new Map();

  io.on("connection", (socket) => {
    socket.on("join-stream", (streamId: string) => {
      socket.join(`stream:${streamId}`);
      if (!streamRooms.has(streamId)) streamRooms.set(streamId, { broadcasterId: null, viewers: new Set() });
      streamRooms.get(streamId)!.viewers.add(socket.id);
      const count = streamRooms.get(streamId)!.viewers.size;
      io.to(`stream:${streamId}`).emit("viewer-count", count);
      storage.updateLiveStream(Number(streamId), { viewerCount: count }).catch(() => {});
    });

    socket.on("leave-stream", (streamId: string) => {
      socket.leave(`stream:${streamId}`);
      streamRooms.get(streamId)?.viewers.delete(socket.id);
      const count = streamRooms.get(streamId)?.viewers.size || 0;
      io.to(`stream:${streamId}`).emit("viewer-count", count);
    });

    socket.on("chat-message", (data: { streamId: string; userId: string; userName: string; message: string; isVoice?: boolean }) => {
      const msg = { ...data, timestamp: new Date().toISOString(), id: Date.now() };
      io.to(`stream:${data.streamId}`).emit("chat-message", msg);
      storage.createChatMessage({
        streamId: Number(data.streamId),
        userId: data.userId,
        userName: data.userName,
        message: data.message,
        isVoice: data.isVoice || false,
        isHidden: false,
      }).catch(() => {});
    });

    socket.on("stream-like", (streamId: string) => {
      io.to(`stream:${streamId}`).emit("stream-like");
    });

    // WebRTC Signaling
    socket.on("broadcaster", (streamId: string) => {
      socket.join(`stream:${streamId}`);
      if (!streamRooms.has(streamId)) streamRooms.set(streamId, { broadcasterId: socket.id, viewers: new Set() });
      else streamRooms.get(streamId)!.broadcasterId = socket.id;
      socket.to(`stream:${streamId}`).emit("broadcaster");
    });

    socket.on("watcher", (streamId: string) => {
      socket.join(`stream:${streamId}`);
      if (!streamRooms.has(streamId)) streamRooms.set(streamId, { broadcasterId: null, viewers: new Set() });
      streamRooms.get(streamId)!.viewers.add(socket.id);
      const broadcasterId = streamRooms.get(streamId)!.broadcasterId;
      if (broadcasterId) socket.to(broadcasterId).emit("watcher", socket.id);
    });

    socket.on("offer", (id: string, message: any) => socket.to(id).emit("offer", socket.id, message));
    socket.on("answer", (id: string, message: any) => socket.to(id).emit("answer", socket.id, message));
    socket.on("candidate", (id: string, message: any) => socket.to(id).emit("candidate", socket.id, message));

    socket.on("disconnect", () => {
      streamRooms.forEach((room, streamId) => {
        if (room.broadcasterId === socket.id) {
          room.broadcasterId = null;
          io.to(`stream:${streamId}`).emit("broadcaster-disconnected");
        }
        room.viewers.delete(socket.id);
      });
    });
  });

  // ================================================================
  // FILE UPLOAD ROUTES
  // ================================================================
  app.post("/api/upload", isAuthenticated, upload.single("file"), async (req: any, res) => {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    const userId = req.user.claims.sub;
    const url = `/uploads/${req.file.filename}`;
    const fileRecord = await storage.createUploadedFile({
      userId,
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      url,
    });
    res.json({ url, file: fileRecord });
  });

  app.get("/api/files", isAuthenticated, async (req: any, res) => {
    const files = await storage.getUserFiles(req.user.claims.sub);
    res.json(files);
  });

  // ================================================================
  // PLATFORM SETTINGS (Admin only)
  // ================================================================
  app.get("/api/settings", async (req, res) => {
    const settings = await storage.getAllSettings();
    res.json(settings);
  });

  app.put("/api/settings", isAuthenticated, requireAdmin, async (req: any, res) => {
    const { key, value } = req.body;
    await storage.setSetting(key, value);
    res.json({ success: true });
  });

  app.put("/api/settings/bulk", isAuthenticated, requireAdmin, async (req: any, res) => {
    const settings = req.body as Record<string, string>;
    for (const [key, value] of Object.entries(settings)) {
      await storage.setSetting(key, value);
    }
    res.json({ success: true });
  });

  // ================================================================
  // AI USAGE INFO
  // ================================================================
  app.get("/api/ai/usage", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const usageCount = await storage.getAiUsageCount(userId);
    const freeCredits = parseInt(await storage.getSetting('ai_free_credits') || '3');
    const pricePerCredit = parseFloat(await storage.getSetting('ai_price_per_credit_egp') || '5');
    const balance = await storage.getUserBalanceEGP(userId);
    res.json({ usageCount, freeCredits, pricePerCredit, balance, remaining: Math.max(0, freeCredits - usageCount) });
  });

  // ================================================================
  // ADS ROUTES (isolated - users see only their own ads when authenticated)
  // ================================================================
  app.get("/api/ads", async (req: any, res) => {
    const language = req.query.language as string | undefined;
    const myAds = req.query.mine === 'true';
    const userId = req.user?.claims?.sub;
    if (myAds && userId) {
      const ads = await storage.getAds(undefined, userId);
      return res.json(ads);
    }
    const ads = await storage.getAds(language);
    res.json(ads);
  });

  app.get("/api/ads/mine", isAuthenticated, async (req: any, res) => {
    const ads = await storage.getAds(undefined, req.user.claims.sub);
    res.json(ads);
  });

  app.get("/api/ads/:id", async (req, res) => {
    const ad = await storage.getAd(Number(req.params.id));
    if (!ad) return res.status(404).json({ message: "Ad not found" });
    res.json(ad);
  });

  app.post("/api/ads", isAuthenticated, async (req: any, res) => {
    try {
      const { insertAdSchema } = await import("@shared/schema");
      const input = insertAdSchema.parse(req.body);
      const ad = await storage.createAd({ ...input, userId: req.user.claims.sub });
      res.status(201).json(ad);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.put("/api/ads/:id", isAuthenticated, async (req: any, res) => {
    const ad = await storage.getAd(Number(req.params.id));
    if (!ad) return res.status(404).json({ message: "Not found" });
    if (ad.userId !== req.user.claims.sub && !isAdminUser(req)) return res.status(403).json({ message: "Forbidden" });
    const updated = await storage.updateAd(Number(req.params.id), req.body);
    res.json(updated);
  });

  app.delete("/api/ads/:id", isAuthenticated, async (req: any, res) => {
    const ad = await storage.getAd(Number(req.params.id));
    if (!ad) return res.status(404).json({ message: "Not found" });
    if (ad.userId !== req.user.claims.sub && !isAdminUser(req)) return res.status(403).json({ message: "Forbidden" });
    await storage.deleteAd(Number(req.params.id));
    res.status(204).send();
  });

  // ================================================================
  // CHANNELS ROUTES (isolated)
  // ================================================================
  app.get("/api/channels", async (req, res) => {
    const channels = await storage.getChannels(req.query.language as string);
    res.json(channels);
  });

  app.get("/api/channels/mine", isAuthenticated, async (req: any, res) => {
    const channel = await storage.getChannelByUserId(req.user.claims.sub);
    res.json(channel || null);
  });

  app.get("/api/channels/:id", async (req, res) => {
    const ch = await storage.getChannel(Number(req.params.id));
    if (!ch) return res.status(404).json({ message: "Channel not found" });
    res.json(ch);
  });

  app.post("/api/channels", isAuthenticated, async (req: any, res) => {
    try {
      const existing = await storage.getChannelByUserId(req.user.claims.sub);
      if (existing) return res.status(400).json({ message: "You already have a channel" });
      const { insertChannelSchema } = await import("@shared/schema");
      const input = insertChannelSchema.parse({ ...req.body, userId: req.user.claims.sub });
      const ch = await storage.createChannel(input);
      res.status(201).json(ch);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.put("/api/channels/:id", isAuthenticated, async (req: any, res) => {
    const ch = await storage.getChannel(Number(req.params.id));
    if (!ch) return res.status(404).json({ message: "Not found" });
    if (ch.userId !== req.user.claims.sub && !isAdminUser(req)) return res.status(403).json({ message: "Forbidden" });
    const updated = await storage.updateChannel(Number(req.params.id), req.body);
    res.json(updated);
  });

  app.post("/api/channels/:id/follow", isAuthenticated, async (req: any, res) => {
    const result = await storage.toggleFollow(req.user.claims.sub, Number(req.params.id));
    res.json(result);
  });

  app.get("/api/channels/:id/follow", isAuthenticated, async (req: any, res) => {
    const follow = await storage.getFollow(req.user.claims.sub, Number(req.params.id));
    res.json({ following: !!follow });
  });

  // Channel analytics (only for channel owner or admin)
  app.get("/api/channels/:id/analytics", isAuthenticated, async (req: any, res) => {
    const ch = await storage.getChannel(Number(req.params.id));
    if (!ch) return res.status(404).json({ message: "Not found" });
    if (ch.userId !== req.user.claims.sub && !isAdminUser(req)) return res.status(403).json({ message: "Forbidden" });
    const transactions = await storage.getRevenueTransactions(ch.userId);
    const channelTransactions = transactions.filter(t => t.channelId === Number(req.params.id));
    const totalEarningsEGP = channelTransactions.filter(t => t.type === 'earning').reduce((s, t) => s + (t.amountEGP || 0), 0);
    res.json({ channel: ch, earnings: totalEarningsEGP, transactions: channelTransactions });
  });

  // ================================================================
  // LIVE STREAMS ROUTES
  // ================================================================
  app.get("/api/streams", async (req, res) => {
    const status = req.query.status as string || 'live';
    const streams = await storage.getLiveStreams(status);
    res.json(streams);
  });

  app.get("/api/streams/:id", async (req, res) => {
    const stream = await storage.getLiveStream(Number(req.params.id));
    if (!stream) return res.status(404).json({ message: "Stream not found" });
    res.json(stream);
  });

  app.get("/api/channels/:channelId/streams", async (req, res) => {
    const streams = await storage.getLiveStreamsByChannel(Number(req.params.channelId));
    res.json(streams);
  });

  app.post("/api/streams", isAuthenticated, async (req: any, res) => {
    try {
      const { insertLiveStreamSchema } = await import("@shared/schema");
      const userId = req.user.claims.sub;
      const channel = await storage.getChannelByUserId(userId);
      if (!channel) return res.status(400).json({ message: "You need a channel first" });
      const input = insertLiveStreamSchema.parse({ ...req.body, channelId: channel.id, userId });
      const stream = await storage.createLiveStream(input);
      res.status(201).json(stream);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.put("/api/streams/:id", isAuthenticated, async (req: any, res) => {
    const stream = await storage.getLiveStream(Number(req.params.id));
    if (!stream) return res.status(404).json({ message: "Not found" });
    if (stream.userId !== req.user.claims.sub && !isAdminUser(req)) return res.status(403).json({ message: "Forbidden" });
    const updated = await storage.updateLiveStream(Number(req.params.id), req.body);
    res.json(updated);
  });

  app.post("/api/streams/:id/start", isAuthenticated, async (req: any, res) => {
    const stream = await storage.getLiveStream(Number(req.params.id));
    if (!stream || stream.userId !== req.user.claims.sub) return res.status(403).json({ message: "Forbidden" });
    const updated = await storage.updateLiveStream(Number(req.params.id), { status: 'live', startedAt: new Date() });
    res.json(updated);
  });

  app.post("/api/streams/:id/end", isAuthenticated, async (req: any, res) => {
    const stream = await storage.getLiveStream(Number(req.params.id));
    if (!stream || stream.userId !== req.user.claims.sub) return res.status(403).json({ message: "Forbidden" });
    const updated = await storage.updateLiveStream(Number(req.params.id), { status: 'ended', endedAt: new Date() });
    res.json(updated);
  });

  app.get("/api/streams/:id/chat", async (req, res) => {
    const messages = await storage.getChatMessages(Number(req.params.id));
    res.json(messages.reverse());
  });

  // Stream analytics (only for stream owner or admin)
  app.get("/api/streams/:id/analytics", isAuthenticated, async (req: any, res) => {
    const stream = await storage.getLiveStream(Number(req.params.id));
    if (!stream) return res.status(404).json({ message: "Not found" });
    if (stream.userId !== req.user.claims.sub && !isAdminUser(req)) return res.status(403).json({ message: "Forbidden" });
    res.json(stream);
  });

  // ================================================================
  // SOCIAL FEATURES - LIKES & COMMENTS
  // ================================================================
  app.post("/api/likes", isAuthenticated, async (req: any, res) => {
    const { targetType, targetId } = req.body;
    const result = await storage.toggleLike(req.user.claims.sub, targetType, Number(targetId));
    res.json(result);
  });

  app.get("/api/likes/:targetType/:targetId", isAuthenticated, async (req: any, res) => {
    const like = await storage.getLike(req.user.claims.sub, req.params.targetType, Number(req.params.targetId));
    res.json({ liked: !!like });
  });

  app.get("/api/comments/:targetType/:targetId", async (req, res) => {
    const comments = await storage.getComments(req.params.targetType, Number(req.params.targetId));
    res.json(comments);
  });

  app.post("/api/comments", isAuthenticated, async (req: any, res) => {
    try {
      const { insertCommentSchema } = await import("@shared/schema");
      const userId = req.user.claims.sub;
      const userName = req.user.claims?.first_name || req.user.claims?.name || "مستخدم";
      const input = insertCommentSchema.parse({ ...req.body, userId, userName });
      const comment = await storage.createComment(input);
      res.status(201).json(comment);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/comments/:id", isAuthenticated, async (req: any, res) => {
    await storage.deleteComment(Number(req.params.id));
    res.status(204).send();
  });

  // ================================================================
  // REELS ROUTES
  // ================================================================
  app.get("/api/reels", async (req: any, res) => {
    const myReels = req.query.mine === 'true';
    const userId = req.user?.claims?.sub;
    if (myReels && userId) {
      const reels = await storage.getReels(userId);
      return res.json(reels);
    }
    const reels = await storage.getReels();
    res.json(reels);
  });

  app.get("/api/reels/mine", isAuthenticated, async (req: any, res) => {
    const reels = await storage.getReels(req.user.claims.sub);
    res.json(reels);
  });

  app.get("/api/reels/:id", async (req, res) => {
    const reel = await storage.getReel(Number(req.params.id));
    if (!reel) return res.status(404).json({ message: "Reel not found" });
    res.json(reel);
  });

  app.post("/api/reels", isAuthenticated, async (req: any, res) => {
    try {
      const { insertReelSchema } = await import("@shared/schema");
      const userId = req.user.claims.sub;
      const channel = await storage.getChannelByUserId(userId);
      const input = insertReelSchema.parse({ ...req.body, userId, channelId: channel?.id });
      const reel = await storage.createReel(input);
      res.status(201).json(reel);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.put("/api/reels/:id", isAuthenticated, async (req: any, res) => {
    const reel = await storage.getReel(Number(req.params.id));
    if (!reel) return res.status(404).json({ message: "Not found" });
    if (reel.userId !== req.user.claims.sub && !isAdminUser(req)) return res.status(403).json({ message: "Forbidden" });
    const updated = await storage.updateReel(Number(req.params.id), req.body);
    res.json(updated);
  });

  app.delete("/api/reels/:id", isAuthenticated, async (req: any, res) => {
    const reel = await storage.getReel(Number(req.params.id));
    if (!reel) return res.status(404).json({ message: "Not found" });
    if (reel.userId !== req.user.claims.sub && !isAdminUser(req)) return res.status(403).json({ message: "Forbidden" });
    await storage.deleteReel(Number(req.params.id));
    res.status(204).send();
  });

  // ================================================================
  // AD CAMPAIGNS - Meta/AdSense Style (isolated per advertiser)
  // ================================================================
  app.get("/api/campaigns", isAuthenticated, async (req: any, res) => {
    // Only admin sees all campaigns, others see only their own
    if (isAdminUser(req) && req.query.all === 'true') {
      const campaigns = await storage.getAllAdCampaigns();
      return res.json(campaigns);
    }
    const campaigns = await storage.getAdCampaigns(req.user.claims.sub);
    res.json(campaigns);
  });

  app.get("/api/campaigns/active", async (req, res) => {
    const campaigns = await storage.getActiveCampaigns();
    res.json(campaigns);
  });

  app.get("/api/campaigns/:id", isAuthenticated, async (req: any, res) => {
    const campaign = await storage.getAdCampaign(Number(req.params.id));
    if (!campaign) return res.status(404).json({ message: "Not found" });
    if (campaign.advertiserId !== req.user.claims.sub && !isAdminUser(req)) return res.status(403).json({ message: "Forbidden" });
    res.json(campaign);
  });

  app.post("/api/campaigns", isAuthenticated, async (req: any, res) => {
    try {
      const { insertAdCampaignSchema } = await import("@shared/schema");
      const userId = req.user.claims.sub;
      const input = insertAdCampaignSchema.parse({ ...req.body, advertiserId: userId });
      const campaign = await storage.createAdCampaign(input);
      res.status(201).json(campaign);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.put("/api/campaigns/:id", isAuthenticated, async (req: any, res) => {
    const campaign = await storage.getAdCampaign(Number(req.params.id));
    if (!campaign) return res.status(404).json({ message: "Not found" });
    if (campaign.advertiserId !== req.user.claims.sub && !isAdminUser(req)) return res.status(403).json({ message: "Forbidden" });
    const updated = await storage.updateAdCampaign(Number(req.params.id), req.body);
    res.json(updated);
  });

  // Campaign analytics (isolated)
  app.get("/api/campaigns/:id/analytics", isAuthenticated, async (req: any, res) => {
    const campaign = await storage.getAdCampaign(Number(req.params.id));
    if (!campaign) return res.status(404).json({ message: "Not found" });
    if (campaign.advertiserId !== req.user.claims.sub && !isAdminUser(req)) return res.status(403).json({ message: "Forbidden" });
    const ctr = campaign.impressions > 0 ? ((campaign.clicks / campaign.impressions) * 100).toFixed(2) : '0';
    const cpmEGP = campaign.cpmRateEGP || 15;
    const cpcEGP = campaign.clicks > 0 ? ((campaign.spentEGP || 0) / campaign.clicks).toFixed(2) : '0';
    res.json({ ...campaign, ctr, cpmEGP, cpcEGP });
  });

  // Record impression/click
  app.post("/api/campaigns/:id/impression", async (req, res) => {
    const { channelId, userId } = req.body;
    await storage.recordImpression(Number(req.params.id), channelId, userId);
    res.json({ success: true });
  });

  app.post("/api/campaigns/:id/click", async (req, res) => {
    const { channelId, userId } = req.body;
    await storage.recordClick(Number(req.params.id), channelId, userId);
    res.json({ success: true });
  });

  // Embed JS script (AdSense-like)
  app.get("/api/campaigns/embed.js", async (req, res) => {
    const campaignId = Number(req.query.id);
    const campaign = await storage.getAdCampaign(campaignId);
    if (!campaign || campaign.status !== 'active') {
      return res.type('js').send('// No active campaign');
    }
    const script = `(function(){
  var ad=document.createElement('div');
  ad.style.cssText='max-width:728px;margin:10px auto;font-family:Cairo,sans-serif;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1);direction:rtl;';
  var link=document.createElement('a');
  link.href='${campaign.targetUrl||'#'}';link.target='_blank';link.style.display='block';link.style.textDecoration='none';
  if('${campaign.mediaUrl}'){var img=document.createElement('img');img.src='${campaign.mediaUrl}';img.style.cssText='width:100%;display:block;';link.appendChild(img);}
  var info=document.createElement('div');
  info.style.cssText='padding:12px;background:#f8f8f8;';
  info.innerHTML='<strong style="color:#009688">${campaign.name}</strong><p style="color:#666;margin:4px 0 0;font-size:12px">${campaign.description||''}</p><span style="font-size:10px;color:#aaa">إعلان ممول - سوق للإعلانات</span>';
  link.appendChild(info);ad.appendChild(link);
  var s=document.getElementsByTagName('script');var t=s[s.length-1];t.parentNode.insertBefore(ad,t.nextSibling);
  fetch('/api/campaigns/${campaignId}/impression',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({})}).catch(()=>{});
  link.addEventListener('click',function(){fetch('/api/campaigns/${campaignId}/click',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({})}).catch(()=>{});});
})();`;
    res.type('js').send(script);
  });

  // ================================================================
  // REVENUE ROUTES (isolated per user)
  // ================================================================
  app.get("/api/revenue", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const transactions = await storage.getRevenueTransactions(userId);
    const balanceEGP = await storage.getUserBalanceEGP(userId);
    const channel = await storage.getChannelByUserId(userId);
    res.json({ transactions, balanceEGP, channel });
  });

  // ================================================================
  // PAYMENT REQUESTS
  // ================================================================
  app.get("/api/payments", isAuthenticated, async (req: any, res) => {
    if (isAdminUser(req)) {
      const all = await storage.getPaymentRequests();
      return res.json(all);
    }
    const mine = await storage.getPaymentRequests(req.user.claims.sub);
    res.json(mine);
  });

  app.post("/api/payments", isAuthenticated, async (req: any, res) => {
    try {
      const { insertPaymentRequestSchema } = await import("@shared/schema");
      const input = insertPaymentRequestSchema.parse({ ...req.body, userId: req.user.claims.sub });
      const payment = await storage.createPaymentRequest(input);
      res.status(201).json(payment);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.put("/api/payments/:id", isAuthenticated, requireAdmin, async (req: any, res) => {
    const { status, adminNote } = req.body;
    const payment = await storage.updatePaymentRequest(Number(req.params.id), status, adminNote);
    // If approved withdrawal, create debit transaction
    if (status === 'approved') {
      const pr = await storage.getPaymentRequests(undefined);
      const p = pr.find(x => x.id === Number(req.params.id));
      if (p && p.type === 'withdrawal') {
        await storage.createTransaction({
          userId: p.userId,
          type: 'withdrawal',
          amountEGP: p.amountEGP,
          description: `سحب رصيد - ${p.method}`,
        });
      }
    }
    res.json(payment);
  });

  // ================================================================
  // REPORTS ROUTES
  // ================================================================
  app.post("/api/reports", isAuthenticated, async (req: any, res) => {
    try {
      const { insertReportSchema } = await import("@shared/schema");
      const input = insertReportSchema.parse({ ...req.body, reporterId: req.user.claims.sub });
      const report = await storage.createReport(input);
      res.status(201).json(report);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // ================================================================
  // ADMIN PANEL ROUTES (admin only)
  // ================================================================
  app.get("/api/admin/stats", isAuthenticated, requireAdmin, async (req: any, res) => {
    const stats = await storage.getStats();
    res.json(stats);
  });

  app.get("/api/admin/users", isAuthenticated, requireAdmin, async (req: any, res) => {
    const users = await storage.getAllUsers();
    res.json(users);
  });

  app.get("/api/admin/reports", isAuthenticated, requireAdmin, async (req: any, res) => {
    const reps = await storage.getReports(req.query.status as string);
    res.json(reps);
  });

  app.put("/api/admin/reports/:id", isAuthenticated, requireAdmin, async (req: any, res) => {
    const { status, adminNote } = req.body;
    const report = await storage.updateReport(Number(req.params.id), status, adminNote);
    res.json(report);
  });

  app.get("/api/admin/campaigns", isAuthenticated, requireAdmin, async (req: any, res) => {
    const campaigns = await storage.getAllAdCampaigns();
    res.json(campaigns);
  });

  app.put("/api/admin/campaigns/:id", isAuthenticated, requireAdmin, async (req: any, res) => {
    const updated = await storage.updateAdCampaign(Number(req.params.id), req.body);
    res.json(updated);
  });

  app.get("/api/admin/channels", isAuthenticated, requireAdmin, async (req: any, res) => {
    const { channels } = await import("@shared/schema");
    const { db } = await import("./db");
    const { desc } = await import("drizzle-orm");
    const all = await db.select().from(channels).orderBy(desc(channels.createdAt));
    res.json(all);
  });

  app.put("/api/admin/channels/:id", isAuthenticated, requireAdmin, async (req: any, res) => {
    const updated = await storage.updateChannel(Number(req.params.id), req.body);
    res.json(updated);
  });

  app.get("/api/admin/payments", isAuthenticated, requireAdmin, async (req: any, res) => {
    const payments = await storage.getPaymentRequests();
    res.json(payments);
  });

  app.put("/api/admin/payments/:id", isAuthenticated, requireAdmin, async (req: any, res) => {
    const { status, adminNote } = req.body;
    const payment = await storage.updatePaymentRequest(Number(req.params.id), status, adminNote);
    res.json(payment);
  });

  app.get("/api/admin/reels", isAuthenticated, requireAdmin, async (req: any, res) => {
    const reels = await storage.getReels();
    res.json(reels);
  });

  // ================================================================
  // AI ROUTES (with credit tracking)
  // ================================================================
  app.post("/api/ai/generate-copy", isAuthenticated, checkAiCredits, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { productName, targetAudience, language } = req.body;
      const prompt = language === 'ar'
        ? `اكتب عنوان ووصف جذاب لإعلان باللغة العربية. المنتج: "${productName}". الجمهور المستهدف: "${targetAudience}". أعد JSON مع مفاتيح "title" و"description".`
        : `Write a catchy title and description for an ad. Product: "${productName}". Target: "${targetAudience}". Return JSON with "title" and "description".`;
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });
      const content = JSON.parse(response.choices[0]?.message?.content || "{}");
      await storage.recordAiUsage(userId, 'copy');
      if (req.aiChargeEGP) {
        await storage.createTransaction({ userId, type: 'ai_charge', amountEGP: req.aiChargeEGP, description: 'رسوم توليد نص بالذكاء الاصطناعي' });
      }
      res.json({ ...content, creditsUsed: (req.aiUsageCount || 0) + 1 });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to generate ad copy: " + error.message });
    }
  });

  app.post("/api/ai/generate-article", isAuthenticated, checkAiCredits, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { topic, language, tone } = req.body;
      const prompt = language === 'ar'
        ? `اكتب مقالة تسويقية احترافية عن: "${topic}". الأسلوب: ${tone || 'رسمي'}. أعد JSON مع مفاتيح "title" و"content".`
        : `Write a professional marketing article about: "${topic}". Tone: ${tone || 'professional'}. Return JSON with "title" and "content".`;
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });
      const content = JSON.parse(response.choices[0]?.message?.content || "{}");
      await storage.recordAiUsage(userId, 'article');
      if (req.aiChargeEGP) {
        await storage.createTransaction({ userId, type: 'ai_charge', amountEGP: req.aiChargeEGP, description: 'رسوم توليد مقالة بالذكاء الاصطناعي' });
      }
      res.json({ ...content, creditsUsed: (req.aiUsageCount || 0) + 1 });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to generate article: " + error.message });
    }
  });

  app.post("/api/ai/generate-video-script", isAuthenticated, checkAiCredits, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { productName, duration, language } = req.body;
      const prompt = language === 'ar'
        ? `اكتب سكريبت فيديو إعلاني سينمائي احترافي بالكامل لـ "${productName}" مدته ${duration || 30} ثانية. أعد JSON مع: "title", "script" (النص الكامل), "voiceover" (التعليق الصوتي بالعربية المصرية العامية), "scenes" (مصفوفة من 4-6 مشاهد كل منها: "time" الوقت, "visual" وصف الصورة المتحركة, "narration" التعليق الصوتي, "mood" المزاج, "transition" طريقة الانتقال), "music" (وصف الموسيقى التصويرية), "callToAction" (دعوة للعمل).`
        : `Write a complete professional cinematic video ad script for "${productName}" (${duration || 30} seconds). Return JSON: "title", "script", "voiceover", "scenes" (4-6 scenes with "time", "visual", "narration", "mood", "transition"), "music", "callToAction".`;
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });
      const content = JSON.parse(response.choices[0]?.message?.content || "{}");
      await storage.recordAiUsage(userId, 'video_script');
      if (req.aiChargeEGP) {
        await storage.createTransaction({ userId, type: 'ai_charge', amountEGP: req.aiChargeEGP, description: 'رسوم توليد سكريبت فيديو' });
      }
      res.json({ ...content, creditsUsed: (req.aiUsageCount || 0) + 1 });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to generate script: " + error.message });
    }
  });

  // AI Image generation (uses DALL-E via image routes, but track usage here)
  app.post("/api/ai/generate-image", isAuthenticated, checkAiCredits, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { prompt, size } = req.body;
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: prompt,
        n: 1,
        size: (size || "1024x1024") as any,
        quality: "standard",
      });
      const imageUrl = response.data[0]?.url;
      if (!imageUrl) throw new Error("No image generated");
      await storage.recordAiUsage(userId, 'image');
      if (req.aiChargeEGP) {
        await storage.createTransaction({ userId, type: 'ai_charge', amountEGP: req.aiChargeEGP, description: 'رسوم توليد صورة بالذكاء الاصطناعي' });
      }
      res.json({ url: imageUrl, creditsUsed: (req.aiUsageCount || 0) + 1 });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to generate image: " + error.message });
    }
  });

  // ─── PAYMENT NOTIFICATIONS (from ad buyers) ──────────────────
  app.post("/api/payment-notifications", async (req, res) => {
    try {
      const { adId, payerName, payerPhone, paidAmount, paymentMethod } = req.body;
      if (!adId || !payerName || !payerPhone || !paidAmount || !paymentMethod)
        return res.status(400).json({ message: "بيانات ناقصة" });
      const result = await db.execute(
        sql`INSERT INTO payment_notifications (ad_id, payer_name, payer_phone, paid_amount, payment_method, status)
            VALUES (${adId}, ${payerName}, ${payerPhone}, ${paidAmount}, ${paymentMethod}, 'pending')
            RETURNING *`
      );
      res.json(result.rows[0]);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Get payment notifications for ad owners
  app.get("/api/payment-notifications", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const result = await db.execute(
        sql`SELECT pn.*, a.title as ad_title FROM payment_notifications pn
            JOIN ads a ON a.id = pn.ad_id
            WHERE a.user_id = ${userId} OR ${userId === ADMIN_USER_ID}
            ORDER BY pn.created_at DESC`
      );
      res.json(result.rows);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Admin update payment notification
  app.put("/api/payment-notifications/:id", isAuthenticated, async (req: any, res) => {
    if (!isAdminUser(req)) return res.status(403).json({ message: "Forbidden" });
    const { status } = req.body;
    try {
      const result = await db.execute(
        sql`UPDATE payment_notifications SET status = ${status} WHERE id = ${req.params.id} RETURNING *`
      );
      res.json(result.rows[0]);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  return httpServer;
}
