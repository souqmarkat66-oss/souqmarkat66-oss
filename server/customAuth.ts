import type { Express, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

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

// ── Normalize Egyptian phone numbers ─────────────────────────────
function normalizePhone(raw: string): string {
  let p = raw.replace(/[\s\-().]/g, "");
  if (p.startsWith("+20")) p = "0" + p.slice(3);
  if (p.startsWith("20") && p.length >= 12) p = "0" + p.slice(2);
  if (/^[17]\d{8}$/.test(p)) p = "0" + p; // 9 digits missing leading 0
  return /^0[0-9]{9,10}$/.test(p) ? p : "";
}

// ── Ensure columns exist ──────────────────────────────────────────
async function ensureColumns() {
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20)`);
}

// ── Register custom auth routes ───────────────────────────────────
export function registerCustomAuthRoutes(app: Express) {
  ensureColumns().catch(console.error);

  // ── GET /api/auth/user ──────────────────────────────────────────
  app.get("/api/auth/user", (req: Request, res: Response) => {
    const u = (req.session as any).customUser;
    if (u) {
      return res.json({
        id:              u.id,
        email:           u.email,
        firstName:       u.firstName,
        lastName:        u.lastName,
        profileImageUrl: u.profileImageUrl,
        createdAt:       new Date().toISOString(),
        updatedAt:       new Date().toISOString(),
      });
    }
    // Replit passport fallback
    if ((req as any).user) {
      const c = (req as any).user.claims;
      return res.json({
        id:              c.sub,
        email:           c.email,
        firstName:       c.first_name,
        lastName:        c.last_name,
        profileImageUrl: c.profile_image_url,
        createdAt:       new Date().toISOString(),
        updatedAt:       new Date().toISOString(),
      });
    }
    return res.status(401).json({ message: "Unauthorized" });
  });

  // ── POST /api/auth/login ────────────────────────────────────────
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const { identifier, password } = req.body;
    if (!identifier || !password)
      return res.status(400).json({ message: "البريد / الهاتف وكلمة المرور مطلوبة" });

    const id = String(identifier).trim();
    const phone = normalizePhone(id);

    try {
      const result = await db.execute(
        sql`SELECT id, email, phone, first_name, last_name, profile_image_url, password_hash
            FROM users
            WHERE (LOWER(email) = LOWER(${id})
               OR phone = ${id}
               OR (${phone} <> '' AND phone = ${phone})
               OR id = ${id})
            LIMIT 1`
      );
      const user: any = result.rows[0];
      if (!user) return res.status(401).json({ message: "البريد الإلكتروني أو رقم الهاتف أو الـ ID غير موجود" });

      if (!user.password_hash) {
        return res.status(403).json({ message: "first_login", userId: user.id });
      }

      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) return res.status(401).json({ message: "كلمة المرور غير صحيحة" });

      (req.session as any).customUser = {
        id:              user.id,
        email:           user.email,
        phone:           user.phone,
        firstName:       user.first_name,
        lastName:        user.last_name,
        profileImageUrl: user.profile_image_url,
      };

      req.session.save((err) => {
        if (err) return res.status(500).json({ message: "خطأ في حفظ الجلسة" });
        res.json({ success: true, user: { id: user.id, email: user.email, firstName: user.first_name, lastName: user.last_name } });
      });
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

      (req.session as any).customUser = {
        id:              newId,
        email:           email || null,
        phone:           phone || null,
        firstName:       firstName || null,
        lastName:        lastName || null,
        profileImageUrl: null,
      };

      req.session.save((err) => {
        if (err) return res.status(500).json({ message: "خطأ في حفظ الجلسة" });
        res.status(201).json({ success: true, user: { id: newId, email, firstName, lastName } });
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ── POST /api/auth/set-password (first-login / forgot-password) ─
  app.post("/api/auth/set-password", async (req: Request, res: Response) => {
    const { userId, password } = req.body;
    if (!userId || !password || password.length < 6)
      return res.status(400).json({ message: "بيانات غير صحيحة" });
    try {
      const hash = await bcrypt.hash(password, 10);
      await db.execute(sql`UPDATE users SET password_hash = ${hash} WHERE id = ${userId}`);
      const result = await db.execute(
        sql`SELECT id, email, phone, first_name, last_name, profile_image_url FROM users WHERE id = ${userId} LIMIT 1`
      );
      const user: any = result.rows[0];
      if (!user) return res.status(404).json({ message: "المستخدم غير موجود" });
      (req.session as any).customUser = {
        id:              user.id,
        email:           user.email,
        phone:           user.phone,
        firstName:       user.first_name,
        lastName:        user.last_name,
        profileImageUrl: user.profile_image_url,
      };
      // Explicitly save session before responding
      req.session.save((err) => {
        if (err) return res.status(500).json({ message: "خطأ في حفظ الجلسة" });
        res.json({ success: true });
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ── POST /api/auth/forgot-password ─────────────────────────────
  app.post("/api/auth/forgot-password", async (req: Request, res: Response) => {
    const { email, phone, identifier } = req.body;
    const raw = (identifier || email || phone || "").trim();
    if (!raw)
      return res.status(400).json({ message: "البريد الإلكتروني أو رقم الهاتف أو الـ ID مطلوب" });
    const normalizedPhone = normalizePhone(raw);
    try {
      const result = await db.execute(
        sql`SELECT id, email, phone, first_name FROM users
            WHERE (LOWER(email) = LOWER(${raw})
               OR phone = ${raw}
               OR (${normalizedPhone} <> '' AND phone = ${normalizedPhone})
               OR id = ${raw})
            LIMIT 1`
      );
      const user: any = result.rows[0];
      if (!user) return res.status(200).json({ message: "not_found", userId: null, notFound: true });
      // Clear password to force reset
      await db.execute(sql`UPDATE users SET password_hash = NULL WHERE id = ${user.id}`);
      return res.json({ message: "ok", userId: user.id, firstName: user.first_name });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
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
