import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Bell, Check, Trash2, Play, Square, Mic, MicOff, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

const TYPE_ICONS: Record<string, string> = {
  like: "❤️",
  comment: "💬",
  payment: "💰",
  campaign_approved: "✅",
  campaign_rejected: "❌",
  new_subscriber: "🔔",
  fraud_alert: "🚨",
  system: "📢",
};

function MiniVoicePlayer({ url }: { url: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); a.currentTime = 0; setPlaying(false); }
    else { a.play().then(() => setPlaying(true)).catch(() => {}); }
  };
  return (
    <span className="inline-flex items-center gap-1" onClick={e => e.stopPropagation()}>
      <audio ref={audioRef} src={url} onEnded={() => setPlaying(false)} className="hidden" />
      <button
        onClick={toggle}
        className="flex items-center gap-1 bg-primary/15 hover:bg-primary/25 text-primary rounded-full px-2.5 py-1 text-xs font-medium transition-colors mt-1"
        data-testid="btn-notif-play-voice"
      >
        {playing ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
        <span>{playing ? "إيقاف" : "استمع 🎤"}</span>
      </button>
    </span>
  );
}

function VoiceReplyButton({ toUserId, label }: { toUserId: string; label: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [uploading, setUploading] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = async (e: React.MouseEvent) => {
    e.stopPropagation();
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
        setSeconds(0);
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
        if (blob.size < 100) { toast({ variant: "destructive", title: "التسجيل قصير جداً" }); return; }
        setUploading(true);
        try {
          const fd = new FormData();
          fd.append("file", blob, `voice-reply-${Date.now()}.${ext}`);
          const upRes = await fetch("/api/upload", { method: "POST", body: fd, credentials: "include" });
          if (!upRes.ok) throw new Error("فشل رفع الصوت");
          const { url: voiceUrl } = await upRes.json();
          await fetch("/api/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ toUserId, message: "🎤 رد صوتي", isVoice: true, voiceUrl }),
            credentials: "include",
          });
          qc.invalidateQueries({ queryKey: ["/api/messages"] });
          toast({ title: "✅ تم إرسال الرد الصوتي!" });
        } catch {
          toast({ variant: "destructive", title: "فشل إرسال الرد الصوتي" });
        } finally { setUploading(false); }
      };
      rec.start(200);
      recRef.current = rec;
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } catch {
      toast({ variant: "destructive", title: "لا يمكن الوصول للميكروفون" });
    }
  };

  const stop = (e: React.MouseEvent) => {
    e.stopPropagation();
    const r = recRef.current;
    if (r && r.state !== "inactive") r.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  return (
    <span className="inline-flex items-center gap-1 mt-1" onClick={e => e.stopPropagation()}>
      {recording ? (
        <button
          onClick={stop}
          className="flex items-center gap-1 bg-destructive/10 hover:bg-destructive/20 text-destructive rounded-full px-2.5 py-1 text-xs font-medium animate-pulse transition-colors"
          data-testid="btn-stop-voice-reply"
        >
          <MicOff className="w-3 h-3" /> إرسال ({seconds}ث)
        </button>
      ) : (
        <button
          onClick={start}
          disabled={uploading}
          className="flex items-center gap-1 bg-green-500/10 hover:bg-green-500/20 text-green-600 rounded-full px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50"
          data-testid="btn-start-voice-reply"
        >
          {uploading ? <Send className="w-3 h-3 animate-pulse" /> : <Mic className="w-3 h-3" />}
          {uploading ? "جارٍ الإرسال..." : `رد بصوتك على ${label}`}
        </button>
      )}
    </span>
  );
}

export function NotificationBell() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: countData } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    queryFn: () => fetch("/api/notifications/unread-count", { credentials: "include" }).then(r => r.json()),
    enabled: !!user,
    refetchInterval: 15000,
  });

  const { data: notifications = [] } = useQuery<any[]>({
    queryKey: ["/api/notifications"],
    queryFn: () => fetch("/api/notifications", { credentials: "include" }).then(r => r.json()),
    enabled: !!user,
  });

  const readAllMutation = useMutation({
    mutationFn: () => apiRequest("PUT", "/api/notifications/read-all"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/notifications"] });
      qc.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/notifications/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/notifications"] });
      qc.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const markReadMutation = useMutation({
    mutationFn: (id: number) => apiRequest("PUT", `/api/notifications/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/notifications"] });
      qc.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  if (!user) return null;
  const unread = countData?.count || 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-full w-9 h-9"
          data-testid="btn-notification-bell"
        >
          <Bell className="w-5 h-5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1 leading-none">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-80 max-h-[520px] flex flex-col p-0 overflow-hidden"
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" />
            <span className="font-bold text-sm">الإشعارات</span>
            {unread > 0 && (
              <Badge variant="destructive" className="text-xs h-5 px-1.5">{unread}</Badge>
            )}
          </div>
          {unread > 0 && (
            <Button
              variant="ghost" size="sm"
              className="text-xs h-7 gap-1 text-primary"
              onClick={() => readAllMutation.mutate()}
              disabled={readAllMutation.isPending}
            >
              <Check className="w-3 h-3" /> قراءة الكل
            </Button>
          )}
        </div>

        {/* Notifications List */}
        <div className="overflow-y-auto flex-1">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Bell className="w-10 h-10 mb-2 opacity-20" />
              <p className="text-sm">لا توجد إشعارات</p>
            </div>
          ) : (
            notifications.map((n: any) => {
              const isVoiceNotif = !!(n.voice_url);
              const senderName = n.body?.split(":")?.[0] || "مستخدم";
              return (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 px-4 py-3 border-b border-border/30 transition-colors hover:bg-muted/30 group ${!n.is_read ? "bg-primary/5" : ""} ${n.link ? "cursor-pointer" : ""}`}
                  onClick={() => {
                    markReadMutation.mutate(n.id);
                    if (n.link && !isVoiceNotif) setLocation(n.link);
                  }}
                >
                  <div className="text-xl flex-shrink-0 mt-0.5">
                    {isVoiceNotif ? "🎤" : (TYPE_ICONS[n.type] || "📢")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-tight mb-0.5 ${!n.is_read ? "font-bold" : "font-medium"}`}>
                      {n.title}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{n.body}</p>

                    {/* Voice player for voice comment notifications */}
                    {isVoiceNotif && (
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <MiniVoicePlayer url={n.voice_url} />
                        {n.sender_user_id && n.sender_user_id !== user.id && (
                          <VoiceReplyButton toUserId={n.sender_user_id} label={senderName} />
                        )}
                      </div>
                    )}

                    {/* Navigate link for non-voice */}
                    {!isVoiceNotif && n.link && (
                      <button
                        onClick={e => { e.stopPropagation(); markReadMutation.mutate(n.id); setLocation(n.link); }}
                        className="text-[10px] text-primary hover:underline mt-0.5 block"
                      >
                        عرض المحتوى ←
                      </button>
                    )}

                    <p className="text-[10px] text-muted-foreground/60 mt-1">
                      {n.created_at && format(new Date(n.created_at), "dd MMM، h:mm a", { locale: ar })}
                    </p>
                  </div>
                  <div className="flex flex-col items-center gap-1 flex-shrink-0">
                    {!n.is_read && <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
                    <button
                      onClick={e => { e.stopPropagation(); deleteMutation.mutate(n.id); }}
                      className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-all p-0.5"
                      data-testid={`btn-delete-notif-${n.id}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
