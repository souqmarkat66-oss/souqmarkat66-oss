import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MessageCircle, Send, ArrowRight, User, Mic, MicOff,
  Play, Square, Copy, CornerUpLeft, X, Check, CheckCheck
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { format, isToday, isYesterday } from "date-fns";
import { ar } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

function VoicePlayer({ url }: { url: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); a.currentTime = 0; setPlaying(false); }
    else { a.play().then(() => setPlaying(true)).catch(() => {}); }
  };
  return (
    <span>
      <audio ref={audioRef} src={url} onEnded={() => setPlaying(false)} className="hidden" />
      <button
        onClick={toggle}
        className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
        data-testid="btn-play-voice-dm"
      >
        {playing ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
        {playing ? "إيقاف" : "🎤 رسالة صوتية"}
      </button>
    </span>
  );
}

function formatMsgTime(dateStr: string) {
  try {
    const d = new Date(dateStr);
    if (isToday(d)) return format(d, "h:mm a", { locale: ar });
    if (isYesterday(d)) return "الأمس " + format(d, "h:mm a", { locale: ar });
    return format(d, "dd/MM h:mm a", { locale: ar });
  } catch { return ""; }
}

function formatConvTime(dateStr: string) {
  try {
    const d = new Date(dateStr);
    if (isToday(d)) return format(d, "h:mm a", { locale: ar });
    if (isYesterday(d)) return "الأمس";
    return format(d, "dd/MM", { locale: ar });
  } catch { return ""; }
}

function partnerName(conv: any) {
  const first = conv.partner_first_name || "";
  const last  = conv.partner_last_name  || "";
  const full  = `${first} ${last}`.trim();
  return full || conv.partner_id?.slice(0, 8) + "...";
}

function partnerInitials(conv: any) {
  const first = conv.partner_first_name || conv.partner_id?.[0] || "؟";
  const last  = conv.partner_last_name?.[0] || "";
  return (first[0] + last).toUpperCase();
}

export default function Messages() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activePartner, setActivePartner] = useState<string | null>(null);
  const [activePartnerInfo, setActivePartnerInfo] = useState<any | null>(null);
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [replyTo, setReplyTo] = useState<any | null>(null);
  const [contextMsg, setContextMsg] = useState<any | null>(null);
  const [copied, setCopied] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const { data: conversations = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/messages"],
    queryFn: () => fetch("/api/messages", { credentials: "include" }).then(r => r.json()),
    enabled: !!user,
    refetchInterval: 5000,
  });

  const { data: threadData } = useQuery<{ messages: any[]; partner: any }>({
    queryKey: ["/api/messages", activePartner],
    queryFn: () =>
      fetch(`/api/messages/${activePartner}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!activePartner,
    refetchInterval: 3000,
  });

  const thread = threadData?.messages || [];
  const partnerData = threadData?.partner || null;

  // Scroll to bottom when thread loads / new message arrives
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread.length]);

  const sendMutation = useMutation({
    mutationFn: (payload: { message: string; isVoice?: boolean; voiceUrl?: string; replyToId?: number; replyToText?: string }) =>
      apiRequest("POST", "/api/messages", { toUserId: activePartner, ...payload }),
    onSuccess: () => {
      setText("");
      setReplyTo(null);
      qc.invalidateQueries({ queryKey: ["/api/messages", activePartner] });
      qc.invalidateQueries({ queryKey: ["/api/messages"] });
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    },
  });

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const mimes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
      const mimeType = mimes.find(m => MediaRecorder.isTypeSupported(m)) || '';
      const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm';
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      rec.ondataavailable = ev => { if (ev.data.size > 0) chunksRef.current.push(ev.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        setRecSeconds(0);
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
        if (blob.size < 100) { toast({ variant: "destructive", title: "التسجيل قصير جداً" }); return; }
        setUploading(true);
        try {
          const fd = new FormData();
          fd.append("file", blob, `voice-msg-${Date.now()}.${ext}`);
          const upRes = await fetch("/api/upload", { method: "POST", body: fd, credentials: "include" });
          if (!upRes.ok) throw new Error("فشل رفع الصوت");
          const { url: voiceUrl } = await upRes.json();
          sendMutation.mutate({ message: "🎤 رسالة صوتية", isVoice: true, voiceUrl });
        } catch {
          toast({ variant: "destructive", title: "فشل إرسال الرسالة الصوتية" });
        } finally { setUploading(false); }
      };
      rec.start(200);
      recRef.current = rec;
      setRecording(true);
      setRecSeconds(0);
      timerRef.current = setInterval(() => setRecSeconds(s => s + 1), 1000);
    } catch {
      toast({ variant: "destructive", title: "لا يمكن الوصول للميكروفون" });
    }
  };

  const stopRecording = () => {
    const r = recRef.current;
    if (r && r.state !== "inactive") r.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleReply = (msg: any) => {
    setReplyTo(msg);
    setContextMsg(null);
    inputRef.current?.focus();
  };

  const handleCopy = (msg: any) => {
    navigator.clipboard.writeText(msg.message || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    setContextMsg(null);
  };

  const sendText = () => {
    if (!text.trim()) return;
    sendMutation.mutate({
      message: text,
      replyToId: replyTo?.id,
      replyToText: replyTo?.message,
    });
  };

  if (!user) return (
    <div className="container px-4 py-20 text-center" dir="rtl">
      <p className="text-muted-foreground">يجب تسجيل الدخول أولاً</p>
    </div>
  );

  const displayName = partnerData
    ? `${partnerData.first_name || ""} ${partnerData.last_name || ""}`.trim() || "مستخدم"
    : activePartner?.slice(0, 10) + "...";

  return (
    <div
      className="container px-2 sm:px-4 py-4 sm:py-8 max-w-5xl"
      dir="rtl"
      onClick={() => contextMsg && setContextMsg(null)}
    >
      {/* Page Header */}
      <div className="flex items-center gap-3 mb-4 sm:mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
          <MessageCircle className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-black">الرسائل المباشرة</h1>
          <p className="text-xs text-muted-foreground">تواصل مع البائعين والمشترين مباشرةً</p>
        </div>
      </div>

      <div className={`grid gap-3 ${activePartner ? "grid-cols-1 md:grid-cols-3" : "grid-cols-1 md:grid-cols-3"} h-[580px]`}>

        {/* ── Conversations Sidebar ──────────────────────── */}
        <div className={`border border-border/60 rounded-2xl overflow-hidden flex flex-col
          ${activePartner ? "hidden md:flex" : "flex"}`}>
          <div className="px-4 py-3 border-b bg-muted/30">
            <p className="font-bold text-sm">المحادثات ({conversations.length})</p>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-border/20">
            {isLoading ? (
              <div className="space-y-3 p-3">
                {[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-10 px-4">
                <MessageCircle className="w-10 h-10 mb-3 opacity-20" />
                <p className="text-sm font-medium">لا توجد رسائل بعد</p>
                <p className="text-xs mt-1 text-center">ابدأ محادثة من صفحة أي إعلان</p>
              </div>
            ) : (
              conversations.map((conv: any) => {
                const isActive = activePartner === conv.partner_id;
                const hasUnread = !conv.is_read && conv.from_user_id !== user.id;
                return (
                  <button
                    key={conv.partner_id}
                    onClick={() => {
                      setActivePartner(conv.partner_id);
                      setActivePartnerInfo(conv);
                      setReplyTo(null);
                      setContextMsg(null);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-right transition-colors
                      ${isActive ? "bg-primary/8 border-r-[3px] border-r-primary" : "hover:bg-muted/40"}`}
                    data-testid={`conv-${conv.partner_id}`}
                  >
                    {/* Avatar */}
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold
                      ${isActive ? "bg-primary text-white" : "bg-primary/10 text-primary"}`}>
                      {conv.partner_avatar
                        ? <img src={conv.partner_avatar} alt="" className="w-full h-full rounded-full object-cover" />
                        : partnerInitials(conv)
                      }
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className={`text-sm truncate ${hasUnread ? "font-bold" : "font-medium"}`}>
                          {partnerName(conv)}
                        </p>
                        <span className="text-[10px] text-muted-foreground flex-shrink-0">
                          {formatConvTime(conv.created_at)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <p className={`text-xs truncate flex-1 ${hasUnread ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                          {conv.from_user_id === user.id ? "أنت: " : ""}
                          {conv.message?.startsWith("🎤") ? "🎤 رسالة صوتية" : conv.message}
                        </p>
                        {hasUnread && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── Chat Thread ───────────────────────────────── */}
        <div className={`md:col-span-2 border border-border/60 rounded-2xl overflow-hidden flex flex-col
          ${activePartner ? "flex" : "hidden md:flex"}`}>

          {!activePartner ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <MessageCircle className="w-10 h-10 opacity-20" />
              </div>
              <p className="text-sm font-medium">اختر محادثة من القائمة</p>
              <p className="text-xs mt-1">أو ابدأ محادثة جديدة من صفحة إعلان</p>
            </div>
          ) : (
            <>
              {/* Thread Header */}
              <div className="px-4 py-3 border-b bg-muted/30 flex items-center gap-3">
                <button
                  onClick={() => { setActivePartner(null); setActivePartnerInfo(null); }}
                  className="md:hidden p-1 rounded-lg hover:bg-muted"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {partnerData?.profile_image_url
                    ? <img src={partnerData.profile_image_url} alt="" className="w-full h-full rounded-full object-cover" />
                    : (displayName[0] || "؟").toUpperCase()
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{displayName}</p>
                  <p className="text-xs text-muted-foreground">نشط مؤخراً</p>
                </div>
              </div>

              {/* Messages */}
              <div
                className="flex-1 overflow-y-auto p-4 space-y-1"
                onClick={() => setContextMsg(null)}
              >
                {thread.length === 0 && (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                    ابدأ المحادثة...
                  </div>
                )}
                {thread.map((msg: any, idx: number) => {
                  const isMine = msg.from_user_id === user.id;
                  const showDate = idx === 0 || (
                    new Date(thread[idx - 1].created_at).toDateString() !== new Date(msg.created_at).toDateString()
                  );
                  const isContextOpen = contextMsg?.id === msg.id;

                  return (
                    <div key={msg.id}>
                      {/* Date separator */}
                      {showDate && (
                        <div className="flex items-center gap-3 my-3">
                          <div className="flex-1 h-px bg-border" />
                          <span className="text-[10px] text-muted-foreground bg-background px-2">
                            {isToday(new Date(msg.created_at)) ? "اليوم"
                              : isYesterday(new Date(msg.created_at)) ? "الأمس"
                              : format(new Date(msg.created_at), "dd MMMM yyyy", { locale: ar })}
                          </span>
                          <div className="flex-1 h-px bg-border" />
                        </div>
                      )}

                      {/* Message row */}
                      <div className={`flex ${isMine ? "justify-start" : "justify-end"} group mb-1`}>
                        {/* Context menu (click on msg) */}
                        <div className="relative">
                          {/* Bubble */}
                          <div
                            onClick={e => { e.stopPropagation(); setContextMsg(isContextOpen ? null : msg); }}
                            className={`max-w-[75%] rounded-2xl px-4 py-2.5 cursor-pointer select-text
                              ${isMine
                                ? "bg-primary text-white rounded-br-sm"
                                : "bg-muted text-foreground rounded-bl-sm"}
                              ${isContextOpen ? "ring-2 ring-primary/40" : ""}
                            `}
                            data-testid={`msg-bubble-${msg.id}`}
                          >
                            {/* Reply-to preview */}
                            {msg.reply_to_text && (
                              <div className={`text-[10px] mb-1.5 px-2 py-1 rounded-lg border-r-2
                                ${isMine ? "border-white/50 bg-white/10 text-white/70" : "border-primary bg-primary/5 text-muted-foreground"}`}>
                                <CornerUpLeft className="w-2.5 h-2.5 inline ml-1 opacity-70" />
                                {msg.reply_to_text?.slice(0, 60)}{msg.reply_to_text?.length > 60 ? "..." : ""}
                              </div>
                            )}

                            {/* Content */}
                            {msg.is_voice && msg.voice_url ? (
                              <VoicePlayer url={msg.voice_url} />
                            ) : (
                              <p className="text-sm leading-relaxed break-words whitespace-pre-line">{msg.message}</p>
                            )}

                            {/* Time + read */}
                            <div className={`flex items-center gap-1 justify-end mt-1`}>
                              <span className={`text-[10px] ${isMine ? "text-white/60" : "text-muted-foreground"}`}>
                                {formatMsgTime(msg.created_at)}
                              </span>
                              {isMine && (
                                msg.is_read
                                  ? <CheckCheck className="w-3 h-3 text-white/80" />
                                  : <Check className="w-3 h-3 text-white/50" />
                              )}
                            </div>
                          </div>

                          {/* Context popup */}
                          {isContextOpen && (
                            <div
                              className={`absolute z-20 bottom-full mb-1 flex gap-1 shadow-lg rounded-xl border bg-background p-1
                                ${isMine ? "left-0" : "right-0"}`}
                              onClick={e => e.stopPropagation()}
                            >
                              <button
                                onClick={() => handleReply(msg)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-muted text-xs font-medium transition-colors"
                                data-testid={`btn-reply-${msg.id}`}
                              >
                                <CornerUpLeft className="w-3.5 h-3.5" /> رد
                              </button>
                              {!msg.is_voice && (
                                <button
                                  onClick={() => handleCopy(msg)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-muted text-xs font-medium transition-colors"
                                  data-testid={`btn-copy-${msg.id}`}
                                >
                                  {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                                  {copied ? "تم" : "نسخ"}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              {/* Reply-to bar */}
              {replyTo && (
                <div className="px-4 py-2 border-t border-primary/20 bg-primary/5 flex items-center gap-2">
                  <CornerUpLeft className="w-4 h-4 text-primary flex-shrink-0" />
                  <p className="text-xs text-muted-foreground flex-1 truncate">
                    {replyTo.message?.slice(0, 80)}{replyTo.message?.length > 80 ? "..." : ""}
                  </p>
                  <button onClick={() => setReplyTo(null)} className="p-1 hover:bg-muted rounded-lg">
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
              )}

              {/* Input */}
              <div className="p-3 border-t border-border/40 flex gap-2">
                {recording ? (
                  <div className="flex-1 h-10 flex items-center gap-2 rounded-xl border border-destructive bg-destructive/5 px-3 text-destructive text-sm font-medium animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-destructive inline-block animate-ping" />
                    جارٍ التسجيل... {recSeconds}ث
                  </div>
                ) : (
                  <Input
                    ref={inputRef}
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && text.trim()) { e.preventDefault(); sendText(); } }}
                    placeholder={replyTo ? "اكتب ردك..." : "اكتب رسالتك..."}
                    className="flex-1 h-10"
                    dir="rtl"
                    data-testid="input-message"
                    disabled={uploading || sendMutation.isPending}
                  />
                )}

                {/* Voice */}
                <Button
                  size="sm"
                  variant={recording ? "destructive" : "outline"}
                  className={`h-10 w-10 p-0 rounded-full flex-shrink-0 ${recording ? "animate-pulse" : ""}`}
                  onClick={recording ? stopRecording : startRecording}
                  disabled={uploading}
                  title={recording ? "إيقاف وإرسال" : "رسالة صوتية"}
                  data-testid="btn-voice-record-msg"
                >
                  {recording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </Button>

                {/* Send */}
                {!recording && (
                  <Button
                    size="sm" className="h-10 w-10 p-0 flex-shrink-0"
                    onClick={sendText}
                    disabled={!text.trim() || sendMutation.isPending || uploading}
                    data-testid="btn-send-message"
                  >
                    {sendMutation.isPending
                      ? <span className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                      : <Send className="w-4 h-4" />
                    }
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
