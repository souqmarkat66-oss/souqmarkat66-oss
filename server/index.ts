import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { db } from "./db";
import { sql } from "drizzle-orm";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

async function runMigrations() {
  try {
    await db.execute(sql`ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS order_number TEXT UNIQUE`);
    await db.execute(sql`ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS ad_id INTEGER`);
    await db.execute(sql`ALTER TABLE ads ADD COLUMN IF NOT EXISTS target_lat REAL`);
    await db.execute(sql`ALTER TABLE ads ADD COLUMN IF NOT EXISTS target_lng REAL`);
    await db.execute(sql`ALTER TABLE ads ADD COLUMN IF NOT EXISTS target_radius_km REAL`);
    await db.execute(sql`ALTER TABLE channels ADD COLUMN IF NOT EXISTS publisher_code TEXT UNIQUE`);
    // Auto-generate publisher codes for channels that don't have one
    const channels = await db.execute(sql`SELECT id FROM channels WHERE publisher_code IS NULL`);
    for (const ch of channels.rows as any[]) {
      const code = `PUB-${ch.id}-${Math.random().toString(36).substring(2,6).toUpperCase()}`;
      await db.execute(sql`UPDATE channels SET publisher_code = ${code} WHERE id = ${ch.id} AND publisher_code IS NULL`);
    }
    // New tables
    await db.execute(sql`CREATE TABLE IF NOT EXISTS favorites (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR NOT NULL,
      ad_id INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, ad_id)
    )`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS ratings (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR NOT NULL,
      user_name TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      rating INTEGER NOT NULL,
      review TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, target_type, target_id)
    )`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS offers (
      id SERIAL PRIMARY KEY,
      from_user_id VARCHAR NOT NULL,
      from_user_name TEXT NOT NULL,
      ad_id INTEGER NOT NULL,
      offer_amount_egp REAL NOT NULL,
      message TEXT,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW()
    )`);
    await db.execute(sql`ALTER TABLE ads ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP`);
    await db.execute(sql`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS voice_url TEXT`);
    await db.execute(sql`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS sender_user_id VARCHAR`);
    await db.execute(sql`ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS is_voice BOOLEAN DEFAULT FALSE`);
    await db.execute(sql`ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS voice_url TEXT`);
    await db.execute(sql`ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS image_url TEXT`);
    await db.execute(sql`ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS is_payment_proof BOOLEAN DEFAULT FALSE`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS governorate TEXT`);
    await db.execute(sql`ALTER TABLE ads ADD COLUMN IF NOT EXISTS target_interests TEXT`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS interests TEXT`);
    await db.execute(sql`ALTER TABLE ads ADD COLUMN IF NOT EXISTS target_ages TEXT`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20)`);
    await db.execute(sql`ALTER TABLE boost_orders ADD COLUMN IF NOT EXISTS payment_screenshot_url TEXT`);
    await db.execute(sql`ALTER TABLE boost_orders ADD COLUMN IF NOT EXISTS payment_method TEXT`);
    await db.execute(sql`ALTER TABLE payment_notifications ADD COLUMN IF NOT EXISTS screenshot_url TEXT`);
    await db.execute(sql`ALTER TABLE payment_notifications ADD COLUMN IF NOT EXISTS payer_user_id VARCHAR(100)`);
    await db.execute(sql`ALTER TABLE ads ADD COLUMN IF NOT EXISTS is_boosted BOOLEAN DEFAULT FALSE`);
    await db.execute(sql`ALTER TABLE ads ADD COLUMN IF NOT EXISTS boosted_until TIMESTAMP`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS renewal_orders (
      id SERIAL PRIMARY KEY,
      order_number VARCHAR NOT NULL UNIQUE,
      ad_id INTEGER NOT NULL,
      user_id VARCHAR NOT NULL,
      duration_days INTEGER NOT NULL DEFAULT 30,
      amount NUMERIC(10,2) NOT NULL DEFAULT 0,
      status VARCHAR NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW()
    )`);
    await db.execute(sql`INSERT INTO platform_settings (key, value) VALUES
      ('renewal_price_30', '50'),
      ('renewal_price_60', '90'),
      ('renewal_price_90', '130')
      ON CONFLICT (key) DO NOTHING`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS referrals (
      id SERIAL PRIMARY KEY,
      referrer_id VARCHAR NOT NULL,
      referred_id VARCHAR NOT NULL,
      bonus_egp NUMERIC(10,2) DEFAULT 5,
      status VARCHAR DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW()
    )`);
    await db.execute(sql`INSERT INTO platform_settings (key, value) VALUES
      ('ai_price_image', '10'),
      ('ai_price_video', '50'),
      ('ai_price_animation', '80'),
      ('ai_price_content', '5'),
      ('ai_price_post', '8'),
      ('ai_referral_bonus_egp', '5')
      ON CONFLICT (key) DO NOTHING`);
    await db.execute(sql`
      UPDATE users SET referral_code = UPPER(SUBSTRING(MD5(id::text) FROM 1 FOR 8))
      WHERE referral_code IS NULL
    `);
    await db.execute(sql`ALTER TABLE ads ADD COLUMN IF NOT EXISTS whatsapp_clicks INTEGER DEFAULT 0`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS push_subscriptions (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR NOT NULL,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS boost_orders (
      id SERIAL PRIMARY KEY,
      order_number VARCHAR NOT NULL UNIQUE,
      ad_id INTEGER NOT NULL,
      user_id VARCHAR NOT NULL,
      amount NUMERIC(10,2) NOT NULL DEFAULT 0,
      payment_ref VARCHAR NOT NULL,
      status VARCHAR NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW()
    )`);
    // Generate VAPID keys for push notifications if not present
    const vapidCheck = await db.execute(sql`SELECT value FROM platform_settings WHERE key = 'vapid_public_key' LIMIT 1`);
    if (vapidCheck.rows.length === 0) {
      const wpModule = await import('web-push');
      const webpush = (wpModule as any).default || wpModule;
      const vapidKeys = webpush.generateVAPIDKeys();
      await db.execute(sql`INSERT INTO platform_settings (key, value) VALUES ('vapid_public_key', ${vapidKeys.publicKey}) ON CONFLICT (key) DO NOTHING`);
      await db.execute(sql`INSERT INTO platform_settings (key, value) VALUES ('vapid_private_key', ${vapidKeys.privateKey}) ON CONFLICT (key) DO NOTHING`);
      console.log('VAPID keys generated');
    }
    // Backfill users.interests from their own ads' target_interests
    await db.execute(sql`
      UPDATE users u
      SET interests = (
        SELECT STRING_AGG(DISTINCT trim(elem), ',')
        FROM ads a,
             LATERAL unnest(string_to_array(a.target_interests, ',')) AS elem
        WHERE a.user_id = u.id
          AND a.target_interests IS NOT NULL
          AND a.target_interests <> ''
      )
      WHERE u.interests IS NULL
        AND EXISTS (
          SELECT 1 FROM ads a2
          WHERE a2.user_id = u.id
            AND a2.target_interests IS NOT NULL
            AND a2.target_interests <> ''
        )
    `);
    // Backfill users.governorate from their most recent ad's target_region
    await db.execute(sql`
      UPDATE users u
      SET governorate = (
        SELECT SPLIT_PART(a.target_region, ',', 1)
        FROM ads a
        WHERE a.user_id = u.id
          AND a.target_region IS NOT NULL
          AND a.target_region <> ''
        ORDER BY a.created_at DESC
        LIMIT 1
      )
      WHERE u.governorate IS NULL
        AND EXISTS (
          SELECT 1 FROM ads a2
          WHERE a2.user_id = u.id
            AND a2.target_region IS NOT NULL
            AND a2.target_region <> ''
        )
    `);
    console.log("Migrations applied successfully");
  } catch (e: any) {
    console.error("Migration warning:", e.message);
  }
}

(async () => {
  await runMigrations();
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
