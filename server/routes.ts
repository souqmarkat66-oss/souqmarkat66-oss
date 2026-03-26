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
import express from "express";

// Middleware to check if user owns the ad
async function checkAdOwnership(req: any, res: any, next: any) {
  const id = Number(req.params.id);
  const ad = await storage.getAd(id);
  if (!ad) return res.status(404).json({ message: "Ad not found" });
  if (ad.userId !== req.user?.claims?.sub) return res.status(401).json({ message: "Unauthorized" });
  next();
}

// Simple admin check (first user or special env var)
async function isAdmin(req: any, res: any, next: any) {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  const adminId = process.env.ADMIN_USER_ID || req.user.claims?.sub;
  if (req.user.claims?.sub !== adminId) return res.status(403).json({ message: "Forbidden" });
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

  // Track rooms: streamId -> { broadcaster socketId, viewerCount }
  const streamRooms: Map<string, { broadcasterId: string | null; viewers: Set<string> }> = new Map();

  io.on("connection", (socket) => {
    // ── Live Stream Chat ──────────────────────────────────────
    socket.on("join-stream", (streamId: string) => {
      socket.join(`stream:${streamId}`);
      if (!streamRooms.has(streamId)) streamRooms.set(streamId, { broadcasterId: null, viewers: new Set() });
      streamRooms.get(streamId)!.viewers.add(socket.id);
      const count = streamRooms.get(streamId)!.viewers.size;
      io.to(`stream:${streamId}`).emit("viewer-count", count);
      // Update DB viewer count
      storage.updateLiveStream(Number(streamId), { viewerCount: count }).catch(() => {});
    });

    socket.on("leave-stream", (streamId: string) => {
      socket.leave(`stream:${streamId}`);
      streamRooms.get(streamId)?.viewers.delete(socket.id);
      const count = streamRooms.get(streamId)?.viewers.size || 0;
      io.to(`stream:${streamId}`).emit("viewer-count", count);
    });

    socket.on("chat-message", (data: { streamId: string; userId: string; userName: string; message: string }) => {
      const msg = { ...data, timestamp: new Date().toISOString(), id: Date.now() };
      io.to(`stream:${data.streamId}`).emit("chat-message", msg);
      // Persist to DB
      storage.createChatMessage({
        streamId: Number(data.streamId),
        userId: data.userId,
        userName: data.userName,
        message: data.message,
        isHidden: false,
      }).catch(() => {});
    });

    socket.on("stream-like", (streamId: string) => {
      io.to(`stream:${streamId}`).emit("stream-like");
    });

    // ── WebRTC Signaling ─────────────────────────────────────
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
  // ADS ROUTES
  // ================================================================
  app.get("/api/ads", async (req, res) => {
    const language = req.query.language as string | undefined;
    const ads = await storage.getAds(language);
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

  app.put("/api/ads/:id", isAuthenticated, checkAdOwnership, async (req, res) => {
    const ad = await storage.updateAd(Number(req.params.id), req.body);
    res.json(ad);
  });

  app.delete("/api/ads/:id", isAuthenticated, checkAdOwnership, async (req, res) => {
    await storage.deleteAd(Number(req.params.id));
    res.status(204).send();
  });

  // ================================================================
  // CHANNELS ROUTES
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
    if (ch.userId !== req.user.claims.sub) return res.status(403).json({ message: "Forbidden" });
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
    if (stream.userId !== req.user.claims.sub) return res.status(403).json({ message: "Forbidden" });
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
  // AD CAMPAIGNS - Meta/AdSense Style
  // ================================================================
  app.get("/api/campaigns", isAuthenticated, async (req: any, res) => {
    const campaigns = await storage.getAdCampaigns(req.user.claims.sub);
    res.json(campaigns);
  });

  app.post("/api/campaigns", isAuthenticated, async (req: any, res) => {
    try {
      const { insertAdCampaignSchema } = await import("@shared/schema");
      const input = insertAdCampaignSchema.parse({ ...req.body, advertiserId: req.user.claims.sub });
      const campaign = await storage.createAdCampaign(input);
      res.status(201).json(campaign);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.put("/api/campaigns/:id", isAuthenticated, async (req: any, res) => {
    const campaign = await storage.getAdCampaign(Number(req.params.id));
    if (!campaign || campaign.advertiserId !== req.user.claims.sub) return res.status(403).json({ message: "Forbidden" });
    const updated = await storage.updateAdCampaign(Number(req.params.id), req.body);
    res.json(updated);
  });

  // Public: Get active campaigns for embed
  app.get("/api/campaigns/active", async (req, res) => {
    const campaigns = await storage.getActiveCampaigns();
    res.json(campaigns);
  });

  // Record impression/click for a campaign
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

  // Embed JS script for publishers (AdSense-like)
  app.get("/api/campaigns/embed.js", async (req, res) => {
    const campaignId = Number(req.query.id);
    const campaign = await storage.getAdCampaign(campaignId);
    if (!campaign || campaign.status !== 'active') {
      return res.type('js').send('// No active campaign');
    }
    const script = `
(function() {
  var ad = document.createElement('div');
  ad.style.cssText = 'max-width:728px;margin:10px auto;font-family:Cairo,sans-serif;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);';
  var link = document.createElement('a');
  link.href = '${campaign.targetUrl || '#'}';
  link.target = '_blank';
  link.style.cssText = 'display:block;text-decoration:none;';
  if('${campaign.mediaType}' === 'image' && '${campaign.mediaUrl}') {
    var img = document.createElement('img');
    img.src = '${campaign.mediaUrl}';
    img.style.cssText = 'width:100%;display:block;';
    img.alt = '${campaign.name}';
    link.appendChild(img);
  }
  var info = document.createElement('div');
  info.style.cssText = 'padding:12px;background:#f8f8f8;';
  info.innerHTML = '<strong style="color:#009688">${campaign.name}</strong><p style="color:#666;margin:4px 0 0;font-size:12px">${campaign.description || ""}</p>';
  link.appendChild(info);
  ad.appendChild(link);
  var scripts = document.getElementsByTagName('script');
  var thisScript = scripts[scripts.length - 1];
  thisScript.parentNode.insertBefore(ad, thisScript.nextSibling);
  fetch('${process.env.REPL_URL || ""}/api/campaigns/${campaignId}/impression', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({}) }).catch(function(){});
  link.addEventListener('click', function() {
    fetch('${process.env.REPL_URL || ""}/api/campaigns/${campaignId}/click', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({}) }).catch(function(){});
  });
})();`;
    res.type('js').send(script);
  });

  // ================================================================
  // REVENUE ROUTES
  // ================================================================
  app.get("/api/revenue", isAuthenticated, async (req: any, res) => {
    const transactions = await storage.getRevenueTransactions(req.user.claims.sub);
    const balance = await storage.getUserBalance(req.user.claims.sub);
    res.json({ transactions, balance });
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
  // ADMIN PANEL ROUTES
  // ================================================================
  app.get("/api/admin/stats", isAuthenticated, async (req: any, res) => {
    const stats = await storage.getStats();
    res.json(stats);
  });

  app.get("/api/admin/users", isAuthenticated, async (req: any, res) => {
    const users = await storage.getAllUsers();
    res.json(users);
  });

  app.get("/api/admin/reports", isAuthenticated, async (req: any, res) => {
    const reports = await storage.getReports(req.query.status as string);
    res.json(reports);
  });

  app.put("/api/admin/reports/:id", isAuthenticated, async (req: any, res) => {
    const { status, adminNote } = req.body;
    const report = await storage.updateReport(Number(req.params.id), status, adminNote);
    res.json(report);
  });

  app.get("/api/admin/campaigns", isAuthenticated, async (req: any, res) => {
    const campaigns = await storage.getAllAdCampaigns();
    res.json(campaigns);
  });

  app.put("/api/admin/campaigns/:id", isAuthenticated, async (req: any, res) => {
    const updated = await storage.updateAdCampaign(Number(req.params.id), req.body);
    res.json(updated);
  });

  app.get("/api/admin/channels", isAuthenticated, async (req: any, res) => {
    const { channels } = await import("@shared/schema");
    const { db } = await import("./db");
    const { desc } = await import("drizzle-orm");
    const all = await db.select().from(channels).orderBy(desc(channels.createdAt));
    res.json(all);
  });

  app.put("/api/admin/channels/:id", isAuthenticated, async (req: any, res) => {
    const updated = await storage.updateChannel(Number(req.params.id), req.body);
    res.json(updated);
  });

  // ================================================================
  // AI ROUTES
  // ================================================================
  app.post("/api/ai/generate-copy", isAuthenticated, async (req, res) => {
    try {
      const { productName, targetAudience, language } = req.body;
      const prompt = language === 'ar'
        ? `اكتب عنوان ووصف جذاب لإعلان باللغة العربية. المنتج: "${productName}". الجمهور المستهدف: "${targetAudience}". أعد JSON مع مفاتيح "title" و"description".`
        : `Write a catchy title and description for an ad in English. Product: "${productName}". Target Audience: "${targetAudience}". Return JSON with keys "title" and "description".`;
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });
      const content = JSON.parse(response.choices[0]?.message?.content || "{}");
      res.json(content);
    } catch (error) {
      res.status(500).json({ message: "Failed to generate ad copy" });
    }
  });

  app.post("/api/ai/generate-article", isAuthenticated, async (req, res) => {
    try {
      const { topic, language, tone } = req.body;
      const prompt = language === 'ar'
        ? `اكتب مقالة تسويقية احترافية عن: "${topic}". الأسلوب: ${tone || 'رسمي'}. أعد JSON مع مفاتيح "title" و"content".`
        : `Write a professional marketing article about: "${topic}". Tone: ${tone || 'professional'}. Return JSON with keys "title" and "content".`;
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });
      const content = JSON.parse(response.choices[0]?.message?.content || "{}");
      res.json(content);
    } catch (error) {
      res.status(500).json({ message: "Failed to generate article" });
    }
  });

  app.post("/api/ai/generate-video-script", isAuthenticated, async (req, res) => {
    try {
      const { productName, duration, language } = req.body;
      const prompt = language === 'ar'
        ? `اكتب سكريبت فيديو إعلاني احترافي لـ "${productName}" مدته ${duration || 30} ثانية. أعد JSON مع: "title", "script", "scenes" (مصفوفة من مشاهد كل منها يحتوي على "time" و"visual" و"narration").`
        : `Write a professional ${duration || 30}-second video ad script for "${productName}". Return JSON with: "title", "script", "scenes" (array with "time", "visual", "narration").`;
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });
      const content = JSON.parse(response.choices[0]?.message?.content || "{}");
      res.json(content);
    } catch (error) {
      res.status(500).json({ message: "Failed to generate video script" });
    }
  });

  return httpServer;
}
