import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Heart, MessageCircle, Share2, Flag, Send, Mic, MicOff, Volume2, Play, Square } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

interface Props {
  targetType: "ad" | "stream";
  targetId: number;
  initialLikes?: number;
  showComments?: boolean;
}

function speakArabic(text: string) {
  if (!('speechSynthesis' in window)) return;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'ar-EG';
  utter.rate = 0.9;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
}

function VoicePlayer({ url }: { url: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      a.currentTime = 0;
      setPlaying(false);
    } else {
      a.play().then(() => setPlaying(true)).catch(() => {});
    }
  };

  return (
    <span className="inline-flex items-center gap-1 ms-1">
      <audio ref={audioRef} src={url} onEnded={() => setPlaying(false)} className="hidden" />
      <button
        onClick={toggle}
        className="inline-flex items-center gap-1 bg-primary/10 hover:bg-primary/20 text-primary rounded-full px-2 py-0.5 text-xs transition-colors"
        title={playing ? "إيقاف" : "استمع"}
        data-testid="btn-play-voice"
      >
        {playing ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
        <span>{playing ? "إيقاف" : "استمع 🎤"}</span>
      </button>
    </span>
  );
}

export function LikeCommentBar({ targetType, targetId, initialLikes = 0, showComments = true }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showChat, setShowChat] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [localLikes, setLocalLikes] = useState(initialLikes);
  const [liked, setLiked] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: comments = [], refetch } = useQuery<any[]>({
    queryKey: ["/api/comments", targetType, targetId],
    queryFn: () => fetch(`/api/comments/${targetType}/${targetId}`).then(r => r.json()),
    enabled: showChat,
  });

  const { data: likeData } = useQuery<{ liked: boolean }>({
    queryKey: ["/api/likes", targetType, targetId],
    queryFn: () => fetch(`/api/likes/${targetType}/${targetId}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!user,
    onSuccess: (d) => setLiked(d.liked),
  } as any);

  const likeMutation = useMutation({
    mutationFn: () => fetch("/api/likes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetType, targetId }), credentials: "include" }).then(r => r.json()),
    onSuccess: (d) => {
      setLiked(d.liked);
      setLocalLikes(prev => d.liked ? prev + 1 : Math.max(0, prev - 1));
    },
  });

  const commentMutation = useMutation({
    mutationFn: (payload: { content: string; isVoiceComment?: boolean; voiceText?: string }) =>
      fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, targetId, ...payload }),
        credentials: "include",
      }).then(r => r.json()),
    onSuccess: () => { setCommentText(""); refetch(); },
    onError: (e: any) => toast({ variant: "destructive", title: "خطأ", description: e.message }),
  });

  const reportMutation = useMutation({
    mutationFn: () => fetch("/api/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetType, targetId, reason: "محتوى مخالف للسياسة" }), credentials: "include" }).then(r => r.json()),
    onSuccess: () => toast({ title: "تم إرسال البلاغ. سنراجعه قريباً." }),
  });

  const handleLike = () => {
    if (!user) { window.location.href = "/api/login"; return; }
    likeMutation.mutate();
  };

  const startRecording = async () => {
    if (!user) { window.location.href = "/api/login"; return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        setRecordingSeconds(0);

        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (blob.size < 100) {
          toast({ variant: "destructive", title: "التسجيل قصير جداً" });
          return;
        }

        // Upload audio file
        const formData = new FormData();
        formData.append("file", blob, `voice-${Date.now()}.webm`);
        try {
          const res = await fetch("/api/upload", { method: "POST", body: formData, credentials: "include" });
          const data = await res.json();
          if (!data.url) throw new Error("لم يتم رفع الصوت");
          // Save as voice comment with audio URL
          commentMutation.mutate({ content: "🎤 تعليق صوتي", isVoiceComment: true, voiceText: data.url });
        } catch (err: any) {
          toast({ variant: "destructive", title: "فشل رفع الصوت", description: err.message });
        }
      };
      recorder.start(200);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);

      // Timer counter
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000);
    } catch {
      toast({ variant: "destructive", title: "لا يمكن الوصول للميكروفون" });
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  return (
    <div>
      <div className="flex items-center gap-2 pt-3 border-t border-border/40">
        <Button
          onClick={handleLike}
          variant="ghost" size="sm"
          className={`gap-1.5 h-8 px-3 rounded-full ${liked ? 'text-red-500 bg-red-50 dark:bg-red-950/20' : ''}`}
          data-testid={`btn-like-${targetType}-${targetId}`}
        >
          <Heart className={`w-4 h-4 ${liked ? 'fill-current' : ''}`} />
          <span className="text-sm">{localLikes.toLocaleString()}</span>
        </Button>
        {showComments && (
          <Button
            onClick={() => setShowChat(!showChat)}
            variant="ghost" size="sm" className="gap-1.5 h-8 px-3 rounded-full"
            data-testid={`btn-comments-${targetType}-${targetId}`}
          >
            <MessageCircle className="w-4 h-4" />
            <span className="text-sm">{comments.length || ""}</span>
          </Button>
        )}
        <Button
          onClick={() => { navigator.clipboard.writeText(window.location.origin + `/${targetType}s/${targetId}`); toast({ title: "تم نسخ الرابط!" }); }}
          variant="ghost" size="sm" className="gap-1.5 h-8 px-3 rounded-full"
          data-testid={`btn-share-${targetType}-${targetId}`}
        >
          <Share2 className="w-4 h-4" />
        </Button>
        {user && (
          <Button
            onClick={() => reportMutation.mutate()}
            variant="ghost" size="sm"
            className="gap-1.5 h-8 px-3 rounded-full ms-auto text-muted-foreground hover:text-destructive"
            data-testid={`btn-report-${targetType}-${targetId}`}
          >
            <Flag className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

      {showChat && showComments && (
        <div className="mt-3 space-y-3">
          {user && (
            <div className="flex gap-2">
              {/* Recording indicator */}
              {isRecording ? (
                <div className="flex-1 flex items-center gap-2 h-9 px-3 rounded-full border border-destructive bg-destructive/5 text-destructive text-sm font-medium animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-destructive inline-block" />
                  جارٍ التسجيل... {recordingSeconds}ث
                </div>
              ) : (
                <Input
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  placeholder="أضف تعليقاً..."
                  className="flex-1 h-9 text-sm rounded-full"
                  onKeyDown={e => e.key === 'Enter' && commentText.trim() && commentMutation.mutate({ content: commentText })}
                  data-testid="input-comment"
                />
              )}

              {/* Voice Record Button */}
              <Button
                size="sm"
                variant={isRecording ? "destructive" : "outline"}
                onClick={isRecording ? stopRecording : startRecording}
                className={`h-9 w-9 p-0 rounded-full ${isRecording ? 'animate-pulse' : ''}`}
                title={isRecording ? "إرسال التسجيل" : "تعليق صوتي"}
                data-testid="btn-voice-comment"
              >
                {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </Button>

              {/* Send Text Button */}
              {!isRecording && (
                <Button
                  size="sm"
                  onClick={() => commentMutation.mutate({ content: commentText })}
                  disabled={!commentText.trim() || commentMutation.isPending}
                  className="h-9 w-9 p-0 rounded-full"
                  data-testid="btn-send-comment"
                >
                  <Send className="w-4 h-4" />
                </Button>
              )}
            </div>
          )}

          {/* Comments List */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {comments.length === 0 && (
              <p className="text-center text-xs text-muted-foreground py-3">لا توجد تعليقات بعد — كن أول من يعلّق!</p>
            )}
            {comments.map((c: any) => (
              <div key={c.id} className="flex gap-2 text-sm" data-testid={`comment-${c.id}`}>
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5">
                  {c.userName?.[0] || "م"}
                </div>
                <div className="flex-1 bg-muted/40 rounded-2xl px-3 py-2 group">
                  <span className="font-semibold text-primary text-xs">{c.userName} </span>

                  {/* Voice comment with audio player */}
                  {c.isVoiceComment && c.voiceText ? (
                    <VoicePlayer url={c.voiceText} />
                  ) : (
                    <>
                      <span className="text-foreground/90">{c.content}</span>
                      {/* TTS listen button for text comments */}
                      {c.content && (
                        <button
                          onClick={() => speakArabic(c.content)}
                          className="ms-2 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary"
                          title="استمع للتعليق"
                        >
                          <Volume2 className="w-3 h-3 inline" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
