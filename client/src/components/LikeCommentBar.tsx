import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Heart, MessageCircle, Share2, Flag, Send, Mic, MicOff, Volume2 } from "lucide-react";
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

export function LikeCommentBar({ targetType, targetId, initialLikes = 0, showComments = true }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showChat, setShowChat] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [localLikes, setLocalLikes] = useState(initialLikes);
  const [liked, setLiked] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);

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
    mutationFn: (content: string) => fetch("/api/comments", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType, targetId, content }), credentials: "include"
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
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = e => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setVoiceBlob(blob);
        stream.getTracks().forEach(t => t.stop());
        // Submit voice comment as text with audio icon indicator
        commentMutation.mutate("🎤 [تعليق صوتي]");
      };
      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch {
      toast({ variant: "destructive", title: "لا يمكن الوصول للميكروفون" });
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
    }
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
              <Input
                value={commentText} onChange={e => setCommentText(e.target.value)}
                placeholder="أضف تعليقاً..." className="flex-1 h-9 text-sm rounded-full"
                onKeyDown={e => e.key === 'Enter' && commentText.trim() && commentMutation.mutate(commentText)}
                data-testid="input-comment"
              />
              {/* Voice Comment Button */}
              <Button
                size="sm"
                variant={isRecording ? "destructive" : "outline"}
                onClick={isRecording ? stopRecording : startRecording}
                className={`h-9 w-9 p-0 rounded-full ${isRecording ? 'animate-pulse' : ''}`}
                title={isRecording ? "إيقاف التسجيل" : "تعليق صوتي"}
                data-testid="btn-voice-comment"
              >
                {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </Button>
              <Button
                size="sm" onClick={() => commentMutation.mutate(commentText)}
                disabled={!commentText.trim() || commentMutation.isPending}
                className="h-9 w-9 p-0 rounded-full"
                data-testid="btn-send-comment"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          )}
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {comments.map((c: any) => (
              <div key={c.id} className="flex gap-2 text-sm" data-testid={`comment-${c.id}`}>
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5">
                  {c.userName?.[0] || "م"}
                </div>
                <div className="flex-1 bg-muted/40 rounded-2xl px-3 py-2 group">
                  <span className="font-semibold text-primary text-xs">{c.userName} </span>
                  <span className="text-foreground/90">{c.content}</span>
                  {/* TTS play for all comments */}
                  {c.content && !c.content.includes('[تعليق صوتي]') && (
                    <button
                      onClick={() => speakArabic(c.content)}
                      className="ms-2 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary"
                      title="استمع للتعليق"
                    >
                      <Volume2 className="w-3 h-3 inline" />
                    </button>
                  )}
                  {c.isVoice && (
                    <span className="ms-1 text-primary text-xs">🎤</span>
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
