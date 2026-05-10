// Replit OIDC integration — fully optional.
// On local dev / VPS where REPL_ID is missing or empty, openid-client is
// NEVER imported and no discovery is performed. Custom email/password auth
// (server/customAuth.ts) remains fully functional.

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { randomBytes } from "crypto";
import { authStorage } from "./storage";

// Type-only imports keep compile-time safety without loading the modules
// at runtime. The actual modules are loaded via dynamic import below.
import type * as OidcClient from "openid-client";
import type { Strategy as OidcStrategy, VerifyFunction } from "openid-client/passport";

type OidcModule = typeof OidcClient;
type OidcConfig = Awaited<ReturnType<OidcModule["discovery"]>>;
type OidcTokens = OidcClient.TokenEndpointResponse & OidcClient.TokenEndpointResponseHelpers;

// Treat undefined OR empty string as "not set"
function getReplId(): string | null {
  const v = process.env.REPL_ID;
  return v && v.trim().length > 0 ? v.trim() : null;
}

const SESSION_SECRET_FALLBACK = randomBytes(32).toString("hex");

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  const secret = process.env.SESSION_SECRET || SESSION_SECRET_FALLBACK;
  const isProd = process.env.NODE_ENV === "production";
  return session({
    secret,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      // secure cookies require HTTPS — break local http://localhost dev
      secure: isProd,
      maxAge: sessionTtl,
    },
  });
}

// Lazy holders — populated only when REPL_ID is present.
let oidcModule: OidcModule | null = null;
let oidcConfig: OidcConfig | null = null;

async function loadOidcConfig(replId: string): Promise<OidcConfig> {
  if (oidcConfig) return oidcConfig;
  // Dynamic import — openid-client is NOT loaded at module init time
  oidcModule = (await import("openid-client")) as OidcModule;
  oidcConfig = await oidcModule.discovery(
    new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
    replId
  );
  return oidcConfig;
}

interface SessionUser {
  claims?: Record<string, unknown> & { exp?: number };
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
}

function updateUserSession(user: SessionUser, tokens: OidcTokens) {
  user.claims = tokens.claims() as SessionUser["claims"];
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(claims: Record<string, unknown>) {
  await authStorage.upsertUser({
    id: claims["sub"] as string,
    email: claims["email"] as string | undefined,
    firstName: claims["first_name"] as string | undefined,
    lastName: claims["last_name"] as string | undefined,
    profileImageUrl: claims["profile_image_url"] as string | undefined,
  });
}

function registerNoopAuthRoutes(app: Express) {
  app.get("/api/login", (_req, res) => res.redirect("/"));
  app.get("/api/callback", (_req, res) => res.redirect("/"));
  app.get("/api/logout", (req, res) => {
    req.logout(() => res.redirect("/"));
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  const replId = getReplId();
  if (!replId) {
    console.log("[Auth] Replit OIDC disabled (REPL_ID not set). Custom email/password auth still active.");
    registerNoopAuthRoutes(app);
    return;
  }

  // From here on REPL_ID is guaranteed to be a non-empty string.
  let config: OidcConfig;
  let clientLib: OidcModule;
  let StrategyCtor: typeof OidcStrategy;
  try {
    config = await loadOidcConfig(replId);
    clientLib = oidcModule!;
    const passportMod = (await import("openid-client/passport")) as typeof import("openid-client/passport");
    StrategyCtor = passportMod.Strategy;
  } catch (e) {
    console.warn("[Auth] Replit OIDC setup failed, falling back to no-op:", (e as Error).message);
    registerNoopAuthRoutes(app);
    return;
  }

  const verify: VerifyFunction = async (
    tokens: OidcTokens,
    verified: passport.AuthenticateCallback
  ) => {
    const user: SessionUser = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims() as Record<string, unknown>);
    verified(null, user);
  };

  const registeredStrategies = new Set<string>();
  const ensureStrategy = (domain: string) => {
    const strategyName = `replitauth:${domain}`;
    if (!registeredStrategies.has(strategyName)) {
      const strategy = new StrategyCtor(
        {
          name: strategyName,
          config,
          scope: "openid email profile offline_access",
          callbackURL: `https://${domain}/api/callback`,
        },
        verify
      );
      passport.use(strategy);
      registeredStrategies.add(strategyName);
    }
  };

  app.get("/api/login", (req, res, next) => {
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login",
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        clientLib.buildEndSessionUrl(config, {
          client_id: replId,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as SessionUser | undefined;

  if (!req.isAuthenticated() || !user?.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const replId = getReplId();
  if (!replId || !oidcModule || !oidcConfig) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const tokenResponse = await oidcModule.refreshTokenGrant(oidcConfig, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};
