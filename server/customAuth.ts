import type { Express, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { checkIsAdmin } from "./adminCheck";
import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { ReplitConnectors } from "@replit/connectors-sdk";

const RESET_TTL_MS = 10 * 60 * 1000;
const PROOF_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const GENERIC_RESET_MESSAGE = "إذا كان الحساب مسجلاً، فسنرسل رمز تحقق إلى وسيلة الاتصال المختارة";
const ipResetRequests = new Map<string, number[]>();

function resetSecret(): string {
  const dedicated = process.env.PASSWORD_RESET_HMAC_SECRET?.trim();
  const sessionSecret = process.env.SESSION_SECRET?.trim();
  const keyMaterial = dedicated && dedicated.length >= 32 ? dedicated : sessionSecret;
  if (!keyMaterial || keyMaterial.length < 32) {
    throw new Error("Password reset protection is not configured");
  }
  return createHmac("sha256", keyMaterial).update("password-reset-hmac-v1").digest("hex");
}

function keyedHash(kind: string, challengeId: string, value: string): string {
  return createHmac("sha256", resetSecret()).update(`${kind}:${challengeId}:${value}`).digest("hex");
}

function requestIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || "unknown";
}

function consumeIpLimit(ip: string): boolean {
  const now = Date.now();
  if (ipResetRequests.size > 10_000) {
    ipResetRequests.forEach((times, key) => {
      if (!times.some((time: number) => now - time < 60 * 60 * 1000)) ipResetRequests.delete(key);
    });
    while (ipResetRequests.size > 10_000) {
      const oldestKey = ipResetRequests.keys().next().value;
      if (!oldestKey) break;
      ipResetRequests.delete(oldestKey);
    }
  }
  const recent = (ipResetRequests.get(ip) || []).filter((time) => now - time < 60 * 60 * 1000);
  if (recent.length >= 10) return false;
  recent.push(now);
  ipResetRequests.set(ip, recent);
  return true;
}

function hashesEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

function validIdentifier(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 254) return false;
  const input = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input) || /^\+?[0-9]{8,15}$/.test(input);
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  return `${local.slice(0, 2)}${"*".repeat(Math.max(2, local.length - 2))}@${domain}`;
}

function maskPhone(phone: string): string {
  return `${phone.slice(0, Math.min(3, phone.length))}${"*".repeat(Math.max(3, phone.length - 5))}${phone.slice(-2)}`;
}

async function sendResetOtp(channel: "email" | "sms", destination: string, otp: string) {
  const connectors = new ReplitConnectors();
  if (channel === "email") {
    const from = process.env.PASSWORD_RESET_EMAIL_FROM;
    if (!from) throw new Error("PASSWORD_RESET_EMAIL_FROM is not configured");
    const response = await connectors.proxy("resend", "/emails", {
      method: "POST",
      body: {
        from,
        to: [destination],
        subject: "رمز إعادة تعيين كلمة المرور",
        html: `<p dir="rtl">رمز التحقق الخاص بك هو <strong>${otp}</strong>. تنتهي صلاحيته خلال 10 دقائق. لا تشاركه مع أحد.</p>`,
      },
    });
    if (!response.ok) throw new Error(`Resend delivery failed (${response.status})`);
    return;
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!accountSid || !from) throw new Error("Twilio sender configuration is missing");
  const body = new URLSearchParams({
    To: destination,
    From: from,
    Body: `رمز إعادة تعيين كلمة المرور: ${otp}. صالح لمدة 10 دقائق.`,
  });
  const response = await connectors.proxy(
    "twilio",
    `/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`,
    { method: "POST", body, headers: { "Content-Type": "application/x-www-form-urlencoded" } },
  );
  if (!response.ok) throw new Error(`Twilio delivery failed (${response.status})`);
}

function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => error ? reject(error) : resolve());
  });
}

function saveSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.save((error) => error ? reject(error) : resolve());
  });
}

// ── Extend session ────────────────────────────────────────────────
declare module "express-session" {
  interface SessionData {
    customUser?: {
      id: string;
      email: string | null;
      phone: string | null;
      firstName: string | null;
      lastName: string | null;
      profileImageUrl: string | null;
    };
  }
}

// ── Middleware: check custom session first, then Replit passport ──
export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  // Custom session auth
  if ((req.session as any).customUser) {
    const u = (req.session as any).customUser;
    (req as any).user = {
      claims: {
        sub:               u.id,
        email:             u.email,
        first_name:        u.firstName,
        last_name:         u.lastName,
        profile_image_url: u.profileImageUrl,
      },
    };
    return next();
  }
  // Fallback: Replit passport (keeps backward compat during transition)
  if ((req as any).user) return next();
  return res.status(401).json({ message: "Unauthorized" });
}

// ── Register custom auth routes ───────────────────────────────────
export function registerCustomAuthRoutes(app: Express) {
  // ── GET /api/auth/user ──────────────────────────────────────────
  app.get("/api/auth/user", async (req: Request, res: Response) => {
    const u = (req.session as any).customUser;
    if (u) {
      const isAdmin = await checkIsAdmin({ id: u.id, email: u.email });
      return res.json({
        id:              u.id,
        email:           u.email,
        firstName:       u.firstName,
        lastName:        u.lastName,
        profileImageUrl: u.profileImageUrl,
        isAdmin,
        createdAt:       new Date().toISOString(),
        updatedAt:       new Date().toISOString(),
      });
    }
    // Replit passport fallback
    if ((req as any).user) {
      const c = (req as any).user.claims;
      const isAdmin = await checkIsAdmin({ id: c.sub, email: c.email });
      return res.json({
        id:              c.sub,
        email:           c.email,
        firstName:       c.first_name,
        lastName:        c.last_name,
        profileImageUrl: c.profile_image_url,
        isAdmin,
        createdAt:       new Date().toISOString(),
        updatedAt:       new Date().toISOString(),
      });
    }
    return res.status(401).json({ message: "Unauthorized" });
  });

  // ── POST /api/auth/login ────────────────────────────────────────
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const { identifier, password } = req.body; // identifier = email or phone
    if (!identifier || !password)
      return res.status(400).json({ message: "البريد / الهاتف وكلمة المرور مطلوبة" });

    try {
      const result = await db.execute(
        sql`SELECT id, email, phone, first_name, last_name, profile_image_url, password_hash
            FROM users
            WHERE (LOWER(email) = LOWER(${identifier}) OR phone = ${identifier})
            LIMIT 1`
      );
      const user: any = result.rows[0];
      if (!user) return res.status(401).json({ message: "بيانات تسجيل الدخول غير صحيحة" });

      // First-time login for Replit-imported accounts (no password set)
      if (!user.password_hash)
        return res.status(403).json({ message: "يلزم التحقق من وسيلة الاتصال لتعيين كلمة مرور" });

      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) return res.status(401).json({ message: "بيانات تسجيل الدخول غير صحيحة" });

      await regenerateSession(req);
      (req.session as any).customUser = {
        id:              user.id,
        email:           user.email,
        phone:           user.phone,
        firstName:       user.first_name,
        lastName:        user.last_name,
        profileImageUrl: user.profile_image_url,
      };
      await saveSession(req);

      res.json({ success: true, user: { id: user.id, email: user.email, firstName: user.first_name, lastName: user.last_name } });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ── POST /api/auth/register ─────────────────────────────────────
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    const { firstName, lastName, email, phone, password } = req.body;
    if (!password || password.length < 6)
      return res.status(400).json({ message: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" });
    if (!email && !phone)
      return res.status(400).json({ message: "البريد الإلكتروني أو رقم الهاتف مطلوب" });

    try {
      // Check duplicate
      const existing = await db.execute(
        sql`SELECT id FROM users WHERE (email IS NOT NULL AND LOWER(email) = LOWER(${email || ""}))
            OR (phone IS NOT NULL AND phone = ${phone || ""}) LIMIT 1`
      );
      if (existing.rows[0])
        return res.status(409).json({ message: "البريد الإلكتروني أو رقم الهاتف مسجل بالفعل" });

      const hash = await bcrypt.hash(password, 10);
      const newId = uuidv4();

      await db.execute(
        sql`INSERT INTO users (id, email, phone, first_name, last_name, password_hash)
            VALUES (${newId}, ${email || null}, ${phone || null}, ${firstName || null}, ${lastName || null}, ${hash})`
      );

      await regenerateSession(req);
      (req.session as any).customUser = {
        id:              newId,
        email:           email || null,
        phone:           phone || null,
        firstName:       firstName || null,
        lastName:        lastName || null,
        profileImageUrl: null,
      };
      await saveSession(req);

      res.status(201).json({ success: true, user: { id: newId, email, firstName, lastName } });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ── POST /api/auth/set-password (verified recovery only) ────────
  app.post("/api/auth/set-password", async (req: Request, res: Response) => {
    const { challengeId, resetProof, password } = req.body;
    if (
      typeof challengeId !== "string" || typeof resetProof !== "string" ||
      typeof password !== "string" || password.length < 8 || password.length > 128
    )
      return res.status(400).json({ message: "بيانات غير صحيحة" });
    try {
      const proofHash = keyedHash("proof", challengeId, resetProof);
      const passwordHash = await bcrypt.hash(password, 12);
      const user = await db.transaction(async (tx) => {
        const result = await tx.execute(sql`
          SELECT c.user_id, u.id, u.email, u.phone, u.first_name, u.last_name, u.profile_image_url
          FROM password_reset_challenges c
          JOIN users u ON u.id = c.user_id
          WHERE c.id = ${challengeId}
            AND c.proof_hash = ${proofHash}
            AND c.verified_at IS NOT NULL
            AND c.proof_expires_at > NOW()
            AND c.used_at IS NULL
          FOR UPDATE OF c
        `);
        const selected: any = result.rows[0];
        if (!selected) return null;
        await tx.execute(sql`UPDATE users SET password_hash = ${passwordHash}, updated_at = NOW() WHERE id = ${selected.user_id}`);
        await tx.execute(sql`
          UPDATE password_reset_challenges SET used_at = NOW()
          WHERE user_id = ${selected.user_id} AND used_at IS NULL
        `);
        return selected;
      });
      if (!user) return res.status(400).json({ message: "انتهت صلاحية جلسة إعادة التعيين، ابدأ من جديد" });

      // Remove old custom-login sessions. The current anonymous reset session
      // is then regenerated below, preventing session fixation.
      await db.execute(sql`
        DELETE FROM sessions
        WHERE sess->'customUser'->>'id' = ${user.id}
           OR sess->'passport'->'user'->'claims'->>'sub' = ${user.id}
           OR sess->'passport'->'user'->>'id' = ${user.id}
      `);
      await regenerateSession(req);
      (req.session as any).customUser = {
        id:              user.id,
        email:           user.email,
        phone:           user.phone,
        firstName:       user.first_name,
        lastName:        user.last_name,
        profileImageUrl: user.profile_image_url,
      };
      req.session.save((error) => {
        if (error) return res.status(500).json({ message: "تعذر إنشاء جلسة تسجيل الدخول" });
        res.json({ success: true });
      });
    } catch (e: any) {
      console.error("[Password reset] completion failed:", e?.message);
      res.status(500).json({ message: "تعذر إكمال إعادة تعيين كلمة المرور" });
    }
  });

  // ── POST /api/auth/forgot-password ─────────────────────────────
  app.post("/api/auth/forgot-password", async (req: Request, res: Response) => {
    const { identifier, channel } = req.body;
    if (!validIdentifier(identifier))
      return res.status(400).json({ message: "أدخل بريداً إلكترونياً أو رقم هاتف صالحاً" });
    if (channel !== undefined && channel !== "email" && channel !== "sms")
      return res.status(400).json({ message: "قناة الإرسال غير صالحة" });
    const ip = requestIp(req);
    if (!consumeIpLimit(ip))
      return res.status(429).json({ message: GENERIC_RESET_MESSAGE, retryAfterSeconds: 60 });

    try {
      resetSecret();
      const lookup = identifier.trim();
      const result = await db.execute(
        sql`SELECT id, email, phone FROM users
            WHERE LOWER(email) = LOWER(${lookup}) OR phone = ${lookup}
            LIMIT 1`
      );
      const user: any = result.rows[0];
      const fallbackChannel: "email" | "sms" = lookup.includes("@") ? "email" : "sms";
      const selectedChannel: "email" | "sms" = fallbackChannel;
      const destination = user
        ? (selectedChannel === "email" ? user.email : user.phone)
        : null;
      const deliverable = !!destination && (!channel || channel === selectedChannel);
      const masked = destination
        ? (selectedChannel === "email" ? maskEmail(destination) : maskPhone(destination))
        : (selectedChannel === "email" ? maskEmail(lookup) : maskPhone(lookup));
      const identifierHash = keyedHash("identifier", "global", lookup.toLowerCase());

      const rateResult = await db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour')::int AS hourly_count,
          MAX(last_sent_at) AS last_sent_at,
          (ARRAY_AGG(id ORDER BY last_sent_at DESC))[1] AS latest_id
        FROM password_reset_challenges WHERE identifier_hash = ${identifierHash}
      `);
      const rate: any = rateResult.rows[0];
      const lastSent = rate?.last_sent_at ? new Date(rate.last_sent_at).getTime() : 0;
      const coolingDown = Date.now() - lastSent < RESEND_COOLDOWN_MS;
      if ((rate?.hourly_count || 0) >= 5 || coolingDown) {
        return res.status(202).json({
          message: GENERIC_RESET_MESSAGE,
          challengeId: rate.latest_id || randomBytes(24).toString("hex"),
          channel: selectedChannel,
          destination: masked,
          expiresInSeconds: 600,
          resendAfterSeconds: 60,
        });
      }

      const challengeId = randomBytes(24).toString("hex");
      const otp = randomInt(0, 1_000_000).toString().padStart(6, "0");
      await db.execute(sql`
        INSERT INTO password_reset_challenges
          (id, user_id, identifier_hash, channel, destination_masked, otp_hash, expires_at, request_ip_hash)
        VALUES (
          ${challengeId}, ${user?.id || null}, ${identifierHash}, ${selectedChannel}, ${masked},
          ${keyedHash("otp", challengeId, otp)}, ${new Date(Date.now() + RESET_TTL_MS)},
          ${keyedHash("ip", challengeId, ip)}
        )
      `);
      // Respond before external delivery so provider latency cannot reveal
      // whether the identifier matched an account.
      if (deliverable) {
        void sendResetOtp(selectedChannel, destination, otp).catch(async (deliveryError: any) => {
          await db.execute(sql`UPDATE password_reset_challenges SET used_at = NOW() WHERE id = ${challengeId}`).catch(() => undefined);
          console.error("[Password reset] OTP delivery failed:", deliveryError?.message);
        });
      }
      return res.status(202).json({
        message: GENERIC_RESET_MESSAGE,
        challengeId,
        channel: selectedChannel,
        destination: masked,
        expiresInSeconds: 600,
        resendAfterSeconds: 60,
      });
    } catch (e: any) {
      console.error("[Password reset] request failed:", e?.message);
      res.status(500).json({ message: "تعذر بدء إعادة تعيين كلمة المرور" });
    }
  });

  // ── POST /api/auth/verify-reset-otp ─────────────────────────────
  app.post("/api/auth/verify-reset-otp", async (req: Request, res: Response) => {
    const { challengeId, otp } = req.body;
    if (typeof challengeId !== "string" || !/^\d{6}$/.test(otp || ""))
      return res.status(400).json({ message: "رمز التحقق غير صالح أو منتهي" });
    try {
      const otpHash = keyedHash("otp", challengeId, otp);
      const proof = randomBytes(32).toString("base64url");
      const verified = await db.transaction(async (tx) => {
        const result = await tx.execute(sql`
          SELECT id, otp_hash, attempts FROM password_reset_challenges
          WHERE id = ${challengeId} AND used_at IS NULL AND verified_at IS NULL
          FOR UPDATE
        `);
        const challenge: any = result.rows[0];
        if (!challenge || challenge.attempts >= 5) return false;
        if (!hashesEqual(challenge.otp_hash, otpHash)) {
          await tx.execute(sql`
            UPDATE password_reset_challenges
            SET attempts = attempts + 1,
                used_at = CASE WHEN attempts + 1 >= 5 THEN NOW() ELSE used_at END
            WHERE id = ${challengeId}
          `);
          return false;
        }
        const update = await tx.execute(sql`
          UPDATE password_reset_challenges
          SET verified_at = NOW(), proof_hash = ${keyedHash("proof", challengeId, proof)},
              proof_expires_at = ${new Date(Date.now() + PROOF_TTL_MS)}
          WHERE id = ${challengeId} AND expires_at > NOW()
          RETURNING id
        `);
        return update.rows.length === 1;
      });
      if (!verified) return res.status(400).json({ message: "رمز التحقق غير صالح أو منتهي" });
      return res.json({ resetProof: proof, expiresInSeconds: 300 });
    } catch (e: any) {
      console.error("[Password reset] verification failed:", e?.message);
      return res.status(500).json({ message: "تعذر التحقق من الرمز" });
    }
  });

  // ── PATCH /api/auth/me/interests ───────────────────────────────
  app.patch("/api/auth/me/interests", async (req: Request, res: Response) => {
    const u = (req.session as any).customUser;
    const userId: string | undefined = u?.id || (req as any).user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const { interests } = req.body;
    if (!Array.isArray(interests)) return res.status(400).json({ message: "interests must be array" });
    const interestsStr = interests.filter(Boolean).join(",");
    await db.execute(sql`UPDATE users SET interests = ${interestsStr} WHERE id = ${userId}`);
    res.json({ ok: true });
  });

  // ── GET/POST /api/logout ────────────────────────────────────────
  const doLogout = (req: Request, res: Response) => {
    req.session.destroy(() => {});
    res.redirect("/login");
  };
  app.get("/api/logout", doLogout);
  app.post("/api/auth/logout", doLogout);

  // ── GET /api/login → redirect to /login page (no Replit) ───────
  app.get("/api/login", (_req: Request, res: Response) => {
    res.redirect("/login");
  });
}
