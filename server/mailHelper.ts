import nodemailer from "nodemailer";

/**
 * Mail delivery is deliberately kept separate from authentication state
 * changes.  A provider timeout can happen after the provider accepted a
 * message, so callers must never consume a recovery secret just because this
 * function rejects.
 */
export type MailDeliveryOutcome = "rejected" | "ambiguous";

export class MailDeliveryError extends Error {
  readonly code: string;
  readonly outcome: MailDeliveryOutcome;

  constructor(code: string, outcome: MailDeliveryOutcome = "ambiguous") {
    super(code);
    this.name = "MailDeliveryError";
    this.code = code;
    this.outcome = outcome;
  }
}

const MAIL_TIMEOUT_MS = 20_000;

function configuredSender(): string {
  const sender = process.env.PASSWORD_RESET_EMAIL_FROM?.trim();
  if (!sender) throw new MailDeliveryError("MAIL_SENDER_NOT_CONFIGURED", "rejected");
  return sender;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface MailMessage {
  from: string;
  to: string;
  subject: string;
  html: string;
}

export function buildPasswordResetMessage(destination: string, otp: string): MailMessage {
  return {
    from: configuredSender(),
    to: destination,
    subject: "رمز إعادة تعيين كلمة المرور",
    html: `<p dir="rtl">رمز التحقق الخاص بك هو <strong>${otp}</strong>. تنتهي صلاحيته خلال 10 دقائق. لا تشاركه مع أحد.</p>`,
  };
}

export function buildRegistrationWelcomeMessage(
  destination: string,
  firstName?: string | null,
): MailMessage {
  const safeFirstName = typeof firstName === "string" ? firstName.trim() : "";
  const greeting = safeFirstName
    ? `مرحباً ${escapeHtml(safeFirstName)}،`
    : "مرحباً،";
  return {
    from: configuredSender(),
    to: destination,
    subject: "تم تسجيل حسابك بنجاح",
    // This is an informational notification only.  It intentionally does
    // not say that the address was verified or that ownership was proven.
    html: [
      `<p dir="rtl">${greeting}</p>`,
      `<p dir="rtl"><strong>تم تسجيل حسابك بنجاح.</strong></p>`,
      `<p dir="rtl">يمكنك الآن تسجيل الدخول إلى حسابك.</p>`,
      `<p dir="rtl">هذه رسالة إشعار فقط، ولا تُثبت ملكية البريد الإلكتروني أو تؤكدها.</p>`,
    ].join(""),
  };
}

function timeoutErrorCode(provider: "SMTP" | "RESEND"): string {
  return `${provider}_TIMEOUT`;
}

function classifyProviderError(provider: "SMTP" | "RESEND", error: unknown): MailDeliveryError {
  const candidate = error as { code?: unknown; responseCode?: unknown } | null;
  const code = typeof candidate?.code === "string" ? candidate.code.toUpperCase() : "";
  const responseCode = Number(candidate?.responseCode);
  if (
    provider === "SMTP" &&
    (code === "EAUTH" || responseCode === 530 || responseCode === 534 || responseCode === 535)
  ) {
    return new MailDeliveryError("SMTP_AUTH_FAILED", "rejected");
  }
  if (
    code === "ETIMEDOUT" ||
    code === "ESOCKET" ||
    code === "ECONNRESET" ||
    code === "ECONNABORTED" ||
    code === "ABORT_ERR" ||
    code === "TIMEOUT"
  ) {
    return new MailDeliveryError(timeoutErrorCode(provider), "ambiguous");
  }
  if (provider === "RESEND" && Number.isInteger(responseCode) && responseCode >= 400) {
    return new MailDeliveryError(`RESEND_HTTP_${responseCode}`, "rejected");
  }
  return new MailDeliveryError(`${provider}_DELIVERY_FAILED`, "ambiguous");
}

async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  provider: "SMTP" | "RESEND",
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new MailDeliveryError(timeoutErrorCode(provider))), timeoutMs);
  });
  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function smtpConfiguration() {
  const host = process.env.EMAIL_HOST?.trim();
  const portValue = process.env.EMAIL_PORT?.trim();
  const user = process.env.EMAIL_USER?.trim();
  const pass = process.env.EMAIL_PASS?.trim();
  const hasAnySetting = !!(host || portValue || user || pass);
  if (!hasAnySetting) return null;
  if (!host || !user || !pass) {
    throw new MailDeliveryError("SMTP_CONFIGURATION_INCOMPLETE", "rejected");
  }
  const port = portValue ? Number(portValue) : 465;
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new MailDeliveryError("SMTP_PORT_INVALID", "rejected");
  }
  return { host, port, user, pass };
}

async function sendViaSmtp(message: MailMessage): Promise<void> {
  const configuration = smtpConfiguration();
  if (!configuration) throw new MailDeliveryError("SMTP_CONFIGURATION_MISSING", "rejected");
  const transport = nodemailer.createTransport({
    host: configuration.host,
    port: configuration.port,
    secure: configuration.port === 465,
    requireTLS: configuration.port !== 465,
    auth: { user: configuration.user, pass: configuration.pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
    tls: {
      minVersion: "TLSv1.2",
      servername: configuration.host,
    },
  });
  try {
    await withTimeout(transport.sendMail(message), MAIL_TIMEOUT_MS, "SMTP");
  } catch (error) {
    if (error instanceof MailDeliveryError) throw error;
    throw classifyProviderError("SMTP", error);
  } finally {
    transport.close();
  }
}

async function sendViaResend(message: MailMessage): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) throw new MailDeliveryError("RESEND_NOT_CONFIGURED", "rejected");
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: message.from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw Object.assign(new Error("provider rejected message"), { responseCode: response.status });
    }
  } catch (error) {
    if (error instanceof MailDeliveryError) throw error;
    throw classifyProviderError("RESEND", error);
  }
}

/**
 * SMTP is selected whenever any SMTP setting exists.  In particular, an SMTP
 * authentication failure is not silently sent through Resend; that would
 * obscure the operator error and can send from an unintended provider.
 */
export async function sendMail(message: MailMessage): Promise<void> {
  if (smtpConfiguration()) {
    await sendViaSmtp(message);
    return;
  }
  await sendViaResend(message);
}

export async function sendPasswordResetOtp(destination: string, otp: string): Promise<void> {
  await sendMail(buildPasswordResetMessage(destination, otp));
}

export async function sendRegistrationWelcome(
  destination: string,
  firstName?: string | null,
): Promise<void> {
  await sendMail(buildRegistrationWelcomeMessage(destination, firstName));
}

/**
 * Keep operational logging free of provider messages, addresses, credentials,
 * and response bodies.  The returned value is safe to include in server logs.
 */
export function mailErrorSummary(error: unknown): string {
  if (error instanceof MailDeliveryError) return error.code;
  return "MAIL_DELIVERY_FAILED";
}