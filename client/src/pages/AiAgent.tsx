import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Bot, Send, Loader2, FolderOpen, FileText, ChevronRight,
  ChevronDown, Terminal, ShieldAlert, CheckCircle2, XCircle,
  Database, RefreshCw, Trash2, Eye, Code2, Zap, AlertTriangle,
  Archive, Play, X, Globe, Mic, ImagePlus, Volume2, Square, Film
} from "lucide-react";
import { useTTS } from "@/hooks/use-tts";

interface FileNode {
  name: string; path: string; type: "file" | "dir";
  size?: number; children?: FileNode[];
}

interface ChatMsg { role: "user" | "assistant"; content: string; parsed?: any; modelUsed?: string; toolTrace?: { tool: string; summary: string; ok: boolean }[]; fallbackHistory?: string[]; attachmentNames?: string[]; }
interface Attachment { name: string; mimeType: string; data: string; }

function FileTree({ nodes, onSelect, selected }: {
  nodes: FileNode[]; onSelect: (p: string) => void; selected: string;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  return (
    <ul className="space-y-0.5">
      {nodes.map(n => (
        <li key={n.path}>
          {n.type === "dir" ? (
            <>
              <button
                onClick={() => setOpen(o => ({ ...o, [n.path]: !o[n.path] }))}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground w-full text-right py-0.5 px-1 rounded hover:bg-muted/60"
              >
                {open[n.path] ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />}
                <FolderOpen className="w-3 h-3 shrink-0 text-amber-500" />
                <span className="truncate">{n.name}</span>
              </button>
              {open[n.path] && n.children && (
                <div className="pr-3 border-r border-border/40 mr-1.5">
                  <FileTree nodes={n.children} onSelect={onSelect} selected={selected} />
                </div>
              )}
            </>
          ) : (
            <button
              onClick={() => onSelect(n.path)}
              className={`flex items-center gap-1 text-xs w-full text-right py-0.5 px-1 rounded truncate ${
                selected === n.path
                  ? "bg-primary/15 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              }`}
            >
              <FileText className="w-3 h-3 shrink-0 text-blue-400" />
              <span className="truncate">{n.name}</span>
              {n.size !== undefined && (
                <span className="text-[10px] text-muted-foreground/60 mr-auto shrink-0">
                  {n.size > 1024 ? `${(n.size / 1024).toFixed(0)}k` : `${n.size}b`}
                </span>
              )}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

function PlanCard({ plan, onApprove, isApproving }: {
  plan: any; onApprove: (p: any) => void; isApproving: boolean;
}) {
  const severityColor = plan.severity === "high"
    ? "text-red-600 bg-red-50 border-red-200"
    : plan.severity === "medium"
    ? "text-amber-600 bg-amber-50 border-amber-200"
    : "text-green-600 bg-green-50 border-green-200";

  return (
    <div className="border border-border/60 rounded-xl p-4 space-y-3 bg-muted/20 text-sm" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="font-bold flex items-center gap-1.5">
          <Code2 className="w-4 h-4 text-primary" /> خطة التنفيذ
        </span>
        <Badge className={`text-xs border ${severityColor}`}>
          {plan.severity === "high" ? "⚠️ خطورة عالية" : plan.severity === "medium" ? "⚡ متوسط" : "✅ منخفض"}
        </Badge>
      </div>

      <p className="text-muted-foreground text-xs leading-relaxed">{plan.analysis}</p>

      {plan.plan?.length > 0 && (
        <div>
          <p className="font-medium text-xs mb-1">📋 الخطوات:</p>
          <ol className="space-y-1 list-decimal list-inside">
            {plan.plan.map((s: string, i: number) => (
              <li key={i} className="text-xs text-muted-foreground">{s}</li>
            ))}
          </ol>
        </div>
      )}

      {plan.affectedFiles?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {plan.affectedFiles.map((f: string) => (
            <Badge key={f} variant="outline" className="text-[10px]">
              <FileText className="w-2.5 h-2.5 ml-1" /> {f}
            </Badge>
          ))}
        </div>
      )}

      {plan.risks?.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
          <p className="text-xs font-medium text-amber-700 mb-1 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> مخاطر محتملة:
          </p>
          {plan.risks.map((r: string, i: number) => (
            <p key={i} className="text-xs text-amber-600">• {r}</p>
          ))}
        </div>
      )}

      {plan.proposedChanges?.length > 0 && (
        <div>
          <p className="font-medium text-xs mb-1">🗂️ التغييرات المقترحة ({plan.proposedChanges.length}):</p>
          <div className="space-y-1.5">
            {plan.proposedChanges.map((c: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-xs bg-background border border-border/40 rounded px-2 py-1">
                <Badge variant="outline" className={`text-[10px] shrink-0 ${
                  c.action === "create" ? "text-green-600 border-green-300" :
                  c.action === "delete" ? "text-red-600 border-red-300" :
                  "text-blue-600 border-blue-300"
                }`}>
                  {c.action === "create" ? "➕ إنشاء" : c.action === "delete" ? "🗑️ حذف" : "✏️ تعديل"}
                </Badge>
                <code className="text-primary truncate flex-1">{c.filePath}</code>
                {c.description && <span className="text-muted-foreground truncate max-w-[120px]">{c.description}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
      {plan.diffPreview && (
        <details className="text-xs">
          <summary className="cursor-pointer font-medium">معاينة الفرق قبل التنفيذ</summary>
          <pre dir="ltr" className="mt-2 max-h-48 overflow-auto rounded bg-zinc-950 p-2 text-[10px] text-zinc-100 whitespace-pre-wrap">{plan.diffPreview}</pre>
        </details>
      )}

      <div className="flex gap-2 pt-1">
        <Button
          size="sm"
          onClick={() => onApprove(plan)}
          disabled={isApproving || !plan.proposedChanges?.length}
          className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
          data-testid="btn-approve-plan"
        >
          {isApproving
            ? <Loader2 className="w-3 h-3 animate-spin" />
            : <Play className="w-3 h-3" />}
          موافق — نفّذ الآن
        </Button>
        <span className="text-[10px] text-muted-foreground self-center">
          {plan.proposedChanges?.length ? `${plan.proposedChanges.length} ملف` : "لا توجد تغييرات"}
        </span>
      </div>
    </div>
  );
}

export default function AiAgent() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [selectedFile, setSelectedFile] = useState("");
  const [fileContent, setFileContent] = useState("");
  const [cmdInput, setCmdInput] = useState("");
  const [cmdOutput, setCmdOutput] = useState("");
  const [tab, setTab] = useState<"chat" | "files" | "terminal">("chat");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // ── إمكانيات جديدة: تعدد موديلات، بحث ويب، مرفقات، صوت ──
  const [aiModel, setAiModel] = useState<"auto" | "openai" | "gemini" | "deepseek">("auto");
  const [showProviderSettings, setShowProviderSettings] = useState(false);
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
  const [routingDraft, setRoutingDraft] = useState<Record<string, string> | null>(null);
  const [webSearch, setWebSearch] = useState(false);
  const [voiceReply, setVoiceReply] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const tts = useTTS();

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!user || (user as any).isAdmin !== true) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <ShieldAlert className="w-12 h-12 text-red-500" />
        <p className="text-lg font-bold">غير مصرح — أدمن فقط</p>
      </div>
    );
  }

  const { data: filesData, isLoading: filesLoading, refetch: refetchFiles } = useQuery<{ tree: FileNode[] }>({
    queryKey: ["/api/admin/ai-agent/files"],
    queryFn: () => fetch("/api/admin/ai-agent/files", { credentials: "include" }).then(r => r.json()),
    staleTime: 30000,
  });

  // ── مزوّدو الموديلات + التوجيه الذكي ──
  const { data: providersData, refetch: refetchProviders } = useQuery<{
    providers: { provider: string; hasEnvKey: boolean; hasCustomKey: boolean; maskedKey: string | null; available: boolean }[];
    routing: Record<string, string>;
  }>({
    queryKey: ["/api/admin/ai-agent/providers"],
    queryFn: () => fetch("/api/admin/ai-agent/providers", { credentials: "include" }).then(r => r.json()),
    staleTime: 30000,
  });

  const saveProviderMutation = useMutation({
    mutationFn: async (body: { provider?: string; apiKey?: string; routing?: Record<string, string> }) => {
      const r = await fetch("/api/admin/ai-agent/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.message || "فشل الحفظ");
      return d;
    },
    onSuccess: () => { toast({ title: "✅ تم الحفظ" }); refetchProviders(); },
    onError: (e: any) => toast({ title: "❌ فشل الحفظ", description: e?.message, variant: "destructive" }),
  });

  const deleteProviderKeyMutation = useMutation({
    mutationFn: async (provider: string) => {
      const r = await fetch(`/api/admin/ai-agent/providers/${provider}`, { method: "DELETE", credentials: "include" });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.message || "فشل الحذف");
      return d;
    },
    onSuccess: () => { toast({ title: "🗑️ تم حذف المفتاح" }); refetchProviders(); },
  });

  const loadFileMutation = useMutation({
    mutationFn: (p: string) =>
      fetch(`/api/admin/ai-agent/file-content?path=${encodeURIComponent(p)}`, { credentials: "include" }).then(r => r.json()),
    onSuccess: (data) => setFileContent(data.content || ""),
    onError: () => toast({ title: "❌ فشل تحميل الملف", variant: "destructive" }),
  });

  const chatMutation = useMutation({
    mutationFn: async (vars: { messages: { role: string; content: string }[]; fileContext?: string; model: string; webSearch: boolean; attachments: Attachment[] }) => {
      const r = await fetch("/api/admin/ai-agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(vars),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.message || "فشل الطلب");
      return d;
    },
    onSuccess: (data: any) => {
      const resp = data?.response || data;
      const text = resp?.content || (resp?.type === "plan" ? resp?.analysis : "") || JSON.stringify(resp);
      setMessages(prev => [...prev, { role: "assistant", content: text, parsed: resp, modelUsed: data?.modelUsed, toolTrace: data?.toolTrace, fallbackHistory: data?.fallbackHistory }]);
      // رد صوتي بالعربي لو مفعّل (للردود النصية فقط)
      if (voiceReply && resp?.type !== "plan" && typeof resp?.content === "string" && resp.content.trim()) {
        tts.generate(resp.content.slice(0, 900), "nova", true).catch(() => {});
      }
    },
    onError: (e: any) => {
      const msg = e?.message || "حدث خطأ غير متوقع";
      // إضافة رسالة الخطأ كفقاعة محادثة دائمة حتى لا تضيع مع انتهاء الـ toast
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: `⚠️ ${msg}`, parsed: { type: "error" } },
      ]);
      toast({ title: "❌ خطأ في الـ AI", description: msg, variant: "destructive" });
    },
  });

  const executeMutation = useMutation({
    mutationFn: (plan: any) => apiRequest("POST", "/api/admin/ai-agent/execute", {
      planId: plan.planId, approvalToken: plan.approvalToken, validation: "build",
    }).then((r: any) => (typeof r?.json === "function" ? r.json() : r)),
    onSuccess: (data: any) => {
      const ok = data?.results?.filter((r: any) => r.success).length || 0;
      const fail = data?.results?.filter((r: any) => !r.success).length || 0;
      toast({ title: `✅ ${ok} ملف تم | ${fail > 0 ? `❌ ${fail} فشل` : ""}` });
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `نتيجة التنفيذ: ${data?.summary || ""}\nالتحقق: ${data?.validation?.success ? "نجح" : data?.validation?.preExistingFailures ? "تعذر بسبب أخطاء موجودة مسبقاً" : "فشل"}\n${data?.validation?.output || ""}\n${data?.diff ? `فرق Git:\n${data.diff}` : ""}`,
        parsed: { type: "message", content: `نتيجة التنفيذ: ${data?.summary || ""}\nالتحقق: ${data?.validation?.success ? "نجح" : data?.validation?.preExistingFailures ? "أخطاء موجودة مسبقاً" : "فشل"}\n${data?.validation?.output || ""}\n${data?.diff ? `فرق Git:\n${data.diff}` : ""}` },
      }]);
      refetchFiles();
    },
    onError: () => toast({ title: "❌ فشل التنفيذ", variant: "destructive" }),
  });

  const backupMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/ai-agent/backup", {}).then((r: any) => (typeof r?.json === "function" ? r.json() : r)),
    onSuccess: (data: any) => toast({ title: `💾 Backup: ${data?.backupName}` }),
    onError: () => toast({ title: "❌ فشل الـ Backup", variant: "destructive" }),
  });

  const cmdMutation = useMutation({
    mutationFn: (command: string) => apiRequest("POST", "/api/admin/ai-agent/command", { command }).then((r: any) => (typeof r?.json === "function" ? r.json() : r)),
    onSuccess: (data: any) => setCmdOutput((data?.stdout || "") + (data?.stderr ? `\nSTDERR: ${data.stderr}` : "")),
    onError: (e: any) => setCmdOutput(`Error: ${e?.message || "فشل"}`),
  });

  function sendMessage(overrideText?: string) {
    const text = (overrideText ?? input).trim();
    if (!text && attachments.length === 0) return;
    const newMsg: ChatMsg = {
      role: "user",
      content: text || "(مرفقات بدون نص)",
      attachmentNames: attachments.map(a => a.name),
    };
    const updatedMsgs = [...messages, newMsg];
    setMessages(updatedMsgs);
    setInput("");
    const fileContext = selectedFile && fileContent
      ? `الملف: ${selectedFile}\n\`\`\`\n${fileContent.slice(0, 12000)}\n\`\`\``
      : undefined;
    const atts = attachments;
    setAttachments([]);
    chatMutation.mutate({
      messages: updatedMsgs.map(m => ({
        role: m.role,
        content: m.role === "assistant" && m.parsed?.type === "plan"
          ? JSON.stringify({
              type: "plan",
              analysis: m.parsed.analysis,
              plan: m.parsed.plan,
              affectedFiles: m.parsed.affectedFiles,
              risks: m.parsed.risks,
              severity: m.parsed.severity,
              proposedChanges: m.parsed.proposedChanges?.map((change: any) => ({
                filePath: change.filePath,
                action: change.action,
                description: change.description,
              })),
              requiresApproval: m.parsed.requiresApproval,
            })
          : m.content,
      })),
      fileContext,
      model: aiModel,
      webSearch,
      attachments: atts,
    });
  }

  function handleFileSelect(p: string) {
    setSelectedFile(p);
    loadFileMutation.mutate(p);
  }

  /* ── مرفقات صور/فيديو ── */
  async function onPickAttachments(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    // نتتبع العدد والحجم محلياً داخل الحلقة لأن قيمة الـ state لا تتحدث فورياً
    let count = attachments.length;
    let totalEncoded = attachments.reduce((s, a) => s + a.data.length, 0);
    for (const f of files) {
      if (count >= 4) { toast({ title: "الحد 4 مرفقات", variant: "destructive" }); break; }
      if (f.size > 10 * 1024 * 1024) { toast({ title: `${f.name} أكبر من 10MB`, variant: "destructive" }); continue; }
      const data = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(",")[1] || "");
        r.onerror = reject;
        r.readAsDataURL(f);
      }).catch(() => "");
      if (!data) continue;
      if (totalEncoded + data.length > 18 * 1024 * 1024) {
        toast({ title: "إجمالي المرفقات تجاوز الحد (~18MB)", description: f.name, variant: "destructive" });
        break;
      }
      count += 1;
      totalEncoded += data.length;
      setAttachments(prev => [...prev, { name: f.name, mimeType: f.type || "application/octet-stream", data }]);
    }
  }

  /* ── تسجيل صوتي → نص → إرسال ── */
  async function toggleRecording() {
    if (recording) {
      mediaRecorderRef.current?.stop();
      return;
    }
    const ms = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);
    if (!ms) { toast({ title: "تعذّر فتح الميكروفون", variant: "destructive" }); return; }
    recordChunksRef.current = [];
    const mr = new MediaRecorder(ms);
    mediaRecorderRef.current = mr;
    mr.ondataavailable = ev => { if (ev.data.size) recordChunksRef.current.push(ev.data); };
    mr.onstop = async () => {
      setRecording(false);
      ms.getTracks().forEach(t => t.stop());
      const blob = new Blob(recordChunksRef.current, { type: mr.mimeType || "audio/webm" });
      if (blob.size < 1000) return;
      setTranscribing(true);
      try {
        const b64 = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result).split(",")[1] || "");
          r.onerror = reject;
          r.readAsDataURL(blob);
        });
        const res = await fetch("/api/admin/ai-agent/transcribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ audio: b64 }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d?.message || "فشل التحويل");
        if (d.text?.trim()) sendMessage(d.text.trim());
        else toast({ title: "لم يتم التقاط كلام واضح", variant: "destructive" });
      } catch (e: any) {
        toast({ title: "❌ فشل تحويل الصوت", description: e?.message, variant: "destructive" });
      }
      setTranscribing(false);
    };
    mr.start();
    setRecording(true);
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="container mx-auto px-3 py-5 max-w-6xl">

        {/* Header */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-extrabold text-lg leading-tight">مساعد التطوير الذكي</h1>
              <p className="text-xs text-muted-foreground">AI Developer Agent — للأدمن فقط</p>
            </div>
          </div>
          <Button
            size="sm" variant="outline"
            onClick={() => backupMutation.mutate()}
            disabled={backupMutation.isPending}
            className="gap-1.5 text-xs"
            data-testid="btn-backup"
          >
            {backupMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Archive className="w-3 h-3" />}
            نسخة احتياطية
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 bg-muted/40 rounded-xl p-1 w-fit">
          {[
            { key: "chat",     label: "💬 المحادثة",  icon: Bot       },
            { key: "files",    label: "📁 الملفات",   icon: FolderOpen },
            { key: "terminal", label: "⌨️ Terminal",  icon: Terminal   },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as any)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                tab === t.key ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`tab-${t.key}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">

          {/* ── File Tree ────────────────────────────────────────── */}
          <Card className={`border-border/60 lg:row-span-2 ${tab !== "files" && "hidden lg:block"}`}>
            <CardHeader className="py-3 px-4 border-b border-border/40">
              <CardTitle className="text-sm flex items-center justify-between">
                <span className="flex items-center gap-1.5"><FolderOpen className="w-4 h-4 text-amber-500" /> شجرة الملفات</span>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => refetchFiles()}>
                  <RefreshCw className="w-3 h-3" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 overflow-auto max-h-[500px]">
              {filesLoading ? (
                <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin" /></div>
              ) : (
                <FileTree nodes={filesData?.tree || []} onSelect={handleFileSelect} selected={selectedFile} />
              )}
            </CardContent>
            {selectedFile && (
              <div className="border-t border-border/40 p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] text-primary font-mono truncate flex-1">{selectedFile}</p>
                  <button onClick={() => { setSelectedFile(""); setFileContent(""); }} className="text-muted-foreground hover:text-foreground">
                    <X className="w-3 h-3" />
                  </button>
                </div>
                {loadFileMutation.isPending ? (
                  <div className="flex justify-center py-2"><Loader2 className="w-4 h-4 animate-spin" /></div>
                ) : (
                  <pre className="text-[10px] bg-muted/60 rounded p-2 max-h-48 overflow-auto whitespace-pre-wrap text-muted-foreground font-mono">
                    {fileContent.slice(0, 2000)}{fileContent.length > 2000 ? "\n... (مقتطع)" : ""}
                  </pre>
                )}
              </div>
            )}
          </Card>

          {/* ── Chat ─────────────────────────────────────────────── */}
          {tab !== "terminal" && (
            <Card className={`border-border/60 flex flex-col ${tab === "files" ? "hidden lg:flex" : ""}`}
              style={{ minHeight: "520px" }}>
              <CardHeader className="py-3 px-4 border-b border-border/40">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <Bot className="w-4 h-4 text-violet-500" /> المحادثة مع الـ AI
                  {selectedFile && (
                    <Badge variant="outline" className="text-[10px] mr-auto">
                      <FileText className="w-2.5 h-2.5 ml-1" /> {selectedFile.split("/").pop()}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>

              <CardContent className="flex-1 overflow-auto p-4 space-y-3">
                {messages.length === 0 && (
                  <div className="text-center py-10 text-muted-foreground">
                    <Bot className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium">ابدأ المحادثة مع مساعد التطوير</p>
                    <p className="text-xs mt-1">اسأله عن الكود، اطلب تعديلات، أو اشرح ميزة جديدة</p>
                    <div className="flex flex-wrap gap-1.5 justify-center mt-4">
                      {[
                        "اشرح لي بنية المشروع",
                        "كيف أضيف ميزة جديدة؟",
                        "افحص ملف routes.ts",
                      ].map(s => (
                        <button
                          key={s}
                          onClick={() => setInput(s)}
                          className="text-xs border border-border rounded-full px-3 py-1 hover:bg-muted transition-colors"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
                    <div className={`max-w-[85%] ${m.role === "user" ? "order-2" : "order-1"}`}>
                      {m.role === "user" ? (
                        <div className="bg-primary text-primary-foreground rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm">
                          {m.content}
                        </div>
                      ) : m.parsed?.type === "plan" ? (
                        <PlanCard
                          plan={m.parsed}
                          onApprove={(p) => executeMutation.mutate(p)}
                          isApproving={executeMutation.isPending}
                        />
                      ) : m.parsed?.type === "error" ? (
                        <div className="bg-red-50 border border-red-200 rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed text-red-700">
                          {m.content}
                        </div>
                      ) : (
                        <div className="bg-muted/60 border border-border/40 rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed">
                          {m.parsed?.content || m.content}
                          {m.modelUsed && (
                            <div className="text-[9px] text-muted-foreground/70 mt-1.5" dir="ltr">{m.modelUsed}</div>
                          )}
                          {(m.toolTrace?.length || m.fallbackHistory?.length) ? (
                            <details className="mt-2 text-[10px] text-muted-foreground">
                              <summary className="cursor-pointer">سجل التحقيق والمزوّد</summary>
                              {m.toolTrace?.map((t, n) => <div key={`${t.tool}-${n}`} className={t.ok ? "" : "text-red-600"}>{t.ok ? "✓" : "×"} {t.tool}: {t.summary}</div>)}
                              {m.fallbackHistory?.map((f, n) => <div key={n}>↪ {f}</div>)}
                            </details>
                          ) : null}
                        </div>
                      )}
                    </div>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mx-1.5 ${
                      m.role === "user" ? "bg-primary order-1" : "bg-violet-100 border border-violet-200 order-2"
                    }`}>
                      {m.role === "user"
                        ? <span className="text-[10px] text-primary-foreground font-bold">أنت</span>
                        : <Bot className="w-3.5 h-3.5 text-violet-600" />}
                    </div>
                  </div>
                ))}

                {chatMutation.isPending && (
                  <div className="flex justify-end">
                    <div className="bg-muted/60 border border-border/40 rounded-2xl rounded-tr-sm px-4 py-3 flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-violet-500" />
                      <span className="text-xs text-muted-foreground">يفكر...</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </CardContent>

              <div className="border-t border-border/40 p-3">
                {/* ── شريط الإمكانيات: موديل + بحث ويب + رد صوتي + مرفقات + مايك ── */}
                <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                  <select
                    value={aiModel}
                    onChange={e => setAiModel(e.target.value as any)}
                    className="px-2 py-1 rounded-lg border border-border/60 bg-background text-[10px] font-bold outline-none"
                    data-testid="select-model"
                  >
                    <option value="auto">🧠 توجيه ذكي (تلقائي)</option>
                    {(providersData?.providers || []).map(p => (
                      <option key={p.provider} value={p.provider} disabled={!p.available}>
                        {p.provider === "openai" ? "GPT-4o" : p.provider === "gemini" ? "Gemini" : p.provider === "anthropic" ? "Claude" : "DeepSeek"}
                        {!p.available ? " (يحتاج مفتاح)" : ""}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => setShowProviderSettings(s => !s)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors ${showProviderSettings ? "bg-violet-600 text-white border-violet-600" : "text-muted-foreground border-border/60 hover:bg-muted"}`}
                    data-testid="btn-provider-settings"
                  >
                    <Zap className="w-3 h-3" /> إعدادات الموديلات
                  </button>
                  <button
                    onClick={() => setWebSearch(w => !w)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors ${webSearch ? "bg-blue-600 text-white border-blue-600" : "text-muted-foreground border-border/60 hover:bg-muted"}`}
                    data-testid="btn-toggle-websearch"
                  >
                    <Globe className="w-3 h-3" /> بحث ويب
                  </button>
                  <button
                    onClick={() => setVoiceReply(v => !v)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors ${voiceReply ? "bg-green-600 text-white border-green-600" : "text-muted-foreground border-border/60 hover:bg-muted"}`}
                    data-testid="btn-toggle-voicereply"
                  >
                    <Volume2 className="w-3 h-3" /> رد صوتي
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border border-border/60 text-muted-foreground hover:bg-muted transition-colors"
                    data-testid="btn-attach"
                  >
                    <ImagePlus className="w-3 h-3" /> صورة/فيديو
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={onPickAttachments} />
                  <button
                    onClick={toggleRecording}
                    disabled={transcribing}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors ${recording ? "bg-red-600 text-white border-red-600 animate-pulse" : "text-muted-foreground border-border/60 hover:bg-muted"}`}
                    data-testid="btn-voice-record"
                  >
                    {transcribing ? <Loader2 className="w-3 h-3 animate-spin" /> : recording ? <Square className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                    {recording ? "إيقاف وإرسال" : transcribing ? "جاري التحويل..." : "رسالة صوتية"}
                  </button>
                </div>
                {showProviderSettings && (
                  <div className="border border-border/60 rounded-xl p-3 mb-2 space-y-3 bg-muted/20" data-testid="panel-provider-settings">
                    <p className="text-xs font-bold flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-violet-500" /> مفاتيح API المخصصة</p>
                    {(providersData?.providers || []).map(p => (
                      <div key={p.provider} className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-bold w-16">{p.provider === "openai" ? "OpenAI" : p.provider === "gemini" ? "Gemini" : p.provider === "anthropic" ? "Claude" : "DeepSeek"}</span>
                        {p.hasCustomKey ? (
                          <>
                            <code className="text-[10px] bg-background border border-border/40 rounded px-2 py-0.5" dir="ltr">{p.maskedKey}</code>
                            <button
                              onClick={() => deleteProviderKeyMutation.mutate(p.provider)}
                              className="text-[10px] text-red-500 hover:underline"
                              data-testid={`btn-delete-key-${p.provider}`}
                            >حذف</button>
                          </>
                        ) : (
                          <>
                            <input
                              type="password"
                              value={keyInputs[p.provider] || ""}
                              onChange={e => setKeyInputs(k => ({ ...k, [p.provider]: e.target.value }))}
                              placeholder={p.hasEnvKey ? "مفتاح مخصص (اختياري — يوجد مفتاح افتراضي)" : "أدخل مفتاح API"}
                              className="flex-1 min-w-[140px] text-[10px] border border-border/60 rounded-lg px-2 py-1 bg-background outline-none"
                              dir="ltr"
                              data-testid={`input-key-${p.provider}`}
                            />
                            <Button
                              size="sm" variant="outline" className="h-6 text-[10px] px-2"
                              disabled={!(keyInputs[p.provider] || "").trim() || saveProviderMutation.isPending}
                              onClick={() => {
                                saveProviderMutation.mutate({ provider: p.provider, apiKey: keyInputs[p.provider].trim() });
                                setKeyInputs(k => ({ ...k, [p.provider]: "" }));
                              }}
                              data-testid={`btn-save-key-${p.provider}`}
                            >حفظ</Button>
                          </>
                        )}
                      </div>
                    ))}
                    <div className="border-t border-border/40 pt-2">
                      <p className="text-xs font-bold mb-1.5">🧠 التوجيه الذكي — الأقوى في كل مجال:</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {([["ui", "تصميم الواجهات"], ["code", "الكود والمنطق"], ["general", "أسئلة عامة"]] as const).map(([k, label]) => (
                          <label key={k} className="text-[10px] flex flex-col gap-0.5">
                            <span className="text-muted-foreground">{label}</span>
                            <select
                              value={(routingDraft || providersData?.routing || {})[k] || "openai"}
                              onChange={e => {
                                // نرسل كائن التوجيه كاملاً كل مرة لتفادي تضارب التحديثات المتزامنة
                                const full = { ...(routingDraft || providersData?.routing || {}), [k]: e.target.value };
                                setRoutingDraft(full);
                                saveProviderMutation.mutate({ routing: full });
                              }}
                              className="border border-border/60 rounded-lg px-2 py-1 bg-background outline-none text-[10px]"
                              data-testid={`select-routing-${k}`}
                            >
                              <option value="openai">GPT-4o</option>
                              <option value="gemini">Gemini</option>
                              <option value="deepseek">DeepSeek</option>
                              <option value="anthropic">Claude</option>
                            </select>
                          </label>
                        ))}
                      </div>
                      <p className="text-[9px] text-muted-foreground mt-1.5">مع وضع "توجيه ذكي" النظام يحلل طلبك ويختار الموديل الأنسب تلقائياً. البحث والفيديو يستخدمان Gemini دائماً.</p>
                    </div>
                  </div>
                )}
                {attachments.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {attachments.map((a, i) => (
                      <span key={i} className="flex items-center gap-1 bg-muted/60 border border-border/40 rounded-full px-2 py-0.5 text-[10px]">
                        {a.mimeType.startsWith("video/") ? <Film className="w-2.5 h-2.5" /> : <ImagePlus className="w-2.5 h-2.5" />}
                        <span className="max-w-[100px] truncate">{a.name}</span>
                        <button onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))}><X className="w-2.5 h-2.5" /></button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <Textarea
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    placeholder="اكتب طلبك... (Enter للإرسال، Shift+Enter لسطر جديد)"
                    className="text-sm resize-none min-h-[44px] max-h-32"
                    rows={2}
                    data-testid="input-chat"
                    disabled={chatMutation.isPending}
                  />
                  <Button
                    onClick={() => sendMessage()}
                    disabled={(!input.trim() && attachments.length === 0) || chatMutation.isPending}
                    className="shrink-0 self-end gap-1"
                    data-testid="btn-send-chat"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
                {messages.length > 0 && (
                  <button
                    onClick={() => setMessages([])}
                    className="text-[10px] text-muted-foreground hover:text-foreground mt-1.5 flex items-center gap-1"
                  >
                    <Trash2 className="w-2.5 h-2.5" /> مسح المحادثة
                  </button>
                )}
              </div>
            </Card>
          )}

          {/* ── Terminal ─────────────────────────────────────────── */}
          {tab === "terminal" && (
            <Card className="border-border/60 lg:col-start-2">
              <CardHeader className="py-3 px-4 border-b border-border/40">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <Terminal className="w-4 h-4 text-green-500" /> Terminal (قراءة فقط — أوامر آمنة)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="bg-black rounded-lg p-3 font-mono text-xs min-h-[300px] max-h-[400px] overflow-auto">
                  {cmdOutput ? (
                    <pre className="text-green-400 whitespace-pre-wrap">{cmdOutput}</pre>
                  ) : (
                    <p className="text-gray-500">$ نتيجة الأمر ستظهر هنا...</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    value={cmdInput}
                    onChange={e => setCmdInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && cmdInput.trim()) { cmdMutation.mutate(cmdInput.trim()); } }}
                    placeholder="$ اكتب أمرًا (مثال: ls server/ أو git status)"
                    className="flex-1 bg-black border border-green-900 text-green-400 font-mono text-xs rounded-lg px-3 py-2 outline-none placeholder:text-gray-600"
                    dir="ltr"
                    data-testid="input-command"
                  />
                  <Button
                    size="sm"
                    onClick={() => cmdInput.trim() && cmdMutation.mutate(cmdInput.trim())}
                    disabled={!cmdInput.trim() || cmdMutation.isPending}
                    className="bg-green-700 hover:bg-green-800 gap-1"
                    data-testid="btn-run-command"
                  >
                    {cmdMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                    تشغيل
                  </Button>
                </div>
                <div className="text-[10px] text-muted-foreground bg-muted/40 rounded p-2">
                  <p className="font-medium mb-1">✅ الأوامر المسموحة:</p>
                  <p className="font-mono">ls, cat, grep, find, ps, git log/status/diff, head, tail, wc, npm list</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
