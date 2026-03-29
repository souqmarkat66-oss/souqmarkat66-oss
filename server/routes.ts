import type { Express } from "express";
import { createServer, type Server } from "http";
import { Server as SocketServer } from "socket.io";
import { storage } from "./storage";
import { z } from "zod";
import { setupAuth } from "./replit_integrations/auth";
import { isAuthenticated, registerCustomAuthRoutes } from "./customAuth";
import { registerImageRoutes, openai } from "./replit_integrations/image";
import { textToSpeech } from "./replit_integrations/audio";
import { spawn } from "child_process";
import { writeFile, unlink, readFile, mkdir } from "fs/promises";
import { randomUUID } from "crypto";
import { tmpdir } from "os";
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
  registerCustomAuthRoutes(app);
  registerImageRoutes(app);

  // ── DB Migrations (safe — ADD COLUMN IF NOT EXISTS) ──
  try {
    await db.execute(sql`ALTER TABLE reels ADD COLUMN IF NOT EXISTS audio_url text`);
  } catch { /* column may already exist */ }

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

    socket.on("chat-message", (data: { streamId: string; userId: string; userName: string; message: string; isVoice?: boolean; voiceUrl?: string; isOwner?: boolean }) => {
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

  app.delete("/api/files/:id", isAuthenticated, async (req: any, res) => {
    const { uploadedFiles } = await import("@shared/schema");
    const { eq, and } = await import("drizzle-orm");
    const userId = req.user.claims.sub;
    const fileId = Number(req.params.id);
    const [file] = await db.select().from(uploadedFiles).where(and(eq(uploadedFiles.id, fileId), eq(uploadedFiles.userId, userId)));
    if (!file) return res.status(404).json({ message: "File not found" });
    // delete from disk
    try {
      const filePath = path.join(process.cwd(), "uploads", file.filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {}
    await db.delete(uploadedFiles).where(eq(uploadedFiles.id, fileId));
    res.json({ success: true });
  });

  // Admin: all files across platform
  app.get("/api/admin/files", isAuthenticated, requireAdmin, async (_req, res) => {
    const { uploadedFiles } = await import("@shared/schema");
    const { desc } = await import("drizzle-orm");
    const rows = await db.execute(sql`
      SELECT uf.*, u.first_name, u.last_name, u.email
      FROM uploaded_files uf
      LEFT JOIN users u ON u.id = uf.user_id
      ORDER BY uf.created_at DESC LIMIT 500`);
    res.json(rows.rows);
  });

  // ================================================================
  // PLATFORM SETTINGS (Admin only)
  // ================================================================
  app.get("/api/settings", async (req, res) => {
    const settings = await storage.getAllSettings();
    res.json(settings);
  });

  // ── Admin PIN ────────────────────────────────────────────────────
  app.post("/api/admin/pin/set", isAuthenticated, requireAdmin, async (req: any, res) => {
    const { pin, recoveryEmail, recoveryPhone } = req.body;
    if (!pin || pin.length < 4) return res.status(400).json({ message: "PIN لازم يكون 4 أرقام على الأقل" });
    const { createHash } = await import("crypto");
    const hashed = createHash("sha256").update(pin).digest("hex");
    await db.execute(sql`INSERT INTO platform_settings (key, value) VALUES ('admin_pin', ${hashed}) ON CONFLICT (key) DO UPDATE SET value = ${hashed}`);
    if (recoveryEmail) await db.execute(sql`INSERT INTO platform_settings (key, value) VALUES ('admin_recovery_email', ${recoveryEmail}) ON CONFLICT (key) DO UPDATE SET value = ${recoveryEmail}`);
    if (recoveryPhone) await db.execute(sql`INSERT INTO platform_settings (key, value) VALUES ('admin_recovery_phone', ${recoveryPhone}) ON CONFLICT (key) DO UPDATE SET value = ${recoveryPhone}`);
    res.json({ success: true });
  });

  app.post("/api/admin/pin/verify", isAuthenticated, requireAdmin, async (req: any, res) => {
    const { pin } = req.body;
    const { createHash } = await import("crypto");
    const hashed = createHash("sha256").update(pin || "").digest("hex");
    const row = await db.execute(sql`SELECT value FROM platform_settings WHERE key = 'admin_pin' LIMIT 1`);
    const stored = (row.rows[0] as any)?.value;
    if (!stored) return res.json({ valid: true, noPinSet: true }); // no pin yet → allow
    res.json({ valid: hashed === stored });
  });

  app.post("/api/admin/pin/recover", isAuthenticated, requireAdmin, async (req: any, res) => {
    const { input } = req.body; // email or phone
    const emailRow = await db.execute(sql`SELECT value FROM platform_settings WHERE key = 'admin_recovery_email' LIMIT 1`);
    const phoneRow = await db.execute(sql`SELECT value FROM platform_settings WHERE key = 'admin_recovery_phone' LIMIT 1`);
    const storedEmail = (emailRow.rows[0] as any)?.value || "";
    const storedPhone = (phoneRow.rows[0] as any)?.value || "";
    const match = input && (input === storedEmail || input === storedPhone);
    if (!match) return res.status(401).json({ message: "البيانات غير مطابقة، تحقق من الإيميل أو رقم التليفون" });
    // allow reset — return a one-time token stored in memory
    const token = Math.random().toString(36).substring(2, 10).toUpperCase();
    (global as any).__adminResetToken = token;
    setTimeout(() => { (global as any).__adminResetToken = null; }, 15 * 60 * 1000); // 15 min
    res.json({ success: true, resetToken: token });
  });

  app.post("/api/admin/pin/reset", isAuthenticated, requireAdmin, async (req: any, res) => {
    const { newPin, resetToken } = req.body;
    if (!resetToken || resetToken !== (global as any).__adminResetToken) return res.status(401).json({ message: "رمز الاسترداد غير صحيح أو منتهي" });
    if (!newPin || newPin.length < 4) return res.status(400).json({ message: "PIN لازم يكون 4 أرقام على الأقل" });
    const { createHash } = await import("crypto");
    const hashed = createHash("sha256").update(newPin).digest("hex");
    await db.execute(sql`INSERT INTO platform_settings (key, value) VALUES ('admin_pin', ${hashed}) ON CONFLICT (key) DO UPDATE SET value = ${hashed}`);
    (global as any).__adminResetToken = null;
    res.json({ success: true });
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
    const filterUserId = req.query.userId as string | undefined;
    const authUserId = req.user?.claims?.sub;
    if (myAds && authUserId) {
      const ads = await storage.getAds(undefined, authUserId);
      return res.json(ads);
    }
    if (filterUserId) {
      const ads = await storage.getAds(undefined, filterUserId);
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

      // ── Notify channel followers about the new ad (async, non-blocking) ──
      (async () => {
        try {
          const userId = req.user.claims.sub;
          const publisherName = req.user.claims?.first_name || "أحد المعلنين";
          const adLink = `/ads/${ad.id}`;
          const notifTitle = `🆕 إعلان جديد من ${publisherName}`;
          const notifBody = ad.title ? `"${ad.title}" — شاهد الإعلان الآن` : "أُضيف إعلان جديد قد يهمك";

          // 1) Notify followers of the creator's channel
          const channelRows = await db.execute(
            sql`SELECT id FROM channels WHERE user_id = ${userId} LIMIT 1`
          );
          if (channelRows.rows.length > 0) {
            const channelId = (channelRows.rows[0] as any).id;
            const followerRows = await db.execute(
              sql`SELECT follower_id FROM follows WHERE channel_id = ${channelId}`
            );
            for (const row of followerRows.rows as any[]) {
              if (row.follower_id !== userId) {
                await createNotification(row.follower_id, "system", notifTitle, notifBody, adLink);
              }
            }
          }

          // 2) Notify users who liked/viewed ads in the same category
          if (input.targetRegion || (ad as any).targetRegion) {
            // Targeted by region — notify users who liked ads in same category
          }
          // Notify users who liked ads with same category in the last 30 days
          const category = (input as any).category || null;
          if (category) {
            const interestedRows = await db.execute(
              sql`SELECT DISTINCT l.user_id FROM likes l
                  JOIN ads a ON a.id = l.target_id AND l.target_type = 'ad'
                  WHERE a.category = ${category}
                    AND l.user_id != ${userId}
                    AND l.created_at > NOW() - INTERVAL '30 days'
                  LIMIT 50`
            );
            for (const row of interestedRows.rows as any[]) {
              const uid = (row as any).user_id;
              await createNotification(uid, "system",
                `💡 إعلان قد يهمك في ${category}`,
                notifBody, adLink
              );
            }
          }
        } catch (e) {
          console.error('[Ad Notify Followers] Error:', e);
        }
      })();
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
  // AD BOOST NOTIFY — Owner notifies followers & interested users
  // Rate limited: max once every 24h per ad
  // ================================================================
  app.post("/api/ads/:id/boost-notify", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const adId = parseInt(req.params.id);
    try {
      const ad = await storage.getAd(adId);
      if (!ad) return res.status(404).json({ message: "الإعلان غير موجود" });
      if (ad.userId !== userId) return res.status(403).json({ message: "غير مصرح" });

      // Rate limit: check last boost time
      const lastBoost = await db.execute(
        sql`SELECT created_at FROM notifications
            WHERE link = ${`/ads/${adId}`} AND title LIKE '%🚀%'
            ORDER BY created_at DESC LIMIT 1`
      );
      if (lastBoost.rows.length > 0) {
        const last = new Date((lastBoost.rows[0] as any).created_at);
        const hoursAgo = (Date.now() - last.getTime()) / 3_600_000;
        if (hoursAgo < 24) {
          const hoursLeft = Math.ceil(24 - hoursAgo);
          return res.status(429).json({ message: `يمكنك تعزيز الإعلان مرة كل 24 ساعة. الوقت المتبقي: ${hoursLeft} ساعة` });
        }
      }

      const publisherName = req.user.claims?.first_name || "معلن";
      const adLink = `/ads/${adId}`;
      const notifTitle = `🚀 ${publisherName} يعزز إعلانه!`;
      const notifBody = ad.title ? `"${ad.title}" — لا تفوّته!` : "عرض مميز قد يهمك";
      let notifiedCount = 0;

      // 1) Followers of the creator's channel
      const channelRows = await db.execute(
        sql`SELECT id FROM channels WHERE user_id = ${userId} LIMIT 1`
      );
      if (channelRows.rows.length > 0) {
        const channelId = (channelRows.rows[0] as any).id;
        const followerRows = await db.execute(
          sql`SELECT follower_id FROM follows WHERE channel_id = ${channelId}`
        );
        for (const row of followerRows.rows as any[]) {
          const fid = (row as any).follower_id;
          if (fid !== userId) {
            await createNotification(fid, "system", notifTitle, notifBody, adLink);
            notifiedCount++;
          }
        }
      }

      // 2) Users who liked similar ads (by category) in last 60 days
      const category = (ad as any).category || null;
      if (category) {
        const interestedRows = await db.execute(
          sql`SELECT DISTINCT l.user_id FROM likes l
              JOIN ads a ON a.id = l.target_id AND l.target_type = 'ad'
              WHERE a.category = ${category}
                AND l.user_id != ${userId}
                AND l.created_at > NOW() - INTERVAL '60 days'
              LIMIT 100`
        );
        for (const row of interestedRows.rows as any[]) {
          const uid = (row as any).user_id;
          await createNotification(uid, "system",
            `💡 عرض في ${category} قد يهمك`, notifBody, adLink);
          notifiedCount++;
        }
      }

      res.json({ ok: true, notifiedCount });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
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
    const channelId = Number(req.params.id);
    if (isNaN(channelId)) return res.status(400).json({ message: "Invalid channel id" });
    const ch = await storage.getChannel(channelId);
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
    const channelId = Number(req.params.id);
    if (isNaN(channelId)) return res.json({ following: false });
    const follow = await storage.getFollow(req.user.claims.sub, channelId);
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
    const channelId = Number(req.params.channelId);
    if (isNaN(channelId)) return res.json([]);
    const streams = await storage.getLiveStreamsByChannel(channelId);
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

    // ── Notify all channel followers that the stream is live ──────────────
    (async () => {
      try {
        const broadcasterName = req.user.claims?.first_name || "المذيع";
        const streamLink = `/streams/${stream.id}`;
        const notifTitle = `📡 ${broadcasterName} بدأ بثاً مباشراً!`;
        const notifBody = stream.title ? `"${stream.title}" — شاهد الآن` : "انضم الآن للبث المباشر";
        // Get all followers of this channel
        if (stream.channelId) {
          const followerRows = await db.execute(
            sql`SELECT follower_id FROM follows WHERE channel_id = ${stream.channelId}`
          );
          const followerIds: string[] = (followerRows.rows as any[]).map((r: any) => r.follower_id);
          for (const followerId of followerIds) {
            if (followerId !== req.user.claims.sub) {
              await createNotification(followerId, "system", notifTitle, notifBody, streamLink);
            }
          }
        }
      } catch (e) {
        console.error('[Stream Notify Followers] Error:', e);
      }
    })();

    // AI Moderation — async, non-blocking
    (async () => {
      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{
            role: 'system',
            content: 'أنت نظام مراقبة محتوى. حلل عنوان ووصف البث المباشر وقرر إذا كان يخالف سياسة المنصة (محتوى إباحي، عنف، تحريض، احتيال). أجب بـ JSON فقط: {"safe": true/false, "reason": "..."}'
          }, {
            role: 'user',
            content: `عنوان البث: ${stream.title || ''}\nالوصف: ${stream.description || ''}`
          }],
          max_tokens: 150,
          temperature: 0,
        });
        const raw = completion.choices[0].message.content || '{}';
        let verdict: any = {};
        try { verdict = JSON.parse(raw.replace(/```json|```/g, '').trim()); } catch {}
        const isSafe = verdict.safe !== false;
        await db.execute(
          sql`INSERT INTO stream_moderation (stream_id, status, ai_verdict, ai_reason)
              VALUES (${stream.id}, ${isSafe ? 'approved' : 'flagged'}, ${isSafe ? 'safe' : 'unsafe'}, ${verdict.reason || null})`
        );
        if (!isSafe) {
          // Auto-suspend flagged stream
          await storage.updateLiveStream(stream.id, { status: 'ended' });
          console.warn(`[AI Moderation] Stream ${stream.id} flagged: ${verdict.reason}`);
        }
      } catch (e) {
        console.error('[AI Moderation] Error:', e);
      }
    })();
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
  // Helper: create notification silently
  async function createNotification(userId: string, type: string, title: string, body: string, link?: string, voiceUrl?: string, senderUserId?: string) {
    try {
      await db.execute(
        sql`INSERT INTO notifications (user_id, type, title, body, link, voice_url, sender_user_id)
            VALUES (${userId}, ${type}, ${title}, ${body}, ${link ?? null}, ${voiceUrl ?? null}, ${senderUserId ?? null})`
      );
    } catch {}
  }

  app.post("/api/likes", isAuthenticated, async (req: any, res) => {
    const { targetType, targetId } = req.body;
    const userId = req.user.claims.sub;
    const result = await storage.toggleLike(userId, targetType, Number(targetId));

    // Send notification to content owner (async, don't block)
    if (result.liked) {
      try {
        let ownerRow: any = null;
        let link = "";
        if (targetType === "ad") {
          const r = await db.execute(sql`SELECT user_id FROM ads WHERE id = ${targetId}`);
          ownerRow = r.rows[0]; link = `/ads/${targetId}`;
        } else if (targetType === "reel") {
          const r = await db.execute(sql`SELECT user_id FROM reels WHERE id = ${targetId}`);
          ownerRow = r.rows[0]; link = `/reels`;
        } else if (targetType === "stream") {
          const r = await db.execute(sql`SELECT user_id FROM live_streams WHERE id = ${targetId}`);
          ownerRow = r.rows[0]; link = `/streams/${targetId}`;
        }
        if (ownerRow && ownerRow.user_id !== userId) {
          const name = req.user.claims?.first_name || "مستخدم";
          await createNotification(ownerRow.user_id, "like", "إعجاب جديد ❤️", `${name} أعجب بمحتواك`, link);
        }
      } catch {}
    }
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
      // Notify content owner
      try {
        const { targetType, targetId, isVoiceComment, voiceText } = req.body;
        let ownerRow: any = null; let link = "";
        if (targetType === "ad") {
          const r = await db.execute(sql`SELECT user_id FROM ads WHERE id = ${targetId}`);
          ownerRow = r.rows[0]; link = `/ads/${targetId}`;
        } else if (targetType === "reel") {
          const r = await db.execute(sql`SELECT user_id FROM reels WHERE id = ${targetId}`);
          ownerRow = r.rows[0]; link = `/reels`;
        } else if (targetType === "stream") {
          const r = await db.execute(sql`SELECT user_id FROM live_streams WHERE id = ${targetId}`);
          ownerRow = r.rows[0]; link = `/streams/${targetId}`;
        }
        if (ownerRow && ownerRow.user_id !== userId) {
          const isVoice = isVoiceComment && !!voiceText;
          const title = isVoice ? "🎤 تعليق صوتي جديد" : "تعليق جديد 💬";
          const body = isVoice ? `${userName}: أرسل تعليقاً صوتياً` : `${userName}: ${String(req.body.content).slice(0, 60)}`;
          await createNotification(ownerRow.user_id, "comment", title, body, link,
            isVoice ? voiceText : undefined,
            isVoice ? userId : undefined
          );
        }
      } catch {}
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
    const filterUserId = req.query.userId as string | undefined;
    const authUserId = req.user?.claims?.sub;
    if (myReels && authUserId) {
      const reels = await storage.getReels(authUserId);
      return res.json(reels);
    }
    if (filterUserId) {
      const reels = await storage.getReels(filterUserId);
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

  app.get("/api/campaigns/random", async (req, res) => {
    const campaigns = await storage.getActiveCampaigns();
    if (!campaigns || campaigns.length === 0) return res.status(404).json({ message: "No active campaigns" });
    const random = campaigns[Math.floor(Math.random() * campaigns.length)];
    res.json(random);
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

  // ─── AI FRAUD DETECTION ──────────────────────────────────────
  const BOT_AGENTS = ['bot','spider','crawl','scraper','headless','phantom','selenium','puppeteer','curl','wget','python-requests'];

  async function detectFraud(
    campaignId: number, ip: string, ua: string, eventType: string, userId?: string
  ): Promise<{ isFraud: boolean; reason: string }> {

    // 1. بوت / كرولر
    const lowerUA = (ua || '').toLowerCase();
    if (BOT_AGENTS.some(b => lowerUA.includes(b))) {
      return { isFraud: true, reason: 'user_agent_bot' };
    }

    // 2. المعلن لا يستطيع النقر على إعلانه هو (self-click)
    if (userId) {
      const campaign = await storage.getAdCampaign(campaignId);
      if (campaign && campaign.advertiserId === userId) {
        return { isFraud: true, reason: 'self_click_advertiser' };
      }
      // صاحب القناة لا يستطيع النقر على الإعلانات في قناته لكسب إيراد
      if (eventType === 'click') {
        const ownerChannel = await storage.getChannelByUserId(userId);
        if (ownerChannel) {
          const recentSelf = await db.execute(
            sql`SELECT COUNT(*) as cnt FROM ad_impressions
                WHERE campaign_id = ${campaignId} AND user_id = ${userId}
                AND event_type = 'click' AND created_at > (now() - interval '1 hour')`
          );
          const selfClicks = Number((recentSelf.rows[0] as any)?.cnt || 0);
          if (selfClicks >= 2) {
            return { isFraud: true, reason: `self_channel_click_flood_${selfClicks}` };
          }
        }
      }
      // نفس المستخدم شاف نفس الإعلان أكتر من 3 مرات في ساعة
      if (eventType === 'impression') {
        const selfImpr = await db.execute(
          sql`SELECT COUNT(*) as cnt FROM ad_impressions
              WHERE campaign_id = ${campaignId} AND user_id = ${userId}
              AND event_type = 'impression' AND created_at > (now() - interval '1 hour')`
        );
        const cnt = Number((selfImpr.rows[0] as any)?.cnt || 0);
        if (cnt >= 5) {
          return { isFraud: true, reason: `duplicate_impression_${cnt}` };
        }
      }
    }

    // 3. Rate limit: same IP > 15 events in 5 minutes
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const countResult = await db.execute(
      sql`SELECT COUNT(*) as cnt FROM ad_impressions 
          WHERE campaign_id = ${campaignId} AND ip_address = ${ip} 
          AND created_at > ${fiveMinAgo}::timestamp`
    );
    const cnt = Number((countResult.rows[0] as any)?.cnt || 0);
    if (cnt >= 15) {
      return { isFraud: true, reason: `rate_limit_${cnt}_events_5min` };
    }

    // 4. Click flood: >3 نقرات من نفس الـ IP في 10 دقائق
    if (eventType === 'click') {
      const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const clickResult = await db.execute(
        sql`SELECT COUNT(*) as cnt FROM ad_impressions
            WHERE campaign_id = ${campaignId} AND ip_address = ${ip}
            AND event_type = 'click' AND created_at > ${tenMinAgo}::timestamp`
      );
      const clicks = Number((clickResult.rows[0] as any)?.cnt || 0);
      if (clicks >= 3) {
        return { isFraud: true, reason: `click_flood_${clicks}_clicks_10min` };
      }
    }

    return { isFraud: false, reason: '' };
  }

  // ── تسجيل مشاهدة ────────────────────────────────────────────
  app.post("/api/campaigns/:id/impression", async (req: any, res) => {
    const { channelId } = req.body;
    // userId من الجلسة إن وُجد، وإلا من الـ body
    const userId: string | undefined = req.user?.claims?.sub || req.body.userId || undefined;
    const campaignId = Number(req.params.id);
    const ip = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
    const ua = req.headers['user-agent'] || '';
    try {
      const fraud = await detectFraud(campaignId, ip, ua, 'impression', userId);
      await db.execute(
        sql`INSERT INTO ad_impressions (campaign_id, channel_id, user_id, ip_address, user_agent, event_type, is_fraud, fraud_reason)
            VALUES (${campaignId}, ${channelId || null}, ${userId || null}, ${ip}, ${ua}, 'impression', ${fraud.isFraud}, ${fraud.reason || null})`
      );
      if (!fraud.isFraud) {
        const result = await storage.recordImpression(campaignId, channelId, userId);
        // تنبيه الميزانية إذا وصلت 80%+
        if (result.budgetWarning && result.advertiserId) {
          const pct = Math.round((result.budgetRatio || 0) * 100);
          const notifKey = `budget_warn_${campaignId}_${pct >= 100 ? 'full' : '80'}`;
          const already = await db.execute(
            sql`SELECT id FROM notifications WHERE user_id = ${result.advertiserId} AND link = ${notifKey} LIMIT 1`
          );
          if ((already.rows as any[]).length === 0) {
            await createNotification(
              result.advertiserId, 'system',
              pct >= 100 ? `⛔ انتهت ميزانية حملتك!` : `⚠️ تنبيه: ميزانية حملتك ${pct}%`,
              pct >= 100
                ? `حملة "${result.campaignName}" توقفت تلقائياً. اشحن رصيدك لاستمرار النشر.`
                : `حملة "${result.campaignName}" استهلكت ${pct}% من الميزانية. اشحن رصيدك الآن!`,
              notifKey
            );
          }
        }
      } else {
        await db.execute(
          sql`INSERT INTO fraud_alerts (campaign_id, ip_address, alert_type, details)
              VALUES (${campaignId}, ${ip}, 'impression', ${fraud.reason})`
        );
      }
      res.json({ success: true, fraud: fraud.isFraud, reason: fraud.reason });
    } catch {
      await storage.recordImpression(campaignId, channelId, userId);
      res.json({ success: true });
    }
  });

  // ── تسجيل نقرة ──────────────────────────────────────────────
  app.post("/api/campaigns/:id/click", async (req: any, res) => {
    const { channelId } = req.body;
    const userId: string | undefined = req.user?.claims?.sub || req.body.userId || undefined;
    const campaignId = Number(req.params.id);
    const ip = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
    const ua = req.headers['user-agent'] || '';
    try {
      const fraud = await detectFraud(campaignId, ip, ua, 'click', userId);
      await db.execute(
        sql`INSERT INTO ad_impressions (campaign_id, channel_id, user_id, ip_address, user_agent, event_type, is_fraud, fraud_reason)
            VALUES (${campaignId}, ${channelId || null}, ${userId || null}, ${ip}, ${ua}, 'click', ${fraud.isFraud}, ${fraud.reason || null})`
      );
      if (!fraud.isFraud) {
        const result = await storage.recordClick(campaignId, channelId, userId);
        if (result.budgetWarning && result.advertiserId) {
          const pct = Math.round((result.budgetRatio || 0) * 100);
          const notifKey = `budget_warn_${campaignId}_${pct >= 100 ? 'full' : '80'}`;
          const already = await db.execute(
            sql`SELECT id FROM notifications WHERE user_id = ${result.advertiserId} AND link = ${notifKey} LIMIT 1`
          );
          if ((already.rows as any[]).length === 0) {
            await createNotification(
              result.advertiserId, 'system',
              pct >= 100 ? `⛔ انتهت ميزانية حملتك!` : `⚠️ ميزانية حملتك ${pct}%`,
              pct >= 100
                ? `حملة "${result.campaignName}" توقفت. اشحن رصيدك لاستمرار النشر.`
                : `حملة "${result.campaignName}" استهلكت ${pct}% من الميزانية!`,
              notifKey
            );
          }
        }
      } else {
        await db.execute(
          sql`INSERT INTO fraud_alerts (campaign_id, ip_address, alert_type, details)
              VALUES (${campaignId}, ${ip}, 'click', ${fraud.reason})`
        );
      }
      res.json({ success: true, fraud: fraud.isFraud, reason: fraud.reason });
    } catch {
      await storage.recordClick(campaignId, channelId, userId);
      res.json({ success: true });
    }
  });

  // Admin: stream moderation log
  app.get("/api/admin/stream-moderation", isAuthenticated, requireAdmin, async (_req, res) => {
    try {
      const result = await db.execute(
        sql`SELECT sm.*, ls.title as stream_title, ls.status as stream_status
            FROM stream_moderation sm
            LEFT JOIN live_streams ls ON ls.id = sm.stream_id
            ORDER BY sm.reviewed_at DESC LIMIT 100`
      );
      res.json(result.rows);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Admin: get fraud alerts
  app.get("/api/admin/fraud-alerts", isAuthenticated, requireAdmin, async (_req, res) => {
    try {
      const result = await db.execute(
        sql`SELECT fa.*, c.name as campaign_name, c.budget_egp 
            FROM fraud_alerts fa
            LEFT JOIN ad_campaigns c ON c.id = fa.campaign_id
            ORDER BY fa.created_at DESC LIMIT 200`
      );
      res.json(result.rows);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Admin: get all ads with search
  app.get("/api/admin/ads", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const search = req.query.search as string || '';
      let result;
      if (search) {
        result = await db.execute(
          sql`SELECT * FROM ads WHERE title ILIKE ${'%' + search + '%'} OR description ILIKE ${'%' + search + '%'} ORDER BY created_at DESC LIMIT 50`
        );
      } else {
        result = await db.execute(sql`SELECT * FROM ads ORDER BY created_at DESC LIMIT 50`);
      }
      res.json(result.rows);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Admin: update ad
  app.put("/api/admin/ads/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
      const { status, priceEGP, title } = req.body;
      if (status !== undefined) {
        await db.execute(sql`UPDATE ads SET status = ${status} WHERE id = ${id}`);
      }
      if (priceEGP !== undefined) {
        await db.execute(sql`UPDATE ads SET price_egp = ${Number(priceEGP)} WHERE id = ${id}`);
      }
      if (title !== undefined) {
        await db.execute(sql`UPDATE ads SET title = ${title} WHERE id = ${id}`);
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Admin: fraud stats summary
  app.get("/api/admin/fraud-stats", isAuthenticated, requireAdmin, async (_req, res) => {
    try {
      const stats = await db.execute(
        sql`SELECT 
              COUNT(*) FILTER (WHERE is_fraud = true) as total_fraud,
              COUNT(*) FILTER (WHERE is_fraud = false) as total_legit,
              COUNT(*) FILTER (WHERE is_fraud = true AND event_type='click') as fraud_clicks,
              COUNT(*) FILTER (WHERE is_fraud = true AND event_type='impression') as fraud_impressions
            FROM ad_impressions`
      );
      res.json(stats.rows[0]);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
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

  // ── Publisher Widget JS (by publisherCode) ──────────────────
  app.get("/api/widget/:publisherCode", async (req, res) => {
    const { publisherCode } = req.params;
    // Find channel by publisherCode
    const allChannels = await storage.getChannels();
    const channel = allChannels.find((c: any) => c.publisherCode === publisherCode);
    if (!channel) {
      return res.type('js').send('/* Souq Ads: invalid publisher code */');
    }
    // Get a random active campaign to display
    const campaigns = await storage.getActiveCampaigns();
    const ad = campaigns.length > 0 ? campaigns[Math.floor(Math.random() * campaigns.length)] : null;
    const adHtml = ad
      ? `<a href="${ad.targetUrl||'#'}" target="_blank" rel="noopener" style="display:block;text-decoration:none" onclick="fetch('/api/campaigns/${ad.id}/click',{method:'POST'}).catch(()=>{})">
          ${ad.mediaType === 'video'
            ? `<video src="${ad.mediaUrl}" autoplay muted loop playsinline style="width:100%;display:block;border-radius:8px 8px 0 0"></video>`
            : `<img src="${ad.mediaUrl}" alt="${ad.name}" style="width:100%;display:block;border-radius:8px 8px 0 0" />`}
          <div style="padding:10px 14px;background:#f9f9f9;font-family:Cairo,sans-serif;direction:rtl">
            <strong style="color:#009688;font-size:14px">${ad.name}</strong>
            ${ad.description ? `<p style="color:#666;margin:4px 0 0;font-size:12px">${ad.description}</p>` : ''}
            <span style="font-size:10px;color:#aaa">إعلان ممول · سوق للإعلانات</span>
          </div>
        </a>`
      : `<div style="padding:16px;text-align:center;color:#999;font-family:Cairo;font-size:13px">لا توجد إعلانات نشطة حالياً</div>`;
    if (ad) {
      storage.recordImpression(ad.id).catch(() => {});
    }
    const script = `(function(){
  var w=document.createElement('div');
  w.style.cssText='max-width:480px;margin:12px auto;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.12);background:#fff;';
  w.innerHTML=${JSON.stringify(adHtml)};
  var s=document.currentScript||document.scripts[document.scripts.length-1];
  s.parentNode.insertBefore(w,s.nextSibling);
})();`;
    res.type('js').set('Cache-Control', 'no-cache').send(script);
  });

  // ── Publisher Widget iframe HTML ─────────────────────────────
  app.get("/api/widget/:publisherCode/iframe", async (req, res) => {
    const { publisherCode } = req.params;
    const allChannels = await storage.getChannels();
    const channel = allChannels.find((c: any) => c.publisherCode === publisherCode);
    if (!channel) return res.status(404).send('<html><body>كود ناشر غير صحيح</body></html>');
    const campaigns = await storage.getActiveCampaigns();
    const ad = campaigns.length > 0 ? campaigns[Math.floor(Math.random() * campaigns.length)] : null;
    const html = `<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8">
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Cairo,sans-serif;background:#fff}</style>
</head><body>${ad
      ? `<a href="${ad.targetUrl||'#'}" target="_blank" rel="noopener" style="display:block;text-decoration:none">
          ${ad.mediaType==='video'
            ? `<video src="${ad.mediaUrl}" autoplay muted loop playsinline style="width:100%;display:block"></video>`
            : `<img src="${ad.mediaUrl}" style="width:100%;display:block" />`}
          <div style="padding:8px 12px;background:#f9f9f9">
            <strong style="color:#009688;font-size:13px">${ad.name}</strong>
            <span style="display:block;font-size:10px;color:#aaa">إعلان ممول · سوق للإعلانات</span>
          </div></a>`
      : `<div style="padding:20px;text-align:center;color:#aaa;font-size:13px">لا توجد إعلانات حالياً</div>`}
</body></html>`;
    if (ad) storage.recordImpression(ad.id).catch(() => {});
    res.type('html').set('Cache-Control', 'no-cache').send(html);
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

  // ── تقرير المعلن التفصيلي ──────────────────────────────────────
  app.get("/api/advertiser/report", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    try {
      // حملاته مع إحصائيات تفصيلية
      const campaigns = await storage.getAdCampaigns(userId);
      const campaignIds = campaigns.map(c => c.id);

      let campaignStats: any[] = [];
      if (campaignIds.length > 0) {
        const statsResult = await db.execute(sql`
          SELECT
            campaign_id,
            COUNT(*) FILTER (WHERE event_type = 'impression' AND is_fraud = false) as real_impressions,
            COUNT(*) FILTER (WHERE event_type = 'click' AND is_fraud = false) as real_clicks,
            COUNT(*) FILTER (WHERE event_type = 'impression' AND is_fraud = true) as fraud_impressions,
            COUNT(*) FILTER (WHERE event_type = 'click' AND is_fraud = true) as fraud_clicks
          FROM ad_impressions
          WHERE campaign_id = ANY(ARRAY[${sql.raw(campaignIds.join(','))}])
          GROUP BY campaign_id`);
        campaignStats = statsResult.rows as any[];
      }

      const merged = campaigns.map(c => {
        const st = campaignStats.find((s: any) => s.campaign_id === c.id) || {};
        const realImpr = Number(st.real_impressions || 0);
        const realClicks = Number(st.real_clicks || 0);
        const cpmRate = c.cpmRateEGP || 15;
        const cpcRate = cpmRate / 20;
        const spentEGP = c.spentEGP || 0;
        const budgetEGP = c.budgetEGP || 0;
        const budgetPct = budgetEGP > 0 ? Math.round((spentEGP / budgetEGP) * 100) : 0;
        const ctr = realImpr > 0 ? ((realClicks / realImpr) * 100).toFixed(2) : '0';
        return {
          ...c, realImpressions: realImpr, realClicks, fraudImpressions: Number(st.fraud_impressions || 0),
          fraudClicks: Number(st.fraud_clicks || 0), cpmRate, cpcRate, ctr, budgetPct,
        };
      });

      // معاملات الإنفاق فقط
      const txs = (await storage.getRevenueTransactions(userId)).filter(t => t.type === 'spending');
      const totalSpent = txs.reduce((s, t) => s + (t.amountEGP || 0), 0);
      const balance = await storage.getUserBalanceEGP(userId);

      res.json({ campaigns: merged, transactions: txs, totalSpentEGP: totalSpent, balanceEGP: balance });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ── تقرير الناشر (صاحب القناة) التفصيلي ──────────────────────
  app.get("/api/publisher/report", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    try {
      const channel = await storage.getChannelByUserId(userId);
      let channelStats: any = {};
      if (channel) {
        const statsResult = await db.execute(sql`
          SELECT
            COUNT(*) FILTER (WHERE event_type = 'impression' AND is_fraud = false) as real_impressions,
            COUNT(*) FILTER (WHERE event_type = 'click' AND is_fraud = false) as real_clicks,
            COUNT(*) FILTER (WHERE event_type = 'impression' AND is_fraud = true) as fraud_impressions,
            COUNT(*) FILTER (WHERE event_type = 'click' AND is_fraud = true) as fraud_clicks,
            COUNT(DISTINCT campaign_id) as campaigns_served
          FROM ad_impressions
          WHERE channel_id = ${channel.id}`);
        channelStats = statsResult.rows[0] || {};
      }

      // معاملات الأرباح فقط
      const txs = (await storage.getRevenueTransactions(userId)).filter(t => t.type === 'earning');
      const totalEarned = txs.reduce((s, t) => s + (t.amountEGP || 0), 0);
      const withdrawn = (await storage.getRevenueTransactions(userId))
        .filter(t => t.type === 'withdrawal').reduce((s, t) => s + (t.amountEGP || 0), 0);
      const balance = await storage.getUserBalanceEGP(userId);

      res.json({
        channel, channelStats, transactions: txs, totalEarnedEGP: totalEarned,
        withdrawnEGP: withdrawn, balanceEGP: balance
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
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
      // Generate unique order number: ORD-YYYYMMDD-XXXX
      const now = new Date();
      const datePart = now.toISOString().slice(0,10).replace(/-/g,"");
      const rand = Math.floor(1000 + Math.random() * 9000);
      const orderNumber = `ORD-${datePart}-${rand}`;
      const input = insertPaymentRequestSchema.parse({
        ...req.body,
        userId: req.user.claims.sub,
        orderNumber,
      });
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

  // ── Admin: إيرادات المنصة الكاملة ─────────────────────────────
  app.get("/api/admin/revenue", isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      // إجمالي الإنفاق من جميع الحملات (= إيرادات المنصة الكاملة)
      const campaignStats = await db.execute(sql`
        SELECT 
          COUNT(*) as total_campaigns,
          SUM(impressions) as total_impressions,
          SUM(clicks) as total_clicks,
          SUM(spent_egp) as total_spent,
          SUM(budget_egp) as total_budget
        FROM ad_campaigns`);
      const cs = campaignStats.rows[0] as any;

      // إيرادات أصحاب القنوات
      const channelRevenue = await db.execute(sql`
        SELECT c.id, c.name, c.user_id, c.earnings_egp, c.subscriber_count,
               COUNT(DISTINCT ai.id) as impression_count,
               COUNT(DISTINCT ai2.id) as click_count
        FROM channels c
        LEFT JOIN ad_impressions ai ON ai.channel_id = c.id AND ai.event_type = 'impression' AND ai.is_fraud = false
        LEFT JOIN ad_impressions ai2 ON ai2.channel_id = c.id AND ai2.event_type = 'click' AND ai2.is_fraud = false
        GROUP BY c.id, c.name, c.user_id, c.earnings_egp, c.subscriber_count
        ORDER BY c.earnings_egp DESC
        LIMIT 20`);

      // إنفاق المعلنين
      const advertiserSpend = await db.execute(sql`
        SELECT ac.advertiser_id, 
               SUM(ac.spent_egp) as total_spent,
               SUM(ac.impressions) as total_impressions,
               SUM(ac.clicks) as total_clicks,
               COUNT(*) as campaign_count
        FROM ad_campaigns ac
        GROUP BY ac.advertiser_id
        ORDER BY total_spent DESC
        LIMIT 20`);

      // إيراد المنصة (40% من الإنفاق الكلي)
      const totalSpent = Number(cs.total_spent || 0);
      const platformRevenue = totalSpent * 0.40;
      const publishersRevenue = totalSpent * 0.60;

      // آخر 50 معاملة على مستوى المنصة
      const recentTx = await db.execute(sql`
        SELECT rt.*, ac.name as campaign_name
        FROM revenue_transactions rt
        LEFT JOIN ad_campaigns ac ON ac.id = rt.campaign_id
        ORDER BY rt.created_at DESC
        LIMIT 50`);

      // إحصاء الاحتيال
      const fraudCount = await db.execute(sql`
        SELECT COUNT(*) as fraud_total,
               COUNT(*) FILTER (WHERE event_type = 'click') as fraud_clicks,
               COUNT(*) FILTER (WHERE event_type = 'impression') as fraud_impressions
        FROM ad_impressions WHERE is_fraud = true`);
      const fc = fraudCount.rows[0] as any;

      res.json({
        summary: {
          totalCampaigns: Number(cs.total_campaigns || 0),
          totalImpressions: Number(cs.total_impressions || 0),
          totalClicks: Number(cs.total_clicks || 0),
          totalSpentEGP: totalSpent,
          platformRevenueEGP: platformRevenue,
          publishersRevenueEGP: publishersRevenue,
          totalBudgetEGP: Number(cs.total_budget || 0),
          fraudTotal: Number(fc.fraud_total || 0),
          fraudClicks: Number(fc.fraud_clicks || 0),
          fraudImpressions: Number(fc.fraud_impressions || 0),
        },
        channelRevenue: channelRevenue.rows,
        advertiserSpend: advertiserSpend.rows,
        recentTransactions: recentTx.rows,
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/admin/reels", isAuthenticated, requireAdmin, async (req: any, res) => {
    const { reels } = await import("@shared/schema");
    const { desc } = await import("drizzle-orm");
    const all = await db.select().from(reels).orderBy(desc(reels.createdAt));
    res.json(all);
  });

  app.put("/api/admin/reels/:id", isAuthenticated, requireAdmin, async (req: any, res) => {
    const { reels } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    const { status } = req.body;
    const [updated] = await db.update(reels).set({ status }).where(eq(reels.id, Number(req.params.id))).returning();
    res.json(updated);
  });

  app.delete("/api/admin/reels/:id", isAuthenticated, requireAdmin, async (req: any, res) => {
    const { reels } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    await db.delete(reels).where(eq(reels.id, Number(req.params.id)));
    res.json({ success: true });
  });

  app.delete("/api/admin/ads/:id", isAuthenticated, requireAdmin, async (req: any, res) => {
    const { ads } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    await db.delete(ads).where(eq(ads.id, Number(req.params.id)));
    res.json({ success: true });
  });

  app.put("/api/admin/users/:id", isAuthenticated, requireAdmin, async (req: any, res) => {
    const { users } = await import("@shared/models/auth");
    const { eq } = await import("drizzle-orm");
    const { isBanned, role } = req.body;
    try {
      await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned boolean DEFAULT false`);
      await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS role text DEFAULT 'user'`);
    } catch {}
    await db.execute(sql`UPDATE users SET is_banned = ${isBanned ?? false}, role = ${role ?? 'user'} WHERE id = ${req.params.id}`);
    res.json({ success: true });
  });

  app.get("/api/admin/users", isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned boolean DEFAULT false`);
      await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS role text DEFAULT 'user'`);
    } catch {}
    const search = req.query.search as string || '';
    const rows = await db.execute(sql`
      SELECT u.id, u.email, u.first_name, u.last_name, u.profile_image_url, u.created_at,
             COALESCE(u.is_banned, false) as is_banned,
             COALESCE(u.role, 'user') as role,
             (SELECT COUNT(*) FROM ads WHERE user_id = u.id) as ads_count,
             (SELECT COUNT(*) FROM channels WHERE user_id = u.id) as channels_count,
             (SELECT COUNT(*) FROM reels WHERE user_id = u.id) as reels_count,
             (SELECT COALESCE(SUM(amount_egp),0) FROM revenue_transactions WHERE user_id = u.id AND type = 'earning') as total_earnings
      FROM users u
      WHERE (${search} = '' OR u.email ILIKE ${'%' + search + '%'} OR u.first_name ILIKE ${'%' + search + '%'} OR u.last_name ILIKE ${'%' + search + '%'})
      ORDER BY u.created_at DESC
      LIMIT 100`);
    res.json(rows.rows);
  });

  app.put("/api/admin/streams/:id", isAuthenticated, requireAdmin, async (req: any, res) => {
    const { liveStreams } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    const { status } = req.body;
    const [updated] = await db.update(liveStreams).set({ status, endedAt: status === 'ended' ? new Date() : undefined }).where(eq(liveStreams.id, Number(req.params.id))).returning();
    res.json(updated);
  });

  app.get("/api/admin/streams", isAuthenticated, requireAdmin, async (req: any, res) => {
    const { liveStreams } = await import("@shared/schema");
    const { desc } = await import("drizzle-orm");
    const all = await db.select().from(liveStreams).orderBy(desc(liveStreams.createdAt));
    res.json(all);
  });

  app.post("/api/admin/notifications/broadcast", isAuthenticated, requireAdmin, async (req: any, res) => {
    const { title, body, link, targetType } = req.body;
    if (!title || !body) return res.status(400).json({ message: "title and body required" });
    const rows = await db.execute(sql`SELECT id FROM users LIMIT 1000`);
    let count = 0;
    for (const row of rows.rows as any[]) {
      try {
        await storage.createNotification(row.id, 'system', title, body, link || undefined);
        count++;
      } catch {}
    }
    res.json({ success: true, sent: count });
  });

  app.get("/api/admin/activity-log", isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const rows = await db.execute(sql`
        SELECT al.*, u.first_name, u.last_name, u.email
        FROM admin_activity_log al
        LEFT JOIN users u ON u.id = al.admin_id
        ORDER BY al.created_at DESC LIMIT 200`);
      res.json(rows.rows);
    } catch {
      res.json([]);
    }
  });

  app.post("/api/admin/activity-log", isAuthenticated, requireAdmin, async (req: any, res) => {
    const adminId = req.user.claims.sub;
    const { action, target, details } = req.body;
    try {
      await db.execute(sql`CREATE TABLE IF NOT EXISTS admin_activity_log (
        id serial PRIMARY KEY, admin_id varchar, action text, target text, details text, created_at timestamp DEFAULT now()
      )`);
      await db.execute(sql`INSERT INTO admin_activity_log (admin_id, action, target, details) VALUES (${adminId}, ${action}, ${target}, ${details})`);
    } catch {}
    res.json({ success: true });
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
        model: "gpt-image-1",
        prompt: prompt,
        n: 1,
        size: (size || "1024x1024") as any,
      });
      // gpt-image-1 returns b64_json, save to file
      const b64 = response.data[0]?.b64_json;
      const imageUrl = response.data[0]?.url;
      let finalUrl = imageUrl;
      if (!finalUrl && b64) {
        const buf = Buffer.from(b64, 'base64');
        const filename = `ai-img-${Date.now()}.png`;
        const savePath = path.join(process.cwd(), 'uploads', filename);
        fs.writeFileSync(savePath, buf);
        finalUrl = `/uploads/${filename}`;
      }
      if (!finalUrl) throw new Error("No image generated");
      await storage.recordAiUsage(userId, 'image');
      if (req.aiChargeEGP) {
        await storage.createTransaction({ userId, type: 'ai_charge', amountEGP: req.aiChargeEGP, description: 'رسوم توليد صورة بالذكاء الاصطناعي' });
      }
      res.json({ url: finalUrl, creditsUsed: (req.aiUsageCount || 0) + 1 });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to generate image: " + error.message });
    }
  });

  // ─── AI TEXT-TO-SPEECH (Egyptian Arabic via gpt-audio) ───────
  app.post("/api/ai/tts", isAuthenticated, async (req: any, res) => {
    try {
      const { text, voice = "nova" } = req.body;
      if (!text || text.trim().length < 2) return res.status(400).json({ message: "النص مطلوب" });

      const audioBuffer = await textToSpeech(text.trim(), voice as any, "mp3");

      if (!audioBuffer || audioBuffer.length < 100) {
        return res.status(500).json({ message: "الصوت لم يتم توليده بشكل صحيح، حاول مرة أخرى" });
      }

      const filename = `tts-${Date.now()}.mp3`;
      const savePath = path.join(process.cwd(), 'uploads', filename);
      await writeFile(savePath, audioBuffer);
      res.json({ url: `/uploads/${filename}`, size: audioBuffer.length });
    } catch (error: any) {
      console.error("TTS error:", error);
      res.status(500).json({ message: "فشل توليد الصوت: " + error.message });
    }
  });

  // ─── AI IMAGES-TO-VIDEO (FFmpeg Cinematic HD) ──────────────────
  app.post("/api/ai/images-to-video", isAuthenticated, async (req: any, res) => {
    const tmpFiles: string[] = [];
    try {
      const {
        imageUrls,
        audioUrl,
        duration = 4,
        quality = "hd",        // standard | hd | cinema
        format = "vertical",   // vertical (9:16) | landscape (16:9)
      } = req.body;

      if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length < 1) {
        return res.status(400).json({ message: "أرسل صورة واحدة على الأقل" });
      }

      // ── Resolution & encode settings by quality ──────────────
      const qualityMap: Record<string, { w: number; h: number; crf: number; preset: string; vBitrate: string; maxrate: string }> = {
        standard: { w: 720,  h: 1280, crf: 22, preset: "fast",   vBitrate: "2000k", maxrate: "3000k" },
        hd:       { w: 1080, h: 1920, crf: 18, preset: "medium", vBitrate: "4500k", maxrate: "6000k" },
        cinema:   { w: 1080, h: 1920, crf: 16, preset: "slow",   vBitrate: "6000k", maxrate: "8000k" },
      };
      const landscape = format === "landscape";
      const q = qualityMap[quality] || qualityMap.hd;
      const W = landscape ? q.h : q.w;
      const H = landscape ? q.w : q.h;
      const durationFrames = Math.round(duration * 25);
      const uploadsDir = path.join(process.cwd(), 'uploads');

      // ── Download / resolve images ──────────────────────────────
      const localImages: string[] = [];
      for (const imgUrl of imageUrls) {
        const tmpPath = path.join(tmpdir(), `img-${randomUUID()}.jpg`);
        tmpFiles.push(tmpPath);
        if (imgUrl.startsWith('/uploads/')) {
          const buf = await readFile(path.join(process.cwd(), imgUrl));
          await writeFile(tmpPath, buf);
        } else {
          const resp = await fetch(imgUrl);
          const buf = Buffer.from(await resp.arrayBuffer());
          await writeFile(tmpPath, buf);
        }
        localImages.push(tmpPath);
      }

      // ── Concat list file (each image shown for `duration` seconds) ─
      const listFile = path.join(tmpdir(), `list-${randomUUID()}.txt`);
      tmpFiles.push(listFile);
      const listContent = localImages.map(p => `file '${p}'\nduration ${duration}`).join('\n');
      // repeat last image (required by concat demuxer to finish last frame)
      await writeFile(listFile, listContent + `\nfile '${localImages[localImages.length - 1]}'\nduration 0.04`);

      const outFilename = `video-${Date.now()}.mp4`;
      const outPath = path.join(uploadsDir, outFilename);

      // ── Cinematic video filter chain ───────────────────────────
      // 1. Scale with Lanczos (sharpest quality)
      // 2. Pad to exact target with black letterbox
      // 3. Ken Burns zoom-pan effect (each image zooms in slowly)
      // 4. Set fps to 25 smooth
      // 5. Enhance: brightness +3%, contrast +5%, saturation +15%
      // 6. Unsharp mask for crisp sharpness
      const sharpenStrength = quality === "cinema" ? "1.2" : "0.8";
      const videoFilter = [
        `scale=${W}:${H}:force_original_aspect_ratio=decrease:flags=lanczos`,
        `pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=black`,
        `setsar=1`,
        `zoompan=z='if(eq(on,1),1.0,if(lte(zoom+0.0020,1.6),zoom+0.0020,1.6))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${durationFrames}:s=${W}x${H}:fps=25`,
        `eq=contrast=1.05:brightness=0.03:saturation=1.15:gamma=1.02`,
        `unsharp=lx=5:ly=5:la=${sharpenStrength}:cx=5:cy=5:ca=0`,
        `format=yuv420p`,
      ].join(",");

      // ── Build ffmpeg command ────────────────────────────────────
      const ffmpegArgs: string[] = ["-y", "-f", "concat", "-safe", "0", "-i", listFile];

      // Add audio input if provided
      let audioFilePath: string | null = null;
      if (audioUrl) {
        audioFilePath = audioUrl.startsWith('/uploads/')
          ? path.join(process.cwd(), audioUrl)
          : audioUrl;
        ffmpegArgs.push("-i", audioFilePath);
      }

      ffmpegArgs.push(
        "-vf", videoFilter,
        "-c:v", "libx264",
        "-preset", q.preset,
        "-crf", String(q.crf),
        "-b:v", q.vBitrate,
        "-maxrate", q.maxrate,
        "-bufsize", q.maxrate,
        "-pix_fmt", "yuv420p",
        "-r", "25",
        ...(audioFilePath ? [
          "-c:a", "aac",
          "-b:a", "192k",
          "-af", "loudnorm=I=-16:TP=-1.5:LRA=11,aresample=44100",
          "-shortest",
        ] : []),
        "-movflags", "+faststart",
        outPath,
      );

      await new Promise<void>((resolve, reject) => {
        const proc = spawn("ffmpeg", ffmpegArgs);
        let stderr = "";
        proc.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
        proc.on("close", (code) => code === 0 ? resolve() : reject(new Error("ffmpeg: " + stderr.slice(-600))));
        proc.on("error", reject);
      });

      res.json({ url: `/uploads/${outFilename}`, quality, resolution: `${W}x${H}` });
    } catch (error: any) {
      console.error("images-to-video error:", error.message);
      res.status(500).json({ message: "فشل تحويل الصور لفيديو: " + error.message });
    } finally {
      for (const f of tmpFiles) await unlink(f).catch(() => {});
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

  // ================================================================
  // NOTIFICATIONS ROUTES
  // ================================================================
  app.get("/api/notifications", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    try {
      const result = await db.execute(
        sql`SELECT * FROM notifications WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 50`
      );
      res.json(result.rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/notifications/unread-count", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    try {
      const result = await db.execute(
        sql`SELECT COUNT(*) as count FROM notifications WHERE user_id = ${userId} AND is_read = false`
      );
      res.json({ count: Number(result.rows[0]?.count || 0) });
    } catch { res.json({ count: 0 }); }
  });

  app.put("/api/notifications/read-all", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    try {
      await db.execute(sql`UPDATE notifications SET is_read = true WHERE user_id = ${userId}`);
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.put("/api/notifications/:id/read", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    try {
      await db.execute(sql`UPDATE notifications SET is_read = true WHERE id = ${req.params.id} AND user_id = ${userId}`);
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.delete("/api/notifications/:id", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    try {
      await db.execute(sql`DELETE FROM notifications WHERE id = ${req.params.id} AND user_id = ${userId}`);
      res.status(204).send();
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ================================================================
  // DIRECT MESSAGES ROUTES
  // ================================================================
  app.get("/api/messages", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    try {
      const result = await db.execute(
        sql`SELECT DISTINCT ON (sub.partner_id)
              sub.partner_id,
              sub.message,
              sub.created_at,
              sub.is_read,
              sub.from_user_id,
              sub.ad_id,
              u.first_name as partner_first_name,
              u.last_name  as partner_last_name,
              u.profile_image_url as partner_avatar
            FROM (
              SELECT
                CASE WHEN from_user_id = ${userId} THEN to_user_id ELSE from_user_id END as partner_id,
                message, created_at, is_read, from_user_id, ad_id
              FROM direct_messages
              WHERE from_user_id = ${userId} OR to_user_id = ${userId}
              ORDER BY created_at DESC
            ) sub
            LEFT JOIN users u ON u.id = sub.partner_id
            ORDER BY sub.partner_id, sub.created_at DESC`
      );
      res.json(result.rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/messages/:partnerId", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { partnerId } = req.params;
    try {
      // Get partner info
      const partnerInfo = await db.execute(
        sql`SELECT id, first_name, last_name, profile_image_url FROM users WHERE id = ${partnerId} LIMIT 1`
      );
      const result = await db.execute(
        sql`SELECT dm.*,
              sender.first_name as sender_first_name,
              sender.last_name  as sender_last_name,
              sender.profile_image_url as sender_avatar
            FROM direct_messages dm
            LEFT JOIN users sender ON sender.id = dm.from_user_id
            WHERE (dm.from_user_id = ${userId} AND dm.to_user_id = ${partnerId})
               OR (dm.from_user_id = ${partnerId} AND dm.to_user_id = ${userId})
            ORDER BY dm.created_at ASC LIMIT 200`
      );
      // Mark as read
      await db.execute(
        sql`UPDATE direct_messages SET is_read = true
            WHERE to_user_id = ${userId} AND from_user_id = ${partnerId} AND is_read = false`
      );
      res.json({ messages: result.rows, partner: partnerInfo.rows[0] || null });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/messages", isAuthenticated, async (req: any, res) => {
    const fromUserId = req.user.claims.sub;
    const { toUserId, message, adId, isVoice, voiceUrl, replyToId, replyToText } = req.body;
    if (!toUserId || !message) return res.status(400).json({ message: "Missing required fields" });
    // Ensure reply_to columns exist
    try {
      await db.execute(sql`ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS reply_to_id integer`);
      await db.execute(sql`ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS reply_to_text text`);
    } catch {}
    // Anti-spam: max 10 messages per minute per user
    try {
      const spamCheck = await db.execute(
        sql`SELECT COUNT(*) as count FROM direct_messages WHERE from_user_id = ${fromUserId} AND created_at > now() - interval '1 minute'`
      );
      if (Number(spamCheck.rows[0]?.count) > 10) {
        return res.status(429).json({ message: "الرسائل كثيرة جداً، انتظر قليلاً" });
      }
      const result = await db.execute(
        sql`INSERT INTO direct_messages (from_user_id, to_user_id, ad_id, message, is_voice, voice_url, reply_to_id, reply_to_text)
            VALUES (${fromUserId}, ${toUserId}, ${adId ?? null}, ${message}, ${isVoice ?? false}, ${voiceUrl ?? null},
                    ${replyToId ?? null}, ${replyToText ?? null})
            RETURNING *`
      );
      // Send notification to recipient
      const senderName = req.user.claims?.first_name || "مستخدم";
      const msgTitle = isVoice ? "🎤 رسالة صوتية جديدة" : "رسالة جديدة 📩";
      const msgBody = isVoice ? `${senderName}: أرسل رسالة صوتية` : `${senderName}: ${String(message).slice(0, 60)}`;
      await createNotification(toUserId, "comment", msgTitle, msgBody, `/messages`,
        isVoice ? voiceUrl : undefined, fromUserId);
      res.status(201).json(result.rows[0]);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/messages/unread-count", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    try {
      const result = await db.execute(
        sql`SELECT COUNT(*) as count FROM direct_messages WHERE to_user_id = ${userId} AND is_read = false`
      );
      res.json({ count: Number(result.rows[0]?.count || 0) });
    } catch { res.json({ count: 0 }); }
  });

  // ================================================================
  // USER PROFILE ROUTES
  // ================================================================
  app.get("/api/profile/:userId", async (req, res) => {
    const { userId } = req.params;
    try {
      const [userRow, adsRow, channelRow] = await Promise.all([
        db.execute(sql`SELECT id, first_name, last_name, profile_image_url, created_at FROM users WHERE id = ${userId}`),
        db.execute(sql`SELECT COUNT(*) as count, SUM(views_count) as views, SUM(likes_count) as likes FROM ads WHERE user_id = ${userId} AND status = 'active'`),
        db.execute(sql`SELECT * FROM channels WHERE user_id = ${userId} LIMIT 1`),
      ]);
      const user = userRow.rows[0];
      if (!user) return res.status(404).json({ message: "User not found" });
      const stats = adsRow.rows[0];
      const channel = channelRow.rows[0];
      res.json({ user, stats, channel });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/profile/:userId/ads", async (req, res) => {
    const { userId } = req.params;
    try {
      const result = await db.execute(
        sql`SELECT * FROM ads WHERE user_id = ${userId} AND status = 'active' ORDER BY created_at DESC LIMIT 20`
      );
      res.json(result.rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ================================================================
  // FRAUD DETECTION ROUTES
  // ================================================================
  app.get("/api/fraud/check-ad", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const title = String(req.query.title || "");
    const warnings: string[] = [];
    try {
      // Check ad creation rate (max 10 per day)
      const rateCheck = await db.execute(
        sql`SELECT COUNT(*) as count FROM ads WHERE user_id = ${userId} AND created_at > now() - interval '24 hours'`
      );
      if (Number(rateCheck.rows[0]?.count) >= 10) {
        warnings.push("تجاوزت الحد اليومي للنشر (10 إعلانات في 24 ساعة)");
      }
      // Check for duplicate title
      if (title.length > 3) {
        const dupCheck = await db.execute(
          sql`SELECT COUNT(*) as count FROM ads WHERE LOWER(title) = LOWER(${title}) AND user_id = ${userId}`
        );
        if (Number(dupCheck.rows[0]?.count) > 0) {
          warnings.push("لديك إعلان بنفس العنوان مسبقاً");
        }
      }
      res.json({ warnings, safe: warnings.length === 0 });
    } catch { res.json({ warnings: [], safe: true }); }
  });

  app.post("/api/fraud/report", isAuthenticated, async (req: any, res) => {
    const reporterId = req.user.claims.sub;
    const { targetType, targetId, reason } = req.body;
    try {
      await db.execute(
        sql`INSERT INTO reports (reporter_id, target_type, target_id, reason) VALUES (${reporterId}, ${targetType}, ${targetId}, ${reason})`
      );
      // Alert admin
      await createNotification(
        "54219806", "fraud_alert",
        "🚨 بلاغ احتيال جديد",
        `بلاغ على ${targetType} #${targetId}: ${String(reason).slice(0, 80)}`,
        `/admin`
      );
      res.status(201).json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ================================================================
  // FAVORITES
  // ================================================================
  app.get("/api/favorites", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    try {
      const result = await db.execute(
        sql`SELECT f.*, a.title, a.media_url, a.media_type, a.price_egp, a.target_region
            FROM favorites f JOIN ads a ON f.ad_id = a.id
            WHERE f.user_id = ${userId} ORDER BY f.created_at DESC`
      );
      res.json(result.rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/favorites/:adId/check", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const adId = parseInt(req.params.adId);
    try {
      const result = await db.execute(
        sql`SELECT id FROM favorites WHERE user_id = ${userId} AND ad_id = ${adId}`
      );
      res.json({ favorited: result.rows.length > 0 });
    } catch { res.json({ favorited: false }); }
  });

  app.post("/api/favorites/:adId", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const adId = parseInt(req.params.adId);
    try {
      const existing = await db.execute(
        sql`SELECT id FROM favorites WHERE user_id = ${userId} AND ad_id = ${adId}`
      );
      if (existing.rows.length > 0) {
        await db.execute(sql`DELETE FROM favorites WHERE user_id = ${userId} AND ad_id = ${adId}`);
        res.json({ favorited: false });
      } else {
        await db.execute(sql`INSERT INTO favorites (user_id, ad_id) VALUES (${userId}, ${adId})`);
        res.json({ favorited: true });
      }
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ================================================================
  // RATINGS
  // ================================================================
  app.get("/api/ratings/:targetType/:targetId", async (req, res) => {
    const { targetType, targetId } = req.params;
    try {
      const result = await db.execute(
        sql`SELECT * FROM ratings WHERE target_type = ${targetType} AND target_id = ${targetId} ORDER BY created_at DESC`
      );
      const avgResult = await db.execute(
        sql`SELECT AVG(rating) as avg, COUNT(*) as count FROM ratings WHERE target_type = ${targetType} AND target_id = ${targetId}`
      );
      res.json({ ratings: result.rows, avg: parseFloat(avgResult.rows[0]?.avg as string || '0'), count: parseInt(avgResult.rows[0]?.count as string || '0') });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/ratings", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const userName = `${req.user.claims.first_name || ''} ${req.user.claims.last_name || ''}`.trim() || 'مستخدم';
    const { targetType, targetId, rating, review } = req.body;
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ message: "تقييم غير صالح (1-5)" });
    try {
      await db.execute(
        sql`INSERT INTO ratings (user_id, user_name, target_type, target_id, rating, review)
            VALUES (${userId}, ${userName}, ${targetType}, ${String(targetId)}, ${rating}, ${review || null})
            ON CONFLICT (user_id, target_type, target_id) DO UPDATE SET rating = ${rating}, review = ${review || null}`
      );
      res.status(201).json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ================================================================
  // PRICE OFFERS
  // ================================================================
  app.get("/api/offers/ad/:adId", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const adId = parseInt(req.params.adId);
    try {
      const adCheck = await db.execute(sql`SELECT user_id FROM ads WHERE id = ${adId}`);
      if (!adCheck.rows.length) return res.status(404).json({ message: "الإعلان غير موجود" });
      const isOwner = (adCheck.rows[0] as any).user_id === userId;
      if (!isOwner) return res.status(403).json({ message: "غير مصرح" });
      const result = await db.execute(
        sql`SELECT * FROM offers WHERE ad_id = ${adId} ORDER BY created_at DESC`
      );
      res.json(result.rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/offers", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const userName = `${req.user.claims.first_name || ''} ${req.user.claims.last_name || ''}`.trim() || 'مشتري';
    const { adId, offerAmountEGP, message } = req.body;
    if (!adId || !offerAmountEGP) return res.status(400).json({ message: "بيانات ناقصة" });
    try {
      const adCheck = await db.execute(sql`SELECT user_id, title FROM ads WHERE id = ${adId}`);
      if (!adCheck.rows.length) return res.status(404).json({ message: "الإعلان غير موجود" });
      const ad = adCheck.rows[0] as any;
      if (ad.user_id === userId) return res.status(400).json({ message: "لا يمكنك إرسال عرض على إعلانك" });
      await db.execute(
        sql`INSERT INTO offers (from_user_id, from_user_name, ad_id, offer_amount_egp, message)
            VALUES (${userId}, ${userName}, ${adId}, ${offerAmountEGP}, ${message || null})`
      );
      await createNotification(
        ad.user_id, "system",
        "💰 عرض سعر جديد!",
        `${userName} يقدم عرض ${offerAmountEGP} ج.م على إعلانك "${ad.title}"`,
        `/ads/${adId}`
      );
      res.status(201).json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.patch("/api/offers/:id", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const offerId = parseInt(req.params.id);
    const { status } = req.body;
    if (!["accepted", "rejected"].includes(status)) return res.status(400).json({ message: "حالة غير صالحة" });
    try {
      const offer = await db.execute(
        sql`SELECT o.*, a.user_id as ad_owner, a.title FROM offers o JOIN ads a ON o.ad_id = a.id WHERE o.id = ${offerId}`
      );
      if (!offer.rows.length) return res.status(404).json({ message: "العرض غير موجود" });
      const row = offer.rows[0] as any;
      if (row.ad_owner !== userId) return res.status(403).json({ message: "غير مصرح" });
      await db.execute(sql`UPDATE offers SET status = ${status} WHERE id = ${offerId}`);
      await createNotification(
        row.from_user_id, "system",
        status === "accepted" ? "✅ تم قبول عرضك!" : "❌ تم رفض عرضك",
        `عرضك على "${row.title}" ${status === "accepted" ? "تم قبوله من البائع" : "تم رفضه"}`,
        `/ads/${row.ad_id}`
      );
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ================================================================
  // AD VIEW INCREMENT
  // ================================================================
  app.post("/api/ads/:id/view", async (req, res) => {
    const id = parseInt(req.params.id);
    try {
      await db.execute(sql`UPDATE ads SET views_count = COALESCE(views_count, 0) + 1 WHERE id = ${id}`);
      res.json({ ok: true });
    } catch { res.json({ ok: false }); }
  });

  // ================================================================
  // SIMILAR ADS
  // ================================================================
  app.get("/api/ads/:id/similar", async (req, res) => {
    const id = parseInt(req.params.id);
    try {
      const ad = await db.execute(sql`SELECT target_region, language FROM ads WHERE id = ${id}`);
      if (!ad.rows.length) return res.json([]);
      const { target_region, language } = ad.rows[0] as any;
      const similar = await db.execute(
        sql`SELECT * FROM ads WHERE id != ${id} AND status = 'active'
            AND (target_region = ${target_region} OR language = ${language})
            ORDER BY created_at DESC LIMIT 4`
      );
      res.json(similar.rows);
    } catch { res.json([]); }
  });

  // ================================================================
  // AD RENEW
  // ================================================================
  app.post("/api/ads/:id/renew", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const id = parseInt(req.params.id);
    try {
      const ad = await db.execute(sql`SELECT user_id FROM ads WHERE id = ${id}`);
      if (!ad.rows.length) return res.status(404).json({ message: "الإعلان غير موجود" });
      if ((ad.rows[0] as any).user_id !== userId && !isAdminUser(req)) return res.status(403).json({ message: "غير مصرح" });
      await db.execute(
        sql`UPDATE ads SET expires_at = NOW() + INTERVAL '30 days', status = 'active' WHERE id = ${id}`
      );
      res.json({ ok: true, message: "تم تجديد الإعلان لمدة 30 يوماً" });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  return httpServer;
}
