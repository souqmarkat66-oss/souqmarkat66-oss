import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Bot, Send, Terminal, FolderOpen, ChevronRight, ChevronDown,
  AlertTriangle, CheckCircle, XCircle, Loader2, File, Folder,
  Play, Shield, ShieldAlert, RefreshCw, FileText, Zap,
} from "lucide-react";

type ProposedChange = {
  filePath: string;
  action: "create" | "modify" | "delete";
  description: string;
  content?: string;
};

type AIResponse = {
  type: "plan" | "message";
  content?: string;
  analysis?: string;
  plan?: string[];
  affectedFiles?: string[];
  risks?: string[];
  severity?: "low" | "medium" | "high";
  proposedChanges?: ProposedChange[];
  requiresApproval?: boolean;
  planId?: string;
  approvalToken?: string;
  expiresAt?: string;
  diffPreview?: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  rawResponse?: AIResponse;
  timestamp: Date;
};

type FileNode = {
  name: string;
  path: string;
  type: "file" | "dir";
  size?: number;
  children?: FileNode[];
};

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    low:    { label: "منخفض الخطورة", cls: "bg-green-500/15 text-green-600 border-green-500/30" },
    medium: { label: "متوسط الخطورة", cls: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30" },
    high:   { label: "عالي الخطورة",  cls: "bg-red-500/15 text-red-600 border-red-500/30" },
  };
  const info = map[severity] ?? map.medium;
  return (
    <span className={`text-xs border rounded-full px-2 py-0.5 font-medium ${info.cls}`}>
      {info.label}
    </span>
  );
}

function PlanCard({
  response, onApprove, onReject, isExecuting, alreadyHandled,
}: {
  response: AIResponse;
  onApprove: () => void;
  onReject: () => void;
  isExecuting: boolean;
  alreadyHandled: boolean;
}) {
  const [showChanges, setShowChanges] = useState(false);
  return (
    <div className="mt-3 border border-border rounded-xl overflow-hidden bg-card">
      <div className="bg-primary/5 px-4 py-3 flex items-center gap-2 border-b border-border">
        <Zap className="w-4 h-4 text-primary flex-shrink-0" />
        <span className="font-semibold text-sm">خطة التنفيذ</span>
        {response.severity && <SeverityBadge severity={response.severity} />}
      </div>
      <div className="p-4 space-y-4 text-sm">
        {response.analysis && (
          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-1">التحليل</div>
            <p className="leading-relaxed text-foreground/90">{response.analysis}</p>
          </div>
        )}
        {response.plan && response.plan.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2">خطوات التنفيذ</div>
            <ol className="space-y-1.5">
              {response.plan.map((step, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center flex-shrink-0 mt-0.5 font-bold">
                    {i + 1}
                  </span>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
        {response.affectedFiles && response.affectedFiles.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2">الملفات المتأثرة</div>
            <div className="flex flex-wrap gap-1.5">
              {response.affectedFiles.map((f, i) => (
                <span key={i} className="text-xs bg-blue-500/10 text-blue-600 border border-blue-500/20 rounded px-2 py-0.5 font-mono">
                  {f}
                </span>
              ))}
            </div>
          </div>
        )}
        {response.risks && response.risks.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-yellow-500" />
              المخاطر المحتملة
            </div>
            <ul className="space-y-1">
              {response.risks.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-yellow-700 dark:text-yellow-400">
                  <span className="text-yellow-500 mt-0.5 flex-shrink-0">•</span>
                  {r}
                </li>
              ))}
            </ul>
          </div>
        )}
        {response.proposedChanges && response.proposedChanges.length > 0 && (
          <div>
            <button
              onClick={() => setShowChanges(v => !v)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {showChanges ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              عرض التعديلات ({response.proposedChanges.length} ملف)
            </button>
            {showChanges && (
              <div className="mt-2 space-y-2">
                {response.proposedChanges.map((c, i) => (
                  <div key={i} className="border border-border rounded-lg p-3 bg-muted/30">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        c.action === "create" ? "bg-green-500/15 text-green-600" :
                        c.action === "modify" ? "bg-blue-500/15 text-blue-600" :
                        "bg-red-500/15 text-red-600"
                      }`}>
                        {c.action === "create" ? "إنشاء" : c.action === "modify" ? "تعديل" : "حذف"}
                      </span>
                      <code className="text-xs font-mono text-primary truncate">{c.filePath}</code>
                    </div>
                    <p className="text-xs text-muted-foreground">{c.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {response.diffPreview && (
          <details className="text-xs">
            <summary className="cursor-pointer text-primary">معاينة الفرق الكاملة قبل الموافقة</summary>
            <pre dir="ltr" className="mt-2 max-h-64 overflow-auto rounded bg-zinc-950 p-2 text-[10px] text-zinc-100 whitespace-pre-wrap">{response.diffPreview}</pre>
          </details>
        )}
        {response.requiresApproval && !alreadyHandled && (
          <div className="flex items-center gap-2 pt-2 border-t border-border">
            <Button size="sm" onClick={onApprove} disabled={isExecuting} className="gap-1.5" data-testid="btn-approve-plan">
              {isExecuting ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
              موافق على التنفيذ
            </Button>
            <Button size="sm" variant="outline" onClick={onReject} disabled={isExecuting} className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10" data-testid="btn-reject-plan">
              <XCircle className="w-3 h-3" />
              رفض
            </Button>
          </div>
        )}
        {alreadyHandled && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-2 border-t border-border">
            <CheckCircle className="w-3 h-3 text-green-500" /> تمت المعالجة
          </div>
        )}
      </div>
    </div>
  );
}

function FileTreeNode({ node, onSelect, depth = 0 }: {
  node: FileNode;
  onSelect: (filePath: string) => void;
  depth?: number;
}) {
  const [open, setOpen] = useState(depth < 1);
  const indent = { paddingRight: `${depth * 14 + 8}px` };

  if (node.type === "dir") {
    return (
      <div>
        <button onClick={() => setOpen(o => !o)} style={indent} className="flex items-center gap-1.5 w-full text-right py-0.5 px-2 rounded hover:bg-muted text-sm text-muted-foreground hover:text-foreground transition-colors">
          {open ? <ChevronDown className="w-3 h-3 flex-shrink-0" /> : <ChevronRight className="w-3 h-3 flex-shrink-0" />}
          <Folder className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />
          <span className="truncate">{node.name}</span>
        </button>
        {open && node.children?.map(child => (
                    <FileTreeNode key={child.path} node={child} onSelect={onSelect} depth={depth + 1} />
        ))}
      </div>
    );
  }
  return (
    <button onClick={() => onSelect(node.path)} style={indent} className="flex items-center gap-1.5 w-full text-right py-0.5 px-2 rounded hover:bg-muted text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid={`file-item-${node.name}`}>
      <File className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
      <span className="truncate flex-1">{node.name}</span>
      {node.size !== undefined && (
        <span className="text-[10px] text-muted-foreground/40 flex-shrink-0">
          {node.size > 1024 ? `${Math.round(node.size / 1024)}k` : `${node.size}b`}
        </span>
      )}
    </button>
  );
}
export default function AdminAiAgent() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([{
    id: "welcome",
    role: "assistant",
    content: "",
    rawResponse: {
      type: "message",
      content: "مرحباً! أنا مساعد التطوير الذكي.\n\nيمكنني مساعدتك في:\n• تحليل الكود الحالي وفهم البنية\n• اقتراح ميزات جديدة مع خطة تنفيذ كاملة\n• شرح الملفات المتأثرة والمخاطر قبل التنفيذ\n• تنفيذ التعديلات بعد موافقتك فقط\n\nأرسل طلبك بالعربي وسأقوم بتحليله.",
    },
    timestamp: new Date(),
  }]);
  const [inputText, setInputText]     = useState("");
  const [isSending, setIsSending]     = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [handledIds, setHandledIds]   = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [activePanel, setActivePanel]   = useState<"terminal" | "files">("terminal");
  const [termOutput, setTermOutput]     = useState<{ cmd: string; out: string; err?: boolean }[]>([]);
  const [termCmd, setTermCmd]           = useState("");
  const [isRunningCmd, setIsRunningCmd] = useState(false);
  const [allowWrite, setAllowWrite]     = useState(false);
  const termEndRef = useRef<HTMLDivElement>(null);
  const [fileTree, setFileTree]           = useState<FileNode[]>([]);
  const [selectedFile, setSelectedFile]   = useState<string | null>(null);
  const [fileContent, setFileContent]     = useState("");
  const [isLoadingTree, setIsLoadingTree] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isSending]);
  useEffect(() => { termEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [termOutput]);
  useEffect(() => { if (activePanel === "files" && fileTree.length === 0) fetchFileTree(); }, [activePanel]);
  async function fetchFileTree() {
    setIsLoadingTree(true);
    try {
      const res = await fetch("/api/admin/ai-agent/files", { credentials: "include" });
      const data = await res.json();
      setFileTree(data.tree ?? []);
    } catch {
      toast({ title: "خطأ", description: "فشل تحميل شجرة الملفات", variant: "destructive" });
    } finally {
      setIsLoadingTree(false);
    }
  }
  async function fetchFileContent(filePath: string) {
    setSelectedFile(filePath);
    setIsLoadingFile(true);
    try {
      const res = await fetch(`/api/admin/ai-agent/file-content?path=${encodeURIComponent(filePath)}`, { credentials: "include" });
      const data = await res.json();
      setFileContent(data.content ?? "");
    } catch {
      toast({ title: "خطأ", description: "فشل قراءة الملف", variant: "destructive" });
    } finally {
      setIsLoadingFile(false);
    }
  }
  async function sendMessage() {
    if (!inputText.trim() || isSending) return;
    const userMsg: ChatMessage = { id: Date.now().toString(), role: "user", content: inputText.trim(), timestamp: new Date() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInputText("");
    setIsSending(true);
    try {
      const apiMsgs = updated.filter(m => m.id !== "welcome").map(m => ({
        role: m.role,
        content: m.role === "assistant"
          ? (m.rawResponse?.type === "plan" ? JSON.stringify({
              type: "plan",
              analysis: m.rawResponse.analysis,
              plan: m.rawResponse.plan,
              affectedFiles: m.rawResponse.affectedFiles,
              risks: m.rawResponse.risks,
              severity: m.rawResponse.severity,
              proposedChanges: m.rawResponse.proposedChanges?.map(change => ({
                filePath: change.filePath,
                action: change.action,
                description: change.description,
              })),
              requiresApproval: m.rawResponse.requiresApproval,
            }) : (m.rawResponse?.content ?? m.content))
          : m.content,
      }));
      const fileContext = selectedFile && fileContent
        ? `محتوى الملف المفتوح (${selectedFile}):\n\`\`\`\n${fileContent.slice(0, 3000)}\n\`\`\``
        : undefined;
      const res = await fetch("/api/admin/ai-agent/chat", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMsgs, fileContext }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Server error");
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(), role: "assistant",
        content: "", rawResponse: data.response, timestamp: new Date(),
      }]);
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  }
  async function approvePlan(msg: ChatMessage) {
      if (!msg.rawResponse?.proposedChanges || !msg.rawResponse.planId || !msg.rawResponse.approvalToken || isExecuting) return;
    setIsExecuting(true);
    try {
      const res = await fetch("/api/admin/ai-agent/execute", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: msg.rawResponse.planId, approvalToken: msg.rawResponse.approvalToken, validation: "build" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "فشل التنفيذ");
      setHandledIds(prev => new Set(Array.from(prev).concat(msg.id)));
      const ok  = (data.results ?? []).filter((r: any) => r.success).length;
      const err = (data.results ?? []).filter((r: any) => !r.success).length;
      const errDetails = err > 0
        ? "\n\nأخطاء:\n" + (data.results ?? []).filter((r: any) => !r.success).map((r: any) => `- ${r.filePath}: ${r.message}`).join("\n")
        : "";
      setMessages(prev => [...prev, {
        id: (Date.now() + 2).toString(), role: "assistant", content: "",
        rawResponse: {
          type: "message",
          content: `تم التنفيذ.\n• ملفات معدّلة: ${ok}\n• أخطاء: ${err}${errDetails}\n• التحقق: ${data.validation?.success ? "نجح" : data.validation?.preExistingFailures ? "توجد أخطاء سابقة لم يزدها التعديل" : "فشل"}${data.diff ? `\n\nفرق Git:\n${data.diff}` : ""}`,
        },
        timestamp: new Date(),
      }]);
      toast({ title: "تم التنفيذ", description: `${ok} ملف تم تعديله` });
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally {
      setIsExecuting(false);
    }
  }
  function rejectPlan(msg: ChatMessage) {
    setHandledIds(prev => new Set(Array.from(prev).concat(msg.id)));
    setMessages(prev => [...prev, {
      id: (Date.now() + 3).toString(), role: "assistant", content: "",
      rawResponse: { type: "message", content: "تم رفض الخطة. يمكنك تعديل طلبك أو طرح سؤال آخر." },
      timestamp: new Date(),
    }]);
  }
  async function runTerminalCmd() {
    if (!termCmd.trim() || isRunningCmd) return;
    const cmd = termCmd.trim();
    setTermCmd("");
    setIsRunningCmd(true);
    setTermOutput(prev => [...prev, { cmd, out: "⏳ جارٍ التنفيذ..." }]);
    try {
      const res = await fetch("/api/admin/ai-agent/terminal", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: cmd, allowWrite }),
      });
      const data = await res.json();
      setTermOutput(prev => [...prev.slice(0, -1), { cmd, out: data.output ?? data.message ?? "", err: !res.ok || data.isError }]);
    } catch (e: any) {
      setTermOutput(prev => [...prev.slice(0, -1), { cmd, out: e.message, err: true }]);
    } finally {
      setIsRunningCmd(false);
    }
  }
  return (
    <div className="flex gap-4 h-[calc(100vh-200px)] min-h-[600px]" dir="rtl">
      {/* Chat Panel */}
      <div className="flex-1 flex flex-col border border-border rounded-2xl overflow-hidden bg-card min-w-0">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card flex-shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center flex-shrink-0">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm">AI Developer Agent</div>
            <div className="text-xs text-muted-foreground">مساعد التطوير الذكي — GPT-4o</div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-muted-foreground">متصل</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-start" : "justify-end"}`}>
              <div className="max-w-[88%]">
                {msg.role === "user" ? (
                  <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm leading-relaxed">
                    {msg.content}
                  </div>
                ) : (
                  <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
                    {msg.rawResponse?.type === "message" && (
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.rawResponse.content}</p>
                    )}
                    {msg.rawResponse?.type === "plan" && (
                      <>
                        <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                          <Zap className="w-3 h-3 text-primary" /> تم إعداد خطة التنفيذ:
                        </p>
                        <PlanCard
                          response={msg.rawResponse}
                          onApprove={() => approvePlan(msg)}
                          onReject={() => rejectPlan(msg)}
                          isExecuting={isExecuting}
                          alreadyHandled={handledIds.has(msg.id)}
                        />
                      </>
                    )}
                    <div className="text-[10px] text-muted-foreground/40 mt-2 text-left">
                      {msg.timestamp.toLocaleTimeString("ar-EG")}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          {isSending && (
            <div className="flex justify-end">
              <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">يحلل الطلب...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        <div className="px-4 pb-4 pt-2 border-t border-border flex-shrink-0">
          {selectedFile && (
            <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground bg-blue-500/5 border border-blue-500/20 rounded-lg px-3 py-1.5">
              <FileText className="w-3 h-3 text-blue-500 flex-shrink-0" />
              <span className="truncate flex-1">سياق: {selectedFile}</span>
              <button onClick={() => { setSelectedFile(null); setFileContent(""); }} className="text-muted-foreground hover:text-foreground flex-shrink-0" data-testid="btn-clear-file-context">×</button>
            </div>
          )}
          <div className="flex gap-2">
            <Input
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="اكتب طلبك بالعربي..."
              className="flex-1 text-sm"
              disabled={isSending}
              data-testid="input-agent-message"
            />
            <Button onClick={sendMessage} disabled={isSending || !inputText.trim()} size="icon" data-testid="btn-send-message">
              {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>
      {/* Side Panel */}
      <div className="w-[380px] flex-shrink-0 flex flex-col border border-border rounded-2xl overflow-hidden bg-card">
        <div className="flex border-b border-border flex-shrink-0">
          {(["terminal", "files"] as const).map(tab => (
            <button key={tab} onClick={() => setActivePanel(tab)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${activePanel === tab ? "text-primary border-b-2 border-primary bg-primary/5" : "text-muted-foreground hover:text-foreground"}`}
              data-testid={`tab-${tab}`}
            >
              {tab === "terminal" ? <><Terminal className="w-4 h-4" /> Terminal</> : <><FolderOpen className="w-4 h-4" /> الملفات</>}
            </button>
          ))}
        </div>
        {activePanel === "terminal" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-3 py-2 border-b border-border flex items-center gap-2 flex-shrink-0">
              <button onClick={() => setAllowWrite(v => !v)}
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors ${allowWrite ? "bg-orange-500/10 text-orange-600 border-orange-500/30" : "bg-green-500/10 text-green-600 border-green-500/30"}`}
                data-testid="btn-toggle-write-mode"
              >
                {allowWrite ? <><ShieldAlert className="w-3 h-3" /> وضع الكتابة ⚠️</> : <><Shield className="w-3 h-3" /> وضع القراءة</>}
              </button>
              <button onClick={() => setTermOutput([])} className="mr-auto text-xs text-muted-foreground hover:text-foreground" data-testid="btn-clear-terminal">مسح</button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 font-mono text-xs bg-zinc-950 text-green-400 space-y-3">
              {termOutput.length === 0 && (
                <div className="text-green-700/60 leading-relaxed whitespace-pre">{`# Terminal جاهز\n# الأوامر المتاحة:\n# ls, pwd, cat, grep, find\n# ps, df, free, echo, wc\n# head, tail, du, node --version\n# npm list, git status/log/diff`}</div>
              )}
              {termOutput.map((item, i) => (
                <div key={i} className="space-y-1">
                  <div className="text-green-300 font-bold">$ {item.cmd}</div>
                  <pre className={`whitespace-pre-wrap break-all leading-relaxed ${item.err ? "text-red-400" : "text-green-400/80"}`}>{item.out}</pre>
                </div>
              ))}
              <div ref={termEndRef} />
            </div>
            <div className="p-3 border-t border-zinc-800 bg-zinc-900 flex gap-2 flex-shrink-0">
              <span className="text-green-400 font-mono text-sm flex-shrink-0 self-center">$</span>
              <Input
                value={termCmd}
                onChange={e => setTermCmd(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") runTerminalCmd(); }}
                placeholder="أدخل الأمر..."
                className="flex-1 text-xs font-mono bg-transparent border-0 text-green-300 placeholder:text-green-800 focus-visible:ring-0 h-8 px-1"
                disabled={isRunningCmd}
                data-testid="input-terminal-command"
              />
              <Button size="icon" variant="ghost" onClick={runTerminalCmd} disabled={isRunningCmd || !termCmd.trim()}
                className="h-8 w-8 text-green-400 hover:text-green-200 hover:bg-green-900/20" data-testid="btn-run-command">
                {isRunningCmd ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
              </Button>
            </div>
          </div>
        )}
        {activePanel === "files" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-3 py-2 border-b border-border flex items-center gap-2 flex-shrink-0">
              <span className="text-xs text-muted-foreground flex-1 truncate">{selectedFile ?? "اختر ملفاً لعرض محتواه"}</span>
              <button onClick={fetchFileTree} className="text-muted-foreground hover:text-foreground" data-testid="btn-refresh-tree">
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>
            {selectedFile ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="px-3 py-1.5 bg-muted/30 border-b border-border flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => { setSelectedFile(null); setFileContent(""); }} className="text-xs text-primary hover:underline">← العودة</button>
                  <span className="text-xs text-muted-foreground font-mono truncate">{selectedFile}</span>
                </div>
                {isLoadingFile ? (
                  <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <pre className="flex-1 overflow-auto p-3 text-xs font-mono text-foreground/80 bg-muted/20 leading-relaxed whitespace-pre-wrap break-all">
                    {fileContent}
                  </pre>
                )}
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-2">
                {isLoadingTree ? (
                  <div className="flex items-center justify-center h-full py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  fileTree.map(node => (
                    <FileTreeNode key={node.path} node={node} onSelect={fetchFileContent} />
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

