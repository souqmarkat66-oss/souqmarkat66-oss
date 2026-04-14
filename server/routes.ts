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
import { db, pool } from "./db";
import { sql } from "drizzle-orm";
import express from "express";
import * as webpushModule from "web-push";
const webpush: typeof webpushModule = (webpushModule as any).default || webpushModule;

// Admin user IDs — hardcoded superadmins (always admin, cannot be removed)
const ADMIN_USER_ID  = "54219806";
const ADMIN_EMAIL    = "souqmarkat66@gmail.com";
const ADMIN_USER_ID2 = "54165148";
const ADMIN_EMAIL2   = "ahmedesmat.5151@gmail.com";

// Extra admin IDs stored in platform_settings (dynamic, managed via admin panel)
let _extraAdminIds: Set<string> = new Set();
let _extraAdminLoaded = false;

async function loadExtraAdminIds(): Promise<void> {
  try {
    const row = await db.execute(sql`SELECT value FROM platform_settings WHERE key = 'extra_admin_ids' LIMIT 1`);
    const val = (row.rows[0] as any)?.value || "";
    _extraAdminIds = new Set(val.split(",").map((s: string) => s.trim()).filter(Boolean));
    _extraAdminLoaded = true;
  } catch { _extraAdminIds = new Set(); _extraAdminLoaded = true; }
}

async function saveExtraAdminIds(): Promise<void> {
  const val = Array.from(_extraAdminIds).join(",");
  await db.execute(sql`INSERT INTO platform_settings (key, value) VALUES ('extra_admin_ids', ${val})
    ON CONFLICT (key) DO UPDATE SET value = ${val}`);
}

function isAdminUser(req: any): boolean {
  const sub   = req.user?.claims?.sub;
  const email = (req.user?.claims?.email || "").toLowerCase();
  return sub === ADMIN_USER_ID  || email === ADMIN_EMAIL.toLowerCase() ||
         sub === ADMIN_USER_ID2 || email === ADMIN_EMAIL2.toLowerCase() ||
         (!!sub && _extraAdminIds.has(sub));
}

function isSuperAdmin(req: any): boolean {
  const sub   = req.user?.claims?.sub;
  const email = (req.user?.claims?.email || "").toLowerCase();
  return sub === ADMIN_USER_ID  || email === ADMIN_EMAIL.toLowerCase() ||
         sub === ADMIN_USER_ID2 || email === ADMIN_EMAIL2.toLowerCase();
}

async function requireAdmin(req: any, res: any, next: any) {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  if (!_extraAdminLoaded) await loadExtraAdminIds();
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
    // Use canonical users.balance_egp wallet balance (separate from revenue/withdrawal balance)
    const balance = await storage.getWalletBalanceEGP(userId);
    if (balance < pricePerCredit) {
      return res.status(402).json({
        message: "insufficient_credits",
        requiresWalletTopup: true,
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

// Dedicated middleware for Talking Photo — charges fixed price (default 100 EGP) upfront
async function checkTalkingPhotoCredits(req: any, res: any, next: any) {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  if (isAdminUser(req)) return next(); // admins always free
  const userId = req.user.claims.sub;
  const price = parseFloat(await storage.getSetting('ai_price_talking_photo') || '100');
  const balance = await storage.getWalletBalanceEGP(userId);
  if (balance < price) {
    return res.status(402).json({
      message: "insufficient_credits",
      requiresWalletTopup: true,
      pricePerCredit: price,
      balance,
      service: "talking_photo",
      serviceLabel: "الإعلان المتكلم",
    });
  }
  req.talkingPhotoChargeEGP = price;
  next();
}

// Atomically deduct AI charge from users.balance_egp and log to revenue_transactions
async function deductAiCharge(userId: string, amountEGP: number, description: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Lock user row and verify sufficient balance before deducting
    const userR = await client.query(`SELECT balance_egp FROM users WHERE id = $1 FOR UPDATE`, [userId]);
    const balance = parseFloat(userR.rows[0]?.balance_egp || "0");
    if (balance < amountEGP) {
      await client.query("ROLLBACK");
      throw new Error("رصيد غير كافٍ لإتمام عملية الذكاء الاصطناعي");
    }
    // Conditional deduct to prevent overdraft under concurrency
    const deductR = await client.query(
      `UPDATE users SET balance_egp = COALESCE(balance_egp, 0) - $1
       WHERE id = $2 AND COALESCE(balance_egp, 0) >= $1
       RETURNING balance_egp`,
      [amountEGP, userId]
    );
    if (deductR.rowCount === 0) {
      await client.query("ROLLBACK");
      throw new Error("رصيد غير كافٍ");
    }
    // Log to wallet_transactions ledger for auditability
    await client.query(
      `INSERT INTO wallet_transactions (user_id, type, amount_egp, description)
       VALUES ($1, 'ai_debit', $2, $3)`,
      [userId, amountEGP, description]
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  await setupAuth(app);
  registerCustomAuthRoutes(app);
  registerImageRoutes(app);

  // ── Redirect www.ads-as.com → ads-as.com (permanent 301) ──
  app.use((req, res, next) => {
    const host = req.headers.host || "";
    if (host.startsWith("www.")) {
      const canonical = host.replace(/^www\./, "");
      const proto = req.headers["x-forwarded-proto"] || "https";
      return res.redirect(301, `${proto}://${canonical}${req.url}`);
    }
    next();
  });


  // ── Initialize webpush VAPID keys from DB ──
  try {
    const pubRow = await db.execute(sql`SELECT value FROM platform_settings WHERE key = 'vapid_public_key' LIMIT 1`);
    const privRow = await db.execute(sql`SELECT value FROM platform_settings WHERE key = 'vapid_private_key' LIMIT 1`);
    if (pubRow.rows.length > 0 && privRow.rows.length > 0) {
      webpush.setVapidDetails(
        'mailto:souqmarkat66@gmail.com',
        (pubRow.rows[0] as any).value,
        (privRow.rows[0] as any).value
      );
    }
  } catch {}

  // ── DB Migrations (safe — ADD COLUMN IF NOT EXISTS) ──
  try {
    await db.execute(sql`ALTER TABLE ads ADD COLUMN IF NOT EXISTS is_admin_promo boolean DEFAULT false`);
    await db.execute(sql`ALTER TABLE ads ADD COLUMN IF NOT EXISTS coupon_code text`);
    await db.execute(sql`ALTER TABLE ads ADD COLUMN IF NOT EXISTS coupon_discount_type text`);
    await db.execute(sql`ALTER TABLE ads ADD COLUMN IF NOT EXISTS coupon_discount_value real`);
    await db.execute(sql`ALTER TABLE reels ADD COLUMN IF NOT EXISTS audio_url text`);
    // User social / profile columns
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS bio text`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS governorate text`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code text`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS interests text`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS birthday date`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS job_title text`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS company text`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS city text`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS relationship_status text`);
  } catch { /* columns may already exist */ }

  // ── Auto-cleanup stale live streams (older than 12 hours) ──
  const cleanupStaleStreams = async () => {
    try {
      const result = await db.execute(sql`
        UPDATE live_streams
        SET status = 'ended', ended_at = NOW()
        WHERE status = 'live'
          AND started_at < NOW() - INTERVAL '12 hours'
      `);
      if ((result.rowCount ?? 0) > 0) {
        console.log(`[cleanup] Closed ${result.rowCount} stale live streams`);
      }
    } catch (e) {
      console.error("[cleanup] stale streams error:", e);
    }
  };
  cleanupStaleStreams();
  setInterval(cleanupStaleStreams, 60 * 60 * 1000);

  // ── Coupons table migration ──
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS coupons (
        id serial PRIMARY KEY,
        user_id varchar REFERENCES users(id) NOT NULL,
        business_name text NOT NULL DEFAULT '',
        title text NOT NULL DEFAULT '',
        code text NOT NULL,
        discount_type text DEFAULT 'percentage',
        discount_value real,
        image_url text,
        description text,
        terms_ar text,
        is_active boolean DEFAULT true,
        expires_at timestamp,
        usage_limit integer,
        used_count integer DEFAULT 0,
        amount_paid_egp real DEFAULT 0,
        created_at timestamp DEFAULT NOW()
      )
    `);
    await db.execute(sql`INSERT INTO platform_settings (key, value) VALUES ('coupon_price_egp', '15') ON CONFLICT (key) DO NOTHING`);
    await db.execute(sql`INSERT INTO platform_settings (key, value) VALUES ('platform_name', 'شبكة سوق للإعلانات') ON CONFLICT (key) DO NOTHING`);
    await db.execute(sql`INSERT INTO platform_settings (key, value) VALUES ('platform_tagline', 'أفضل منصة إعلانية في مصر والعالم العربي') ON CONFLICT (key) DO NOTHING`);
    await db.execute(sql`INSERT INTO platform_settings (key, value) VALUES ('app_play_store', 'https://play.google.com/store/apps/details?id=com.apmo.souqmarket') ON CONFLICT (key) DO NOTHING`);
    await db.execute(sql`INSERT INTO platform_settings (key, value) VALUES ('app_app_store', 'https://apps.apple.com/eg/app/as-souqmarket/id6740153334') ON CONFLICT (key) DO NOTHING`);
    await db.execute(sql`INSERT INTO platform_settings (key, value) VALUES ('app_huawei', 'https://app.as-souqmarkat.com/?from-splash=false') ON CONFLICT (key) DO NOTHING`);
    await db.execute(sql`INSERT INTO platform_settings (key, value) VALUES ('contact_vodafone_cash', '01098553911') ON CONFLICT (key) DO NOTHING`);
    await db.execute(sql`INSERT INTO platform_settings (key, value) VALUES ('contact_instapay', '01285558567') ON CONFLICT (key) DO NOTHING`);
    await db.execute(sql`INSERT INTO platform_settings (key, value) VALUES ('contact_whatsapp', '') ON CONFLICT (key) DO NOTHING`);
    await db.execute(sql`INSERT INTO platform_settings (key, value) VALUES ('feature_ads', '1') ON CONFLICT (key) DO NOTHING`);
    await db.execute(sql`INSERT INTO platform_settings (key, value) VALUES ('feature_reels', '1') ON CONFLICT (key) DO NOTHING`);
    await db.execute(sql`INSERT INTO platform_settings (key, value) VALUES ('feature_channels', '1') ON CONFLICT (key) DO NOTHING`);
    await db.execute(sql`INSERT INTO platform_settings (key, value) VALUES ('feature_livestream', '1') ON CONFLICT (key) DO NOTHING`);
    await db.execute(sql`INSERT INTO platform_settings (key, value) VALUES ('feature_messages', '1') ON CONFLICT (key) DO NOTHING`);
    await db.execute(sql`INSERT INTO platform_settings (key, value) VALUES ('feature_campaigns', '1') ON CONFLICT (key) DO NOTHING`);
    await db.execute(sql`INSERT INTO platform_settings (key, value) VALUES ('feature_ai', '1') ON CONFLICT (key) DO NOTHING`);
    await db.execute(sql`INSERT INTO platform_settings (key, value) VALUES ('feature_registration', '1') ON CONFLICT (key) DO NOTHING`);
    await db.execute(sql`INSERT INTO platform_settings (key, value) VALUES ('feature_boost', '1') ON CONFLICT (key) DO NOTHING`);
    await db.execute(sql`INSERT INTO platform_settings (key, value) VALUES ('promo_banner_enabled', '1') ON CONFLICT (key) DO NOTHING`);
    await db.execute(sql`INSERT INTO platform_settings (key, value) VALUES ('promo_banner_text', '🎉 قسّط على 18 شهر بدون فوائد | حمّل تطبيق سوق ماركات الآن | عروض حصرية لفترة محدودة | ads-as.com') ON CONFLICT (key) DO NOTHING`);
    await db.execute(sql`INSERT INTO platform_settings (key, value) VALUES ('promo_banner_url', 'https://play.google.com/store/apps/details?id=com.apmo.souqmarket') ON CONFLICT (key) DO NOTHING`);
  } catch { /* table may already exist */ }

  // ── Seed promo ads (run once if none exist and admin user exists) ──
  try {
    const existingPromo = await db.execute(sql`SELECT COUNT(*) as cnt FROM ads WHERE is_admin_promo = true`);
    const promoCount = Number((existingPromo.rows[0] as any).cnt);
    const adminUser = await db.execute(sql`SELECT id FROM users WHERE id = '54219806' LIMIT 1`);
    if (promoCount === 0 && adminUser.rows.length > 0) {
      const adminId = '54219806';
      const promoAdsData = [
        { title: 'iPhone 15 Pro Max — 256GB أزرق تيتانيوم', description: 'آيفون 15 برو ماكس جديد متبرشم بضمان الوكيل سنة كاملة — الكاميرا الأفضل في السوق', mediaUrl: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=600', price: 42000 },
        { title: 'لابتوب Dell XPS 15 — Core i7 الجيل 13', description: 'لابتوب Dell XPS 15 بمعالج i7 وشاشة 4K OLED — مثالي للمصممين والمبرمجين، بحالة ممتازة', mediaUrl: 'https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=600', price: 28500 },
        { title: 'شقة للإيجار — مدينة نصر — 3 غرف', description: 'شقة مفروشة بالكامل في مدينة نصر بالقرب من المترو — 3 غرف وصالة وحمامين', mediaUrl: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600', price: 7500 },
        { title: 'سيارة هيونداي إيلنترا 2022 — فل أوبشن', description: 'هيونداي إيلنترا موديل 2022 فل أوبشن — مشيت 45 ألف كيلو — نظيفة جداً بدون حوادث', mediaUrl: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=600', price: 385000 },
        { title: 'تليفزيون Samsung QLED 55 بوصة — 4K', description: 'شاشة Samsung QLED 55 بوصة 4K Smart TV — جديدة متبرشمة بضمان سامسونج مصر سنتين', mediaUrl: 'https://images.unsplash.com/photo-1593784991095-a205069470b6?w=600', price: 18900 },
        { title: 'مكيف كاريير 1.5 حصان بارد وساخن', description: 'مكيف كاريير إنفرتر 1.5 حصان بارد وساخن — موفر للكهرباء — يشمل التركيب والضمان', mediaUrl: 'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=600', price: 11500 },
        { title: 'موتوسيكل هوندا CB300R 2023 — جديد', description: 'موتوسيكل هوندا CB300R موديل 2023 — لون أسود مطفي — جديد لم يُستخدم من الوكيل', mediaUrl: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=600', price: 95000 },
        { title: 'كاميرا Sony Alpha A7 IV — Full Frame', description: 'كاميرا Sony Alpha A7 IV Full Frame مع عدسة 28-70mm — مثالية للمصورين المحترفين', mediaUrl: 'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=600', price: 54000 },
        { title: 'شقة للبيع — الإسكندرية — سيدي بشر', description: 'شقة 120م في سيدي بشر — الطابق الثالث — إطلالة بحرية جزئية — تشطيب سوبر لوكس', mediaUrl: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=600', price: 1850000 },
        { title: 'iPhone 14 — 128GB — مستعمل بحالة ممتازة', description: 'آيفون 14 أسود 128 جيجا — مستعمل 6 شهور فقط بحالة ممتازة مع جميع ملحقاته الأصلية', mediaUrl: 'https://images.unsplash.com/photo-1663499482523-1c0c1bae4ce1?w=600', price: 22000 },
        { title: 'أرض للبيع — 6 أكتوبر — 500 متر', description: 'أرض سكنية 500 متر في حي الوصلة بـ 6 أكتوبر — مرافق كاملة — موقع مميز', mediaUrl: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=600', price: 2400000 },
        { title: 'جهاز PlayStation 5 + دراعين + 3 ألعاب', description: 'بلايستيشن 5 الإصدار الجديد مع دراعين أصليين وثلاث ألعاب — كل شيء جديد متبرشم', mediaUrl: 'https://images.unsplash.com/photo-1607853202273-797f1c22a38e?w=600', price: 19500 },
      ];
      for (const ad of promoAdsData) {
        await db.execute(sql`
          INSERT INTO ads (title, description, media_url, media_type, user_id, price_egp, is_admin_promo, status, language)
          VALUES (${ad.title}, ${ad.description}, ${ad.mediaUrl}, 'image', ${adminId}, ${ad.price}, true, 'active', 'ar')
        `);
      }
    }
  } catch { /* promo seed failed silently */ }

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

  const streamRooms: Map<string, {
    broadcasterId: string | null;
    cohostIds: string[];
    cohostNames: Map<string, string>;
    viewers: Set<string>;
    peakViewers: number;
    startedAt: number;
    totalLikes: number;
    totalComments: number;
    bannedSockets: Set<string>;
    giftGoal: number | null;
    totalGiftCoins: number;
    socketToUser: Map<string, { userId: string; userName: string }>;
    autoAccept: boolean;
    raisedHands?: Map<string, { userId: string; userName: string; raisedAt: number }>;
  }> = new Map();

  // Arabic & English bad words basic filter
  const BAD_WORDS = ["كس","طيز","زب","شرموط","عاهرة","fuck","shit","bitch","ass","dick","pussy","bastard","motherfucker","asshole"];
  function filterBadWords(text: string): string {
    let filtered = text;
    BAD_WORDS.forEach(word => {
      const regex = new RegExp(word, "gi");
      filtered = filtered.replace(regex, "*".repeat(word.length));
    });
    return filtered;
  }

  function getOrCreateRoom(streamId: string) {
    if (!streamRooms.has(streamId)) {
      streamRooms.set(streamId, {
        broadcasterId: null, cohostIds: [], cohostNames: new Map(), viewers: new Set(),
        peakViewers: 0, startedAt: Date.now(), totalLikes: 0, totalComments: 0,
        bannedSockets: new Set(), giftGoal: null, totalGiftCoins: 0,
        socketToUser: new Map(), autoAccept: false,
      });
    }
    return streamRooms.get(streamId)!;
  }

  io.on("connection", (socket) => {
    socket.on("join-stream", (streamId: string) => {
      socket.join(`stream:${streamId}`);
      const room = getOrCreateRoom(streamId);
      room.viewers.add(socket.id);
      const count = room.viewers.size;
      if (count > room.peakViewers) room.peakViewers = count;
      io.to(`stream:${streamId}`).emit("viewer-count", count);
      storage.updateLiveStream(Number(streamId), { viewerCount: count } as any).catch(() => {});
      // If broadcaster is already live, tell this viewer so they know to send "watcher"
      if (room.broadcasterId) {
        socket.emit("broadcaster");
      }
      // Inform new viewer of ALL active co-hosts
      for (const cohostId of room.cohostIds) {
        socket.emit("cohost-active", cohostId, room.cohostNames.get(cohostId) || "ضيف");
      }
      // Inform new viewer of current auto-accept state
      if (room.autoAccept) {
        socket.emit("auto-accept-changed", true);
      }
    });

    socket.on("leave-stream", (streamId: string) => {
      socket.leave(`stream:${streamId}`);
      streamRooms.get(streamId)?.viewers.delete(socket.id);
      const count = streamRooms.get(streamId)?.viewers.size || 0;
      io.to(`stream:${streamId}`).emit("viewer-count", count);
    });

    socket.on("chat-message", (data: { streamId: string; userId: string; userName: string; message: string; isVoice?: boolean; voiceUrl?: string; isOwner?: boolean }) => {
      const room = streamRooms.get(data.streamId);
      if (room) room.totalComments++;
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
      const room = streamRooms.get(streamId);
      if (room) room.totalLikes++;
      io.to(`stream:${streamId}`).emit("stream-like");
    });

    // ── WebRTC Signaling (main broadcaster → viewers) ──
    socket.on("broadcaster", (streamId: string) => {
      socket.join(`stream:${streamId}`);
      const room = getOrCreateRoom(streamId);
      room.broadcasterId = socket.id;
      room.startedAt = Date.now();
      socket.to(`stream:${streamId}`).emit("broadcaster");
    });

    socket.on("watcher", (streamId: string) => {
      socket.join(`stream:${streamId}`);
      const room = getOrCreateRoom(streamId);
      room.viewers.add(socket.id);
      const broadcasterId = room.broadcasterId;
      if (broadcasterId) socket.to(broadcasterId).emit("watcher", socket.id);
    });

    socket.on("offer", (id: string, message: any) => socket.to(id).emit("offer", socket.id, message));
    socket.on("answer", (id: string, message: any) => socket.to(id).emit("answer", socket.id, message));
    socket.on("candidate", (id: string, message: any) => socket.to(id).emit("candidate", socket.id, message));

    // ── Co-host Signaling ──
    socket.on("request-cohost", (data: { streamId: string; userId: string; userName: string }) => {
      const room = streamRooms.get(data.streamId);
      if (!room?.broadcasterId) return;
      if (room.cohostIds.length >= 3) {
        socket.emit("cohost-rejected", { reason: "max_cohosts" });
        return;
      }
      if (room.autoAccept) {
        // Auto-accept: skip the broadcaster prompt and accept immediately
        if (!room.cohostIds.includes(socket.id)) {
          room.cohostIds.push(socket.id);
          if (data.userName) room.cohostNames.set(socket.id, data.userName);
        }
        socket.emit("cohost-accepted", { broadcasterId: room.broadcasterId });
        // Also notify broadcaster that someone joined automatically
        socket.to(room.broadcasterId).emit("cohost-auto-joined", { socketId: socket.id, userName: data.userName, withCamera: data.withCamera });
      } else {
        socket.to(room.broadcasterId).emit("cohost-request", { socketId: socket.id, userId: data.userId, userName: data.userName, withCamera: data.withCamera });
      }
    });

    // Broadcaster toggles auto-accept mode
    socket.on("set-auto-accept", (data: { streamId: string; enabled: boolean }) => {
      const room = streamRooms.get(data.streamId);
      if (!room || room.broadcasterId !== socket.id) return;
      room.autoAccept = data.enabled;
      // Notify all viewers about the new mode
      io.to(`stream:${data.streamId}`).emit("auto-accept-changed", data.enabled);
    });

    socket.on("accept-cohost", (data: { streamId: string; guestSocketId: string; guestName?: string }) => {
      const room = streamRooms.get(data.streamId);
      if (room && !room.cohostIds.includes(data.guestSocketId)) {
        room.cohostIds.push(data.guestSocketId);
        if (data.guestName) room.cohostNames.set(data.guestSocketId, data.guestName);
      }
      io.to(data.guestSocketId).emit("cohost-accepted", { broadcasterId: socket.id });
    });

    socket.on("reject-cohost", (data: { guestSocketId: string }) => {
      io.to(data.guestSocketId).emit("cohost-rejected");
    });

    socket.on("cohost-broadcaster", (data: string | { streamId: string; name?: string }) => {
      const streamId = typeof data === "string" ? data : data.streamId;
      const name = typeof data === "object" ? data.name : undefined;
      const room = streamRooms.get(streamId);
      if (room && !room.cohostIds.includes(socket.id)) {
        room.cohostIds.push(socket.id);
        if (name) room.cohostNames.set(socket.id, name);
      }
      // Notify all viewers that a new co-host is live
      socket.to(`stream:${streamId}`).emit("cohost-active", socket.id, name || "ضيف");
    });

    socket.on("cohost-watcher", (data: { cohostId: string }) => {
      socket.to(data.cohostId).emit("cohost-watcher", socket.id);
    });

    // Co-host WebRTC signaling (separate from main broadcaster signaling)
    socket.on("cohost-offer", (targetId: string, message: any) => socket.to(targetId).emit("cohost-offer", socket.id, message));
    socket.on("cohost-answer", (targetId: string, message: any) => socket.to(targetId).emit("cohost-answer", socket.id, message));
    socket.on("cohost-candidate", (targetId: string, message: any) => socket.to(targetId).emit("cohost-candidate", socket.id, message));

    socket.on("cohost-leave", (streamId: string) => {
      const room = streamRooms.get(streamId);
      if (room) {
        room.cohostIds = room.cohostIds.filter(id => id !== socket.id);
        room.cohostNames.delete(socket.id);
      }
      io.to(`stream:${streamId}`).emit("cohost-left", socket.id);
    });

    // Broadcaster force-mutes/unmutes a specific guest
    socket.on("force-mute-cohost", (data: { streamId: string; guestSocketId: string; muted: boolean }) => {
      const room = streamRooms.get(data.streamId);
      if (!room || room.broadcasterId !== socket.id) return;
      io.to(data.guestSocketId).emit("force-muted", data.muted);
    });

    // ── Hand Raise System ────────────────────────────────────────────
    socket.on("raise-hand", (data: { streamId: string; userId: string; userName: string }) => {
      const room = streamRooms.get(data.streamId);
      if (!room) return;
      if (!room.raisedHands) room.raisedHands = new Map();
      room.raisedHands.set(socket.id, { userId: data.userId, userName: data.userName, raisedAt: Date.now() });
      // Notify broadcaster
      if (room.broadcasterId) {
        io.to(room.broadcasterId).emit("hand-raised", { socketId: socket.id, userId: data.userId, userName: data.userName });
      }
      socket.emit("hand-raise-confirmed");
    });

    socket.on("lower-hand", (data: { streamId: string }) => {
      const room = streamRooms.get(data.streamId);
      if (room?.raisedHands) room.raisedHands.delete(socket.id);
      if (room?.broadcasterId) io.to(room.broadcasterId).emit("hand-lowered", { socketId: socket.id });
    });

    socket.on("invite-raised-hand", (data: { streamId: string; guestSocketId: string }) => {
      // Broadcaster invites a raised-hand viewer as co-host
      const room = streamRooms.get(data.streamId);
      if (!room || room.broadcasterId !== socket.id) return;
      io.to(data.guestSocketId).emit("hand-invite", { broadcasterId: socket.id });
      if (room.raisedHands) room.raisedHands.delete(data.guestSocketId);
      if (room.broadcasterId) io.to(room.broadcasterId).emit("hand-lowered", { socketId: data.guestSocketId });
    });

    socket.on("dismiss-hand", (data: { streamId: string; guestSocketId: string }) => {
      const room = streamRooms.get(data.streamId);
      if (!room || room.broadcasterId !== socket.id) return;
      if (room.raisedHands) room.raisedHands.delete(data.guestSocketId);
      io.to(data.guestSocketId).emit("hand-dismissed");
    });

    // ── TikTok-style Live Features ──────────────────────────────────
    socket.on("send-gift", async (data: { streamId: string; giftType: string; giftEmoji: string; giftName: string; giftCoins: number; userName: string; userId: string; broadcasterUserId?: string }) => {
      // Deduct coins from sender & credit broadcaster in DB
      try {
        if (data.userId && data.giftCoins > 0) {
          // Deduct from sender
          await pool.query(
            `INSERT INTO coin_wallets (user_id, balance, total_spent, total_earned)
             VALUES ($1, GREATEST(0, -$2::int), $2::int, 0)
             ON CONFLICT (user_id) DO UPDATE
             SET balance = GREATEST(0, coin_wallets.balance - $2::int),
                 total_spent = coin_wallets.total_spent + $2::int,
                 updated_at = NOW()`,
            [data.userId, data.giftCoins]
          );
          // Log sender transaction
          await pool.query(
            `INSERT INTO coin_transactions (user_id, type, coins, description, related_stream_id, related_user_id)
             VALUES ($1, 'gift_sent', $2, $3, $4, $5)`,
            [data.userId, -data.giftCoins, `هدية ${data.giftName} في البث`, data.streamId ? parseInt(data.streamId) : null, data.broadcasterUserId || null]
          );
          // Credit broadcaster (60% to broadcaster, platform keeps 40%)
          if (data.broadcasterUserId) {
            const broadcasterCoins = Math.floor(data.giftCoins * 0.6);
            await pool.query(
              `INSERT INTO coin_wallets (user_id, balance, total_spent, total_earned)
               VALUES ($1, $2::int, 0, $2::int)
               ON CONFLICT (user_id) DO UPDATE
               SET balance = coin_wallets.balance + $2::int,
                   total_earned = coin_wallets.total_earned + $2::int,
                   updated_at = NOW()`,
              [data.broadcasterUserId, broadcasterCoins]
            );
            // Log broadcaster transaction
            await pool.query(
              `INSERT INTO coin_transactions (user_id, type, coins, description, related_stream_id, related_user_id)
               VALUES ($1, 'gift_received', $2, $3, $4, $5)`,
              [data.broadcasterUserId, broadcasterCoins, `استلام هدية ${data.giftName} من ${data.userName}`, data.streamId ? parseInt(data.streamId) : null, data.userId]
            );
            // Also credit revenue_transactions in EGP (1 coin = 0.05 EGP)
            const egpAmount = parseFloat((broadcasterCoins * 0.05).toFixed(2));
            await pool.query(
              `INSERT INTO revenue_transactions (user_id, type, amount_egp, description, channel_id)
               SELECT $1, 'earning', $2, $3, id FROM channels WHERE user_id = $1 LIMIT 1`,
              [data.broadcasterUserId, egpAmount, `هدايا من بث مباشر - ${data.giftName}`]
            );
          }
        }
      } catch (err) {
        console.error("Gift coin transaction error:", err);
      }
      io.to(`stream:${data.streamId}`).emit("stream-gift", { id: Date.now() + Math.random(), ...data, timestamp: new Date().toISOString() });
    });

    socket.on("pin-comment", (data: { streamId: string; message: string; userName: string }) => {
      io.to(`stream:${data.streamId}`).emit("comment-pinned", { message: data.message, userName: data.userName });
    });

    socket.on("unpin-comment", (streamId: string) => {
      io.to(`stream:${streamId}`).emit("comment-unpinned");
    });

    socket.on("create-poll", (data: { streamId: string; question: string; options: string[] }) => {
      const poll = { id: Date.now(), question: data.question, options: data.options.map((o: string) => ({ text: o, votes: 0 })), totalVotes: 0 };
      io.to(`stream:${data.streamId}`).emit("poll-created", poll);
    });

    socket.on("end-poll", (streamId: string) => {
      io.to(`stream:${streamId}`).emit("poll-ended");
    });

    socket.on("vote-poll", (data: { streamId: string; pollId: number; optionIndex: number }) => {
      io.to(`stream:${data.streamId}`).emit("poll-updated", { pollId: data.pollId, optionIndex: data.optionIndex });
    });

    socket.on("send-follow-notification", (data: { streamId: string; userName: string }) => {
      socket.to(`stream:${data.streamId}`).emit("new-follower", { userName: data.userName });
    });

    socket.on("disconnect", () => {
      streamRooms.forEach((room, streamId) => {
        if (room.broadcasterId === socket.id) {
          room.broadcasterId = null;
          io.to(`stream:${streamId}`).emit("broadcaster-disconnected");
        }
        if (room.cohostIds.includes(socket.id)) {
          room.cohostIds = room.cohostIds.filter(id => id !== socket.id);
          room.cohostNames.delete(socket.id);
          io.to(`stream:${streamId}`).emit("cohost-left", socket.id);
        }
        room.viewers.delete(socket.id);
      });
    });
  });

  // ================================================================
  // COIN SYSTEM ROUTES
  // ================================================================

  // Get my coin wallet
  app.get("/api/coins/wallet", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const r = await pool.query(`SELECT * FROM coin_wallets WHERE user_id = $1`, [userId]);
    if (r.rows.length === 0) {
      // Create wallet with 0 coins
      const ins = await pool.query(
        `INSERT INTO coin_wallets (user_id, balance, total_spent, total_earned) VALUES ($1, 0, 0, 0) RETURNING *`,
        [userId]
      );
      return res.json(ins.rows[0]);
    }
    res.json(r.rows[0]);
  });

  // Get my coin transaction history
  app.get("/api/coins/transactions", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const r = await pool.query(
      `SELECT * FROM coin_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [userId]
    );
    res.json(r.rows);
  });

  // Get active coin packages
  app.get("/api/coins/packages", async (_req, res) => {
    const r = await pool.query(`SELECT * FROM coin_packages WHERE is_active = true ORDER BY sort_order, price_egp`);
    if (r.rows.length === 0) {
      // Seed default packages
      await pool.query(`
        INSERT INTO coin_packages (name, coins, price_egp, bonus_coins, sort_order) VALUES
        ('باقة صغيرة', 100, 10, 0, 1),
        ('باقة متوسطة', 250, 22, 20, 2),
        ('باقة كبيرة', 500, 40, 75, 3),
        ('باقة مميزة', 1000, 70, 200, 4),
        ('باقة الكنز', 3000, 180, 800, 5)
        ON CONFLICT DO NOTHING
      `);
      const r2 = await pool.query(`SELECT * FROM coin_packages WHERE is_active = true ORDER BY sort_order`);
      return res.json(r2.rows);
    }
    res.json(r.rows);
  });

  // Redeem a recharge code
  app.post("/api/coins/redeem", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { code } = req.body || {};
    if (!code) return res.status(400).json({ message: "الكود مطلوب" });

    const r = await pool.query(`SELECT * FROM coin_recharge_codes WHERE code = $1`, [code.toUpperCase().trim()]);
    if (r.rows.length === 0) return res.status(404).json({ message: "الكود غير صحيح" });
    const row = r.rows[0];
    if (row.used_by_user_id) return res.status(400).json({ message: "هذا الكود مستخدم بالفعل" });
    if (row.expires_at && new Date(row.expires_at) < new Date()) return res.status(400).json({ message: "الكود منتهي الصلاحية" });

    // Mark as used
    await pool.query(
      `UPDATE coin_recharge_codes SET used_by_user_id = $1, used_at = NOW() WHERE id = $2`,
      [userId, row.id]
    );
    // Add coins to wallet
    await pool.query(
      `INSERT INTO coin_wallets (user_id, balance, total_spent, total_earned)
       VALUES ($1, $2::int, 0, $2::int)
       ON CONFLICT (user_id) DO UPDATE
       SET balance = coin_wallets.balance + $2::int,
           total_earned = coin_wallets.total_earned + $2::int,
           updated_at = NOW()`,
      [userId, row.coins]
    );
    // Log transaction
    await pool.query(
      `INSERT INTO coin_transactions (user_id, type, coins, description, recharge_code_id)
       VALUES ($1, 'recharge', $2, $3, $4)`,
      [userId, row.coins, `شحن بكود - ${row.coins} عملة`, row.id]
    );
    res.json({ success: true, coins: row.coins, message: `تم إضافة ${row.coins} عملة لمحفظتك` });
  });

  // Submit coin purchase order (user pays via Vodafone Cash / InstaPay / Bank)
  app.post("/api/coins/purchase-order", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { packageId, coins, amountEGP, paymentMethod, paymentRef, screenshotUrl, userName } = req.body || {};
    if (!coins || !amountEGP || !paymentMethod) return res.status(400).json({ message: "بيانات ناقصة" });

    const r = await pool.query(
      `INSERT INTO coin_purchase_orders (user_id, user_name, package_id, coins, amount_egp, payment_method, payment_ref, screenshot_url, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending') RETURNING *`,
      [userId, userName || null, packageId || null, coins, amountEGP, paymentMethod, paymentRef || null, screenshotUrl || null]
    );
    // Notify admins about new coin purchase
    try {
      for (const adminId of [ADMIN_USER_ID, ADMIN_USER_ID2]) {
        await createNotification(adminId, "system",
          `🪙 طلب شحن عملات جديد`,
          `${userName || userId} — ${coins} عملة مقابل ${amountEGP} ج.م (${paymentMethod})`,
          "/admin"
        );
      }
    } catch (_) {}
    res.json({ success: true, order: r.rows[0], message: "تم استلام طلبك — سيتم تأكيد الشحن خلال دقائق" });
  });

  // Get my purchase orders
  app.get("/api/coins/my-orders", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const r = await pool.query(
      `SELECT * FROM coin_purchase_orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [userId]
    );
    res.json(r.rows);
  });

  // ADMIN: List purchase orders
  app.get("/api/admin/coins/purchase-orders", isAuthenticated, async (req: any, res) => {
    if (!isAdminUser(req)) return res.status(403).json({ message: "Forbidden" });
    const status = req.query.status as string || "pending";
    const r = await pool.query(
      `SELECT * FROM coin_purchase_orders WHERE status = $1 ORDER BY created_at DESC LIMIT 50`,
      [status]
    );
    res.json(r.rows);
  });

  // ADMIN: Approve or reject purchase order
  app.patch("/api/admin/coins/purchase-orders/:id", isAuthenticated, async (req: any, res) => {
    if (!isAdminUser(req)) return res.status(403).json({ message: "Forbidden" });
    const adminId = req.user.claims.sub;
    const { action, adminNote } = req.body || {};
    const orderId = req.params.id;

    const orderR = await pool.query(`SELECT * FROM coin_purchase_orders WHERE id = $1`, [orderId]);
    if (orderR.rows.length === 0) return res.status(404).json({ message: "الطلب غير موجود" });
    const order = orderR.rows[0];

    if (order.status !== "pending") return res.status(400).json({ message: "الطلب تمت مراجعته بالفعل" });

    if (action === "approve") {
      // Add coins to user wallet
      await pool.query(
        `INSERT INTO coin_wallets (user_id, balance, total_spent, total_earned)
         VALUES ($1, $2::int, 0, $2::int)
         ON CONFLICT (user_id) DO UPDATE
         SET balance = coin_wallets.balance + $2::int,
             total_earned = coin_wallets.total_earned + $2::int,
             updated_at = NOW()`,
        [order.user_id, order.coins]
      );
      // Log coin transaction
      await pool.query(
        `INSERT INTO coin_transactions (user_id, type, coins, description)
         VALUES ($1, 'purchase', $2, $3)`,
        [order.user_id, order.coins, `شراء ${order.coins} عملة — ${order.payment_method} — ${order.amount_egp} ج.م`]
      );
      // Update order
      await pool.query(
        `UPDATE coin_purchase_orders SET status = 'approved', admin_note = $1, reviewed_at = NOW(), reviewed_by = $2 WHERE id = $3`,
        [adminNote || null, adminId, orderId]
      );
      // Notify user
      try {
        await createNotification(order.user_id, "payment",
          `✅ تم قبول طلب شحن العملات`,
          `تمت إضافة ${order.coins} عملة إلى محفظتك بنجاح 🎉`,
          "/coins"
        );
      } catch (_) {}
      return res.json({ success: true, message: `تم قبول الطلب وإضافة ${order.coins} عملة` });
    }

    if (action === "reject") {
      await pool.query(
        `UPDATE coin_purchase_orders SET status = 'rejected', admin_note = $1, reviewed_at = NOW(), reviewed_by = $2 WHERE id = $3`,
        [adminNote || null, adminId, orderId]
      );
      try {
        await createNotification(order.user_id, "payment",
          `❌ تم رفض طلب شحن العملات`,
          adminNote ? `سبب الرفض: ${adminNote}` : `للاستفسار تواصل مع الإدارة`,
          "/coins"
        );
      } catch (_) {}
      return res.json({ success: true, message: "تم رفض الطلب" });
    }

    return res.status(400).json({ message: "إجراء غير صالح" });
  });

  // ADMIN: Generate recharge codes
  app.post("/api/admin/coins/generate-codes", isAuthenticated, async (req: any, res) => {
    if (!isAdminUser(req)) return res.status(403).json({ message: "Forbidden" });
    const { coins, priceEGP, count, expiresInDays } = req.body || {};
    if (!coins || !count) return res.status(400).json({ message: "Missing fields" });
    const resolvedPrice = priceEGP || 0;

    const codes: string[] = [];
    const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) : null;

    for (let i = 0; i < Math.min(count, 500); i++) {
      const code = `SOUQ-${Math.random().toString(36).toUpperCase().slice(2, 7)}-${Math.random().toString(36).toUpperCase().slice(2, 7)}`;
      codes.push(code);
      await pool.query(
        `INSERT INTO coin_recharge_codes (code, coins, price_egp, expires_at) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
        [code, coins, resolvedPrice, expiresAt]
      );
    }
    res.json({ success: true, codes, count: codes.length });
  });

  // ADMIN: List recharge codes
  app.get("/api/admin/coins/codes", isAuthenticated, async (req: any, res) => {
    if (!isAdminUser(req)) return res.status(403).json({ message: "Forbidden" });
    const page = parseInt((req.query.page as string) || "1");
    const limit = parseInt((req.query.limit as string) || "20");
    const offset = (page - 1) * limit;
    const countR = await pool.query(`SELECT COUNT(*) FROM coin_recharge_codes`);
    const total = parseInt(countR.rows[0].count);
    const r = await pool.query(
      `SELECT crc.*, u.first_name, u.last_name FROM coin_recharge_codes crc
       LEFT JOIN users u ON u.id::text = crc.used_by_user_id::text
       ORDER BY crc.created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json({ codes: r.rows, total, page, limit, pages: Math.ceil(total / limit) });
  });

  // ADMIN: Manage coin packages
  app.post("/api/admin/coins/packages", isAuthenticated, async (req: any, res) => {
    if (!isAdminUser(req)) return res.status(403).json({ message: "Forbidden" });
    const { name, coins, priceEGP, bonusCoins, sortOrder } = req.body || {};
    const r = await pool.query(
      `INSERT INTO coin_packages (name, coins, price_egp, bonus_coins, sort_order) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [name, coins, priceEGP, bonusCoins || 0, sortOrder || 0]
    );
    res.json(r.rows[0]);
  });

  app.patch("/api/admin/coins/packages/:id", isAuthenticated, async (req: any, res) => {
    if (!isAdminUser(req)) return res.status(403).json({ message: "Forbidden" });
    const { isActive } = req.body || {};
    await pool.query(`UPDATE coin_packages SET is_active = $1 WHERE id = $2`, [isActive, req.params.id]);
    res.json({ success: true });
  });

  // ================================================================
  // EGP WALLET ROUTES — محفظة الجنيه المصري
  // ================================================================

  // GET /api/wallet/balance — الرصيد الحالي + آخر المعاملات مع تفاصيل الإعلانات
  app.get("/api/wallet/balance", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    try {
      const userR = await pool.query(`SELECT balance_egp FROM users WHERE id = $1`, [userId]);
      const balance = parseFloat(userR.rows[0]?.balance_egp || "0");
      // All wallet mutations with ad title joined where available
      const txR = await pool.query(
        `SELECT wt.*, a.title as ad_title, a.id as ad_id_ref
         FROM wallet_transactions wt
         LEFT JOIN ads a ON a.id::text = wt.ref_id
         WHERE wt.user_id = $1
         ORDER BY wt.created_at DESC LIMIT 100`,
        [userId]
      );
      // Spending breakdown by type
      const breakdownR = await pool.query(
        `SELECT type,
                COALESCE(SUM(amount_egp),0) as total,
                COUNT(*) as count
         FROM wallet_transactions
         WHERE user_id = $1 AND type != 'top_up'
         GROUP BY type`,
        [userId]
      );
      res.json({ balance, transactions: txR.rows, breakdown: breakdownR.rows });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // POST /api/wallet/top-up — طلب شحن المحفظة
  app.post("/api/wallet/top-up", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { amountEGP, paymentMethod, paymentRef, screenshotUrl } = req.body || {};
    if (!amountEGP || !paymentMethod) return res.status(400).json({ message: "المبلغ وطريقة الدفع مطلوبان" });
    // Whitelist allowed payment methods
    const ALLOWED_PAYMENT_METHODS = ["vodafone", "etisalat", "instapay", "souq"];
    if (!ALLOWED_PAYMENT_METHODS.includes(paymentMethod)) {
      return res.status(400).json({ message: "طريقة دفع غير مدعومة" });
    }
    const amount = parseFloat(amountEGP);
    if (isNaN(amount) || amount <= 0) return res.status(400).json({ message: "مبلغ غير صالح" });

    // Sanitize screenshotUrl: only accept relative /uploads/ paths from our own upload handler
    let safeScreenshotUrl: string | null = null;
    if (screenshotUrl && typeof screenshotUrl === "string") {
      const trimmed = screenshotUrl.trim();
      if (/^\/uploads\/[^\s<>"]+$/.test(trimmed) || /^\/api\/uploads\/[^\s<>"]+$/.test(trimmed)) {
        safeScreenshotUrl = trimmed;
      }
      // Reject javascript:, data:, absolute external URLs — only same-origin upload paths allowed
    }

    // Require proof of payment: at least a screenshot or a payment reference
    if (!safeScreenshotUrl && !paymentRef) {
      return res.status(400).json({ message: "يرجى رفع إيصال الدفع أو إدخال رقم العملية كدليل على الدفع" });
    }

    const userR = await pool.query(`SELECT first_name, last_name FROM users WHERE id = $1`, [userId]);
    const userName = `${userR.rows[0]?.first_name || ""} ${userR.rows[0]?.last_name || ""}`.trim() || userId;

    // Generate order number — for Souq/البنك الأهلي, use a structured bank-transfer reference
    const timestamp = Date.now();
    const shortRand = Math.random().toString(36).toUpperCase().slice(2, 6);
    const orderNumber = `WLT-${timestamp.toString(36).toUpperCase()}-${shortRand}`;

    // For Souq method: generate a structured orderRef the user includes in their transfer description
    let souqOrderRef: string | null = null;
    if (paymentMethod === "souq") {
      // Format: ADS-{userId_short}-{amount}-{timestamp_short}
      const userShort = (userId || "").slice(-4).toUpperCase();
      souqOrderRef = `ADS-${userShort}-${Math.round(amount)}-${shortRand}`;
    }

    const effectivePaymentRef = paymentRef || souqOrderRef || null;

    const r = await pool.query(
      `INSERT INTO wallet_top_up_orders (user_id, amount_egp, payment_method, payment_ref, screenshot_url, status, order_number)
       VALUES ($1, $2, $3, $4, $5, 'pending', $6) RETURNING *`,
      [userId, amount, paymentMethod, effectivePaymentRef, safeScreenshotUrl, orderNumber]
    );

    // Notify both admins about new wallet top-up request
    for (const adminId of [ADMIN_USER_ID, ADMIN_USER_ID2]) {
      try {
        await createNotification(adminId, "payment",
          `💰 طلب شحن محفظة جديد`,
          `${userName} — ${amount} ج.م عبر ${paymentMethod}`,
          "/admin"
        );
      } catch (_) {}
    }

    res.status(201).json({
      success: true,
      order: r.rows[0],
      orderNumber,
      ...(souqOrderRef ? { souqOrderRef, message: `استخدم الرمز المرجعي ${souqOrderRef} في بيان التحويل البنكي` } : {}),
    });
  });

  // GET /api/admin/wallet-topups — الأدمن يرى طلبات الشحن
  app.get("/api/admin/wallet-topups", isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const r = await pool.query(
        `SELECT o.*, u.first_name, u.last_name, u.email, u.balance_egp
         FROM wallet_top_up_orders o
         LEFT JOIN users u ON u.id = o.user_id
         ORDER BY o.created_at DESC
         LIMIT 200`
      );
      res.json(r.rows);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // PATCH /api/admin/wallet-topups/:id — قبول أو رفض طلب الشحن
  app.patch("/api/admin/wallet-topups/:id", isAuthenticated, requireAdmin, async (req: any, res) => {
    const { action, adminNote } = req.body || {};
    const orderId = parseInt(req.params.id);
    if (!action || !["approve", "reject"].includes(action)) return res.status(400).json({ message: "إجراء غير صالح" });

    // Use a DB client with transaction for atomicity and row-level lock
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Lock the order row to prevent concurrent double-approval
      const orderR = await client.query(
        `SELECT * FROM wallet_top_up_orders WHERE id = $1 FOR UPDATE`,
        [orderId]
      );
      if (orderR.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "الطلب غير موجود" });
      }
      const order = orderR.rows[0];

      if (order.status !== "pending") {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "تم معالجة هذا الطلب مسبقاً" });
      }

      if (action === "approve") {
        // Atomically: update wallet balance + log wallet transaction + mark order approved
        await client.query(
          `UPDATE users SET balance_egp = COALESCE(balance_egp, 0) + $1 WHERE id = $2`,
          [order.amount_egp, order.user_id]
        );
        await client.query(
          `INSERT INTO wallet_transactions (user_id, type, amount_egp, description, ref_id)
           VALUES ($1, 'top_up', $2, $3, $4)`,
          [order.user_id, order.amount_egp, `شحن محفظة — ${order.payment_method}`, order.order_number]
        );
        await client.query(
          `UPDATE wallet_top_up_orders SET status = 'approved', admin_note = $1, reviewed_at = NOW(), reviewed_by = $2 WHERE id = $3`,
          [adminNote || null, req.user.claims.sub, orderId]
        );
        await client.query("COMMIT");

        // Notify user (outside transaction — non-critical)
        try {
          await createNotification(order.user_id, "payment",
            `✅ تمت الموافقة على شحن محفظتك`,
            `تم إضافة ${order.amount_egp} ج.م إلى رصيدك بنجاح 💰`,
            "/wallet"
          );
        } catch (_) {}
        return res.json({ success: true, message: "تمت الموافقة وإضافة الرصيد" });
      } else {
        await client.query(
          `UPDATE wallet_top_up_orders SET status = 'rejected', admin_note = $1, reviewed_at = NOW(), reviewed_by = $2 WHERE id = $3`,
          [adminNote || null, req.user.claims.sub, orderId]
        );
        await client.query("COMMIT");

        try {
          await createNotification(order.user_id, "payment",
            `❌ تم رفض طلب شحن المحفظة`,
            adminNote ? `سبب الرفض: ${adminNote}` : `للاستفسار تواصل مع الإدارة`,
            "/wallet"
          );
        } catch (_) {}
        return res.json({ success: true, message: "تم رفض الطلب" });
      }
    } catch (e: any) {
      await client.query("ROLLBACK");
      res.status(500).json({ message: e.message });
    } finally {
      client.release();
    }
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

  // ── Sitemap.xml (SEO) ─────────────────────────────────────────
  // ── Sitemap Index ──
  app.get("/sitemap.xml", async (_req, res) => {
    const BASE = "https://ads-as.com";
    const now = new Date().toISOString().split("T")[0];
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${BASE}/sitemap-pages.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${BASE}/sitemap-dynamic.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
</sitemapindex>`);
  });

  // ── robots.txt (SEO) ──
  app.get("/robots.txt", (_req, res) => {
    const BASE = "https://ads-as.com";
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(`User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/
Disallow: /login
Sitemap: ${BASE}/sitemap.xml
Sitemap: ${BASE}/sitemap-pages.xml
`);
  });

  // ── Static Pages Sitemap ──
  app.get("/sitemap-pages.xml", async (_req, res) => {
    const BASE = "https://ads-as.com";
    const now = new Date().toISOString().split("T")[0];
    const pages = [
      { loc: "/",            priority: "1.0", freq: "daily"   },
      { loc: "/ads",         priority: "0.95", freq: "hourly" },
      { loc: "/reels",       priority: "0.9",  freq: "hourly" },
      { loc: "/channels",    priority: "0.85", freq: "daily"  },
      { loc: "/livestream",  priority: "0.85", freq: "always" },
      { loc: "/campaigns",   priority: "0.8",  freq: "daily"  },
      { loc: "/coupons",     priority: "0.75", freq: "daily"  },
      { loc: "/store",       priority: "0.75", freq: "daily"  },
      { loc: "/create",      priority: "0.7",  freq: "monthly"},
      { loc: "/login",       priority: "0.6",  freq: "monthly"},
    ];
    const urlTags = pages.map(p => `
  <url>
    <loc>${BASE}${p.loc}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${p.freq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join("");
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">${urlTags}
</urlset>`);
  });

  // ================================================================
  // PLATFORM SETTINGS (Admin only)
  // ================================================================
  // ── Public settings — NEVER return secrets ─────────────────────
  const PRIVATE_KEYS = new Set([
    'vapid_private_key', 'admin_pin', 'admin_recovery_email',
    'admin_recovery_phone', 'password_hash',
  ]);
  app.get("/api/settings", async (req, res) => {
    const all = await storage.getAllSettings();
    const safe: Record<string, string> = {};
    for (const [k, v] of Object.entries(all)) {
      if (!PRIVATE_KEYS.has(k)) safe[k] = v;
    }
    res.json(safe);
  });

  // ── Admin PIN ────────────────────────────────────────────────────
  app.post("/api/admin/publish", isAuthenticated, requireAdmin, async (_req: any, res) => {
    const now = new Date().toISOString();
    await db.execute(sql`INSERT INTO platform_settings (key, value) VALUES ('last_published_at', ${now}) ON CONFLICT (key) DO UPDATE SET value = ${now}`);
    res.json({ success: true, publishedAt: now });
  });

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

  // Auto-generate PIN on first access
  app.get("/api/admin/pin/init", isAuthenticated, requireAdmin, async (_req, res) => {
    const { createHash } = await import("crypto");
    const row = await db.execute(sql`SELECT value FROM platform_settings WHERE key = 'admin_pin' LIMIT 1`);
    const stored = (row.rows[0] as any)?.value;
    if (stored) return res.json({ generated: false }); // already set
    // Generate random 6-digit PIN
    const pin = String(Math.floor(100000 + Math.random() * 900000));
    const hashed = createHash("sha256").update(pin).digest("hex");
    await db.execute(sql`INSERT INTO platform_settings (key, value) VALUES ('admin_pin', ${hashed}) ON CONFLICT (key) DO UPDATE SET value = ${hashed}`);
    res.json({ generated: true, pin });
  });

  app.post("/api/admin/pin/verify", isAuthenticated, requireAdmin, async (req: any, res) => {
    const { pin } = req.body;
    const { createHash } = await import("crypto");
    const hashed = createHash("sha256").update(pin || "").digest("hex");
    const row = await db.execute(sql`SELECT value FROM platform_settings WHERE key = 'admin_pin' LIMIT 1`);
    const stored = (row.rows[0] as any)?.value;
    if (!stored) return res.json({ valid: false, noPinSet: true });
    res.json({ valid: hashed === stored });
  });

  // Recover PIN: verify email/phone + password → auto-generate new PIN
  app.post("/api/admin/pin/recover", isAuthenticated, requireAdmin, async (req: any, res) => {
    const { input, password } = req.body; // email or phone + password
    if (!input || !password) return res.status(400).json({ message: "أدخل الإيميل أو التليفون وكلمة السر" });
    // Find admin user by email or phone
    const userRow = await db.execute(sql`SELECT id, email, phone, password_hash FROM users WHERE (email = ${input} OR phone = ${input}) LIMIT 1`);
    const user = userRow.rows[0] as any;
    if (!user) return res.status(401).json({ message: "لم يتم العثور على الحساب" });
    // Verify password
    const bcrypt = await import("bcryptjs");
    const valid = user.password_hash && await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ message: "كلمة السر غير صحيحة" });
    // Auto-generate new 6-digit PIN
    const { createHash } = await import("crypto");
    const newPin = String(Math.floor(100000 + Math.random() * 900000));
    const hashed = createHash("sha256").update(newPin).digest("hex");
    await db.execute(sql`INSERT INTO platform_settings (key, value) VALUES ('admin_pin', ${hashed}) ON CONFLICT (key) DO UPDATE SET value = ${hashed}`);
    res.json({ success: true, pin: newPin });
  });

  // Change admin password
  app.post("/api/admin/change-password", isAuthenticated, requireAdmin, async (req: any, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ message: "أدخل كلمة السر الحالية والجديدة" });
    if (newPassword.length < 6) return res.status(400).json({ message: "كلمة السر الجديدة لازم تكون 6 أحرف على الأقل" });
    const userId = req.user.claims.sub;
    const userRow = await db.execute(sql`SELECT password_hash FROM users WHERE id = ${userId} LIMIT 1`);
    const user = userRow.rows[0] as any;
    const bcrypt = await import("bcryptjs");
    const valid = user?.password_hash && await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) return res.status(401).json({ message: "كلمة السر الحالية غير صحيحة" });
    const newHash = await bcrypt.hash(newPassword, 10);
    await db.execute(sql`UPDATE users SET password_hash = ${newHash} WHERE id = ${userId}`);
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
  // TRENDING
  // ================================================================

  // GET /api/trending/ads — top trending ads (Hacker News-style score)
  app.get("/api/trending/ads", async (req, res) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 12, 30);
      const rows = await pool.query(`
        SELECT
          id, title, description, media_url, media_type, price_egp,
          views_count, likes_count, whatsapp_clicks, is_boosted, is_admin_promo,
          created_at, status, user_id,
          (
            COALESCE(views_count, 0) * 1.0
            + COALESCE(likes_count, 0) * 5.0
            + COALESCE(whatsapp_clicks, 0) * 3.0
            + CASE WHEN is_boosted THEN 50 ELSE 0 END
            + CASE WHEN is_admin_promo THEN 30 ELSE 0 END
          ) / POWER(
            GREATEST(EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600.0, 0.5) + 2,
            1.5
          ) AS trending_score
        FROM ads
        WHERE status = 'active'
        ORDER BY trending_score DESC
        LIMIT $1
      `, [limit]);
      res.json(rows.rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // GET /api/trending/channels — top trending channels
  app.get("/api/trending/channels", async (req, res) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 8, 20);
      // Try with live_streams join for active-stream bonus; fall back to simple query
      let rows;
      try {
        rows = await pool.query(`
          SELECT
            c.id, c.name, c.description, c.avatar_url, c.banner_url,
            c.subscriber_count, c.views_count, c.is_verified, c.is_monetized,
            c.category, c.created_at,
            (
              COALESCE(c.subscriber_count, 0) * 3.0
              + COALESCE(c.views_count, 0) * 0.5
              + CASE WHEN EXISTS(
                  SELECT 1 FROM live_streams s WHERE s.channel_id = c.id AND s.status = 'live'
                ) THEN 200 ELSE 0 END
              + CASE WHEN c.is_verified THEN 20 ELSE 0 END
              + CASE WHEN c.is_monetized THEN 15 ELSE 0 END
            ) AS trending_score
          FROM channels c
          WHERE c.status = 'active'
          ORDER BY trending_score DESC
          LIMIT $1
        `, [limit]);
      } catch (fallbackErr: any) {
        console.error("[trending/channels] primary query failed, using fallback:", fallbackErr?.message);
        // Fallback: basic ranking without live-stream bonus
        rows = await pool.query(`
          SELECT
            c.id, c.name, c.description, c.avatar_url, c.banner_url,
            c.subscriber_count, c.views_count, c.is_verified, c.is_monetized,
            c.category, c.created_at,
            (
              COALESCE(c.subscriber_count, 0) * 3.0
              + COALESCE(c.views_count, 0) * 0.5
              + CASE WHEN c.is_verified THEN 20 ELSE 0 END
              + CASE WHEN c.is_monetized THEN 15 ELSE 0 END
            ) AS trending_score
          FROM channels c
          WHERE c.status = 'active'
          ORDER BY trending_score DESC
          LIMIT $1
        `, [limit]);
      }
      res.json(rows.rows);
    } catch (e: any) {
      console.error("[trending/channels] all queries failed, returning empty:", e?.message);
      res.json([]);
    }
  });

  // ================================================================
  // SEARCH
  // ================================================================
  app.get("/api/ads/search", async (req, res) => {
    const q = ((req.query.q as string) || "").trim();
    const lang = (req.query.lang as string) || "";
    if (!q) return res.json([]);
    try {
      const pattern = `%${q}%`;
      let result;
      if (lang) {
        result = await db.execute(
          sql`SELECT * FROM ads
              WHERE status = 'active'
                AND language = ${lang}
                AND (
                  title ILIKE ${pattern}
                  OR description ILIKE ${pattern}
                  OR target_region ILIKE ${pattern}
                  OR whatsapp_number ILIKE ${pattern}
                  OR payment_link ILIKE ${pattern}
                  OR app_store_url ILIKE ${pattern}
                  OR google_play_url ILIKE ${pattern}
                  OR app_gallery_url ILIKE ${pattern}
                )
              ORDER BY created_at DESC LIMIT 50`
        );
      } else {
        result = await db.execute(
          sql`SELECT * FROM ads
              WHERE status = 'active'
                AND (
                  title ILIKE ${pattern}
                  OR description ILIKE ${pattern}
                  OR target_region ILIKE ${pattern}
                  OR whatsapp_number ILIKE ${pattern}
                  OR payment_link ILIKE ${pattern}
                  OR app_store_url ILIKE ${pattern}
                  OR google_play_url ILIKE ${pattern}
                  OR app_gallery_url ILIKE ${pattern}
                )
              ORDER BY created_at DESC LIMIT 50`
        );
      }
      res.json(result.rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ================================================================
  // WEB PUSH NOTIFICATIONS
  // ================================================================
  app.get("/api/vapid-public-key", async (_req, res) => {
    try {
      const row = await db.execute(sql`SELECT value FROM platform_settings WHERE key = 'vapid_public_key' LIMIT 1`);
      if (row.rows.length === 0) return res.status(503).json({ message: "Push not configured" });
      res.json({ publicKey: (row.rows[0] as any).value });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/push/subscribe", async (req: any, res) => {
    const userId: string | undefined = req.session?.customUser?.id || req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) return res.status(400).json({ message: "Invalid subscription" });
    try {
      await db.execute(
        sql`INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
            VALUES (${userId}, ${endpoint}, ${keys.p256dh}, ${keys.auth})
            ON CONFLICT (endpoint) DO UPDATE SET user_id = ${userId}, p256dh = ${keys.p256dh}, auth = ${keys.auth}`
      );
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.delete("/api/push/subscribe", async (req: any, res) => {
    const userId: string | undefined = req.session?.customUser?.id || req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const { endpoint } = req.body;
    if (endpoint) {
      await db.execute(sql`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint} AND user_id = ${userId}`);
    } else {
      await db.execute(sql`DELETE FROM push_subscriptions WHERE user_id = ${userId}`);
    }
    res.json({ ok: true });
  });

  // ================================================================
  // ADS ROUTES (isolated - users see only their own ads when authenticated)
  // ================================================================
  app.get("/api/ads", async (req: any, res) => {
    const language   = req.query.language   as string | undefined;
    const myAds      = req.query.mine === 'true';
    const filterUserId = req.query.userId   as string | undefined;
    const authUserId = req.user?.claims?.sub;

    // ── My ads / user ads (no pagination needed) ──
    if (myAds && authUserId) {
      const adsList = await storage.getAds(undefined, authUserId);
      return res.json(adsList);
    }
    if (filterUserId) {
      const adsList = await storage.getAds(undefined, filterUserId);
      return res.json(adsList);
    }

    try {
      // Auto-expire boosts
      await db.execute(sql`
        UPDATE ads SET is_boosted = false, boosted_until = NULL
        WHERE is_boosted = true AND boosted_until IS NOT NULL AND boosted_until < NOW()
      `);

      // ── Pagination & Filter params ──
      const page     = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit    = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
      const offset   = (page - 1) * limit;
      const priceMin = req.query.priceMin ? parseFloat(req.query.priceMin as string) : null;
      const priceMax = req.query.priceMax ? parseFloat(req.query.priceMax as string) : null;
      const region   = (req.query.region as string) || "";
      const sortBy   = (req.query.sortBy as string) || "boost";   // boost | newest | oldest | price_asc | price_desc | views
      const mediaType = (req.query.mediaType as string) || "";

      // ── Build WHERE clauses ──
      const conditions: string[] = ["status = 'active'"];
      const params: any[]        = [];
      let pi = 1;

      if (language) { conditions.push(`language = $${pi++}`);   params.push(language); }
      if (region)   { conditions.push(`target_region ILIKE $${pi++}`); params.push(`%${region}%`); }
      if (mediaType){ conditions.push(`media_type = $${pi++}`); params.push(mediaType); }
      if (priceMin !== null) { conditions.push(`price_egp >= $${pi++}`); params.push(priceMin); }
      if (priceMax !== null) { conditions.push(`price_egp <= $${pi++}`); params.push(priceMax); }

      const where = conditions.join(" AND ");

      // ── ORDER BY ──
      const orderMap: Record<string, string> = {
        boost:      "CASE WHEN is_boosted = true THEN 0 ELSE 1 END ASC, created_at DESC",
        newest:     "created_at DESC",
        oldest:     "created_at ASC",
        price_asc:  "price_egp ASC NULLS LAST",
        price_desc: "price_egp DESC NULLS LAST",
        views:      "views_count DESC",
      };
      const orderBy = orderMap[sortBy] || orderMap.boost;

      // ── Count total ──
      const countRes = await pool.query(`SELECT COUNT(*) AS total FROM ads WHERE ${where}`, params);
      const total = parseInt(countRes.rows[0]?.total || "0");

      // ── Fetch page ──
      params.push(limit, offset);
      const dataRes = await pool.query(
        `SELECT * FROM ads WHERE ${where} ORDER BY ${orderBy} LIMIT $${pi++} OFFSET $${pi++}`,
        params
      );

      res.json({
        ads:   dataRes.rows,
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      });
    } catch (e: any) {
      // Fallback: return simple list
      const adsList = await storage.getAds(language);
      res.json({ ads: adsList, total: adsList.length, page: 1, limit: adsList.length, pages: 1, hasMore: false });
    }
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
      // Default ad duration = 7 days from creation
      const defaultExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const ad = await storage.createAd({ ...input, userId: req.user.claims.sub, expiresAt: input.expiresAt ?? defaultExpiry });
      res.status(201).json(ad);

      // ── Notify targeted users about the new ad (async, non-blocking) ──
      (async () => {
        try {
          const userId = req.user.claims.sub;
          const publisherName = req.user.claims?.first_name || "أحد المعلنين";
          const adLink = `/ads/${ad.id}`;
          const notifTitle = `🆕 إعلان جديد من ${publisherName}`;
          const notifBody = ad.title ? `"${ad.title}" — شاهد الإعلان الآن` : "أُضيف إعلان جديد قد يهمك";

          const notifiedUsers = new Set<string>([userId]); // never notify self

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
              const fid = (row as any).follower_id;
              if (!notifiedUsers.has(fid)) {
                await createNotification(fid, "system", notifTitle, notifBody, adLink);
                notifiedUsers.add(fid);
              }
            }
          }

          // 2) Notify users whose stored governorate matches the ad's targetRegion
          const targetRegion = ad.targetRegion ?? "";
          if (targetRegion.trim().length > 0) {
            const regions = targetRegion.split(",").map((r) => r.trim()).filter(Boolean);
            for (const region of regions) {
              const regionUsers = await db.execute(
                sql`SELECT id FROM users
                    WHERE governorate = ${region} AND id != ${userId}
                    LIMIT 300`
              );
              const regionTitle = `📍 إعلان جديد في ${region}`;
              for (const row of regionUsers.rows as any[]) {
                const uid = (row as any).id;
                if (!notifiedUsers.has(uid)) {
                  await createNotification(uid, "system", regionTitle, notifBody, adLink);
                  notifiedUsers.add(uid);
                }
              }
            }
          }

          // 3) Notify users whose interests overlap with the ad's targetInterests
          const targetInterests = ad.targetInterests ?? "";
          if (targetInterests.trim().length > 0) {
            const interestsArray = targetInterests.split(",").map((i) => i.trim()).filter(Boolean);
            // Build a Postgres array literal to use with the && overlap operator
            const pgArray = `{${interestsArray.map((i) => `"${i.replace(/"/g, "")}"`).join(",")}}`;
            const interestUsers = await db.execute(
              sql`SELECT id FROM users
                  WHERE interests IS NOT NULL
                    AND interests <> ''
                    AND string_to_array(interests, ',') && ${pgArray}::text[]
                    AND id != ${userId}
                  LIMIT 500`
            );
            const interestTitle = `💡 إعلان يناسب اهتماماتك من ${publisherName}`;
            for (const row of interestUsers.rows as any[]) {
              const uid = (row as any).id;
              if (!notifiedUsers.has(uid)) {
                await createNotification(uid, "system", interestTitle, notifBody, adLink);
                notifiedUsers.add(uid);
              }
            }
          }
        } catch (e) {
          console.error('[Ad Notify] Error:', e);
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
  // AD BOOST NOTIFY — Paid reach: notifies ALL users (up to 1000)
  // Rate limited: max once every 30 days per ad. Admin can enable/disable + set price.
  // ================================================================
  // POST /api/boost/pay-order — create payment order, notify admin, return order number
  app.post("/api/boost/pay-order", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { adId, paymentRef, amount, paymentMethod, screenshotUrl } = req.body;
    if (!adId || !paymentRef) return res.status(400).json({ message: "بيانات ناقصة" });
    try {
      const ad = await storage.getAd(parseInt(adId));
      if (!ad) return res.status(404).json({ message: "الإعلان غير موجود" });
      if (ad.userId !== userId) return res.status(403).json({ message: "غير مصرح" });

      // Generate unique order number: BOOST-{adId}-{timestamp last 6 digits}
      const ts = Date.now().toString().slice(-6);
      const orderNumber = `BOOST-${adId}-${ts}`;

      // Save order in DB (with payment method and screenshot)
      await db.execute(sql`
        INSERT INTO boost_orders (order_number, ad_id, user_id, amount, payment_ref, status, payment_method, payment_screenshot_url)
        VALUES (${orderNumber}, ${adId}, ${userId}, ${amount || 0}, ${paymentRef}, 'pending', ${paymentMethod || null}, ${screenshotUrl || null})
      `);

      // Notify both admins
      const userName = req.user.claims?.first_name || "مستخدم";
      for (const adminId of [ADMIN_USER_ID, ADMIN_USER_ID2]) {
        await createNotification(
          adminId,
          "payment",
          `⚡ طلب تعزيز جديد`,
          `${userName} — ${amount || 0} ج.م لتعزيز إعلان #${adId} (${orderNumber})`,
          `/admin`
        );
      }

      // Send DM (from admin) to user with receipt
      const receiptMsg =
        `🧾 إيصال تعزيز إعلان\n` +
        `━━━━━━━━━━━━━━━━━\n` +
        `📋 رقم الطلب: ${orderNumber}\n` +
        `📢 رقم الإعلان: #${adId}\n` +
        `💰 المبلغ: ${amount || 0} ج.م\n` +
        `🔑 مرجع الدفع: ${paymentRef}\n` +
        `⏳ الحالة: قيد المراجعة\n` +
        `━━━━━━━━━━━━━━━━━\n` +
        `سيتم تأكيد التعزيز خلال 24 ساعة ✅`;

      await db.execute(sql`
        INSERT INTO direct_messages (from_user_id, to_user_id, ad_id, message, is_voice)
        VALUES (${ADMIN_USER_ID}, ${userId}, ${adId}, ${receiptMsg}, false)
      `);

      res.json({ ok: true, orderNumber, adId, amount: amount || 0 });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // GET /api/boost/orders — admin: list all boost orders
  app.get("/api/boost/orders", isAuthenticated, async (req: any, res) => {
    if (req.user.claims.sub !== ADMIN_USER_ID) return res.status(403).json({ message: "أدمن فقط" });
    try {
      const rows = await db.execute(sql`
        SELECT bo.*, u.first_name, u.last_name, a.title AS ad_title
        FROM boost_orders bo
        LEFT JOIN users u ON u.id = bo.user_id
        LEFT JOIN ads a ON a.id = bo.ad_id
        ORDER BY bo.created_at DESC LIMIT 100
      `);
      res.json(rows.rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // PATCH /api/boost/orders/:id — admin: confirm or reject
  app.patch("/api/boost/orders/:id", isAuthenticated, async (req: any, res) => {
    if (req.user.claims.sub !== ADMIN_USER_ID) return res.status(403).json({ message: "أدمن فقط" });
    const { status } = req.body; // 'confirmed' | 'rejected'
    try {
      const orderRow = await db.execute(sql`SELECT * FROM boost_orders WHERE id = ${req.params.id} LIMIT 1`);
      const order = (orderRow.rows[0] as any);
      if (!order) return res.status(404).json({ message: "الطلب غير موجود" });

      await db.execute(sql`UPDATE boost_orders SET status = ${status} WHERE id = ${req.params.id}`);

      if (status === 'confirmed') {
        // ✅ ACTIVATE: mark ad as boosted using duration from platform_settings
        const durRow = await db.execute(sql`SELECT value FROM platform_settings WHERE key = 'boost_duration_days' LIMIT 1`);
        const durDays = parseInt((durRow.rows[0] as any)?.value || "30");
        await pool.query(
          `UPDATE ads SET is_boosted = true, boosted_until = NOW() + INTERVAL '1 day' * $1 WHERE id = $2`,
          [durDays, order.ad_id]
        );
        // Actually run the boost
        const ad = await storage.getAd(order.ad_id);
        if (ad) {
          const allRows = await db.execute(sql`SELECT id FROM users WHERE id != ${order.user_id} LIMIT 1000`);
          for (const row of allRows.rows as any[]) {
            await createNotification(row.id, "system",
              `🚀 إعلان مميز: ${ad.title}`,
              `✨ عرض مميز لا تفوّته — شاهده الآن!`,
              `/ads/${order.ad_id}`
            );
          }
        }
        // Notify user via push/bell
        await createNotification(order.user_id, "system",
          `✅ تم تأكيد تعزيز إعلانك`,
          `رقم الطلب ${order.order_number} — تمت الموافقة وبدأ التعزيز!`,
          `/ads/${order.ad_id}`
        );
        // DM confirmation to user
        const confirmMsg =
          `✅ تم تأكيد طلب التعزيز\n` +
          `━━━━━━━━━━━━━━━━━\n` +
          `📋 رقم الطلب: ${order.order_number}\n` +
          `📢 رقم الإعلان: #${order.ad_id}\n` +
          `💰 المبلغ: ${order.amount} ج.م\n` +
          `🚀 الحالة: تم التأكيد — الإعلان يصل للناس الآن!\n` +
          `📅 مدة التعزيز: 30 يوماً\n` +
          `━━━━━━━━━━━━━━━━━\n` +
          `شكراً لثقتك في سوق ماركات 🙏`;
        await db.execute(sql`
          INSERT INTO direct_messages (from_user_id, to_user_id, ad_id, message, is_voice)
          VALUES (${ADMIN_USER_ID}, ${order.user_id}, ${order.ad_id}, ${confirmMsg}, false)
        `);
      } else if (status === 'rejected') {
        await createNotification(order.user_id, "system",
          `❌ طلب التعزيز مرفوض`,
          `رقم الطلب ${order.order_number} — للاستفسار تواصل مع الإدارة.`,
          `/ads/${order.ad_id}`
        );
        // DM rejection to user
        const rejectMsg =
          `❌ تم رفض طلب التعزيز\n` +
          `━━━━━━━━━━━━━━━━━\n` +
          `📋 رقم الطلب: ${order.order_number}\n` +
          `📢 رقم الإعلان: #${order.ad_id}\n` +
          `💰 المبلغ: ${order.amount} ج.م\n` +
          `━━━━━━━━━━━━━━━━━\n` +
          `للاستفسار تواصل مع الإدارة مباشرة.`;
        await db.execute(sql`
          INSERT INTO direct_messages (from_user_id, to_user_id, ad_id, message, is_voice)
          VALUES (${ADMIN_USER_ID}, ${order.user_id}, ${order.ad_id}, ${rejectMsg}, false)
        `);
      }

      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // GET boost settings (public — so the button can show price)
  app.get("/api/boost/settings", async (_req, res) => {
    try {
      const rows = await db.execute(
        sql`SELECT key, value FROM platform_settings WHERE key IN ('boost_enabled','boost_price_egp')`
      );
      const map: Record<string, string> = {};
      (rows.rows as any[]).forEach((r: any) => { map[r.key] = r.value; });
      res.json({
        enabled: map["boost_enabled"] !== "0",
        price: parseFloat(map["boost_price_egp"] || "0"),
        currency: "EGP",
      });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/ads/:id/boost-notify", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const adId = parseInt(req.params.id);
    try {
      const ad = await storage.getAd(adId);
      if (!ad) return res.status(404).json({ message: "الإعلان غير موجود" });
      if (ad.userId !== userId) return res.status(403).json({ message: "غير مصرح" });

      // Check admin setting: boost_enabled
      const boostEnabledRow = await db.execute(sql`SELECT value FROM platform_settings WHERE key = 'boost_enabled' LIMIT 1`);
      const boostEnabled = boostEnabledRow.rows.length === 0 || (boostEnabledRow.rows[0] as any).value !== "0";
      if (!boostEnabled) {
        return res.status(403).json({ message: "خاصية التعزيز معطّلة حالياً من قِبل الإدارة" });
      }

      // Check boost price and duration
      const boostPriceRow = await db.execute(sql`SELECT value FROM platform_settings WHERE key = 'boost_price_egp' LIMIT 1`);
      const boostPrice = parseFloat((boostPriceRow.rows[0] as any)?.value || "0");
      const boostDurRow = await db.execute(sql`SELECT value FROM platform_settings WHERE key = 'boost_duration_days' LIMIT 1`);
      const boostDays = parseInt((boostDurRow.rows[0] as any)?.value || "30");

      // Rate limit: check last boost time — max once per 30 days if boost is free
      // If boostPrice > 0, ALL boosts require wallet deduction (no free limit)
      const lastBoost = await db.execute(
        sql`SELECT created_at FROM notifications
            WHERE link = ${`/ads/${adId}`} AND title LIKE '%🚀%'
            ORDER BY created_at DESC LIMIT 1`
      );

      if (boostPrice <= 0 && lastBoost.rows.length > 0) {
        // Free boost: enforce rate limit equal to boost duration
        const last = new Date((lastBoost.rows[0] as any).created_at);
        const daysAgo = (Date.now() - last.getTime()) / 86_400_000;
        if (daysAgo < boostDays) {
          const daysLeft = Math.ceil(boostDays - daysAgo);
          return res.status(429).json({ message: `يمكنك تعزيز هذا الإعلان مرة واحدة كل ${boostDays} يوم. الأيام المتبقية: ${daysLeft} يوم` });
        }
      }

      // Paid boost: always require wallet deduction (every boost costs boostPrice EGP)
      if (boostPrice > 0) {
        const boostClient = await pool.connect();
        try {
          await boostClient.query("BEGIN");
          // Lock user row to prevent concurrent overdraft
          const walletR = await boostClient.query(`SELECT balance_egp FROM users WHERE id = $1 FOR UPDATE`, [userId]);
          const balance = parseFloat(walletR.rows[0]?.balance_egp || "0");
          if (balance < boostPrice) {
            await boostClient.query("ROLLBACK");
            return res.status(402).json({
              requiresWalletTopup: true,
              price: boostPrice,
              balance,
              message: `رصيد محفظتك غير كافٍ (${balance} ج.م). التعزيز يكلف ${boostPrice} ج.م — اشحن محفظتك أولاً`,
            });
          }
          // Use conditional deduction: only deduct if balance is still sufficient (extra safety)
          const deductR = await boostClient.query(
            `UPDATE users SET balance_egp = COALESCE(balance_egp, 0) - $1
             WHERE id = $2 AND COALESCE(balance_egp, 0) >= $1
             RETURNING balance_egp`,
            [boostPrice, userId]
          );
          if (deductR.rowCount === 0) {
            await boostClient.query("ROLLBACK");
            return res.status(402).json({
              requiresWalletTopup: true,
              price: boostPrice,
              message: `رصيد محفظتك غير كافٍ. التعزيز يكلف ${boostPrice} ج.م — اشحن محفظتك أولاً`,
            });
          }
          // Log to wallet_transactions ledger for auditability
          await boostClient.query(
            `INSERT INTO wallet_transactions (user_id, type, amount_egp, description, ref_id)
             VALUES ($1, 'boost_debit', $2, $3, $4)`,
            [userId, boostPrice, `تعزيز إعلان #${adId}`, String(adId)]
          );
          await boostClient.query("COMMIT");
        } catch (txErr) {
          await boostClient.query("ROLLBACK");
          throw txErr;
        } finally {
          boostClient.release();
        }
      }

      // ✅ Activate boost on the ad using duration from platform_settings
      await pool.query(
        `UPDATE ads SET is_boosted = true, boosted_until = NOW() + INTERVAL '1 day' * $1 WHERE id = $2`,
        [boostDays, adId]
      );

      const publisherName = req.user.claims?.first_name || "معلن";
      const adLink = `/ads/${adId}`;
      const notifTitle = `🚀 إعلان مميز من ${publisherName}`;
      const notifBody = ad.title ? `✨ "${ad.title}" — عرض مميز لا تفوّته!` : "✨ عرض مميز قد يهمك — شاهده الآن";
      let notifiedCount = 0;
      const boostNotified = new Set<string>([userId]); // never notify self

      // Boost = paid reach → notify ALL users (up to 1000)
      const allRows = await db.execute(
        sql`SELECT id FROM users WHERE id != ${userId} LIMIT 1000`
      );
      for (const row of allRows.rows as any[]) {
        const uid = (row as any).id;
        if (!boostNotified.has(uid)) {
          await createNotification(uid, "system", notifTitle, notifBody, adLink);
          boostNotified.add(uid);
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
    const { recordingUrl } = (req.body || {});
    const updateData: any = { status: 'ended', endedAt: new Date() };
    if (recordingUrl) updateData.recordingUrl = recordingUrl;
    const updated = await storage.updateLiveStream(Number(req.params.id), updateData);

    // ── Notify followers that stream ended (with replay link if available) ──
    (async () => {
      try {
        if (stream.channelId) {
          const broadcasterName = req.user.claims?.first_name || "المذيع";
          const streamLink = `/streams/${stream.id}`;
          const hasReplay = !!recordingUrl;
          const notifTitle = `📴 ${broadcasterName} أنهى البث المباشر`;
          const notifBody = hasReplay
            ? `"${stream.title || 'البث'}" — يمكنك مشاهدة التسجيل الآن!`
            : `"${stream.title || 'البث'}" انتهى — شكراً لمشاهدتك`;
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
        console.error('[Stream End Notify] Error:', e);
      }
    })();

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

  // ── Generate / Get RTMP stream key ──────────────────────────────
  app.post("/api/streams/:id/key", isAuthenticated, async (req: any, res) => {
    try {
      const streamId = Number(req.params.id);
      const stream = await storage.getLiveStream(streamId);
      if (!stream || stream.userId !== req.user.claims.sub) return res.status(403).json({ message: "Forbidden" });
      const { randomBytes } = await import("crypto");
      const key = `${streamId}-${randomBytes(12).toString("hex")}`;
      await db.execute(sql`UPDATE live_streams SET stream_key = ${key}, stream_mode = 'rtmp' WHERE id = ${streamId}`);
      res.json({ streamKey: key, rtmpUrl: "rtmp://ads-as.com/live", hlsUrl: `/hls/live/${key}/index.m3u8` });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/streams/:id/key", isAuthenticated, async (req: any, res) => {
    try {
      const streamId = Number(req.params.id);
      const row = await db.execute(sql`SELECT stream_key, stream_mode FROM live_streams WHERE id = ${streamId} AND user_id = ${req.user.claims.sub}`);
      if (!row.rows.length) return res.status(403).json({ message: "Forbidden" });
      const r = row.rows[0] as any;
      if (!r.stream_key) return res.json({ streamKey: null });
      res.json({ streamKey: r.stream_key, rtmpUrl: "rtmp://ads-as.com/live", hlsUrl: `/hls/live/${r.stream_key}/index.m3u8`, streamMode: r.stream_mode });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/streams/:id/hls-status", async (req, res) => {
    try {
      const row = await db.execute(sql`SELECT stream_key FROM live_streams WHERE id = ${Number(req.params.id)}`);
      if (!row.rows.length) return res.json({ live: false });
      const key = (row.rows[0] as any).stream_key;
      if (!key) return res.json({ live: false });
      const { isStreamLive } = await import("./rtmp");
      res.json({ live: isStreamLive(key), hlsUrl: `/hls/live/${key}/index.m3u8` });
    } catch {
      res.json({ live: false });
    }
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
      // Deliver web push if user has subscriptions
      const subs = await db.execute(sql`SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ${userId}`);
      for (const sub of subs.rows as any[]) {
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title, body, link: link ?? "/" })
        ).catch(() => {
          // Remove expired/invalid subscription silently
          db.execute(sql`DELETE FROM push_subscriptions WHERE endpoint = ${sub.endpoint}`).catch(() => {});
        });
      }
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
    const feed = req.query.feed as string | undefined;
    const authUserId = req.user?.claims?.sub;

    const enrichReels = async (rows: any[]) => {
      if (!rows.length) return rows;
      const getChannelId = (r: any) => r.channelId ?? r.channel_id ?? null;
      const channelIds = [...new Set(rows.map(getChannelId).filter(Boolean))];
      let channelMap: Record<number, { name: string; avatarUrl: string | null }> = {};
      if (channelIds.length) {
        const chRows = await db.execute(sql`SELECT id, name, avatar_url FROM channels WHERE id = ANY(ARRAY[${sql.raw(channelIds.join(','))}])`);
        for (const ch of chRows.rows as any[]) {
          channelMap[ch.id] = { name: ch.name, avatarUrl: ch.avatar_url };
        }
      }
      return rows.map(r => {
        const cid = getChannelId(r);
        return {
          id: r.id, userId: r.userId ?? r.user_id, channelId: cid,
          title: r.title, description: r.description, videoUrl: r.videoUrl ?? r.video_url,
          audioUrl: r.audioUrl ?? r.audio_url, thumbnailUrl: r.thumbnailUrl ?? r.thumbnail_url,
          duration: r.duration, viewsCount: r.viewsCount ?? r.views_count ?? 0,
          likesCount: r.likesCount ?? r.likes_count ?? 0, commentsCount: r.commentsCount ?? r.comments_count ?? 0,
          status: r.status, createdAt: r.createdAt ?? r.created_at,
          channelName: cid && channelMap[cid] ? channelMap[cid].name : null,
          channelAvatar: cid && channelMap[cid] ? channelMap[cid].avatarUrl : null,
        };
      });
    };

    if (feed === 'following' && authUserId) {
      const followedChannelRows = await db.execute(sql`SELECT channel_id FROM follows WHERE follower_id = ${authUserId}`);
      const channelIds = (followedChannelRows.rows as any[]).map(r => r.channel_id);
      if (!channelIds.length) return res.json([]);
      const rows = await db.execute(sql`SELECT * FROM reels WHERE status = 'active' AND channel_id = ANY(ARRAY[${sql.raw(channelIds.join(','))}]) ORDER BY created_at DESC LIMIT 50`);
      return res.json(await enrichReels(rows.rows));
    }
    if (myReels && authUserId) {
      const reels = await storage.getReels(authUserId);
      return res.json(await enrichReels(reels));
    }
    if (filterUserId) {
      const reels = await storage.getReels(filterUserId);
      return res.json(await enrichReels(reels));
    }
    const reels = await storage.getReels();
    res.json(await enrichReels(reels));
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
    const ctr = (campaign.impressions ?? 0) > 0 ? (((campaign.clicks ?? 0) / (campaign.impressions ?? 1)) * 100).toFixed(2) : '0';
    const cpmEGP = campaign.cpmRateEGP || 15;
    const cpcEGP = (campaign.clicks ?? 0) > 0 ? ((campaign.spentEGP || 0) / (campaign.clicks ?? 1)).toFixed(2) : '0';
    res.json({ ...campaign, ctr, cpmEGP, cpcEGP });
  });

  // ─── MY PERSONAL ANALYTICS ───────────────────────────────────
  app.get("/api/my/analytics", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    try {
      const [campaignStats, dailyCampaign, channelStats, dailyChannel] = await Promise.all([
        pool.query(`
          SELECT
            COUNT(*) as total_campaigns,
            COALESCE(SUM(impressions), 0) as total_impressions,
            COALESCE(SUM(clicks), 0) as total_clicks,
            COALESCE(SUM(spent_egp), 0) as total_spent,
            COALESCE(SUM(budget_egp), 0) as total_budget,
            COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN impressions ELSE 0 END), 0) as imp_7d,
            COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL '14 days' AND created_at < NOW() - INTERVAL '7 days' THEN impressions ELSE 0 END), 0) as imp_prev_7d,
            COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN clicks ELSE 0 END), 0) as clicks_7d,
            COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL '14 days' AND created_at < NOW() - INTERVAL '7 days' THEN clicks ELSE 0 END), 0) as clicks_prev_7d,
            COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN spent_egp ELSE 0 END), 0) as spent_7d,
            COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL '14 days' AND created_at < NOW() - INTERVAL '7 days' THEN spent_egp ELSE 0 END), 0) as spent_prev_7d
          FROM ad_campaigns WHERE advertiser_id = $1
        `, [userId]),
        pool.query(`
          SELECT TO_CHAR(ai.created_at, 'YYYY-MM-DD') as day,
            COUNT(*) FILTER (WHERE ai.event_type = 'impression' AND ai.is_fraud = false) as impressions,
            COUNT(*) FILTER (WHERE ai.event_type = 'click' AND ai.is_fraud = false) as clicks,
            COALESCE(SUM(rt.amount_egp), 0) as spent
          FROM ad_campaigns ac
          LEFT JOIN ad_impressions ai ON ai.campaign_id = ac.id AND ai.created_at >= NOW() - INTERVAL '14 days'
          LEFT JOIN revenue_transactions rt ON rt.campaign_id = ac.id AND rt.type = 'spending' AND rt.created_at >= NOW() - INTERVAL '14 days'
          WHERE ac.advertiser_id = $1 AND ai.id IS NOT NULL
          GROUP BY day ORDER BY day
        `, [userId]),
        pool.query(`
          SELECT c.id, c.name,
            COALESCE(c.earnings_egp, 0) as total_earnings,
            c.subscriber_count,
            COALESCE(SUM(rt.amount_egp) FILTER (WHERE rt.created_at >= NOW() - INTERVAL '7 days'), 0) as earnings_7d,
            COALESCE(SUM(rt.amount_egp) FILTER (WHERE rt.created_at >= NOW() - INTERVAL '14 days' AND rt.created_at < NOW() - INTERVAL '7 days'), 0) as earnings_prev_7d,
            COUNT(ai.id) FILTER (WHERE ai.event_type = 'impression' AND ai.is_fraud = false AND ai.created_at >= NOW() - INTERVAL '7 days') as imp_7d,
            COUNT(ai.id) FILTER (WHERE ai.event_type = 'click' AND ai.is_fraud = false AND ai.created_at >= NOW() - INTERVAL '7 days') as clicks_7d
          FROM channels c
          LEFT JOIN revenue_transactions rt ON rt.channel_id = c.id AND rt.type = 'earning'
          LEFT JOIN ad_impressions ai ON ai.channel_id = c.id
          WHERE c.user_id = $1
          GROUP BY c.id, c.name, c.earnings_egp, c.subscriber_count
        `, [userId]),
        pool.query(`
          SELECT TO_CHAR(rt.created_at, 'YYYY-MM-DD') as day,
            COALESCE(SUM(rt.amount_egp), 0) as earnings,
            COUNT(ai.id) FILTER (WHERE ai.event_type = 'impression' AND ai.is_fraud = false) as impressions,
            COUNT(ai.id) FILTER (WHERE ai.event_type = 'click' AND ai.is_fraud = false) as clicks
          FROM channels c
          LEFT JOIN revenue_transactions rt ON rt.channel_id = c.id AND rt.type = 'earning' AND rt.created_at >= NOW() - INTERVAL '14 days'
          LEFT JOIN ad_impressions ai ON ai.channel_id = c.id AND ai.created_at >= NOW() - INTERVAL '14 days'
          WHERE c.user_id = $1 AND rt.id IS NOT NULL
          GROUP BY day ORDER BY day
        `, [userId]),
      ]);

      const cs = campaignStats.rows[0] || {};
      const channels = channelStats.rows || [];
      const totalEarnings7d = channels.reduce((s: number, c: any) => s + parseFloat(c.earnings_7d || 0), 0);
      const totalEarningsPrev7d = channels.reduce((s: number, c: any) => s + parseFloat(c.earnings_prev_7d || 0), 0);
      const totalImp7d = channels.reduce((s: number, c: any) => s + parseInt(c.imp_7d || 0), 0);
      const totalClicks7d = channels.reduce((s: number, c: any) => s + parseInt(c.clicks_7d || 0), 0);

      res.json({
        advertiser: {
          totalCampaigns: parseInt(cs.total_campaigns) || 0,
          totalImpressions: parseInt(cs.total_impressions) || 0,
          totalClicks: parseInt(cs.total_clicks) || 0,
          totalSpent: parseFloat(cs.total_spent) || 0,
          totalBudget: parseFloat(cs.total_budget) || 0,
          imp7d: parseInt(cs.imp_7d) || 0,
          impPrev7d: parseInt(cs.imp_prev_7d) || 0,
          clicks7d: parseInt(cs.clicks_7d) || 0,
          clicksPrev7d: parseInt(cs.clicks_prev_7d) || 0,
          spent7d: parseFloat(cs.spent_7d) || 0,
          spentPrev7d: parseFloat(cs.spent_prev_7d) || 0,
          dailyChart: dailyCampaign.rows.map((r: any) => ({
            day: r.day, dayLabel: (r.day || '').slice(5),
            impressions: parseInt(r.impressions) || 0,
            clicks: parseInt(r.clicks) || 0,
            spent: parseFloat(r.spent) || 0,
          })),
        },
        publisher: {
          channels,
          totalEarnings7d,
          totalEarningsPrev7d,
          totalImp7d,
          totalClicks7d,
          dailyChart: dailyChannel.rows.map((r: any) => ({
            day: r.day, dayLabel: (r.day || '').slice(5),
            earnings: parseFloat(r.earnings) || 0,
            impressions: parseInt(r.impressions) || 0,
            clicks: parseInt(r.clicks) || 0,
          })),
        },
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
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

  // Admin: create promo ad
  app.post("/api/admin/promo-ads", isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const { title, description, mediaUrl, mediaType, priceEGP, whatsappNumber } = req.body;
      if (!title || !description || !mediaUrl || !mediaType) return res.status(400).json({ message: "بيانات ناقصة" });
      const adminId = req.user.id;
      const result = await db.execute(sql`
        INSERT INTO ads (title, description, media_url, media_type, user_id, price_egp, whatsapp_number, is_admin_promo, status, language, expires_at)
        VALUES (${title}, ${description}, ${mediaUrl}, ${mediaType}, ${adminId}, ${priceEGP || null}, ${whatsappNumber || null}, true, 'active', 'ar', NOW() + INTERVAL '7 days')
        RETURNING id
      `);
      res.json({ success: true, id: (result.rows[0] as any).id });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Admin: list promo ads
  app.get("/api/admin/promo-ads", isAuthenticated, requireAdmin, async (_req, res) => {
    try {
      const result = await db.execute(sql`SELECT * FROM ads WHERE is_admin_promo = true ORDER BY created_at DESC`);
      res.json(result.rows);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Admin: delete promo ad
  app.delete("/api/admin/promo-ads/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
      await db.execute(sql`DELETE FROM ads WHERE id = ${id} AND is_admin_promo = true`);
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
      const userId = req.user.claims.sub;
      // Generate unique order number: ORD-YYYYMMDD-XXXX
      const now = new Date();
      const datePart = now.toISOString().slice(0,10).replace(/-/g,"");
      const rand = Math.floor(1000 + Math.random() * 9000);
      const orderNumber = `ORD-${datePart}-${rand}`;
      const input = insertPaymentRequestSchema.parse({
        ...req.body,
        userId,
        orderNumber,
      });
      const payment = await storage.createPaymentRequest(input);

      // ── Notify both admins about new payment request ──
      try {
        const userR = await pool.query(`SELECT first_name, last_name FROM users WHERE id = $1`, [userId]);
        const userName = `${userR.rows[0]?.first_name || ""} ${userR.rows[0]?.last_name || ""}`.trim() || userId;
        const methodLabels: Record<string, string> = {
          vodafone: "فودافون كاش", etisalat: "اتصالات e& كاش",
          instapay: "InstaPay", souq: "سوق ماركات", visa_bank: "تحويل بنكي",
        };
        const methodLabel = methodLabels[input.method] || input.method;
        const svcLabel = input.serviceType ? ` — ${input.serviceType}` : "";
        for (const adminId of [ADMIN_USER_ID, ADMIN_USER_ID2]) {
          await createNotification(adminId, "payment",
            `💳 طلب دفع جديد`,
            `${userName} — ${input.amountEGP} ج.م عبر ${methodLabel}${svcLabel}`,
            "/admin"
          );
        }
      } catch (_) {}

      res.status(201).json(payment);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // ── Helper: activate service after payment approval ──
  async function activateServiceForPayment(p: any) {
    if (!p || p.type !== 'top_up') return;
    const svcType   = (p.serviceType || "").split(",")[0].trim();
    const adId      = p.adId ? Number(p.adId) : null;
    const userId    = p.userId;

    try {
      if (svcType === 'ad_boost' && adId) {
        const durR = await db.execute(sql`SELECT value FROM platform_settings WHERE key = 'boost_duration_days' LIMIT 1`);
        const durDays = parseInt((durR.rows[0] as any)?.value || "30");
        await pool.query(
          `UPDATE ads SET is_boosted = true, boosted_until = NOW() + INTERVAL '1 day' * $1 WHERE id = $2`,
          [durDays, adId]
        );
        await createNotification(userId, 'system', '⚡ تم تعزيز إعلانك!',
          `إعلانك #${adId} أصبح مميزاً في الصدارة لمدة 30 يوماً`, `/ads/${adId}`);
      } else if ((svcType === 'renewal' || svcType === 'renewal_30') && adId) {
        const renewDays = svcType === 'renewal' ? 7 : 30;
        await pool.query(
          `UPDATE ads SET status = 'active', expires_at = GREATEST(COALESCE(expires_at, NOW()), NOW()) + INTERVAL '1 day' * $2 WHERE id = $1`,
          [adId, renewDays]
        );
        await createNotification(userId, 'system', '🔄 تم تجديد إعلانك!',
          `إعلانك #${adId} تم تجديده لمدة ${renewDays} يوماً إضافية`, `/ads/${adId}`);
      } else if (svcType === 'ai_credits') {
        const creditsRow = await pool.query(
          `SELECT value FROM platform_settings WHERE key = 'ai_free_credits' LIMIT 1`
        );
        const credits = parseInt(creditsRow.rows[0]?.value || '3');
        await pool.query(
          `INSERT INTO ai_usage (user_id, credits_used, credits_limit)
           VALUES ($1, 0, $2)
           ON CONFLICT (user_id) DO UPDATE SET credits_limit = ai_usage.credits_limit + $2`,
          [userId, credits]
        );
        await createNotification(userId, 'system', '🤖 تم إضافة رصيد AI!',
          `تمت إضافة ${credits} كريديت للذكاء الاصطناعي لحسابك`, '/create');
      } else {
        // Generic: just notify
        await createNotification(userId, 'payment', '✅ تم تفعيل خدمتك!',
          `تم تفعيل خدمة "${svcType}" — رقم الطلب: ${p.orderNumber}`, '/payments');
      }
    } catch (e: any) {
      console.error('[activateService] error:', e?.message);
    }
  }

  app.put("/api/payments/:id", isAuthenticated, requireAdmin, async (req: any, res) => {
    const { status, adminNote } = req.body;
    const payment = await storage.updatePaymentRequest(Number(req.params.id), status, adminNote);
    if (status === 'approved' || status === 'rejected') {
      const pr = await storage.getPaymentRequests(undefined);
      const p = pr.find(x => x.id === Number(req.params.id));
      if (p) {
        if (status === 'approved') {
          if (p.type === 'withdrawal') {
            await storage.createTransaction({
              userId: p.userId,
              type: 'withdrawal',
              amountEGP: p.amountEGP,
              description: `سحب رصيد - ${p.method}`,
              channelId: null,
              campaignId: null,
            });
          } else if (p.type === 'top_up') {
            await storage.createTransaction({
              userId: p.userId,
              type: 'earning',
              amountEGP: p.amountEGP,
              description: `شحن رصيد - ${p.method}`,
              channelId: null,
              campaignId: null,
            });
          }
          // ── Auto-activate the paid service ──
          await activateServiceForPayment(p);
          await createNotification(
            p.userId,
            'payment',
            '✅ تم قبول طلب الدفع وتفعيل الخدمة',
            `رقم الطلب ${p.orderNumber} — تمت الموافقة وتفعيل الخدمة تلقائياً`,
            '/payments'
          );
        } else {
          await createNotification(
            p.userId,
            'payment',
            '❌ تم رفض طلب الدفع',
            `رقم الطلب ${p.orderNumber} — تم رفض الطلب. ${adminNote || 'للاستفسار تواصل مع الإدارة.'}`,
            '/payments'
          );
        }
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

  // ── Stream content report (viewer → flags violation) ─────────────────
  app.post("/api/streams/:id/report", isAuthenticated, async (req: any, res) => {
    try {
      const streamId = Number(req.params.id);
      const userId   = req.user.claims.sub as string;
      const { reason } = req.body as { reason: string };
      if (!reason) return res.status(400).json({ message: "reason required" });

      // Insert into generic reports table (targetType = 'stream')
      await db.execute(sql`
        INSERT INTO reports (reporter_id, target_type, target_id, reason, status)
        VALUES (${userId}, 'stream', ${streamId}, ${reason}, 'pending')
        ON CONFLICT DO NOTHING
      `);

      // Count total unique-reporter reports for this stream
      const countRes = await db.execute(sql`
        SELECT COUNT(DISTINCT reporter_id) as cnt
        FROM reports
        WHERE target_type = 'stream' AND target_id = ${streamId} AND status = 'pending'
      `);
      const reportCount = Number((countRes.rows[0] as any)?.cnt || 0);

      // 3+ reports → emit warning to broadcaster
      if (reportCount >= 3 && reportCount < 5) {
        io.to(`stream:${streamId}`).emit("stream-content-warning", {
          count: reportCount,
          message: "⚠️ تلقّى بثّك عدة بلاغات بسبب محتوى مخالف. يرجى الالتزام بسياسة المنصة."
        });
      }
      // 5+ reports → force-end the stream
      if (reportCount >= 5) {
        await storage.updateLiveStream(streamId, { status: 'ended' });
        io.to(`stream:${streamId}`).emit("stream-force-ended", {
          reason: "أُغلق البث بسبب بلاغات متعددة عن محتوى مخالف لسياسة المنصة."
        });
      }

      res.json({ ok: true, reportCount });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Admin: get pending stream reports ────────────────────────────────
  app.get("/api/admin/stream-reports", isAuthenticated, requireAdmin, async (_req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT
          r.id, r.reporter_id, r.target_id as stream_id, r.reason,
          r.status, r.created_at,
          ls.title as stream_title, ls.status as stream_status,
          ls.user_id as broadcaster_id,
          COUNT(*) OVER (PARTITION BY r.target_id) as total_reports
        FROM reports r
        LEFT JOIN live_streams ls ON ls.id = r.target_id
        WHERE r.target_type = 'stream'
        ORDER BY r.created_at DESC
        LIMIT 200
      `);
      res.json(result.rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Admin: warn broadcaster via socket ───────────────────────────────
  app.post("/api/admin/streams/:id/warn", isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const streamId = Number(req.params.id);
      const { message } = req.body as { message?: string };
      io.to(`stream:${streamId}`).emit("stream-content-warning", {
        count: 99,
        message: message || "⚠️ تحذير من الإدارة: يرجى الالتزام بسياسة المنصة وإزالة المحتوى المخالف فوراً."
      });
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Admin: force-close a live stream ────────────────────────────────
  app.post("/api/admin/streams/:id/force-end", isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const streamId = Number(req.params.id);
      const { reason } = req.body as { reason?: string };
      await storage.updateLiveStream(streamId, { status: 'ended' });
      io.to(`stream:${streamId}`).emit("stream-force-ended", {
        reason: reason || "أُغلق البث من قِبَل الإدارة بسبب انتهاك سياسة المنصة."
      });
      // Mark all pending reports for this stream as resolved
      await db.execute(sql`
        UPDATE reports SET status='resolved'
        WHERE target_type='stream' AND target_id=${streamId} AND status='pending'
      `);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ================================================================
  // ADMIN PANEL ROUTES (admin only)
  // ================================================================
  app.get("/api/admin/stats", isAuthenticated, requireAdmin, async (req: any, res) => {
    const stats = await storage.getStats();
    const usersResult = await db.execute(sql`SELECT COUNT(*) as cnt FROM users`);
    const totalUsers = Number((usersResult.rows[0] as any)?.cnt || 0);
    res.json({ ...stats, totalUsers });
  });

  // ── Pending Counts for Admin Badges ──────────────────────────
  app.get("/api/admin/pending-counts", isAuthenticated, requireAdmin, async (_req, res) => {
    try {
      const [paymentsRes, topupsRes, adsRes, boostRes, renewalRes] = await Promise.all([
        pool.query(`SELECT COUNT(*) as cnt FROM payment_requests WHERE status = 'pending'`),
        pool.query(`SELECT COUNT(*) as cnt FROM wallet_top_up_orders WHERE status = 'pending'`),
        pool.query(`SELECT COUNT(*) as cnt FROM ads WHERE status = 'pending'`),
        pool.query(`SELECT COUNT(*) as cnt FROM boost_orders WHERE status = 'pending'`),
        pool.query(`SELECT COUNT(*) as cnt FROM renewal_orders WHERE status = 'pending'`),
      ]);
      res.json({
        payments:      Number(paymentsRes.rows[0]?.cnt || 0),
        walletcharges: Number(topupsRes.rows[0]?.cnt || 0),
        ads:           Number(adsRes.rows[0]?.cnt || 0),
        boostorders:   Number(boostRes.rows[0]?.cnt || 0),
        renewalorders: Number(renewalRes.rows[0]?.cnt || 0),
      });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Wallet Revenue Summary ────────────────────────────────────
  app.get("/api/admin/wallet-stats", isAuthenticated, requireAdmin, async (_req, res) => {
    try {
      const [topupRes, spendRes, balanceRes, pendingRes, recentRes] = await Promise.all([
        // Total approved top-ups (money received from clients)
        pool.query(`
          SELECT COALESCE(SUM(amount_egp),0) as total_approved,
                 COUNT(*) FILTER (WHERE status='approved') as count_approved
          FROM wallet_top_up_orders WHERE status = 'approved'
        `),
        // Total spent from wallets on platform services
        pool.query(`
          SELECT COALESCE(SUM(amount_egp),0) as total_spent
          FROM wallet_transactions WHERE type IN ('boost_debit','renewal_debit','ai_debit')
        `),
        // Total balance currently sitting in all wallets
        pool.query(`
          SELECT COALESCE(SUM(balance_egp),0) as total_wallet_balance, COUNT(*) as users_with_balance
          FROM users WHERE balance_egp > 0
        `),
        // Pending top-up requests
        pool.query(`
          SELECT COALESCE(SUM(amount_egp),0) as pending_amount, COUNT(*) as pending_count
          FROM wallet_top_up_orders WHERE status = 'pending'
        `),
        // Last 10 approved top-ups
        pool.query(`
          SELECT o.order_number, o.amount_egp, o.payment_method, o.created_at,
                 u.first_name, u.last_name
          FROM wallet_top_up_orders o
          LEFT JOIN users u ON u.id = o.user_id
          WHERE o.status = 'approved'
          ORDER BY o.created_at DESC LIMIT 10
        `),
      ]);

      const t = topupRes.rows[0] as any;
      const s = spendRes.rows[0] as any;
      const b = balanceRes.rows[0] as any;
      const p = pendingRes.rows[0] as any;

      res.json({
        totalCollectedEGP:    Number(t.total_approved),
        totalApprovedCount:   Number(t.count_approved),
        totalSpentEGP:        Number(s.total_spent),
        totalCurrentBalanceEGP: Number(b.total_wallet_balance),
        usersWithBalance:     Number(b.users_with_balance),
        pendingAmountEGP:     Number(p.pending_amount),
        pendingCount:         Number(p.pending_count),
        platformNetEGP:       Number(t.total_approved) - Number(b.total_wallet_balance),
        recentApproved:       recentRes.rows,
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
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

  // ── Admin: Ratings management ──────────────────────────────
  app.get("/api/admin/ratings", isAuthenticated, requireAdmin, async (req: any, res) => {
    const { type } = req.query;
    const { ratings } = await import("@shared/schema");
    const { db } = await import("./db");
    const { desc, eq } = await import("drizzle-orm");
    let query = db.select().from(ratings).orderBy(desc(ratings.createdAt)).$dynamic();
    if (type && type !== "all") {
      query = query.where(eq(ratings.targetType, type as string));
    }
    const rows = await query.limit(500);
    res.json(rows);
  });

  app.delete("/api/admin/ratings/:id", isAuthenticated, requireAdmin, async (req: any, res) => {
    const { ratings } = await import("@shared/schema");
    const { db } = await import("./db");
    const { eq } = await import("drizzle-orm");
    await db.delete(ratings).where(eq(ratings.id, Number(req.params.id)));
    res.json({ success: true });
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
    if (status === 'approved') {
      const pr = await storage.getPaymentRequests(undefined);
      const p = pr.find(x => x.id === Number(req.params.id));
      if (p) {
        await activateServiceForPayment(p);
        await createNotification(
          p.userId,
          'payment',
          '✅ تم قبول طلب الدفع وتفعيل الخدمة',
          `رقم الطلب ${p.orderNumber} — تمت الموافقة وتفعيل الخدمة تلقائياً`,
          '/payments'
        );
      }
    } else if (status === 'rejected') {
      const pr = await storage.getPaymentRequests(undefined);
      const p = pr.find(x => x.id === Number(req.params.id));
      if (p) {
        await createNotification(
          p.userId,
          'payment',
          '❌ تم رفض طلب الدفع',
          `رقم الطلب ${p.orderNumber} — ${adminNote || 'للاستفسار تواصل مع الإدارة.'}`,
          '/payments'
        );
      }
    }
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

  app.get("/api/admin/analytics", isAuthenticated, requireAdmin, async (_req: any, res) => {
    try {
      const [revSummary, impSummary, dailyRev, dailyImp, topChannels, topCampaigns] = await Promise.all([
        pool.query(`
          SELECT
            COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN amount_egp ELSE 0 END), 0) as rev_7d,
            COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL '14 days' AND created_at < NOW() - INTERVAL '7 days' THEN amount_egp ELSE 0 END), 0) as rev_prev_7d
          FROM revenue_transactions WHERE type = 'spending'
        `),
        pool.query(`
          SELECT
            COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days' AND event_type = 'impression' AND is_fraud = false) as imp_7d,
            COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '14 days' AND created_at < NOW() - INTERVAL '7 days' AND event_type = 'impression' AND is_fraud = false) as imp_prev_7d,
            COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days' AND event_type = 'click' AND is_fraud = false) as clicks_7d,
            COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '14 days' AND created_at < NOW() - INTERVAL '7 days' AND event_type = 'click' AND is_fraud = false) as clicks_prev_7d
          FROM ad_impressions
        `),
        pool.query(`
          SELECT TO_CHAR(created_at, 'YYYY-MM-DD') as day,
            COALESCE(SUM(amount_egp), 0) as revenue
          FROM revenue_transactions
          WHERE created_at >= NOW() - INTERVAL '14 days' AND type = 'spending'
          GROUP BY day ORDER BY day
        `),
        pool.query(`
          SELECT TO_CHAR(created_at, 'YYYY-MM-DD') as day,
            COUNT(*) FILTER (WHERE event_type = 'impression' AND is_fraud = false) as impressions,
            COUNT(*) FILTER (WHERE event_type = 'click' AND is_fraud = false) as clicks
          FROM ad_impressions
          WHERE created_at >= NOW() - INTERVAL '14 days'
          GROUP BY day ORDER BY day
        `),
        pool.query(`
          SELECT c.id, c.name, c.avatar_url,
            COUNT(ai.id) FILTER (WHERE ai.event_type = 'impression' AND ai.is_fraud = false) as impressions,
            COUNT(ai.id) FILTER (WHERE ai.event_type = 'click' AND ai.is_fraud = false) as clicks,
            COALESCE(SUM(rt.amount_egp), 0) as earnings_egp
          FROM channels c
          LEFT JOIN ad_impressions ai ON ai.channel_id = c.id AND ai.created_at >= NOW() - INTERVAL '7 days'
          LEFT JOIN revenue_transactions rt ON rt.channel_id = c.id AND rt.type = 'earning' AND rt.created_at >= NOW() - INTERVAL '7 days'
          GROUP BY c.id, c.name, c.avatar_url
          ORDER BY impressions DESC LIMIT 10
        `),
        pool.query(`
          SELECT ac.id, ac.name, ac.status,
            COALESCE(ac.impressions, 0) as impressions,
            COALESCE(ac.clicks, 0) as clicks,
            COALESCE(ac.spent_egp, 0) as spent_egp,
            COALESCE(ac.budget_egp, 0) as budget_egp,
            CASE WHEN COALESCE(ac.impressions,0) > 0 THEN ROUND((COALESCE(ac.clicks,0)::numeric / COALESCE(ac.impressions,1) * 100), 2) ELSE 0 END as ctr
          FROM ad_campaigns ac
          ORDER BY ac.impressions DESC NULLS LAST LIMIT 10
        `)
      ]);

      const r = revSummary.rows[0];
      const s = impSummary.rows[0];
      const rev7d = parseFloat(r.rev_7d) || 0;
      const revPrev7d = parseFloat(r.rev_prev_7d) || 0;
      const imp7d = parseInt(s.imp_7d) || 0;
      const impPrev7d = parseInt(s.imp_prev_7d) || 0;
      const clicks7d = parseInt(s.clicks_7d) || 0;
      const clicksPrev7d = parseInt(s.clicks_prev_7d) || 0;

      const ctr7d = imp7d > 0 ? (clicks7d / imp7d) * 100 : 0;
      const ctrPrev7d = impPrev7d > 0 ? (clicksPrev7d / impPrev7d) * 100 : 0;
      const rpm7d = imp7d > 0 ? (rev7d / imp7d) * 1000 : 0;
      const rpmPrev7d = impPrev7d > 0 ? (revPrev7d / impPrev7d) * 1000 : 0;

      const chartMap: Record<string, any> = {};
      dailyRev.rows.forEach((row: any) => {
        chartMap[row.day] = { ...chartMap[row.day], day: row.day, revenue: parseFloat(row.revenue) || 0 };
      });
      dailyImp.rows.forEach((row: any) => {
        chartMap[row.day] = { ...chartMap[row.day], day: row.day, impressions: parseInt(row.impressions) || 0, clicks: parseInt(row.clicks) || 0 };
      });
      const chartData = Object.values(chartMap).sort((a: any, b: any) => a.day.localeCompare(b.day));

      res.json({
        summary: { rev7d, revPrev7d, imp7d, impPrev7d, clicks7d, clicksPrev7d, ctr7d, ctrPrev7d, rpm7d, rpmPrev7d },
        chartData,
        topChannels: topChannels.rows,
        topCampaigns: topCampaigns.rows,
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
    if (typeof isBanned !== 'undefined') {
      await db.execute(sql`UPDATE users SET is_banned = ${isBanned} WHERE id = ${req.params.id}`);
    }
    if (role) {
      await db.execute(sql`UPDATE users SET role = ${role} WHERE id = ${req.params.id}`);
    }
    res.json({ success: true });
  });

  app.post("/api/admin/users/:id/reset-password", isAuthenticated, requireAdmin, async (req: any, res) => {
    await db.execute(sql`UPDATE users SET password_hash = NULL WHERE id = ${req.params.id}`);
    res.json({ success: true, message: "تم مسح كلمة المرور - سيُطلب من المستخدم إعداد كلمة مرور جديدة" });
  });

  app.get("/api/admin/users", isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned boolean DEFAULT false`);
      await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS role text DEFAULT 'user'`);
    } catch {}
    const search = req.query.search as string || '';
    const rows = await db.execute(sql`
      SELECT u.id, u.email, u.first_name, u.last_name, u.profile_image_url, u.created_at,
             COALESCE(u.phone, '') as phone,
             COALESCE(u.is_banned, false) as is_banned,
             COALESCE(u.role, 'user') as role,
             CASE WHEN u.password_hash IS NOT NULL THEN true ELSE false END as has_password,
             (SELECT COUNT(*) FROM ads WHERE user_id = u.id) as ads_count,
             (SELECT COUNT(*) FROM channels WHERE user_id = u.id) as channels_count,
             (SELECT COUNT(*) FROM reels WHERE user_id = u.id) as reels_count,
             (SELECT COALESCE(SUM(amount_egp),0) FROM revenue_transactions WHERE user_id = u.id AND type = 'earning') as total_earnings
      FROM users u
      WHERE (${search} = '' OR u.email ILIKE ${'%' + search + '%'} OR u.first_name ILIKE ${'%' + search + '%'} OR u.last_name ILIKE ${'%' + search + '%'} OR COALESCE(u.phone,'') ILIKE ${'%' + search + '%'})
      ORDER BY u.created_at DESC
      LIMIT 200`);
    res.json(rows.rows);
  });

  // ─── ADMIN MANAGEMENT ─────────────────────────────────────────
  // Only superadmins can manage admins

  app.get("/api/admin/admins", isAuthenticated, requireAdmin, async (req: any, res) => {
    if (!isSuperAdmin(req)) return res.status(403).json({ message: "superadmin only" });
    if (!_extraAdminLoaded) await loadExtraAdminIds();
    const extraIds = Array.from(_extraAdminIds);
    let extraUsers: any[] = [];
    if (extraIds.length > 0) {
      const idsLiteral = extraIds.map(id => `'${id.replace(/'/g,"''")}'`).join(",");
      const rows = await db.execute(sql.raw(`
        SELECT id, email, first_name, last_name, profile_image_url, phone, created_at
        FROM users WHERE id IN (${idsLiteral})`));
      extraUsers = rows.rows;
    }
    const hardcoded = [
      { id: ADMIN_USER_ID,  email: ADMIN_EMAIL,  superAdmin: true },
      { id: ADMIN_USER_ID2, email: ADMIN_EMAIL2, superAdmin: true },
    ];
    res.json({ hardcoded, extra: extraUsers });
  });

  app.post("/api/admin/admins/add", isAuthenticated, requireAdmin, async (req: any, res) => {
    if (!isSuperAdmin(req)) return res.status(403).json({ message: "superadmin only" });
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ message: "userId مطلوب" });
    if (!_extraAdminLoaded) await loadExtraAdminIds();
    _extraAdminIds.add(String(userId));
    await saveExtraAdminIds();
    res.json({ success: true, adminCount: _extraAdminIds.size });
  });

  app.post("/api/admin/admins/remove", isAuthenticated, requireAdmin, async (req: any, res) => {
    if (!isSuperAdmin(req)) return res.status(403).json({ message: "superadmin only" });
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ message: "userId مطلوب" });
    _extraAdminIds.delete(String(userId));
    await saveExtraAdminIds();
    res.json({ success: true });
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
        await createNotification(row.id, 'system', title, body, link || undefined);
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
      const { productName, targetAudience, adTitle, customPrompt, language } = req.body;
      const titleHint = adTitle ? ` عنوان الإعلان المقترح: "${adTitle}".` : '';
      const customHint = customPrompt ? ` معلومات إضافية عن المنتج والأسلوب المطلوب: "${customPrompt}".` : '';
      const sysMsg = language === 'ar'
        ? `أنت كاتب إعلانات محترف متخصص في السوق العربي. قواعدك الصارمة:
١- اكتب بلغة عربية فصيحة سليمة خالية تماماً من الأخطاء الإملائية والنحوية.
٢- استخدم أسلوباً تسويقياً جذاباً ومقنعاً يناسب الجمهور العربي.
٣- لا تستخدم كلمات أجنبية إلا إذا كانت اسم المنتج أو علامة تجارية.
٤- اجعل العناوين قصيرة وقوية، والأوصاف واضحة ومفصّلة.
٥- لا تضع أي تعليق خارج JSON المطلوب.`
        : `You are a professional copywriter. Write error-free, compelling ad copy.`;
      const userMsg = language === 'ar'
        ? `اكتب عنواناً ووصفاً إعلانياً جذاباً للمنتج التالي:\n- المنتج: "${productName}"\n- الجمهور المستهدف: "${targetAudience}"${titleHint}${customHint}\nأعد JSON بمفتاحين فقط: "title" (عنوان لا يتجاوز 10 كلمات) و"description" (وصف من 2-4 جمل).`
        : `Write a catchy ad for: "${productName}". Target: "${targetAudience}".${titleHint}${customHint} Return JSON with "title" and "description".`;
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: sysMsg },
          { role: "user", content: userMsg },
        ],
        response_format: { type: "json_object" },
      });
      const content = JSON.parse(response.choices[0]?.message?.content || "{}");
      await storage.recordAiUsage(userId, 'copy');
      if (req.aiChargeEGP) {
        await deductAiCharge(userId, req.aiChargeEGP, 'رسوم توليد نص بالذكاء الاصطناعي');
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
      const sysMsg = language === 'ar'
        ? `أنت كاتب محتوى تسويقي محترف. قواعدك:
١- اكتب بلغة عربية فصيحة سليمة تماماً، خالية من أي أخطاء إملائية أو نحوية.
٢- استخدم أسلوباً ${tone || 'رسمياً'} مناسباً للسوق العربي.
٣- نظّم المحتوى بفقرات واضحة مع عناوين فرعية إن لزم.
٤- لا تضع أي تعليق خارج JSON المطلوب.`
        : `You are a professional content writer. Write error-free, well-structured content.`;
      const userMsg = language === 'ar'
        ? `اكتب مقالة تسويقية احترافية عن: "${topic}". أعد JSON بمفتاحين: "title" (عنوان جذاب) و"content" (المقالة كاملة منظّمة بفقرات).`
        : `Write a professional marketing article about: "${topic}". Tone: ${tone || 'professional'}. Return JSON with "title" and "content".`;
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: sysMsg },
          { role: "user", content: userMsg },
        ],
        response_format: { type: "json_object" },
      });
      const content = JSON.parse(response.choices[0]?.message?.content || "{}");
      await storage.recordAiUsage(userId, 'article');
      if (req.aiChargeEGP) {
        await deductAiCharge(userId, req.aiChargeEGP, 'رسوم توليد مقالة بالذكاء الاصطناعي');
      }
      res.json({ ...content, creditsUsed: (req.aiUsageCount || 0) + 1 });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to generate article: " + error.message });
    }
  });

  app.post("/api/ai/generate-video-script", isAuthenticated, checkAiCredits, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { productName, adTitle, customPrompt, duration, language } = req.body;
      const titleHint = adTitle ? ` عنوان الإعلان: "${adTitle}".` : '';
      const customHint = customPrompt ? ` معلومات إضافية: "${customPrompt}".` : '';
      const sysMsg = language === 'ar'
        ? `أنت مخرج إعلانات ومؤلف سيناريو محترف متخصص في الإعلانات العربية. قواعدك:
١- اكتب جميع النصوص بلغة عربية فصيحة سليمة خالية تماماً من الأخطاء الإملائية والنحوية.
٢- التعليق الصوتي (voiceover) يكون بلغة عربية فصيحة جذابة وواضحة.
٣- أوصاف المشاهد (visual) تكون دقيقة واحترافية لتوجيه المصوّر.
٤- استخدم أسلوباً سينمائياً درامياً يستحوذ على الانتباه.
٥- لا تضع أي تعليق خارج JSON المطلوب.`
        : `You are a professional cinematographer and scriptwriter. Write error-free, compelling video ad scripts.`;
      const userMsg = language === 'ar'
        ? `اكتب سكريبت فيديو إعلاني سينمائي احترافي للمنتج: "${productName}"${titleHint}${customHint}\nمدة الفيديو: ${duration || 30} ثانية.\nأعد JSON بالمفاتيح التالية:\n- "title": عنوان الفيديو\n- "script": النص الكامل\n- "voiceover": التعليق الصوتي بالعربية الفصحى\n- "scenes": مصفوفة 4-6 مشاهد، كل مشهد يحتوي: "time" و"visual" و"narration" و"mood" و"transition"\n- "music": وصف الموسيقى التصويرية\n- "callToAction": دعوة للعمل`
        : `Write a cinematic video ad script for "${productName}"${titleHint}${customHint} (${duration || 30}s). Return JSON: "title", "script", "voiceover", "scenes" (4-6 with "time","visual","narration","mood","transition"), "music", "callToAction".`;
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: sysMsg },
          { role: "user", content: userMsg },
        ],
        response_format: { type: "json_object" },
      });
      const content = JSON.parse(response.choices[0]?.message?.content || "{}");
      await storage.recordAiUsage(userId, 'video_script');
      if (req.aiChargeEGP) {
        await deductAiCharge(userId, req.aiChargeEGP, 'رسوم توليد سكريبت فيديو');
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
      // Always save locally — b64_json or download from URL — so the image persists
      const b64 = response.data?.[0]?.b64_json;
      const imageUrl = response.data?.[0]?.url;
      const filename = `ai-img-${Date.now()}.png`;
      const savePath = path.join(process.cwd(), 'uploads', filename);
      if (b64) {
        fs.writeFileSync(savePath, Buffer.from(b64, 'base64'));
      } else if (imageUrl) {
        const imgRes = await fetch(imageUrl);
        const buf = Buffer.from(await imgRes.arrayBuffer());
        fs.writeFileSync(savePath, buf);
      } else {
        throw new Error("No image generated");
      }
      const finalUrl = `/uploads/${filename}`;
      await storage.recordAiUsage(userId, 'image');
      if (req.aiChargeEGP) {
        await deductAiCharge(userId, req.aiChargeEGP, 'رسوم توليد صورة بالذكاء الاصطناعي');
      }
      res.json({ url: finalUrl, creditsUsed: (req.aiUsageCount || 0) + 1 });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to generate image: " + error.message });
    }
  });

  // ─── AI ANALYZE IMAGE → generate ad copy ─────────────────────
  app.post("/api/ai/analyze-image", isAuthenticated, checkAiCredits, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { imageUrls, productName, targetAudience, language = "ar" } = req.body;
      if (!imageUrls || !imageUrls.length) return res.status(400).json({ message: "imageUrls مطلوب" });

      const imageContents: any[] = imageUrls.slice(0, 3).map((url: string) => {
        const fullUrl = url.startsWith('/') ? `https://${req.headers.host}${url}` : url;
        return { type: "image_url", image_url: { url: fullUrl, detail: "auto" } };
      });

      const systemPrompt = language === 'ar'
        ? `أنت خبير تسويق إبداعي متخصص في الإعلانات العربية. قواعدك الصارمة:
١- اكتب بلغة عربية فصيحة سليمة خالية تماماً من الأخطاء الإملائية والنحوية.
٢- حلّل الصور بدقة واستخرج أبرز مميزات المنتج.
٣- اكتب نصاً إعلانياً جذاباً ومقنعاً يستهدف الجمهور العربي.
٤- لا تضع أي تعليق خارج JSON المطلوب.`
        : `You are a creative marketing expert. Analyze images and create professional, error-free ad content.`;

      const userPrompt = language === 'ar'
        ? `حلّل هذه الصور واكتب إعلاناً احترافياً${productName ? ` للمنتج: ${productName}` : ''}${targetAudience ? `، الجمهور المستهدف: ${targetAudience}` : ''}.\nأعد JSON بمفتاحين فقط: "title" (عنوان جذاب ومختصر) و"description" (وصف إعلاني مقنع من 2-3 جمل).`
        : `Analyze these images and create a professional ad${productName ? ` for ${productName}` : ''}${targetAudience ? ` targeting ${targetAudience}` : ''}.\nReturn JSON: {"title": "...", "description": "..."}`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: [{ type: "text", text: userPrompt }, ...imageContents] }
        ],
        response_format: { type: "json_object" },
        max_tokens: 500,
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      await storage.recordAiUsage(userId, 'text');
      if (req.aiChargeEGP) {
        await deductAiCharge(userId, req.aiChargeEGP, 'رسوم تحليل صورة بالذكاء الاصطناعي');
      }
      res.json({ title: result.title || "", description: result.description || "" });
    } catch (error: any) {
      res.status(500).json({ message: "فشل تحليل الصورة: " + error.message });
    }
  });

  // ─── AI TEXT TO SPEECH ──────────────────────────────────────────
  app.post("/api/ai/text-to-speech", isAuthenticated, checkAiCredits, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { text, voice = "nova", speed = 1.0 } = req.body;
      if (!text) return res.status(400).json({ message: "النص مطلوب" });
      if (text.length > 4096) return res.status(400).json({ message: "النص طويل جداً (الحد الأقصى 4096 حرف)" });

      const validVoices = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];
      const safeVoice = validVoices.includes(voice) ? voice : "nova";
      const buffer = await textToSpeech(text, safeVoice as any, "mp3");
      const filename = `tts-${Date.now()}.mp3`;
      const savePath = path.join(process.cwd(), 'uploads', filename);
      fs.writeFileSync(savePath, buffer);
      const audioUrl = `/uploads/${filename}`;

      await storage.recordAiUsage(userId, 'tts');
      if (req.aiChargeEGP) {
        await deductAiCharge(userId, req.aiChargeEGP, 'رسوم توليد صوت بالذكاء الاصطناعي');
      }
      res.json({ audioUrl });
    } catch (error: any) {
      res.status(500).json({ message: "فشل توليد الصوت: " + error.message });
    }
  });

  // ─── D-ID TALKING PHOTO ─────────────────────────────────────────
  app.post("/api/ai/talking-photo", isAuthenticated, checkTalkingPhotoCredits, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { imageUrl, text, voiceId } = req.body;
      if (!imageUrl || !text) return res.status(400).json({ message: "imageUrl والنص مطلوبان" });

      const DID_API_KEY = process.env.DID_API_KEY;
      if (!DID_API_KEY) return res.status(503).json({ message: "خدمة الصورة الناطقة غير مفعّلة بعد. تواصل مع المسؤول." });

      // ─── Deduct BEFORE calling D-ID (pre-payment) ───────────────────
      if (req.talkingPhotoChargeEGP) {
        await deductAiCharge(userId, req.talkingPhotoChargeEGP, `رسوم إعلان متكلم بالذكاء الاصطناعي (D-ID) — ${req.talkingPhotoChargeEGP} ج.م`);
      }

      const imageFullUrl = imageUrl.startsWith('/') ? `https://${req.headers.host}${imageUrl}` : imageUrl;

      const createRes = await fetch("https://api.d-id.com/talks", {
        method: "POST",
        headers: {
          "Authorization": `Basic ${DID_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          source_url: imageFullUrl,
          script: {
            type: "text",
            input: text,
            provider: {
              type: "microsoft",
              voice_id: voiceId || "ar-EG-ShakirNeural",
            },
          },
          config: { fluent: true, pad_audio: 0.5 },
        }),
      });

      const createData: any = await createRes.json();
      if (!createRes.ok) throw new Error(createData?.description || createData?.message || "فشل إنشاء الفيديو");

      const talkId = createData.id;

      // Poll until done (max 60 seconds)
      let videoUrl: string | null = null;
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 3000));
        const statusRes = await fetch(`https://api.d-id.com/talks/${talkId}`, {
          headers: { "Authorization": `Basic ${DID_API_KEY}` },
        });
        const statusData: any = await statusRes.json();
        if (statusData.status === "done") { videoUrl = statusData.result_url; break; }
        if (statusData.status === "error") throw new Error("فشل D-ID في معالجة الفيديو");
      }

      if (!videoUrl) return res.status(504).json({ message: "انتهت مهلة توليد الفيديو، حاول مرة أخرى" });

      // Download and save locally
      const vidRes = await fetch(videoUrl);
      const buf = Buffer.from(await vidRes.arrayBuffer());
      const filename = `talking-${Date.now()}.mp4`;
      const savePath = path.join(process.cwd(), 'uploads', filename);
      fs.writeFileSync(savePath, buf);
      const localUrl = `/uploads/${filename}`;

      await storage.recordAiUsage(userId, 'talking_photo');
      res.json({ videoUrl: localUrl, charged: req.talkingPhotoChargeEGP || 0 });
    } catch (error: any) {
      res.status(500).json({ message: "فشل توليد الصورة الناطقة: " + error.message });
    }
  });

  // ─── D-ID STATUS CHECK ──────────────────────────────────────────
  app.get("/api/ai/talking-photo/status", isAuthenticated, async (req: any, res) => {
    const hasKey = !!process.env.DID_API_KEY;
    res.json({ available: hasKey });
  });

  // ─── D-ID PRESENTERS LIST ───────────────────────────────────────
  app.get("/api/ai/presenters", isAuthenticated, async (req: any, res) => {
    try {
      const didKey = process.env.DID_API_KEY;
      if (!didKey) return res.status(503).json({ message: "D-ID غير متاح" });
      const r = await fetch("https://api.d-id.com/clips/presenters?limit=100", {
        headers: { "Authorization": `Basic ${Buffer.from(didKey).toString("base64")}`, "Content-Type": "application/json" }
      });
      const data = await r.json() as any;
      res.json(data.presenters || []);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ─── D-ID PRESENTER CLIP (HeyGen-style) ─────────────────────────
  app.post("/api/ai/presenter-clip", isAuthenticated, checkTalkingPhotoCredits, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { presenterId, text, voiceId = "ar-EG-SalmaNeural" } = req.body;
      if (!presenterId || !text) return res.status(400).json({ message: "اختر مذيع واكتب النص" });
      if (text.length > 2000) return res.status(400).json({ message: "النص طويل جداً (الحد 2000 حرف)" });

      const didKey = process.env.DID_API_KEY;
      if (!didKey) return res.status(503).json({ message: "D-ID غير متاح" });
      const authHeader = `Basic ${Buffer.from(didKey).toString("base64")}`;

      // Charge wallet
      if (req.talkingPhotoChargeEGP) {
        await deductAiCharge(userId, req.talkingPhotoChargeEGP, `رسوم مذيع AI (D-ID Clips) — ${req.talkingPhotoChargeEGP} ج.م`);
      }

      // Create clip
      const createRes = await fetch("https://api.d-id.com/clips", {
        method: "POST",
        headers: { "Authorization": authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          presenter_id: presenterId,
          script: {
            type: "text",
            input: text,
            provider: { type: "microsoft", voice_id: voiceId }
          },
          config: { result_format: "mp4" }
        })
      });
      const createData = await createRes.json() as any;
      if (!createRes.ok) throw new Error(createData.description || createData.message || "فشل إنشاء الكليب");
      const clipId = createData.id;

      // Poll until done (max 90 sec)
      let videoUrl = "";
      for (let i = 0; i < 18; i++) {
        await new Promise(r => setTimeout(r, 5000));
        const statusRes = await fetch(`https://api.d-id.com/clips/${clipId}`, {
          headers: { "Authorization": authHeader }
        });
        const statusData = await statusRes.json() as any;
        if (statusData.status === "done") { videoUrl = statusData.result_url; break; }
        if (statusData.status === "error") throw new Error("فشل D-ID في معالجة الكليب");
      }
      if (!videoUrl) throw new Error("انتهت المهلة — حاول مرة أخرى");

      // Download & save locally
      const vidRes = await fetch(videoUrl);
      const vidBuf = Buffer.from(await vidRes.arrayBuffer());
      const filename = `clip-${Date.now()}.mp4`;
      const savePath = path.join(process.cwd(), "uploads", filename);
      fs.writeFileSync(savePath, vidBuf);
      const localUrl = `/uploads/${filename}`;

      await storage.recordAiUsage(userId, "presenter_clip");
      res.json({ videoUrl: localUrl, charged: req.talkingPhotoChargeEGP || 0 });
    } catch (e: any) {
      res.status(500).json({ message: "فشل توليد الفيديو: " + e.message });
    }
  });

  // ─── AI TRANSLATE ─────────────────────────────────────────────
  app.post("/api/ai/translate", isAuthenticated, checkAiCredits, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { title, description, targetLanguage = "en" } = req.body;
      if (!title && !description) return res.status(400).json({ message: "النص مطلوب" });

      const langName = targetLanguage === "ar" ? "Arabic (Egyptian dialect, RTL)" : "English";
      const prompt = `Translate the following ad content to ${langName}. Keep it natural, catchy and suitable for advertising.\n\nTitle: ${title || ""}\nDescription: ${description || ""}\n\nReturn JSON: {"title": "translated title", "description": "translated description"}`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 400,
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      await storage.recordAiUsage(userId, 'text');
      if (req.aiChargeEGP) {
        await deductAiCharge(userId, req.aiChargeEGP, 'رسوم ترجمة بالذكاء الاصطناعي');
      }
      res.json({ title: result.title || "", description: result.description || "" });
    } catch (error: any) {
      res.status(500).json({ message: "فشل الترجمة: " + error.message });
    }
  });

  // ─── AI MENU CARD GENERATOR ───────────────────────────────────
  app.post("/api/ai/menu-card", isAuthenticated, checkAiCredits, async (req: any, res) => {
    try {
      const { restaurantName, dishName, price, description, category, style } = req.body || {};
      if (!dishName) return res.status(400).json({ message: "اسم الأكلة مطلوب" });

      const styleMap: Record<string, string> = {
        photo: "ultra-realistic professional food photography, studio lighting, shallow depth of field",
        elegant: "elegant fine dining presentation, dark moody background, luxury restaurant style",
        street: "vibrant colorful street food style, warm lighting, appetizing",
        cartoon: "colorful cartoon illustration style, flat design, playful food art",
      };
      const catMap: Record<string, string> = {
        grills: "grilled meat dish",
        seafood: "fresh seafood dish",
        sweets: "dessert and sweets",
        drinks: "beverage drink",
        fastfood: "fast food meal",
        salads: "fresh salad",
        pizza: "pizza and pasta",
        oriental: "traditional Egyptian oriental food",
      };

      const styleDesc = styleMap[style] || styleMap.photo;
      const catDesc = catMap[category] || "delicious food";
      const prompt = `${styleDesc}, ${catDesc}, dish name: "${dishName}", ${description ? `description: ${description},` : ""} served beautifully on a plate, menu photography, high quality, appetizing, no text, no watermark`;

      const imgResp = await openai.images.generate({
        model: "gpt-image-1",
        prompt,
        n: 1,
        size: "1024x1024",
      });

      const b64 = imgResp.data?.[0]?.b64_json;
      const imageUrl = imgResp.data?.[0]?.url;
      const filename = `menu-${Date.now()}.png`;
      const savePath = path.join(process.cwd(), 'uploads', filename);
      if (b64) {
        fs.writeFileSync(savePath, Buffer.from(b64, 'base64'));
      } else if (imageUrl) {
        const r = await fetch(imageUrl);
        fs.writeFileSync(savePath, Buffer.from(await r.arrayBuffer()));
      }

      // Generate Arabic caption
      const captionResp = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{
          role: "user",
          content: `اكتب وصفاً تسويقياً قصيراً وشهياً باللغة العربية لـ"${dishName}" ${description ? `(${description})` : ""} ${restaurantName ? `من مطعم ${restaurantName}` : ""} ${price ? `بسعر ${price} جنيه` : ""}. الوصف لا يزيد عن 3 جمل قصيرة ومشوّقة.`
        }],
        max_tokens: 150,
      });
      const caption = captionResp.choices?.[0]?.message?.content?.trim() || "";

      res.json({ imageUrl: `/uploads/${filename}`, caption });
    } catch (e: any) {
      console.error("menu-card error:", e.message);
      res.status(500).json({ message: e.message });
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
        ffmpegArgs.push("-i", audioFilePath!);
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
      const { adId, payerName, payerPhone, paidAmount, paymentMethod, screenshotUrl } = req.body;
      if (!adId || !payerName || !payerPhone || !paidAmount || !paymentMethod)
        return res.status(400).json({ message: "بيانات ناقصة" });
      const payerUserId = (req as any).session?.customUser?.id || (req as any).user?.claims?.sub || null;
      const result = await db.execute(
        sql`INSERT INTO payment_notifications (ad_id, payer_name, payer_phone, paid_amount, payment_method, status, screenshot_url, payer_user_id)
            VALUES (${adId}, ${payerName}, ${payerPhone}, ${paidAmount}, ${paymentMethod}, 'pending', ${screenshotUrl || null}, ${payerUserId})
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
    if (!["pending", "confirmed", "rejected"].includes(status))
      return res.status(400).json({ message: "حالة غير صالحة" });
    try {
      const result = await db.execute(
        sql`UPDATE payment_notifications SET status = ${status} WHERE id = ${req.params.id} RETURNING *`
      );
      const row = result.rows[0] as any;
      // Send platform notification to buyer on confirmation
      if (status === "confirmed" && row) {
        try {
          const buyerId = row.payer_user_id;
          if (buyerId) {
            const adRow = await db.execute(sql`SELECT title FROM ads WHERE id = ${row.ad_id}`);
            const adTitle = (adRow.rows[0] as any)?.title || "إعلان";
            await createNotification(
              buyerId,
              "system",
              "✅ تم تأكيد دفعك",
              `تم تأكيد دفعك بمبلغ ${row.paid_amount} ج.م عبر ${row.payment_method} للإعلان: ${adTitle}`,
              `/ads/${row.ad_id}`
            );
          }
        } catch (_) {}
      }
      res.json(row);
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
    const { toUserId, message, adId, isVoice, voiceUrl, imageUrl, isPaymentProof, replyToId, replyToText } = req.body;
    if (!toUserId || (!message && !imageUrl)) return res.status(400).json({ message: "Missing required fields" });
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
      const msgText = message || (imageUrl ? "📸 إيصال دفع" : "");
      const result = await db.execute(
        sql`INSERT INTO direct_messages (from_user_id, to_user_id, ad_id, message, is_voice, voice_url, image_url, is_payment_proof, reply_to_id, reply_to_text)
            VALUES (${fromUserId}, ${toUserId}, ${adId ?? null}, ${msgText}, ${isVoice ?? false}, ${voiceUrl ?? null},
                    ${imageUrl ?? null}, ${isPaymentProof ?? false},
                    ${replyToId ?? null}, ${replyToText ?? null})
            RETURNING *`
      );
      // Send notification to recipient
      const senderName = req.user.claims?.first_name || "مستخدم";
      const msgTitle = isVoice ? "🎤 رسالة صوتية جديدة"
                     : isPaymentProof ? "💳 إيصال دفع جديد"
                     : "رسالة جديدة 📩";
      const msgBody  = isVoice ? `${senderName}: أرسل رسالة صوتية`
                     : isPaymentProof ? `${senderName}: أرسل إيصال دفع للمراجعة`
                     : `${senderName}: ${String(msgText).slice(0, 60)}`;
      await createNotification(toUserId, "comment", msgTitle, msgBody, `/messages`,
        isVoice ? voiceUrl : undefined, fromUserId);
      res.status(201).json(result.rows[0]);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // POST /api/messages/:id/confirm-payment — admin confirms payment screenshot → activate service
  app.post("/api/messages/:id/confirm-payment", isAuthenticated, async (req: any, res) => {
    if (req.user.claims.sub !== ADMIN_USER_ID) return res.status(403).json({ message: "أدمن فقط" });
    try {
      const msgRow = await db.execute(sql`SELECT * FROM direct_messages WHERE id = ${req.params.id} LIMIT 1`);
      const msg = msgRow.rows[0] as any;
      if (!msg) return res.status(404).json({ message: "الرسالة غير موجودة" });

      const userId = msg.from_user_id;
      const msgText: string = msg.message || "";

      // ── Parse order number from message ──────────────────────
      const orderMatch = msgText.match(/رقم الطلب[:\s]+([A-Z0-9\-]+)/i);
      const adMatch    = msgText.match(/رقم الإعلان[:\s#]+(\d+)/i);
      const amountMatch = msgText.match(/قيمة الدفع[:\s]+([\d.]+)/i);
      const orderNum = orderMatch?.[1]?.trim();
      const adIdFromMsg = adMatch ? parseInt(adMatch[1]) : null;
      const amountFromMsg = amountMatch ? parseFloat(amountMatch[1]) : null;

      let serviceActivated = "الخدمة المطلوبة";
      let adId: number | null = adIdFromMsg;

      // ── Try to find and confirm renewal order (RNW-) or boost order ───
      if (orderNum) {
        if (orderNum.startsWith('RNW-')) {
          // It's a renewal order
          const renewRow = await db.execute(sql`SELECT * FROM renewal_orders WHERE order_number = ${orderNum} LIMIT 1`);
          const renewOrder = renewRow.rows[0] as any;
          if (renewOrder && renewOrder.status === 'pending') {
            adId = renewOrder.ad_id;
            const days = renewOrder.duration_days;
            await db.execute(sql`UPDATE renewal_orders SET status = 'confirmed' WHERE order_number = ${orderNum}`);
            await db.execute(sql`
              UPDATE ads SET
                expires_at = GREATEST(COALESCE(expires_at, NOW()), NOW()) + (${days} || ' days')::INTERVAL,
                status = 'active'
              WHERE id = ${adId}
            `);
            serviceActivated = `تجديد إعلان #${adId} لمدة ${days} يوماً`;
          }
        } else {
          // It's a boost order
          const boostRow = await db.execute(sql`SELECT * FROM boost_orders WHERE order_number = ${orderNum} LIMIT 1`);
          const boostOrder = boostRow.rows[0] as any;
          if (boostOrder && boostOrder.status === 'pending') {
            adId = boostOrder.ad_id;
            await db.execute(sql`UPDATE boost_orders SET status = 'confirmed' WHERE order_number = ${orderNum}`);
            await db.execute(sql`
              UPDATE ads SET is_boosted = true, boosted_until = NOW() + INTERVAL '30 days'
              WHERE id = ${adId}
            `);
            const ad = await storage.getAd(adId!);
            if (ad) {
              const allRows = await db.execute(sql`SELECT id FROM users WHERE id != ${userId} LIMIT 500`);
              for (const row of allRows.rows as any[]) {
                await createNotification(row.id, "system",
                  `🚀 إعلان مميز: ${ad.title}`,
                  `✨ عرض مميز لا تفوّته — شاهده الآن!`,
                  `/ads/${adId}`
                );
              }
            }
            serviceActivated = `تعزيز إعلان #${adId} لمدة 30 يوماً`;
          }
        }
      } else if (adIdFromMsg) {
        // No order number but ad ID found → boost the ad directly
        await db.execute(sql`
          UPDATE ads SET is_boosted = true, boosted_until = NOW() + INTERVAL '30 days'
          WHERE id = ${adIdFromMsg}
        `);
        serviceActivated = `تعزيز إعلان #${adIdFromMsg} لمدة 30 يوماً`;
      }

      // ── Build a detailed invoice DM to the user ───────────────
      const invoiceLines: string[] = [
        `✅ تم تأكيد الدفع وتفعيل الخدمة`,
        `━━━━━━━━━━━━━━━━━━━━`,
        `📋 فاتورة الدفع`,
        `━━━━━━━━━━━━━━━━━━━━`,
      ];
      if (orderNum) invoiceLines.push(`🔢 رقم الطلب: ${orderNum}`);
      if (adId)    invoiceLines.push(`📢 رقم الإعلان: #${adId}`);
      if (amountFromMsg) invoiceLines.push(`💰 قيمة الدفع: ${amountFromMsg} ج.م`);
      invoiceLines.push(
        `🚀 الخدمة: ${serviceActivated}`,
        `✅ الحالة: تم الدفع بنجاح ✅`,
        `━━━━━━━━━━━━━━━━━━━━`,
        `🎉 الخدمة تفعّلت فوراً — شكراً لثقتك في سوق ماركات 🙏`
      );

      await db.execute(sql`
        INSERT INTO direct_messages (from_user_id, to_user_id, message, is_voice, image_url, is_payment_proof)
        VALUES (${ADMIN_USER_ID}, ${userId}, ${invoiceLines.join('\n')}, false, null, false)
      `);

      // Push notification
      await createNotification(userId, "system",
        "✅ تم تأكيد الدفع وتفعيل الخدمة",
        `تم استلام دفعتك وتفعيل ${serviceActivated} فوراً!`,
        adId ? `/ads/${adId}` : "/messages"
      );

      // Mark message as confirmed (is_read = true)
      await db.execute(sql`UPDATE direct_messages SET is_read = true WHERE id = ${req.params.id}`);

      res.json({ ok: true, serviceActivated, adId });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // GET /api/admin/payment-receipts — all payment proof screenshots with sender info
  app.get("/api/admin/payment-receipts", isAuthenticated, async (req: any, res) => {
    if (req.user.claims.sub !== ADMIN_USER_ID) return res.status(403).json({ message: "أدمن فقط" });
    try {
      const [dmRows, pnRows] = await Promise.all([
        db.execute(sql`
          SELECT dm.id, dm.from_user_id, dm.to_user_id, dm.message, dm.image_url,
                 dm.is_payment_proof, dm.is_read, dm.created_at,
                 u.first_name, u.last_name, u.phone, u.email,
                 'dm' as source_type, null as payer_name, null as payer_phone,
                 null as paid_amount, null as payment_method, null as pn_status
          FROM direct_messages dm
          LEFT JOIN users u ON u.id = dm.from_user_id
          WHERE dm.is_payment_proof = true
          ORDER BY dm.created_at DESC
          LIMIT 100
        `),
        db.execute(sql`
          SELECT pn.id, pn.payer_user_id as from_user_id, null as to_user_id,
                 null as message, pn.screenshot_url as image_url,
                 true as is_payment_proof,
                 CASE WHEN pn.status = 'confirmed' THEN true ELSE false END as is_read,
                 pn.created_at,
                 u.first_name, u.last_name, u.phone, u.email,
                 'pn' as source_type, pn.payer_name, pn.payer_phone,
                 pn.paid_amount, pn.payment_method, pn.status as pn_status
          FROM payment_notifications pn
          LEFT JOIN users u ON u.id = pn.payer_user_id
          WHERE pn.screenshot_url IS NOT NULL
          ORDER BY pn.created_at DESC
          LIMIT 100
        `)
      ]);
      const combined = [...dmRows.rows, ...pnRows.rows].sort((a: any, b: any) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      res.json(combined);
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
  // PATCH /api/auth/me/profile — update name, bio, profile photo
  app.patch("/api/auth/me/profile", isAuthenticated, upload.single("photo"), async (req: any, res) => {
    const userId = req.user.claims.sub;
    try {
      const firstName = (req.body.firstName && req.body.firstName.trim()) ? req.body.firstName.trim() : null;
      const lastName  = (req.body.lastName  && req.body.lastName.trim())  ? req.body.lastName.trim()  : null;
      const bio = req.body.bio ?? null;
      const profileImageUrl = req.file ? `/uploads/${req.file.filename}` : null;
      await db.execute(sql`
        UPDATE users SET
          first_name = COALESCE(${firstName}::text, first_name),
          last_name = COALESCE(${lastName}::text, last_name),
          bio = CASE WHEN ${bio}::text IS NOT NULL THEN ${bio}::text ELSE bio END,
          profile_image_url = COALESCE(${profileImageUrl}::text, profile_image_url)
        WHERE id = ${userId}
      `);
      const row = await db.execute(sql`SELECT id, first_name, last_name, profile_image_url, bio, governorate, referral_code FROM users WHERE id = ${userId} LIMIT 1`);
      const updated = row.rows[0] as any;
      // ── Update session so GET /api/auth/user returns the fresh name ──
      if (req.session?.customUser) {
        req.session.customUser.firstName       = updated.first_name       ?? req.session.customUser.firstName;
        req.session.customUser.lastName        = updated.last_name        ?? req.session.customUser.lastName;
        req.session.customUser.profileImageUrl = updated.profile_image_url ?? req.session.customUser.profileImageUrl;
      } else {
        // Replit OAuth user — persist profile overrides in session so /api/auth/user reflects changes
        (req.session as any).customUser = {
          id:              userId,
          email:           req.user?.claims?.email || null,
          phone:           null,
          firstName:       updated.first_name || req.user?.claims?.first_name || null,
          lastName:        updated.last_name  || req.user?.claims?.last_name  || null,
          profileImageUrl: updated.profile_image_url || null,
        };
      }
      await new Promise<void>((resolve) => {
        if (req.session?.save) req.session.save(() => resolve());
        else resolve();
      });
      res.json({ ok: true, user: updated });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // GET /api/auth/me/referral — referral code + stats
  app.get("/api/auth/me/referral", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    try {
      const userRow = await db.execute(sql`SELECT referral_code FROM users WHERE id = ${userId} LIMIT 1`);
      const code = userRow.rows[0]?.referral_code;
      const statsRow = await db.execute(sql`SELECT COUNT(*) as count, COALESCE(SUM(bonus_egp),0) as earned FROM referrals WHERE referrer_id = ${userId}`);
      res.json({ code, stats: statsRow.rows[0] });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // POST /api/auth/me/use-referral — use someone's referral code
  app.post("/api/auth/me/use-referral", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { code } = req.body;
    try {
      const alreadyUsed = await db.execute(sql`SELECT id FROM referrals WHERE referred_id = ${userId} LIMIT 1`);
      if (alreadyUsed.rows.length > 0) return res.status(400).json({ message: "already_used" });
      const referrerRow = await db.execute(sql`SELECT id FROM users WHERE referral_code = ${code} LIMIT 1`);
      if (!referrerRow.rows[0]) return res.status(404).json({ message: "invalid_code" });
      const referrerId = referrerRow.rows[0].id;
      if (referrerId === userId) return res.status(400).json({ message: "self_referral" });
      const bonusRow = await db.execute(sql`SELECT value FROM platform_settings WHERE key = 'ai_referral_bonus_egp' LIMIT 1`);
      const bonus = parseFloat(String(bonusRow.rows[0]?.value || '5'));
      await db.execute(sql`INSERT INTO referrals (referrer_id, referred_id, bonus_egp, status) VALUES (${referrerId}, ${userId}, ${bonus}, 'confirmed')`);
      res.json({ ok: true, bonus });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // GET /api/admin/ai-pricing — get AI pricing settings
  app.get("/api/admin/ai-pricing", isAuthenticated, async (req: any, res) => {
    if (!isAdminUser(req)) return res.status(403).json({ message: "forbidden" });
    try {
      const keys = ['ai_price_image','ai_price_video','ai_price_animation','ai_price_content','ai_price_post','ai_free_credits','ai_price_per_credit_egp','ai_referral_bonus_egp'];
      const rows = await db.execute(sql`SELECT key, value FROM platform_settings WHERE key IN (${sql.join(keys.map(k => sql`${k}`), sql`, `)})`);
      const settings: Record<string,string> = {};
      for (const r of rows.rows) settings[r.key as string] = r.value as string;
      res.json(settings);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // POST /api/admin/ai-pricing — update AI pricing settings
  app.post("/api/admin/ai-pricing", isAuthenticated, async (req: any, res) => {
    if (!isAdminUser(req)) return res.status(403).json({ message: "forbidden" });
    try {
      const { settings } = req.body;
      for (const [key, value] of Object.entries(settings)) {
        await db.execute(sql`INSERT INTO platform_settings (key, value) VALUES (${key}, ${String(value)}) ON CONFLICT (key) DO UPDATE SET value = ${String(value)}`);
      }
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Public pricing endpoint (no auth required) ──────────────────────
  app.get("/api/pricing", async (_req, res) => {
    try {
      const allowedKeys = new Set([
        'boost_price_egp','boost_enabled',
        'renewal_price_7','renewal_price_30','renewal_price_60','renewal_price_90',
        'campaign_min_budget_egp','wallet_min_withdrawal_egp',
        'ai_price_image','ai_price_video','ai_price_animation','ai_price_content','ai_price_post',
        'ai_free_credits','ai_price_per_credit_egp',
        'cpm_rate_egp','cpc_rate_egp',
      ]);
      // Fetch all settings and filter client-side to avoid ANY(array) SQL issue
      const rows = await db.execute(sql`SELECT key, value FROM platform_settings`);
      const settings: Record<string, string> = {};
      for (const r of rows.rows as any[]) {
        if (allowedKeys.has(r.key)) settings[r.key] = r.value;
      }
      const defaults: Record<string, string> = {
        boost_price_egp: '200', boost_enabled: 'true', boost_share_reward_egp: '50',
        renewal_price_7: '50', renewal_price_30: '350', renewal_price_60: '90', renewal_price_90: '130',
        campaign_min_budget_egp: '100', wallet_min_withdrawal_egp: '100',
        ai_price_image: '10', ai_price_video: '25', ai_price_animation: '20',
        ai_price_content: '5', ai_price_post: '5',
        ai_free_credits: '3', ai_price_per_credit_egp: '5',
        cpm_rate_egp: '15', cpc_rate_egp: '0.75',
      };
      res.json({ ...defaults, ...settings });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/admin/pricing", isAuthenticated, async (req: any, res) => {
    if (!isAdminUser(req)) return res.status(403).json({ message: "forbidden" });
    try {
      const keys = [
        'cpm_rate_egp','cpc_rate_egp','publisher_share_pct','campaign_min_budget_egp',
        'boost_price_egp','boost_enabled','boost_share_reward_egp',
        'renewal_price_30','renewal_price_60','renewal_price_90',
        'wallet_min_withdrawal_egp','wallet_max_deposit_egp',
        'ai_price_image','ai_price_video','ai_price_animation','ai_price_content','ai_price_post',
        'ai_free_credits','ai_price_per_credit_egp','ai_referral_bonus_egp',
      ];
      const rows = await db.execute(sql`SELECT key, value FROM platform_settings WHERE key IN (${sql.join(keys.map(k => sql`${k}`), sql`, `)})`);
      const settings: Record<string, string> = {};
      for (const r of rows.rows as any[]) settings[r.key] = r.value;
      res.json(settings);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // POST /api/admin/pricing — update platform pricing settings
  app.post("/api/admin/pricing", isAuthenticated, async (req: any, res) => {
    if (!isAdminUser(req)) return res.status(403).json({ message: "forbidden" });
    try {
      const { settings } = req.body;
      const allowed = [
        'cpm_rate_egp','cpc_rate_egp','publisher_share_pct','campaign_min_budget_egp',
        'boost_price_egp','boost_enabled','boost_share_reward_egp',
        'renewal_price_30','renewal_price_60','renewal_price_90',
        'wallet_min_withdrawal_egp','wallet_max_deposit_egp',
        'ai_price_image','ai_price_video','ai_price_animation','ai_price_content','ai_price_post',
        'ai_free_credits','ai_price_per_credit_egp','ai_referral_bonus_egp',
      ];
      for (const [key, value] of Object.entries(settings)) {
        if (!allowed.includes(key)) continue;
        await db.execute(sql`INSERT INTO platform_settings (key, value) VALUES (${key}, ${String(value)}) ON CONFLICT (key) DO UPDATE SET value = ${String(value)}`);
      }
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/profile/:userId", async (req, res) => {
    const { userId } = req.params;
    try {
      const [userRow, adsRow, channelRow] = await Promise.all([
        db.execute(sql`SELECT id, first_name, last_name, profile_image_url, bio, governorate, referral_code, created_at, interests, birthday, job_title, company, city, relationship_status FROM users WHERE id = ${userId}`),
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
  app.post("/api/ads/:id/view", async (req: any, res) => {
    const id = parseInt(req.params.id);
    try {
      await db.execute(sql`UPDATE ads SET views_count = COALESCE(views_count, 0) + 1 WHERE id = ${id}`);
      // If viewer is authenticated and ad has targetInterests, learn their interests
      const viewerId: string | undefined = req.session?.customUser?.id || req.user?.claims?.sub;
      if (viewerId) {
        const adRow = await db.execute(
          sql`SELECT target_interests FROM ads WHERE id = ${id} AND target_interests IS NOT NULL AND target_interests <> '' LIMIT 1`
        );
        if (adRow.rows.length > 0) {
          const adInterests = (adRow.rows[0] as any).target_interests as string;
          // Merge new interests into user's existing interests (deduplicated)
          await db.execute(sql`
            UPDATE users
            SET interests = (
              SELECT STRING_AGG(DISTINCT elem, ',')
              FROM unnest(
                string_to_array(COALESCE(interests, '') || ',' || ${adInterests}, ',')
              ) AS elem
              WHERE trim(elem) <> ''
            )
            WHERE id = ${viewerId}
          `);
        }
      }
      res.json({ ok: true });
    } catch { res.json({ ok: false }); }
  });

  // ================================================================
  // WHATSAPP CLICK TRACKING (legacy)
  // ================================================================
  app.post("/api/ads/:id/whatsapp-click", async (req, res) => {
    const id = parseInt(req.params.id);
    try {
      await db.execute(sql`UPDATE ads SET whatsapp_clicks = COALESCE(whatsapp_clicks, 0) + 1 WHERE id = ${id}`);
      res.json({ ok: true });
    } catch { res.json({ ok: false }); }
  });

  // ================================================================
  // LINK REDIRECT TRACKER — /api/go/:adId/:type
  // يتتبع كل نقرة ثم يُحوّل المستخدم للرابط الحقيقي
  // ================================================================
  app.get("/api/go/:adId/:type", async (req: any, res) => {
    const adId  = parseInt(req.params.adId);
    const ltype = req.params.type; // googleplay | appstore | appgallery | whatsapp | payment | website | facebook | other
    const ip    = (req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || "").split(",")[0].trim();
    const ua    = req.headers["user-agent"] || "";
    const uid   = req.user?.claims?.sub || null;

    try {
      // 1. جلب بيانات الإعلان
      const adR = await db.execute(
        sql`SELECT id, user_id, whatsapp_number, payment_link, app_store_url,
                   google_play_url, app_gallery_url
            FROM ads WHERE id = ${adId} LIMIT 1`
      );
      const ad: any = adR.rows[0];
      if (!ad) return res.status(404).send("الإعلان غير موجود");

      // 2. تحديد الرابط الهدف
      const urlMap: Record<string, string> = {
        whatsapp:   ad.whatsapp_number ? `https://wa.me/${String(ad.whatsapp_number).replace(/\D/g, "")}` : "",
        payment:    ad.payment_link    || "",
        appstore:   ad.app_store_url   || "",
        googleplay: ad.google_play_url || "",
        appgallery: ad.app_gallery_url || "",
      };
      const destUrl = urlMap[ltype] || "";
      if (!destUrl) return res.status(404).send("الرابط غير متاح");

      // 3. كشف الاحتيال — نفس IP نقر نفس النوع خلال ساعتين
      const recentR = await db.execute(
        sql`SELECT COUNT(*) as cnt FROM ad_link_clicks
            WHERE ad_id = ${adId} AND link_type = ${ltype}
              AND ip = ${ip} AND created_at > NOW() - INTERVAL '2 hours'`
      );
      const recentCount = parseInt((recentR.rows[0] as any)?.cnt || "0");
      const isSelfClick  = uid && uid === ad.user_id;
      const isFlood      = recentCount >= 3;
      const isFraud      = isSelfClick || isFlood;
      const fraudReason  = isSelfClick ? "self_click" : isFlood ? `flood_${recentCount}` : null;

      // 4. تسجيل النقرة
      await db.execute(
        sql`INSERT INTO ad_link_clicks (ad_id, link_type, dest_url, ip, user_agent, user_id, is_fraud, fraud_reason)
            VALUES (${adId}, ${ltype}, ${destUrl}, ${ip}, ${ua.slice(0, 300)}, ${uid}, ${isFraud}, ${fraudReason})`
      );

      // 5. تحديث العداد في جدول الإعلانات (فقط غير مزوّرة)
      if (!isFraud) {
        if (ltype === "whatsapp") {
          await db.execute(sql`UPDATE ads SET whatsapp_clicks = COALESCE(whatsapp_clicks, 0) + 1 WHERE id = ${adId}`);
        }
      }

      // 6. التحويل للرابط الحقيقي
      res.redirect(302, destUrl);
    } catch (e: any) {
      console.error("[TRACKER]", e.message);
      res.status(500).send("خطأ في الخادم");
    }
  });

  // ================================================================
  // LINK CLICK ANALYTICS — /api/ads/:id/link-clicks
  // ================================================================
  app.get("/api/ads/:id/link-clicks", isAuthenticated, async (req: any, res) => {
    const adId  = parseInt(req.params.id);
    const userId = req.user?.claims?.sub;
    try {
      // فقط صاحب الإعلان أو الأدمن
      const ownerR = await db.execute(sql`SELECT user_id FROM ads WHERE id = ${adId}`);
      const owner: any = ownerR.rows[0];
      if (!owner) return res.status(404).json({ message: "الإعلان غير موجود" });
      if (owner.user_id !== userId && !isAdminUser(req)) return res.status(403).json({ message: "غير مصرح" });

      const stats = await db.execute(
        sql`SELECT
              link_type,
              COUNT(*) FILTER (WHERE is_fraud = false) AS real_clicks,
              COUNT(*) FILTER (WHERE is_fraud = true)  AS fraud_clicks,
              COUNT(*) AS total_clicks,
              MAX(created_at) AS last_click
            FROM ad_link_clicks
            WHERE ad_id = ${adId}
            GROUP BY link_type
            ORDER BY real_clicks DESC`
      );
      const total = await db.execute(
        sql`SELECT COUNT(*) FILTER (WHERE is_fraud = false) AS real,
                   COUNT(*) FILTER (WHERE is_fraud = true)  AS fraud
            FROM ad_link_clicks WHERE ad_id = ${adId}`
      );
      res.json({ byType: stats.rows, totals: total.rows[0] });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ================================================================
  // SIMILAR ADS
  // ================================================================
  app.get("/api/ads/:id/similar", async (req, res) => {
    const id = parseInt(req.params.id);
    try {
      const ad = await db.execute(
        sql`SELECT target_region, language, target_interests FROM ads WHERE id = ${id}`
      );
      if (!ad.rows.length) return res.json([]);
      const { target_region, language, target_interests } = ad.rows[0] as any;
      // Match by shared interests first, then fall back to region/language
      const similar = await db.execute(
        sql`SELECT * FROM ads WHERE id != ${id} AND status = 'active'
            AND (
              (
                target_interests IS NOT NULL AND target_interests <> ''
                AND ${target_interests ?? ""}::text <> ''
                AND string_to_array(target_interests, ',') &&
                    string_to_array(${target_interests ?? ""}, ',')
              )
              OR target_region = ${target_region}
              OR language = ${language}
            )
            ORDER BY created_at DESC LIMIT 6`
      );
      res.json(similar.rows);
    } catch { res.json([]); }
  });

  // ================================================================
  // AD RENEW
  // ================================================================
  // Admin-only direct renew (no payment)
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

  // GET /api/renewal/settings — get renewal pricing tiers
  app.get("/api/renewal/settings", async (_req, res) => {
    try {
      const rows = await db.execute(sql`
        SELECT key, value FROM platform_settings
        WHERE key IN ('renewal_price_7', 'renewal_price_30', 'renewal_price_60', 'renewal_price_90')
      `);
      const settings: Record<string, number> = {};
      for (const r of rows.rows as any[]) settings[r.key] = parseFloat(r.value);
      res.json({
        options: [
          { days: 7,  price: settings['renewal_price_7']  ?? 50,  label: "7 أيام 🔥",  badge: "الأكثر طلباً" },
          { days: 30, price: settings['renewal_price_30'] ?? 350, label: "30 يوماً" },
          { days: 60, price: settings['renewal_price_60'] ?? 600, label: "60 يوماً" },
          { days: 90, price: settings['renewal_price_90'] ?? 800, label: "90 يوماً" },
        ]
      });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // POST /api/ads/:id/renew-wallet — renew using wallet balance directly (instant)
  app.post("/api/ads/:id/renew-wallet", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const adId = parseInt(req.params.id);
    const { durationDays } = req.body;
    if (!durationDays) return res.status(400).json({ message: "مدة التجديد مطلوبة" });
    try {
      const adRow = await db.execute(sql`SELECT * FROM ads WHERE id = ${adId} LIMIT 1`);
      const ad = adRow.rows[0] as any;
      if (!ad) return res.status(404).json({ message: "الإعلان غير موجود" });
      if (ad.user_id !== userId) return res.status(403).json({ message: "غير مصرح" });

      // Validate durationDays is supported (7 or 30; reject other values unless explicitly configured)
      const ALLOWED_DURATIONS: Record<number, { key: string; defaultPrice: number }> = {
        7:  { key: "renewal_price_7",  defaultPrice: 50 },
        30: { key: "renewal_price_30", defaultPrice: 350 },
        60: { key: "renewal_price_60", defaultPrice: 600 },
        90: { key: "renewal_price_90", defaultPrice: 800 },
      };
      const durationConfig = ALLOWED_DURATIONS[durationDays as number];
      if (!durationConfig) {
        return res.status(400).json({ message: `مدة التجديد غير مدعومة: ${durationDays} يوم — الخيارات المتاحة: 7 / 30 / 60 / 90` });
      }
      // Fetch price from platform_settings; fall back to default if not configured
      const priceRow = await db.execute(sql`SELECT value FROM platform_settings WHERE key = ${durationConfig.key} LIMIT 1`);
      const price = parseFloat((priceRow.rows[0] as any)?.value || String(durationConfig.defaultPrice));

      // Atomic check-and-deduct using row lock
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const userR = await client.query(`SELECT balance_egp FROM users WHERE id = $1 FOR UPDATE`, [userId]);
        const balance = parseFloat(userR.rows[0]?.balance_egp || "0");
        if (balance < price) {
          await client.query("ROLLBACK");
          return res.status(402).json({
            requiresWalletTopup: true,
            price,
            balance,
            message: `رصيد محفظتك غير كافٍ (${balance} ج.م). التجديد يكلف ${price} ج.م — اشحن محفظتك أولاً`,
          });
        }
        // Deduct from wallet
        await client.query(
          `UPDATE users SET balance_egp = COALESCE(balance_egp, 0) - $1 WHERE id = $2`,
          [price, userId]
        );
        // Activate renewal
        await client.query(
          `UPDATE ads SET
            expires_at = GREATEST(COALESCE(expires_at, NOW()), NOW()) + ($1 || ' days')::INTERVAL,
            status = 'active'
           WHERE id = $2`,
          [durationDays, adId]
        );
        // Log to wallet_transactions ledger for auditability
        await client.query(
          `INSERT INTO wallet_transactions (user_id, type, amount_egp, description, ref_id)
           VALUES ($1, 'renewal_debit', $2, $3, $4)`,
          [userId, price, `تجديد إعلان #${adId} لمدة ${durationDays} يوم`, String(adId)]
        );
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }

      // Notify user
      try {
        await createNotification(userId, "system",
          `✅ تم تجديد إعلانك بنجاح`,
          `إعلان #${adId} تم تجديده لمدة ${durationDays} يوم — خُصم ${price} ج.م من محفظتك`,
          `/ads/${adId}`
        );
      } catch (_) {}

      res.json({ ok: true, adId, durationDays, price, message: `تم تجديد الإعلان لمدة ${durationDays} يوماً` });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // POST /api/ads/:id/renew-order — user requests paid renewal → creates order + notifies admin
  app.post("/api/ads/:id/renew-order", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const adId = parseInt(req.params.id);
    const { durationDays, amount } = req.body;
    if (!durationDays || !amount) return res.status(400).json({ message: "بيانات ناقصة" });
    try {
      const adRow = await db.execute(sql`SELECT * FROM ads WHERE id = ${adId} LIMIT 1`);
      const ad = adRow.rows[0] as any;
      if (!ad) return res.status(404).json({ message: "الإعلان غير موجود" });
      if (ad.user_id !== userId) return res.status(403).json({ message: "غير مصرح" });

      // Generate order number: RNW-{timestamp}-{adId}
      const orderNumber = `RNW-${Date.now()}-${adId}`;
      await db.execute(sql`
        INSERT INTO renewal_orders (order_number, ad_id, user_id, duration_days, amount, status)
        VALUES (${orderNumber}, ${adId}, ${userId}, ${durationDays}, ${amount}, 'pending')
      `);

      // Notify admin via DM
      const msg =
        `🔄 طلب تجديد إعلان\n` +
        `━━━━━━━━━━━━━━━━━\n` +
        `📋 رقم الطلب: ${orderNumber}\n` +
        `📢 رقم الإعلان: #${adId}\n` +
        `📅 المدة: ${durationDays} يوماً\n` +
        `💰 قيمة الدفع: ${amount} ج.م\n` +
        `━━━━━━━━━━━━━━━━━\n` +
        `⏳ في انتظار تأكيد الدفع...`;
      await db.execute(sql`
        INSERT INTO direct_messages (from_user_id, to_user_id, ad_id, message, is_voice, is_payment_proof)
        VALUES (${userId}, ${ADMIN_USER_ID}, ${adId}, ${msg}, false, false)
      `);

      // Bell notification to both admins
      for (const adminId of [ADMIN_USER_ID, ADMIN_USER_ID2]) {
        await createNotification(adminId, "payment",
          `🔄 طلب تجديد إعلان`,
          `إعلان #${adId} — ${durationDays} يوماً مقابل ${amount} ج.م (${orderNumber})`,
          "/admin"
        );
      }

      res.json({ ok: true, orderNumber, adId, durationDays, amount });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // GET /api/renewal/orders — admin: list all pending renewal orders
  app.get("/api/renewal/orders", isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const rows = await db.execute(sql`
        SELECT ro.*, u.first_name, u.last_name, u.phone, a.title as ad_title
        FROM renewal_orders ro
        LEFT JOIN users u ON u.id = ro.user_id
        LEFT JOIN ads a ON a.id = ro.ad_id
        ORDER BY ro.created_at DESC LIMIT 100
      `);
      res.json(rows.rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // PATCH /api/renewal/orders/:id — admin: confirm or reject renewal
  app.patch("/api/renewal/orders/:id", isAuthenticated, requireAdmin, async (req: any, res) => {
    const { status } = req.body;
    try {
      const orderRow = await db.execute(sql`SELECT * FROM renewal_orders WHERE id = ${req.params.id} LIMIT 1`);
      const order = orderRow.rows[0] as any;
      if (!order) return res.status(404).json({ message: "الطلب غير موجود" });

      await db.execute(sql`UPDATE renewal_orders SET status = ${status} WHERE id = ${req.params.id}`);

      if (status === 'confirmed') {
        // Extend the ad's expires_at
        const days = order.duration_days;
        await db.execute(sql`
          UPDATE ads SET
            expires_at = GREATEST(COALESCE(expires_at, NOW()), NOW()) + (${days} || ' days')::INTERVAL,
            status = 'active'
          WHERE id = ${order.ad_id}
        `);

        const confirmMsg =
          `✅ تم تأكيد تجديد إعلانك\n` +
          `━━━━━━━━━━━━━━━━━\n` +
          `📋 رقم الطلب: ${order.order_number}\n` +
          `📢 رقم الإعلان: #${order.ad_id}\n` +
          `📅 تم التمديد: ${days} يوماً\n` +
          `💰 المبلغ: ${order.amount} ج.م\n` +
          `✅ الحالة: تم الدفع بنجاح ✅\n` +
          `━━━━━━━━━━━━━━━━━\n` +
          `🎉 إعلانك الآن نشط — شكراً لثقتك في سوق ماركات 🙏`;
        await db.execute(sql`
          INSERT INTO direct_messages (from_user_id, to_user_id, ad_id, message, is_voice)
          VALUES (${ADMIN_USER_ID}, ${order.user_id}, ${order.ad_id}, ${confirmMsg}, false)
        `);
        await createNotification(order.user_id, "system",
          `✅ تم تجديد إعلانك`,
          `رقم الطلب ${order.order_number} — إعلانك نشط لـ ${days} يوماً إضافية`,
          `/ads/${order.ad_id}`
        );
      } else {
        await createNotification(order.user_id, "system",
          `❌ طلب التجديد مرفوض`,
          `رقم الطلب ${order.order_number} — للاستفسار تواصل مع الإدارة.`,
          "/messages"
        );
      }
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ================================================================
  // SOCIAL FEATURES: Memories, Birthdays, Profile Social Info
  // ================================================================

  // PATCH /api/auth/me/social — update birthday, job, company, city, relationship
  app.patch("/api/auth/me/social", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { birthday, jobTitle, company, city, relationshipStatus } = req.body;
    try {
      await db.execute(sql`
        UPDATE users SET
          birthday = ${birthday || null},
          job_title = ${jobTitle || null},
          company = ${company || null},
          city = ${city || null},
          relationship_status = ${relationshipStatus || null},
          updated_at = NOW()
        WHERE id = ${userId}
      `);
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // GET /api/social/memories — "في هذا اليوم" — ads/reels created same day/month last year+
  app.get("/api/social/memories", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    try {
      const today = new Date();
      const month = today.getMonth() + 1;
      const day = today.getDate();
      const [adsRes, reelsRes] = await Promise.all([
        db.execute(sql`
          SELECT id, title, description, media_url, media_type, created_at
          FROM ads WHERE user_id = ${userId}
            AND EXTRACT(MONTH FROM created_at) = ${month}
            AND EXTRACT(DAY FROM created_at) = ${day}
            AND EXTRACT(YEAR FROM created_at) < ${today.getFullYear()}
          ORDER BY created_at DESC LIMIT 10
        `),
        db.execute(sql`
          SELECT id, title, description, video_url, thumbnail_url, created_at
          FROM reels WHERE user_id = ${userId}
            AND EXTRACT(MONTH FROM created_at) = ${month}
            AND EXTRACT(DAY FROM created_at) = ${day}
            AND EXTRACT(YEAR FROM created_at) < ${today.getFullYear()}
          ORDER BY created_at DESC LIMIT 10
        `),
      ]);
      res.json({
        ads: adsRes.rows,
        reels: reelsRes.rows,
        date: { day, month, year: today.getFullYear() },
      });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // GET /api/social/birthdays — upcoming birthdays of users you follow (channel subscribers)
  app.get("/api/social/birthdays", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    try {
      // Get users whose channels you subscribed to
      const result = await db.execute(sql`
        SELECT u.id, u.first_name, u.last_name, u.profile_image_url, u.birthday
        FROM users u
        INNER JOIN channel_subscriptions cs ON cs.channel_id IN (
          SELECT id FROM channels WHERE user_id = u.id
        )
        WHERE cs.user_id = ${userId}
          AND u.birthday IS NOT NULL
          AND u.id != ${userId}
        ORDER BY
          (EXTRACT(MONTH FROM u.birthday) * 100 + EXTRACT(DAY FROM u.birthday))
          -
          (EXTRACT(MONTH FROM NOW()) * 100 + EXTRACT(DAY FROM NOW()))
        LIMIT 20
      `);
      // Also get today's birthdays from all users
      const todayBirthdays = await db.execute(sql`
        SELECT u.id, u.first_name, u.last_name, u.profile_image_url, u.birthday
        FROM users u
        WHERE u.birthday IS NOT NULL
          AND EXTRACT(MONTH FROM u.birthday) = EXTRACT(MONTH FROM NOW())
          AND EXTRACT(DAY FROM u.birthday) = EXTRACT(DAY FROM NOW())
          AND u.id != ${userId}
        LIMIT 10
      `);
      res.json({
        upcoming: result.rows,
        today: todayBirthdays.rows,
      });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // GET /api/social/suggestions — "أصدقاء قد تعرفهم" People You May Know
  app.get("/api/social/suggestions", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    try {
      const meRow = await db.execute(sql`
        SELECT governorate, city, interests FROM users WHERE id = ${userId} LIMIT 1
      `);
      const me = meRow.rows[0] as any;
      const myGov = me?.governorate || "";
      const myCity = me?.city || "";
      const myInterests = (me?.interests || "").split(",").filter(Boolean);

      // 1. People from same channels (mutual subscribers)
      const channelMates = await db.execute(sql`
        SELECT DISTINCT u.id, u.first_name, u.last_name, u.profile_image_url,
               u.governorate, u.city, u.job_title, u.company, u.interests
        FROM users u
        INNER JOIN channel_subscriptions cs ON cs.user_id = u.id
        WHERE cs.channel_id IN (
          SELECT channel_id FROM channel_subscriptions WHERE user_id = ${userId}
        )
        AND u.id != ${userId}
        LIMIT 30
      `);

      // 2. People from same governorate or city
      const regionMates = myGov ? await db.execute(sql`
        SELECT id, first_name, last_name, profile_image_url,
               governorate, city, job_title, company, interests
        FROM users
        WHERE (governorate = ${myGov} OR city = ${myCity})
          AND id != ${userId}
        ORDER BY created_at DESC
        LIMIT 20
      `) : { rows: [] };

      // 3. People with same interests (at least 1 overlap)
      const interestMates = myInterests.length > 0 ? await db.execute(sql`
        SELECT id, first_name, last_name, profile_image_url,
               governorate, city, job_title, company, interests
        FROM users
        WHERE interests IS NOT NULL
          AND interests != ''
          AND id != ${userId}
        ORDER BY created_at DESC
        LIMIT 30
      `) : { rows: [] };

      // Merge, deduplicate, score
      const seen = new Set<string>();
      const scored: Array<{ user: any; score: number; reasons: string[] }> = [];

      const addUser = (u: any, baseScore: number, reason: string) => {
        if (seen.has(u.id)) {
          const existing = scored.find(s => s.user.id === u.id);
          if (existing) {
            existing.score += baseScore;
            if (!existing.reasons.includes(reason)) existing.reasons.push(reason);
          }
          return;
        }
        seen.add(u.id);
        const userInterests = (u.interests || "").split(",").filter(Boolean);
        const commonInterests = userInterests.filter((i: string) => myInterests.includes(i));
        let score = baseScore + commonInterests.length * 2;
        const reasons: string[] = [reason];
        if (commonInterests.length > 0) reasons.push(`${commonInterests.length} اهتمام مشترك`);
        if (u.governorate && u.governorate === myGov) { score += 3; if (!reasons.includes("نفس المنطقة")) reasons.push("نفس المنطقة"); }
        scored.push({ user: u, score, reasons });
      };

      for (const u of channelMates.rows) addUser(u, 5, "مشترك في نفس القناة");
      for (const u of regionMates.rows) addUser(u, 3, "نفس المنطقة");
      for (const u of (interestMates.rows as any[])) {
        const ui = (u.interests || "").split(",").filter(Boolean);
        const common = ui.filter((i: string) => myInterests.includes(i));
        if (common.length > 0) addUser(u, common.length * 2, `${common.length} اهتمام مشترك`);
      }

      // Sort by score, return top 20
      scored.sort((a, b) => b.score - a.score);
      const results = scored.slice(0, 20).map(s => ({
        ...s.user,
        reasons: s.reasons,
      }));

      res.json({ suggestions: results });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // GET /api/social/invite-link — generate WhatsApp share link with referral code
  app.get("/api/social/invite-link", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    try {
      const userRow = await db.execute(sql`SELECT referral_code, first_name FROM users WHERE id = ${userId} LIMIT 1`);
      const code = (userRow.rows[0] as any)?.referral_code;
      const name = (userRow.rows[0] as any)?.first_name || "صديقك";
      const appUrl = `https://ads-as.com`;
      const msg = encodeURIComponent(
        `🎉 ${name} بيدعوك تنضم لـ شبكة سوق الإعلانات!\n` +
        `📢 أعلن عن منتجاتك، شاهد البث المباشر، واكسب أرباح\n` +
        `🔗 سجّل الآن: ${appUrl}\n` +
        `🎁 استخدم كود الإحالة: ${code} وهتحصل على مكافأة ترحيبية!`
      );
      res.json({
        code,
        appUrl,
        whatsappLink: `https://wa.me/?text=${msg}`,
        telegramLink: `https://t.me/share/url?url=${encodeURIComponent(appUrl)}&text=${encodeURIComponent(`انضم لشبكة سوق الإعلانات باستخدام كود ${code}`)}`,
        copyText: `انضم لشبكة سوق الإعلانات 🎉\n${appUrl}\nكود الإحالة: ${code}`,
      });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Dynamic Sitemap — includes all ads + channels for SEO
  app.get("/sitemap-dynamic.xml", async (req, res) => {
    try {
      const BASE = "https://ads-as.com";
      const [adsRes, channelsRes, reelsRes] = await Promise.all([
        db.execute(sql`SELECT id, title, media_url, media_type, created_at FROM ads WHERE status = 'active' ORDER BY created_at DESC LIMIT 2000`),
        db.execute(sql`SELECT id, name, avatar_url, created_at FROM channels WHERE status = 'active' ORDER BY created_at DESC`),
        db.execute(sql`SELECT id, title, thumbnail_url, created_at FROM reels ORDER BY created_at DESC LIMIT 500`),
      ]);

      const escXml = (s: string) => (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

      const adTags = (adsRes.rows as any[]).map(ad => {
        const lastmod = ad.created_at ? new Date(ad.created_at).toISOString().split("T")[0] : "";
        const isImage = ad.media_type === "image" && ad.media_url;
        const imgUrl = isImage ? (ad.media_url.startsWith("http") ? ad.media_url : `${BASE}${ad.media_url}`) : "";
        return `  <url>
    <loc>${BASE}/ads/${ad.id}</loc>
    ${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}
    <changefreq>weekly</changefreq>
    <priority>0.75</priority>
    ${imgUrl ? `<image:image><image:loc>${escXml(imgUrl)}</image:loc><image:title>${escXml(ad.title || "")}</image:title></image:image>` : ""}
  </url>`;
      }).join("\n");

      const channelTags = (channelsRes.rows as any[]).map(ch => {
        const lastmod = ch.created_at ? new Date(ch.created_at).toISOString().split("T")[0] : "";
        return `  <url>
    <loc>${BASE}/channels/${ch.id}</loc>
    ${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}
    <changefreq>daily</changefreq>
    <priority>0.65</priority>
  </url>`;
      }).join("\n");

      const reelTags = (reelsRes.rows as any[]).map(r => {
        const lastmod = r.created_at ? new Date(r.created_at).toISOString().split("T")[0] : "";
        return `  <url>
    <loc>${BASE}/reels?reel=${r.id}</loc>
    ${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`;
      }).join("\n");

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${adTags}
${channelTags}
${reelTags}
</urlset>`;

      res.setHeader("Content-Type", "application/xml; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.send(xml);
    } catch (e: any) {
      res.status(500).send("Sitemap error");
    }
  });

  // ── Consultations ──────────────────────────────────────────────────────────
  // Create consultation table on startup (already done via migrations block ideally)
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS consultations (
        id SERIAL PRIMARY KEY,
        user_id text NOT NULL,
        user_name text,
        package_id text NOT NULL,
        package_label text,
        amount_egp numeric(10,2) DEFAULT 0,
        title text NOT NULL,
        description text,
        file_urls text,
        status text DEFAULT 'pending',
        admin_note text,
        reply text,
        payment_ref text,
        payment_method text,
        payment_screenshot_url text,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      )
    `);
  } catch {}

  // GET /api/consultations — list (admin sees all, user sees own)
  app.get("/api/consultations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const rows = isAdminUser(req)
        ? (await db.execute(sql`SELECT * FROM consultations ORDER BY created_at DESC`)).rows
        : (await db.execute(sql`SELECT * FROM consultations WHERE user_id = ${userId} ORDER BY created_at DESC`)).rows;
      res.json(rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // POST /api/consultations — submit new
  app.post("/api/consultations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { packageId, packageLabel, amountEGP, title, description, fileUrls, paymentRef, paymentMethod, paymentScreenshotUrl } = req.body;
      if (!packageId || !title) return res.status(400).json({ message: "بيانات ناقصة" });
      const userRow = await pool.query(`SELECT first_name, last_name FROM users WHERE id = $1`, [userId]);
      const u = userRow.rows[0];
      const userName = u ? `${u.first_name || ""} ${u.last_name || ""}`.trim() || "مستخدم" : "مستخدم";
      const result = await db.execute(sql`
        INSERT INTO consultations (user_id, user_name, package_id, package_label, amount_egp, title, description, file_urls, payment_ref, payment_method, payment_screenshot_url)
        VALUES (${userId}, ${userName}, ${packageId}, ${packageLabel || packageId}, ${amountEGP || 0}, ${title}, ${description || null}, ${fileUrls ? JSON.stringify(fileUrls) : null}, ${paymentRef || null}, ${paymentMethod || null}, ${paymentScreenshotUrl || null})
        RETURNING *
      `);
      // Notify admin
      await createNotification(userId, "payment", `📋 استشارة جديدة من ${userName}: ${title}`, `طلب استشارة: ${title}`, `/consultations`);
      res.status(201).json(result.rows[0]);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  // PUT /api/consultations/:id — admin reply/update status
  app.put("/api/consultations/:id", isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const { status, adminNote, reply } = req.body;
      const result = await db.execute(sql`
        UPDATE consultations SET status = ${status || 'pending'}, admin_note = ${adminNote || null}, reply = ${reply || null}, updated_at = now()
        WHERE id = ${Number(req.params.id)} RETURNING *
      `);
      if (result.rows[0]) {
        await createNotification((result.rows[0] as any).user_id, "payment",
          status === "approved" ? "✅ تمت الموافقة على استشارتك" : status === "rejected" ? "❌ تم رفض استشارتك" : "🔄 تم تحديث استشارتك",
          status === "approved" ? "يمكنك الاطلاع على رد الاستشارة" : status === "rejected" ? "للمزيد راسل الدعم" : "تم تحديث حالة الاستشارة",
          `/consultations`
        );
      }
      res.json(result.rows[0]);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  // POST /api/consultations/:id/ai-draft — generate AI draft reply (admin only)
  app.post("/api/consultations/:id/ai-draft", isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const row = await db.execute(sql`SELECT title, description, package_label FROM consultations WHERE id = ${Number(req.params.id)} LIMIT 1`);
      const c = row.rows[0] as any;
      if (!c) return res.status(404).json({ message: "الاستشارة غير موجودة" });

      const prompt = `أنت مستشار تسويقي محترف متخصص في الإعلانات الرقمية والتجارة الإلكترونية في السوق المصري.
قم بكتابة رد استشاري احترافي ومفيد على الطلب التالي:

العنوان: ${c.title}
التفاصيل: ${c.description || "لا توجد تفاصيل إضافية"}
الباقة: ${c.package_label || ""}

اكتب رداً عملياً ومنظماً يشمل:
1. تحليل الوضع
2. التوصيات المحددة
3. خطوات تنفيذية واضحة

الرد يجب أن يكون باللغة العربية، احترافياً ومفيداً وقابلاً للتطبيق مباشرة.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 800,
      });

      const draft = response.choices[0].message.content || "";
      res.json({ draft });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ================================================================
  // COUPONS — AI-generated promo codes (paid service)
  // ================================================================

  // GET /api/coupons — user's own coupons
  app.get("/api/coupons", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const rows = await db.execute(sql`
        SELECT * FROM coupons WHERE user_id = ${userId} ORDER BY created_at DESC
      `);
      res.json(rows.rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // GET /api/coupons/all — admin: all coupons
  app.get("/api/coupons/all", isAuthenticated, requireAdmin, async (_req, res) => {
    try {
      const rows = await db.execute(sql`SELECT * FROM coupons ORDER BY created_at DESC`);
      res.json(rows.rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // GET /api/coupons/price — get coupon service price
  app.get("/api/coupons/price", async (_req, res) => {
    try {
      const price = parseFloat(await storage.getSetting('coupon_price_egp') || '15');
      res.json({ priceEGP: price });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // POST /api/coupons/generate — AI generate + save coupon
  app.post("/api/coupons/generate", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { businessName, productDescription, discountType, discountValue, imageUrl, expiresAt, usageLimit } = req.body;
      if (!businessName || !productDescription) return res.status(400).json({ message: "اسم النشاط التجاري والوصف مطلوبان" });

      const priceEGP = parseFloat(await storage.getSetting('coupon_price_egp') || '15');

      // Admin is free
      if (!isAdminUser(req)) {
        const balance = await storage.getUserBalanceEGP(userId);
        if (balance < priceEGP) {
          return res.status(402).json({ message: "insufficient_balance", required: priceEGP, balance });
        }
        // Deduct balance
        await db.execute(sql`
          UPDATE users SET balance_egp = COALESCE(balance_egp, 0) - ${priceEGP} WHERE id = ${userId}
        `);
      }

      // Generate coupon code
      const rawCode = `${businessName.replace(/\s+/g, '').substring(0, 4).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Date.now().toString(36).toUpperCase().slice(-4)}`;

      // AI generate: title, description, terms
      const discountLabel = discountType === 'percentage' ? `خصم ${discountValue}%`
        : discountType === 'fixed' ? `خصم ${discountValue} ج.م`
        : discountType === 'free_shipping' ? 'شحن مجاني'
        : 'اشتري X احصل على Y';

      const aiResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{
          role: "user",
          content: `أنت خبير تسويق محترف. قم بإنشاء كوبون خصم احترافي وجذاب للمنشأة التالية:
اسم المنشأة: ${businessName}
وصف المنتج/الخدمة: ${productDescription}
نوع الخصم: ${discountLabel}
كود الكوبون: ${rawCode}

أنشئ ما يلي بالعربية فقط، في صيغة JSON:
{
  "title": "عنوان جذاب قصير للكوبون (أقل من 60 حرف)",
  "description": "نص تسويقي مقنع لعرض الكوبون (3-4 جمل)",
  "terms": "الشروط والأحكام المختصرة للكوبون (3 نقاط)"
}`
        }],
        max_tokens: 500,
      });

      let generated: any = {};
      try {
        const content = aiResponse.choices[0].message.content || '{}';
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        generated = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
      } catch { generated = {}; }

      const title = generated.title || `عرض خاص من ${businessName} - ${discountLabel}`;
      const description = generated.description || `استمتع بـ ${discountLabel} حصري من ${businessName}. استخدم الكود: ${rawCode}`;
      const termsAr = generated.terms || `• الكوبون للاستخدام لمرة واحدة فقط\n• لا يمكن دمجه مع عروض أخرى\n• العرض سار حتى نفاد الكمية`;

      const expires = expiresAt ? new Date(expiresAt) : null;
      const result = await db.execute(sql`
        INSERT INTO coupons (user_id, business_name, title, code, discount_type, discount_value, image_url, description, terms_ar, expires_at, usage_limit, amount_paid_egp)
        VALUES (${userId}, ${businessName}, ${title}, ${rawCode}, ${discountType || 'percentage'}, ${discountValue || null}, ${imageUrl || null}, ${description}, ${termsAr}, ${expires}, ${usageLimit || null}, ${isAdminUser(req) ? 0 : priceEGP})
        RETURNING *
      `);

      res.status(201).json(result.rows[0]);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // PATCH /api/coupons/:id — update coupon image / toggle active
  app.patch("/api/coupons/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { imageUrl, isActive, title, description } = req.body;
      const result = await db.execute(sql`
        UPDATE coupons SET
          image_url = COALESCE(${imageUrl ?? null}, image_url),
          is_active = COALESCE(${isActive ?? null}, is_active),
          title = COALESCE(${title ?? null}, title),
          description = COALESCE(${description ?? null}, description)
        WHERE id = ${Number(req.params.id)} AND user_id = ${userId}
        RETURNING *
      `);
      if (!result.rows[0]) return res.status(404).json({ message: "Coupon not found" });
      res.json(result.rows[0]);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // DELETE /api/coupons/:id
  app.delete("/api/coupons/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await db.execute(sql`DELETE FROM coupons WHERE id = ${Number(req.params.id)} AND (user_id = ${userId} OR ${isAdminUser(req)})`);
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // PATCH /api/settings/coupon_price — admin update coupon price
  app.patch("/api/settings/coupon_price", isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const { price } = req.body;
      if (!price || isNaN(Number(price))) return res.status(400).json({ message: "سعر غير صالح" });
      await db.execute(sql`UPDATE platform_settings SET value = ${String(price)}, updated_at = now() WHERE key = 'coupon_price_egp'`);
      res.json({ ok: true, price: Number(price) });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ================================================================
  // SEO — Server-Side Meta Injection for bots & crawlers
  // Googlebot, WhatsApp, Facebook, Telegram, Bing, etc.
  // Regular users pass through to the SPA normally
  // ================================================================
  const BOT_UA = /whatsapp|facebookexternalhit|facebot|twitterbot|telegrambot|linkedinbot|discordbot|slackbot|pinterest|snapchat|googlebot|bingbot|applebot|line-poker|viber|iframely|semrushbot|ahrefsbot|mj12bot|dotbot|rogerbot|yandexbot|baiduspider|duckduckbot|petalbot/i;

  const escH = (s: string) => (s||"").replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const SEO_BASE = "https://ads-as.com";

  app.get("/ads/:id", async (req, res, next) => {
    const ua = req.headers["user-agent"] || "";
    if (!BOT_UA.test(ua)) return next();

    const adId = parseInt(req.params.id);
    if (isNaN(adId)) return next();

    try {
      const adR = await db.execute(
        sql`SELECT id, title, description, media_url, media_type, price_egp, target_region, status FROM ads WHERE id = ${adId} AND status = 'active' LIMIT 1`
      );
      if (!adR.rows.length) return next();
      const ad: any = adR.rows[0];

      const pageUrl  = `${SEO_BASE}/ads/${adId}`;
      const rawMedia = ad.media_url || "";
      const imageUrl = rawMedia.startsWith("http") ? rawMedia : rawMedia ? `${SEO_BASE}${rawMedia}` : `${SEO_BASE}/icons/icon-512.png`;
      const price    = ad.price_egp && Number(ad.price_egp) > 0 ? `${Number(ad.price_egp).toLocaleString("ar-EG")} جنيه` : "";
      const region   = ad.target_region ? `في ${escH(ad.target_region)}` : "في مصر";
      const category = "";
      const adTitle  = escH(ad.title || "إعلان");
      const fullTitle = `${adTitle}${price ? ` — ${price}` : ""} | شبكة سوق للإعلانات`;
      const rawDesc  = ad.description ? String(ad.description).slice(0, 300) : `${ad.title || "إعلان"}${price ? ` — ${price}` : ""} ${region}`;
      const desc     = escH(rawDesc);
      const metaDesc = escH(`${rawDesc}${price ? ` | السعر: ${price}` : ""} ${region} — شبكة سوق للإعلانات ads-as.com`);

      const schemaPrice = price ? `,"offers":{"@type":"Offer","price":"${ad.price_egp}","priceCurrency":"EGP","availability":"https://schema.org/InStock","areaServed":"EG"}` : "";

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=300");
      res.send(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${fullTitle}</title>
  <meta name="description" content="${metaDesc}"/>
  <meta name="robots" content="index, follow, max-image-preview:large"/>
  <link rel="canonical" href="${pageUrl}"/>

  <meta property="og:type" content="product"/>
  <meta property="og:url" content="${pageUrl}"/>
  <meta property="og:title" content="${adTitle}${price ? ` — ${price}` : ""}"/>
  <meta property="og:description" content="${desc}"/>
  <meta property="og:image" content="${imageUrl}"/>
  <meta property="og:image:width" content="800"/>
  <meta property="og:image:height" content="600"/>
  <meta property="og:site_name" content="شبكة سوق للإعلانات"/>
  <meta property="og:locale" content="ar_EG"/>
  ${price ? `<meta property="product:price:amount" content="${escH(String(ad.price_egp))}"/><meta property="product:price:currency" content="EGP"/>` : ""}

  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="${adTitle}${price ? ` — ${price}` : ""}"/>
  <meta name="twitter:description" content="${desc}"/>
  <meta name="twitter:image" content="${imageUrl}"/>

  <script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"${adTitle.replace(/"/g,'\\"')}","description":"${desc.replace(/"/g,'\\"')}","url":"${pageUrl}","image":"${imageUrl}"${schemaPrice},"brand":{"@type":"Organization","name":"شبكة سوق للإعلانات","url":"${SEO_BASE}"}}</script>
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"الرئيسية","item":"${SEO_BASE}/"},{"@type":"ListItem","position":2,"name":"الإعلانات","item":"${SEO_BASE}/ads"},{"@type":"ListItem","position":3,"name":"${adTitle.replace(/"/g,'\\"')}","item":"${pageUrl}"}]}</script>
  <link rel="icon" type="image/png" href="/favicon.png"/>
</head>
<body style="font-family:Arial,sans-serif;direction:rtl;padding:20px;max-width:800px;margin:auto;color:#222">
  <header style="border-bottom:2px solid #c0392b;padding-bottom:12px;margin-bottom:20px">
    <a href="${SEO_BASE}" style="text-decoration:none;color:#c0392b;font-weight:bold;font-size:20px">🛒 شبكة سوق للإعلانات</a>
    ${category ? `<span style="color:#888;margin-right:12px;font-size:14px">← ${category}</span>` : ""}
  </header>
  <main>
    <h1 style="font-size:26px;margin:0 0 10px">${adTitle}</h1>
    ${price ? `<p style="font-size:22px;font-weight:bold;color:#c0392b;margin:8px 0">💰 ${price}</p>` : ""}
    <p style="color:#666;margin:6px 0;font-size:15px">📍 ${region}</p>
    ${ad.media_type === "image" && rawMedia ? `<img src="${imageUrl}" alt="${adTitle}" style="max-width:100%;border-radius:10px;margin:16px 0;display:block" loading="lazy"/>` : ""}
    ${ad.description ? `<div style="margin-top:16px;line-height:1.8;font-size:16px;white-space:pre-wrap;background:#f9f9f9;padding:16px;border-radius:8px">${escH(ad.description)}</div>` : ""}
    <a href="${pageUrl}" style="display:inline-block;margin-top:24px;padding:14px 28px;background:#c0392b;color:white;text-decoration:none;border-radius:8px;font-weight:bold;font-size:16px">
      📱 عرض الإعلان كاملاً
    </a>
  </main>
  <footer style="margin-top:40px;padding-top:16px;border-top:1px solid #eee;color:#999;font-size:13px">
    <a href="${SEO_BASE}/ads" style="color:#c0392b;text-decoration:none">تصفح جميع الإعلانات</a> |
    <a href="${SEO_BASE}" style="color:#c0392b;text-decoration:none;margin-right:8px">الرئيسية</a>
  </footer>
</body>
</html>`);
    } catch { next(); }
  });

  app.get("/channels/:id", async (req, res, next) => {
    const ua = req.headers["user-agent"] || "";
    if (!BOT_UA.test(ua)) return next();

    const chId = parseInt(req.params.id);
    if (isNaN(chId)) return next();

    try {
      const chR = await db.execute(
        sql`SELECT id, name, description, avatar_url, cover_url FROM channels WHERE id = ${chId} LIMIT 1`
      );
      if (!chR.rows.length) return next();
      const ch: any = chR.rows[0];

      const pageUrl  = `${SEO_BASE}/channels/${chId}`;
      const rawAvatar = ch.avatar_url || ch.cover_url || "";
      const imageUrl = rawAvatar.startsWith("http") ? rawAvatar : rawAvatar ? `${SEO_BASE}${rawAvatar}` : `${SEO_BASE}/icons/icon-512.png`;
      const chName   = escH(ch.name || "قناة");
      const chDesc   = escH(ch.description || `تابع قناة ${ch.name} على شبكة سوق للإعلانات`);

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=300");
      res.send(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${chName} | قنوات شبكة سوق للإعلانات</title>
  <meta name="description" content="${chDesc} — قناة رقمية على شبكة سوق للإعلانات ads-as.com"/>
  <meta name="robots" content="index, follow"/>
  <link rel="canonical" href="${pageUrl}"/>
  <meta property="og:type" content="website"/>
  <meta property="og:url" content="${pageUrl}"/>
  <meta property="og:title" content="${chName}"/>
  <meta property="og:description" content="${chDesc}"/>
  <meta property="og:image" content="${imageUrl}"/>
  <meta property="og:site_name" content="شبكة سوق للإعلانات"/>
  <meta property="og:locale" content="ar_EG"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="${chName}"/>
  <meta name="twitter:description" content="${chDesc}"/>
  <meta name="twitter:image" content="${imageUrl}"/>
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"${chName.replace(/"/g,'\\"')}","description":"${chDesc.replace(/"/g,'\\"')}","url":"${pageUrl}","logo":"${imageUrl}"}</script>
  <link rel="icon" type="image/png" href="/favicon.png"/>
</head>
<body style="font-family:Arial,sans-serif;direction:rtl;padding:20px;max-width:800px;margin:auto;text-align:center">
  <header style="border-bottom:2px solid #c0392b;padding-bottom:12px;margin-bottom:20px;text-align:right">
    <a href="${SEO_BASE}" style="text-decoration:none;color:#c0392b;font-weight:bold;font-size:20px">🛒 شبكة سوق للإعلانات</a>
  </header>
  ${rawAvatar ? `<img src="${imageUrl}" alt="${chName}" style="width:120px;height:120px;border-radius:50%;object-fit:cover;margin:16px auto;display:block"/>` : ""}
  <h1 style="font-size:26px;margin:10px 0">${chName}</h1>
  ${ch.description ? `<p style="color:#555;line-height:1.8;max-width:500px;margin:10px auto;font-size:16px">${chDesc}</p>` : ""}
  <a href="${pageUrl}" style="display:inline-block;margin-top:20px;padding:14px 28px;background:#c0392b;color:white;text-decoration:none;border-radius:8px;font-weight:bold;font-size:16px">
    📺 زيارة القناة
  </a>
</body>
</html>`);
    } catch { next(); }
  });

  return httpServer;
}
