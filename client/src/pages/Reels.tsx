import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/components/LanguageProvider";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Heart, MessageCircle, Share2, Plus, Play, Upload, Loader2, Volume2, ChevronUp, ChevronDown } from "lucide-react";
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
  const [muted, setMuted] = useState(false);
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

        <button
          onClick={() => setMuted(!muted)}
          className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white"
        >
          <Volume2 className={`w-5 h-5 ${muted ? 'opacity-30' : ''}`} />
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>إنشاء ريل جديد</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <input ref={fileRef} type="file" accept="video/*" onChange={handleUpload} className="hidden" />
          {videoUrl ? (
            <video src={videoUrl} className="w-full rounded-xl max-h-48 object-contain bg-black" controls />
          ) : (
            <button
              type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
              className="w-full border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center gap-2 hover:border-primary cursor-pointer"
            >
              {uploading ? <Loader2 className="w-8 h-8 animate-spin text-primary" /> : <><Upload className="w-8 h-8 text-muted-foreground" /><span className="text-sm">ارفع فيديو قصير (حتى 200MB)</span></>}
            </button>
          )}
          <Input placeholder="عنوان الريل..." value={title} onChange={e => setTitle(e.target.value)} data-testid="input-reel-title" />
          <Textarea placeholder="وصف (اختياري)..." value={description} onChange={e => setDescription(e.target.value)} rows={2} />
          <Button className="w-full" onClick={() => createMutation.mutate()} disabled={!title || !videoUrl || createMutation.isPending} data-testid="btn-publish-reel">
            {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin me-2" /> : null}
            نشر الريل 🎬
          </Button>
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
