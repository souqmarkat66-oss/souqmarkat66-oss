import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useSearch, useLocation } from "wouter";
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
  UserPlus, UserCheck, UserX, Trophy, Clock, TrendingUp,
  ChevronUp, ChevronDown, UserCircle2, Bell, BellOff, Wand2
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

const LIVE_FILTERS = [
  { id: "none",     name: "بدون",        emoji: "🚫", css: "none" },
  { id: "beauty",   name: "جمال",        emoji: "✨", css: "brightness(1.12) contrast(0.9) saturate(1.15)" },
  { id: "warm",     name: "دافئ",        emoji: "🌅", css: "sepia(0.35) saturate(1.6) brightness(1.05)" },
  { id: "cool",     name: "بارد",        emoji: "🧊", css: "hue-rotate(195deg) saturate(1.4) brightness(1.05)" },
  { id: "vintage",  name: "كلاسيك",      emoji: "📷", css: "sepia(0.55) contrast(1.1) brightness(0.9) saturate(0.8)" },
  { id: "dramatic", name: "درامي",       emoji: "🎭", css: "contrast(1.5) saturate(1.3) brightness(0.85)" },
  { id: "bw",       name: "أبيض وأسود", emoji: "🖤", css: "grayscale(1) contrast(1.2)" },
  { id: "vivid",    name: "زاهي",        emoji: "🌈", css: "saturate(2.2) contrast(1.1) brightness(1.05)" },
  { id: "rose",     name: "وردي",        emoji: "🌸", css: "sepia(0.3) hue-rotate(300deg) saturate(1.8) brightness(1.05)" },
  { id: "night",    name: "ليلي",        emoji: "🌙", css: "brightness(0.65) contrast(1.4) saturate(0.7)" },
  { id: "golden",   name: "ذهبي",        emoji: "🥇", css: "sepia(0.4) saturate(2) hue-rotate(10deg) brightness(1.1)" },
  { id: "soft",     name: "ناعم",        emoji: "🌫️", css: "brightness(1.2) saturate(0.75) contrast(0.85)" },
] as const;

type FilterId = typeof LIVE_FILTERS[number]["id"];

const HIGH_QUALITY_AUDIO = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  sampleRate: 48000,
  channelCount: 1,
  latency: 0,
};


const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
  { urls: "stun:stun4.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
  { urls: "stun:stun.relay.metered.ca:80" },
  // TURN relay servers for NAT traversal (mobile networks, symmetric NAT)
  {
    urls: "turn:openrelay.metered.ca:80",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turn:openrelay.metered.ca:443",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turns:openrelay.metered.ca:443",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turn:standard.relay.metered.ca:80",
    username: "e8dd65f14a5b9ded8f8dea53",
    credential: "uBVhDd7gfhD3UJYX",
  },
  {
    urls: "turns:standard.relay.metered.ca:443",
    username: "e8dd65f14a5b9ded8f8dea53",
    credential: "uBVhDd7gfhD3UJYX",
  },
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
  const [viewerDisconnected, setViewerDisconnected] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const statsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ── Co-host states ──────────────────────────────────────────
  // Maps socketId → resources for watching co-host streams
  const coHostVideoEls     = useRef<Map<string, HTMLVideoElement>>(new Map()); // callback refs
  const coHostPCsRef       = useRef<Map<string, RTCPeerConnection>>(new Map()); // watching PCs
  const myCoHostStreamRef  = useRef<MediaStream | null>(null); // MY stream (when I'm a co-host)
  const cohostViewerPCsRef = useRef<Map<string, RTCPeerConnection>>(new Map()); // my viewers' PCs
  const isCoHostRef        = useRef(false);          // ref version (for socket closures)
  // coHosts array: all active co-hosts in this room
  const [coHosts, setCoHosts]                   = useState<{ socketId: string; name: string }[]>([]);
  const [isCoHost, setIsCoHost]                 = useState(false);
  const [cohostRequests, setCohostRequests]     = useState<{ socketId: string; userName: string }[]>([]);
  const [requestingJoin, setRequestingJoin]     = useState(false);
  const [coHostMuted, setCoHostMuted]           = useState(false);
  const [coHostVideoOff, setCoHostVideoOff]     = useState(false);
  const [autoAccept, setAutoAccept]             = useState(false); // broadcaster: auto-accept mode
  const [roomAutoAccept, setRoomAutoAccept]     = useState(false); // viewer: room has auto-accept on
  const [showJoinDialog, setShowJoinDialog]     = useState(false); // viewer: entry join popup
  const streamStartRef = useRef<number>(Date.now());
  const peakViewersRef = useRef<number>(0);

  // ── Stream Recording (broadcaster only) ─────────────────────
  const streamRecorderRef  = useRef<MediaRecorder | null>(null);
  const streamChunksRef    = useRef<BlobPart[]>([]);
  const [isUploadingRec, setIsUploadingRec] = useState(false);

  // ── Camera Filter (broadcaster only) ─────────────────────────
  const rawVideoRef        = useRef<HTMLVideoElement>(null);
  const filterCanvasRef    = useRef<HTMLCanvasElement>(null);
  const filterRafRef       = useRef<number>(0);
  const currentFilterRef   = useRef<string>("none");
  const showTimeOverlayRef = useRef<boolean>(false);
  const [selectedFilter, setSelectedFilter] = useState<FilterId>("none");
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showTimeOverlay, setShowTimeOverlay] = useState(false);

  // ── Post-stream summary ─────────────────────────────────────
  const [showSummary, setShowSummary] = useState(false);
  const [summary, setSummary] = useState({ duration: 0, peakViewers: 0, totalLikes: 0, totalComments: 0, recordingUrl: "" });

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

  // ── TikTok Navigation & Interaction ─────────────────────────
  const [, setLocation] = useLocation();
  const [showUI, setShowUI]                     = useState(true);
  const [swipeDir, setSwipeDir]                 = useState<"up" | "down" | null>(null);
  const [doubleTapHearts, setDoubleTapHearts]   = useState<{ id: number; x: number; y: number }[]>([]);
  const touchStartYRef  = useRef<number>(0);
  const touchStartXRef  = useRef<number>(0);
  const lastTapTimeRef  = useRef<number>(0);
  const singleTapTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: allStreams } = useQuery<LiveStreamType[]>({
    queryKey: ["/api/streams"],
    queryFn: () => fetch("/api/streams").then(r => r.json()),
    enabled: !isBroadcast,
    refetchInterval: 30000,
  });

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
    mutationFn: async () => {
      let recordingUrl = "";
      const recorder = streamRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        setIsUploadingRec(true);
        // Stop recorder and collect final data
        recordingUrl = await new Promise<string>((resolve) => {
          recorder.onstop = async () => {
            try {
              const blob = new Blob(streamChunksRef.current, { type: recorder.mimeType || "video/webm" });
              if (blob.size > 0) {
                const form = new FormData();
                form.append("file", blob, `stream-${id}-${Date.now()}.webm`);
                const up = await fetch("/api/upload", { method: "POST", body: form, credentials: "include" });
                if (up.ok) {
                  const { url } = await up.json();
                  resolve(url || "");
                } else { resolve(""); }
              } else { resolve(""); }
            } catch { resolve(""); }
            setIsUploadingRec(false);
          };
          recorder.stop();
        });
      }
      return fetch(`/api/streams/${id}/end`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordingUrl }),
      }).then(r => r.json());
    },
    onSuccess: (data: any) => {
      const durationSec = Math.round((Date.now() - streamStartRef.current) / 1000);
      setSummary({
        duration: durationSec,
        peakViewers: peakViewersRef.current,
        totalLikes: likesCount,
        totalComments: messages.length,
        recordingUrl: data?.recordingUrl || "",
      });
      setShowSummary(true);
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

  // Sync filter selection → ref (so the RAF loop always reads the latest value)
  useEffect(() => {
    const f = LIVE_FILTERS.find(f => f.id === selectedFilter);
    currentFilterRef.current = f ? f.css : "none";
  }, [selectedFilter]);

  // Sync time overlay state → ref
  useEffect(() => {
    showTimeOverlayRef.current = showTimeOverlay;
  }, [showTimeOverlay]);

  // Build a canvas-filtered stream for WebRTC transmission only
  // The broadcaster preview always uses the raw stream directly (more reliable)
  const buildFilteredStream = useCallback((rawStream: MediaStream): MediaStream => {
    const rawVideo = rawVideoRef.current;
    const canvas   = filterCanvasRef.current;
    // If elements not ready or captureStream not supported → send raw stream
    if (!rawVideo || !canvas || typeof canvas.captureStream !== "function") return rawStream;

    const ctx = canvas.getContext("2d");
    if (!ctx) return rawStream;

    // Set initial dimensions so the stream has content from the start
    const vTracks = rawStream.getVideoTracks();
    const settings = vTracks[0]?.getSettings() || {};
    canvas.width  = settings.width  || 1280;
    canvas.height = settings.height || 720;

    // Start drawing immediately — don't wait for play() promise
    const drawFrame = () => {
      try {
        if (rawVideo.readyState >= 2 && rawVideo.videoWidth > 0) {
          if (canvas.width  !== rawVideo.videoWidth)  canvas.width  = rawVideo.videoWidth;
          if (canvas.height !== rawVideo.videoHeight) canvas.height = rawVideo.videoHeight;
          const filterCss = currentFilterRef.current;
          ctx.filter = filterCss === "none" ? "none" : filterCss;
          ctx.drawImage(rawVideo, 0, 0, canvas.width, canvas.height);
          // ── Time overlay ──────────────────────────────────────────
          if (showTimeOverlayRef.current) {
            ctx.filter = "none";
            const now      = new Date();
            const timeStr  = now.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
            const dateStr  = now.toLocaleDateString("ar-EG", { weekday: "short", year: "numeric", month: "short", day: "numeric" });
            const fontSize = Math.max(16, Math.round(canvas.width * 0.032));
            const padX     = Math.round(canvas.width  * 0.025);
            const padY     = Math.round(canvas.height * 0.025);
            const boxW     = Math.round(canvas.width  * 0.38);
            const boxH     = fontSize * 2.8;
            const boxX     = canvas.width - boxW - padX;
            ctx.fillStyle  = "rgba(0,0,0,0.55)";
            ctx.beginPath();
            ctx.roundRect(boxX, padY, boxW, boxH, 10);
            ctx.fill();
            ctx.textAlign    = "right";
            ctx.textBaseline = "top";
            ctx.fillStyle    = "#ffffff";
            ctx.font         = `bold ${fontSize}px Arial`;
            ctx.fillText(timeStr, canvas.width - padX - 8, padY + 6);
            ctx.fillStyle    = "rgba(255,255,255,0.75)";
            ctx.font         = `${Math.round(fontSize * 0.65)}px Arial`;
            ctx.fillText(dateStr, canvas.width - padX - 8, padY + fontSize + 10);
          }
        }
      } catch { /* ignore any draw errors */ }
      filterRafRef.current = requestAnimationFrame(drawFrame);
    };

    // Attach raw stream to the hidden video and start loop after play
    rawVideo.srcObject  = rawStream;
    rawVideo.muted      = true;
    rawVideo.playsInline = true;
    rawVideo.play()
      .then(() => { filterRafRef.current = requestAnimationFrame(drawFrame); })
      .catch(() => { filterRafRef.current = requestAnimationFrame(drawFrame); }); // start anyway

    try {
      const canvasStream = canvas.captureStream(30);
      rawStream.getAudioTracks().forEach(t => canvasStream.addTrack(t));
      return canvasStream;
    } catch {
      return rawStream; // captureStream not supported → fall back
    }
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
        .then(async offer => {
          await pc.setLocalDescription(offer);
          socket.emit("offer", watcherId, pc.localDescription);
          startStats(pc);
        }).catch(() => {});
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

      // Build filtered stream for WebRTC transmission (canvas-based)
      // Preview always shows the raw camera directly for reliability
      const transmitStream = sourceMode === "camera"
        ? buildFilteredStream(mediaStream)
        : mediaStream;

      localStreamRef.current = transmitStream; // WebRTC uses filtered/canvas stream

      if (videoRef.current) {
        // Broadcaster preview: always use raw camera — CSS filter applied via style in JSX
        videoRef.current.srcObject = mediaStream;
        videoRef.current.muted = true;
        videoRef.current.play().catch(() => {});
      }
      setStreaming(true);
      setConnected(true);

      socket.emit("broadcaster", id);
      await fetch(`/api/streams/${id}/start`, { method: "POST", credentials: "include" });

      // ── Start recording stream ────────────────────────────────
      try {
        streamChunksRef.current = [];
        const mimeOpts = ["video/webm;codecs=vp9,opus","video/webm;codecs=vp8,opus","video/webm","video/mp4"];
        const mime = mimeOpts.find(m => MediaRecorder.isTypeSupported(m)) || "";
        const recorder = new MediaRecorder(mediaStream, mime ? { mimeType: mime } : {});
        recorder.ondataavailable = (e) => { if (e.data.size > 0) streamChunksRef.current.push(e.data); };
        recorder.start(1000);
        streamRecorderRef.current = recorder;
      } catch { /* recording not supported – stream works normally */ }

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

    // FIXED: capture senderId from offer so we can route answer + ICE candidates correctly
    socket.on("offer", async (senderId: string, desc: RTCSessionDescriptionInit) => {
      // Close any previous connection
      peersRef.current.get("broadcaster")?.close();

      // Pass senderId as targetId so ICE candidates are sent to the right socket
      const pc = createPeer(socket, senderId);
      peersRef.current.set("broadcaster", pc);

      // ── Monitor ICE state for viewer reconnect ──
      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === "failed" || pc.iceConnectionState === "disconnected") {
          setViewerDisconnected(true);
          // Auto-retry after 3 seconds
          if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = setTimeout(() => {
            if (socket.connected) socket.emit("watcher", id);
          }, 3000);
        } else if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
          setViewerDisconnected(false);
          if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        }
      };

      pc.ontrack = (e) => {
        if (videoRef.current && e.streams[0]) {
          videoRef.current.srcObject = e.streams[0];
          videoRef.current.muted = false;
          videoRef.current.volume = 1;
          videoRef.current.play().then(() => {
            setViewerMuted(false);
            setAudioBlocked(false);
            setViewerDisconnected(false);
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

      await pc.setRemoteDescription(new RTCSessionDescription(desc));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      // FIXED: send answer to real broadcaster socket ID, not the string "broadcaster"
      socket.emit("answer", senderId, pc.localDescription);
    });

    // FIXED: moved outside offer handler — registered once, routes ICE to the right PC
    socket.on("candidate", async (_senderId: string, candidate: RTCIceCandidateInit) => {
      try {
        await peersRef.current.get("broadcaster")?.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {}
    });
  }, [id, createPeer]);

  // ── Connect to a co-host as watcher (viewer/broadcaster side) ──
  // Creates a dedicated PC per co-host socket and registers a callback ref for the video element.
  const connectToCoHost = useCallback((socket: Socket, cohostSocketId: string, cohostName?: string) => {
    // Close existing connection for this co-host if any
    const existing = coHostPCsRef.current.get(cohostSocketId);
    if (existing) { existing.close(); coHostPCsRef.current.delete(cohostSocketId); }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    coHostPCsRef.current.set(cohostSocketId, pc);

    pc.ontrack = (e) => {
      const videoEl = coHostVideoEls.current.get(cohostSocketId);
      if (videoEl && e.streams[0]) {
        videoEl.srcObject = e.streams[0];
        videoEl.muted = false;
        videoEl.play().catch(() => { videoEl.muted = true; videoEl.play().catch(() => {}); });
      }
      // Add to coHosts list (dedup)
      setCoHosts(prev =>
        prev.some(c => c.socketId === cohostSocketId)
          ? prev
          : [...prev, { socketId: cohostSocketId, name: cohostName || "ضيف" }]
      );
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

    // Broadcaster receives join-request from a viewer (max 3)
    socket.on("cohost-request", (data: { socketId: string; userName: string }) => {
      setCohostRequests(prev => [...prev.filter(r => r.socketId !== data.socketId), data]);
      toast({ title: `👤 ${data.userName} يطلب المشاركة في البث`, description: "يمكنك قبول أو رفض الطلب" });
    });

    // Guest got accepted — open camera & announce as co-host
    socket.on("cohost-accepted", async () => {
      isCoHostRef.current = true;
      setIsCoHost(true);
      setRequestingJoin(false);
      toast({ title: "✅ تم قبول طلبك! جارٍ فتح الكاميرا...", description: "💡 استخدم سماعات لأفضل جودة صوت بدون صدى" });
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: HIGH_QUALITY_AUDIO,
        });
        myCoHostStreamRef.current = mediaStream;
        const myId = socket.id || "me";
        const myName = "أنت";
        // First: add the slot so React renders the <video> element
        setCoHosts(prev => prev.some(c => c.socketId === myId) ? prev : [...prev, { socketId: myId, name: myName }]);
        // After DOM renders, assign stream to the video element
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const myVideoEl = coHostVideoEls.current.get(myId);
            if (myVideoEl) {
              myVideoEl.srcObject = mediaStream;
              myVideoEl.muted = true;
              myVideoEl.play().catch(() => {});
            }
          });
        });
        // Tell server I'm now a co-broadcaster with my display name
        socket.emit("cohost-broadcaster", { streamId: id, name: myName });
      } catch (err: any) {
        isCoHostRef.current = false;
        setIsCoHost(false);
        toast({ variant: "destructive", title: "تعذّر فتح الكاميرا", description: err.message });
      }
    });

    socket.on("cohost-rejected", (data?: { reason?: string }) => {
      setRequestingJoin(false);
      const msg = data?.reason === "max_cohosts"
        ? "❌ البث وصل للحد الأقصى من الضيوف (3)"
        : "❌ رُفض طلب المشاركة";
      toast({ variant: "destructive", title: msg });
    });

    // Room auto-accept mode changed (broadcaster toggled it)
    socket.on("auto-accept-changed", (enabled: boolean) => {
      setRoomAutoAccept(enabled);
      if (!isBroadcast && enabled) {
        // Notify viewer that they can now join instantly
        toast({ title: "📹 البث مفتوح للمشاركة بصوت وصورة", description: "اضغط 'انضم الآن' للاتصال الفوري" });
      }
    });

    // Broadcaster: someone joined automatically via auto-accept
    socket.on("cohost-auto-joined", (data: { socketId: string; userName: string }) => {
      toast({ title: `✅ ${data.userName} انضم للبث تلقائياً بصوت وصورة` });
    });

    // SERVER → everyone in room: a co-host just went live with their socketId and name
    socket.on("cohost-active", (cohostSocketId: string, cohostName?: string) => {
      // Don't connect to our own stream
      if (cohostSocketId === socket.id) return;
      connectToCoHost(socket, cohostSocketId, cohostName);
    });

    // ── I am co-host: a viewer/broadcaster wants my stream ──
    socket.on("cohost-watcher", async (watcherId: string) => {
      if (!myCoHostStreamRef.current) return;
      const existing = cohostViewerPCsRef.current.get(watcherId);
      if (existing) existing.close();
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      cohostViewerPCsRef.current.set(watcherId, pc);
      myCoHostStreamRef.current.getTracks().forEach(track =>
        pc.addTrack(track, myCoHostStreamRef.current!)
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

    // ── I receive a co-host offer (I'm a viewer watching them) ──
    socket.on("cohost-offer", async (senderId: string, desc: RTCSessionDescriptionInit) => {
      let pc = coHostPCsRef.current.get(senderId);
      if (!pc) {
        pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        coHostPCsRef.current.set(senderId, pc);
        pc.ontrack = (e) => {
          const videoEl = coHostVideoEls.current.get(senderId);
          if (videoEl && e.streams[0]) {
            videoEl.srcObject = e.streams[0];
            videoEl.muted = false;
            videoEl.play().catch(() => { videoEl.muted = true; videoEl.play().catch(() => {}); });
          }
          setCoHosts(prev =>
            prev.some(c => c.socketId === senderId)
              ? prev
              : [...prev, { socketId: senderId, name: "ضيف" }]
          );
        };
        pc.onicecandidate = (e) => {
          if (e.candidate) socket.emit("cohost-candidate", senderId, e.candidate);
        };
      }
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(desc));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("cohost-answer", senderId, pc.localDescription);
      } catch (err) { console.warn("cohost-offer handling failed", err); }
    });

    // ── I'm a co-host: viewer finalized answer ──
    socket.on("cohost-answer", async (senderId: string, desc: RTCSessionDescriptionInit) => {
      const pc = cohostViewerPCsRef.current.get(senderId);
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription(desc)).catch(() => {});
    });

    // ── Route ICE candidates to the correct PC ──
    socket.on("cohost-candidate", async (senderId: string, candidate: RTCIceCandidateInit) => {
      const viewerPC = cohostViewerPCsRef.current.get(senderId);
      if (viewerPC) { await viewerPC.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {}); return; }
      const watchPC = coHostPCsRef.current.get(senderId);
      if (watchPC) await watchPC.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
    });

    // ── A specific co-host left (server passes their socketId) ──
    socket.on("cohost-left", (leavingSocketId?: string) => {
      if (leavingSocketId) {
        // Clean up their resources
        coHostPCsRef.current.get(leavingSocketId)?.close();
        coHostPCsRef.current.delete(leavingSocketId);
        const el = coHostVideoEls.current.get(leavingSocketId);
        if (el) el.srcObject = null;
        coHostVideoEls.current.delete(leavingSocketId);
        setCoHosts(prev => prev.filter(c => c.socketId !== leavingSocketId));
        toast({ title: "👋 انتهت مشاركة ضيف" });
      } else {
        // Legacy: clear all co-hosts
        coHostPCsRef.current.forEach(pc => pc.close());
        coHostPCsRef.current.clear();
        coHostVideoEls.current.clear();
        setCoHosts([]);
        toast({ title: "👋 انتهى البث الجماعي" });
      }
      // If I was the co-host that left
      if (!leavingSocketId || leavingSocketId === socket.id) {
        isCoHostRef.current = false;
        setIsCoHost(false);
        myCoHostStreamRef.current?.getTracks().forEach(t => t.stop());
        myCoHostStreamRef.current = null;
        cohostViewerPCsRef.current.forEach(pc => pc.close());
        cohostViewerPCsRef.current.clear();
        setCohostRequests([]);
      }
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

    // ── Socket.IO reconnect: re-join the stream room after a network drop ──
    socket.io.on("reconnect", () => {
      socket.emit("join-stream", id);
      if (!isBroadcast) {
        setViewerDisconnected(false);
        socket.emit("watcher", id);
      }
    });

    return () => {
      if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (filterRafRef.current) cancelAnimationFrame(filterRafRef.current);
      if (isCoHostRef.current) socket.emit("cohost-leave", id);
      socket.emit("leave-stream", id);
      socket.io.off("reconnect");
      socket.disconnect();
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      myCoHostStreamRef.current?.getTracks().forEach(t => t.stop());
      coHostPCsRef.current.forEach(pc => pc.close());
      coHostPCsRef.current.clear();
      cohostViewerPCsRef.current.forEach(pc => pc.close());
      cohostViewerPCsRef.current.clear();
      peersRef.current.forEach(pc => pc.close());
      peersRef.current.clear();
    };
  }, [id, isBroadcast]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Show join dialog for viewer when auto-accept becomes active
  useEffect(() => {
    if (!isBroadcast && roomAutoAccept && !isCoHost && user && streaming) {
      setShowJoinDialog(true);
    }
  }, [roomAutoAccept, isBroadcast, isCoHost, user, streaming]);

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
      // If broadcaster is live — reuse the existing audio track to avoid conflict/hang
      let stream2: MediaStream;
      let shouldStopStream = true;
      if (localStreamRef.current && localStreamRef.current.getAudioTracks().length > 0) {
        // Clone just the audio track so we can record without stopping the broadcast
        const audioTrack = localStreamRef.current.getAudioTracks()[0].clone();
        stream2 = new MediaStream([audioTrack]);
        shouldStopStream = true; // stop the clone, not the original
      } else if (isCoHostRef.current && myCoHostStreamRef.current && myCoHostStreamRef.current.getAudioTracks().length > 0) {
        const audioTrack = myCoHostStreamRef.current.getAudioTracks()[0].clone();
        stream2 = new MediaStream([audioTrack]);
        shouldStopStream = true;
      } else {
        // Viewer — request mic with timeout to prevent hanging
        const micPromise = navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), 8000)
        );
        stream2 = await Promise.race([micPromise, timeout]);
      }
      // User may have released while permission dialog was open
      if (!chatHoldingRef.current) {
        if (shouldStopStream) stream2.getTracks().forEach(t => t.stop());
        return;
      }
      chatChunksRef.current = [];
      const mimeTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
      const mimeType = mimeTypes.find(m => MediaRecorder.isTypeSupported(m)) || "";
      const ext = mimeType.includes("mp4") ? "mp4" : mimeType.includes("ogg") ? "ogg" : "webm";
      const recorder = new MediaRecorder(stream2, mimeType ? { mimeType } : {});
      recorder.ondataavailable = ev => { if (ev.data.size > 0) chatChunksRef.current.push(ev.data); };
      recorder.onstop = async () => {
        if (shouldStopStream) stream2.getTracks().forEach(t => t.stop());
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

  // ── TikTok Touch Interaction Handlers ────────────────────────
  const handleVideoTouchStart = (e: React.TouchEvent) => {
    touchStartYRef.current = e.touches[0].clientY;
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleVideoTouchEnd = (e: React.TouchEvent) => {
    const dy = touchStartYRef.current - e.changedTouches[0].clientY;
    const dx = Math.abs(touchStartXRef.current - e.changedTouches[0].clientX);
    const now = Date.now();

    // Swipe up/down to change streams (must be mostly vertical, > 60px)
    if (Math.abs(dy) > 60 && dx < 60 && !isBroadcast) {
      const streams = Array.isArray(allStreams) ? allStreams : [];
      const idx = streams.findIndex(s => String(s.id) === String(id));
      if (dy > 0 && idx < streams.length - 1) {
        // Swipe up → next stream
        setSwipeDir("up");
        setTimeout(() => { setSwipeDir(null); setLocation(`/streams/${streams[idx + 1].id}`); }, 300);
      } else if (dy < 0 && idx > 0) {
        // Swipe down → previous stream
        setSwipeDir("down");
        setTimeout(() => { setSwipeDir(null); setLocation(`/streams/${streams[idx - 1].id}`); }, 300);
      }
      return;
    }

    // Double-tap to like (within 300ms of last tap, and not much movement)
    if (Math.abs(dy) < 20 && dx < 20) {
      const timeSinceLast = now - lastTapTimeRef.current;
      if (timeSinceLast < 300 && timeSinceLast > 0) {
        // Double-tap detected
        if (singleTapTimer.current) { clearTimeout(singleTapTimer.current); singleTapTimer.current = null; }
        lastTapTimeRef.current = 0;
        if (!liked) handleLike();
        const rect = (e.target as HTMLElement).closest(".stream-tap-area")?.getBoundingClientRect();
        const x = rect ? ((e.changedTouches[0].clientX - rect.left) / rect.width) * 100 : 50;
        const y = rect ? ((e.changedTouches[0].clientY - rect.top) / rect.height) * 100 : 50;
        const hid = Date.now() + Math.random();
        setDoubleTapHearts(prev => [...prev, { id: hid, x, y }]);
        setTimeout(() => setDoubleTapHearts(prev => prev.filter(h => h.id !== hid)), 1200);
      } else {
        // Potential single tap — wait to see if double-tap comes
        lastTapTimeRef.current = now;
        if (singleTapTimer.current) clearTimeout(singleTapTimer.current);
        singleTapTimer.current = setTimeout(() => {
          singleTapTimer.current = null;
          // Single tap = toggle UI
          setShowUI(v => !v);
        }, 310);
      }
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
    <div className="bg-black min-h-[100dvh] overflow-hidden" dir="rtl">
      <style>{`
        @keyframes floatUp {
          0%   { transform: translateY(0) scale(1); opacity: 1; }
          70%  { transform: translateY(-200px) scale(1.4) rotate(12deg); opacity: 0.8; }
          100% { transform: translateY(-320px) scale(0.4); opacity: 0; }
        }
        @keyframes slideInLeft {
          from { transform: translateX(-30px); opacity: 0; }
          to   { transform: translateX(0); opacity: 1; }
        }
        @keyframes chatSlideIn {
          from { transform: translateY(8px); opacity: 0; }
          to   { transform: translateY(0); opacity: 1; }
        }
        @keyframes giftPop {
          0%   { transform: scale(0) rotate(-10deg); opacity: 0; }
          60%  { transform: scale(1.3) rotate(5deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes heartBeat {
          0%   { transform: scale(1); }
          30%  { transform: scale(1.4); }
          60%  { transform: scale(1.1); }
          100% { transform: scale(1); }
        }
        .tiktok-chat-msg { animation: chatSlideIn 0.25s ease-out; }
        .gift-pop { animation: giftPop 0.4s cubic-bezier(0.175,0.885,0.32,1.275); }
      `}</style>

      {/* ── Hidden elements for canvas filter processing (broadcaster only) ── */}
      <video ref={rawVideoRef} style={{ display: "none" }} playsInline muted />
      <canvas ref={filterCanvasRef} style={{ display: "none" }} />

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
            {summary.recordingUrl && (
              <div className="mb-4 p-3 rounded-2xl bg-green-500/10 border border-green-500/30 text-center">
                <p className="text-xs text-green-400 font-semibold mb-2">✅ تم حفظ البث كـ Replay</p>
                <a
                  href={summary.recordingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 underline break-all"
                  data-testid="link-recording"
                >
                  مشاهدة التسجيل
                </a>
              </div>
            )}
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

      <div className="flex flex-col lg:flex-row h-[100dvh]">

        {/* ══ TikTok-style Full-Screen Video Area ══ */}
        <div
          className={`stream-tap-area relative flex-1 overflow-hidden bg-black flex items-center justify-center lg:max-w-[480px] lg:mx-auto transition-transform duration-300 ${swipeDir === "up" ? "-translate-y-8 opacity-60" : swipeDir === "down" ? "translate-y-8 opacity-60" : ""}`}
          style={{ minHeight: "100dvh" }}
          onTouchStart={handleVideoTouchStart}
          onTouchEnd={handleVideoTouchEnd}
        >
          {/* ── Double-tap hearts ── */}
          {doubleTapHearts.map(h => (
            <div key={h.id} className="absolute z-40 pointer-events-none select-none"
              style={{ left: `${h.x}%`, top: `${h.y}%`, transform: "translate(-50%,-50%)", animation: "doubleTapHeart 1.1s ease-out forwards" }}>
              ❤️
            </div>
          ))}

          {/* ── Swipe navigation hints (viewer only) ── */}
          {!isBroadcast && (() => {
            const streams = Array.isArray(allStreams) ? allStreams : [];
            const idx = streams.findIndex(s => String(s.id) === String(id));
            return (<>
              {idx > 0 && (
                <div className={`absolute top-16 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1 transition-opacity duration-300 pointer-events-none ${showUI ? "opacity-60" : "opacity-0"}`}>
                  <ChevronUp className="w-6 h-6 text-white drop-shadow animate-bounce" />
                  <span className="text-white/70 text-[10px] font-medium">سوايب للأسفل</span>
                </div>
              )}
              {idx < streams.length - 1 && (
                <div className={`absolute bottom-[90px] left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1 transition-opacity duration-300 pointer-events-none ${showUI ? "opacity-60" : "opacity-0"}`}>
                  <span className="text-white/70 text-[10px] font-medium">سوايب للأعلى</span>
                  <ChevronDown className="w-6 h-6 text-white drop-shadow animate-bounce" />
                </div>
              )}
            </>);
          })()}

          {/* ── Viewer: Join with Audio/Video Dialog (auto-accept mode) ── */}
          {showJoinDialog && !isBroadcast && !isCoHost && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" dir="rtl">
              <div className="bg-gray-900 border border-green-500/50 rounded-3xl p-6 mx-4 max-w-sm w-full text-center shadow-2xl">
                <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                  <Video className="w-8 h-8 text-green-400" />
                </div>
                <h3 className="text-white text-lg font-bold mb-2">انضم للبث بصوت وصورة!</h3>
                <p className="text-gray-400 text-sm mb-5">
                  المضيف فتح البث للمشاركة الفورية — اضغط "انضم الآن" وستظهر كاميرتك وصوتك مباشرةً
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowJoinDialog(false);
                      setRequestingJoin(true);
                      socketRef.current?.emit("request-cohost", {
                        streamId: id,
                        userId: (user as any)?.id,
                        userName: `${(user as any)?.firstName || ""} ${(user as any)?.lastName || ""}`.trim() || "مشاهد",
                      });
                    }}
                    className="flex-1 py-3 rounded-2xl bg-green-500 hover:bg-green-400 text-white font-bold text-sm transition flex items-center justify-center gap-2"
                    data-testid="btn-join-now-dialog"
                  >
                    <Video className="w-4 h-4" />
                    انضم الآن
                  </button>
                  <button
                    onClick={() => setShowJoinDialog(false)}
                    className="flex-1 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm transition"
                    data-testid="btn-watch-only-dialog"
                  >
                    مشاهدة فقط
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Co-host request popups (one per pending request, stacked) */}
          {isBroadcast && cohostRequests.map((req, i) => (
            <div key={req.socketId} className="absolute inset-x-3 z-30 p-3 rounded-2xl bg-black/80 backdrop-blur border border-blue-500/50 flex items-center gap-3" style={{ top: `${64 + i * 72}px` }} dir="rtl">
              <UserPlus className="w-5 h-5 text-blue-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-white">👤 {req.userName} يطلب المشاركة</p>
                {coHosts.length >= 3 && <p className="text-yellow-400 text-[10px]">الحد الأقصى (3 ضيوف)</p>}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => {
                    if (coHosts.length >= 3) { toast({ variant: "destructive", title: "الحد الأقصى 3 ضيوف" }); return; }
                    socketRef.current?.emit("accept-cohost", { streamId: id, guestSocketId: req.socketId, guestName: req.userName });
                    setCohostRequests(prev => prev.filter(r => r.socketId !== req.socketId));
                    toast({ title: "✅ تم قبول الضيف" });
                  }}
                  disabled={coHosts.length >= 3}
                  className="px-3 py-1.5 rounded-xl bg-green-500 text-white text-xs font-bold hover:bg-green-600 transition disabled:opacity-50"
                  data-testid={`btn-accept-cohost-${req.socketId}`}
                >
                  <UserCheck className="w-3.5 h-3.5 inline ml-1" />قبول
                </button>
                <button
                  onClick={() => { socketRef.current?.emit("reject-cohost", { guestSocketId: req.socketId }); setCohostRequests(prev => prev.filter(r => r.socketId !== req.socketId)); }}
                  className="px-3 py-1.5 rounded-xl bg-red-500 text-white text-xs font-bold hover:bg-red-600 transition"
                  data-testid={`btn-reject-cohost-${req.socketId}`}
                >رفض</button>
              </div>
            </div>
          ))}

          {/* Group Live Banner */}
          {coHosts.length > 0 && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/70 backdrop-blur border border-purple-500/50">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-bold text-white">🔴 بث جماعي ({coHosts.length + 1} مذيعين) — {viewerCount} مشاهد</span>
            </div>
          )}

          {/* ── Dynamic video grid (1–4 hosts) ── */}
          <div className={
            coHosts.length === 0 ? "absolute inset-0" :
            coHosts.length === 1 ? "absolute inset-0 grid grid-cols-2 gap-0" :
            coHosts.length === 2 ? "absolute inset-0 grid grid-rows-2 gap-0" :
            "absolute inset-0 grid grid-cols-2 grid-rows-2 gap-0"
          }>
            {/* ── Main broadcaster / host slot ── */}
            <div className={
              coHosts.length === 0 ? "absolute inset-0 overflow-hidden bg-black" :
              coHosts.length === 2 ? "relative overflow-hidden bg-black ring-2 ring-red-500/60 col-span-2" :
              "relative overflow-hidden bg-black ring-2 ring-red-500/60"
            }>
              {coHosts.length > 0 && (
                <div className="absolute bottom-2 start-2 z-10 flex items-center gap-1.5 bg-black/70 backdrop-blur rounded-full px-2 py-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-white text-[10px] font-bold">
                    {isBroadcast ? "أنت (المضيف)" : "المضيف"}
                  </span>
                </div>
              )}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              controls={!isBroadcast}
              className="w-full h-full object-cover"
              style={{
                backgroundColor: "#000",
                // Apply CSS filter on broadcaster's preview only (viewers see canvas-filtered stream)
                filter: (isBroadcast && sourceMode === "camera" && selectedFilter !== "none")
                  ? (LIVE_FILTERS.find(f => f.id === selectedFilter)?.css || "none")
                  : undefined,
                transition: "filter 0.3s ease",
              }}
            />

            {/* Ended + Replay overlay (viewer only) */}
            {!isBroadcast && !streaming && stream?.status === "ended" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 text-white gap-5 px-6" dir="rtl">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-red-600 to-orange-500 flex items-center justify-center shadow-xl">
                  <PhoneOff className="w-10 h-10 text-white" />
                </div>
                <div className="text-center">
                  <h3 className="text-xl font-bold mb-1">انتهى البث المباشر</h3>
                  <p className="text-white/50 text-sm">البث "{stream?.title}" انتهى</p>
                </div>
                {(stream as any)?.recordingUrl ? (
                  <div className="w-full max-w-xs text-center">
                    <p className="text-green-400 text-sm font-semibold mb-3">📹 يمكنك مشاهدة التسجيل الآن</p>
                    <video
                      src={(stream as any).recordingUrl}
                      controls
                      playsInline
                      className="w-full rounded-2xl shadow-xl"
                      style={{ maxHeight: "45vh", background: "#000" }}
                      data-testid="video-replay"
                    />
                    <a
                      href={(stream as any).recordingUrl}
                      download
                      className="mt-3 inline-flex items-center gap-2 text-xs text-blue-400 underline"
                    >
                      تحميل التسجيل
                    </a>
                  </div>
                ) : (
                  <p className="text-white/40 text-sm">لا يوجد تسجيل متاح لهذا البث</p>
                )}
                <button
                  onClick={() => window.history.back()}
                  className="px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition"
                  data-testid="btn-back-from-ended"
                >
                  العودة
                </button>
              </div>
            )}

            {/* Waiting overlay (not started / broadcaster loading) */}
            {!streaming && stream?.status !== "ended" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-white gap-4">
                <div className="w-16 h-16 rounded-full border-4 border-red-500/40 flex items-center justify-center animate-pulse">
                  <Radio className="w-7 h-7 text-red-400" />
                </div>
                <p className="text-lg font-medium opacity-70">
                  {isBroadcast ? "جاري تشغيل الكاميرا..." : "في انتظار البث المباشر..."}
                </p>
                {isBroadcast && (
                  <p className="text-sm text-white/40 text-center px-6">
                    تأكد من السماح للمتصفح بالوصول للكاميرا والميكروفون
                  </p>
                )}
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
              {isBroadcast && selectedFilter !== "none" && (() => {
                const f = LIVE_FILTERS.find(x => x.id === selectedFilter);
                return f ? (
                  <Badge className="bg-purple-600/80 text-white text-xs backdrop-blur gap-1">
                    <Wand2 className="w-3 h-3" /> {f.emoji} {f.name}
                  </Badge>
                ) : null;
              })()}
              {isBroadcast && showTimeOverlay && (
                <Badge className="bg-amber-500/80 text-black text-xs backdrop-blur font-bold">
                  🕐 وقت
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

            {/* 🔊 Enable Audio — large centered overlay (mobile-friendly) */}
            {!isBroadcast && streaming && (audioBlocked || viewerMuted) && !viewerDisconnected && (
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
                  // Enable audio on all co-host streams too
                  coHostVideoEls.current.forEach(el => {
                    el.muted = false;
                    el.volume = 1;
                    el.play().catch(() => {});
                  });
                }}
                className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-20 cursor-pointer"
                data-testid="btn-enable-audio"
              >
                <div className="flex flex-col items-center gap-3 px-8 py-6 rounded-3xl bg-yellow-500/90 border-2 border-yellow-300 shadow-2xl animate-pulse">
                  <Volume2 className="w-10 h-10 text-white" />
                  <span className="text-white text-xl font-bold">🔊 انقر لتشغيل الصوت</span>
                  <span className="text-yellow-100 text-sm opacity-80">المتصفح يحتاج إذنك لتشغيل الصوت</span>
                </div>
              </button>
            )}

            {/* 🔇 Persistent mute/unmute toggle for viewer (visible after audio is enabled) */}
            {!isBroadcast && streaming && !viewerMuted && !viewerDisconnected && (
              <button
                onClick={() => {
                  if (videoRef.current) {
                    const nowMuting = !videoRef.current.muted;
                    videoRef.current.muted = nowMuting;
                    videoRef.current.volume = nowMuting ? 0 : 1;
                    setViewerMuted(nowMuting);
                    coHostVideoEls.current.forEach(el => {
                      el.muted = nowMuting;
                      el.volume = nowMuting ? 0 : 1;
                    });
                  }
                }}
                className="absolute bottom-[84px] start-4 w-10 h-10 rounded-full bg-black/60 backdrop-blur flex items-center justify-center text-white hover:bg-black/80 transition shadow-lg"
                data-testid="btn-toggle-viewer-audio"
                title="كتم / تشغيل الصوت"
              >
                <Volume2 className="w-5 h-5" />
              </button>
            )}

            {/* 🔄 Reconnect Button for viewers (ICE connection dropped) */}
            {!isBroadcast && viewerDisconnected && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-2xl">
                <div className="text-center space-y-3">
                  <WifiOff className="w-10 h-10 text-red-400 mx-auto animate-pulse" />
                  <p className="text-white font-bold text-sm">انقطع الاتصال...</p>
                  <button
                    onClick={() => {
                      setViewerDisconnected(false);
                      socketRef.current?.emit("watcher", id);
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-black text-sm font-bold hover:bg-gray-100 transition mx-auto"
                    data-testid="btn-reconnect-stream"
                  >
                    <RotateCcw className="w-4 h-4" />
                    إعادة الاتصال
                  </button>
                </div>
              </div>
            )}

            {/* ── Ad Overlay (viewer only, TikTok style) ── */}
            {!isBroadcast && streaming && (
              <AdWidget variant="overlay" refreshInterval={45000} dismissible={true} />
            )}

            {/* ── TikTok Floating Hearts ── */}
            {floatingHearts.map(h => (
              <div key={h.id} className="absolute pointer-events-none select-none text-2xl"
                style={{ left: `${h.x}%`, bottom: isBroadcast && streaming ? "220px" : "90px", animation: "floatUp 3s ease-out forwards" }}>
                ❤️
              </div>
            ))}

            {/* ── TikTok Floating Gifts ── */}
            {floatingGifts.map(g => (
              <div key={g.id} className="absolute pointer-events-none select-none text-3xl"
                style={{ left: `${g.x}%`, bottom: isBroadcast && streaming ? "240px" : "110px", animation: "floatUp 3.5s ease-out forwards", filter: "drop-shadow(0 0 8px gold)" }}>
                {g.emoji}
              </div>
            ))}

            {/* ── Recent Gift Banner (bottom-left) ── */}
            {recentGiftBanner && (
              <div className={`absolute ${isBroadcast && streaming ? "bottom-[248px]" : "bottom-[88px]"} start-4 flex items-center gap-2 bg-black/70 backdrop-blur rounded-full px-4 py-2 border border-yellow-500/40 text-white text-sm font-bold`}
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

            {/* ── Filter Panel (slides up when showFilterPanel = true) ── */}
            {isBroadcast && streaming && showFilterPanel && (
              <div className="absolute bottom-[168px] start-0 end-0 z-40 px-3 pb-2">
                <div className="bg-black/85 backdrop-blur-md rounded-2xl p-3 border border-white/10">
                  <div className="flex items-center justify-between mb-2.5 px-1">
                    <p className="text-white text-xs font-bold flex items-center gap-1.5">
                      <Wand2 className="w-3.5 h-3.5 text-purple-400" /> فلاتر الكاميرا
                    </p>
                    <button onClick={() => setShowFilterPanel(false)} className="text-white/50 hover:text-white transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide" style={{ scrollbarWidth: "none" }}>
                    {LIVE_FILTERS.map(f => (
                      <button
                        key={f.id}
                        onClick={() => setSelectedFilter(f.id)}
                        data-testid={`btn-filter-${f.id}`}
                        className={`flex-none flex flex-col items-center gap-1 px-2.5 py-2 rounded-xl border-2 transition-all min-w-[60px] ${
                          selectedFilter === f.id
                            ? "border-purple-400 bg-purple-500/30 scale-105"
                            : "border-white/10 bg-white/5 hover:bg-white/10"
                        }`}
                      >
                        <span className="text-xl leading-none">{f.emoji}</span>
                        <span className="text-white text-[10px] font-medium whitespace-nowrap">{f.name}</span>
                        {selectedFilter === f.id && (
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                        )}
                      </button>
                    ))}
                  </div>
                  {/* Time overlay toggle */}
                  <div className="mt-3 pt-3 border-t border-white/10">
                    <button
                      onClick={() => setShowTimeOverlay(v => !v)}
                      data-testid="btn-toggle-time-overlay"
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border-2 transition-all ${
                        showTimeOverlay
                          ? "border-amber-400 bg-amber-500/20 text-amber-300"
                          : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                      }`}
                    >
                      <span className="text-xs font-medium">🕐 طابع الوقت والتاريخ على الفيديو</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${showTimeOverlay ? "bg-amber-400 text-black" : "bg-white/10 text-white/40"}`}>
                        {showTimeOverlay ? "مفعّل" : "معطّل"}
                      </span>
                    </button>
                  </div>
                  <p className="text-white/40 text-[10px] text-center mt-2">
                    الفلتر والوقت يظهران للمشاهدين أيضاً ✨
                  </p>
                </div>
              </div>
            )}

            {/* Broadcaster controls */}
            {isBroadcast && streaming && (
              <div className="absolute bottom-[80px] start-0 end-0 bg-gradient-to-t from-black/60 to-transparent px-5 pb-3 pt-6 z-30">
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

                  {/* Filter Toggle — camera only */}
                  {sourceMode === "camera" && (
                    <button
                      onClick={() => setShowFilterPanel(v => !v)}
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-lg ${showFilterPanel ? "bg-purple-500 text-white scale-110 ring-2 ring-purple-300" : "bg-white/20 backdrop-blur text-white hover:bg-white/30"}`}
                      title="فلاتر الكاميرا"
                      data-testid="btn-toggle-filter-panel"
                    >
                      <Wand2 className="w-5 h-5" />
                    </button>
                  )}

                  {/* Poll Creator Toggle */}
                  <button
                    onClick={() => setShowPollCreator(v => !v)}
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-lg ${showPollCreator ? "bg-purple-500 text-white scale-110" : "bg-white/20 backdrop-blur text-white hover:bg-white/30"}`}
                    title="إنشاء استطلاع"
                  >
                    <TrendingUp className="w-5 h-5" />
                  </button>

                  {/* Auto-accept toggle */}
                  <button
                    onClick={() => {
                      const next = !autoAccept;
                      setAutoAccept(next);
                      socketRef.current?.emit("set-auto-accept", { streamId: id, enabled: next });
                      toast({ title: next ? "✅ قبول تلقائي مفعّل — أي شخص يضغط 'انضم' يدخل فوراً" : "⏸️ القبول التلقائي أُوقف" });
                    }}
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-lg ${autoAccept ? "bg-green-500 text-white scale-110 ring-2 ring-green-300" : "bg-white/20 backdrop-blur text-white hover:bg-white/30"}`}
                    title={autoAccept ? "إيقاف القبول التلقائي" : "قبول تلقائي للضيوف"}
                    data-testid="btn-toggle-auto-accept"
                  >
                    <UserCheck className="w-5 h-5" />
                  </button>

                  {/* End stream */}
                  <button
                    onClick={() => endStreamMutation.mutate()}
                    disabled={endStreamMutation.isPending || isUploadingRec}
                    className="px-5 h-12 rounded-full bg-red-600 hover:bg-red-700 disabled:opacity-70 text-white flex items-center gap-2 font-bold shadow-lg transition"
                    data-testid="btn-end-stream"
                  >
                    <PhoneOff className="w-5 h-5" />
                    {isUploadingRec ? "جارى رفع التسجيل..." : endStreamMutation.isPending ? "ينتهي..." : "إنهاء البث"}
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

          {/* Co-host video slots — one per active co-host */}
          {coHosts.map((ch) => (
            <div key={ch.socketId} className="relative overflow-hidden bg-black ring-2 ring-purple-500/60 h-full">
              <video
                ref={(el) => {
                  if (el) {
                    coHostVideoEls.current.set(ch.socketId, el);
                    // If this is our own slot and stream is already ready, attach it now
                    if (ch.name === "أنت" && myCoHostStreamRef.current && !el.srcObject) {
                      el.srcObject = myCoHostStreamRef.current;
                      el.muted = true;
                      el.play().catch(() => {});
                    }
                  } else {
                    coHostVideoEls.current.delete(ch.socketId);
                  }
                }}
                autoPlay
                playsInline
                muted={ch.name === "أنت"}
                className="w-full h-full object-cover"
                style={{ backgroundColor: "#000" }}
              />
              {/* Guest label */}
              <div className="absolute top-2 start-2 z-10 flex items-center gap-1.5 bg-black/70 backdrop-blur rounded-full px-3 py-1">
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                <span className="text-white text-xs font-bold">{ch.name}</span>
              </div>
              {/* "GUEST" badge */}
              <div className="absolute top-2 end-2 z-10">
                <Badge className="bg-purple-600 text-white text-[10px] px-2 py-0.5 font-bold">
                  <Users className="w-2.5 h-2.5 ml-1" /> ضيف
                </Badge>
              </div>
              {/* Co-host mic/video/leave controls — only shown on the co-host's own slot */}
              {isCoHost && ch.name === "أنت" && (
                <div className="absolute bottom-3 inset-x-0 flex items-end justify-center gap-4 px-2">
                  {/* Mic toggle */}
                  <div className="flex flex-col items-center gap-1">
                    <button
                      onClick={() => {
                        if (myCoHostStreamRef.current) {
                          const aTrack = myCoHostStreamRef.current.getAudioTracks()[0];
                          if (aTrack) { aTrack.enabled = !aTrack.enabled; setCoHostMuted(!aTrack.enabled); }
                        }
                      }}
                      className={`w-12 h-12 rounded-full flex items-center justify-center shadow-xl transition-all border-2 ${coHostMuted ? "bg-red-500 border-red-400 text-white" : "bg-black/60 backdrop-blur border-white/30 text-white hover:bg-black/80"}`}
                      data-testid="btn-cohost-toggle-mic"
                    >
                      {coHostMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    </button>
                    <span className="text-white text-[10px] font-bold drop-shadow">{coHostMuted ? "صوت مكتوم" : "الصوت"}</span>
                  </div>
                  {/* Camera toggle */}
                  <div className="flex flex-col items-center gap-1">
                    <button
                      onClick={() => {
                        if (myCoHostStreamRef.current) {
                          const vTrack = myCoHostStreamRef.current.getVideoTracks()[0];
                          if (vTrack) { vTrack.enabled = !vTrack.enabled; setCoHostVideoOff(!vTrack.enabled); }
                        }
                      }}
                      className={`w-12 h-12 rounded-full flex items-center justify-center shadow-xl transition-all border-2 ${coHostVideoOff ? "bg-red-500 border-red-400 text-white" : "bg-black/60 backdrop-blur border-white/30 text-white hover:bg-black/80"}`}
                      data-testid="btn-cohost-toggle-camera"
                    >
                      {coHostVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                    </button>
                    <span className="text-white text-[10px] font-bold drop-shadow">{coHostVideoOff ? "كاميرا مغلقة" : "الكاميرا"}</span>
                  </div>
                  {/* Leave button */}
                  <div className="flex flex-col items-center gap-1">
                    <button
                      onClick={() => {
                        socketRef.current?.emit("cohost-leave", id);
                        setIsCoHost(false);
                        isCoHostRef.current = false;
                        myCoHostStreamRef.current?.getTracks().forEach(t => t.stop());
                        myCoHostStreamRef.current = null;
                        setCoHosts(prev => prev.filter(c => c.name !== "أنت"));
                      }}
                      className="w-12 h-12 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-xl transition border-2 border-red-400"
                      data-testid="btn-leave-cohost"
                    >
                      <PhoneOff className="w-5 h-5" />
                    </button>
                    <span className="text-white text-[10px] font-bold drop-shadow">مغادرة</span>
                  </div>
                </div>
              )}
            </div>
          ))}
          </div>{/* end grid wrapper */}

          {/* ── TikTok Top Bar Overlay ── */}
          <div className={`absolute top-0 inset-x-0 z-20 bg-gradient-to-b from-black/70 to-transparent px-4 pt-4 pb-10 pointer-events-none transition-opacity duration-300 ${showUI ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
            <div className="flex items-center gap-2">
              <Badge className="bg-red-500 text-white gap-1 px-2.5 py-0.5 text-xs font-bold animate-pulse pointer-events-auto">
                🔴 مباشر
              </Badge>
              <span className="text-white font-bold text-sm truncate flex-1">{stream?.title}</span>
              <Badge variant="secondary" className="gap-1 bg-black/60 text-white text-xs pointer-events-auto">
                <Eye className="w-3 h-3" /> {viewerCount.toLocaleString()}
              </Badge>
              {/* Back button */}
              <button
                onClick={() => window.history.back()}
                className="w-8 h-8 rounded-full bg-black/60 backdrop-blur flex items-center justify-center text-white hover:bg-black/80 pointer-events-auto"
              ><X className="w-4 h-4" /></button>
            </div>
          </div>

          {/* ── TikTok Right Action Buttons ── */}
          <div className={`absolute end-3 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-3 items-center transition-opacity duration-300 ${showUI ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
            {/* Like */}
            <button
              onClick={handleLike}
              className="flex flex-col items-center gap-0.5"
              data-testid="btn-stream-like"
            >
              <div className={`w-11 h-11 rounded-full flex items-center justify-center shadow-lg transition-all ${liked ? "bg-red-500 scale-110" : "bg-black/60 backdrop-blur"}`}
                style={{ animation: liked ? "heartBeat 0.4s ease" : undefined }}>
                <Heart className={`w-5 h-5 ${liked ? "text-white fill-white" : "text-white"}`} />
              </div>
              <span className="text-white text-[10px] font-bold drop-shadow">{likesCount}</span>
            </button>
            {/* Share */}
            <div onClick={e => e.stopPropagation()} className="flex flex-col items-center gap-0.5">
              <div className="w-11 h-11 rounded-full bg-black/60 backdrop-blur flex items-center justify-center shadow-lg">
                <ShareMenu
                  url={window.location.href.replace("mode=broadcast", "")}
                  title={stream?.title || "بث مباشر على سوق"}
                  description={stream?.description || ""}
                  variant="ghost"
                  size="sm"
                  data-testid="btn-stream-share"
                />
              </div>
              <span className="text-white text-[10px] font-bold drop-shadow">مشاركة</span>
            </div>
            {/* Cohost join (viewer) */}
            {!isBroadcast && streaming && !isCoHost && coHosts.length < 3 && user && (
              <button
                onClick={() => {
                  if (requestingJoin) return;
                  setRequestingJoin(true);
                  socketRef.current?.emit("request-cohost", {
                    streamId: id,
                    userId: (user as any).id,
                    userName: `${(user as any).firstName || ""} ${(user as any).lastName || ""}`.trim() || "مشاهد",
                  });
                  if (!roomAutoAccept) toast({ title: "⏳ تم إرسال طلب المشاركة" });
                }}
                disabled={requestingJoin}
                className="flex flex-col items-center gap-0.5"
                data-testid="btn-request-cohost"
              >
                <div className={`w-11 h-11 rounded-full flex items-center justify-center shadow-lg transition-all ${roomAutoAccept ? "bg-green-500 ring-2 ring-green-300 scale-110 animate-pulse" : "bg-gradient-to-br from-purple-600 to-blue-600"}`}>
                  {roomAutoAccept ? <Video className="w-5 h-5 text-white" /> : <UserPlus className="w-5 h-5 text-white" />}
                </div>
                <span className="text-white text-[10px] font-bold drop-shadow">
                  {requestingJoin ? "جارٍ الاتصال..." : roomAutoAccept ? "انضم الآن" : "مشاركة"}
                </span>
              </button>
            )}
            {/* Gift button (viewer) */}
            {!isBroadcast && user && (
              <button
                onClick={() => setShowGiftsPanel(v => !v)}
                className="flex flex-col items-center gap-0.5"
                data-testid="btn-gifts-tiktok"
              >
                <div className={`w-11 h-11 rounded-full flex items-center justify-center shadow-lg transition-all ${showGiftsPanel ? "bg-yellow-500 scale-110" : "bg-black/60 backdrop-blur"}`}>
                  <span className="text-xl">🎁</span>
                </div>
                <span className="text-white text-[10px] font-bold drop-shadow">هدية</span>
              </button>
            )}
          </div>

          {/* ── TikTok Broadcaster Profile Card ── */}
          {stream && !isBroadcast && (
            <div className={`absolute bottom-[180px] start-3 z-20 flex items-center gap-2 transition-opacity duration-300 ${showUI ? "opacity-100" : "opacity-0 pointer-events-none"}`} dir="rtl">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center flex-shrink-0 ring-2 ring-white/30">
                <UserCircle2 className="w-6 h-6 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-white text-xs font-bold drop-shadow truncate max-w-[120px]">{stream.title}</p>
                <p className="text-white/60 text-[10px] truncate">{(stream as any).channelName || "بث مباشر"}</p>
              </div>
            </div>
          )}

          {/* ── TikTok Floating Chat Messages ── */}
          <div className={`absolute start-0 w-[58%] px-3 z-20 max-h-52 overflow-hidden flex flex-col-reverse gap-1 pointer-events-none ${isBroadcast && streaming ? "bottom-[168px]" : "bottom-[72px]"}`}>
            {/* Pinned comment */}
            {pinnedComment && (
              <div className="flex items-start gap-1.5 bg-yellow-500/20 backdrop-blur rounded-xl px-2.5 py-1.5 mb-1 pointer-events-auto">
                <span className="text-xs">📌</span>
                <span className="text-yellow-200 text-xs font-bold">{pinnedComment.userName}: </span>
                <span className="text-white text-xs">{pinnedComment.message}</span>
                {isBroadcast && (
                  <button onClick={() => { socketRef.current?.emit("unpin-comment", id); setPinnedComment(null); }}
                    className="text-yellow-400 text-sm ml-1 pointer-events-auto">×</button>
                )}
              </div>
            )}
            {messages.slice(-8).reverse().map((msg, i) => (
              <div key={i} className="tiktok-chat-msg flex items-baseline gap-1.5 py-0.5 px-1.5 rounded-lg bg-black/30 backdrop-blur-sm">
                <span className={`text-[11px] font-bold shrink-0 drop-shadow-md ${msg.isOwner ? "text-red-400" : "text-yellow-300"}`}>
                  {msg.userName}{msg.isOwner ? " 🔴" : ""}
                </span>
                {msg.isVoice ? (
                  <span className="text-white text-xs drop-shadow-md">🎤 رسالة صوتية</span>
                ) : (
                  <span className="text-white text-xs leading-snug drop-shadow-md">{msg.message}</span>
                )}
              </div>
            ))}
          </div>

          {/* ── TikTok Bottom Chat Input ── */}
          {user ? (
            <div className="absolute bottom-0 inset-x-0 z-20 bg-gradient-to-t from-black/70 to-transparent px-3 pb-4 pt-8">
              {/* Gifts Panel slides up */}
              {showGiftsPanel && (
                <div className="mb-2 bg-black/80 backdrop-blur border border-white/10 rounded-2xl p-3" dir="rtl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-white">أرسل هدية 🎁</span>
                    <button onClick={() => setShowGiftsPanel(false)} className="text-white/60 hover:text-white text-lg leading-none">×</button>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {GIFTS.map(gift => (
                      <button key={gift.id} onClick={() => { sendGift(gift); setShowGiftsPanel(false); }}
                        className="gift-pop flex flex-col items-center gap-0.5 p-2 rounded-xl hover:bg-white/10 border border-transparent hover:border-yellow-400/40 transition">
                        <span className="text-2xl">{gift.emoji}</span>
                        <span className="text-[9px] text-white font-medium">{gift.name}</span>
                        <span className="text-[8px] text-yellow-400">{gift.coins}🪙</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {/* Voice recording status */}
              {(chatIsRecording || chatIsUploading) && (
                <div className={`mb-1.5 flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium ${
                  chatIsUploading ? "bg-blue-500/30 text-blue-200" : "bg-red-500/30 text-red-200"
                }`}>
                  {chatIsUploading ? (
                    <><span className="w-2 h-2 rounded-full bg-blue-400 animate-ping inline-block" /> إرسال الصوت...</>
                  ) : (
                    <><span className="w-2 h-2 rounded-full bg-red-400 animate-pulse inline-block" /> 🎤 {chatRecordSeconds}ث</>
                  )}
                </div>
              )}
              <div className="flex gap-2 items-center">
                <Input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendChat()}
                  placeholder="أضف تعليقاً..."
                  className="flex-1 h-10 text-sm rounded-full bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:bg-white/20"
                  maxLength={200}
                  disabled={chatIsRecording || chatIsUploading}
                />
                <button
                  onPointerDown={handleChatMicPress}
                  onPointerUp={handleChatMicRelease}
                  onPointerLeave={handleChatMicRelease}
                  onPointerCancel={handleChatMicRelease}
                  onContextMenu={e => e.preventDefault()}
                  style={{ touchAction: "none", userSelect: "none" }}
                  className={`h-10 w-10 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
                    chatIsRecording ? "bg-red-500 text-white scale-110" : "bg-white/10 text-white hover:bg-white/20"
                  }`}
                  data-testid="btn-stream-voice"
                >
                  {chatIsRecording ? <span className="animate-pulse">🎙️</span> : <Mic className="w-4 h-4" />}
                </button>
                <Button size="sm" onClick={sendChat} disabled={!chatInput.trim() || chatIsRecording}
                  className="h-10 w-10 p-0 rounded-full flex-shrink-0"
                  data-testid="btn-stream-chat-send">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="absolute bottom-0 inset-x-0 z-20 px-4 pb-4 bg-gradient-to-t from-black/70 to-transparent">
              <a href="/login">
                <Button variant="outline" className="w-full rounded-full border-white/20 text-white bg-white/10 hover:bg-white/20">سجل دخول للمشاركة في الدردشة</Button>
              </a>
            </div>
          )}

        </div>{/* end TikTok video column */}

        {/* ══ Desktop Right Panel ══ */}
        <div className="hidden lg:flex flex-1 flex-col gap-3 bg-zinc-900 border-l border-white/10 p-4 overflow-y-auto" dir="rtl">

          {/* Connection Status */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium ${connected ? "bg-green-500/10 text-green-500" : "bg-white/5 text-white/40"}`}>
            {connected ? <><Wifi className="w-3 h-3" /> متصل · جودة عالية</> : <><WifiOff className="w-3 h-3" /> جاري الاتصال...</>}
          </div>

          {/* Top Gifters */}
          {topGifters.length > 0 && (
            <div className="bg-white/5 rounded-2xl p-3">
              <h3 className="text-xs font-bold text-yellow-400 mb-2 flex items-center gap-1">
                <Trophy className="w-3.5 h-3.5" /> أكثر المُهدين
              </h3>
              <div className="space-y-1.5">
                {topGifters.slice(0, 5).map((g, i) => (
                  <div key={g.userId} className="flex items-center gap-2">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 ${
                      i === 0 ? "bg-yellow-500" : i === 1 ? "bg-gray-400" : i === 2 ? "bg-amber-600" : "bg-zinc-600"
                    }`}>{i + 1}</span>
                    <span className="text-lg">{g.lastEmoji}</span>
                    <span className="text-xs font-medium flex-1 truncate text-white">{g.userName}</span>
                    <span className="text-[10px] text-yellow-400 font-bold">{g.totalCoins}🪙</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ad Widget */}
          {!isBroadcast && (
            <AdWidget variant="banner" refreshInterval={20000} />
          )}

          {/* Poll Creator (broadcaster) */}
          {isBroadcast && showPollCreator && (
            <div className="bg-purple-900/20 border border-purple-500/30 rounded-2xl p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-xs flex items-center gap-2 text-purple-300">
                  <TrendingUp className="w-3.5 h-3.5" /> إنشاء استطلاع
                </h3>
                {livePoll && (
                  <button onClick={() => { socketRef.current?.emit("end-poll", id); setLivePoll(null); }}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30 transition">إنهاء</button>
                )}
              </div>
              <input value={pollQuestion} onChange={e => setPollQuestion(e.target.value)}
                placeholder="سؤال الاستطلاع..."
                className="w-full h-8 rounded-lg bg-white/10 text-white placeholder:text-white/40 border border-white/10 px-2 text-xs mb-1.5 focus:outline-none focus:border-purple-400" />
              {pollOptions.map((opt, i) => (
                <div key={i} className="flex gap-1.5 mb-1.5">
                  <input value={opt} onChange={e => { const o = [...pollOptions]; o[i] = e.target.value; setPollOptions(o); }}
                    placeholder={`الخيار ${i + 1}`}
                    className="flex-1 h-8 rounded-lg bg-white/10 text-white placeholder:text-white/40 border border-white/10 px-2 text-xs focus:outline-none focus:border-purple-400" />
                  {i >= 2 && <button onClick={() => setPollOptions(prev => prev.filter((_, j) => j !== i))} className="text-red-400 text-base leading-none">×</button>}
                </div>
              ))}
              <div className="flex gap-1.5 mt-1.5">
                {pollOptions.length < 4 && (
                  <button onClick={() => setPollOptions(prev => [...prev, ""])}
                    className="text-[10px] px-2 py-1 rounded-lg border border-purple-500/40 text-purple-400 hover:bg-purple-900/20 transition">+ خيار</button>
                )}
                <button onClick={handleCreatePoll}
                  className="flex-1 h-8 rounded-lg bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 transition">إطلاق 🚀</button>
              </div>
            </div>
          )}

          {/* Live Poll (viewers) */}
          {livePoll && !isBroadcast && (
            <div className="bg-purple-900/20 border border-purple-500/30 rounded-2xl p-3">
              <h3 className="font-bold text-xs text-purple-300 mb-2 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" /> استطلاع مباشر
              </h3>
              <p className="text-sm text-white font-semibold mb-2">{livePoll.question}</p>
              <div className="space-y-1.5">
                {livePoll.options.map((opt, i) => {
                  const pct = livePoll.totalVotes > 0 ? Math.round((opt.votes / livePoll.totalVotes) * 100) : 0;
                  return (
                    <button key={i} onClick={() => handleVotePoll(i)} disabled={votedPollOption !== null}
                      className={`w-full relative flex items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition border overflow-hidden ${
                        votedPollOption === i ? "border-purple-500 bg-purple-700/30 text-purple-200" :
                        votedPollOption !== null ? "border-white/10 bg-white/5 opacity-60 cursor-not-allowed" :
                        "border-white/10 hover:border-purple-400/50 hover:bg-purple-900/20 cursor-pointer text-white"
                      }`}>
                      {votedPollOption !== null && <div className="absolute inset-y-0 start-0 bg-purple-500/20 rounded-lg" style={{ width: `${pct}%` }} />}
                      <span className="relative">{opt.text}</span>
                      {votedPollOption !== null && <span className="relative font-bold text-purple-300">{pct}%</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Broadcaster Settings */}
          {isBroadcast && !streaming && (
            <div className="bg-white/5 rounded-2xl p-3">
              <h3 className="font-bold mb-2 flex items-center gap-2 text-xs text-white"><Settings className="w-3.5 h-3.5" /> إعدادات البث</h3>
              <div className="space-y-2">
                <Select value={quality} onValueChange={(v) => setQuality(v as any)}>
                  <SelectTrigger className="rounded-lg h-8 text-xs bg-white/10 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1080p">🔥 1080p Full HD</SelectItem>
                    <SelectItem value="720p">⚡ 720p HD</SelectItem>
                    <SelectItem value="480p">📱 480p</SelectItem>
                    <SelectItem value="360p">📶 360p</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex gap-1.5">
                  <button onClick={() => setSourceMode("camera")}
                    className={`flex-1 h-8 rounded-lg text-xs font-medium flex items-center justify-center gap-1 border transition ${sourceMode === "camera" ? "bg-primary text-white border-primary" : "border-white/10 text-white/60 hover:bg-white/10"}`}>
                    <Camera className="w-3 h-3" /> كاميرا
                  </button>
                  <button onClick={() => setSourceMode("screen")}
                    className={`flex-1 h-8 rounded-lg text-xs font-medium flex items-center justify-center gap-1 border transition ${sourceMode === "screen" ? "bg-primary text-white border-primary" : "border-white/10 text-white/60 hover:bg-white/10"}`}>
                    <Monitor className="w-3 h-3" /> شاشة
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Full Chat (desktop) */}
          <div className="flex-1 bg-white/5 rounded-2xl overflow-hidden flex flex-col" style={{ minHeight: 300 }}>
            <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5"><MessageCircle className="w-3.5 h-3.5 text-primary" /> الدردشة</span>
              <Badge variant="secondary" className="text-[10px] bg-white/10 text-white/60 border-0"><Users className="w-2.5 h-2.5 ml-1" />{viewerCount}</Badge>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1" ref={chatEndRef}>
              {messages.length === 0 && (
                <p className="text-center text-white/30 text-xs pt-8">كن أول من يتفاعل! 💬</p>
              )}
              {messages.map((msg, i) => (
                <div key={i} className="group flex items-start gap-1.5">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0 mt-0.5 ${msg.isOwner ? "bg-red-500" : "bg-gradient-to-br from-primary to-secondary"}`}>
                    {msg.isOwner ? "🎙" : msg.userName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className={`text-[10px] font-bold ${msg.isOwner ? "text-red-400" : "text-yellow-300"}`}>
                      {msg.userName}{msg.isOwner ? " 🔴" : ""}{" "}
                    </span>
                    {msg.isVoice && msg.voiceUrl ? (
                      <audio controls src={msg.voiceUrl} className="h-5 max-w-[140px]" style={{ height: 20 }} />
                    ) : (
                      <span className="text-xs text-white/80 break-words">{msg.message}</span>
                    )}
                  </div>
                  {isBroadcast && !msg.isVoice && (
                    <button onClick={() => handlePinMessage(msg)}
                      className="opacity-0 group-hover:opacity-100 text-[9px] text-white/40 hover:text-yellow-400 transition-all">📌</button>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop chat input */}
            {user ? (
              <div className="p-2 border-t border-white/10 space-y-1.5">
                {(chatIsRecording || chatIsUploading) && (
                  <div className={`flex items-center gap-2 px-2 py-1 rounded-lg text-[10px] ${chatIsUploading ? "bg-blue-900/30 text-blue-300" : "bg-red-900/30 text-red-300"}`}>
                    {chatIsUploading ? <><span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping inline-block" /> إرسال...</> : <><span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse inline-block" /> 🎤 {chatRecordSeconds}ث</>}
                  </div>
                )}
                <div className="flex gap-1.5">
                  <button onClick={() => setShowGiftsPanel(v => !v)}
                    className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm transition ${showGiftsPanel ? "bg-yellow-500" : "bg-white/10 hover:bg-white/20"}`}>🎁</button>
                  <Input value={chatInput} onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendChat()}
                    placeholder="رسالة..." maxLength={200}
                    className="flex-1 h-8 text-xs rounded-full bg-white/10 border-white/10 text-white placeholder:text-white/40"
                    disabled={chatIsRecording || chatIsUploading} />
                  <button onPointerDown={handleChatMicPress} onPointerUp={handleChatMicRelease} onPointerLeave={handleChatMicRelease} onPointerCancel={handleChatMicRelease} onContextMenu={e => e.preventDefault()} style={{ touchAction: "none", userSelect: "none" }}
                    className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 transition ${chatIsRecording ? "bg-red-500 text-white scale-110" : "bg-white/10 hover:bg-white/20 text-white"}`}>
                    {chatIsRecording ? <span className="animate-pulse text-sm">🎙️</span> : <Mic className="w-3.5 h-3.5" />}
                  </button>
                  <Button size="sm" onClick={sendChat} disabled={!chatInput.trim() || chatIsRecording} className="h-8 w-8 p-0 rounded-full flex-shrink-0">
                    <Send className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-2 border-t border-white/10">
                <a href="/login"><Button variant="ghost" size="sm" className="w-full text-xs rounded-full text-white/60 hover:text-white hover:bg-white/10">سجل دخول للمشاركة</Button></a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
