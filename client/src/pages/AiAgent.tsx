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
  Archive, Play, X
} from "lucide-react";

const ADMIN_ID = "54219806";

interface FileNode {
  name: string; path: string; type: "file" | "dir";
  size?: number; children?: FileNode[];
}

interface ChatMsg { role: "user" | "assistant"; content: string; parsed?: any; }

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

  const loadFileMutation = useMutation({
    mutationFn: (p: string) =>
      fetch(`/api/admin/ai-agent/file-content?path=${encodeURIComponent(p)}`, { credentials: "include" }).then(r => r.json()),
    onSuccess: (data) => setFileContent(data.content || ""),
    onError: () => toast({ title: "❌ فشل تحميل الملف", variant: "destructive" }),
  });

  const chatMutation = useMutation({
    mutationFn: (vars: { messages: ChatMsg[]; fileContext?: string }) =>
      apiRequest("POST", "/api/admin/ai-agent/chat", vars),
    onSuccess: (data: any) => {
      const resp = data?.response || data;
      setMessages(prev => [...prev, { role: "assistant", content: resp?.content || JSON.stringify(resp), parsed: resp }]);
    },
    onError: () => toast({ title: "❌ خطأ في الـ AI", variant: "destructive" }),
  });

  const executeMutation = useMutation({
    mutationFn: (plan: any) => apiRequest("POST", "/api/admin/ai-agent/execute", { plan }),
    onSuccess: (data: any) => {
      const ok = data?.results?.filter((r: any) => r.success).length || 0;
      const fail = data?.results?.filter((r: any) => !r.success).length || 0;
      toast({ title: `✅ ${ok} ملف تم | ${fail > 0 ? `❌ ${fail} فشل` : ""}` });
      refetchFiles();
    },
    onError: () => toast({ title: "❌ فشل التنفيذ", variant: "destructive" }),
  });

  const backupMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/ai-agent/backup", {}),
    onSuccess: (data: any) => toast({ title: `💾 Backup: ${data?.backupName}` }),
    onError: () => toast({ title: "❌ فشل الـ Backup", variant: "destructive" }),
  });

  const cmdMutation = useMutation({
    mutationFn: (command: string) => apiRequest("POST", "/api/admin/ai-agent/command", { command }),
    onSuccess: (data: any) => setCmdOutput((data?.stdout || "") + (data?.stderr ? `\nSTDERR: ${data.stderr}` : "")),
    onError: (e: any) => setCmdOutput(`Error: ${e?.message || "فشل"}`),
  });

  function sendMessage() {
    const text = input.trim();
    if (!text) return;
    const newMsg: ChatMsg = { role: "user", content: text };
    const updatedMsgs = [...messages, newMsg];
    setMessages(updatedMsgs);
    setInput("");
    const fileContext = selectedFile && fileContent
      ? `الملف: ${selectedFile}\n\`\`\`\n${fileContent.slice(0, 3000)}\n\`\`\``
      : undefined;
    chatMutation.mutate({ messages: updatedMsgs.map(m => ({ role: m.role, content: m.content })), fileContext });
  }

  function handleFileSelect(p: string) {
    setSelectedFile(p);
    loadFileMutation.mutate(p);
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
                      ) : (
                        <div className="bg-muted/60 border border-border/40 rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed">
                          {m.parsed?.content || m.content}
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
                    onClick={sendMessage}
                    disabled={!input.trim() || chatMutation.isPending}
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
