import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/components/LanguageProvider";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Heart, MessageCircle, Share2, Plus, Play, Upload, Loader2, Volume2, VolumeX, ChevronUp, ChevronDown, Image as ImageIcon, Film, Music, ChevronLeft, ChevronRight, Pause, Pencil, Trash2, ArrowRight, Mic, MicOff, Send, Square } from "lucide-react";
import { useLocation } from "wouter";
import { EditReelDialog } from "@/components/EditReelDialog";
import { AdWidget } from "@/components/AdWidget";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";
import { useTTS } from "@/hooks/use-tts";
import { useAuth } from "@/hooks/use-auth";

type Reel = {
  id: number;
  title: string;
  description?: string;
  videoUrl: string;    // single URL, or JSON array of image URLs e.g. ["url1","url2"]
  audioUrl?: string;   // optional background music for image reels
  thumbnailUrl?: string;
  viewsCount: number;
  likesCount: number;
  commentsCount: number;
  userId: string;
  createdAt: string;
};

// Detect if URL is an image vs video
function isImageUrl(url: string): boolean {
  if (!url) return false;
  const clean = url.split('?')[0].toLowerCase();
  return /\.(jpg|jpeg|png|gif|webp|bmp|svg|avif)$/.test(clean);
}

// Parse videoUrl — may be a JSON array of image URLs or a single URL
function parseMediaUrls(videoUrl: string): string[] {
  if (!videoUrl) return [];
  if (videoUrl.trim().startsWith('[')) {
    try { return JSON.parse(videoUrl) as string[]; } catch {}
  }
  return [videoUrl];
}

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

// ── Mini audio player for voice comments in Reels ──────────────
function ReelVoicePlayer({ url }: { url: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); a.currentTime = 0; setPlaying(false); }
    else { a.play().then(() => setPlaying(true)).catch(() => {}); }
  };
  return (
    <span className="inline-flex items-center gap-1 mt-0.5">
      <audio ref={audioRef} src={url} onEnded={() => setPlaying(false)} className="hidden" />
      <button
        onClick={toggle}
        className="inline-flex items-center gap-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-full px-3 py-1 text-xs font-medium transition-colors"
        data-testid="btn-play-reel-voice"
      >
        {playing ? <><Square className="w-3 h-3 fill-current" /> إيقاف</> : <><Play className="w-3 h-3 fill-current" /> استمع 🎤</>}
      </button>
    </span>
  );
}

function ReelCard({ reel, isActive, isOwner, onEdit, onDelete, onEnded }: {
  reel: Reel;
  isActive: boolean;
  isOwner?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onEnded?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [liked, setLiked] = useState(false);
  const [localLikes, setLocalLikes] = useState(reel.likesCount);
  const [muted, setMuted] = useState(true);
  const [showUnmuteHint, setShowUnmuteHint] = useState(true);
  const [showComments, setShowComments] = useState(false);
  const [comment, setComment] = useState("");
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgIndex, setImgIndex] = useState(0);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  // Voice recording state
  const [isRecording, setIsRecording]     = useState(false);
  const [isUploading, setIsUploading]     = useState(false);
  const [recSeconds, setRecSeconds]       = useState(0);
  const [waveLevel, setWaveLevel]         = useState(0);
  const recRef     = useRef<MediaRecorder | null>(null);
  const chunksRef  = useRef<BlobPart[]>([]);
  const timerRef2  = useRef<ReturnType<typeof setInterval> | null>(null);
  const waveRef2   = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdingRef = useRef(false);

  // Parse media
  const urls = parseMediaUrls(reel.videoUrl);
  const isImageMode = urls.length > 0 && urls.every(u => isImageUrl(u));
  const isMultiImage = isImageMode && urls.length > 1;
  const hasAudio = isImageMode && !!reel.audioUrl;

  const { data: comments = [] } = useQuery<any[]>({
    queryKey: ['/api/comments/reel', reel.id],
    queryFn: () => fetch(`/api/comments/reel/${reel.id}`, { credentials: 'include' }).then(r => r.json()),
    enabled: showComments,
  });

  const likeMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/likes', { targetType: 'reel', targetId: reel.id }),
    onSuccess: (data: any) => {
      setLiked(data.liked);
      setLocalLikes(prev => data.liked ? prev + 1 : Math.max(0, prev - 1));
    }
  });

  const commentMutation = useMutation({
    mutationFn: (payload: { content: string; isVoiceComment?: boolean; voiceText?: string }) =>
      apiRequest('POST', '/api/comments', { targetType: 'reel', targetId: reel.id, ...payload }),
    onSuccess: () => {
      setComment("");
      queryClient.invalidateQueries({ queryKey: ['/api/comments/reel', reel.id] });
    }
  });

  // ── Press & Hold voice recording ──────────────────────────
  const handleMicPress = async (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!user) { window.location.href = "/login"; return; }
    if (holdingRef.current || isRecording) return;
    holdingRef.current = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      chunksRef.current = [];
      const mimes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
      const mimeType = mimes.find(m => MediaRecorder.isTypeSupported(m)) || '';
      const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm';
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      rec.ondataavailable = ev => { if (ev.data.size > 0) chunksRef.current.push(ev.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (timerRef2.current) clearInterval(timerRef2.current);
        if (waveRef2.current) clearInterval(waveRef2.current);
        setRecSeconds(0); setWaveLevel(0);
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
        if (blob.size < 300) { toast({ title: "اضغط مطولاً للتسجيل 🎤" }); return; }
        setIsUploading(true);
        const fd = new FormData();
        fd.append("file", blob, `voice-reel-${Date.now()}.${ext}`);
        try {
          const res = await fetch("/api/upload", { method: "POST", body: fd, credentials: "include" });
          const data = await res.json();
          commentMutation.mutate({ content: "🎤 تعليق صوتي", isVoiceComment: true, voiceText: data.url });
        } catch {
          commentMutation.mutate({ content: "🎤 تعليق صوتي" });
        } finally { setIsUploading(false); }
      };
      rec.start(100);
      recRef.current = rec;
      setIsRecording(true);
      setRecSeconds(0);
      timerRef2.current = setInterval(() => setRecSeconds(s => s + 1), 1000);
      waveRef2.current = setInterval(() => setWaveLevel(Math.random()), 150);
    } catch (err: any) {
      holdingRef.current = false;
      if (err?.name === 'NotAllowedError') {
        toast({ variant: "destructive", title: "اسمح للمتصفح بالميكروفون", description: "الإعدادات ← الموقع ← السماح بالميكروفون" });
      } else {
        toast({ variant: "destructive", title: "تعذّر تشغيل الميكروفون" });
      }
    }
  };

  const handleMicRelease = () => {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    setIsRecording(false);
    if (timerRef2.current) clearInterval(timerRef2.current);
    if (waveRef2.current) clearInterval(waveRef2.current);
    const rec = recRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
  };

  // Sync video muted state via ref (React muted prop bug)
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = muted;
      videoRef.current.volume = muted ? 0 : 1;
    }
  }, [muted]);

  // Auto-play/pause video when active
  useEffect(() => {
    if (!videoRef.current || isImageMode) return;
    if (isActive) {
      videoRef.current.muted = true;
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
    }
  }, [isActive, isImageMode]);

  // Auto-advance slideshow every 3s when active
  useEffect(() => {
    if (!isMultiImage || !isActive) return;
    const timer = setInterval(() => {
      setImgIndex(i => (i + 1) % urls.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [isMultiImage, isActive, urls.length]);

  // Reset slideshow index when reel becomes inactive
  useEffect(() => {
    if (!isActive) setImgIndex(0);
  }, [isActive]);

  // Audio control when active
  useEffect(() => {
    if (!hasAudio || !audioRef.current) return;
    if (isActive) {
      audioRef.current.muted = audioMuted;
      audioRef.current.play().catch(() => {});
      setAudioPlaying(true);
    } else {
      audioRef.current.pause();
      setAudioPlaying(false);
    }
  }, [isActive, hasAudio]);

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

  const currentImgUrl = isImageMode ? urls[imgIndex] : "";

  return (
    <div className="relative h-screen w-full snap-start bg-black flex items-center justify-center overflow-hidden">

      {isImageMode ? (
        /* ── IMAGE / SLIDESHOW REEL ── */
        <>
          {/* Hidden audio element */}
          {hasAudio && (
            <audio
              ref={audioRef}
              src={reel.audioUrl!}
              loop
              muted={audioMuted}
              preload="auto"
              onPlay={() => setAudioPlaying(true)}
              onPause={() => setAudioPlaying(false)}
            />
          )}

          {/* Blurred background from current image */}
          <div
            className="absolute inset-0 bg-cover bg-center scale-110 blur-2xl opacity-50 transition-all duration-700"
            style={{ backgroundImage: `url(${currentImgUrl})` }}
          />

          {/* Main image — animated on slide change */}
          <AnimatePresence mode="wait">
            <motion.img
              key={`${reel.id}-${imgIndex}`}
              src={currentImgUrl}
              alt={`${reel.title} ${imgIndex + 1}`}
              className="relative z-10 max-h-full max-w-full object-contain select-none"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.35 }}
              onLoad={() => setImgLoaded(true)}
              draggable={false}
            />
          </AnimatePresence>

          {!imgLoaded && (
            <div className="absolute inset-0 flex items-center justify-center z-20">
              <Loader2 className="w-8 h-8 animate-spin text-white" />
            </div>
          )}

          {/* Slideshow navigation arrows */}
          {isMultiImage && (
            <>
              <button
                onClick={() => setImgIndex(i => (i - 1 + urls.length) % urls.length)}
                className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-white hover:bg-black/70"
                data-testid="btn-prev-slide"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <button
                onClick={() => setImgIndex(i => (i + 1) % urls.length)}
                className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-white hover:bg-black/70"
                data-testid="btn-next-slide"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              {/* Dot indicators */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
                {urls.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setImgIndex(i)}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i === imgIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/40'
                    }`}
                    data-testid={`dot-slide-${i}`}
                  />
                ))}
              </div>

              {/* Slide counter */}
              <div className="absolute top-10 right-3 z-20">
                <Badge className="bg-black/50 backdrop-blur text-white text-xs">
                  {imgIndex + 1}/{urls.length}
                </Badge>
              </div>
            </>
          )}

          {/* Image type badge (single) */}
          {!isMultiImage && (
            <div className="absolute top-4 right-4 z-20">
              <Badge className="bg-white/20 backdrop-blur text-white border-white/30 gap-1">
                <ImageIcon className="w-3 h-3" /> صورة
              </Badge>
            </div>
          )}

          {/* 🎵 Audio Player Bar */}
          {hasAudio && (
            <div className="absolute top-16 left-3 right-14 z-20 flex items-center gap-2 bg-black/60 backdrop-blur-md rounded-2xl px-3 py-2 border border-white/10">
              <button
                onClick={() => {
                  if (!audioRef.current) return;
                  if (audioPlaying) { audioRef.current.pause(); setAudioPlaying(false); }
                  else { audioRef.current.play(); setAudioPlaying(true); }
                }}
                className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30"
                data-testid="btn-audio-play"
              >
                {audioPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <Music className="w-3 h-3 text-green-400 flex-shrink-0 animate-pulse" />
                  <span className="text-white text-xs font-medium truncate">موسيقى الريل</span>
                </div>
                {/* Animated equalizer bars */}
                {audioPlaying && (
                  <div className="flex items-end gap-0.5 h-3 mt-0.5">
                    {[1,2,3,4,5].map(n => (
                      <div
                        key={n}
                        className="w-1 bg-green-400 rounded-full"
                        style={{
                          height: `${30 + Math.random() * 70}%`,
                          animation: `bounce ${0.4 + n * 0.1}s ease-in-out infinite alternate`,
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  const newMuted = !audioMuted;
                  setAudioMuted(newMuted);
                  if (audioRef.current) audioRef.current.muted = newMuted;
                }}
                className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white"
                data-testid="btn-audio-mute"
              >
                {audioMuted ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5 text-green-400" />}
              </button>
            </div>
          )}
        </>
      ) : (
        /* ── VIDEO REEL ── */
        <>
          <video
            ref={videoRef}
            src={reel.videoUrl}
            className="w-full h-full object-contain"
            autoPlay={isActive}
            muted={muted}
            playsInline
            onEnded={() => onEnded?.()}
            onClick={() => videoRef.current?.paused ? videoRef.current.play() : videoRef.current?.pause()}
          />
          {/* TAP TO UNMUTE */}
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
          {muted && !showUnmuteHint && (
            <button
              onClick={handleToggleMute}
              className="absolute top-4 left-4 z-20 flex items-center gap-1.5 bg-black/60 backdrop-blur text-white text-xs px-3 py-1.5 rounded-full border border-white/20"
              data-testid="btn-muted-indicator"
            >
              <VolumeX className="w-3.5 h-3.5" /> مكتوم
            </button>
          )}
        </>
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

        {/* Owner-only: Edit & Delete */}
        {isOwner && (
          <>
            <button
              onClick={onEdit}
              className="flex flex-col items-center gap-1"
              data-testid={`btn-edit-reel-feed-${reel.id}`}
            >
              <div className="w-10 h-10 rounded-full bg-blue-500/80 flex items-center justify-center text-white hover:bg-blue-600/90 transition-colors">
                <Pencil className="w-5 h-5" />
              </div>
              <span className="text-white text-xs font-bold">تعديل</span>
            </button>

            <button
              onClick={() => { if (confirm("هل تريد حذف هذا الريل؟")) onDelete?.(); }}
              className="flex flex-col items-center gap-1"
              data-testid={`btn-delete-reel-feed-${reel.id}`}
            >
              <div className="w-10 h-10 rounded-full bg-red-500/80 flex items-center justify-center text-white hover:bg-red-600/90 transition-colors">
                <Trash2 className="w-5 h-5" />
              </div>
              <span className="text-white text-xs font-bold">حذف</span>
            </button>
          </>
        )}
      </div>

      {/* Comments Sheet */}
      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            className="absolute bottom-0 left-0 right-0 bg-background rounded-t-2xl p-4 max-h-[22rem] flex flex-col z-30"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-sm">التعليقات</h4>
              <button onClick={() => setShowComments(false)} className="text-muted-foreground hover:text-foreground transition">
                <Square className="w-4 h-4" />
              </button>
            </div>

            {/* Comments list */}
            <div className="flex-1 overflow-y-auto space-y-2 mb-3">
              {comments.length === 0 && (
                <p className="text-center text-xs text-muted-foreground py-4">لا توجد تعليقات — كن أول من يعلّق!</p>
              )}
              {comments.map((c: any) => (
                <div key={c.id} className="flex items-start gap-2">
                  <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {c.userName?.[0] || '?'}
                  </div>
                  <div className="flex-1 bg-muted/40 rounded-2xl px-3 py-2">
                    <span className="text-xs font-bold text-primary">{c.userName} </span>
                    {c.isVoiceComment && c.voiceText ? (
                      <ReelVoicePlayer url={c.voiceText} />
                    ) : (
                      <>
                        <span className="text-sm">{c.content}</span>
                        {c.content && (
                          <button
                            onClick={() => speakEgyptian(c.content)}
                            className="ms-2 text-muted-foreground hover:text-primary transition"
                            title="استمع"
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

            {/* Recording status */}
            {(isRecording || isUploading) && (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-2xl text-xs font-medium mb-2 ${
                isUploading
                  ? "bg-blue-50 dark:bg-blue-950/30 text-blue-600 border border-blue-200"
                  : "bg-red-50 dark:bg-red-950/30 text-red-600 border border-red-200"
              }`}>
                {isUploading ? (
                  <><span className="w-2 h-2 rounded-full bg-blue-500 animate-ping inline-block" /> جارٍ إرسال الصوت...</>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block" />
                    🎤 {recSeconds}ث — ارفع إصبعك للإرسال
                    <div className="flex items-end gap-0.5 h-4 ms-1">
                      {[0.3,0.7,0.5,1,0.6].map((b,i) => (
                        <div key={i} className="w-1 bg-red-400 rounded-full transition-all duration-100"
                          style={{ height: `${Math.max(20,(b*waveLevel+b*0.5)*100)}%` }} />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Input row */}
            {user ? (
              <>
                <div className="flex gap-2">
                  <Input
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    placeholder="اكتب أو اضغط مطولاً 🎤"
                    className="flex-1 h-9 text-sm rounded-full"
                    onKeyDown={e => e.key === 'Enter' && comment.trim() && commentMutation.mutate({ content: comment })}
                    disabled={isRecording || isUploading}
                    data-testid="input-reel-comment"
                  />
                  {/* 🎤 Press & Hold mic */}
                  <button
                    onMouseDown={handleMicPress}
                    onMouseUp={handleMicRelease}
                    onMouseLeave={handleMicRelease}
                    onTouchStart={handleMicPress}
                    onTouchEnd={handleMicRelease}
                    onTouchCancel={handleMicRelease}
                    disabled={isUploading || commentMutation.isPending}
                    className={`h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 select-none touch-none transition-all
                      ${isRecording ? "bg-red-500 text-white scale-110 shadow-lg shadow-red-300" : "bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30"}
                      disabled:opacity-50`}
                    data-testid="btn-reel-voice-comment"
                  >
                    {isRecording ? <span className="text-base animate-pulse">🎙️</span> : <Mic className="w-4 h-4" />}
                  </button>
                  {/* Send text */}
                  <Button
                    size="sm"
                    onClick={() => comment.trim() && commentMutation.mutate({ content: comment })}
                    disabled={!comment.trim() || commentMutation.isPending || isRecording || isUploading}
                    className="h-9 w-9 p-0 rounded-full"
                    data-testid="btn-send-reel-comment"
                  >
                    {commentMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>
                {!isRecording && !isUploading && (
                  <p className="text-[10px] text-muted-foreground text-center mt-1.5">
                    اضغط مطولاً على 🎤 للتسجيل الصوتي مباشرة
                  </p>
                )}
              </>
            ) : (
              <a href="/login">
                <Button variant="outline" size="sm" className="w-full text-xs rounded-full">سجل دخول للتعليق</Button>
              </a>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CreateReelDialog({ centered = false }: { centered?: boolean }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [mediaTypeTab, setMediaTypeTab] = useState<'video' | 'image'>('video');
  // Video mode
  const [videoUrl, setVideoUrl] = useState("");
  const [uploadingVideo, setUploadingVideo] = useState(false);
  // Image mode — multiple images
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  // Audio (image mode only)
  const [audioUrl, setAudioUrl] = useState("");
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [convertingToVideo, setConvertingToVideo] = useState(false);

  const fileVideoRef = useRef<HTMLInputElement>(null);
  const fileImageRef = useRef<HTMLInputElement>(null);
  const fileAudioRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const tts = useTTS();
  const [ttsVoice, setTtsVoice] = useState<"nova" | "onyx">("nova");

  // Computed final videoUrl value to store
  const finalVideoUrl = mediaTypeTab === 'image'
    ? (imageUrls.length > 1 ? JSON.stringify(imageUrls) : imageUrls[0] ?? "")
    : videoUrl;
  const hasMedia = finalVideoUrl.trim() !== "" && finalVideoUrl !== "[]";

  const createMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/reels', {
      title,
      description,
      videoUrl: finalVideoUrl,
      audioUrl: (() => {
        const explicit = audioUrl.trim();
        if (explicit) return explicit;
        if (tts.audioUrl) return tts.audioUrl;
        return undefined;
      })(),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reels'] });
      setOpen(false);
      setTitle(""); setDescription(""); setVideoUrl(""); setImageUrls([]); setAudioUrl("");
      tts.reset();
      toast({ title: "🎉 تم النشر بنجاح!" });
    },
    onError: (err: any) => toast({ variant: "destructive", title: "خطأ", description: err.message }),
  });

  const uploadFile = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: formData, credentials: "include" });
    const data = await res.json();
    if (!data.url) throw new Error("رفع فاشل");
    return data.url;
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingVideo(true);
    try {
      const url = await uploadFile(file);
      setVideoUrl(url);
      toast({ title: "✅ تم رفع الفيديو!" });
    } catch { toast({ variant: "destructive", title: "فشل رفع الفيديو" }); }
    finally { setUploadingVideo(false); }
  };

  const handleImagesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    e.target.value = "";
    const remaining = 10 - imageUrls.length;
    const toUpload = files.slice(0, remaining);
    if (!toUpload.length) { toast({ title: "⚠ وصلت للحد الأقصى (10 صور)" }); return; }
    setUploadingImages(true);
    try {
      const uploaded = await Promise.all(toUpload.map(uploadFile));
      setImageUrls(prev => [...prev, ...uploaded]);
      toast({ title: `✅ تم رفع ${uploaded.length} صورة دفعة واحدة!` });
    } catch { toast({ variant: "destructive", title: "فشل رفع الصور" }); }
    finally { setUploadingImages(false); }
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAudio(true);
    try {
      const url = await uploadFile(file);
      setAudioUrl(url);
      toast({ title: "🎵 تم رفع الموسيقى!" });
    } catch { toast({ variant: "destructive", title: "فشل رفع الصوت" }); }
    finally { setUploadingAudio(false); }
  };

  const resetTab = (tab: 'video' | 'image') => {
    setMediaTypeTab(tab);
    setVideoUrl(""); setImageUrls([]); setAudioUrl("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {centered ? (
          <Button className="gap-2 px-6 py-3 text-base rounded-2xl shadow-xl bg-primary hover:bg-primary/90" data-testid="btn-create-reel-centered">
            <Plus className="w-5 h-5" /> نشر ريل جديد
          </Button>
        ) : (
          <Button size="icon" className="fixed bottom-20 left-4 z-50 w-14 h-14 rounded-full shadow-xl" data-testid="btn-create-reel">
            <Plus className="w-6 h-6" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>✨ إنشاء ريل جديد</DialogTitle>
          <DialogDescription>ارفع صور أو فيديو مع موسيقى اختيارية</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">

          {/* Media Type Tabs */}
          <div className="flex gap-2 p-1 bg-muted rounded-xl">
            <button
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all ${mediaTypeTab === 'video' ? 'bg-background shadow text-foreground' : 'text-muted-foreground'}`}
              onClick={() => resetTab('video')}
              data-testid="tab-video"
            >
              <Film className="w-4 h-4" /> فيديو
            </button>
            <button
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all ${mediaTypeTab === 'image' ? 'bg-background shadow text-foreground' : 'text-muted-foreground'}`}
              onClick={() => resetTab('image')}
              data-testid="tab-image"
            >
              <ImageIcon className="w-4 h-4" /> صور 🖼
            </button>
          </div>

          {/* ── VIDEO MODE ── */}
          {mediaTypeTab === 'video' && (
            <div className="space-y-2">
              <p className="text-sm font-bold text-muted-foreground">أضف الفيديو</p>
              <input ref={fileVideoRef} type="file" accept="video/*" onChange={handleVideoUpload} className="hidden" />
              {videoUrl ? (
                <div className="relative">
                  <video src={videoUrl} className="w-full rounded-xl max-h-48 object-contain bg-black" controls />
                  <button onClick={() => setVideoUrl("")} className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center text-xs font-bold hover:bg-red-600">✕</button>
                </div>
              ) : (
                <>
                  <button
                    type="button" onClick={() => fileVideoRef.current?.click()} disabled={uploadingVideo}
                    className="w-full border-2 border-dashed border-primary/40 rounded-xl p-6 flex flex-col items-center gap-2 hover:border-primary hover:bg-primary/5 cursor-pointer transition-all"
                    data-testid="btn-upload-video"
                  >
                    {uploadingVideo
                      ? <><Loader2 className="w-8 h-8 animate-spin text-primary" /><span className="text-sm text-primary">جاري الرفع...</span></>
                      : <><Upload className="w-8 h-8 text-primary" /><span className="text-sm font-medium">ارفع فيديو</span><span className="text-xs text-muted-foreground">MP4، MOV — حتى 200MB</span></>
                    }
                  </button>
                  <div className="flex items-center gap-2"><div className="flex-1 h-px bg-border" /><span className="text-xs text-muted-foreground">أو رابط</span><div className="flex-1 h-px bg-border" /></div>
                  <Input placeholder="https://example.com/video.mp4" value={videoUrl} onChange={e => setVideoUrl(e.target.value)} dir="ltr" data-testid="input-video-url" />
                </>
              )}
            </div>
          )}

          {/* ── IMAGE MODE ── */}
          {mediaTypeTab === 'image' && (
            <div className="space-y-3">
              {/* Image upload */}
              <div className="space-y-2">
                <p className="text-sm font-bold text-muted-foreground">أضف صوراً (حتى 10)</p>
                <input ref={fileImageRef} type="file" accept="image/*" multiple onChange={handleImagesUpload} className="hidden" />

                {/* Uploaded images grid */}
                {imageUrls.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {imageUrls.map((url, i) => (
                      <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-black">
                        <img src={url} className="w-full h-full object-cover" alt={`صورة ${i+1}`} />
                        <button
                          onClick={() => setImageUrls(prev => prev.filter((_, idx) => idx !== i))}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-xs font-bold hover:bg-red-600"
                          data-testid={`btn-remove-img-${i}`}
                        >✕</button>
                        {i === 0 && <Badge className="absolute bottom-1 left-1 text-xs bg-white/80 text-black">غلاف</Badge>}
                      </div>
                    ))}
                    {imageUrls.length < 10 && (
                      <button
                        onClick={() => fileImageRef.current?.click()}
                        disabled={uploadingImages}
                        className="aspect-square rounded-xl border-2 border-dashed border-primary/40 flex flex-col items-center justify-center gap-1 hover:border-primary hover:bg-primary/5 transition-all"
                        data-testid="btn-add-more-images"
                      >
                        {uploadingImages
                          ? <Loader2 className="w-5 h-5 animate-spin text-primary" />
                          : <><Plus className="w-5 h-5 text-primary" /><span className="text-xs text-primary">إضافة</span></>
                        }
                      </button>
                    )}
                  </div>
                )}

                {imageUrls.length === 0 && (
                  <>
                    <button
                      type="button" onClick={() => fileImageRef.current?.click()} disabled={uploadingImages}
                      className="w-full border-2 border-dashed border-primary/40 rounded-xl p-6 flex flex-col items-center gap-2 hover:border-primary hover:bg-primary/5 cursor-pointer transition-all"
                      data-testid="btn-upload-images"
                    >
                      {uploadingImages
                        ? <><Loader2 className="w-8 h-8 animate-spin text-primary" /><span className="text-sm text-primary">جاري الرفع...</span></>
                        : <><ImageIcon className="w-8 h-8 text-primary" /><span className="text-sm font-medium">ارفع صوراً من جهازك</span><span className="text-xs text-muted-foreground">يمكن اختيار أكثر من صورة — JPG, PNG, WebP</span></>
                      }
                    </button>
                    <div className="flex items-center gap-2"><div className="flex-1 h-px bg-border" /><span className="text-xs text-muted-foreground">أو أدخل رابط صورة</span><div className="flex-1 h-px bg-border" /></div>
                    <Input
                      placeholder="https://example.com/image.jpg"
                      onBlur={e => { if (e.target.value.trim() && isImageUrl(e.target.value.trim())) setImageUrls([e.target.value.trim()]); }}
                      dir="ltr" data-testid="input-image-url"
                    />
                  </>
                )}
              </div>

              {/* 🎬 Convert Images to Video */}
              {imageUrls.length >= 1 && (
                <div className="rounded-xl bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 border border-orange-200/50 dark:border-orange-700/30 p-3 space-y-2">
                  <p className="text-xs font-bold text-orange-700 dark:text-orange-300 flex items-center gap-1.5">
                    🎬 تحويل الصور لفيديو احترافي
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {imageUrls.length} {imageUrls.length === 1 ? 'صورة' : 'صور'} — ستُحوَّل لفيديو MP4 بمقاس ريلز (9:16)
                  </p>
                  <button
                    type="button"
                    disabled={convertingToVideo}
                    onClick={async () => {
                      setConvertingToVideo(true);
                      try {
                        const res = await fetch('/api/ai/images-to-video', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            imageUrls,
                            audioUrl: audioUrl || (tts.audioUrl ?? undefined),
                            duration: 3,
                          }),
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.message);
                        setVideoUrl(data.url);
                        setImageUrls([]);
                        setMediaTypeTab('video');
                        toast({ title: "🎬 تم تحويل الصور لفيديو بنجاح!" });
                      } catch (e: any) {
                        toast({ variant: "destructive", title: "فشل التحويل", description: e.message });
                      } finally {
                        setConvertingToVideo(false);
                      }
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-orange-600 text-white text-sm font-bold hover:bg-orange-700 disabled:opacity-50 transition-all"
                    data-testid="btn-convert-to-video"
                  >
                    {convertingToVideo
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري التحويل... (قد يستغرق دقيقة)</>
                      : <>🎬 حوّل الصور لفيديو MP4 الآن</>
                    }
                  </button>
                </div>
              )}

              {/* Audio section */}
              <div className="space-y-2 rounded-xl bg-muted/50 p-3">
                <p className="text-sm font-bold flex items-center gap-2">
                  <Music className="w-4 h-4 text-green-500" /> موسيقى في الخلفية (اختياري)
                </p>
                <input ref={fileAudioRef} type="file" accept="audio/*" onChange={handleAudioUpload} className="hidden" />
                {audioUrl ? (
                  <div className="flex items-center gap-2 bg-green-500/10 rounded-lg p-2">
                    <Music className="w-4 h-4 text-green-500" />
                    <audio src={audioUrl} controls className="flex-1 h-8" style={{ height: 32 }} />
                    <button onClick={() => setAudioUrl("")} className="w-6 h-6 rounded-full bg-red-500 text-white text-xs flex items-center justify-center hover:bg-red-600">✕</button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      type="button" onClick={() => fileAudioRef.current?.click()} disabled={uploadingAudio}
                      className="flex-1 flex items-center justify-center gap-2 border border-dashed border-green-400/40 rounded-lg py-2 text-sm text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all"
                      data-testid="btn-upload-audio"
                    >
                      {uploadingAudio ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Upload className="w-4 h-4" /> رفع ملف صوتي (MP3)</>}
                    </button>
                  </div>
                )}
                {!audioUrl && (
                  <Input placeholder="أو رابط مباشر لملف mp3..." value={audioUrl} onChange={e => setAudioUrl(e.target.value)} dir="ltr" className="text-sm" data-testid="input-audio-url" />
                )}
              </div>
            </div>
          )}

          {/* Details */}
          <div className="space-y-2">
            <p className="text-sm font-bold text-muted-foreground">التفاصيل</p>
            <Input
              placeholder="العنوان... (مطلوب)"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className={!title && hasMedia ? "border-red-400" : ""}
              data-testid="input-reel-title"
            />
            {!title && hasMedia && <p className="text-xs text-red-500">⚠ العنوان مطلوب</p>}
            <Textarea
              placeholder="وصف أو تعليق (اختياري) — سيُحوَّل لصوت..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
            />

            {/* 🎤 AI Voice Generation */}
            {title.trim() && (
              <div className="rounded-xl bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200/50 dark:border-purple-700/30 p-3 space-y-2">
                <p className="text-xs font-bold text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                  🎙 توليد صوت بالذكاء الاصطناعي
                </p>
                {/* Voice gender selector */}
                {!tts.audioUrl && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setTtsVoice("nova")}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold border transition-all ${ttsVoice === "nova" ? "bg-pink-500 text-white border-pink-500" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700"}`}
                      data-testid="btn-voice-female"
                    >
                      👩 صوت أنثى
                    </button>
                    <button
                      type="button"
                      onClick={() => setTtsVoice("onyx")}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold border transition-all ${ttsVoice === "onyx" ? "bg-blue-600 text-white border-blue-600" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700"}`}
                      data-testid="btn-voice-male"
                    >
                      👨 صوت ذكر
                    </button>
                  </div>
                )}
                {tts.audioUrl ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 bg-green-500/10 rounded-lg p-2">
                      <Music className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <span className="text-xs text-green-700 dark:text-green-300 font-medium flex-1">صوت جاهز ✅</span>
                      <audio src={tts.audioUrl} controls className="h-7 flex-1" style={{ height: 28 }} />
                      <button
                        onClick={() => { tts.reset(); }}
                        className="w-6 h-6 rounded-full bg-red-100 text-red-500 text-xs flex items-center justify-center hover:bg-red-200"
                        title="حذف الصوت المولّد"
                      >✕</button>
                    </div>
                    <p className="text-xs text-muted-foreground text-center">سيُضاف الصوت تلقائياً عند النشر 🚀</p>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={tts.loading || !title.trim()}
                    onClick={async () => {
                      const text = description.trim()
                        ? `${title}. ${description}`
                        : title;
                      try {
                        await tts.generate(text, ttsVoice, true);
                      } catch {
                        toast({ variant: "destructive", title: "فشل توليد الصوت", description: "تأكد من اتصالك" });
                      }
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-purple-600 text-white text-sm font-bold hover:bg-purple-700 disabled:opacity-50 transition-all"
                    data-testid="btn-generate-voice"
                  >
                    {tts.loading
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري التوليد بالذكاء الاصطناعي...</>
                      : <>{ttsVoice === "nova" ? "👩" : "👨"} حوّل النص لصوت عربي مصري</>
                    }
                  </button>
                )}
              </div>
            )}
          </div>

          <Button
            className="w-full h-12 text-base gap-2"
            onClick={() => createMutation.mutate()}
            disabled={!title.trim() || !hasMedia || createMutation.isPending}
            data-testid="btn-publish-reel"
          >
            {createMutation.isPending
              ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري النشر...</>
              : <>{mediaTypeTab === 'image' ? '🖼' : '🎬'} نشر الريل الآن {tts.audioUrl ? '🎵' : ''}</>
            }
          </Button>

          {(!title.trim() || !hasMedia) && (
            <p className="text-xs text-center text-muted-foreground">
              {!hasMedia
                ? `⬆ ${mediaTypeTab === 'image' ? 'أضف صورة واحدة على الأقل' : 'أضف فيديو'} أولاً`
                : "✏ أدخل عنواناً"}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Reels() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [editingReel, setEditingReel] = useState<Reel | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data: reels = [], isLoading } = useQuery<Reel[]>({
    queryKey: ['/api/reels'],
    queryFn: () => fetch('/api/reels', { credentials: 'include' }).then(r => r.json()),
  });

  const deleteReelMut = useMutation({
    mutationFn: (id: number) => fetch(`/api/reels/${id}`, { method: 'DELETE', credentials: 'include' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reels'] });
      toast({ title: '🗑 تم حذف الريل' });
    },
  });

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    const height = e.currentTarget.clientHeight;
    const newIndex = Math.round(scrollTop / height);
    setActiveIndex(newIndex);
  };

  const scrollToNext = () => {
    const container = containerRef.current;
    if (!container) return;
    const nextIndex = activeIndex + 1;
    if (nextIndex < reels.length) {
      container.scrollTo({ top: nextIndex * container.clientHeight, behavior: 'smooth' });
      setActiveIndex(nextIndex);
    }
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
        <p className="text-white/60 text-center px-8">كن أول من ينشر ريل واجذب المتابعين!</p>
        <CreateReelDialog centered />
      </div>
    );
  }

  return (
    <div className="h-screen bg-black overflow-hidden relative">
      {/* زرار الرجوع */}
      <button
        onClick={() => setLocation('/ads')}
        className="absolute top-4 right-4 z-50 flex items-center gap-1.5 bg-black/60 backdrop-blur border border-white/20 text-white text-sm font-bold px-3 py-2 rounded-full hover:bg-black/80 transition-all"
        data-testid="btn-back-to-ads"
      >
        <ArrowRight className="w-4 h-4" />
        رجوع
      </button>

      <div
        ref={containerRef}
        className="h-full overflow-y-scroll snap-y snap-mandatory"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        onScroll={handleScroll}
      >
        {reels.map((reel, i) => (
          <ReelCard
            key={reel.id}
            reel={reel}
            isActive={i === activeIndex}
            isOwner={!!user && reel.userId === user.id}
            onEdit={() => setEditingReel(reel)}
            onDelete={() => deleteReelMut.mutate(reel.id)}
            onEnded={scrollToNext}
          />
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

      {/* ── إعلان overlay كل 3 ريلز ─────────────────────── */}
      {activeIndex % 3 === 0 && activeIndex > 0 && (
        <AdWidget
          variant="overlay"
          className="bottom-24 left-3"
          refreshInterval={15000}
          dismissible
        />
      )}

      <CreateReelDialog />

      {editingReel && (
        <EditReelDialog
          reel={editingReel}
          open={!!editingReel}
          onClose={() => setEditingReel(null)}
        />
      )}
    </div>
  );
}
