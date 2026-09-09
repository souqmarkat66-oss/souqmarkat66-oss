import type { Express, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { checkIsAdmin } from "./adminCheck";
import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { disconnectUserSockets } from "./socketRegistry";

const RESET_TTL_MS = 10 * 60 * 1000;
const PROOF_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const GENERIC_RESET_MESSAGE = "إذا كان البريد مسجلاً، فسنرسل إليه رمز تحقق";
const ipResetRequests = new Map<string, number[]>();
const ipResetCompletions = new Map<string, number[]>();

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

function consumeResetCompletionLimit(ip: string): boolean {
  const now = Date.now();
  const recent = (ipResetCompletions.get(ip) || []).filter((time) => now - time < 15 * 60 * 1000);
  if (recent.length >= 10) return false;
  recent.push(now);
  ipResetCompletions.set(ip, recent);
  if (ipResetCompletions.size > 10_000) {
    ipResetCompletions.forEach((times: number[], key: string) => {
      if (!times.some(time => now - time < 15 * 60 * 1000)) ipResetCompletions.delete(key);
    });
  }
  return true;
}

function hashesEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

function validIdentifier(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 254) return false;
  const input = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  return `${local.slice(0, 2)}${"*".repeat(Math.max(2, local.length - 2))}@${domain}`;
}

async function sendResetOtp(destination: string, otp: string) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const emailFrom = process.env.PASSWORD_RESET_EMAIL_FROM?.trim();
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured");
  if (!emailFrom) throw new Error("PASSWORD_RESET_EMAIL_FROM is not configured");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: emailFrom,
      to: [destination],
      subject: "رمز إعادة تعيين كلمة المرور",
      html: `<p dir="rtl">رمز التحقق الخاص بك هو <strong>${otp}</strong>. تنتهي صلاحيته خلال 10 دقائق. لا تشاركه مع أحد.</p>`,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Resend delivery failed (${response.status})`);
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
      authGeneration: number;
    };
  }
}

async function currentCustomUser(req: Request) {
  const user = (req.session as any).customUser;
  if (!user || !Number.isInteger(user.authGeneration)) {
    if (user) delete (req.session as any).customUser;
    return null;
  }
  const result = await db.execute(sql`SELECT auth_generation FROM users WHERE id = ${user.id} LIMIT 1`);
  const currentGeneration = Number((result.rows[0] as any)?.auth_generation);
  if (!Number.isInteger(currentGeneration) || currentGeneration !== user.authGeneration) {
    delete (req.session as any).customUser;
    return null;
  }
  return user;
}

async function currentPassportUser(req: Request) {
  const user = (req as any).user;
  const userId = user?.claims?.sub;
  const capturedGeneration = Number(user?.authGeneration);
  if (!userId || !Number.isInteger(capturedGeneration)) {
    if (userId) {
      delete (req.session as any).passport;
      (req as any).user = undefined;
    }
    return null;
  }
  const result = await db.execute(sql`SELECT auth_generation FROM users WHERE id = ${String(userId)} LIMIT 1`);
  const currentGeneration = Number((result.rows[0] as any)?.auth_generation);
  if (!Number.isInteger(currentGeneration) || currentGeneration !== capturedGeneration) {
    delete (req.session as any).passport;
    (req as any).user = undefined;
    return null;
  }
  return user;
}

export async function validatedAuthUserId(req: Request): Promise<string | null> {
  const customUser = await currentCustomUser(req);
  if (customUser) return String(customUser.id);
  const passportUser = await currentPassportUser(req);
  return passportUser?.claims?.sub ? String(passportUser.claims.sub) : null;
}

// ── Middleware: check custom session first, then Replit passport ──
export async function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  try {
    const u = await currentCustomUser(req);
    if (u) {
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
    // Replit Passport sessions carry the generation captured at OIDC login.
    const passportUser = await currentPassportUser(req);
    if (passportUser) return next();
    return res.status(401).json({ message: "Unauthorized" });
  } catch (error) {
    next(error);
  }
}

// ── Register custom auth routes ───────────────────────────────────
export function registerCustomAuthRoutes(app: Express) {
  // ── GET /api/auth/user ──────────────────────────────────────────
  app.get("/api/auth/user", async (req: Request, res: Response) => {
    const u = await currentCustomUser(req);
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
    // Replit passport fallback, with the same revocation-generation check.
    const passportUser = await currentPassportUser(req);
    if (passportUser) {
      const c = passportUser.claims;
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
        sql`SELECT id, email, phone, first_name, last_name, profile_image_url, password_hash, auth_generation
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
        authGeneration:  Number(user.auth_generation),
      };
      await saveSession(req);

      res.json({ success: true, user: { id: user.id, email: user.email, firstName: user.first_name, lastName: user.last_name } });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ── POST /api/auth/register ─────────────────────────────────────
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    const { firstName, lastName, email, password } = req.body;
    if (!password || password.length < 6)
      return res.status(400).json({ message: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" });
    if (!validIdentifier(email))
      return res.status(400).json({ message: "بريد إلكتروني صالح مطلوب لاسترجاع الحساب" });
    const normalizedEmail = normalizeEmail(email);

    try {
      // Check duplicate
      const existing = await db.execute(
        sql`SELECT id FROM users WHERE email IS NOT NULL AND LOWER(BTRIM(email)) = ${normalizedEmail} LIMIT 1`
      );
      if (existing.rows[0])
        return res.status(409).json({ message: "البريد الإلكتروني مسجل بالفعل" });

      const hash = await bcrypt.hash(password, 10);
      const newId = uuidv4();

      await db.execute(
        sql`INSERT INTO users (id, email, phone, first_name, last_name, password_hash)
            VALUES (${newId}, ${normalizedEmail}, NULL, ${firstName || null}, ${lastName || null}, ${hash})`
      );

      await regenerateSession(req);
      (req.session as any).customUser = {
        id:              newId,
        email:           normalizedEmail,
        phone:           null,
        firstName:       firstName || null,
        lastName:        lastName || null,
        profileImageUrl: null,
        authGeneration:  0,
      };
      await saveSession(req);

      res.status(201).json({ success: true, user: { id: newId, email: normalizedEmail, firstName, lastName } });
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
    if (!consumeResetCompletionLimit(requestIp(req)))
      return res.status(429).json({ message: "محاولات كثيرة، حاول لاحقاً" });
    try {
      const proofHash = keyedHash("proof", challengeId, resetProof);
      // Reject invented or expired proofs before paying bcrypt's CPU cost.
      // The transaction below repeats the check under a row lock.
      const preliminary = await db.execute(sql`
        SELECT 1 FROM password_reset_challenges
        WHERE id = ${challengeId}
          AND proof_hash = ${proofHash}
          AND verified_at IS NOT NULL
          AND proof_expires_at > NOW()
          AND used_at IS NULL
        LIMIT 1
      `);
      if (preliminary.rows.length === 0)
        return res.status(400).json({ message: "انتهت صلاحية جلسة إعادة التعيين، ابدأ من جديد" });
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
        const updated = await tx.execute(sql`
          UPDATE users
          SET password_hash = ${passwordHash},
              auth_generation = auth_generation + 1,
              updated_at = NOW()
          WHERE id = ${selected.user_id}
          RETURNING auth_generation
        `);
        selected.auth_generation = Number((updated.rows[0] as any)?.auth_generation);
        await tx.execute(sql`
          UPDATE password_reset_challenges SET used_at = NOW()
          WHERE user_id = ${selected.user_id} AND used_at IS NULL
        `);
        // Password change, challenge consumption, and old-session revocation
        // must either all commit or all roll back.
        await tx.execute(sql`
          DELETE FROM sessions
          WHERE sess->'customUser'->>'id' = ${selected.user_id}
             OR sess->'passport'->'user'->'claims'->>'sub' = ${selected.user_id}
             OR sess->'passport'->'user'->>'id' = ${selected.user_id}
        `);
        return selected;
      });
      if (!user) return res.status(400).json({ message: "انتهت صلاحية جلسة إعادة التعيين، ابدأ من جديد" });

      disconnectUserSockets(String(user.id));
      // The current anonymous reset session is regenerated after all prior
      // authenticated sessions were revoked, preventing session fixation.
      await regenerateSession(req);
      (req.session as any).customUser = {
        id:              user.id,
        email:           user.email,
        phone:           user.phone,
        firstName:       user.first_name,
        lastName:        user.last_name,
        profileImageUrl: user.profile_image_url,
        authGeneration:  user.auth_generation,
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
    const { identifier } = req.body;
    if (!validIdentifier(identifier))
      return res.status(400).json({ message: "أدخل بريداً إلكترونياً صالحاً" });
    const ip = requestIp(req);
    if (!consumeIpLimit(ip))
      return res.status(429).json({ message: GENERIC_RESET_MESSAGE, retryAfterSeconds: 60 });

    try {
      resetSecret();
      const lookup = normalizeEmail(identifier);
      const result = await db.execute(
        sql`SELECT id, email, phone FROM users
            WHERE LOWER(BTRIM(email)) = ${lookup}
            LIMIT 1`
      );
      const user: any = result.rows[0];
      const selectedChannel = "email";
      const destination = user?.email || null;
      const deliverable = !!destination;
      // Derive all response-visible values from the request, never from the
      // matched database row, so canonicalization cannot reveal account existence.
      const masked = maskEmail(lookup);
      const identifierHash = keyedHash("identifier", "global", lookup);

      const challengeId = randomBytes(24).toString("hex");
      const otp = randomInt(0, 1_000_000).toString().padStart(6, "0");
      const issuance = await db.transaction(async tx => {
        // Serialize all issuance decisions for this normalized email, including
        // requests arriving from different application instances or IPs.
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${identifierHash}, 0))`);
        const rateResult = await tx.execute(sql`
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
          return { challengeId: rate.latest_id || randomBytes(24).toString("hex"), shouldSend: false };
        }
        await tx.execute(sql`
          INSERT INTO password_reset_challenges
            (id, user_id, identifier_hash, channel, destination_masked, otp_hash, expires_at, request_ip_hash)
          VALUES (
            ${challengeId}, ${user?.id || null}, ${identifierHash}, ${selectedChannel}, ${masked},
            ${keyedHash("otp", challengeId, otp)}, ${new Date(Date.now() + RESET_TTL_MS)},
            ${keyedHash("ip", challengeId, ip)}
          )
        `);
        return { challengeId, shouldSend: deliverable };
      });
      // Respond before external delivery so provider latency cannot reveal
      // whether the identifier matched an account.
      if (issuance.shouldSend) {
        void sendResetOtp(destination, otp).catch(async (deliveryError: any) => {
          await db.execute(sql`UPDATE password_reset_challenges SET used_at = NOW() WHERE id = ${issuance.challengeId}`).catch(() => undefined);
          console.error("[Password reset] OTP delivery failed:", deliveryError?.message);
        });
      }
      return res.status(202).json({
        message: GENERIC_RESET_MESSAGE,
        challengeId: issuance.challengeId,
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
  app.patch("/api/auth/me/interests", isAuthenticated, async (req: Request, res: Response) => {
    const userId = String((req as any).user.claims.sub);
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
