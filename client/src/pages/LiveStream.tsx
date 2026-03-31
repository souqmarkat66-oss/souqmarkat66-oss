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
  Settings, Wifi, WifiOff, Maximize, RotateCcw, Volume2, X,
  UserPlus, UserCheck, UserX, Trophy, Clock, TrendingUp
} from "lucide-react";
import { io, Socket } from "socket.io-client";
import type { LiveStream as LiveStreamType } from "@shared/schema";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { ShareMenu } from "@/components/ShareMenu";
import { AdWidget } from "@/components/AdWidget";

interface ChatMsg {
  id: number;
  userName: string;
  message: string;
  timestamp: string;
  isVoice?: boolean;
  voiceUrl?: string;
  isOwner?: boolean;
}

interface LiveGift {
  id: number;
  giftEmoji: string;
  giftName: string;
  giftCoins: number;
  userName: string;
  userId: string;
}

interface LivePoll {
  id: number;
  question: string;
  options: { text: string; votes: number }[];
  totalVotes: number;
}

interface FloatingItem {
  id: number;
  emoji?: string;
  x: number;
}

const GIFTS = [
  { id: "rose",    emoji: "🌹", name: "وردة",   coins: 5   },
  { id: "heart",   emoji: "❤️", name: "قلب",    coins: 10  },
  { id: "star",    emoji: "⭐", name: "نجمة",   coins: 20  },
  { id: "fire",    emoji: "🔥", name: "نار",    coins: 50  },
  { id: "diamond", emoji: "💎", name: "ماسة",   coins: 100 },
  { id: "crown",   emoji: "👑", name: "تاج",    coins: 200 },
  { id: "rocket",  emoji: "🚀", name: "صاروخ",  coins: 500 },
  { id: "trophy",  emoji: "🏆", name: "كأس",    coins: 1000},
];

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
  const [showSharePanel, setShowSharePanel] = useState(false);
  const [viewerMuted, setViewerMuted]       = useState(true);
  const [audioBlocked, setAudioBlocked]     = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const statsIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ── Co-host states ──────────────────────────────────────────
  const coHostVideoRef    = useRef<HTMLVideoElement>(null);
  const coHostPCRef         = useRef<RTCPeerConnection | null>(null);
  const coHostStreamRef     = useRef<MediaStream | null>(null);
  const cohostViewerPCsRef  = useRef<Map<string, RTCPeerConnection>>(new Map());
  const isCoHostRef         = useRef(false);          // ref version (for socket closures)
  const [coHostActive, setCoHostActive]         = useState(false);
  const [coHostName, setCoHostName]             = useState("");
  const [isCoHost, setIsCoHost]                 = useState(false);
  const [cohostRequest, setCohostRequest]       = useState<{ socketId: string; userName: string } | null>(null);
  const [requestingJoin, setRequestingJoin]     = useState(false);
  const [coHostMuted, setCoHostMuted]           = useState(false);
  const [coHostVideoOff, setCoHostVideoOff]     = useState(false);
  const streamStartRef = useRef<number>(Date.now());
  const peakViewersRef = useRef<number>(0);

  // ── Post-stream summary ─────────────────────────────────────
  const [showSummary, setShowSummary] = useState(false);
  const [summary, setSummary] = useState({ duration: 0, peakViewers: 0, totalLikes: 0, totalComments: 0 });

  // ─── Voice Chat Recording (Press & Hold) ───────────────────
  const [chatIsRecording, setChatIsRecording] = useState(false);
  const [chatIsUploading, setChatIsUploading] = useState(false);
  const [chatRecordSeconds, setChatRecordSeconds] = useState(0);
  const [chatWaveLevel, setChatWaveLevel]   = useState(0);
  const chatHoldingRef    = useRef(false);
  const chatRecorderRef   = useRef<MediaRecorder | null>(null);
  const chatChunksRef     = useRef<BlobPart[]>([]);
  const chatTimerRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const chatWaveRef       = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── TikTok-style Live Features ───────────────────────────────
  const [floatingGifts, setFloatingGifts]   = useState<FloatingItem[]>([]);
  const [floatingHearts, setFloatingHearts] = useState<FloatingItem[]>([]);
  const [pinnedComment, setPinnedComment]   = useState<{ message: string; userName: string } | null>(null);
  const [topGifters, setTopGifters]         = useState<{ userName: string; userId: string; giftCount: number; totalCoins: number; lastEmoji: string }[]>([]);
  const [livePoll, setLivePoll]             = useState<LivePoll | null>(null);
  const [votedPollOption, setVotedPollOption] = useState<number | null>(null);
  const [showGiftsPanel, setShowGiftsPanel] = useState(false);
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [pollQuestion, setPollQuestion]     = useState("");
  const [pollOptions, setPollOptions]       = useState(["", ""]);
  const [recentGiftBanner, setRecentGiftBanner] = useState<LiveGift | null>(null);
  const [followerBanners, setFollowerBanners] = useState<{ id: number; userName: string }[]>([]);

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
    onSuccess: () => {
      const durationSec = Math.round((Date.now() - streamStartRef.current) / 1000);
      setSummary({
        duration: durationSec,
        peakViewers: peakViewersRef.current,
        totalLikes: likesCount,
        totalComments: messages.length,
      });
      setShowSummary(true);
      // Stop co-host if active
      if (isCoHost) socketRef.current?.emit("cohost-leave", id);
    },
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
    // ── Register socket handlers FIRST (before any async await) ──
    // This prevents the race condition where a watcher joins before the camera is ready.
    const pendingWatchers: string[] = [];

    socket.on("watcher", (watcherId: string) => {
      const ms = localStreamRef.current;
      if (!ms) {
        // Camera not ready yet — queue the watcher
        pendingWatchers.push(watcherId);
        return;
      }
      const pc = createPeer(socket, watcherId);
      peersRef.current.set(watcherId, pc);
      ms.getTracks().forEach(track => {
        const sender = pc.addTrack(track, ms);
        if (track.kind === "video") {
          sender.setParameters({
            ...sender.getParameters(),
            encodings: [{ maxBitrate: quality === "1080p" ? 4_000_000 : quality === "720p" ? 2_500_000 : quality === "480p" ? 1_000_000 : 500_000, priority: "high" as RTCPriorityType }],
          }).catch(() => {});
        } else {
          sender.setParameters({ ...sender.getParameters(), encodings: [{ maxBitrate: 128_000 }] }).catch(() => {});
        }
      });
      pc.createOffer({ offerToReceiveAudio: false, offerToReceiveVideo: false })
        .then(offer => pc.setLocalDescription(offer).then(() => {
          socket.emit("offer", watcherId, pc.localDescription);
          startStats(pc);
        })).catch(() => {});
    });

    socket.on("answer", async (watcherId: string, desc: RTCSessionDescriptionInit) => {
      await peersRef.current.get(watcherId)?.setRemoteDescription(new RTCSessionDescription(desc));
    });

    socket.on("candidate", async (watcherId: string, candidate: RTCIceCandidateInit) => {
      try { await peersRef.current.get(watcherId)?.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
    });

    // ── Now get camera/mic ──
    try {
      let mediaStream: MediaStream;

      if (sourceMode === "screen") {
        const screenStream = await (navigator.mediaDevices as any).getDisplayMedia({
          video: { ...QUALITY_PRESETS[quality], cursor: "motion" },
          audio: true,
        });
        if (!screenStream.getAudioTracks().length) {
          const micStream = await navigator.mediaDevices.getUserMedia({ audio: HIGH_QUALITY_AUDIO });
          micStream.getAudioTracks().forEach(t => screenStream.addTrack(t));
        }
        mediaStream = screenStream;
      } else {
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: {
              ...QUALITY_PRESETS[quality],
              ...(selectedCamera ? { deviceId: { ideal: selectedCamera } } : { facingMode: { ideal: "user" } }),
            },
            audio: {
              ...HIGH_QUALITY_AUDIO,
              ...(selectedMic ? { deviceId: { ideal: selectedMic } } : {}),
            },
          });
        } catch {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user" },
            audio: HIGH_QUALITY_AUDIO,
          });
        }
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

      // Drain any watchers that joined while camera was starting
      for (const watcherId of pendingWatchers) {
        socket.emit("watcher-retry", watcherId); // trigger re-emit from server if needed
        const pc = createPeer(socket, watcherId);
        peersRef.current.set(watcherId, pc);
        mediaStream.getTracks().forEach(track => {
          const sender = pc.addTrack(track, mediaStream);
          if (track.kind === "video") {
            sender.setParameters({
              ...sender.getParameters(),
              encodings: [{ maxBitrate: quality === "1080p" ? 4_000_000 : quality === "720p" ? 2_500_000 : quality === "480p" ? 1_000_000 : 500_000, priority: "high" as RTCPriorityType }],
            }).catch(() => {});
          } else {
            sender.setParameters({ ...sender.getParameters(), encodings: [{ maxBitrate: 128_000 }] }).catch(() => {});
          }
        });
        const offer = await pc.createOffer({ offerToReceiveAudio: false, offerToReceiveVideo: false });
        await pc.setLocalDescription(offer);
        socket.emit("offer", watcherId, pc.localDescription);
        startStats(pc);
      }

      // Notify followers
      if (stream?.channelId) {
        const chRes = await fetch(`/api/channels/${stream.channelId}`).catch(() => null);
        if (chRes?.ok) {
          const ch = await chRes.json();
          const followerCount = ch?.subscriberCount || 0;
          if (followerCount > 0) {
            toast({ title: `🔔 تم إشعار ${followerCount} متابع`, description: "تم إرسال إشعار للمتابعين بأنك بدأت البث المباشر" });
          } else {
            toast({ title: "✅ البث مباشر الآن! شارك الرابط لتصل لجمهور أكبر 📡" });
          }
        }
      }

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
          videoRef.current.muted = false;
          videoRef.current.volume = 1;
          videoRef.current.play().then(() => {
            setViewerMuted(false);
            setAudioBlocked(false);
          }).catch(() => {
            // Autoplay with audio blocked — play muted first
            videoRef.current!.muted = true;
            videoRef.current!.play().catch(() => {});
            setViewerMuted(true);
            setAudioBlocked(true);
          });
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

  // ── Connect to co-host as a watcher (viewer/broadcaster side) ──
  // Only creates the PC and emits watcher event.
  // All socket signaling is handled in the top-level useEffect handlers below.
  const connectToCoHost = useCallback((socket: Socket, cohostSocketId: string) => {
    if (coHostPCRef.current) { coHostPCRef.current.close(); coHostPCRef.current = null; }
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    coHostPCRef.current = pc;
    pc.ontrack = (e) => {
      if (coHostVideoRef.current && e.streams[0]) {
        coHostVideoRef.current.srcObject = e.streams[0];
        setCoHostActive(true);
        coHostVideoRef.current.muted = false;
        coHostVideoRef.current.play().catch(() => {
          if (coHostVideoRef.current) { coHostVideoRef.current.muted = true; coHostVideoRef.current.play().catch(() => {}); }
        });
      }
    };
    pc.onicecandidate = (e) => {
      if (e.candidate) socket.emit("cohost-candidate", cohostSocketId, e.candidate);
    };
    // Tell co-host we want their stream
    socket.emit("cohost-watcher", { cohostId: cohostSocketId });
  }, []);

  useEffect(() => {
    streamStartRef.current = Date.now();
    const socket = io({ path: "/socket.io", transports: ["websocket"], upgrade: false });
    socketRef.current = socket;

    // NOTE: join-stream is emitted AFTER all handlers are registered (see below)
    socket.on("viewer-count", (count: number) => {
      setViewerCount(count);
      if (count > peakViewersRef.current) peakViewersRef.current = count;
    });
    socket.on("chat-message", (msg: ChatMsg) => setMessages(prev => [...prev, msg]));
    socket.on("stream-like", () => setLikesCount(prev => prev + 1));

    // ══════════════════════════════════════════════════════════
    // CO-HOST SIGNALING  (all handlers at top level — no nesting)
    // ══════════════════════════════════════════════════════════

    // Broadcaster receives a join-request from a viewer
    socket.on("cohost-request", (data: { socketId: string; userName: string }) => {
      setCohostRequest(data);
      toast({ title: `👤 ${data.userName} يطلب المشاركة في البث`, description: "يمكنك قبول أو رفض الطلب" });
    });

    // Guest (requesting viewer) got accepted — open camera & announce
    socket.on("cohost-accepted", async () => {
      isCoHostRef.current = true;
      setIsCoHost(true);
      setRequestingJoin(false);
      toast({ title: "✅ تم قبول طلبك! ستبدأ الكاميرا الآن" });
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: HIGH_QUALITY_AUDIO,
        });
        coHostStreamRef.current = mediaStream;
        // Show self-preview (muted so no echo)
        if (coHostVideoRef.current) {
          coHostVideoRef.current.srcObject = mediaStream;
          coHostVideoRef.current.muted = true;
          coHostVideoRef.current.play().catch(() => {});
        }
        setCoHostActive(true);
        // Tell server: I'm now a co-broadcaster, notify all viewers
        socket.emit("cohost-broadcaster", id);
      } catch (err: any) {
        isCoHostRef.current = false;
        setIsCoHost(false);
        toast({ variant: "destructive", title: "تعذّر فتح الكاميرا", description: err.message });
      }
    });

    socket.on("cohost-rejected", () => {
      setRequestingJoin(false);
      toast({ variant: "destructive", title: "❌ رُفض طلب المشاركة" });
    });

    // SERVER → viewer/broadcaster: a co-host just went live, connect to their stream
    socket.on("cohost-active", (cohostSocketId: string) => {
      setCoHostActive(true);
      if (!isCoHostRef.current) {
        // We're a viewer or the main broadcaster — pull the co-host stream
        connectToCoHost(socket, cohostSocketId);
      }
    });

    // ── CO-HOST sends stream to each watcher (viewer / broadcaster) ──
    // Triggered when a viewer emits cohost-watcher to the server
    socket.on("cohost-watcher", async (watcherId: string) => {
      if (!coHostStreamRef.current) return;  // only the active co-host handles this
      // Close any existing connection for this watcher
      const existing = cohostViewerPCsRef.current.get(watcherId);
      if (existing) { existing.close(); }
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      cohostViewerPCsRef.current.set(watcherId, pc);
      coHostStreamRef.current.getTracks().forEach(track =>
        pc.addTrack(track, coHostStreamRef.current!)
      );
      pc.onicecandidate = (e) => {
        if (e.candidate) socket.emit("cohost-candidate", watcherId, e.candidate);
      };
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("cohost-offer", watcherId, pc.localDescription);
      } catch {}
    });

    // ── VIEWER receives co-host's offer → answers it ──
    socket.on("cohost-offer", async (senderId: string, desc: RTCSessionDescriptionInit) => {
      // Self-heal: if PC was lost, recreate it
      if (!coHostPCRef.current) {
        const pc2 = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        coHostPCRef.current = pc2;
        pc2.ontrack = (e) => {
          if (coHostVideoRef.current && e.streams[0]) {
            coHostVideoRef.current.srcObject = e.streams[0];
            setCoHostActive(true);
            coHostVideoRef.current.muted = false;
            coHostVideoRef.current.play().catch(() => {
              if (coHostVideoRef.current) { coHostVideoRef.current.muted = true; coHostVideoRef.current.play().catch(() => {}); }
            });
          }
        };
        pc2.onicecandidate = (e) => {
          if (e.candidate) socket.emit("cohost-candidate", senderId, e.candidate);
        };
      }
      const pc = coHostPCRef.current;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(desc));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("cohost-answer", senderId, pc.localDescription);
      } catch (err) { console.warn("cohost-offer handling failed", err); }
    });

    // ── CO-HOST receives viewer's answer → finalises connection ──
    socket.on("cohost-answer", async (senderId: string, desc: RTCSessionDescriptionInit) => {
      const pc = cohostViewerPCsRef.current.get(senderId);
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription(desc)).catch(() => {});
    });

    // ── ICE candidates — route to the right PC ──
    socket.on("cohost-candidate", async (senderId: string, candidate: RTCIceCandidateInit) => {
      // If we're the co-host and this is from a viewer:
      const viewerPC = cohostViewerPCsRef.current.get(senderId);
      if (viewerPC) {
        await viewerPC.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
        return;
      }
      // If we're a viewer and this is from the co-host:
      if (coHostPCRef.current) {
        await coHostPCRef.current.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
      }
    });

    socket.on("cohost-left", () => {
      isCoHostRef.current = false;
      setCoHostActive(false);
      setIsCoHost(false);
      setCohostRequest(null);
      if (coHostVideoRef.current) coHostVideoRef.current.srcObject = null;
      coHostPCRef.current?.close();
      coHostPCRef.current = null;
      coHostStreamRef.current?.getTracks().forEach(t => t.stop());
      coHostStreamRef.current = null;
      // Close all viewer connections on co-host side
      cohostViewerPCsRef.current.forEach(pc => pc.close());
      cohostViewerPCsRef.current.clear();
      toast({ title: "👋 انتهت مشاركة الضيف" });
    });

    // ── TikTok-style Live Feature Listeners ──────────────────────
    socket.on("stream-gift", (data: LiveGift) => {
      // Update top gifters leaderboard
      setTopGifters(prev => {
        const idx = prev.findIndex(g => g.userId === data.userId);
        let updated;
        if (idx >= 0) {
          updated = prev.map((g, i) => i === idx
            ? { ...g, giftCount: g.giftCount + 1, totalCoins: g.totalCoins + data.giftCoins, lastEmoji: data.giftEmoji }
            : g
          );
        } else {
          updated = [...prev, { userName: data.userName, userId: data.userId, giftCount: 1, totalCoins: data.giftCoins, lastEmoji: data.giftEmoji }];
        }
        return updated.sort((a, b) => b.totalCoins - a.totalCoins).slice(0, 10);
      });
      // Floating gift animation
      const giftId = Date.now() + Math.random();
      const x = Math.random() * 60 + 20;
      setFloatingGifts(prev => [...prev, { id: giftId, emoji: data.giftEmoji, x }]);
      setTimeout(() => setFloatingGifts(prev => prev.filter(g => g.id !== giftId)), 3500);
      // Gift banner
      setRecentGiftBanner(data);
      setTimeout(() => setRecentGiftBanner(null), 5000);
    });

    socket.on("comment-pinned", (data: { message: string; userName: string }) => setPinnedComment(data));
    socket.on("comment-unpinned", () => setPinnedComment(null));

    socket.on("poll-created", (data: LivePoll) => { setLivePoll(data); setVotedPollOption(null); });
    socket.on("poll-ended", () => setLivePoll(null));
    socket.on("poll-updated", (data: { pollId: number; optionIndex: number }) => {
      setLivePoll(prev => {
        if (!prev || prev.id !== data.pollId) return prev;
        const options = prev.options.map((o, i) => i === data.optionIndex ? { ...o, votes: o.votes + 1 } : o);
        return { ...prev, options, totalVotes: prev.totalVotes + 1 };
      });
    });

    socket.on("new-follower", (data: { userName: string }) => {
      const fid = Date.now();
      setFollowerBanners(prev => [...prev, { id: fid, userName: data.userName }]);
      setTimeout(() => setFollowerBanners(prev => prev.filter(f => f.id !== fid)), 5000);
    });

    // ✅ join-stream emitted AFTER all handlers are ready
    // so cohost-active / viewer-count etc. don't arrive before their handlers
    socket.emit("join-stream", id);

    if (isBroadcast) {
      setupBroadcaster(socket);
    } else {
      setupWatcher(socket);
    }

    return () => {
      if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
      if (isCoHostRef.current) socket.emit("cohost-leave", id);
      socket.emit("leave-stream", id);
      socket.disconnect();
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      coHostStreamRef.current?.getTracks().forEach(t => t.stop());
      coHostPCRef.current?.close();
      cohostViewerPCsRef.current.forEach(pc => pc.close());
      cohostViewerPCsRef.current.clear();
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
      message: chatInput.trim(),
      isOwner: stream?.userId === user.id,
    });
    setChatInput("");
  };

  // ─── Voice Chat: Press & Hold ───────────────────────────────
  const handleChatMicPress = async (e: React.MouseEvent | React.TouchEvent | React.PointerEvent) => {
    e.preventDefault();
    if (!user) { window.location.href = "/login"; return; }
    if (chatHoldingRef.current || chatIsRecording) return;
    chatHoldingRef.current = true;
    try {
      const stream2 = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      // User may have released while permission dialog was open
      if (!chatHoldingRef.current) {
        stream2.getTracks().forEach(t => t.stop());
        return;
      }
      chatChunksRef.current = [];
      const mimeTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
      const mimeType = mimeTypes.find(m => MediaRecorder.isTypeSupported(m)) || "";
      const ext = mimeType.includes("mp4") ? "mp4" : mimeType.includes("ogg") ? "ogg" : "webm";
      const recorder = new MediaRecorder(stream2, mimeType ? { mimeType } : {});
      recorder.ondataavailable = ev => { if (ev.data.size > 0) chatChunksRef.current.push(ev.data); };
      recorder.onstop = async () => {
        stream2.getTracks().forEach(t => t.stop());
        if (chatTimerRef.current) clearInterval(chatTimerRef.current);
        if (chatWaveRef.current) clearInterval(chatWaveRef.current);
        setChatRecordSeconds(0); setChatWaveLevel(0);
        const blob = new Blob(chatChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (blob.size < 300) { toast({ title: "اضغط مطولاً للتسجيل 🎤" }); return; }
        setChatIsUploading(true);
        const formData = new FormData();
        formData.append("file", blob, `voice-${Date.now()}.${ext}`);
        try {
          const res = await fetch("/api/upload", { method: "POST", body: formData, credentials: "include" });
          if (!res.ok) throw new Error(`${res.status}`);
          const data = await res.json();
          if (!data.url) throw new Error("no url");
          socketRef.current?.emit("chat-message", {
            streamId: id,
            userId: user!.id,
            userName: user!.firstName || "مستخدم",
            message: "🎤 رسالة صوتية",
            isVoice: true,
            voiceUrl: data.url,
            isOwner: stream?.userId === user!.id,
          });
        } catch {
          toast({ variant: "destructive", title: "فشل إرسال الصوت" });
        } finally { setChatIsUploading(false); }
      };
      recorder.start(100);
      chatRecorderRef.current = recorder;
      setChatIsRecording(true);
      setChatRecordSeconds(0);
      chatTimerRef.current = setInterval(() => setChatRecordSeconds(s => s + 1), 1000);
      chatWaveRef.current = setInterval(() => setChatWaveLevel(Math.random()), 150);
    } catch (err: any) {
      chatHoldingRef.current = false;
      if (err?.name === "NotAllowedError") {
        toast({ variant: "destructive", title: "❌ اسمح للمتصفح بالميكروفون" });
      } else {
        toast({ variant: "destructive", title: "تعذّر تشغيل الميكروفون" });
      }
    }
  };

  const handleChatMicRelease = (e?: React.MouseEvent | React.TouchEvent | React.PointerEvent) => {
    e?.preventDefault();
    if (!chatHoldingRef.current) return;
    chatHoldingRef.current = false;
    setChatIsRecording(false);
    if (chatTimerRef.current) clearInterval(chatTimerRef.current);
    if (chatWaveRef.current) clearInterval(chatWaveRef.current);
    const rec = chatRecorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
  };

  const handleLike = () => {
    setLiked(l => !l);
    if (!liked) {
      setLikesCount(c => c + 1);
      socketRef.current?.emit("stream-like", id);
      // Floating hearts animation
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          const hid = Date.now() + Math.random();
          const x = Math.random() * 70 + 15;
          setFloatingHearts(prev => [...prev, { id: hid, x }]);
          setTimeout(() => setFloatingHearts(prev => prev.filter(h => h.id !== hid)), 3000);
        }, i * 150);
      }
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

  // ── TikTok Actions ────────────────────────────────────────────
  const sendGift = (gift: typeof GIFTS[0]) => {
    if (!user) { window.location.href = "/login"; return; }
    socketRef.current?.emit("send-gift", {
      streamId: id,
      giftType: gift.id,
      giftEmoji: gift.emoji,
      giftName: gift.name,
      giftCoins: gift.coins,
      userName: user.firstName || "مستخدم",
      userId: String(user.id),
    });
    setShowGiftsPanel(false);
    toast({ title: `أرسلت ${gift.emoji} ${gift.name}!`, description: `${gift.coins} عملة` });
  };

  const handleCreatePoll = () => {
    const validOptions = pollOptions.filter(o => o.trim());
    if (!pollQuestion.trim() || validOptions.length < 2) {
      toast({ variant: "destructive", title: "أدخل سؤالاً وخيارين على الأقل" }); return;
    }
    socketRef.current?.emit("create-poll", { streamId: id, question: pollQuestion.trim(), options: validOptions });
    setPollQuestion(""); setPollOptions(["", ""]); setShowPollCreator(false);
    toast({ title: "✅ تم إنشاء الاستطلاع" });
  };

  const handleVotePoll = (optionIndex: number) => {
    if (votedPollOption !== null || !livePoll) return;
    setVotedPollOption(optionIndex);
    socketRef.current?.emit("vote-poll", { streamId: id, pollId: livePoll.id, optionIndex });
  };

  const handlePinMessage = (msg: ChatMsg) => {
    socketRef.current?.emit("pin-comment", { streamId: id, message: msg.message, userName: msg.userName });
    toast({ title: "📌 تم تثبيت التعليق" });
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

  // ── Format duration ──────────────────────────────────────────
  const fmtDuration = (sec: number) => {
    const h = Math.floor(sec / 3600); const m = Math.floor((sec % 3600) / 60); const s = sec % 60;
    return h > 0 ? `${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}` : `${m}:${String(s).padStart(2,"0")}`;
  };

  return (
    <div className="container px-4 py-6" dir="rtl">
      <style>{`
        @keyframes floatUp {
          0%   { transform: translateY(0) scale(1); opacity: 1; }
          70%  { transform: translateY(-160px) scale(1.3) rotate(10deg); opacity: 0.8; }
          100% { transform: translateY(-250px) scale(0.5); opacity: 0; }
        }
        @keyframes slideInLeft {
          from { transform: translateX(-30px); opacity: 0; }
          to   { transform: translateX(0); opacity: 1; }
        }
      `}</style>

      {/* ── Post-Stream Summary Modal ── */}
      {showSummary && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border" dir="rtl">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Trophy className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-extrabold mb-1">انتهى البث 🎉</h2>
            <p className="text-muted-foreground text-sm mb-6">إليك ملخص بث "{stream?.title}"</p>
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-muted/50 rounded-2xl p-4">
                <Clock className="w-5 h-5 text-blue-500 mx-auto mb-1" />
                <div className="text-xl font-bold">{fmtDuration(summary.duration)}</div>
                <div className="text-xs text-muted-foreground">مدة البث</div>
              </div>
              <div className="bg-muted/50 rounded-2xl p-4">
                <Eye className="w-5 h-5 text-green-500 mx-auto mb-1" />
                <div className="text-xl font-bold">{summary.peakViewers}</div>
                <div className="text-xs text-muted-foreground">أعلى عدد مشاهدين</div>
              </div>
              <div className="bg-muted/50 rounded-2xl p-4">
                <Heart className="w-5 h-5 text-red-500 mx-auto mb-1" />
                <div className="text-xl font-bold">{summary.totalLikes}</div>
                <div className="text-xs text-muted-foreground">إجمالي اللايكات</div>
              </div>
              <div className="bg-muted/50 rounded-2xl p-4">
                <MessageCircle className="w-5 h-5 text-purple-500 mx-auto mb-1" />
                <div className="text-xl font-bold">{summary.totalComments}</div>
                <div className="text-xs text-muted-foreground">رسائل الشات</div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => { setShowSummary(false); window.location.href = "/channels"; }}>
                العودة للقنوات
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => { setShowSummary(false); window.location.href = "/my-content"; }}>
                محتواي
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">

        {/* ── Video Area ── */}
        <div className="flex-1">
          {/* Co-host request popup (for broadcaster) */}
          {isBroadcast && cohostRequest && (
            <div className="mb-3 p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 flex items-center gap-3" dir="rtl">
              <UserPlus className="w-5 h-5 text-blue-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-bold text-sm">👤 {cohostRequest.userName} يطلب المشاركة في البث</p>
                <p className="text-xs text-muted-foreground">سيظهر صوته وصورته جانباً مع البث</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    socketRef.current?.emit("accept-cohost", { streamId: id, guestSocketId: cohostRequest.socketId });
                    setCoHostName(cohostRequest.userName);
                    setCohostRequest(null);
                    toast({ title: "✅ تم قبول الضيف" });
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-green-500 text-white text-xs font-bold hover:bg-green-600 transition"
                  data-testid="btn-accept-cohost"
                >
                  <UserCheck className="w-3.5 h-3.5" /> قبول
                </button>
                <button
                  onClick={() => {
                    socketRef.current?.emit("reject-cohost", { guestSocketId: cohostRequest.socketId });
                    setCohostRequest(null);
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-500 text-white text-xs font-bold hover:bg-red-600 transition"
                  data-testid="btn-reject-cohost"
                >
                  <UserX className="w-3.5 h-3.5" /> رفض
                </button>
              </div>
            </div>
          )}

          {/* Dual video area when co-host is active */}
          <div className={`${coHostActive ? "grid grid-cols-2 gap-2" : ""}`}>
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

            {/* 🔊 Enable Audio Button for viewers (browser blocks autoplay with audio) */}
            {!isBroadcast && streaming && (audioBlocked || viewerMuted) && (
              <button
                onClick={() => {
                  if (videoRef.current) {
                    videoRef.current.muted = false;
                    videoRef.current.volume = 1;
                    videoRef.current.play().then(() => {
                      setViewerMuted(false);
                      setAudioBlocked(false);
                    }).catch(() => {});
                  }
                }}
                className="absolute bottom-4 start-4 flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/20 backdrop-blur border border-white/30 text-white text-sm font-bold hover:bg-white/30 transition animate-pulse"
                data-testid="btn-enable-audio"
              >
                <Volume2 className="w-4 h-4 text-yellow-300" />
                انقر لتفعيل الصوت
              </button>
            )}

            {/* ── TikTok Floating Hearts ── */}
            {floatingHearts.map(h => (
              <div key={h.id} className="absolute bottom-20 pointer-events-none select-none text-2xl"
                style={{ left: `${h.x}%`, animation: "floatUp 3s ease-out forwards" }}>
                ❤️
              </div>
            ))}

            {/* ── TikTok Floating Gifts ── */}
            {floatingGifts.map(g => (
              <div key={g.id} className="absolute bottom-24 pointer-events-none select-none text-3xl"
                style={{ left: `${g.x}%`, animation: "floatUp 3.5s ease-out forwards", filter: "drop-shadow(0 0 8px gold)" }}>
                {g.emoji}
              </div>
            ))}

            {/* ── Recent Gift Banner (bottom-left) ── */}
            {recentGiftBanner && (
              <div className="absolute bottom-16 start-4 flex items-center gap-2 bg-black/70 backdrop-blur rounded-full px-4 py-2 border border-yellow-500/40 text-white text-sm font-bold"
                style={{ animation: "slideInLeft 0.4s ease-out" }}>
                <span className="text-2xl">{recentGiftBanner.giftEmoji}</span>
                <span>{recentGiftBanner.userName}</span>
                <span className="text-yellow-400">أرسل {recentGiftBanner.giftName}</span>
              </div>
            )}

            {/* ── Follower Banners (top-left) ── */}
            <div className="absolute top-14 start-4 flex flex-col gap-1">
              {followerBanners.slice(-3).map(f => (
                <div key={f.id} className="flex items-center gap-2 bg-black/70 backdrop-blur rounded-full px-3 py-1.5 text-white text-xs font-medium"
                  style={{ animation: "slideInLeft 0.4s ease-out" }}>
                  <span className="text-pink-400">💗</span> {f.userName} تابع المضيف
                </div>
              ))}
            </div>

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

                  {/* Poll Creator Toggle */}
                  <button
                    onClick={() => setShowPollCreator(v => !v)}
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-lg ${showPollCreator ? "bg-purple-500 text-white scale-110" : "bg-white/20 backdrop-blur text-white hover:bg-white/30"}`}
                    title="إنشاء استطلاع"
                  >
                    <TrendingUp className="w-5 h-5" />
                  </button>

                  {/* End stream */}
                  <button
                    onClick={() => endStreamMutation.mutate()}
                    className="px-5 h-12 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center gap-2 font-bold shadow-lg transition"
                  >
                    <PhoneOff className="w-5 h-5" /> إنهاء البث
                  </button>

                  {/* Share Button — toggles share panel */}
                  <button
                    onClick={() => setShowSharePanel(v => !v)}
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-lg ${showSharePanel ? "bg-white text-gray-900 scale-110" : "bg-white/20 backdrop-blur text-white hover:bg-white/30"}`}
                    title="شارك البث"
                    data-testid="btn-broadcast-share"
                  >
                    <Share2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}

            {/* ── Share Panel (slides up from bottom of video) ── */}
            {showSharePanel && (() => {
              const shareUrl = window.location.href.replace("?mode=broadcast", "").replace("&mode=broadcast", "");
              const shareTitle = encodeURIComponent(stream?.title || "بث مباشر على سوق");
              const shareUrlEnc = encodeURIComponent(shareUrl);
              const platforms = [
                { name: "واتساب", color: "bg-[#25D366] text-white", href: `https://api.whatsapp.com/send?text=${shareTitle}%20${shareUrlEnc}`, icon: "💬" },
                { name: "فيسبوك", color: "bg-[#1877F2] text-white", href: `https://www.facebook.com/sharer/sharer.php?u=${shareUrlEnc}`, icon: "👥" },
                { name: "تيليجرام", color: "bg-[#229ED9] text-white", href: `https://t.me/share/url?url=${shareUrlEnc}&text=${shareTitle}`, icon: "✈️" },
                { name: "تويتر X", color: "bg-black text-white", href: `https://twitter.com/intent/tweet?url=${shareUrlEnc}&text=${shareTitle}`, icon: "𝕏" },
              ];
              return (
                <div className="absolute bottom-0 inset-x-0 bg-black/90 backdrop-blur-md p-4 rounded-b-3xl z-30">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-white font-bold text-sm flex items-center gap-2">
                      <Share2 className="w-4 h-4 text-red-400" /> شارك البث المباشر
                    </p>
                    <button onClick={() => setShowSharePanel(false)} className="text-white/60 hover:text-white transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {/* Social Platforms */}
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    {platforms.map(p => (
                      <a key={p.name} href={p.href} target="_blank" rel="noopener noreferrer"
                        onClick={() => setShowSharePanel(false)}
                        className={`${p.color} flex flex-col items-center gap-1.5 rounded-xl py-2.5 px-1 text-center transition-opacity hover:opacity-90`}
                      >
                        <span className="text-xl leading-none">{p.icon}</span>
                        <span className="text-[10px] font-semibold">{p.name}</span>
                      </a>
                    ))}
                  </div>
                  {/* Copyable URL */}
                  <div className="flex items-center gap-2 bg-white/10 rounded-xl px-3 py-2">
                    <span className="text-white/70 text-xs truncate flex-1 font-mono">{shareUrl}</span>
                    <button
                      onClick={() => { navigator.clipboard.writeText(shareUrl); toast({ title: "✅ تم نسخ رابط البث!" }); setShowSharePanel(false); }}
                      className="bg-primary text-white text-xs px-3 py-1.5 rounded-lg font-bold whitespace-nowrap hover:bg-primary/90 transition-colors"
                      data-testid="btn-copy-stream-link"
                    >نسخ الرابط</button>
                  </div>
                  <p className="text-white/40 text-[10px] text-center mt-2">
                    سيصل إشعار لكل متابعيك تلقائياً عند بدء البث 🔔
                  </p>
                </div>
              );
            })()}
          </div>

          {/* Co-host video (shown when active) */}
          {coHostActive && (
            <div className="relative rounded-3xl overflow-hidden bg-black shadow-2xl shadow-black/50" style={{ aspectRatio: "16/9" }}>
              <video
                ref={coHostVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-contain"
                style={{ backgroundColor: "#000" }}
              />
              <div className="absolute top-3 start-3">
                <Badge className="bg-purple-600 text-white gap-1 px-3 py-1 text-xs font-bold shadow-lg">
                  <Users className="w-3 h-3" /> {coHostName || "ضيف"}
                </Badge>
              </div>
              {/* Co-host controls (for isCoHost) */}
              {isCoHost && (
                <div className="absolute bottom-4 inset-x-0 flex items-center justify-center gap-3">
                  <button
                    onClick={() => {
                      if (coHostStreamRef.current) {
                        const aTrack = coHostStreamRef.current.getAudioTracks()[0];
                        if (aTrack) { aTrack.enabled = !aTrack.enabled; setCoHostMuted(!aTrack.enabled); }
                      }
                    }}
                    className={`w-11 h-11 rounded-full flex items-center justify-center shadow-lg transition-all ${coHostMuted ? "bg-red-500 text-white" : "bg-white/20 backdrop-blur text-white hover:bg-white/30"}`}
                  >
                    {coHostMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => {
                      if (coHostStreamRef.current) {
                        const vTrack = coHostStreamRef.current.getVideoTracks()[0];
                        if (vTrack) { vTrack.enabled = !vTrack.enabled; setCoHostVideoOff(!vTrack.enabled); }
                      }
                    }}
                    className={`w-11 h-11 rounded-full flex items-center justify-center shadow-lg transition-all ${coHostVideoOff ? "bg-red-500 text-white" : "bg-white/20 backdrop-blur text-white hover:bg-white/30"}`}
                  >
                    {coHostVideoOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => {
                      socketRef.current?.emit("cohost-leave", id);
                      setIsCoHost(false);
                      setCoHostActive(false);
                      coHostStreamRef.current?.getTracks().forEach(t => t.stop());
                      coHostStreamRef.current = null;
                    }}
                    className="px-4 h-11 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center gap-1.5 text-xs font-bold shadow-lg transition"
                    data-testid="btn-leave-cohost"
                  >
                    <PhoneOff className="w-3.5 h-3.5" /> مغادرة
                  </button>
                </div>
              )}
            </div>
          )}
          </div>{/* end grid wrapper */}

          {/* Viewer: Request to join as co-host */}
          {!isBroadcast && streaming && !isCoHost && !coHostActive && user && (
            <div className="mt-3 flex justify-center">
              <button
                onClick={() => {
                  if (requestingJoin) return;
                  setRequestingJoin(true);
                  socketRef.current?.emit("request-cohost", {
                    streamId: id,
                    userId: (user as any).id,
                    userName: `${(user as any).firstName || ""} ${(user as any).lastName || ""}`.trim() || "مشاهد",
                  });
                  toast({ title: "⏳ تم إرسال طلب المشاركة، انتظر موافقة المذيع" });
                }}
                disabled={requestingJoin}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-l from-purple-600 to-blue-600 text-white font-bold text-sm shadow-lg hover:opacity-90 transition disabled:opacity-60"
                data-testid="btn-request-cohost"
              >
                <UserPlus className="w-4 h-4" />
                {requestingJoin ? "جاري انتظار الموافقة..." : "طلب المشاركة في البث"}
              </button>
            </div>
          )}

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
              <div onClick={e => e.stopPropagation()}>
                <ShareMenu
                  url={window.location.href.replace("mode=broadcast", "")}
                  title={stream?.title || "بث مباشر على سوق"}
                  description={stream?.description || ""}
                  variant="outline"
                  size="sm"
                  label="مشاركة"
                  data-testid="btn-stream-share"
                />
              </div>
            </div>
          </div>

          {/* ── Poll Creator (broadcaster only) ── */}
          {isBroadcast && showPollCreator && (
            <div className="mt-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-2xl p-4" dir="rtl">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-sm flex items-center gap-2 text-purple-700 dark:text-purple-300">
                  <TrendingUp className="w-4 h-4" /> إنشاء استطلاع مباشر
                </h3>
                {livePoll && (
                  <button onClick={() => { socketRef.current?.emit("end-poll", id); setLivePoll(null); }}
                    className="text-xs px-3 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 hover:bg-red-200 transition">
                    إنهاء الاستطلاع الحالي
                  </button>
                )}
              </div>
              <input value={pollQuestion} onChange={e => setPollQuestion(e.target.value)}
                placeholder="اكتب سؤال الاستطلاع..."
                className="w-full h-9 rounded-xl border border-border px-3 text-sm mb-2 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-400" />
              {pollOptions.map((opt, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input value={opt} onChange={e => { const o = [...pollOptions]; o[i] = e.target.value; setPollOptions(o); }}
                    placeholder={`الخيار ${i + 1}`}
                    className="flex-1 h-9 rounded-xl border border-border px-3 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-400" />
                  {i >= 2 && <button onClick={() => setPollOptions(prev => prev.filter((_, j) => j !== i))} className="text-red-500 hover:text-red-700 text-lg leading-none">×</button>}
                </div>
              ))}
              <div className="flex gap-2 mt-2">
                {pollOptions.length < 4 && (
                  <button onClick={() => setPollOptions(prev => [...prev, ""])}
                    className="text-xs px-3 py-1.5 rounded-full border border-purple-300 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition">
                    + إضافة خيار
                  </button>
                )}
                <button onClick={handleCreatePoll}
                  className="flex-1 h-9 rounded-xl bg-purple-600 text-white text-sm font-bold hover:bg-purple-700 transition">
                  إطلاق الاستطلاع 🚀
                </button>
              </div>
            </div>
          )}

          {/* ── Live Poll (viewers) ── */}
          {livePoll && !isBroadcast && (
            <div className="mt-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-2xl p-4" dir="rtl">
              <h3 className="font-bold text-sm text-purple-700 dark:text-purple-300 mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" /> استطلاع مباشر
              </h3>
              <p className="font-semibold mb-3">{livePoll.question}</p>
              <div className="space-y-2">
                {livePoll.options.map((opt, i) => {
                  const pct = livePoll.totalVotes > 0 ? Math.round((opt.votes / livePoll.totalVotes) * 100) : 0;
                  return (
                    <button key={i} onClick={() => handleVotePoll(i)} disabled={votedPollOption !== null}
                      className={`w-full relative flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition border overflow-hidden ${
                        votedPollOption === i ? "border-purple-500 bg-purple-100 dark:bg-purple-900/40 text-purple-700" :
                        votedPollOption !== null ? "border-border bg-muted/30 opacity-70 cursor-not-allowed" :
                        "border-border hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 cursor-pointer"
                      }`}>
                      {votedPollOption !== null && (
                        <div className="absolute inset-y-0 start-0 bg-purple-300/30 dark:bg-purple-700/30 rounded-xl transition-all" style={{ width: `${pct}%` }} />
                      )}
                      <span className="relative">{opt.text}</span>
                      {votedPollOption !== null && <span className="relative font-bold text-purple-600">{pct}%</span>}
                    </button>
                  );
                })}
              </div>
              {livePoll.totalVotes > 0 && (
                <p className="text-xs text-muted-foreground mt-2 text-center">{livePoll.totalVotes} صوت</p>
              )}
            </div>
          )}

          {/* ── إعلان مدمج للمشاهدين ─────────────────────── */}
          {!isBroadcast && (
            <AdWidget variant="banner" className="mt-4" refreshInterval={20000} />
          )}

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

          {/* ── Top Gifters Leaderboard ── */}
          {topGifters.length > 0 && (
            <div className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950/20 dark:to-orange-950/20 border border-yellow-200 dark:border-yellow-800 rounded-2xl p-3" dir="rtl">
              <h3 className="text-xs font-bold text-yellow-700 dark:text-yellow-400 mb-2 flex items-center gap-1">
                <Trophy className="w-3.5 h-3.5" /> أكثر المُهدين
              </h3>
              <div className="space-y-1.5">
                {topGifters.slice(0, 5).map((g, i) => (
                  <div key={g.userId} className="flex items-center gap-2">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 ${
                      i === 0 ? "bg-yellow-500" : i === 1 ? "bg-gray-400" : i === 2 ? "bg-amber-600" : "bg-muted-foreground"
                    }`}>{i + 1}</span>
                    <span className="text-lg">{g.lastEmoji}</span>
                    <span className="text-xs font-medium flex-1 truncate">{g.userName}</span>
                    <span className="text-[10px] text-yellow-600 font-bold">{g.totalCoins} 🪙</span>
                  </div>
                ))}
              </div>
            </div>
          )}

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
              {/* Pinned Comment */}
              {pinnedComment && (
                <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-300 dark:border-yellow-700 rounded-xl px-3 py-2 mb-2 flex items-start gap-2" dir="rtl">
                  <span className="text-sm">📌</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-bold text-yellow-700 dark:text-yellow-400">{pinnedComment.userName}: </span>
                    <span className="text-xs text-foreground">{pinnedComment.message}</span>
                  </div>
                  {isBroadcast && (
                    <button onClick={() => { socketRef.current?.emit("unpin-comment", id); setPinnedComment(null); }}
                      className="text-yellow-600 hover:text-yellow-800 text-sm leading-none flex-shrink-0">×</button>
                  )}
                </div>
              )}

              {messages.length === 0 && (
                <div className="text-center text-muted-foreground text-xs pt-8">
                  لا توجد رسائل بعد... كن أول من يتفاعل! 💬
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className="group flex items-start gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 mt-0.5 ${msg.isOwner ? "bg-red-500" : "bg-gradient-to-br from-primary to-secondary"}`}>
                    {msg.isOwner ? "🎙" : msg.userName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className={`text-[11px] font-bold ${msg.isOwner ? "text-red-500" : "text-primary"}`}>
                      {msg.userName}{msg.isOwner ? " 🔴" : ""}{" "}
                    </span>
                    {msg.isVoice && msg.voiceUrl ? (
                      <span className="flex items-center gap-1 flex-wrap mt-0.5">
                        <span className="text-[10px] text-muted-foreground">🎤</span>
                        <audio
                          controls
                          src={msg.voiceUrl}
                          className="h-6 max-w-[160px]"
                          style={{ height: 24 }}
                        />
                        {/* Owner can reply with voice to this voice message */}
                        {user && stream?.userId === user.id && !msg.isOwner && (
                          <button
                            onPointerDown={handleChatMicPress}
                            onPointerUp={handleChatMicRelease}
                            onPointerLeave={handleChatMicRelease}
                            onPointerCancel={handleChatMicRelease}
                            onContextMenu={e => e.preventDefault()}
                            style={{ touchAction: "none", userSelect: "none" }}
                            className="text-[9px] px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-600 border border-red-200 dark:border-red-800 hover:bg-red-200 transition-all"
                          >
                            {chatIsRecording ? "🔴 جارٍ..." : "رد بصوتك"}
                          </button>
                        )}
                      </span>
                    ) : (
                      <span className="text-sm text-foreground break-words">{msg.message}</span>
                    )}
                  </div>
                  {/* Pin button (broadcaster only, on non-voice messages) */}
                  {isBroadcast && !msg.isVoice && (
                    <button onClick={() => handlePinMessage(msg)}
                      className="opacity-0 group-hover:opacity-100 flex-shrink-0 text-[9px] px-1.5 py-0.5 rounded text-muted-foreground hover:text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-all"
                      title="تثبيت">📌</button>
                  )}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Voice Recording Status */}
            {(chatIsRecording || chatIsUploading) && (
              <div className={`mx-3 mb-1 flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium ${
                chatIsUploading
                  ? "bg-blue-50 dark:bg-blue-950/30 text-blue-600 border border-blue-200"
                  : "bg-red-50 dark:bg-red-950/30 text-red-600 border border-red-200"
              }`}>
                {chatIsUploading ? (
                  <><span className="w-2 h-2 rounded-full bg-blue-500 animate-ping inline-block" /> جارٍ إرسال الصوت...</>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block" />
                    🎤 {chatRecordSeconds}ث — ارفع إصبعك للإرسال
                    <div className="flex items-end gap-0.5 h-3 ms-1">
                      {[0.3, 0.7, 0.5, 1, 0.6].map((b, j) => (
                        <div key={j} className="w-0.5 bg-red-500 rounded-full transition-all duration-100"
                          style={{ height: `${Math.max(20, (b * chatWaveLevel + b * 0.5) * 100)}%` }} />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="p-3 border-t bg-muted/10 space-y-2">
              {user ? (
                <>
                  {/* Gifts Panel */}
                  {showGiftsPanel && (
                    <div className="bg-card border border-border rounded-2xl p-3 mb-1" dir="rtl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-foreground">أرسل هدية 🎁</span>
                        <button onClick={() => setShowGiftsPanel(false)} className="text-muted-foreground hover:text-foreground text-lg leading-none">×</button>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {GIFTS.map(gift => (
                          <button key={gift.id} onClick={() => sendGift(gift)}
                            className="flex flex-col items-center gap-0.5 p-2 rounded-xl hover:bg-yellow-50 dark:hover:bg-yellow-900/20 border border-transparent hover:border-yellow-200 dark:hover:border-yellow-800 transition group">
                            <span className="text-2xl group-hover:scale-110 transition-transform">{gift.emoji}</span>
                            <span className="text-[9px] text-foreground font-medium">{gift.name}</span>
                            <span className="text-[8px] text-yellow-600">{gift.coins}🪙</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex gap-1.5">
                    {/* Gift Toggle */}
                    <button
                      onClick={() => setShowGiftsPanel(v => !v)}
                      className={`h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${showGiftsPanel ? "bg-yellow-500 text-white scale-110" : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 hover:bg-yellow-200 dark:hover:bg-yellow-800/30"}`}
                      title="أرسل هدية"
                      data-testid="btn-gifts">
                      🎁
                    </button>
                    <Input
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendChat()}
                      placeholder="رسالة أو 🎤 اضغط مطولاً..."
                      className="flex-1 h-9 text-sm rounded-full"
                      maxLength={200}
                      disabled={chatIsRecording || chatIsUploading}
                    />
                    {/* 🎤 Press & Hold Mic — pointer events cover mouse & touch */}
                    <button
                      onPointerDown={handleChatMicPress}
                      onPointerUp={handleChatMicRelease}
                      onPointerLeave={handleChatMicRelease}
                      onPointerCancel={handleChatMicRelease}
                      onContextMenu={e => e.preventDefault()}
                      disabled={chatIsUploading}
                      style={{ touchAction: "none", userSelect: "none" }}
                      className={`h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                        chatIsRecording
                          ? "bg-red-500 text-white scale-110 shadow-lg shadow-red-300"
                          : "bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30"
                      } disabled:opacity-50`}
                      title="اضغط مطولاً للتسجيل الصوتي"
                      data-testid="btn-stream-voice"
                    >
                      {chatIsRecording ? <span className="text-sm animate-pulse">🎙️</span> : <Mic className="w-4 h-4" />}
                    </button>
                    {/* Send Text */}
                    <Button size="sm" onClick={sendChat} disabled={!chatInput.trim() || chatIsRecording} className="h-9 w-9 p-0 rounded-full">
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-[9px] text-muted-foreground text-center">🎁 أرسل هدية · 🎤 اضغط مطولاً للتسجيل</p>
                </>
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
