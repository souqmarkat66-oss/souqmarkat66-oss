import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/components/LanguageProvider";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Heart, MessageCircle, Share2, Plus, Play, Upload, Loader2, Volume2, VolumeX, ChevronUp, ChevronDown, Image as ImageIcon, Film, Music, ChevronLeft, ChevronRight, Pause, Pencil, Trash2, ArrowRight, Mic, MicOff, Send, Square, Bookmark, BookmarkCheck, UserPlus, Check, Music2 } from "lucide-react";
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
  videoUrl: string;
  audioUrl?: string;
  thumbnailUrl?: string;
  viewsCount: number;
  likesCount: number;
  commentsCount: number;
  userId: string;
  channelId?: number | null;
  channelName?: string | null;
  channelAvatar?: string | null;
  createdAt: string;
};

// Detect if URL is an image vs video
function isImageUrl(url: string): boolean {
  if (!url) return false;
  const clean = url.split('?')[0].toLowerCase();
  return /\.(jpg|jpeg|png|gif|webp|bmp|svg|avif)(\?.*)?$/.test(url.toLowerCase()) ||
    /\.(jpg|jpeg|png|gif|webp|bmp|svg|avif)$/.test(clean);
}

// Detect YouTube URL and return embed URL, or null
function getYouTubeEmbedUrl(url: string): string | null {
  if (!url) return null;
  const ytRegex = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(ytRegex);
  if (match) return `https://www.youtube.com/embed/${match[1]}?autoplay=1&playsinline=1`;
  return null;
}

// Check if URL is an external video (non-uploaded)
function isExternalVideoUrl(url: string): boolean {
  if (!url) return false;
  return (url.startsWith('http://') || url.startsWith('https://')) && !url.includes('/uploads/');
}

// Parse videoUrl — may be a JSON array of image URLs or a single URL
function parseMediaUrls(videoUrl: string): string[] {
  if (!videoUrl) return [];
  if (videoUrl.trim().startsWith('[')) {
    try { return JSON.parse(videoUrl) as string[]; } catch {}
  }
  return [videoUrl];
}

function renderWithHashtags(text: string, onHashtag?: (tag: string) => void) {
  const parts = text.split(/(#[\u0600-\u06FFa-zA-Z0-9_]+)/g);
  return parts.map((part, i) =>
    part.startsWith('#') ? (
      <span
        key={i}
        className="text-[#fe2c55] font-bold cursor-pointer hover:underline"
        onClick={(e) => { e.stopPropagation(); onHashtag?.(part.slice(1)); }}
      >{part}</span>
    ) : <span key={i}>{part}</span>
  );
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

function ReelCard({ reel, isActive, isOwner, onEdit, onDelete, onEnded, globalMuted, onGlobalMute }: {
  reel: Reel;
  isActive: boolean;
  isOwner?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onEnded?: () => void;
  globalMuted: boolean;
  onGlobalMute: (m: boolean) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [liked, setLiked] = useState(false);
  const [localLikes, setLocalLikes] = useState(reel.likesCount);
  const muted = globalMuted;
  const setMuted = (m: boolean) => onGlobalMute(m);
  const [showUnmuteHint, setShowUnmuteHint] = useState(true);
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [comment, setComment] = useState("");
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgIndex, setImgIndex] = useState(0);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  // TikTok double-tap to like
  const [doubleTapHearts, setDoubleTapHearts] = useState<{id: number; x: number; y: number}[]>([]);
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // TikTok bookmark/save
  const [bookmarked, setBookmarked] = useState(false);

  // TikTok follow channel
  const [channelFollowing, setChannelFollowing] = useState(false);
  const followMutation = useMutation({
    mutationFn: () => apiRequest('POST', `/api/channels/${reel.channelId}/follow`, {}),
    onSuccess: (data: any) => {
      setChannelFollowing(data.following);
      toast({ title: data.following ? '✅ تمت المتابعة!' : 'تم إلغاء المتابعة' });
    },
  });

  const { data: channelFollowData } = useQuery<{ following: boolean }>({
    queryKey: ['/api/channels', reel.channelId, 'follow'],
    queryFn: () => fetch(`/api/channels/${reel.channelId}/follow`, { credentials: 'include' }).then(r => r.json()),
    enabled: !!user && !!reel.channelId && !isOwner,
  });
  useEffect(() => {
    if (channelFollowData) setChannelFollowing(channelFollowData.following);
  }, [channelFollowData]);

  // Double-tap to like handler
  const handleScreenTap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (showComments || showShare) return;
    const now = Date.now();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (lastTapRef.current && now - lastTapRef.current.time < 300) {
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
      lastTapRef.current = null;
      // Double tap — like!
      if (!liked) likeMutation.mutate();
      const heartId = Date.now();
      setDoubleTapHearts(prev => [...prev, { id: heartId, x, y }]);
      setTimeout(() => setDoubleTapHearts(prev => prev.filter(h => h.id !== heartId)), 1000);
    } else {
      lastTapRef.current = { time: now, x, y };
      tapTimerRef.current = setTimeout(() => {
        lastTapRef.current = null;
      }, 320);
    }
  };

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
  const youtubeEmbedUrl = !isImageMode ? getYouTubeEmbedUrl(reel.videoUrl) : null;
  const isYouTube = !!youtubeEmbedUrl;

  // Load initial like state
  const { data: likeData } = useQuery<{ liked: boolean }>({
    queryKey: ['/api/likes/reel', reel.id],
    queryFn: () => fetch(`/api/likes/reel/${reel.id}`, { credentials: 'include' }).then(r => r.json()),
    enabled: !!user,
  });
  useEffect(() => {
    if (likeData) {
      setLiked(likeData.liked);
    }
  }, [likeData]);

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
  const handleMicPress = async (e: React.MouseEvent | React.TouchEvent | React.PointerEvent) => {
    e.preventDefault();
    if (!user) { window.location.href = "/login"; return; }
    if (holdingRef.current || isRecording) return;
    holdingRef.current = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      // User may have released finger while permission dialog was open
      if (!holdingRef.current) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }
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

  const handleMicRelease = (e?: React.MouseEvent | React.TouchEvent | React.PointerEvent) => {
    e?.preventDefault();
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

  // Auto-play/pause video when active — honour global mute state
  useEffect(() => {
    if (!videoRef.current || isImageMode || !reel.videoUrl) return;
    if (isActive) {
      videoRef.current.muted = globalMuted;
      videoRef.current.volume = globalMuted ? 0 : 1;
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
    }
  }, [isActive, isImageMode, globalMuted, reel.videoUrl]);

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
    localStorage.setItem("reels_unmuted", "1");
  };

  const handleToggleMute = () => {
    const newMuted = !muted;
    if (videoRef.current) {
      videoRef.current.muted = newMuted;
      videoRef.current.volume = newMuted ? 0 : 1;
    }
    setMuted(newMuted);
    if (!newMuted) {
      setShowUnmuteHint(false);
      localStorage.setItem("reels_unmuted", "1");
    }
  };

  const reelShareUrl = `${window.location.origin}/reels?id=${reel.id}`;
  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: reel.title, url: reelShareUrl }).catch(() => setShowShare(true));
    } else {
      setShowShare(v => !v);
    }
  };

  const currentImgUrl = isImageMode ? urls[imgIndex] : "";

  return (
    <div className="relative h-screen w-full snap-start bg-black flex items-center justify-center overflow-hidden" onClick={handleScreenTap}>

      {/* Double-tap heart animations */}
      {doubleTapHearts.map(h => (
        <div key={h.id} className="absolute z-50 pointer-events-none" style={{ left: h.x - 40, top: h.y - 40 }}>
          <div className="animate-doubletap-heart text-7xl select-none">❤️</div>
        </div>
      ))}

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
          {isYouTube ? (
            <iframe
              src={isActive ? youtubeEmbedUrl! : youtubeEmbedUrl!.replace('autoplay=1', 'autoplay=0')}
              className="w-full h-full"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              style={{ border: 'none' }}
            />
          ) : reel.videoUrl ? (
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
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-black text-white/30" data-testid="reel-video-empty">
              <span className="text-6xl">🎬</span>
            </div>
          )}
          {/* TAP TO UNMUTE — only for local videos */}
          {!isYouTube && muted && showUnmuteHint && (
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
          {!isYouTube && muted && !showUnmuteHint && (
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

      {/* TikTok Bottom Overlay */}
      <div className="absolute bottom-0 left-0 right-16 p-4 pb-6 bg-gradient-to-t from-black/90 via-black/50 to-transparent" dir="rtl">
        {/* Creator Row */}
        <div className="flex items-center gap-2.5 mb-2">
          {/* Avatar + Follow button */}
          <div className="relative flex-shrink-0">
            <div className="w-11 h-11 rounded-full border-2 border-white/60 overflow-hidden bg-zinc-800 flex items-center justify-center">
              {reel.channelAvatar ? (
                <img src={reel.channelAvatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-white font-bold text-base">{reel.channelName?.[0] || '؟'}</span>
              )}
            </div>
            {/* Follow (+) pill on avatar */}
            {!isOwner && reel.channelId && (
              <button
                onClick={(e) => { e.stopPropagation(); if (!user) { window.location.href="/login"; return; } followMutation.mutate(); }}
                className={`absolute -bottom-1 left-1/2 -translate-x-1/2 flex items-center justify-center w-5 h-5 rounded-full text-white text-xs font-black border-2 border-black transition-all ${channelFollowing ? 'bg-green-500' : 'bg-[#fe2c55]'}`}
                data-testid={`btn-follow-channel-${reel.channelId}`}
              >
                {channelFollowing ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
              </button>
            )}
          </div>
          {/* Channel name */}
          <span className="text-white font-bold text-sm drop-shadow-md">{reel.channelName || 'بدون قناة'}</span>
          {reel.channelId && !isOwner && (
            <button
              onClick={(e) => { e.stopPropagation(); if (!user) { window.location.href="/login"; return; } followMutation.mutate(); }}
              className={`text-xs font-bold px-3 py-0.5 rounded-full border transition-all ${channelFollowing ? 'border-white/40 text-white/60' : 'border-[#fe2c55] text-[#fe2c55]'}`}
            >
              {channelFollowing ? 'متابَع' : 'متابعة'}
            </button>
          )}
        </div>
        {/* Title */}
        <h3 className="text-white font-bold text-base leading-snug mb-1 drop-shadow">{reel.title}</h3>
        {/* Description with hashtags */}
        {reel.description && (
          <p className="text-white/80 text-sm leading-relaxed mb-2 line-clamp-2">
            {renderWithHashtags(reel.description)}
          </p>
        )}
        {/* Sound disc */}
        <div className="flex items-center gap-2 mt-1">
          <div className={`w-5 h-5 rounded-full bg-zinc-700 border border-white/30 flex items-center justify-center flex-shrink-0 ${isActive && !muted ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }}>
            <Music2 className="w-2.5 h-2.5 text-white" />
          </div>
          <div className="text-white/70 text-xs overflow-hidden whitespace-nowrap max-w-[180px]">
            <span className={isActive ? 'inline-block animate-marquee' : ''}>
              {reel.channelName ? `صوت أصلي - ${reel.channelName}` : 'صوت أصلي'}
            </span>
          </div>
          <span className="text-white/40 text-xs ms-auto">👁 {reel.viewsCount}</span>
        </div>
      </div>

      {/* TikTok Side Actions */}
      <div className="absolute right-2 bottom-16 flex flex-col gap-4 items-center z-30">
        {/* Like */}
        <button
          onClick={(e) => { e.stopPropagation(); likeMutation.mutate(); }}
          className="flex flex-col items-center gap-0.5"
          data-testid={`btn-like-reel-${reel.id}`}
        >
          <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${liked ? 'text-[#fe2c55] scale-110' : 'text-white'}`}>
            <Heart className={`w-7 h-7 drop-shadow-lg ${liked ? 'fill-current' : ''}`} />
          </div>
          <span className="text-white text-xs font-bold drop-shadow">{localLikes}</span>
        </button>

        {/* Comment */}
        <button
          onClick={(e) => { e.stopPropagation(); setShowComments(!showComments); }}
          className="flex flex-col items-center gap-0.5"
          data-testid={`btn-comment-reel-${reel.id}`}
        >
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-white">
            <MessageCircle className="w-7 h-7 drop-shadow-lg" />
          </div>
          <span className="text-white text-xs font-bold drop-shadow">{reel.commentsCount}</span>
        </button>

        {/* Bookmark/Save */}
        <button
          onClick={(e) => { e.stopPropagation(); setBookmarked(b => !b); toast({ title: !bookmarked ? '🔖 تم الحفظ!' : 'تم الإلغاء' }); }}
          className="flex flex-col items-center gap-0.5"
          data-testid={`btn-bookmark-reel-${reel.id}`}
        >
          <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${bookmarked ? 'text-yellow-400 scale-110' : 'text-white'}`}>
            {bookmarked ? <BookmarkCheck className="w-7 h-7 fill-current drop-shadow-lg" /> : <Bookmark className="w-7 h-7 drop-shadow-lg" />}
          </div>
          <span className="text-white text-xs font-bold drop-shadow">{bookmarked ? 'محفوظ' : 'احفظ'}</span>
        </button>

        {/* Share */}
        <button
          onClick={(e) => { e.stopPropagation(); handleShare(); }}
          className="flex flex-col items-center gap-0.5"
          data-testid={`btn-share-reel-${reel.id}`}
        >
          <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${showShare ? "text-primary scale-110" : "text-white"}`}>
            <Share2 className="w-7 h-7 drop-shadow-lg" />
          </div>
          <span className="text-white text-xs font-bold drop-shadow">شارك</span>
        </button>

        {/* Volume toggle */}
        {!isYouTube && (
          <button
            onClick={(e) => { e.stopPropagation(); handleToggleMute(); }}
            className="flex flex-col items-center gap-0.5"
            data-testid="btn-volume-reel"
          >
            <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${muted ? 'text-red-400' : 'text-white'}`}>
              {muted ? <VolumeX className="w-6 h-6 drop-shadow-lg" /> : <Volume2 className="w-6 h-6 drop-shadow-lg" />}
            </div>
            <span className="text-white text-xs font-bold drop-shadow">{muted ? 'صوت' : 'كتم'}</span>
          </button>
        )}

        {/* Owner-only: Edit & Delete */}
        {isOwner && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); onEdit?.(); }}
              className="flex flex-col items-center gap-1"
              data-testid={`btn-edit-reel-feed-${reel.id}`}
            >
              <div className="w-10 h-10 rounded-full bg-blue-500/80 flex items-center justify-center text-white hover:bg-blue-600/90 transition-colors">
                <Pencil className="w-5 h-5" />
              </div>
              <span className="text-white text-xs font-bold">تعديل</span>
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); if (confirm("هل تريد حذف هذا الريل؟")) onDelete?.(); }}
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

      {/* ── Share Panel ── */}
      <AnimatePresence>
        {showShare && (
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="absolute bottom-0 left-0 right-0 bg-zinc-900/95 backdrop-blur-md rounded-t-3xl p-4 z-40 border-t border-white/10"
            dir="rtl"
          >
            <div className="flex items-center justify-between mb-4">
              <p className="text-white font-bold text-sm flex items-center gap-2">
                <Share2 className="w-4 h-4 text-primary" /> مشاركة الريل
              </p>
              <button onClick={() => setShowShare(false)} className="text-white/50 hover:text-white text-xl leading-none">×</button>
            </div>
            {/* Platform buttons */}
            <div className="grid grid-cols-4 gap-2 mb-2">
              {[
                { name: "واتساب", icon: "💬", color: "bg-[#25D366]", href: `https://wa.me/?text=${encodeURIComponent(reel.title + "\n" + reelShareUrl)}` },
                { name: "فيسبوك", icon: "👥", color: "bg-[#1877F2]", href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(reelShareUrl)}` },
                { name: "تيليجرام", icon: "✈️", color: "bg-[#229ED9]", href: `https://t.me/share/url?url=${encodeURIComponent(reelShareUrl)}&text=${encodeURIComponent(reel.title)}` },
                { name: "تويتر X", icon: "𝕏", color: "bg-black border border-white/20", href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(reelShareUrl)}&text=${encodeURIComponent(reel.title)}` },
              ].map(p => (
                <a
                  key={p.name}
                  href={p.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setShowShare(false)}
                  className={`${p.color} flex flex-col items-center gap-1.5 rounded-2xl py-3 text-white text-center hover:opacity-90 transition`}
                >
                  <span className="text-2xl leading-none">{p.icon}</span>
                  <span className="text-[10px] font-semibold">{p.name}</span>
                </a>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[
                { name: "انستجرام", icon: "📷", color: "bg-gradient-to-br from-[#f09433] via-[#e6683c] to-[#bc1888]", copy: true },
                { name: "تيك توك", icon: "🎵", color: "bg-black border border-white/20", copy: true },
                { name: "سناب شات", icon: "👻", color: "bg-[#FFFC00]", href: `https://www.snapchat.com/scan?attachmentUrl=${encodeURIComponent(reelShareUrl)}`, textColor: "text-black" },
              ].map(p => (
                p.copy ? (
                  <button
                    key={p.name}
                    onClick={() => {
                      navigator.clipboard.writeText(reelShareUrl);
                      toast({ title: `✅ تم نسخ الرابط — افتح ${p.name} والصقه!` });
                      setShowShare(false);
                    }}
                    className={`${p.color} flex flex-col items-center gap-1.5 rounded-2xl py-3 text-white text-center hover:opacity-90 transition`}
                  >
                    <span className="text-2xl leading-none">{p.icon}</span>
                    <span className="text-[10px] font-semibold">{p.name}</span>
                  </button>
                ) : (
                  <a
                    key={p.name}
                    href={(p as any).href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setShowShare(false)}
                    className={`${p.color} flex flex-col items-center gap-1.5 rounded-2xl py-3 text-center hover:opacity-90 transition ${(p as any).textColor || "text-white"}`}
                  >
                    <span className="text-2xl leading-none">{p.icon}</span>
                    <span className="text-[10px] font-semibold">{p.name}</span>
                  </a>
                )
              ))}
            </div>
            {/* Copy link */}
            <div className="flex items-center gap-2 bg-white/10 rounded-2xl px-3 py-2.5">
              <span className="text-white/60 text-xs truncate flex-1 font-mono">{reelShareUrl}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(reelShareUrl);
                  toast({ title: "✅ تم نسخ الرابط!" });
                  setShowShare(false);
                }}
                className="bg-primary text-white text-xs px-4 py-1.5 rounded-xl font-bold whitespace-nowrap hover:bg-primary/90 transition"
                data-testid={`btn-copy-reel-link-${reel.id}`}
              >
                نسخ الرابط
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
                  {/* 🎤 Press & Hold mic — pointer events cover both mouse & touch */}
                  <button
                    onPointerDown={handleMicPress}
                    onPointerUp={handleMicRelease}
                    onPointerLeave={handleMicRelease}
                    onPointerCancel={handleMicRelease}
                    onContextMenu={e => e.preventDefault()}
                    disabled={isUploading || commentMutation.isPending}
                    style={{ touchAction: "none", userSelect: "none" }}
                    className={`h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all
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
  const [activeTab, setActiveTab] = useState<'foryou' | 'following'>('foryou');
  // Global muted state — remembered across reels and across sessions
  const [globalMuted, setGlobalMuted] = useState(() => {
    return localStorage.getItem("reels_unmuted") !== "1";
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const { data: reelsForyou = [], isLoading: loadingForyou } = useQuery<Reel[]>({
    queryKey: ['/api/reels'],
    queryFn: () => fetch('/api/reels', { credentials: 'include' }).then(r => r.json()).then(d => Array.isArray(d) ? d : []),
  });
  const { data: reelsFollowing = [], isLoading: loadingFollowing } = useQuery<Reel[]>({
    queryKey: ['/api/reels', 'following'],
    queryFn: () => fetch('/api/reels?feed=following', { credentials: 'include' }).then(r => r.json()).then(d => Array.isArray(d) ? d : []),
    enabled: activeTab === 'following' && !!user,
  });

  const reels = Array.isArray(activeTab === 'following' ? reelsFollowing : reelsForyou)
    ? (activeTab === 'following' ? reelsFollowing : reelsForyou)
    : [];
  const isLoading = activeTab === 'following' ? loadingFollowing : loadingForyou;

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

      {/* TikTok Top Bar — Tabs + Back */}
      <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-center pt-3 pb-2 px-4" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)' }}>
        {/* Back button */}
        <button
          onClick={() => setLocation('/ads')}
          className="absolute right-4 top-3 text-white/70 hover:text-white transition"
          data-testid="btn-back-to-ads"
        >
          <ArrowRight className="w-6 h-6" />
        </button>

        {/* TikTok-style tabs */}
        <div className="flex items-center gap-6">
          <button
            onClick={() => { setActiveTab('following'); setActiveIndex(0); containerRef.current?.scrollTo({ top: 0 }); }}
            className={`text-base font-bold transition-all ${activeTab === 'following' ? 'text-white' : 'text-white/50'}`}
            data-testid="tab-following"
          >
            متابَعون
            {activeTab === 'following' && <div className="mt-0.5 h-0.5 w-full bg-white rounded-full" />}
          </button>
          <button
            onClick={() => { setActiveTab('foryou'); setActiveIndex(0); containerRef.current?.scrollTo({ top: 0 }); }}
            className={`text-base font-bold transition-all ${activeTab === 'foryou' ? 'text-white' : 'text-white/50'}`}
            data-testid="tab-foryou"
          >
            لك
            {activeTab === 'foryou' && <div className="mt-0.5 h-0.5 w-full bg-white rounded-full" />}
          </button>
        </div>

      </div>

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
            globalMuted={globalMuted}
            onGlobalMute={(m) => {
              setGlobalMuted(m);
              if (!m) localStorage.setItem("reels_unmuted", "1");
            }}
          />
        ))}

        {/* Following tab empty state */}
        {activeTab === 'following' && reels.length === 0 && !isLoading && (
          <div className="h-screen flex flex-col items-center justify-center text-white gap-4">
            <div className="text-6xl">👥</div>
            <h2 className="text-xl font-bold">لا توجد ريلز من المتابَعين</h2>
            <p className="text-white/60 text-center px-8 text-sm">تابع قنوات لترى ريلزهم هنا</p>
          </div>
        )}
      </div>

      {/* Navigation hints */}
      {activeIndex > 0 && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 text-white/40 animate-bounce">
          <ChevronUp className="w-5 h-5" />
        </div>
      )}
      {activeIndex < reels.length - 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-white/40 animate-bounce">
          <ChevronDown className="w-5 h-5" />
        </div>
      )}

      {/* ── إعلان overlay كل ريلين ─────────────────────── */}
      {activeIndex % 2 === 0 && (
        <AdWidget
          variant="overlay"
          className="bottom-24 left-3"
          refreshInterval={12000}
          dismissible
        />
      )}

      <CreateReelDialog />

      {editingReel && (
        <EditReelDialog
          reel={editingReel as any}
          open={!!editingReel}
          onClose={() => setEditingReel(null)}
        />
      )}
    </div>
  );
}
