import { strict as assert } from "node:assert";
import test from "node:test";
import {
  buildRegistrationWelcomeMessage,
  sendPasswordResetOtp,
} from "./mailHelper";

// customAuth owns the database pool at module load time.  Keep this focused
// unit test independent from a provisioned database; no query is performed.
const originalDatabaseUrl = process.env.DATABASE_URL;
if (!originalDatabaseUrl) process.env.DATABASE_URL = "postgres://127.0.0.1:5432/auth-unit-test";
const {
  isTerminalResetChallenge,
  normalizeOtpDigits,
} = await import("./customAuth");
if (!originalDatabaseUrl) delete process.env.DATABASE_URL;

test("server OTP normalization accepts Arabic, Persian, and full-width numerals", () => {
  assert.equal(normalizeOtpDigits("١٢٣٤٥٦"), "123456");
  assert.equal(normalizeOtpDigits("۱۲۳۴۵۶"), "123456");
  assert.equal(normalizeOtpDigits("１２３４５６"), "123456");
  assert.equal(normalizeOtpDigits(" ۱۲۳۴۵۶ "), "123456");
  assert.equal(normalizeOtpDigits("12345"), null);
  assert.equal(normalizeOtpDigits("12345a"), null);
});

test("terminal reset challenges are never eligible for cooldown reuse", () => {
  const now = Date.parse("2026-01-01T00:00:00.000Z");
  const active = { attempts: 0, expiresAt: now + 60_000 };
  assert.equal(isTerminalResetChallenge(active, now), false);
  assert.equal(isTerminalResetChallenge({ ...active, usedAt: now }, now), true);
  assert.equal(isTerminalResetChallenge({ ...active, verifiedAt: now }, now), true);
  assert.equal(isTerminalResetChallenge({ ...active, attempts: 5 }, now), true);
  assert.equal(
    isTerminalResetChallenge({ ...active, expiresAt: now }, now),
    true,
  );
});

test("a possible provider acceptance does not consume the OTP challenge", async () => {
  const saved = {
    sender: process.env.PASSWORD_RESET_EMAIL_FROM,
    resendKey: process.env.RESEND_API_KEY,
    emailHost: process.env.EMAIL_HOST,
    emailPort: process.env.EMAIL_PORT,
    emailUser: process.env.EMAIL_USER,
    emailPass: process.env.EMAIL_PASS,
    fetch: globalThis.fetch,
  };
  const challenge = { attempts: 0, expiresAt: Date.now() + 60_000 };
  try {
    process.env.PASSWORD_RESET_EMAIL_FROM = "no-reply@example.test";
    process.env.RESEND_API_KEY = "unit-test-key";
    delete process.env.EMAIL_HOST;
    delete process.env.EMAIL_PORT;
    delete process.env.EMAIL_USER;
    delete process.env.EMAIL_PASS;
    globalThis.fetch = (async () => {
      // The transport cannot know whether the provider accepted a message
      // before this connection-level failure.  Recovery state must remain live.
      throw Object.assign(new Error("connection lost after provider acceptance"), {
        code: "ETIMEDOUT",
      });
    }) as typeof fetch;

    await assert.rejects(
      sendPasswordResetOtp("recipient@example.test", "123456"),
      /RESEND_TIMEOUT/,
    );
    assert.equal(isTerminalResetChallenge(challenge), false);
  } finally {
    if (saved.sender === undefined) delete process.env.PASSWORD_RESET_EMAIL_FROM;
    else process.env.PASSWORD_RESET_EMAIL_FROM = saved.sender;
    if (saved.resendKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = saved.resendKey;
    for (const [key, value] of [
      ["EMAIL_HOST", saved.emailHost],
      ["EMAIL_PORT", saved.emailPort],
      ["EMAIL_USER", saved.emailUser],
      ["EMAIL_PASS", saved.emailPass],
    ] as const) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    globalThis.fetch = saved.fetch;
  }
});

test("SMTP configuration errors do not silently fall back to Resend", async () => {
  const saved = {
    sender: process.env.PASSWORD_RESET_EMAIL_FROM,
    resendKey: process.env.RESEND_API_KEY,
    emailHost: process.env.EMAIL_HOST,
    emailPort: process.env.EMAIL_PORT,
    emailUser: process.env.EMAIL_USER,
    emailPass: process.env.EMAIL_PASS,
    fetch: globalThis.fetch,
  };
  let fallbackCalled = false;
  try {
    process.env.PASSWORD_RESET_EMAIL_FROM = "no-reply@example.test";
    process.env.RESEND_API_KEY = "unit-test-key";
    process.env.EMAIL_HOST = "smtp.example.test";
    process.env.EMAIL_PORT = "not-a-port";
    process.env.EMAIL_USER = "user@example.test";
    process.env.EMAIL_PASS = "not-a-real-password";
    globalThis.fetch = (async () => {
      fallbackCalled = true;
      throw new Error("Resend must not be selected");
    }) as typeof fetch;
    await assert.rejects(
      sendPasswordResetOtp("recipient@example.test", "123456"),
      /SMTP_PORT_INVALID/,
    );
    assert.equal(fallbackCalled, false);
  } finally {
    if (saved.sender === undefined) delete process.env.PASSWORD_RESET_EMAIL_FROM;
    else process.env.PASSWORD_RESET_EMAIL_FROM = saved.sender;
    if (saved.resendKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = saved.resendKey;
    for (const [key, value] of [
      ["EMAIL_HOST", saved.emailHost],
      ["EMAIL_PORT", saved.emailPort],
      ["EMAIL_USER", saved.emailUser],
      ["EMAIL_PASS", saved.emailPass],
    ] as const) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    globalThis.fetch = saved.fetch;
  }
});

test("registration welcome says success without claiming email verification", () => {
  const sender = process.env.PASSWORD_RESET_EMAIL_FROM;
  process.env.PASSWORD_RESET_EMAIL_FROM = "no-reply@example.test";
  try {
    const message = buildRegistrationWelcomeMessage("new@example.test", "ليلى");
    assert.equal(message.subject, "تم تسجيل حسابك بنجاح");
    assert.match(message.html, /تم تسجيل حسابك بنجاح/);
    assert.match(message.html, /رسالة إشعار فقط/);
    assert.doesNotMatch(message.html, /تم تأكيد|تم التحقق|تم توثيق/);
  } finally {
    if (sender === undefined) delete process.env.PASSWORD_RESET_EMAIL_FROM;
    else process.env.PASSWORD_RESET_EMAIL_FROM = sender;
  }
});