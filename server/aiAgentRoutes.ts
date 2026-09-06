import type { Express } from "express";
import { openai } from "./replit_integrations/image";
import { storage } from "./storage";
import { speechToText, ensureCompatibleFormat } from "./replit_integrations/audio";
import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const PROJECT_ROOT = process.cwd();

// The agent deliberately sees source, not credentials, runtime artefacts, or
// VCS internals. Keep this list shared by discovery, search, reads and writes.
const AGENT_EXCLUDED_DIRS = new Set([
  "node_modules", ".git", "dist", ".local", "backups", "uploads", "__pycache__",
  ".cache", "coverage", "attached_assets", ".agents",
]);
const AGENT_SECRET_NAMES = /(^|\/)(\.env(?:\..*)?|[^/]*\.(?:pem|key|p12|pfx)|id_(?:rsa|ed25519)|credentials(?:\..*)?|secrets?(?:\..*)?)$/i;
const MAX_FILE_BYTES = 64 * 1024;
const MAX_PLAN_FILES = 8;
const MAX_PLAN_TOTAL_BYTES = 192 * 1024;
const MAX_PREVIEW_BYTES = 220 * 1024;
const MAX_SEARCH_RESULTS = 100;
const PLAN_TTL_MS = 15 * 60 * 1000;
type AgentChange = { filePath: string; action: "create" | "modify" | "delete"; content?: string; description?: string };
type ApprovedPlan = { id: string; token: string; userId: string; expiresAt: number; used: boolean; plan: any; snapshots: Map<string, { exists: boolean; sha256: string | null }> };
const approvedPlans = new Map<string, ApprovedPlan>();
let workspaceExecutionLocked = false;
function fileSnapshot(full: string) {
  const exists = fs.existsSync(full);
  return { exists, sha256: exists ? crypto.createHash("sha256").update(fs.readFileSync(full)).digest("hex") : null };
}

function adminId(req: any): string {
  return String(req.user?.claims?.sub ?? req.user?.id ?? "");
}
function isExcludedRelative(relative: string): boolean {
  const normalized = relative.replace(/\\/g, "/");
  return AGENT_SECRET_NAMES.test(normalized) || normalized.split("/").some(part => AGENT_EXCLUDED_DIRS.has(part) || part.startsWith("."));
}
function safeAgentPath(relative: unknown, allowMissing = false): string {
  if (typeof relative !== "string" || !relative.trim() || relative.includes("\0")) throw new Error("مسار ملف غير صالح");
  const full = path.resolve(PROJECT_ROOT, relative);
  const rel = path.relative(PROJECT_ROOT, full);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel) || isExcludedRelative(rel)) throw new Error("المسار محمي أو خارج المشروع");
  if (!allowMissing && !fs.existsSync(full)) throw new Error("الملف غير موجود");
  if (fs.existsSync(full) && fs.lstatSync(full).isSymbolicLink()) throw new Error("الروابط الرمزية غير مسموحة");
  for (let parent = path.dirname(full); parent !== PROJECT_ROOT; parent = path.dirname(parent)) {
    if (fs.existsSync(parent) && fs.lstatSync(parent).isSymbolicLink()) throw new Error("مجلد رابط رمزي غير مسموح");
  }
  return full;
}
function boundedText(value: string, max = 64_000): string {
  return value.length > max ? `${value.slice(0, max)}\n… [تم اقتطاع الناتج]` : value;
}
function providerError(provider: string, status?: number): Error {
  const category = status === 401 ? "مفتاح غير صالح" : status === 403 ? "صلاحية مرفوضة" : status === 429 ? "تم تجاوز حد الطلبات" : status && status >= 500 ? "عطل مؤقت لدى المزود" : "تعذر تنفيذ الطلب";
  return new Error(`${provider}: ${category}`);
}
function proposedDiff(changes: AgentChange[]): string {
  const chunks: string[] = [];
  for (const c of changes) {
    let before = "";
    try { const full = safeAgentPath(c.filePath, c.action === "create"); if (fs.existsSync(full)) before = fs.readFileSync(full, "utf8"); } catch {}
    const after = c.action === "delete" ? "" : c.content || "";
    // A deliberately bounded unified-style preview. The authoritative git diff
    // after atomic execution is returned separately.
    chunks.push(`--- a/${c.filePath}\n+++ b/${c.filePath}\n@@ proposed ${c.action} @@`);
    if (c.action !== "create") chunks.push(...before.split(/\r?\n/).map(line => `-${line}`));
    if (c.action !== "delete") chunks.push(...after.split(/\r?\n/).map(line => `+${line}`));
  }
  const output = chunks.join("\n");
  if (Buffer.byteLength(output) > MAX_PREVIEW_BYTES) throw new Error("معاينة الفرق كاملة أكبر من حد الأمان؛ قسّم الخطة");
  return output;
}
function validationCommand(name: unknown): string[] | null {
  if (name === "typecheck") return ["npm", "run", "check"];
  if (name === "build") return ["npm", "run", "build"];
  return null;
}

async function runSafeReadCommand(input: unknown): Promise<{ stdout: string; stderr: string; success: boolean }> {
  if (typeof input !== "string" || !input.trim() || input.length > 300) {
    throw new Error("أمر قراءة غير صالح");
  }
  const parts = input.trim().split(/\s+/);
  const [command, ...args] = parts;

  if (command === "pwd" && args.length === 0) {
    return { stdout: `${PROJECT_ROOT}\n`, stderr: "", success: true };
  }
  if (command === "node" && args.length === 1 && args[0] === "--version") {
    const out = await execFileAsync("node", ["--version"], { cwd: PROJECT_ROOT, timeout: 10_000 });
    return { stdout: boundedText(out.stdout), stderr: boundedText(out.stderr), success: true };
  }
  if (command === "npm" && args.length === 2 && args[0] === "list" && args[1] === "--depth=0") {
    const out = await execFileAsync("npm", ["list", "--depth=0"], { cwd: PROJECT_ROOT, timeout: 30_000, maxBuffer: 1024 * 1024 });
    return { stdout: boundedText(out.stdout), stderr: boundedText(out.stderr), success: true };
  }
  if (command === "git" && args[0] === "status" && args.slice(1).every(arg => arg === "--short" || arg === "--branch")) {
    const out = await execFileAsync("git", ["status", ...args.slice(1)], { cwd: PROJECT_ROOT, timeout: 10_000 });
    return { stdout: boundedText(out.stdout), stderr: boundedText(out.stderr), success: true };
  }
  if (command === "git" && args[0] === "diff" && args.slice(1).every(arg => arg === "--stat" || arg === "--name-only")) {
    const out = await execFileAsync("git", ["diff", "--no-ext-diff", ...args.slice(1)], { cwd: PROJECT_ROOT, timeout: 15_000, maxBuffer: 1024 * 1024 });
    return { stdout: boundedText(out.stdout), stderr: boundedText(out.stderr), success: true };
  }
  if (command === "git" && args[0] === "log" && args.slice(1).every(arg => arg === "--oneline" || /^-[1-9][0-9]?$/.test(arg))) {
    const out = await execFileAsync("git", ["log", ...args.slice(1)], { cwd: PROJECT_ROOT, timeout: 10_000, maxBuffer: 1024 * 1024 });
    return { stdout: boundedText(out.stdout), stderr: boundedText(out.stderr), success: true };
  }
  if (command === "ls" && args.length <= 1) {
    const full = args.length ? safeAgentPath(args[0]) : PROJECT_ROOT;
    const stat = fs.statSync(full);
    if (!stat.isDirectory()) throw new Error("المسار ليس مجلداً");
    const stdout = fs.readdirSync(full, { withFileTypes: true })
      .filter(entry => !isExcludedRelative(path.relative(PROJECT_ROOT, path.join(full, entry.name))))
      .map(entry => `${entry.isDirectory() ? "d" : "-"} ${entry.name}`)
      .join("\n");
    return { stdout: boundedText(`${stdout}\n`), stderr: "", success: true };
  }
  if (command === "cat" && args.length === 1) {
    const full = safeAgentPath(args[0]);
    const stat = fs.statSync(full);
    if (!stat.isFile() || stat.size > MAX_FILE_BYTES) throw new Error("الملف غير صالح للقراءة أو كبير جداً");
    return { stdout: boundedText(fs.readFileSync(full, "utf8")), stderr: "", success: true };
  }

  throw new Error("الأمر غير مسموح. استخدم pwd أو ls أو cat أو git status/diff/log أو node --version أو npm list --depth=0");
}

async function runAgentTool(tool: string, args: any): Promise<unknown> {
  if (tool === "list") return { tree: buildTreeSummary() };
  if (tool === "read") {
    const full = safeAgentPath(args?.path);
    const stat = fs.statSync(full);
    if (!stat.isFile() || stat.size > MAX_FILE_BYTES) throw new Error("الملف غير قابل للقراءة ضمن ميزانية الوكيل");
    return { path: path.relative(PROJECT_ROOT, full), content: boundedText(fs.readFileSync(full, "utf8"), 48_000) };
  }
  if (tool === "search") {
    const query = String(args?.query || "").trim();
    if (query.length < 2 || query.length > 160) throw new Error("عبارة البحث غير صالحة");
    const results: any[] = [];
    const needle = query.toLowerCase();
    const walk = (dir: string, depth: number) => {
      if (depth > 8 || results.length >= MAX_SEARCH_RESULTS) return;
      let entries: fs.Dirent[] = []; try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        const full = path.join(dir, e.name), rel = path.relative(PROJECT_ROOT, full);
        if (isExcludedRelative(rel)) continue;
        if (e.isDirectory()) walk(full, depth + 1);
        else if (e.isFile()) try {
          if (fs.statSync(full).size > MAX_FILE_BYTES) continue;
          fs.readFileSync(full, "utf8").split(/\r?\n/).forEach((line, i) => {
            if (results.length < MAX_SEARCH_RESULTS && line.toLowerCase().includes(needle)) results.push({ path: rel, line: i + 1, text: boundedText(line, 300) });
          });
        } catch {}
      }
    };
    walk(PROJECT_ROOT, 0); return { results, truncated: results.length >= MAX_SEARCH_RESULTS };
  }
  if (tool === "git_status") return { output: boundedText((await execFileAsync("git", ["status", "--short"], { cwd: PROJECT_ROOT, timeout: 10_000 })).stdout) };
  if (tool === "git_diff") return { output: boundedText((await execFileAsync("git", ["diff", "--no-ext-diff"], { cwd: PROJECT_ROOT, timeout: 10_000, maxBuffer: 512 * 1024 })).stdout) };
  if (tool === "git_log") return { output: boundedText((await execFileAsync("git", ["log", "-5", "--oneline"], { cwd: PROJECT_ROOT, timeout: 10_000 })).stdout) };
  const command = validationCommand(tool);
  if (!command) throw new Error("أداة غير مسموحة");
  try {
    const out = await execFileAsync(command[0], command.slice(1), { cwd: PROJECT_ROOT, timeout: 120_000, maxBuffer: 1024 * 1024 });
    return { success: true, output: boundedText(`${out.stdout}${out.stderr}`) };
  } catch (e: any) { return { success: false, output: boundedText(`${e.stdout || ""}${e.stderr || e.message || ""}`) }; }
}

const ALLOWED_READ_CMDS = [
  /^ls(\s|$)/,
  /^pwd$/,
  /^cat\s+/,
  /^grep\s+/,
  /^find\s+/,
  /^ps(\s|$)/,
  /^df(\s|$)/,
  /^free(\s|$)/,
  /^echo\s+/,
  /^node\s+--version$/,
  /^npm\s+list/,
  /^git\s+log/,
  /^git\s+status/,
  /^git\s+diff/,
  /^wc\s+/,
  /^head\s+/,
  /^tail\s+/,
  /^du\s+/,
];

function isAllowedCmd(cmd: string): boolean {
  const trimmed = cmd.trim();
  // This legacy terminal is read-only. Changes go exclusively through a
  // server-bound approved plan; validation has its own exact allowlist.
  return !/[;&|`$><\n]/.test(trimmed)
    && !/(^|\s)\/|(^|\s)[^\s]*\.\.[^\s]*/.test(trimmed)
    && !/(^|\s)(?:\.env(?:\.\S*)?|.*\.(?:pem|key|p12|pfx)|id_rsa|id_ed25519|credentials|secrets?)(?:\s|$)/i.test(trimmed)
    && ALLOWED_READ_CMDS.some(r => r.test(trimmed));
}

/* ── ملخص شجرة المشروع (سياق عميق) — يُبنى ويُخزّن مؤقتاً 60 ثانية ── */
let treeSummaryCache: { text: string; at: number } | null = null;
function buildTreeSummary(): string {
  if (treeSummaryCache && Date.now() - treeSummaryCache.at < 60_000) return treeSummaryCache.text;
  const IGNORE = new Set([
    "node_modules", ".git", "dist", ".local", "backups",
    "uploads", "__pycache__", ".cache", "coverage", "attached_assets", ".agents",
  ]);
  const lines: string[] = [];
  function walk(dir: string, depth: number, prefix: string) {
    if (depth > 3 || lines.length > 350) return;
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (lines.length > 350) return;
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      if (IGNORE.has(e.name) || e.name.startsWith(".") || isExcludedRelative(rel)) continue;
      if (e.isDirectory()) {
        lines.push(`${rel}/`);
        walk(path.join(dir, e.name), depth + 1, rel);
      } else {
        lines.push(rel);
      }
    }
  }
  walk(PROJECT_ROOT, 0, "");
  const text = lines.join("\n");
  treeSummaryCache = { text, at: Date.now() };
  return text;
}

/* ── استدعاء Gemini (تعدد موديلات + بحث جوجل + فيديو/صور) ── */
type Attachment = { mimeType: string; data: string; name?: string };
async function callGemini(
  systemContent: string,
  messages: { role: string; content: string }[],
  attachments: Attachment[],
  webSearch: boolean,
  apiKey?: string,
): Promise<{ text: string; model: string }> {
  const key = apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) throw new Error("no_gemini_key");
  const contents = messages.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: String(m.content) }] as any[],
  }));
  if (attachments.length && contents.length) {
    const last = contents[contents.length - 1];
    for (const a of attachments.slice(0, 4)) {
      if (a?.data && a?.mimeType) {
        last.parts.push({ inline_data: { mime_type: a.mimeType, data: a.data } });
      }
    }
  }
  const body: any = {
    system_instruction: { parts: [{ text: systemContent }] },
    contents,
    generationConfig: { temperature: 0.3, maxOutputTokens: 8000 },
  };
  if (webSearch) body.tools = [{ google_search: {} }];
  // قائمة موديلات مرتبة من الأحدث للأقدم — لو موديل اتوقف (404) بنجرب اللي بعده تلقائياً
  let lastErr = "";
  for (const model of GEMINI_MODELS) {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    );
    if (r.ok) {
      const j: any = await r.json();
      const parts = j.candidates?.[0]?.content?.parts || [];
      return { text: parts.map((p: any) => p.text || "").filter(Boolean).join("\n"), model };
    }
    lastErr = providerError("Gemini", r.status).message;
    if (r.status !== 404) throw new Error(lastErr); // 404 فقط = الموديل اتشال، غيره خطأ حقيقي
  }
  throw new Error(lastErr || "Gemini: لا يوجد موديل متاح");
}
/* أحدث موديلات Gemini بالترتيب — عند توقف موديل بيتم التحويل للتالي بدون تدخل */
const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"];

/* ── استدعاء Anthropic Claude ── */
const ANTHROPIC_MODELS = ["claude-sonnet-4-5", "claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022"];

/** تحويل خطأ Anthropic HTTP إلى رسالة عربية واضحة */
async function parseAnthropicError(status: number, body: string): Promise<string> {
  // Provider response text may contain request details; never surface it.
  void body;
  if (status === 401)
    return "Claude: مفتاح غير صالح أو منتهي الصلاحية";
  if (status === 403)
    return "Claude: صلاحية مرفوضة";
  if (status === 429)
    return "Claude: تم تجاوز حد الطلبات";
  if (status >= 500)
    return "Claude: عطل مؤقت لدى المزود";
  return "Claude: تعذر تنفيذ الطلب";
}

async function callAnthropic(
  systemContent: string,
  messages: { role: string; content: string }[],
  attachments: Attachment[],
  apiKey: string,
): Promise<{ text: string; model: string }> {
  const anthropicMessages: any[] = messages.map(m => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content,
  }));
  // إضافة الصور إلى آخر رسالة مستخدم (Claude يدعم vision)
  const images = attachments.filter(a => a.mimeType.startsWith("image/"));
  if (images.length) {
    const lastIdx = anthropicMessages.length - 1;
    if (lastIdx >= 0 && anthropicMessages[lastIdx].role === "user") {
      anthropicMessages[lastIdx].content = [
        { type: "text", text: String(anthropicMessages[lastIdx].content) },
        ...images.map(a => ({
          type: "image",
          source: { type: "base64", media_type: a.mimeType as any, data: a.data },
        })),
      ];
    }
  }
  let lastErr = "";
  for (const model of ANTHROPIC_MODELS) {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        system: systemContent,
        messages: anthropicMessages,
        max_tokens: 8000,
        temperature: 0.3,
      }),
    });
    if (r.ok) {
      const j: any = await r.json();
      return { text: (j.content || []).map((b: any) => b.text || "").filter(Boolean).join("\n"), model };
    }
    const body = await r.text();
    if (r.status === 404) {
      // موديل غير متاح → جرب التالي
      lastErr = `Anthropic ${model} غير متاح (404)`;
      continue;
    }
    // أي خطأ آخر: حوّله لرسالة واضحة وارمِه فوراً
    throw new Error(await parseAnthropicError(r.status, body));
  }
  throw new Error(lastErr || "Claude: لا يوجد موديل متاح حالياً");
}

/* ── إدارة مزوّدي الموديلات الديناميكية ── */
const AI_PROVIDERS = ["openai", "gemini", "deepseek", "anthropic"] as const;
type AiProvider = (typeof AI_PROVIDERS)[number];
const PROVIDER_KEY_SETTING = (p: string) => `ai_agent_key_${p}`;
const ROUTING_SETTING = "ai_agent_routing";
const DEFAULT_ROUTING: Record<string, AiProvider> = { ui: "gemini", code: "anthropic", general: "openai" };
// سلاسل fallback حسب نوع الطلب — لو الموديل الأول غير متاح نجرب التالي
const INTENT_FALLBACK_CHAINS: Record<string, AiProvider[]> = {
  code:    ["anthropic", "deepseek", "openai"],
  ui:      ["gemini", "openai"],
  general: ["openai", "gemini"],
};

function maskKey(k: string): string {
  if (k.length <= 8) return "****";
  return `${k.slice(0, 4)}...${k.slice(-4)}`;
}

/* تشفير مفاتيح API قبل تخزينها (AES-256-GCM بمفتاح مشتق من SESSION_SECRET) */
import crypto from "crypto";
function encKey(): Buffer {
  const secret = process.env.SESSION_SECRET || "";
  if (!secret) throw new Error("SESSION_SECRET غير متوفر لتشفير المفاتيح");
  return crypto.createHash("sha256").update(`ai-agent-keys:${secret}`).digest();
}
function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `enc:v1:${iv.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${enc.toString("base64")}`;
}
function decryptSecret(stored: string): string | null {
  if (!stored) return null;
  if (!stored.startsWith("enc:v1:")) return stored; // توافق خلفي مع قيم قديمة غير مشفرة
  try {
    const [, , ivB64, tagB64, dataB64] = stored.split(":");
    const decipher = crypto.createDecipheriv("aes-256-gcm", encKey(), Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return null; // مفتاح تالف أو SESSION_SECRET اتغير
  }
}

async function getCustomKey(p: AiProvider): Promise<string | null> {
  try {
    const raw = await storage.getSetting(PROVIDER_KEY_SETTING(p));
    return raw ? decryptSecret(raw) : null;
  } catch { return null; }
}

async function providerAvailable(p: AiProvider): Promise<boolean> {
  if (await getCustomKey(p)) return true;
  if (p === "openai") return true; // متوفر دائماً عبر تكامل Replit
  if (p === "gemini") return !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
  return false; // deepseek و anthropic يحتاجان مفتاح مخصص
}

async function getRouting(): Promise<Record<string, AiProvider>> {
  try {
    const raw = await storage.getSetting(ROUTING_SETTING);
    if (raw) return { ...DEFAULT_ROUTING, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_ROUTING };
}

/* تصنيف نية الطلب: واجهات / كود ومنطق / عام */
function classifyIntent(text: string): "ui" | "code" | "general" {
  const t = text.toLowerCase();
  const uiWords = ["تصميم", "واجهة", "واجهات", "صفحة", "شكل", "ألوان", "الوان", "زر", "أزرار", "ستايل", "خط", "أيقونة", "css", "ui", "ux", "design", "layout", "tailwind", "responsive", "أنيميشن", "animation", "شاشة"];
  const codeWords = ["كود", "دالة", "باج", "خطأ", "أخطاء", "سكريبت", "منطق", "قاعدة بيانات", "استعلام", "api", "function", "bug", "error", "fix", "logic", "database", "sql", "endpoint", "socket", "refactor", "أداء", "performance", "اختبار", "test"];
  const uiScore = uiWords.filter(w => t.includes(w)).length;
  const codeScore = codeWords.filter(w => t.includes(w)).length;
  if (uiScore > codeScore && uiScore > 0) return "ui";
  if (codeScore > 0) return "code";
  return "general";
}

/* استدعاء DeepSeek (واجهة متوافقة مع OpenAI) */
async function callDeepSeek(
  systemContent: string,
  messages: { role: string; content: string }[],
  apiKey: string,
): Promise<string> {
  const r = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [{ role: "system", content: systemContent }, ...messages],
      temperature: 0.3,
      max_tokens: 4000,
    }),
  });
  if (!r.ok) throw providerError("DeepSeek", r.status);
  const j: any = await r.json();
  return j.choices?.[0]?.message?.content || "";
}

const AI_AGENT_SYSTEM_PROMPT = `أنت كبير مهندسي البرمجيات (Senior Lead Software Engineer) والعقل التقني المدبر لمشروع "شبكة سوق للإعلانات" (Souq Ads Network / سوق ماركات).

هويتك وأسلوبك:
- أنت لست مساعد ذكاء اصطناعي تقليدي — أنت شريك تقني حقيقي يعمل مع المالك يداً بيد، كأنكما جالسان في مكتب واحد.
- تتحدث معه بالعربية (وتفهم العامية المصرية بدقة تامة)، بأسلوب مهندس محترف: تحليل عميق، تفكير بشري حقيقي، ونقاش هندسي مدروس — ليس مجرد أكواد جاهزة.
- تفهم السياق الكامل للمشروع وتاريخه قبل أي رد. عند الغموض: اسأل وناقش قبل أن تفترض.
- عند وجود مشكلة: حلّل السبب الجذري (Root Cause) واشرحه بوضوح، ثم اقترح الحل الأمثل مع البدائل ومقارنة سريعة بينها عند اللزوم.
المشروع: منصة إعلانية ثنائية اللغة (عربي/إنجليزي) مع بث مباشر وشبكة إعلانات بنمط Meta/AdSense.
التقنيات: React 18 + TypeScript (Frontend) ، Node.js + Express + TypeScript (Backend) ، PostgreSQL + Drizzle ORM ، Tailwind CSS + shadcn/ui.
المسار الجذري: ${PROJECT_ROOT}
الملفات الرئيسية: server/routes.ts ، server/storage.ts ، shared/schema.ts ، client/src/App.tsx ، client/src/pages/
مهمتك: تحليل طلبات التطوير وإعداد خطط تنفيذ دقيقة. لا تنفذ أي تعديل دون موافقة صريحة من الأدمن.
للطلبات البرمجية، أرجع JSON فقط بهذا الشكل بدون أي نص خارج JSON:
{
  "type": "plan",
  "analysis": "تحليل الطلب والوضع الحالي بالتفصيل",
  "plan": ["الخطوة الأولى", "الخطوة الثانية"],
  "affectedFiles": ["server/routes.ts", "client/src/pages/Example.tsx"],
  "risks": ["وصف الخطر المحتمل"],
  "severity": "low",
  "proposedChanges": [
    {
      "filePath": "مسار الملف النسبي",
      "action": "create",
      "description": "وصف مختصر",
      "content": "الكود الكامل"
    }
  ],
  "requiresApproval": true
}
قيم severity: "low" | "medium" | "high"
قيم action: "create" | "modify" | "delete"
للأسئلة العامة والتحليل فقط:
{
  "type": "message",
  "content": "ردك هنا"
}
قاعدة صارمة: أرجع JSON صحيح فقط، بدون backticks أو أي نص خارج الـ JSON.
لو المستخدم أرفق صور أو فيديو: حلّلها بدقة (واجهات، تصميمات، أخطاء) واستخدمها في ردك.
لو تفعّل البحث على الويب: استخدم نتائج البحث الفعلية لأحدث الحلول والتوثيق، واذكر المصادر باختصار داخل ردك.

معاييرك الهندسية الإلزامية (World-class Standards):
1. عقلية مهندس النظام: قبل أي تعديل حلّل الترابط الكامل بين Frontend وBackend وقاعدة البيانات والـ API — لا تقترح تغييراً في جزء يكسر جزءاً آخر، واذكر التأثيرات المتبادلة في "analysis" و"risks".
2. الاستقرار أولاً: لا تقترح كوداً إلا وهو مكتمل وجاهز للتشغيل (Build-Ready) — بدون TODO ناقصة أو دوال وهمية. راجع الكود ذهنياً قبل إرجاعه (Self-Verification).
3. هوية بصرية أصلية: ممنوع القوالب الجاهزة الجنيرك. عند استلام مرجع بصري (صورة/فيديو) حلّله بدقة Pixel-perfect: الألوان، المسافات، الخطوط، الحركة — ونفّذه مطابقاً مع دمج منطق المشروع، بهوية "سوق ماركات" الفخمة.
4. التزم بأنماط المشروع القائمة: Tailwind + shadcn/ui، دعم RTL والعربية، والبنية الحالية للملفات.

بروتوكول التحقيق الذاتي:
- قبل اقتراح تعديل، استخدم أدوات التحقيق عند الحاجة. أرجع JSON فقط بالشكل {"type":"tool","tool":"list|search|read|git_status|git_diff|git_log|typecheck|build","args":{...}}.
- list لا يحتاج args؛ search يحتاج {"query":"..."}؛ read يحتاج {"path":"مسار نسبي"}؛ git_* و typecheck/build لا تحتاج args.
- ستستلم نتيجة الأداة في رسالة لاحقة؛ استمر بأداة واحدة فقط في كل رد. لا تطلب أو تقرأ أسراراً أو .env أو مفاتيح. لا تستخدم أوامر shell.
- بعد التحقيق أرجع حصراً plan أو message وفق المخطط أعلاه. خطط التعديل يجب أن تحتوي المحتوى الكامل لكل ملف.`;

export function registerAiAgentRoutes(
  app: Express,
  isAuthenticated: any,
  requireAdmin: any
) {
  // ── GET /api/admin/ai-agent/files ──────────────────────────────
  app.get(
    "/api/admin/ai-agent/files",
    isAuthenticated,
    requireAdmin,
    async (_req, res) => {
      try {
        const buildTree = (dirPath: string, depth = 0): any[] => {
          if (depth > 5) return [];
          let entries: fs.Dirent[];
          try {
            entries = fs.readdirSync(dirPath, { withFileTypes: true });
          } catch {
            return [];
          }
          return entries
            .filter(e => !AGENT_EXCLUDED_DIRS.has(e.name) && !e.name.startsWith(".") && !isExcludedRelative(path.relative(PROJECT_ROOT, path.join(dirPath, e.name))))
            .sort((a, b) => {
              if (a.isDirectory() && !b.isDirectory()) return -1;
              if (!a.isDirectory() && b.isDirectory()) return 1;
              return a.name.localeCompare(b.name);
            })
            .map(e => {
              const fullPath = path.join(dirPath, e.name);
              const relativePath = path.relative(PROJECT_ROOT, fullPath);
              if (e.isDirectory()) {
                return {
                  name: e.name,
                  path: relativePath,
                  type: "dir",
                  children: buildTree(fullPath, depth + 1),
                };
              }
              let size = 0;
              try { size = fs.statSync(fullPath).size; } catch {}
              return { name: e.name, path: relativePath, type: "file", size };
            });
        };
        res.json({ tree: buildTree(PROJECT_ROOT) });
      } catch (e: any) {
        res.status(500).json({ message: e.message });
      }
    }
  );

  // ── GET /api/admin/ai-agent/file-content ───────────────────────
  app.get(
    "/api/admin/ai-agent/file-content",
    isAuthenticated,
    requireAdmin,
    async (req, res) => {
      try {
        const filePath = req.query.path as string;
        if (!filePath)
          return res.status(400).json({ message: "path required" });
        const fullPath = safeAgentPath(filePath);
        const stats = fs.statSync(fullPath);
        if (!stats.isFile()) return res.status(400).json({ message: "المسار ليس ملفاً" });
        if (stats.size > MAX_FILE_BYTES)
          return res.status(413).json({ message: "File too large (max 256KB)" });
        const content = fs.readFileSync(fullPath, "utf-8");
        res.json({ content, size: stats.size });
      } catch (e: any) {
        res.status(500).json({ message: e.message });
      }
    }
  );

  // Fast, bounded source search. It never shells out, so query text cannot
  // become a command, and it applies the same protected-path policy as reads.
  app.get("/api/admin/ai-agent/search", isAuthenticated, requireAdmin, (req, res) => {
    try {
      const query = String(req.query.q || "").trim();
      if (query.length < 2 || query.length > 160) return res.status(400).json({ message: "استخدم عبارة بحث من 2 إلى 160 حرفاً" });
      const needle = query.toLocaleLowerCase();
      const results: { path: string; line: number; text: string }[] = [];
      const walk = (dir: string, depth: number) => {
        if (depth > 8 || results.length >= MAX_SEARCH_RESULTS) return;
        let entries: fs.Dirent[] = [];
        try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
        for (const entry of entries) {
          const full = path.join(dir, entry.name);
          const relative = path.relative(PROJECT_ROOT, full);
          if (isExcludedRelative(relative)) continue;
          if (entry.isDirectory()) walk(full, depth + 1);
          else if (entry.isFile()) {
            try {
              if (fs.statSync(full).size > MAX_FILE_BYTES) continue;
              const lines = fs.readFileSync(full, "utf8").split(/\r?\n/);
              for (let i = 0; i < lines.length && results.length < MAX_SEARCH_RESULTS; i++) {
                if (lines[i].toLocaleLowerCase().includes(needle)) results.push({ path: relative, line: i + 1, text: boundedText(lines[i], 300) });
              }
            } catch { /* unreadable/binary files are ignored */ }
          }
        }
      };
      walk(PROJECT_ROOT, 0);
      res.json({ results, truncated: results.length >= MAX_SEARCH_RESULTS });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/admin/ai-agent/git", isAuthenticated, requireAdmin, async (_req, res) => {
    try {
      const [status, diff, history] = await Promise.all([
        execFileAsync("git", ["status", "--short"], { cwd: PROJECT_ROOT, timeout: 10_000 }),
        execFileAsync("git", ["diff", "--no-ext-diff", "--stat"], { cwd: PROJECT_ROOT, timeout: 10_000 }),
        execFileAsync("git", ["log", "-5", "--oneline"], { cwd: PROJECT_ROOT, timeout: 10_000 }),
      ]);
      res.json({ status: boundedText(status.stdout), diff: boundedText(diff.stdout), history: boundedText(history.stdout) });
    } catch { res.status(200).json({ status: "", diff: "", history: "", unavailable: true }); }
  });

  app.post("/api/admin/ai-agent/validate", isAuthenticated, requireAdmin, async (req, res) => {
    const args = validationCommand(req.body?.validation);
    if (!args) return res.status(400).json({ message: "تحقق غير مسموح؛ الخيارات: typecheck أو build" });
    try {
      const result = await execFileAsync(args[0], args.slice(1), { cwd: PROJECT_ROOT, timeout: 120_000, maxBuffer: 1024 * 1024 });
      res.json({ success: true, validation: req.body.validation, output: boundedText(`${result.stdout}${result.stderr}`) });
    } catch (e: any) {
      res.json({ success: false, validation: req.body.validation, output: boundedText(`${e.stdout || ""}${e.stderr || e.message || ""}`) });
    }
  });

  // ملاحظة: تم إزالة /write-file المباشر — الكتابة تتم فقط عبر /execute بعد موافقة صريحة من الأدمن.

  // ── إدارة مزوّدي الموديلات (مفاتيح API مخصصة + توجيه ذكي) ─────
  app.get(
    "/api/admin/ai-agent/providers",
    isAuthenticated,
    requireAdmin,
    async (_req, res) => {
      try {
        const providers = await Promise.all(
          AI_PROVIDERS.map(async p => {
            const custom = await getCustomKey(p);
            return {
              provider: p,
              hasEnvKey:
                p === "openai" ? true :
                p === "gemini" ? !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) :
                false,
              hasCustomKey: !!custom,
              maskedKey: custom ? maskKey(custom) : null,
              available: await providerAvailable(p),
            };
          }),
        );
        res.json({ providers, routing: await getRouting() });
      } catch (e: any) {
        res.status(500).json({ message: e.message });
      }
    }
  );

  app.post(
    "/api/admin/ai-agent/providers",
    isAuthenticated,
    requireAdmin,
    async (req, res) => {
      try {
        const { provider, apiKey, routing } = req.body || {};
        if (routing && typeof routing === "object") {
          const clean: Record<string, string> = {};
          for (const k of ["ui", "code", "general"]) {
            if (routing[k] && AI_PROVIDERS.includes(routing[k])) clean[k] = routing[k];
          }
          await storage.setSetting(ROUTING_SETTING, JSON.stringify({ ...(await getRouting()), ...clean }));
        }
        if (provider) {
          if (!AI_PROVIDERS.includes(provider))
            return res.status(400).json({ message: "مزوّد غير معروف" });
          if (typeof apiKey !== "string" || apiKey.trim().length < 10)
            return res.status(400).json({ message: "مفتاح API غير صالح" });
          await storage.setSetting(PROVIDER_KEY_SETTING(provider), encryptSecret(apiKey.trim()));
        }
        res.json({ success: true });
      } catch (e: any) {
        res.status(500).json({ message: e.message });
      }
    }
  );

  app.delete(
    "/api/admin/ai-agent/providers/:provider",
    isAuthenticated,
    requireAdmin,
    async (req, res) => {
      try {
        const p = req.params.provider as AiProvider;
        if (!AI_PROVIDERS.includes(p))
          return res.status(400).json({ message: "مزوّد غير معروف" });
        await storage.setSetting(PROVIDER_KEY_SETTING(p), "");
        res.json({ success: true });
      } catch (e: any) {
        res.status(500).json({ message: e.message });
      }
    }
  );

  // ── POST /api/admin/ai-agent/transcribe — تحويل صوت لنص ────────
  app.post(
    "/api/admin/ai-agent/transcribe",
    isAuthenticated,
    requireAdmin,
    async (req, res) => {
      try {
        const { audio } = req.body;
        if (!audio || typeof audio !== "string")
          return res.status(400).json({ message: "audio (base64) required" });
        const buf = Buffer.from(audio, "base64");
        if (buf.length > 15 * 1024 * 1024)
          return res.status(413).json({ message: "الملف الصوتي كبير جداً (الحد 15MB)" });
        const { buffer, format } = await ensureCompatibleFormat(buf);
        const text = await speechToText(buffer, format);
        res.json({ text });
      } catch (e: any) {
        res.status(500).json({ message: e.message });
      }
    }
  );

  // ── POST /api/admin/ai-agent/chat ──────────────────────────────
  app.post(
    "/api/admin/ai-agent/chat",
    isAuthenticated,
    requireAdmin,
    async (req, res) => {
      try {
        const { messages, fileContext, model, webSearch, attachments } = req.body as {
          messages: any[]; fileContext?: string; model?: string; webSearch?: boolean; attachments?: Attachment[];
        };
        if (!messages || !Array.isArray(messages))
          return res.status(400).json({ message: "messages array required" });

        const atts: Attachment[] = Array.isArray(attachments)
          ? attachments.filter(a => a?.data && a?.mimeType).slice(0, 4)
          : [];
        const totalAttBytes = atts.reduce((s, a) => s + a.data.length, 0);
        if (totalAttBytes > 20 * 1024 * 1024)
          return res.status(413).json({ message: "حجم المرفقات كبير جداً (الحد 20MB)" });

        // سياق عميق: شجرة المشروع + الملفات المرفقة
        let systemContent = `${AI_AGENT_SYSTEM_PROMPT}\n\nشجرة ملفات المشروع الحالية:\n${buildTreeSummary()}`;
        if (fileContext) systemContent += `\n\nسياق الملفات المرفقة:\n${fileContext}`;

        const cleanMessages = messages.map((m: any) => ({
          role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
          content: String(m.content),
        }));

        const hasVideo = atts.some(a => a.mimeType.startsWith("video/"));
        const hasImages = atts.some(a => a.mimeType.startsWith("image/"));

        // ── التوجيه الذكي: auto يختار الأنسب حسب نوع الطلب ──
        const routing = await getRouting();
        const lastUserText = [...cleanMessages].reverse().find(m => m.role === "user")?.content || "";
        const intent = classifyIntent(lastUserText);
        let target: AiProvider = (AI_PROVIDERS as readonly string[]).includes(model || "")
          ? (model as AiProvider)
          : routing[intent] || "openai";
        let routedBy = (AI_PROVIDERS as readonly string[]).includes(model || "") ? "يدوي" : `تلقائي (${intent === "ui" ? "واجهات" : intent === "code" ? "كود" : "عام"})`;

        const isManual = (AI_PROVIDERS as readonly string[]).includes(model || "");

        if (isManual) {
          // ── اختيار يدوي = سيادة كاملة: نستخدم الموديل المختار حصرياً، بدون أي تحويل تلقائي ──
          if (webSearch && target !== "gemini")
            return res.status(400).json({ message: `البحث على الويب متاح فقط مع Gemini — عطّل البحث أو اختر Gemini يدوياً. لن يتم التبديل تلقائياً احتراماً لاختيارك (${target}).` });
          if (hasVideo && target !== "gemini")
            return res.status(400).json({ message: `تحليل الفيديو متاح فقط مع Gemini — احذف الفيديو أو اختر Gemini يدوياً. الموديل المختار (${target}) لا يدعم الفيديو.` });
          if (hasImages && target === "deepseek")
            return res.status(400).json({ message: "DeepSeek لا يدعم تحليل الصور — احذف الصور أو اختر موديلاً آخر يدوياً." });
          if (!(await providerAvailable(target)))
            return res.status(503).json({ message: `مزوّد ${target} غير متاح — أضف مفتاح API من إعدادات الموديلات` });
        } else {
          // ── وضع تلقائي فقط: قيود القدرات والتبديل مسموحان ──
          if (webSearch || hasVideo) {
            if (!(await providerAvailable("gemini")))
              return res.status(503).json({ message: "البحث على الويب وتحليل الفيديو يتطلبان مفتاح Gemini/Google — أضفه من إعدادات الموديلات" });
            target = "gemini";
          } else if (hasImages && target === "deepseek") {
            target = (await providerAvailable("openai")) ? "openai" : (await providerAvailable("anthropic")) ? "anthropic" : "gemini";
          }
          if (!(await providerAvailable(target))) {
            const fallbackChain = INTENT_FALLBACK_CHAINS[intent] || ["openai", "gemini"];
            let resolved: AiProvider | null = null;
            for (const p of fallbackChain) {
              if (await providerAvailable(p)) { resolved = p; break; }
            }
            target = resolved || "openai";
          }
        }

        const invoke = async (provider: AiProvider, conversation: { role: string; content: string }[]): Promise<{ raw: string; model: string }> => {
        let raw = "";
        let exactModel = "";
        if (provider === "gemini") {
          const customGemini = await getCustomKey("gemini");
          const result = await callGemini(systemContent, conversation, atts, !!webSearch, customGemini || undefined);
          raw = result.text;
          exactModel = `${result.model}${webSearch ? " + بحث Google" : ""}`;
        } else if (provider === "deepseek") {
          const dsKey = await getCustomKey("deepseek");
          if (!dsKey) throw new Error("DeepSeek يحتاج مفتاح API — أضفه من إعدادات الموديلات");
          raw = await callDeepSeek(systemContent, conversation, dsKey);
          exactModel = "deepseek-chat";
        } else if (provider === "anthropic") {
          const anthKey = await getCustomKey("anthropic");
          if (!anthKey) throw new Error("Claude يحتاج مفتاح API — أضفه من إعدادات الموديلات");
          const result = await callAnthropic(systemContent, conversation, atts, anthKey);
          raw = result.text;
          exactModel = result.model;
        } else {
          // OpenAI: الصور تُرفق كـ data URLs في آخر رسالة مستخدم
          const oaMessages: any[] = [
            { role: "system", content: systemContent },
            ...conversation.map(m => ({ role: m.role, content: m.content })),
          ];
          const images = atts.filter(a => a.mimeType.startsWith("image/"));
          if (images.length) {
            const lastIdx = oaMessages.length - 1;
            oaMessages[lastIdx] = {
              role: "user",
              content: [
                { type: "text", text: String(oaMessages[lastIdx].content) },
                ...images.map(a => ({ type: "image_url", image_url: { url: `data:${a.mimeType};base64,${a.data}` } })),
              ],
            };
          }
          const customOa = await getCustomKey("openai");
          if (customOa) {
            const r = await fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${customOa}` },
              body: JSON.stringify({ model: "gpt-4o", messages: oaMessages, temperature: 0.3, max_tokens: 4000 }),
            });
            if (!r.ok) throw providerError("OpenAI", r.status);
            const j: any = await r.json();
            raw = j.choices?.[0]?.message?.content || "{}";
            exactModel = "gpt-4o (مفتاح مخصص)";
          } else {
            const completion = await openai.chat.completions.create({
              model: "gpt-4o",
              messages: oaMessages,
              temperature: 0.3,
              max_tokens: 4000,
            });
            raw = completion.choices[0]?.message?.content || "{}";
            exactModel = "gpt-4o";
          }
        }
        return { raw, model: exactModel };
        };
        const fallbackHistory: string[] = [];
        const callWithFallback = async (conversation: { role: string; content: string }[]) => {
          let candidates: AiProvider[] = isManual
            ? [target]
            : Array.from(new Set<AiProvider>([
                target,
                ...(INTENT_FALLBACK_CHAINS[intent] || []),
                "gemini",
                "openai",
              ]));
          if (webSearch || hasVideo) candidates = candidates.filter(p => p === "gemini");
          if (hasImages) candidates = candidates.filter(p => p !== "deepseek");
          let lastError: any;
          for (const provider of candidates) {
            if (!(await providerAvailable(provider))) { fallbackHistory.push(`${provider}: غير متاح`); continue; }
            try {
              const result = await invoke(provider, conversation);
              if (provider !== target) fallbackHistory.push(`تم التحويل إلى ${provider} بعد تعذر ${target}`);
              return { ...result, provider };
            } catch (error: any) {
              void error;
              lastError = providerError(provider); fallbackHistory.push(`${provider}: تعذر الاتصال بالمزوّد`);
              if (isManual) throw lastError;
            }
          }
          throw lastError || new Error("لا يوجد مزود نماذج متاح");
        };
        let callResult = await callWithFallback(cleanMessages);
        let raw = callResult.raw;

        let parsed: any;
        try {
          const cleaned = raw
            .replace(/^```json\s*/i, "")
            .replace(/^```\s*/i, "")
            .replace(/```\s*$/i, "")
            .trim();
          parsed = JSON.parse(cleaned);
        } catch {
          parsed = { type: "message", content: raw };
        }
        const toolTrace: { tool: string; summary: string; ok: boolean }[] = [];
        // Provider-neutral tool protocol: providers only emit JSON; this server
        // executes the capability and feeds a bounded observation back.
        const toolConversation = [...cleanMessages];
        for (let round = 0; parsed?.type === "tool" && round < 4; round++) {
          const tool = String(parsed.tool || "");
          try {
            const result = await runAgentTool(tool, parsed.args);
            const resultText = boundedText(JSON.stringify(result), 50_000);
            toolTrace.push({ tool, summary: resultText.slice(0, 180), ok: true });
            toolConversation.push({ role: "assistant", content: JSON.stringify(parsed) });
            toolConversation.push({ role: "user", content: `نتيجة الأداة ${tool} (موثوقة من الخادم):\n${resultText}\nأكمل التحقيق أو أرجع الخطة النهائية JSON فقط.` });
          } catch (error: any) {
            toolTrace.push({ tool, summary: String(error.message || error), ok: false });
            toolConversation.push({ role: "user", content: `فشلت الأداة ${tool}: ${String(error.message || error)}. اختر أداة آمنة أخرى أو أرجع النتيجة النهائية JSON فقط.` });
          }
          callResult = await callWithFallback(toolConversation);
          raw = callResult.raw;
          try { parsed = JSON.parse(raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim()); }
          catch { parsed = { type: "message", content: raw }; }
        }
        if (parsed?.type === "tool") parsed = { type: "message", content: "وصل الوكيل إلى حد جولات التحقيق؛ يرجى طلب نطاق أصغر أو المحاولة مجدداً." };
        // Never trust a plan returned to the browser. Validate it now, retain
        // the exact server-side object, and bind its short-lived capability to
        // this authenticated administrator.
        if (parsed?.type === "plan") {
          const changes = Array.isArray(parsed.proposedChanges) ? parsed.proposedChanges : [];
          try {
            if (!changes.length || changes.length > MAX_PLAN_FILES) throw new Error(`الخطة يجب أن تحتوي من 1 إلى ${MAX_PLAN_FILES} تغييرات`);
            let totalBytes = 0;
            const seenPaths = new Set<string>();
            const cleanChanges: AgentChange[] = changes.map((change: any) => {
              if (!["create", "modify", "delete"].includes(change?.action)) throw new Error("نوع تعديل غير صالح");
              const full = safeAgentPath(change.filePath, change.action === "create");
              const normalized = path.relative(PROJECT_ROOT, full).replace(/\\/g, "/");
              if (seenPaths.has(normalized)) throw new Error("لا يسمح بتكرار ملف داخل الخطة");
              seenPaths.add(normalized);
              if ((change.action === "create" || change.action === "modify") && (typeof change.content !== "string" || Buffer.byteLength(change.content) > MAX_FILE_BYTES)) {
                throw new Error("محتوى تعديل مفقود أو كبير جداً");
              }
              totalBytes += typeof change.content === "string" ? Buffer.byteLength(change.content) : 0;
              return { filePath: normalized, action: change.action, content: change.content, description: String(change.description || "").slice(0, 500) };
            });
            if (totalBytes > MAX_PLAN_TOTAL_BYTES) throw new Error("إجمالي محتوى الخطة أكبر من حد الأمان");
            parsed.proposedChanges = cleanChanges;
            parsed.diffPreview = proposedDiff(cleanChanges);
            const id = crypto.randomUUID();
            const token = crypto.randomBytes(24).toString("base64url");
            const snapshots = new Map(cleanChanges.map(c => {
              const full = safeAgentPath(c.filePath, c.action === "create");
              return [c.filePath, fileSnapshot(full)];
            }));
            approvedPlans.set(id, { id, token, userId: adminId(req), expiresAt: Date.now() + PLAN_TTL_MS, used: false, plan: parsed, snapshots });
            // Opportunistic cleanup prevents unbounded state in long-lived servers.
            for (const [oldId, plan] of Array.from(approvedPlans.entries())) {
              if (plan.expiresAt < Date.now() || plan.used) approvedPlans.delete(oldId);
            }
            parsed.planId = id;
            parsed.approvalToken = token;
            parsed.expiresAt = new Date(Date.now() + PLAN_TTL_MS).toISOString();
          } catch (planError: any) {
            parsed = { type: "message", content: `لم يتم اعتماد الخطة للتنفيذ: ${planError.message}` };
          }
        }
        const modelUsed = `${callResult.provider}/${callResult.model} — ${routedBy}`;
        res.json({ response: parsed, modelUsed, toolTrace, fallbackHistory });
      } catch (e: any) {
        res.status(500).json({ message: e.message });
      }
    }
  );

  // ── POST /api/admin/ai-agent/command ───────────────────────────
  app.post(
    "/api/admin/ai-agent/command",
    isAuthenticated,
    requireAdmin,
    async (req, res) => {
      try {
        res.json(await runSafeReadCommand(req.body?.command));
      } catch (e: any) {
        res.status(403).json({ message: e.message, success: false });
      }
    }
  );

  // ── POST /api/admin/ai-agent/backup ────────────────────────────
  app.post(
    "/api/admin/ai-agent/backup",
    isAuthenticated,
    requireAdmin,
    async (_req, res) => {
      try {
        const backupsDir = path.join(PROJECT_ROOT, "backups");
        if (!fs.existsSync(backupsDir))
          fs.mkdirSync(backupsDir, { recursive: true });
        const ts = new Date().toISOString().replace(/[:.]/g, "-");
        const backupName = `backup-${ts}.tar.gz`;
        const backupPath = path.join(backupsDir, backupName);
        await execFileAsync("tar", [
          "-czf", backupPath,
          "--exclude=node_modules",
          "--exclude=.git",
          "--exclude=dist",
          "--exclude=backups",
          "--exclude=uploads",
          "--exclude=.env",
          "--exclude=.env.*",
          "--exclude=*.pem",
          "--exclude=*.key",
          "-C", PROJECT_ROOT,
          ".",
        ], { timeout: 60_000 });
        const stats = fs.statSync(backupPath);
        res.json({
          backupName,
          path: `backups/${backupName}`,
          size: stats.size,
          timestamp: new Date().toISOString(),
        });
      } catch (e: any) {
        res.status(500).json({ message: e.message });
      }
    }
  );

  // ── GET /api/admin/ai-agent/backups ────────────────────────────
  app.get(
    "/api/admin/ai-agent/backups",
    isAuthenticated,
    requireAdmin,
    async (_req, res) => {
      try {
        const backupsDir = path.join(PROJECT_ROOT, "backups");
        if (!fs.existsSync(backupsDir)) return res.json({ backups: [] });
        const files = fs.readdirSync(backupsDir)
          .filter(f => f.endsWith(".tar.gz"))
          .map(f => {
            const fullPath = path.join(backupsDir, f);
            const stats = fs.statSync(fullPath);
            return { name: f, size: stats.size, createdAt: stats.mtime.toISOString() };
          })
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        res.json({ backups: files });
      } catch (e: any) {
        res.status(500).json({ message: e.message });
      }
    }
  );

  // ── POST /api/admin/ai-agent/execute ───────────────────────────
  app.post(
    "/api/admin/ai-agent/execute",
    isAuthenticated,
    requireAdmin,
    async (req, res) => {
      try {
        const { planId, approvalToken, validation = "build" } = req.body || {};
        const stored = typeof planId === "string" ? approvedPlans.get(planId) : undefined;
        if (!stored || stored.userId !== adminId(req) || stored.token !== approvalToken || stored.used || stored.expiresAt < Date.now()) {
          return res.status(403).json({ message: "الخطة غير معتمدة أو انتهت صلاحية الموافقة. أنشئ خطة جديدة." });
        }
        if (workspaceExecutionLocked) return res.status(409).json({ message: "تنفيذ آخر قيد التحقق؛ أعد المحاولة." });
        const validationArgs = validationCommand(validation);
        if (!validationArgs) return res.status(400).json({ message: "تحقق غير مسموح" });
        workspaceExecutionLocked = true;
        stored.used = true; // a capability is strictly one-time, including failed attempts
        const changes: AgentChange[] = stored.plan.proposedChanges;
        const rollback = new Map<string, Buffer | null>();
        const results: any[] = [];
        try {
          let baseline: { success: boolean; output: string };
          try {
            const out = await execFileAsync(validationArgs[0], validationArgs.slice(1), { cwd: PROJECT_ROOT, timeout: 120_000, maxBuffer: 1024 * 1024 });
            baseline = { success: true, output: boundedText(`${out.stdout}${out.stderr}`) };
          } catch (e: any) { baseline = { success: false, output: boundedText(`${e.stdout || ""}${e.stderr || e.message || ""}`) }; }
          if (!baseline.success) {
            workspaceExecutionLocked = false;
            return res.status(422).json({ success: false, results: [], message: "فشل تحقق خط الأساس؛ لن يكتب الوكيل أي ملفات.", validation: { ...baseline, baseline } });
          }
          for (const change of changes) {
            const full = safeAgentPath(change.filePath, change.action === "create");
            const expected = stored.snapshots.get(change.filePath);
            const current = fileSnapshot(full);
            if (!expected || expected.exists !== current.exists || expected.sha256 !== current.sha256) throw new Error(`${change.filePath}: تغيّر منذ الموافقة`);
            const exists = fs.existsSync(full);
            rollback.set(full, exists ? fs.readFileSync(full) : null);
            if (change.action === "delete") {
              if (!exists) throw new Error(`${change.filePath}: الملف غير موجود للحذف`);
              fs.unlinkSync(full);
              results.push({ filePath: change.filePath, action: "deleted", success: true });
            } else {
              fs.mkdirSync(path.dirname(full), { recursive: true });
              const temp = path.join(path.dirname(full), `.${path.basename(full)}.agent-${crypto.randomUUID()}.tmp`);
              fs.writeFileSync(temp, change.content!, "utf8");
              fs.renameSync(temp, full); // atomic replacement on the same filesystem
              results.push({ filePath: change.filePath, action: exists ? "modified" : "created", success: true });
            }
          }
          let checked: { success: boolean; output: string };
          try {
            const out = await execFileAsync(validationArgs[0], validationArgs.slice(1), { cwd: PROJECT_ROOT, timeout: 120_000, maxBuffer: 1024 * 1024 });
            checked = { success: true, output: boundedText(`${out.stdout}${out.stderr}`) };
          } catch (e: any) {
            checked = { success: false, output: boundedText(`${e.stdout || ""}${e.stderr || e.message || ""}`) };
            throw e;
          }
          let diff = "";
          try { diff = (await execFileAsync("git", ["diff", "--no-ext-diff", "--", ...changes.map(c => c.filePath)], { cwd: PROJECT_ROOT, timeout: 15_000 })).stdout; } catch {}
          workspaceExecutionLocked = false;
          res.json({ success: true, results, validation: { ...checked, baseline }, diff: boundedText(diff), summary: `${results.length}/${results.length} تم بنجاح` });
        } catch (e: any) {
          for (const [full, prior] of Array.from(rollback.entries())) {
            try {
              if (prior === null) fs.rmSync(full, { force: true });
              else { fs.mkdirSync(path.dirname(full), { recursive: true }); fs.writeFileSync(full, prior); }
            } catch { /* report original failure; best effort recovery */ }
          }
          workspaceExecutionLocked = false;
          res.status(422).json({ success: false, rolledBack: true, results, message: `فشل التنفيذ أو التحقق وتمت استعادة الملفات: ${e.message}`, validation: { success: false, output: boundedText(`${e.stdout || ""}${e.stderr || ""}`) } });
        }
      } catch (e: any) {
        workspaceExecutionLocked = false;
        res.status(500).json({ message: e.message });
      }
    }
  );
}
