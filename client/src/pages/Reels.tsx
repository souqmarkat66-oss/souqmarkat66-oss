import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/components/LanguageProvider";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Heart, MessageCircle, Share2, Plus, Play, Upload, Loader2, Volume2, VolumeX, ChevronUp, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";

type Reel = {
  id: number;
  title: string;
  description?: string;
  videoUrl: string;
  thumbnailUrl?: string;
  viewsCount: number;
  likesCount: number;
  commentsCount: number;
  userId: string;
  createdAt: string;
};

function speakEgyptian(text: string) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ar-EG';
  utterance.rate = 0.9;
  const voices = window.speechSynthesis.getVoices();
  const arVoice = voices.find(v => v.lang.startsWith('ar'));
  if (arVoice) utterance.voice = arVoice;
  window.speechSynthesis.speak(utterance);
}

function ReelCard({ reel, isActive }: { reel: Reel; isActive: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [liked, setLiked] = useState(false);
  const [localLikes, setLocalLikes] = useState(reel.likesCount);
  const [muted, setMuted] = useState(true); // start muted — browser requires this for autoplay
  const [showUnmuteHint, setShowUnmuteHint] = useState(true);
  const [showComments, setShowComments] = useState(false);
  const [comment, setComment] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: comments = [] } = useQuery<any[]>({
    queryKey: ['/api/comments/reel', reel.id],
    queryFn: () => fetch(`/api/comments/reel/${reel.id}`, { credentials: 'include' }).then(r => r.json()),
    enabled: showComments,
  });

  const likeMutation = useMutation({
    mutationFn: () => apiRequest('/api/likes', 'POST', { targetType: 'reel', targetId: reel.id }),
    onSuccess: (data: any) => {
      setLiked(data.liked);
      setLocalLikes(prev => data.liked ? prev + 1 : Math.max(0, prev - 1));
    }
  });

  const commentMutation = useMutation({
    mutationFn: () => apiRequest('/api/comments', 'POST', { targetType: 'reel', targetId: reel.id, content: comment }),
    onSuccess: () => {
      setComment("");
      queryClient.invalidateQueries({ queryKey: ['/api/comments/reel', reel.id] });
    }
  });

  // React doesn't sync the `muted` prop to the DOM element correctly — must use ref
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = muted;
      videoRef.current.volume = muted ? 0 : 1;
    }
  }, [muted]);

  // Auto-play when active
  useEffect(() => {
    if (!videoRef.current) return;
    if (isActive) {
      videoRef.current.muted = true; // must start muted
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
    }
  }, [isActive]);

  const handleUnmute = () => {
    if (videoRef.current) {
      videoRef.current.muted = false;
      videoRef.current.volume = 1;
      if (videoRef.current.paused) videoRef.current.play();
    }
    setMuted(false);
    setShowUnmuteHint(false);
  };

  const handleToggleMute = () => {
    const newMuted = !muted;
    if (videoRef.current) {
      videoRef.current.muted = newMuted;
      videoRef.current.volume = newMuted ? 0 : 1;
    }
    setMuted(newMuted);
    if (!newMuted) setShowUnmuteHint(false);
  };

  return (
    <div className="relative h-screen w-full snap-start bg-black flex items-center justify-center overflow-hidden">
      <video
        ref={videoRef}
        src={reel.videoUrl}
        className="w-full h-full object-contain"
        loop
        autoPlay={isActive}
        muted={muted}
        playsInline
        onClick={() => videoRef.current?.paused ? videoRef.current.play() : videoRef.current?.pause()}
      />

      {/* TAP TO UNMUTE — always visible when muted */}
      {muted && showUnmuteHint && (
        <button
          onClick={handleUnmute}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-2 animate-pulse"
          data-testid="btn-unmute-reel"
        >
          <div className="w-20 h-20 rounded-full bg-black/60 backdrop-blur border-2 border-white/40 flex items-center justify-center">
            <Volume2 className="w-9 h-9 text-white" />
          </div>
          <span className="text-white text-sm font-bold bg-black/60 px-3 py-1 rounded-full">
            انقر لتشغيل الصوت 🔊
          </span>
        </button>
      )}

      {/* Muted indicator (small) — after hint dismissed */}
      {muted && !showUnmuteHint && (
        <button
          onClick={handleToggleMute}
          className="absolute top-4 left-4 z-20 flex items-center gap-1.5 bg-black/60 backdrop-blur text-white text-xs px-3 py-1.5 rounded-full border border-white/20"
          data-testid="btn-muted-indicator"
        >
          <VolumeX className="w-3.5 h-3.5" /> مكتوم
        </button>
      )}

      {/* Overlay info */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
        <h3 className="text-white font-bold text-lg">{reel.title}</h3>
        {reel.description && <p className="text-white/70 text-sm mt-1">{reel.description}</p>}
        <div className="flex items-center gap-4 mt-2 text-white/60 text-xs">
          <span>👁 {reel.viewsCount}</span>
        </div>
      </div>

      {/* Side Actions */}
      <div className="absolute right-4 bottom-24 flex flex-col gap-5 items-center">
        <button
          onClick={() => likeMutation.mutate()}
          className="flex flex-col items-center gap-1"
          data-testid={`btn-like-reel-${reel.id}`}
        >
          <div className={`w-10 h-10 rounded-full bg-white/20 flex items-center justify-center ${liked ? 'text-red-500' : 'text-white'}`}>
            <Heart className={`w-5 h-5 ${liked ? 'fill-current' : ''}`} />
          </div>
          <span className="text-white text-xs font-bold">{localLikes}</span>
        </button>

        <button
          onClick={() => setShowComments(!showComments)}
          className="flex flex-col items-center gap-1"
          data-testid={`btn-comment-reel-${reel.id}`}
        >
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white">
            <MessageCircle className="w-5 h-5" />
          </div>
          <span className="text-white text-xs font-bold">{reel.commentsCount}</span>
        </button>

        <button
          onClick={() => { navigator.share?.({ title: reel.title, url: window.location.href }); }}
          className="flex flex-col items-center gap-1"
        >
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white">
            <Share2 className="w-5 h-5" />
          </div>
          <span className="text-white text-xs font-bold">شارك</span>
        </button>

        {/* Volume toggle — always visible */}
        <button
          onClick={handleToggleMute}
          className={`flex flex-col items-center gap-1`}
          data-testid="btn-volume-reel"
        >
          <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
            muted ? 'bg-red-500/30 border-red-400 text-red-300' : 'bg-white/20 border-white/30 text-white'
          }`}>
            {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </div>
          <span className="text-white text-xs font-bold">{muted ? 'صوت' : 'كتم'}</span>
        </button>
      </div>

      {/* Comments Sheet */}
      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            className="absolute bottom-0 left-0 right-0 bg-background rounded-t-2xl p-4 max-h-96 flex flex-col"
          >
            <h4 className="font-bold text-sm mb-3">التعليقات</h4>
            <div className="flex-1 overflow-y-auto space-y-2 mb-3">
              {comments.map((c: any) => (
                <div key={c.id} className="flex items-start gap-2">
                  <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {c.userName?.[0] || '?'}
                  </div>
                  <div>
                    <span className="text-xs font-bold">{c.userName}</span>
                    <p className="text-sm">{c.content}</p>
                    <button
                      onClick={() => speakEgyptian(c.content)}
                      className="text-xs text-primary flex items-center gap-1 mt-1"
                    >
                      <Volume2 className="w-3 h-3" /> استمع
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={comment} onChange={e => setComment(e.target.value)}
                placeholder="اكتب تعليقاً..." className="flex-1 text-sm"
                data-testid="input-reel-comment"
              />
              <Button size="sm" onClick={() => commentMutation.mutate()} disabled={!comment.trim() || commentMutation.isPending}>
                {commentMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "أرسل"}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CreateReelDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: () => apiRequest('/api/reels', 'POST', { title, description, videoUrl }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reels'] });
      setOpen(false);
      setTitle(""); setDescription(""); setVideoUrl("");
      toast({ title: "🎉 تم نشر الريل بنجاح!" });
    },
    onError: (err: any) => toast({ variant: "destructive", title: "خطأ", description: err.message }),
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData, credentials: "include" });
      const data = await res.json();
      setVideoUrl(data.url);
      toast({ title: "✅ تم رفع الفيديو!" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "فشل الرفع" });
    } finally { setUploading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" className="fixed bottom-20 left-4 z-50 w-14 h-14 rounded-full shadow-xl" data-testid="btn-create-reel">
          <Plus className="w-6 h-6" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>🎬 إنشاء ريل جديد</DialogTitle>
          <DialogDescription>ارفع فيديو قصير أو أدخل رابطاً لنشره كريل</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {/* Step 1: Video */}
          <div className="space-y-2">
            <p className="text-sm font-bold text-muted-foreground">الخطوة 1: أضف الفيديو</p>
            <input ref={fileRef} type="file" accept="video/*" onChange={handleUpload} className="hidden" />
            {videoUrl ? (
              <div className="relative">
                <video src={videoUrl} className="w-full rounded-xl max-h-48 object-contain bg-black" controls />
                <button
                  onClick={() => setVideoUrl("")}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center text-xs font-bold hover:bg-red-600"
                >✕</button>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                  className="w-full border-2 border-dashed border-primary/40 rounded-xl p-6 flex flex-col items-center gap-2 hover:border-primary hover:bg-primary/5 cursor-pointer transition-all"
                  data-testid="btn-upload-video"
                >
                  {uploading
                    ? <><Loader2 className="w-8 h-8 animate-spin text-primary" /><span className="text-sm font-medium text-primary">جاري الرفع...</span></>
                    : <><Upload className="w-8 h-8 text-primary" /><span className="text-sm font-medium">ارفع فيديو من جهازك</span><span className="text-xs text-muted-foreground">MP4, MOV — حتى 200MB</span></>
                  }
                </button>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">أو أدخل رابط فيديو</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                <Input
                  placeholder="https://example.com/video.mp4"
                  value={videoUrl}
                  onChange={e => setVideoUrl(e.target.value)}
                  dir="ltr"
                  data-testid="input-video-url"
                />
              </div>
            )}
          </div>

          {/* Step 2: Details */}
          <div className="space-y-2">
            <p className="text-sm font-bold text-muted-foreground">الخطوة 2: اكتب التفاصيل</p>
            <Input
              placeholder="عنوان الريل... (مطلوب)"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className={!title && videoUrl ? "border-red-400 focus:border-red-500" : ""}
              data-testid="input-reel-title"
            />
            {!title && videoUrl && <p className="text-xs text-red-500">⚠ العنوان مطلوب</p>}
            <Textarea placeholder="وصف (اختياري)..." value={description} onChange={e => setDescription(e.target.value)} rows={2} />
          </div>

          <Button
            className="w-full h-12 text-base gap-2"
            onClick={() => createMutation.mutate()}
            disabled={!title.trim() || !videoUrl.trim() || createMutation.isPending}
            data-testid="btn-publish-reel"
          >
            {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "🎬"}
            {createMutation.isPending ? "جاري النشر..." : "نشر الريل الآن"}
          </Button>

          {/* Why disabled hint */}
          {(!title.trim() || !videoUrl.trim()) && (
            <p className="text-xs text-center text-muted-foreground">
              {!videoUrl.trim() ? "⬆ ارفع فيديو أو أدخل رابط أولاً" : "✏ أدخل عنواناً للريل"}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Reels() {
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const { data: user } = useQuery<any>({ queryKey: ['/api/auth/user'] });
  const { data: reels = [], isLoading } = useQuery<Reel[]>({
    queryKey: ['/api/reels'],
    queryFn: () => fetch('/api/reels', { credentials: 'include' }).then(r => r.json()),
  });

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    const height = e.currentTarget.clientHeight;
    const newIndex = Math.round(scrollTop / height);
    setActiveIndex(newIndex);
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-black">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  if (reels.length === 0) {
    return (
      <div className="h-screen bg-black flex flex-col items-center justify-center text-white gap-4">
        <div className="text-6xl">🎬</div>
        <h2 className="text-2xl font-bold">لا توجد ريلز بعد</h2>
        <p className="text-white/60">كن أول من ينشر ريل!</p>
        {user && <CreateReelDialog />}
      </div>
    );
  }

  return (
    <div className="h-screen bg-black overflow-hidden relative">
      <div
        ref={containerRef}
        className="h-full overflow-y-scroll snap-y snap-mandatory"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        onScroll={handleScroll}
      >
        {reels.map((reel, i) => (
          <ReelCard key={reel.id} reel={reel} isActive={i === activeIndex} />
        ))}
      </div>

      {/* Navigation hints */}
      {activeIndex > 0 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/40 animate-bounce">
          <ChevronUp className="w-6 h-6" />
        </div>
      )}
      {activeIndex < reels.length - 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/40 animate-bounce">
          <ChevronDown className="w-6 h-6" />
        </div>
      )}

      {user && <CreateReelDialog />}
    </div>
  );
}
