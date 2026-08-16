import type { Express } from "express";
import { openai } from "./replit_integrations/image";
import { speechToText, ensureCompatibleFormat } from "./replit_integrations/audio";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const PROJECT_ROOT = process.cwd();

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

const ALLOWED_WRITE_CMDS = [
  /^npm\s+run\s+/,
  /^node\s+/,
  /^npx\s+/,
  /^mkdir\s+/,
  /^touch\s+/,
  /^rm\s+-f\s+/,
  /^cp\s+/,
  /^mv\s+/,
];

function isAllowedCmd(cmd: string): boolean {
  const trimmed = cmd.trim();
  return (
    [...ALLOWED_READ_CMDS, ...ALLOWED_WRITE_CMDS].some(r => r.test(trimmed))
  );
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
      if (IGNORE.has(e.name) || e.name.startsWith(".")) continue;
      if (lines.length > 350) return;
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
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
): Promise<string> {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
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
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
  );
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const j: any = await r.json();
  const parts = j.candidates?.[0]?.content?.parts || [];
  return parts.map((p: any) => p.text || "").filter(Boolean).join("\n");
}

const AI_AGENT_SYSTEM_PROMPT = `أنت مساعد تطوير برمجي متخصص في مشروع "شبكة سوق للإعلانات" (Souq Ads Network).
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
لو تفعّل البحث على الويب: استخدم نتائج البحث الفعلية لأحدث الحلول والتوثيق، واذكر المصادر باختصار داخل ردك.`;

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
        const IGNORE = new Set([
          "node_modules", ".git", "dist", ".local", "backups",
          "uploads", "__pycache__", ".cache", "coverage",
        ]);
        const buildTree = (dirPath: string, depth = 0): any[] => {
          if (depth > 5) return [];
          let entries: fs.Dirent[];
          try {
            entries = fs.readdirSync(dirPath, { withFileTypes: true });
          } catch {
            return [];
          }
          return entries
            .filter(e => !IGNORE.has(e.name) && !e.name.startsWith("."))
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
        const fullPath = path.resolve(PROJECT_ROOT, filePath);
        if (fullPath !== PROJECT_ROOT && !fullPath.startsWith(PROJECT_ROOT + path.sep))
          return res.status(403).json({ message: "Access denied" });
        if (!fs.existsSync(fullPath))
          return res.status(404).json({ message: "File not found" });
        const stats = fs.statSync(fullPath);
        if (stats.size > 500 * 1024)
          return res.status(413).json({ message: "File too large (max 500KB)" });
        const content = fs.readFileSync(fullPath, "utf-8");
        res.json({ content, size: stats.size });
      } catch (e: any) {
        res.status(500).json({ message: e.message });
      }
    }
  );

  // ملاحظة: تم إزالة /write-file المباشر — الكتابة تتم فقط عبر /execute بعد موافقة صريحة من الأدمن.

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
        const geminiAvailable = !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
        // البحث على الويب والفيديو يتطلبان Gemini؛ وإلا الموديل المختار
        const useGemini = (model === "gemini" || !!webSearch || hasVideo) && geminiAvailable;
        if ((webSearch || hasVideo) && !geminiAvailable && model !== "openai") {
          return res.status(503).json({ message: "البحث على الويب وتحليل الفيديو يتطلبان مفتاح Gemini/Google — غير متوفر حالياً" });
        }

        let raw = "";
        let modelUsed = "";
        if (useGemini) {
          raw = await callGemini(systemContent, cleanMessages, atts, !!webSearch);
          modelUsed = webSearch ? "gemini-2.0-flash + Google Search" : "gemini-2.0-flash";
        } else {
          // OpenAI: الصور تُرفق كـ data URLs في آخر رسالة مستخدم
          const oaMessages: any[] = [
            { role: "system", content: systemContent },
            ...cleanMessages.map(m => ({ role: m.role, content: m.content })),
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
          const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: oaMessages,
            temperature: 0.3,
            max_tokens: 4000,
          });
          raw = completion.choices[0]?.message?.content || "{}";
          modelUsed = "gpt-4o";
        }

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
        res.json({ response: parsed, modelUsed });
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
        const { command } = req.body;
        if (!command || typeof command !== "string")
          return res.status(400).json({ message: "command required" });
        if (!isAllowedCmd(command))
          return res.status(403).json({ message: `الأمر غير مسموح به: ${command}` });
        const { stdout, stderr } = await execAsync(command, {
          cwd: PROJECT_ROOT,
          timeout: 30000,
          maxBuffer: 1024 * 1024,
        });
        res.json({ stdout: stdout || "", stderr: stderr || "", success: true });
      } catch (e: any) {
        res.status(500).json({
          message: e.message,
          stdout: e.stdout || "",
          stderr: e.stderr || "",
          success: false,
        });
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
        await execAsync(
          `tar -czf "${backupPath}" \
            --exclude="node_modules" \
            --exclude=".git" \
            --exclude="dist" \
            --exclude="backups" \
            --exclude="uploads" \
            -C "${PROJECT_ROOT}" .`,
          { timeout: 60000 }
        );
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
        const { plan } = req.body;
        if (!plan || !Array.isArray(plan.proposedChanges))
          return res.status(400).json({ message: "plan.proposedChanges array required" });

        const results: any[] = [];

        for (const change of plan.proposedChanges) {
          const { filePath, action, content, description } = change;
          if (!filePath || !action) {
            results.push({ filePath, action, success: false, error: "filePath and action required" });
            continue;
          }

          const fullPath = path.resolve(PROJECT_ROOT, filePath);
          if (fullPath === PROJECT_ROOT || !fullPath.startsWith(PROJECT_ROOT + path.sep)) {
            results.push({ filePath, action, success: false, error: "Access denied — path outside project" });
            continue;
          }

          try {
            if (action === "create" || action === "modify") {
              if (content === undefined) {
                results.push({ filePath, action, success: false, error: "content required for create/modify" });
                continue;
              }
              const dir = path.dirname(fullPath);
              if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
              const existed = fs.existsSync(fullPath);
              fs.writeFileSync(fullPath, content, "utf-8");
              results.push({
                filePath,
                action: existed ? "modified" : "created",
                success: true,
                description,
              });

            } else if (action === "delete") {
              if (!fs.existsSync(fullPath)) {
                results.push({ filePath, action, success: false, error: "File not found" });
                continue;
              }
              fs.unlinkSync(fullPath);
              results.push({ filePath, action: "deleted", success: true, description });

            } else {
              results.push({ filePath, action, success: false, error: `Unknown action: ${action}` });
            }
          } catch (err: any) {
            results.push({ filePath, action, success: false, error: err.message });
          }
        }

        const allOk = results.every(r => r.success);
        res.json({
          success: allOk,
          results,
          summary: `${results.filter(r => r.success).length}/${results.length} تم بنجاح`,
        });
      } catch (e: any) {
        res.status(500).json({ message: e.message });
      }
    }
  );
}
