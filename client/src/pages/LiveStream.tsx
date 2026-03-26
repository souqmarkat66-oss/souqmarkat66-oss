import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Radio, Users, Heart, Send, MicOff, VideoOff, PhoneOff,
  Mic, Video, Share2, Eye, MessageCircle, Monitor, Camera,
  Settings, Wifi, WifiOff, Maximize, RotateCcw, Volume2
} from "lucide-react";
import { io, Socket } from "socket.io-client";
import type { LiveStream as LiveStreamType } from "@shared/schema";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";

interface ChatMsg { id: number; userName: string; message: string; timestamp: string; }

const QUALITY_PRESETS = {
  "1080p": { width: { ideal: 1920, max: 1920 }, height: { ideal: 1080, max: 1080 }, frameRate: { ideal: 30, max: 30 } },
  "720p":  { width: { ideal: 1280, max: 1280 }, height: { ideal: 720,  max: 720  }, frameRate: { ideal: 30, max: 30 } },
  "480p":  { width: { ideal: 854,  max: 854  }, height: { ideal: 480,  max: 480  }, frameRate: { ideal: 30, max: 30 } },
  "360p":  { width: { ideal: 640,  max: 640  }, height: { ideal: 360,  max: 360  }, frameRate: { ideal: 24, max: 24 } },
};

const HIGH_QUALITY_AUDIO = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  sampleRate: 48000,
  channelCount: 2,
};

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
  { urls: "stun:stun4.l.google.com:19302" },
];

export default function LiveStream() {
  const { id } = useParams<{ id: string }>();
  const search = useSearch();
  const isBroadcast = search.includes("mode=broadcast");
  const { user } = useAuth();
  const { toast } = useToast();

  const videoRef      = useRef<HTMLVideoElement>(null);
  const previewRef    = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const socketRef     = useRef<Socket | null>(null);
  const peersRef      = useRef<Map<string, RTCPeerConnection>>(new Map());

  const [messages, setMessages]       = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput]     = useState("");
  const [viewerCount, setViewerCount] = useState(0);
  const [liked, setLiked]             = useState(false);
  const [likesCount, setLikesCount]   = useState(0);
  const [muted, setMuted]             = useState(false);
  const [videoOff, setVideoOff]       = useState(false);
  const [streaming, setStreaming]     = useState(false);
  const [quality, setQuality]         = useState<keyof typeof QUALITY_PRESETS>("720p");
  const [sourceMode, setSourceMode]   = useState<"camera" | "screen">("camera");
  const [connected, setConnected]     = useState(false);
  const [stats, setStats]             = useState({ resolution: "", fps: 0, bitrate: 0 });
  const [cameras, setCameras]         = useState<MediaDeviceInfo[]>([]);
  const [mics, setMics]               = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>("");
  const [selectedMic, setSelectedMic]       = useState<string>("");
  const [isFullscreen, setIsFullscreen]     = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const statsIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const { data: stream, isLoading } = useQuery<LiveStreamType>({
    queryKey: ["/api/streams", Number(id)],
    queryFn: () => fetch(`/api/streams/${id}`).then(r => r.json()),
    refetchInterval: 15000,
  });

  const { data: historyMessages } = useQuery<any[]>({
    queryKey: ["/api/streams", Number(id), "chat"],
    queryFn: () => fetch(`/api/streams/${id}/chat`).then(r => r.json()),
  });

  const endStreamMutation = useMutation({
    mutationFn: () => fetch(`/api/streams/${id}/end`, { method: "POST", credentials: "include" }).then(r => r.json()),
    onSuccess: () => { toast({ title: "انتهى البث" }); window.location.href = "/channels"; },
  });

  useEffect(() => {
    if (Array.isArray(historyMessages)) {
      setMessages(historyMessages.map((m: any) => ({ id: m.id, userName: m.userName, message: m.message, timestamp: m.createdAt })));
    }
  }, [historyMessages]);

  useEffect(() => {
    if (stream) setLikesCount(stream.likesCount || 0);
  }, [stream]);

  // Load available devices for broadcaster
  useEffect(() => {
    if (!isBroadcast) return;
    navigator.mediaDevices.enumerateDevices().then(devices => {
      setCameras(devices.filter(d => d.kind === "videoinput"));
      setMics(devices.filter(d => d.kind === "audioinput"));
      const cam = devices.find(d => d.kind === "videoinput");
      const mic = devices.find(d => d.kind === "audioinput");
      if (cam) setSelectedCamera(cam.deviceId);
      if (mic) setSelectedMic(mic.deviceId);
    });
  }, [isBroadcast]);

  const createPeer = useCallback((socket: Socket, targetId?: string): RTCPeerConnection => {
    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      iceTransportPolicy: "all",
      bundlePolicy: "max-bundle",
      rtcpMuxPolicy: "require",
    });
    pc.onicecandidate = (e) => {
      if (e.candidate) socket.emit("candidate", targetId || "broadcaster", e.candidate);
    };
    pc.onconnectionstatechange = () => {
      setConnected(pc.connectionState === "connected");
    };
    return pc;
  }, []);

  // Collect real-time stats for broadcaster
  const startStats = useCallback((pc: RTCPeerConnection) => {
    statsIntervalRef.current = setInterval(async () => {
      const reports = await pc.getStats();
      reports.forEach((report: any) => {
        if (report.type === "outbound-rtp" && report.mediaType === "video") {
          setStats(prev => ({
            ...prev,
            resolution: `${report.frameWidth || 0}×${report.frameHeight || 0}`,
            fps: Math.round(report.framesPerSecond || 0),
          }));
        }
      });
    }, 2000);
  }, []);

  const setupBroadcaster = useCallback(async (socket: Socket) => {
    try {
      let mediaStream: MediaStream;

      if (sourceMode === "screen") {
        const screenStream = await (navigator.mediaDevices as any).getDisplayMedia({
          video: { ...QUALITY_PRESETS[quality], cursor: "motion" },
          audio: true,
        });
        // Merge with mic audio if screen has no audio
        if (!screenStream.getAudioTracks().length) {
          const micStream = await navigator.mediaDevices.getUserMedia({ audio: HIGH_QUALITY_AUDIO });
          micStream.getAudioTracks().forEach(t => screenStream.addTrack(t));
        }
        mediaStream = screenStream;
      } else {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            ...QUALITY_PRESETS[quality],
            deviceId: selectedCamera ? { exact: selectedCamera } : undefined,
            facingMode: "user",
          },
          audio: {
            ...HIGH_QUALITY_AUDIO,
            deviceId: selectedMic ? { exact: selectedMic } : undefined,
          },
        });
      }

      localStreamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.muted = true;
        videoRef.current.play().catch(() => {});
      }
      setStreaming(true);
      setConnected(true);

      socket.emit("broadcaster", id);
      await fetch(`/api/streams/${id}/start`, { method: "POST", credentials: "include" });

      socket.on("watcher", async (watcherId: string) => {
        const pc = createPeer(socket, watcherId);
        peersRef.current.set(watcherId, pc);

        // Add all tracks with high quality encoding
        mediaStream.getTracks().forEach(track => {
          const sender = pc.addTrack(track, mediaStream);
          if (track.kind === "video") {
            sender.setParameters({
              ...sender.getParameters(),
              encodings: [{ maxBitrate: quality === "1080p" ? 4_000_000 : quality === "720p" ? 2_500_000 : quality === "480p" ? 1_000_000 : 500_000, priority: "high" as RTCPriorityType }],
            }).catch(() => {});
          } else {
            sender.setParameters({
              ...sender.getParameters(),
              encodings: [{ maxBitrate: 128_000 }],
            }).catch(() => {});
          }
        });

        const offer = await pc.createOffer({
          offerToReceiveAudio: false,
          offerToReceiveVideo: false,
        });
        await pc.setLocalDescription(offer);
        socket.emit("offer", watcherId, pc.localDescription);
        startStats(pc);
      });

      socket.on("answer", async (watcherId: string, desc: RTCSessionDescriptionInit) => {
        await peersRef.current.get(watcherId)?.setRemoteDescription(new RTCSessionDescription(desc));
      });

      socket.on("candidate", async (watcherId: string, candidate: RTCIceCandidateInit) => {
        try { await peersRef.current.get(watcherId)?.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
      });

      toast({ title: "🔴 البث بدأ!", description: `جودة ${quality} · صوت عالي الجودة` });
    } catch (err: any) {
      setStreaming(false);
      if (err.name === "NotAllowedError") {
        toast({ variant: "destructive", title: "لم يُسمح بالكاميرا", description: "الرجاء السماح للمتصفح بالوصول للكاميرا والميكروفون" });
      } else {
        toast({ variant: "destructive", title: "خطأ في البث", description: err.message });
      }
    }
  }, [id, quality, sourceMode, selectedCamera, selectedMic, createPeer, startStats]);

  const setupWatcher = useCallback((socket: Socket) => {
    socket.emit("watcher", id);

    socket.on("broadcaster", () => socket.emit("watcher", id));

    socket.on("broadcaster-disconnected", () => {
      if (videoRef.current) videoRef.current.srcObject = null;
      setConnected(false);
      toast({ title: "انتهى البث المباشر" });
    });

    socket.on("offer", async (_: string, desc: RTCSessionDescriptionInit) => {
      const pc = createPeer(socket);
      peersRef.current.set("broadcaster", pc);

      pc.ontrack = (e) => {
        if (videoRef.current && e.streams[0]) {
          videoRef.current.srcObject = e.streams[0];
          videoRef.current.play().catch(() => {});
          setStreaming(true);
        }
      };

      socket.on("candidate", async (_id: string, candidate: RTCIceCandidateInit) => {
        try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
      });

      await pc.setRemoteDescription(new RTCSessionDescription(desc));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("answer", "broadcaster", pc.localDescription);
    });
  }, [id, createPeer]);

  useEffect(() => {
    const socket = io({ path: "/socket.io", transports: ["websocket"], upgrade: false });
    socketRef.current = socket;

    socket.emit("join-stream", id);
    socket.on("viewer-count", (count: number) => setViewerCount(count));
    socket.on("chat-message", (msg: ChatMsg) => setMessages(prev => [...prev, msg]));
    socket.on("stream-like", () => setLikesCount(prev => prev + 1));

    if (isBroadcast) {
      setupBroadcaster(socket);
    } else {
      setupWatcher(socket);
    }

    return () => {
      if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
      socket.emit("leave-stream", id);
      socket.disconnect();
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      peersRef.current.forEach(pc => pc.close());
      peersRef.current.clear();
    };
  }, [id, isBroadcast]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendChat = () => {
    if (!chatInput.trim() || !user) return;
    socketRef.current?.emit("chat-message", {
      streamId: id, userId: user.id,
      userName: user.firstName || "مستخدم",
      message: chatInput.trim()
    });
    setChatInput("");
  };

  const handleLike = () => {
    setLiked(l => !l);
    if (!liked) {
      setLikesCount(c => c + 1);
      socketRef.current?.emit("stream-like", id);
    }
    if (user) {
      fetch("/api/likes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType: "stream", targetId: Number(id) }),
        credentials: "include"
      });
    }
  };

  const toggleMute = () => {
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = muted; });
    setMuted(m => !m);
  };

  const toggleVideo = () => {
    localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = videoOff; });
    setVideoOff(v => !v);
  };

  const toggleFullscreen = () => {
    if (!videoRef.current) return;
    if (!document.fullscreenElement) {
      videoRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const switchSource = async (mode: "camera" | "screen") => {
    setSourceMode(mode);
    if (!localStreamRef.current || !streaming) return;
    try {
      const newStream = mode === "screen"
        ? await (navigator.mediaDevices as any).getDisplayMedia({ video: QUALITY_PRESETS[quality], audio: true })
        : await navigator.mediaDevices.getUserMedia({ video: { ...QUALITY_PRESETS[quality], deviceId: selectedCamera ? { exact: selectedCamera } : undefined }, audio: HIGH_QUALITY_AUDIO });

      const videoTrack = newStream.getVideoTracks()[0];
      peersRef.current.forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === "video");
        sender?.replaceTrack(videoTrack);
      });
      localStreamRef.current.getVideoTracks().forEach(t => t.stop());
      if (videoRef.current) videoRef.current.srcObject = newStream;
      localStreamRef.current = newStream;
    } catch (err: any) {
      toast({ variant: "destructive", title: "تعذّر التبديل", description: err.message });
    }
  };

  if (isLoading) return <div className="container py-12"><Skeleton className="aspect-video rounded-3xl" /></div>;

  return (
    <div className="container px-4 py-6" dir="rtl">
      <div className="flex flex-col lg:flex-row gap-6">

        {/* ── Video Area ── */}
        <div className="flex-1">
          <div className="relative rounded-3xl overflow-hidden bg-black shadow-2xl shadow-black/50" style={{ aspectRatio: "16/9" }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              controls={!isBroadcast}
              className="w-full h-full object-contain"
              style={{ backgroundColor: "#000" }}
            />

            {/* Waiting overlay */}
            {!streaming && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-white gap-4">
                <div className="w-16 h-16 rounded-full border-4 border-red-500/40 flex items-center justify-center animate-pulse">
                  <Radio className="w-7 h-7 text-red-400" />
                </div>
                <p className="text-lg font-medium opacity-70">
                  {isBroadcast ? "جاري الاتصال بالبث..." : "في انتظار البث المباشر..."}
                </p>
              </div>
            )}

            {/* Top badges */}
            <div className="absolute top-4 start-4 flex items-center gap-2">
              {(stream?.status === "live" || streaming) && (
                <Badge className="bg-red-500 text-white gap-1 px-3 py-1 text-xs font-bold shadow-lg">
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse inline-block" /> مباشر
                </Badge>
              )}
              <Badge variant="secondary" className="gap-1 bg-black/70 text-white backdrop-blur text-xs">
                <Eye className="w-3 h-3" /> {viewerCount.toLocaleString()}
              </Badge>
              {isBroadcast && stats.resolution && (
                <Badge className="bg-black/70 text-green-400 text-xs backdrop-blur gap-1">
                  <Wifi className="w-3 h-3" /> {stats.resolution} · {stats.fps}fps
                </Badge>
              )}
            </div>

            {/* Fullscreen button (viewer) */}
            {!isBroadcast && streaming && (
              <button
                onClick={toggleFullscreen}
                className="absolute top-4 end-4 w-9 h-9 rounded-full bg-black/60 backdrop-blur flex items-center justify-center text-white hover:bg-black/80 transition"
              >
                <Maximize className="w-4 h-4" />
              </button>
            )}

            {/* Broadcaster controls */}
            {isBroadcast && streaming && (
              <div className="absolute bottom-0 start-0 end-0 bg-gradient-to-t from-black/80 to-transparent p-5">
                <div className="flex items-center justify-center gap-3 flex-wrap">
                  {/* Mute */}
                  <button
                    onClick={toggleMute}
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-lg ${muted ? "bg-red-500 text-white" : "bg-white/20 backdrop-blur text-white hover:bg-white/30"}`}
                    title={muted ? "تفعيل الميكروفون" : "كتم الصوت"}
                  >
                    {muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </button>

                  {/* Video toggle */}
                  <button
                    onClick={toggleVideo}
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-lg ${videoOff ? "bg-red-500 text-white" : "bg-white/20 backdrop-blur text-white hover:bg-white/30"}`}
                    title={videoOff ? "تفعيل الكاميرا" : "إيقاف الكاميرا"}
                  >
                    {videoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                  </button>

                  {/* Screen share */}
                  <button
                    onClick={() => switchSource(sourceMode === "camera" ? "screen" : "camera")}
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-lg ${sourceMode === "screen" ? "bg-blue-500 text-white" : "bg-white/20 backdrop-blur text-white hover:bg-white/30"}`}
                    title={sourceMode === "screen" ? "العودة للكاميرا" : "مشاركة الشاشة"}
                  >
                    {sourceMode === "screen" ? <Camera className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
                  </button>

                  {/* End stream */}
                  <button
                    onClick={() => endStreamMutation.mutate()}
                    className="px-5 h-12 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center gap-2 font-bold shadow-lg transition"
                  >
                    <PhoneOff className="w-5 h-5" /> إنهاء البث
                  </button>

                  {/* Share */}
                  <button
                    onClick={() => { navigator.clipboard.writeText(window.location.href.replace("mode=broadcast", "")); toast({ title: "تم نسخ رابط البث!" }); }}
                    className="w-12 h-12 rounded-full bg-white/20 backdrop-blur text-white hover:bg-white/30 flex items-center justify-center transition"
                  >
                    <Share2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Stream Info */}
          <div className="mt-4 flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold">{stream?.title}</h1>
              {stream?.description && <p className="text-muted-foreground mt-1 text-sm">{stream.description}</p>}
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleLike} variant={liked ? "default" : "outline"} size="sm" className="gap-2 rounded-full">
                <Heart className={`w-4 h-4 ${liked ? "fill-current text-red-400" : ""}`} />
                {likesCount.toLocaleString()}
              </Button>
              <Button variant="outline" size="sm" className="gap-2 rounded-full" onClick={() => { navigator.clipboard.writeText(window.location.href); toast({ title: "تم نسخ الرابط!" }); }}>
                <Share2 className="w-4 h-4" /> مشاركة
              </Button>
            </div>
          </div>

          {/* Broadcaster Settings Panel */}
          {isBroadcast && !streaming && (
            <div className="mt-4 bg-muted/40 border border-border/50 rounded-2xl p-4">
              <h3 className="font-bold mb-3 flex items-center gap-2 text-sm"><Settings className="w-4 h-4" /> إعدادات جودة البث</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">جودة الفيديو</label>
                  <Select value={quality} onValueChange={(v) => setQuality(v as any)}>
                    <SelectTrigger className="rounded-xl h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1080p">🔥 1080p Full HD</SelectItem>
                      <SelectItem value="720p">⚡ 720p HD</SelectItem>
                      <SelectItem value="480p">📱 480p</SelectItem>
                      <SelectItem value="360p">📶 360p (توفير بيانات)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">مصدر البث</label>
                  <div className="flex gap-2 h-9">
                    <button
                      onClick={() => setSourceMode("camera")}
                      className={`flex-1 rounded-xl text-xs font-medium flex items-center justify-center gap-1 border transition ${sourceMode === "camera" ? "bg-primary text-white border-primary" : "border-border hover:bg-muted"}`}
                    >
                      <Camera className="w-3 h-3" /> كاميرا
                    </button>
                    <button
                      onClick={() => setSourceMode("screen")}
                      className={`flex-1 rounded-xl text-xs font-medium flex items-center justify-center gap-1 border transition ${sourceMode === "screen" ? "bg-primary text-white border-primary" : "border-border hover:bg-muted"}`}
                    >
                      <Monitor className="w-3 h-3" /> شاشة
                    </button>
                  </div>
                </div>
                {cameras.length > 1 && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">الكاميرا</label>
                    <Select value={selectedCamera} onValueChange={setSelectedCamera}>
                      <SelectTrigger className="rounded-xl h-9 text-xs">
                        <SelectValue placeholder="اختر الكاميرا" />
                      </SelectTrigger>
                      <SelectContent>
                        {cameras.map(cam => (
                          <SelectItem key={cam.deviceId} value={cam.deviceId}>
                            {cam.label || `كاميرا ${cameras.indexOf(cam) + 1}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {mics.length > 1 && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">الميكروفون</label>
                    <Select value={selectedMic} onValueChange={setSelectedMic}>
                      <SelectTrigger className="rounded-xl h-9 text-xs">
                        <SelectValue placeholder="اختر الميكروفون" />
                      </SelectTrigger>
                      <SelectContent>
                        {mics.map(mic => (
                          <SelectItem key={mic.deviceId} value={mic.deviceId}>
                            {mic.label || `ميكروفون ${mics.indexOf(mic) + 1}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <div className="mt-3 text-xs text-muted-foreground flex items-center gap-2">
                <Volume2 className="w-3 h-3" />
                الصوت: إلغاء الصدى · تصفية الضوضاء · ضبط تلقائي للمستوى
              </div>
            </div>
          )}
        </div>

        {/* ── Live Chat ── */}
        <div className="lg:w-80 flex flex-col gap-4">
          {/* Connection Status */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium ${connected ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"}`}>
            {connected ? <><Wifi className="w-3 h-3" /> متصل · جودة عالية</> : <><WifiOff className="w-3 h-3" /> جاري الاتصال...</>}
          </div>

          {/* Chat Box */}
          <div className="bg-card border border-border/50 rounded-2xl overflow-hidden flex flex-col" style={{ height: 460 }}>
            <div className="p-4 border-b flex items-center justify-between bg-muted/20">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-primary" />
                <span className="font-bold text-sm">الدردشة المباشرة</span>
              </div>
              <Badge variant="outline" className="text-xs gap-1">
                <Users className="w-3 h-3" /> {viewerCount}
              </Badge>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-1.5 scroll-smooth">
              {messages.length === 0 && (
                <div className="text-center text-muted-foreground text-xs pt-8">
                  لا توجد رسائل بعد... كن أول من يتفاعل! 💬
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className="group flex items-start gap-2">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 mt-0.5">
                    {msg.userName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[11px] font-bold text-primary">{msg.userName} </span>
                    <span className="text-sm text-foreground break-words">{msg.message}</span>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <div className="p-3 border-t bg-muted/10">
              {user ? (
                <div className="flex gap-2">
                  <Input
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendChat()}
                    placeholder="رسالة..."
                    className="flex-1 h-9 text-sm rounded-full"
                    maxLength={200}
                  />
                  <Button size="sm" onClick={sendChat} disabled={!chatInput.trim()} className="h-9 w-9 p-0 rounded-full">
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <a href="/login">
                  <Button variant="outline" size="sm" className="w-full text-xs rounded-full">سجل دخول للمشاركة في الدردشة</Button>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
