import type { Express } from "express";
import { openai } from "./replit_integrations/image";
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
قاعدة صارمة: أرجع JSON صحيح فقط، بدون backticks أو أي نص خارج الـ JSON.`;

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
        function buildTree(dirPath: string, depth = 0): any[] {
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
        }
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
        if (!fullPath.startsWith(PROJECT_ROOT))
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

  // ── POST /api/admin/ai-agent/write-file ────────────────────────
  app.post(
    "/api/admin/ai-agent/write-file",
    isAuthenticated,
    requireAdmin,
    async (req, res) => {
      try {
        const { filePath, content } = req.body;
        if (!filePath || content === undefined)
          return res.status(400).json({ message: "filePath and content required" });
        const fullPath = path.resolve(PROJECT_ROOT, filePath);
        if (!fullPath.startsWith(PROJECT_ROOT))
          return res.status(403).json({ message: "Access denied" });
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const existed = fs.existsSync(fullPath);
        fs.writeFileSync(fullPath, content, "utf-8");
        res.json({ success: true, action: existed ? "modified" : "created", filePath });
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
        const { messages, fileContext } = req.body;
        if (!messages || !Array.isArray(messages))
          return res.status(400).json({ message: "messages array required" });
        const systemContent = fileContext
          ? `${AI_AGENT_SYSTEM_PROMPT}\n\nسياق الملفات المرفقة:\n${fileContext}`
          : AI_AGENT_SYSTEM_PROMPT;
        const completion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: systemContent },
            ...messages.map((m: any) => ({
              role: m.role as "user" | "assistant",
              content: String(m.content),
            })),
          ],
          temperature: 0.3,
          max_tokens: 4000,
        });
        const raw = completion.choices[0]?.message?.content || "{}";
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
        res.json({ response: parsed });
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
          if (!fullPath.startsWith(PROJECT_ROOT)) {
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
