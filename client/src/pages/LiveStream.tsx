import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { io, Socket } from "socket.io-client";
import {
  Mic, MicOff, Video, VideoOff, PhoneOff,
  Eye, Send, ArrowRight, Heart, RotateCcw,
  WifiOff, Volume2, VolumeX, FlipHorizontal,
  Copy, Check, Radio, Monitor, UserPlus, Users,
  Loader2, X, CheckCircle, XCircle,
  Share2, Gift, Flag, AlertTriangle, ShieldOff,
} from "lucide-react";
import { SiWhatsapp, SiFacebook, SiX, SiTelegram, SiInstagram, SiTiktok, SiSnapchat } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

/* ─── ICE servers ─────────────────────────────────────── */
const ICE: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "turn:openrelay.metered.ca:80",    username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443",   username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turns:openrelay.metered.ca:443",  username: "openrelayproject", credential: "openrelayproject" },
];

interface ChatMsg { userName: string; message: string; isOwner?: boolean; }

/* ═══════════════════════════════════════════════════════ */
export default function LiveStream() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const params = new URLSearchParams(window.location.search);
  const isBroadcast = params.get("mode") === "broadcast";

  /* ── state ── */
  const [streaming,       setStreaming]       = useState(false);
  const [viewerCount,     setViewerCount]     = useState(0);
  const [muted,           setMuted]           = useState(false);
  const [videoOff,        setVideoOff]        = useState(false);
  const [liked,           setLiked]           = useState(false);
  const [likesCount,      setLikesCount]      = useState(0);
  const [messages,        setMessages]        = useState<ChatMsg[]>([]);
  const [chatInput,       setChatInput]       = useState("");
  const [audioBlocked,    setAudioBlocked]    = useState(false);
  const [ended,           setEnded]           = useState(false);
  const [camFacing,       setCamFacing]       = useState<"user"|"environment">("user");
  const [cameraError,     setCameraError]     = useState("");
  const [facingSupported, setFacingSupported] = useState(false);

  // Co-host state
  type CoHostStatus = "idle"|"choosing"|"requesting"|"accepted"|"rejected";
  const [coHostStatus,      setCoHostStatus]      = useState<CoHostStatus>("idle");
  const [coHostRequests,    setCoHostRequests]     = useState<{socketId:string; userName:string; withCamera?:boolean}[]>([]);
  const [activeCoHosts,     setActiveCoHosts]      = useState<{socketId:string; name:string; hasCamera?:boolean}[]>([]);
  const [autoAccept,        setAutoAccept]         = useState(false);
  const [mutedCohosts,      setMutedCohosts]       = useState<Set<string>>(new Set());
  const [forceMuted,        setForceMuted]         = useState(false);
  const [guestHasCamera,    setGuestHasCamera]     = useState(true);

  // In-stream ads state
  const [streamAds,       setStreamAds]       = useState<any[]>([]);
  const [currentAdIdx,    setCurrentAdIdx]    = useState(0);
  const [adVisible,       setAdVisible]       = useState(false);
  const [adExpanded,      setAdExpanded]      = useState(false); // expanded bottom-sheet view

  // Video swap state (tap PiP to swap with main screen)
  const [swappedCohostId, setSwappedCohostId] = useState<string>(""); // broadcaster: which cohost is full-screen
  const [selfCamSwapped,  setSelfCamSwapped]  = useState(false);       // viewer: own cam is full-screen

  // Share & Gift state
  const [showShare,       setShowShare]       = useState(false);
  const [showGiftPanel,   setShowGiftPanel]   = useState(false);
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const [rechargeCode,    setRechargeCode]    = useState("");
  const [rechargeLoading, setRechargeLoading] = useState(false);
  // Purchase flow states
  const [purchaseStep,    setPurchaseStep]    = useState<"packages"|"pay"|"done">("packages");
  const [selectedPkg,     setSelectedPkg]     = useState<any>(null);
  const [payMethod,       setPayMethod]       = useState<"vodafone"|"etisalat"|"instapay"|"bank"|"souq"|"installment">("vodafone");
  const [payRef,          setPayRef]          = useState("");
  const [payLoading,      setPayLoading]      = useState(false);
  interface FlyingGift { id: number; emoji: string; x: number; }
  const [flyingGifts,     setFlyingGifts]     = useState<FlyingGift[]>([]);
  const [myCoins,         setMyCoins]         = useState(0); // loaded from DB
  interface GiftBanner { id: number; emoji: string; name: string; coins: number; received: number; userName: string; }
  const [giftBanners,     setGiftBanners]     = useState<GiftBanner[]>([]);

  // Hand raise state (viewer)
  const [handRaised,      setHandRaised]      = useState(false);
  const [handInvited,     setHandInvited]     = useState(false);
  // Hand raise state (broadcaster — list of raised hands)
  const [raisedHands,     setRaisedHands]     = useState<{socketId:string; userName:string; userId:string}[]>([]);
  const [showHandsList,   setShowHandsList]   = useState(false);

  // Cross-stream Battle state
  interface BattleState {
    active: boolean;
    battleId: string;
    streamIdA: string;
    streamIdB: string;
    nameA: string;
    nameB: string;
    timeLeft: number;
    totalA: number;
    totalB: number;
    winner: string|null;
    ended: boolean;
  }
  const [battle, setBattle] = useState<BattleState|null>(null);
  const [showBattleSetup, setShowBattleSetup] = useState(false);
  const [battleInvite, setBattleInvite] = useState<{inviteId:string; fromStreamId:string; fromName:string}|null>(null);
  const [battleInviteSent, setBattleInviteSent] = useState(false);
  const [liveStreamsForBattle, setLiveStreamsForBattle] = useState<any[]>([]);
  const opponentVideoRef = useRef<HTMLVideoElement>(null);
  const battlePeer = useRef<RTCPeerConnection|null>(null);

  // Kicked state
  const [kicked, setKicked] = useState(false);

  // Viewer list (broadcaster)
  const [showViewerList, setShowViewerList] = useState(false);
  const [viewersList, setViewersList] = useState<{socketId:string; userName:string; userId:string}[]>([]);

  // Content moderation (viewer report + broadcaster warning)
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportReason,     setReportReason]     = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportDone,       setReportDone]       = useState(false);
  const [contentWarning,   setContentWarning]   = useState<string|null>(null); // shown to broadcaster
  const [forceEndReason,   setForceEndReason]   = useState<string|null>(null); // force-close overlay

  // RTMP mode state
  const [broadcastMode,   setBroadcastMode]   = useState<"webrtc"|"rtmp">("webrtc");
  const [rtmpKey,         setRtmpKey]         = useState<string>("");
  const [rtmpUrl,         setRtmpUrl]         = useState<string>("rtmp://ads-as.com/live");
  const [copiedKey,       setCopiedKey]       = useState(false);
  const [copiedUrl,       setCopiedUrl]       = useState(false);
  const [hlsUrl,          setHlsUrl]          = useState<string>("");
  const [rtmpSetup,       setRtmpSetup]       = useState(false); // broadcaster done picking mode

  /* ── refs ── */
  const videoRef         = useRef<HTMLVideoElement>(null);
  const hlsVideoRef      = useRef<HTMLVideoElement>(null);
  const socketRef        = useRef<Socket | null>(null);
  const localStream      = useRef<MediaStream | null>(null);
  // Multi-cohost refs (broadcaster side: receives guest streams)
  const coHostPeers      = useRef<Map<string, RTCPeerConnection>>(new Map());
  const coHostStreams     = useRef<Map<string, MediaStream>>(new Map()); // guest→stream received by broadcaster
  const coHostVideoRefs  = useRef<Map<string, HTMLVideoElement>>(new Map());
  const coHostNamesMap   = useRef<Map<string, string>>(new Map()); // for broadcaster to remember names
  // Guest/viewer-side single co-host connection
  const coHostStream     = useRef<MediaStream | null>(null); // my own camera as guest
  const coHostPeer       = useRef<RTCPeerConnection | null>(null);
  const coHostSelfVideo  = useRef<HTMLVideoElement>(null);   // my own PiP video
  const peers            = useRef<Map<string, RTCPeerConnection>>(new Map());
  const streamStarted    = useRef(false);
  const hlsInstance      = useRef<any>(null);

  /* ── stream data ── */
  const { data: stream } = useQuery<any>({
    queryKey: ["/api/streams", id],
    queryFn: () => fetch(`/api/streams/${id}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!id,
    refetchInterval: 5000,
  });

  /* ── coin wallet ── */
  const { data: coinWallet, refetch: refetchWallet } = useQuery<any>({
    queryKey: ["/api/coins/wallet"],
    queryFn: () => fetch("/api/coins/wallet", { credentials: "include" }).then(r => r.json()),
    enabled: !!user,
  });
  const { data: coinPackages } = useQuery<any[]>({
    queryKey: ["/api/coins/packages"],
    queryFn: () => fetch("/api/coins/packages").then(r => r.json()),
  });
  useEffect(() => {
    if (coinWallet?.balance !== undefined) setMyCoins(coinWallet.balance);
  }, [coinWallet?.balance]);

  /* ─── HLS player for viewers (RTMP streams) ─────────── */
  const startHlsPlayer = useCallback(async (url: string) => {
    const video = hlsVideoRef.current || videoRef.current;
    if (!video) return;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari native HLS
      video.src = url;
      video.play().then(() => { setStreaming(true); setAudioBlocked(false); })
           .catch(() => { setStreaming(true); setAudioBlocked(true); });
      return;
    }

    const Hls = (await import("hls.js")).default;
    if (!Hls.isSupported()) return;

    if (hlsInstance.current) hlsInstance.current.destroy();

    const hls = new Hls({
      liveSyncDurationCount: 2,
      liveMaxLatencyDurationCount: 5,
      lowLatencyMode: true,
    });
    hlsInstance.current = hls;
    hls.loadSource(url);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      video.play().then(() => { setStreaming(true); setAudioBlocked(false); })
           .catch(() => { setStreaming(true); setAudioBlocked(true); });
    });
    hls.on(Hls.Events.ERROR, (_e: any, data: any) => {
      if (data.fatal) {
        setEnded(true);
        setStreaming(false);
      }
    });
  }, []);

  /* ─── create WebRTC peer connection ──────────────────── */
  const newPeer = useCallback((remoteId: string): RTCPeerConnection => {
    const pc = new RTCPeerConnection({ iceServers: ICE });
    pc.onicecandidate = e => {
      if (e.candidate) socketRef.current?.emit("candidate", remoteId, e.candidate);
    };
    if (!isBroadcast) {
      pc.ontrack = e => {
        if (videoRef.current && e.streams[0]) {
          videoRef.current.srcObject = e.streams[0];
          videoRef.current.muted = false;
          videoRef.current.play()
            .then(() => { setAudioBlocked(false); setStreaming(true); })
            .catch(() => { setAudioBlocked(true); setStreaming(true); });
        }
      };
    }
    return pc;
  }, [isBroadcast]);

  /* ─── start camera (WebRTC broadcaster) ──────────────── */
  const startCamera = useCallback(async (facing: "user"|"environment" = "user") => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setFacingSupported(devices.filter(d => d.kind === "videoinput").length > 1);
      const ms = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      if (localStream.current) {
        const newVTrack = ms.getVideoTracks()[0];
        peers.current.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === "video");
          if (sender && newVTrack) sender.replaceTrack(newVTrack);
        });
        localStream.current.getTracks().forEach(t => t.stop());
      }
      localStream.current = ms;
      if (videoRef.current) {
        videoRef.current.srcObject = ms;
        videoRef.current.muted = true;
        videoRef.current.play().catch(() => {});
      }
      setCameraError("");
      return ms;
    } catch (err: any) {
      const msg = err.name === "NotAllowedError"
        ? "PERMISSION_DENIED"
        : err.name === "NotFoundError"
          ? "NO_DEVICE"
          : err.name === "NotReadableError"
            ? "DEVICE_BUSY"
            : "GENERIC";
      setCameraError(msg);
      return null;
    }
  }, []);

  /* ─── generate RTMP key ──────────────────────────────── */
  const generateRtmpKey = async () => {
    try {
      const res = await apiRequest("POST", `/api/streams/${id}/key`);
      const data = await res.json();
      setRtmpKey(data.streamKey);
      setRtmpUrl(data.rtmpUrl);
      setHlsUrl(data.hlsUrl);
      await fetch(`/api/streams/${id}/start`, { method: "POST", credentials: "include" });
      socketRef.current?.emit("broadcaster", id);
      setStreaming(true);
      setRtmpSetup(true);
      toast({ title: "🔴 جاهز للبث", description: "أدخل رابط RTMP ومفتاح البث في OBS أو برنامجك" });
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    }
  };

  /* ─── socket + WebRTC ────────────────────────────────── */
  useEffect(() => {
    if (!id) return;

    const socket = io({ path: "/socket.io", transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.on("viewer-count",  (n: number) => setViewerCount(n));
    socket.on("stream-like",   () => setLikesCount(p => p + 1));
    socket.on("chat-message",  (msg: ChatMsg) => setMessages(prev => [...prev.slice(-60), msg]));
    socket.on("connect",       () => socket.emit("join-stream", id));

    if (isBroadcast) {
      socket.on("watcher", async (watcherId: string) => {
        if (!localStream.current) return;
        const pc = newPeer(watcherId);
        peers.current.set(watcherId, pc);
        localStream.current.getTracks().forEach(t => pc.addTrack(t, localStream.current!));
        try {
          const offer = await pc.createOffer({ offerToReceiveAudio: false, offerToReceiveVideo: false });
          await pc.setLocalDescription(offer);
          socket.emit("offer", watcherId, pc.localDescription);
        } catch { /* ignore */ }
      });

      socket.on("answer", async (watcherId: string, answer: RTCSessionDescriptionInit) => {
        const pc = peers.current.get(watcherId);
        if (pc && pc.signalingState === "have-local-offer") {
          await pc.setRemoteDescription(answer).catch(() => {});
        }
      });

      socket.on("candidate", async (fromId: string, candidate: RTCIceCandidateInit) => {
        const pc = peers.current.get(fromId);
        if (pc) await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
      });

      // ── Hand Raise events (broadcaster side) ──
      socket.on("hand-raised", (data: { socketId: string; userName: string; userId: string }) => {
        setRaisedHands(prev => [...prev.filter(h => h.socketId !== data.socketId), data]);
        toast({ title: "✋ رفع إيده", description: `${data.userName} يريد التحدث` });
        setShowHandsList(true);
      });

      socket.on("hand-lowered", (data: { socketId: string }) => {
        setRaisedHands(prev => prev.filter(h => h.socketId !== data.socketId));
      });

      // ── Co-host events (broadcaster side) ──
      socket.on("cohost-request", (data: { socketId: string; userName: string; withCamera?: boolean }) => {
        coHostNamesMap.current.set(data.socketId, data.userName);
        setCoHostRequests(prev => [...prev.filter(r => r.socketId !== data.socketId), data]);
        const mode = data.withCamera === false ? "🎙️ صوت فقط" : "📷 صوت وصورة";
        toast({ title: "طلب كاميرا", description: `${data.userName} يريد الانضمام (${mode})` });
      });

      socket.on("cohost-auto-joined", (data: { socketId: string; userName: string; withCamera?: boolean }) => {
        coHostNamesMap.current.set(data.socketId, data.userName);
        setActiveCoHosts(prev => [...prev.filter(c => c.socketId !== data.socketId), { socketId: data.socketId, name: data.userName, hasCamera: data.withCamera !== false }]);
        toast({ title: `✅ ${data.userName} انضم تلقائياً`, description: "الضيف دخل البث" });
      });

      socket.on("cohost-offer", async (fromId: string, offer: RTCSessionDescriptionInit) => {
        // Close old peer for this socket if any
        coHostPeers.current.get(fromId)?.close();

        const pc = new RTCPeerConnection({ iceServers: ICE });
        coHostPeers.current.set(fromId, pc);

        pc.onicecandidate = e => {
          if (e.candidate) socket.emit("cohost-candidate", fromId, e.candidate);
        };
        pc.ontrack = e => {
          if (!e.streams[0]) return;
          coHostStreams.current.set(fromId, e.streams[0]);
          const videoEl = coHostVideoRefs.current.get(fromId);
          if (videoEl) { videoEl.srcObject = e.streams[0]; videoEl.play().catch(() => {}); }
        };
        if (localStream.current) {
          localStream.current.getTracks().forEach(t => pc.addTrack(t, localStream.current!));
        }
        await pc.setRemoteDescription(offer).catch(() => {});
        const answer = await pc.createAnswer().catch(() => null);
        if (!answer) return;
        await pc.setLocalDescription(answer).catch(() => {});
        socket.emit("cohost-answer", fromId, pc.localDescription);

        const name = coHostNamesMap.current.get(fromId) || "ضيف";
        setActiveCoHosts(prev => [...prev.filter(c => c.socketId !== fromId), { socketId: fromId, name }]);
      });

      socket.on("cohost-candidate", async (fromId: string, candidate: RTCIceCandidateInit) => {
        const pc = coHostPeers.current.get(fromId) || coHostPeer.current;
        if (pc) await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
      });

      socket.on("cohost-left", (socketId: string) => {
        setCoHostRequests(prev => prev.filter(r => r.socketId !== socketId));
        setActiveCoHosts(prev => prev.filter(c => c.socketId !== socketId));
        const pc = coHostPeers.current.get(socketId);
        if (pc) { pc.close(); coHostPeers.current.delete(socketId); }
        coHostStreams.current.delete(socketId);
        coHostVideoRefs.current.delete(socketId);
        coHostNamesMap.current.delete(socketId);
        toast({ title: "انتهى الانضمام", description: "غادر أحد الضيوف البث" });
      });
    }

    if (!isBroadcast) {
      // Check if this stream is RTMP
      fetch(`/api/streams/${id}/hls-status`, { credentials: "include" })
        .then(r => r.json())
        .then(data => {
          if (data.live && data.hlsUrl) {
            startHlsPlayer(data.hlsUrl);
          }
        })
        .catch(() => {});

      // Check existing stream_mode from DB
      fetch(`/api/streams/${id}`, { credentials: "include" })
        .then(r => r.json())
        .then(s => {
          if (s.streamMode === "rtmp" && s.status === "live") {
            fetch(`/api/streams/${id}/hls-status`)
              .then(r => r.json())
              .then(d => { if (d.live && d.hlsUrl) startHlsPlayer(d.hlsUrl); });
          }
        });

      socket.on("broadcaster", () => { socket.emit("watcher", id); });

      socket.on("offer", async (bcastId: string, offer: RTCSessionDescriptionInit) => {
        let pc = peers.current.get(bcastId);
        if (!pc) { pc = newPeer(bcastId); peers.current.set(bcastId, pc); }
        try {
          await pc.setRemoteDescription(offer);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit("answer", bcastId, pc.localDescription);
        } catch { /* ignore */ }
      });

      socket.on("candidate", async (fromId: string, candidate: RTCIceCandidateInit) => {
        const pc = peers.current.get(fromId);
        if (pc) await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
      });

      socket.on("broadcaster-disconnected", () => {
        setStreaming(false);
        setEnded(true);
        if (hlsInstance.current) { hlsInstance.current.destroy(); hlsInstance.current = null; }
      });

      // ── Co-host events (viewer/guest side) ──
      socket.on("cohost-accepted", async (data: { broadcasterId: string }) => {
        setCoHostStatus("accepted");

        // Use the stream we already opened in requestCoHost (user-gesture context)
        // If for some reason it's missing, abort gracefully
        const ms = coHostStream.current;
        if (!ms) {
          setCoHostStatus("idle");
          toast({ title: "تعذّر فتح الكاميرا", description: "حاول مرة أخرى", variant: "destructive" });
          return;
        }

        // Make sure PiP is showing our own camera
        if (coHostSelfVideo.current && !coHostSelfVideo.current.srcObject) {
          coHostSelfVideo.current.srcObject = ms;
          coHostSelfVideo.current.muted = true;
          coHostSelfVideo.current.play().catch(() => {});
        }

        // Build WebRTC connection with broadcaster
        const pc = new RTCPeerConnection({ iceServers: ICE });
        coHostPeer.current = pc;

        pc.onicecandidate = e => {
          if (e.candidate) socket.emit("cohost-candidate", data.broadcasterId, e.candidate);
        };

        ms.getTracks().forEach(t => pc.addTrack(t, ms));

        const offer = await pc.createOffer().catch(() => null);
        if (!offer) return;
        await pc.setLocalDescription(offer).catch(() => {});
        socket.emit("cohost-offer", data.broadcasterId, pc.localDescription);
        socket.emit("cohost-broadcaster", { streamId: id, name: `${(user as any)?.firstName || ""} ${(user as any)?.lastName || ""}`.trim() || "ضيف" });

        toast({ title: "🎙️ أنت على الهواء كضيف!", description: "المُذيع يسمعك ويشوفك الآن" });
      });

      socket.on("cohost-answer", async (_fromId: string, answer: RTCSessionDescriptionInit) => {
        if (coHostPeer.current) await coHostPeer.current.setRemoteDescription(answer).catch(() => {});
      });

      socket.on("cohost-candidate", async (_fromId: string, candidate: RTCIceCandidateInit) => {
        if (coHostPeer.current) await coHostPeer.current.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
      });

      socket.on("cohost-rejected", () => {
        setCoHostStatus("rejected");
        toast({ title: "تم رفض طلبك", description: "المُذيع لم يقبل مشاركتك", variant: "destructive" });
        setTimeout(() => setCoHostStatus("idle"), 3000);
      });

      socket.on("auto-accept-changed", (enabled: boolean) => {
        setAutoAccept(enabled);
      });

      // Broadcaster force-mutes/unmutes this guest
      socket.on("force-muted", (muted: boolean) => {
        setForceMuted(muted);
        const audioTrack = coHostStream.current?.getAudioTracks()[0];
        if (audioTrack) audioTrack.enabled = !muted;
        toast({ title: muted ? "🔇 تم كتم ميكروفونك من المذيع" : "🎙️ فعّل المذيع ميكروفونك" });
      });

      // Hand raise events (viewer side)
      socket.on("hand-raise-confirmed", () => {
        setHandRaised(true);
      });

      socket.on("hand-invite", (data: { broadcasterId: string }) => {
        setHandInvited(true);
        setHandRaised(false);
        toast({ title: "🎉 دعوة من المذيع!", description: "المذيع دعاك للتحدث — انضم كضيف الآن" });
      });

      socket.on("hand-dismissed", () => {
        setHandRaised(false);
        toast({ title: "تم رفض طلبك", description: "المذيع لم يقبل طلبك حالياً" });
      });

      // Broadcaster removed this guest
      socket.on("cohost-removed", () => {
        setCoHostStatus("idle");
        coHostStream.current?.getTracks().forEach(t => t.stop());
        coHostStream.current = null;
        if (coHostPeer.current) { coHostPeer.current.close(); coHostPeer.current = null; }
        toast({ title: "تمت إزالتك من البث", variant: "destructive" });
      });
    }

    // ── Gift events (both broadcaster and viewer) ──
    socket.on("stream-gift", (data: { id: number; giftEmoji: string; giftName: string; giftCoins: number; userName: string }) => {
      const x = 10 + Math.random() * 60;
      const flyId = Date.now() + Math.random();
      setFlyingGifts(prev => [...prev, { id: flyId, emoji: data.giftEmoji, x }]);
      setTimeout(() => setFlyingGifts(prev => prev.filter(g => g.id !== flyId)), 3000);
      if (isBroadcast) {
        const receivedCoins = Math.floor(data.giftCoins * 0.6);
        const bannerId = Date.now() + Math.random();
        setGiftBanners(prev => [...prev.slice(-3), { id: bannerId, emoji: data.giftEmoji, name: data.giftName, coins: data.giftCoins, received: receivedCoins, userName: data.userName }]);
        setTimeout(() => setGiftBanners(prev => prev.filter(b => b.id !== bannerId)), 5000);
        try {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = "sine";
          gain.gain.setValueAtTime(0.3, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
          osc.frequency.setValueAtTime(880, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1);
          osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.2);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.4);
          setTimeout(() => {
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.type = "sine";
            gain2.gain.setValueAtTime(0.25, ctx.currentTime);
            gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
            osc2.frequency.setValueAtTime(1320, ctx.currentTime);
            osc2.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.15);
            osc2.start(ctx.currentTime);
            osc2.stop(ctx.currentTime + 0.3);
          }, 200);
        } catch {}
      }
    });

    // ── Content moderation events ──────────────────────────────────
    socket.on("stream-content-warning", (data: { count: number; message: string }) => {
      setContentWarning(data.message);
      // Auto-dismiss after 15 seconds
      setTimeout(() => setContentWarning(null), 15000);
    });

    socket.on("stream-force-ended", (data: { reason: string }) => {
      setForceEndReason(data.reason);
      localStream.current?.getTracks().forEach(t => t.stop());
    });

    socket.on("kicked-from-stream", () => {
      setKicked(true);
      localStream.current?.getTracks().forEach(t => t.stop());
      coHostStream.current?.getTracks().forEach(t => t.stop());
      if (coHostPeer.current) { coHostPeer.current.close(); coHostPeer.current = null; }
    });

    socket.on("viewer-list", (list: {socketId:string; userName:string; userId:string}[]) => {
      setViewersList(list);
    });

    socket.on("battle-invite-received", (data: { inviteId: string; fromStreamId: string; fromName: string }) => {
      setBattleInvite(data);
    });

    socket.on("battle-invite-sent", () => {
      setBattleInviteSent(true);
    });

    socket.on("battle-invite-expired", () => {
      setBattleInviteSent(false);
      toast({ title: "انتهت مهلة الدعوة", description: "لم يرد المذيع الآخر في الوقت المحدد", variant: "destructive" });
    });

    socket.on("battle-invite-declined", () => {
      setBattleInviteSent(false);
      toast({ title: "تم رفض التحدي", description: "المذيع الآخر رفض الجولة", variant: "destructive" });
    });

    socket.on("battle-started", (data: any) => {
      setBattleInvite(null);
      setBattleInviteSent(false);
      setShowBattleSetup(false);
      setBattle({
        active: true, battleId: data.battleId,
        streamIdA: data.streamIdA, streamIdB: data.streamIdB,
        nameA: data.nameA, nameB: data.nameB,
        timeLeft: data.duration || 300, totalA: 0, totalB: 0,
        winner: null, ended: false,
      });
      const opponentStreamId = data.streamIdA === id ? data.streamIdB : data.streamIdA;
      socket.emit("battle-watch-opponent", { myStreamId: id, opponentStreamId });
    });

    socket.on("battle-score-update", (data: { totalA: number; totalB: number }) => {
      setBattle(prev => prev ? { ...prev, totalA: data.totalA, totalB: data.totalB } : prev);
    });

    socket.on("battle-timer", (data: { timeLeft: number }) => {
      setBattle(prev => prev ? { ...prev, timeLeft: data.timeLeft } : prev);
    });

    socket.on("battle-ended", (data: { winner: string; totalA: number; totalB: number; nameA: string; nameB: string }) => {
      setBattle(prev => prev ? { ...prev, active: false, ended: true, winner: data.winner, totalA: data.totalA, totalB: data.totalB } : prev);
      if (battlePeer.current) { battlePeer.current.close(); battlePeer.current = null; }
      setTimeout(() => setBattle(null), 10000);
    });

    socket.on("battle-watcher", async (watcherId: string) => {
      if (!localStream.current) return;
      const pc = new RTCPeerConnection({ iceServers: ICE });
      peers.current.set(`battle_${watcherId}`, pc);
      pc.onicecandidate = e => { if (e.candidate) socket.emit("battle-candidate", watcherId, e.candidate); };
      localStream.current.getTracks().forEach(t => pc.addTrack(t, localStream.current!));
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("battle-offer", watcherId, pc.localDescription);
      } catch {}
    });

    socket.on("battle-offer", async (fromId: string, offer: RTCSessionDescriptionInit) => {
      if (battlePeer.current) battlePeer.current.close();
      const pc = new RTCPeerConnection({ iceServers: ICE });
      battlePeer.current = pc;
      pc.onicecandidate = e => { if (e.candidate) socket.emit("battle-candidate", fromId, e.candidate); };
      pc.ontrack = e => {
        if (opponentVideoRef.current && e.streams[0]) {
          opponentVideoRef.current.srcObject = e.streams[0];
          opponentVideoRef.current.play().catch(() => {});
        }
      };
      await pc.setRemoteDescription(offer).catch(() => {});
      const answer = await pc.createAnswer().catch(() => null);
      if (!answer) return;
      await pc.setLocalDescription(answer);
      socket.emit("battle-answer", fromId, pc.localDescription);
    });

    socket.on("battle-answer", async (fromId: string, answer: RTCSessionDescriptionInit) => {
      const pc = peers.current.get(`battle_${fromId}`) || battlePeer.current;
      if (pc && pc.signalingState === "have-local-offer") {
        await pc.setRemoteDescription(answer).catch(() => {});
      }
    });

    socket.on("battle-candidate", async (fromId: string, candidate: RTCIceCandidateInit) => {
      const pc = peers.current.get(`battle_${fromId}`) || battlePeer.current;
      if (pc) await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
    });

    return () => {
      socket.emit("leave-stream", id);
      if (!isBroadcast && coHostStatus === "accepted") socket.emit("cohost-leave", id);
      socket.disconnect();
      localStream.current?.getTracks().forEach(t => t.stop());
      coHostStream.current?.getTracks().forEach(t => t.stop());
      if (coHostPeer.current) { coHostPeer.current.close(); coHostPeer.current = null; }
      coHostPeers.current.forEach(pc => pc.close());
      coHostPeers.current.clear();
      coHostStreams.current.clear();
      peers.current.forEach(pc => pc.close());
      peers.current.clear();
      if (battlePeer.current) { battlePeer.current.close(); battlePeer.current = null; }
      if (hlsInstance.current) { hlsInstance.current.destroy(); hlsInstance.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isBroadcast]);

  /* ─── In-stream ads ─────────────────────────────────── */
  useEffect(() => {
    if (!streaming) return;
    // Fetch a pool of active ads — boosted/promo first
    fetch("/api/ads?limit=40&status=active", { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        const ads = Array.isArray(data) ? data : (data.ads || []);
        const imageAds = ads.filter((a: any) => a.media_type === "image" || !a.media_type);
        // Sort: boosted & promo ads appear first, then regular
        const sorted = [...imageAds].sort((a: any, b: any) => {
          const aScore = (a.is_boosted ? 2 : 0) + (a.is_admin_promo ? 1 : 0);
          const bScore = (b.is_boosted ? 2 : 0) + (b.is_admin_promo ? 1 : 0);
          return bScore - aScore;
        });
        if (sorted.length > 0) setStreamAds(sorted);
      })
      .catch(() => {});
  }, [streaming]);

  useEffect(() => {
    if (streamAds.length === 0 || !streaming) return;
    // Show first ad after 15 seconds
    const showTimer = setTimeout(() => setAdVisible(true), 15000);
    return () => clearTimeout(showTimer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamAds, streaming]);

  useEffect(() => {
    if (!adVisible || streamAds.length === 0) return;
    // Hide ad after 8 seconds, then show next ad after 30 more seconds
    const hideTimer = setTimeout(() => {
      setAdVisible(false);
      const nextTimer = setTimeout(() => {
        setCurrentAdIdx(prev => (prev + 1) % streamAds.length);
        setAdVisible(true);
      }, 30000);
      return () => clearTimeout(nextTimer);
    }, 8000);
    return () => clearTimeout(hideTimer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adVisible, streamAds]);

  /* ─── auto-start WebRTC camera ──────────────────────── */
  useEffect(() => {
    if (!isBroadcast || broadcastMode !== "webrtc" || streamStarted.current) return;
    streamStarted.current = true;
    (async () => {
      const ms = await startCamera(camFacing);
      if (!ms) return;
      setStreaming(true);
      socketRef.current?.emit("broadcaster", id);
      await fetch(`/api/streams/${id}/start`, { method: "POST", credentials: "include" }).catch(() => {});
      toast({ title: "🔴 البث مباشر الآن", description: "أنت على الهواء — يمكن للمشاهدين رؤيتك الآن" });
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [broadcastMode]);

  /* ─── controls ───────────────────────────────────────── */
  const flipCamera = async () => {
    const next: "user"|"environment" = camFacing === "user" ? "environment" : "user";
    setCamFacing(next);
    await startCamera(next);
  };

  const toggleMute = () => {
    const t = localStream.current?.getAudioTracks()[0];
    if (t) { t.enabled = !t.enabled; setMuted(!t.enabled); }
  };

  const toggleVideo = () => {
    const t = localStream.current?.getVideoTracks()[0];
    if (t) { t.enabled = !t.enabled; setVideoOff(!t.enabled); }
  };

  const endStream = async () => {
    await fetch(`/api/streams/${id}/end`, { method: "POST", credentials: "include" }).catch(() => {});
    localStream.current?.getTracks().forEach(t => t.stop());
    queryClient.invalidateQueries({ queryKey: ["/api/streams"] });
    setLocation("/livestream");
  };

  const sendChat = () => {
    if (!chatInput.trim() || !user) return;
    const userName = `${(user as any).firstName || ""} ${(user as any).lastName || ""}`.trim() || "مستخدم";
    socketRef.current?.emit("chat-message", {
      streamId: id, userId: user.id, userName,
      message: chatInput.trim(), isOwner: isBroadcast,
    });
    setChatInput("");
  };

  const handleLike = () => {
    if (liked) return;
    setLiked(true);
    socketRef.current?.emit("stream-like", id);
  };

  /* ─── Co-host helpers ────────────────────────────────── */
  const requestCoHost = () => {
    if (!user) return;
    setCoHostStatus("choosing");
  };

  const joinAsCoHost = async (withCamera: boolean) => {
    if (!user) return;
    setGuestHasCamera(withCamera);
    setCoHostStatus("requesting");

    const constraints = withCamera
      ? { video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: { echoCancellation: true, noiseSuppression: true } }
      : { video: false, audio: { echoCancellation: true, noiseSuppression: true } };

    toast({ title: withCamera ? "📷 جاري فتح الكاميرا..." : "🎙️ جاري فتح الميكروفون...", description: "اسمح للمتصفح بالوصول" });

    const ms = await navigator.mediaDevices.getUserMedia(constraints).catch((err) => {
      console.error("getUserMedia error:", err);
      return null;
    });

    if (!ms) {
      setCoHostStatus("idle");
      toast({ title: "تعذّر فتح الميكروفون", description: "اسمح للمتصفح بالوصول ثم حاول مجدداً", variant: "destructive" });
      return;
    }

    coHostStream.current = ms;

    if (withCamera && coHostSelfVideo.current) {
      coHostSelfVideo.current.srcObject = ms;
      coHostSelfVideo.current.muted = true;
      coHostSelfVideo.current.play().catch(() => {});
    }

    const userName = `${(user as any).firstName || ""} ${(user as any).lastName || ""}`.trim() || "مستخدم";
    socketRef.current?.emit("request-cohost", { streamId: id, userId: (user as any).id, userName, withCamera });
    toast({ title: "⏳ تم إرسال الطلب", description: "في انتظار موافقة المُذيع" });
  };

  const toggleMuteCohost = (socketId: string) => {
    const currentlyMuted = mutedCohosts.has(socketId);
    const nextMuted = !currentlyMuted;
    socketRef.current?.emit("force-mute-cohost", { streamId: id, guestSocketId: socketId, muted: nextMuted });
    setMutedCohosts(prev => {
      const next = new Set(prev);
      if (nextMuted) next.add(socketId); else next.delete(socketId);
      return next;
    });
  };

  const leaveCoHost = () => {
    socketRef.current?.emit("cohost-leave", id);
    setCoHostStatus("idle");
    coHostStream.current?.getTracks().forEach(t => t.stop());
    coHostStream.current = null;
    if (coHostPeer.current) { coHostPeer.current.close(); coHostPeer.current = null; }
    if (coHostSelfVideo.current) coHostSelfVideo.current.srcObject = null;
  };

  const acceptCoHost = (socketId: string, userName: string) => {
    const req = coHostRequests.find(r => r.socketId === socketId);
    socketRef.current?.emit("accept-cohost", { streamId: id, guestSocketId: socketId, guestName: userName });
    setCoHostRequests(prev => prev.filter(r => r.socketId !== socketId));
    setActiveCoHosts(prev => [...prev.filter(c => c.socketId !== socketId), { socketId, name: userName, hasCamera: req?.withCamera !== false }]);
  };

  const rejectCoHost = (socketId: string) => {
    socketRef.current?.emit("reject-cohost", { guestSocketId: socketId });
    setCoHostRequests(prev => prev.filter(r => r.socketId !== socketId));
  };

  const endCoHostFromBroadcaster = (socketId: string) => {
    const pc = coHostPeers.current.get(socketId);
    if (pc) { pc.close(); coHostPeers.current.delete(socketId); }
    coHostStreams.current.delete(socketId);
    coHostVideoRefs.current.delete(socketId);
    setActiveCoHosts(prev => prev.filter(c => c.socketId !== socketId));
    // Notify guest they've been removed
    socketRef.current?.emit("reject-cohost", { guestSocketId: socketId });
  };

  const toggleAutoAccept = () => {
    const newVal = !autoAccept;
    setAutoAccept(newVal);
    socketRef.current?.emit("set-auto-accept", { streamId: id, enabled: newVal });
    toast({ title: newVal ? "✅ القبول التلقائي مفعّل" : "القبول التلقائي معطّل", description: newVal ? "كل من يطلب سيدخل مباشرة" : "ستراجع طلبات الكاميرا يدوياً" });
  };

  /* ─── Hand Raise helpers ─────────────────────────────── */
  const raiseHand = () => {
    if (!user) return;
    const userName = `${(user as any).firstName || ""} ${(user as any).lastName || ""}`.trim() || "مستخدم";
    socketRef.current?.emit("raise-hand", { streamId: id, userId: (user as any).id, userName });
  };

  const lowerHand = () => {
    setHandRaised(false);
    socketRef.current?.emit("lower-hand", { streamId: id });
  };

  const inviteRaisedHand = (socketId: string) => {
    socketRef.current?.emit("invite-raised-hand", { streamId: id, guestSocketId: socketId });
    setRaisedHands(prev => prev.filter(h => h.socketId !== socketId));
  };

  const dismissHand = (socketId: string) => {
    socketRef.current?.emit("dismiss-hand", { streamId: id, guestSocketId: socketId });
    setRaisedHands(prev => prev.filter(h => h.socketId !== socketId));
  };

  /* ─── Kick viewer helper (broadcaster) ──────────────── */
  const kickViewer = (socketId: string) => {
    socketRef.current?.emit("kick-viewer", { streamId: id, viewerSocketId: socketId });
    setViewersList(prev => prev.filter(v => v.socketId !== socketId));
    toast({ title: "تم طرد المشاهد" });
  };

  const requestViewerList = () => {
    socketRef.current?.emit("get-viewer-list", { streamId: id });
    setShowViewerList(true);
  };

  /* ─── Cross-Stream Battle helpers ──────────────────── */
  const MAX_COHOSTS = 8;

  const fetchLiveStreamsForBattle = async () => {
    try {
      const res = await fetch("/api/streams?status=live", { credentials: "include" });
      const streams = await res.json();
      setLiveStreamsForBattle((streams || []).filter((s: any) => String(s.id) !== String(id)));
    } catch { setLiveStreamsForBattle([]); }
  };

  const sendBattleInvite = (targetStreamId: string) => {
    if (!user) return;
    const userName = `${(user as any).firstName || ""} ${(user as any).lastName || ""}`.trim() || "المذيع";
    socketRef.current?.emit("battle-invite", {
      fromStreamId: id, toStreamId: String(targetStreamId),
      fromName: userName, fromUserId: (user as any).id,
    });
  };

  const acceptBattleInvite = () => {
    if (!battleInvite || !user) return;
    const userName = `${(user as any).firstName || ""} ${(user as any).lastName || ""}`.trim() || "المذيع";
    socketRef.current?.emit("battle-accept", {
      inviteId: battleInvite.inviteId, myName: userName, myUserId: (user as any).id,
    });
    setBattleInvite(null);
  };

  const declineBattleInvite = () => {
    if (!battleInvite) return;
    socketRef.current?.emit("battle-decline", { inviteId: battleInvite.inviteId });
    setBattleInvite(null);
  };

  const endBattleEarly = () => {
    socketRef.current?.emit("battle-end-early", { streamId: id });
  };

  const BATTLE_MULTIPLIERS = [
    { label: "x2", value: 2, color: "bg-blue-500", emoji: "⚡" },
    { label: "x3", value: 3, color: "bg-purple-500", emoji: "🔥" },
    { label: "x5", value: 5, color: "bg-yellow-500", emoji: "💥" },
  ];

  const sendBattleGift = (gift: typeof GIFTS[0], multiplier: number) => {
    if (!user) return;
    if (myCoins < gift.coins) {
      toast({ title: "عملاتك غير كافية", description: `تحتاج ${gift.coins} عملة — رصيدك ${myCoins}`, variant: "destructive" });
      return;
    }
    const userName = `${(user as any).firstName || ""} ${(user as any).lastName || ""}`.trim() || "مستخدم";
    socketRef.current?.emit("battle-gift", {
      streamId: id, giftType: gift.type, giftEmoji: gift.emoji,
      giftName: gift.name, giftCoins: gift.coins, userName, userId: (user as any).id,
      multiplier,
    });
    setMyCoins(prev => prev - gift.coins);
    setTimeout(() => refetchWallet(), 1500);
  };

  /* ─── Coin recharge helper ────────────────────────────── */
  const redeemCoinCode = async () => {
    if (!rechargeCode.trim()) return;
    setRechargeLoading(true);
    try {
      const res = await apiRequest("POST", "/api/coins/redeem", { code: rechargeCode.trim() });
      const data = await res.json();
      if (res.ok) {
        toast({ title: "✅ تم الشحن!", description: data.message });
        setRechargeCode("");
        setShowRechargeModal(false);
        refetchWallet();
      } else {
        toast({ title: "خطأ", description: data.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "خطأ في الاتصال", variant: "destructive" });
    }
    setRechargeLoading(false);
  };

  /* ─── Submit coin purchase order ──────────────────────── */
  const submitPurchaseOrder = async () => {
    if (!selectedPkg) return;
    if (!payRef.trim()) {
      toast({ title: "أدخل رقم مرجع الدفع", variant: "destructive" });
      return;
    }
    setPayLoading(true);
    try {
      const userName = user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : "";
      const res = await apiRequest("POST", "/api/coins/purchase-order", {
        packageId: selectedPkg.id,
        coins: selectedPkg.coins + (selectedPkg.bonus_coins || 0),
        amountEGP: selectedPkg.price_egp,
        paymentMethod:
          payMethod === "vodafone" ? "فودافون كاش"
          : payMethod === "etisalat" ? "اتصالات كاش"
          : payMethod === "instapay" ? "إنستاباي"
          : payMethod === "souq" ? "سوق ماركات"
          : payMethod === "installment" ? "تقسيط فيزا"
          : "تحويل بنكي",
        paymentRef: payRef.trim(),
        userName,
      });
      const data = await res.json();
      if (res.ok) {
        setPurchaseStep("done");
      } else {
        toast({ title: "خطأ", description: data.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "خطأ في الاتصال", variant: "destructive" });
    }
    setPayLoading(false);
  };

  /* ─── Gift helpers ────────────────────────────────────── */
  const GIFTS = [
    { type: "rose",    emoji: "🌹", name: "وردة",      coins: 5   },
    { type: "heart",   emoji: "❤️", name: "قلب",       coins: 10  },
    { type: "star",    emoji: "⭐", name: "نجمة",      coins: 20  },
    { type: "crown",   emoji: "👑", name: "تاج",       coins: 50  },
    { type: "fire",    emoji: "🔥", name: "نار",       coins: 30  },
    { type: "diamond", emoji: "💎", name: "ألماسة",    coins: 100 },
    { type: "clap",    emoji: "👏", name: "تصفيق",     coins: 5   },
    { type: "rocket",  emoji: "🚀", name: "صاروخ",     coins: 75  },
  ];

  const sendGift = (gift: typeof GIFTS[0]) => {
    if (!user) return;
    if (myCoins < gift.coins) {
      toast({ title: "عملاتك غير كافية", description: `تحتاج ${gift.coins} عملة — رصيدك ${myCoins}`, variant: "destructive" });
      return;
    }
    const userName = `${(user as any).firstName || ""} ${(user as any).lastName || ""}`.trim() || "مستخدم";
    socketRef.current?.emit("send-gift", {
      streamId: id, giftType: gift.type, giftEmoji: gift.emoji,
      giftName: gift.name, giftCoins: gift.coins, userName, userId: (user as any).id,
      broadcasterUserId: stream?.userId,
    });
    setMyCoins(prev => prev - gift.coins);
    // Sync wallet from server after a short delay
    setTimeout(() => refetchWallet(), 1500);
  };

  /* ─── Share helpers ───────────────────────────────────── */
  const { data: myReferralData } = useQuery<{ code: string }>({
    queryKey: ["/api/auth/me/referral"],
    queryFn: () => fetch("/api/auth/me/referral", { credentials: "include" }).then(r => r.json()),
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
  });
  const myRefCode = myReferralData?.code;
  const streamUrl = typeof window !== "undefined" ? `${window.location.origin}/streams/${id}` : "";
  const streamShareUrl = myRefCode ? `${streamUrl}?ref=${myRefCode}` : streamUrl;
  const shareText = encodeURIComponent(
    `شاهد البث المباشر على شبكة سوق! ${streamShareUrl}` +
    (myRefCode ? ` 🎁 كود الإحالة: ${myRefCode}` : "")
  );
  const shareLinks = [
    { icon: SiWhatsapp,   label: "واتساب",    color: "#25D366", href: `https://wa.me/?text=${shareText}` },
    { icon: SiFacebook,   label: "فيسبوك",    color: "#1877F2", href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(streamShareUrl)}` },
    { icon: SiX,          label: "تويتر X",   color: "#000000", href: `https://twitter.com/intent/tweet?text=${shareText}` },
    { icon: SiTelegram,   label: "تيليغرام",  color: "#26A5E4", href: `https://t.me/share/url?url=${encodeURIComponent(streamShareUrl)}&text=${encodeURIComponent("شاهد البث المباشر على شبكة سوق!")}` },
    { icon: SiInstagram,  label: "انستجرام",  color: "#E1306C", href: null, copy: true },
    { icon: SiTiktok,     label: "تيك توك",   color: "#010101", href: null, copy: true },
    { icon: SiSnapchat,   label: "سناب شات",  color: "#FFFC00", href: `https://www.snapchat.com/scan?attachmentUrl=${encodeURIComponent(streamShareUrl)}`, textDark: true },
  ];

  const unlockAudio = () => {
    const v = videoRef.current || hlsVideoRef.current;
    if (v) { v.muted = false; v.volume = 1; v.play().catch(() => {}); setAudioBlocked(false); }
  };

  const copyText = async (text: string, which: "key"|"url") => {
    try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
    if (which === "key") { setCopiedKey(true); setTimeout(() => setCopiedKey(false), 2000); }
    else { setCopiedUrl(true); setTimeout(() => setCopiedUrl(false), 2000); }
  };

  /* ═══ BROADCASTER MODE PICKER (RTMP) ════════════════════ */
  if (isBroadcast && broadcastMode === "rtmp" && !rtmpSetup) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-50 p-6 gap-6" dir="rtl">
        <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-2">
          <Radio className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-white text-xl font-bold">بث عبر OBS أو برنامج خارجي</h2>
        <p className="text-white/60 text-sm text-center max-w-xs">
          سيتم توليد مفتاح بث خاص بك — أدخله في OBS أو أي برنامج RTMP للبث المباشر على المنصة
        </p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={generateRtmpKey}
            className="w-full py-4 rounded-2xl bg-red-600 text-white font-bold text-base flex items-center justify-center gap-2"
            data-testid="btn-generate-rtmp-key"
          >
            <Radio className="w-5 h-5" />
            توليد مفتاح البث
          </button>
          <button
            onClick={() => { setBroadcastMode("webrtc"); }}
            className="w-full py-3 rounded-2xl bg-white/10 text-white font-semibold text-sm flex items-center justify-center gap-2"
            data-testid="btn-switch-to-webrtc"
          >
            <Monitor className="w-5 h-5" />
            البث من المتصفح بدلاً من ذلك
          </button>
          <button
            onClick={() => setLocation("/livestream")}
            className="w-full py-3 rounded-2xl bg-white/5 text-white/60 text-sm"
            data-testid="btn-cancel-rtmp"
          >
            إلغاء
          </button>
        </div>
      </div>
    );
  }

  /* ═══ RTMP KEY DISPLAY (after generation) ════════════════ */
  if (isBroadcast && broadcastMode === "rtmp" && rtmpSetup) {
    return (
      <div className="fixed inset-0 bg-zinc-950 flex flex-col z-50 overflow-y-auto" dir="rtl">
        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 pt-safe pt-4 pb-3 border-b border-white/10">
          <button onClick={() => setLocation("/livestream")} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
            <ArrowRight className="w-4 h-4 text-white" />
          </button>
          <div className="flex-1">
            <p className="text-white font-bold text-sm">{stream?.title || "بث مباشر"}</p>
          </div>
          <Badge className="bg-red-500 text-white text-xs font-bold gap-1 px-2.5">
            <span className="w-1.5 h-1.5 bg-white rounded-full inline-block animate-pulse" />
            مستعد
          </Badge>
          <Badge className="bg-zinc-800 text-white text-xs gap-1">
            <Eye className="w-3 h-3" /> {viewerCount}
          </Badge>
        </div>

        <div className="flex-1 px-4 py-6 flex flex-col gap-5">
          {/* Status */}
          <div className="rounded-2xl bg-green-500/10 border border-green-500/30 p-4 flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
              <Radio className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-green-400 font-bold text-sm">جاهز للاستقبال</p>
              <p className="text-white/60 text-xs mt-1">المنصة تنتظر بثك — افتح OBS وأدخل البيانات أدناه</p>
            </div>
          </div>

          {/* RTMP Server URL */}
          <div className="flex flex-col gap-2">
            <label className="text-white/60 text-xs font-semibold">رابط خادم RTMP (Server URL)</label>
            <div className="flex items-center gap-2 bg-zinc-900 rounded-xl px-4 py-3 border border-white/10">
              <code className="text-white text-sm flex-1 font-mono break-all">{rtmpUrl}</code>
              <button
                onClick={() => copyText(rtmpUrl, "url")}
                className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center"
                data-testid="btn-copy-rtmp-url"
              >
                {copiedUrl ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-white" />}
              </button>
            </div>
          </div>

          {/* Stream Key */}
          <div className="flex flex-col gap-2">
            <label className="text-white/60 text-xs font-semibold">مفتاح البث (Stream Key)</label>
            <div className="flex items-center gap-2 bg-zinc-900 rounded-xl px-4 py-3 border border-white/10">
              <code className="text-white text-sm flex-1 font-mono break-all select-all">{rtmpKey}</code>
              <button
                onClick={() => copyText(rtmpKey, "key")}
                className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center"
                data-testid="btn-copy-stream-key"
              >
                {copiedKey ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-white" />}
              </button>
            </div>
            <p className="text-yellow-400/80 text-[11px]">⚠️ لا تشارك مفتاح البث مع أحد</p>
          </div>

          {/* OBS Instructions */}
          <div className="rounded-2xl bg-zinc-900 border border-white/10 p-4 flex flex-col gap-3">
            <p className="text-white font-bold text-sm">خطوات الإعداد في OBS</p>
            {[
              "افتح OBS Studio على جهازك",
              'اضغط على "Settings" ثم "Stream"',
              'اختر "Custom" من قائمة Service',
              "ألصق رابط RTMP في خانة Server",
              "ألصق مفتاح البث في خانة Stream Key",
              'اضغط "Apply" ثم ابدأ البث!',
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-red-500/20 text-red-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <p className="text-white/70 text-sm">{step}</p>
              </div>
            ))}
          </div>

          {/* Chat section */}
          <div className="rounded-2xl bg-zinc-900 border border-white/10 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
              <p className="text-white font-semibold text-sm flex-1">الدردشة المباشرة</p>
              <Badge className="bg-zinc-800 text-white text-xs gap-1">
                <Eye className="w-3 h-3" /> {viewerCount}
              </Badge>
            </div>
            <div className="h-40 overflow-y-auto flex flex-col gap-1 px-3 py-2">
              {messages.length === 0 && (
                <p className="text-white/30 text-xs text-center mt-4">لم تبدأ التعليقات بعد...</p>
              )}
              {messages.map((msg, i) => (
                <div key={i} className="flex items-baseline gap-1.5 py-0.5">
                  <span className={`text-[11px] font-bold shrink-0 ${msg.isOwner ? "text-red-400" : "text-yellow-300"}`}>
                    {msg.userName}:
                  </span>
                  <span className="text-white text-xs break-words">{msg.message}</span>
                </div>
              ))}
            </div>
          </div>

          {/* End Stream */}
          <button
            onClick={endStream}
            className="w-full py-4 rounded-2xl bg-red-600 text-white font-bold flex items-center justify-center gap-2"
            data-testid="btn-end-rtmp-stream"
          >
            <PhoneOff className="w-5 h-5" />
            إنهاء البث
          </button>
        </div>

        {/* Chat input */}
        {user && (
          <div className="flex-shrink-0 bg-zinc-900/95 border-t border-white/10 px-3 py-2 pb-safe flex items-center gap-2">
            <Input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
              placeholder="اكتب تعليقاً..."
              maxLength={200}
              className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-white/40 rounded-full h-9 text-sm px-4"
              data-testid="input-chat"
            />
            <button
              onClick={sendChat}
              disabled={!chatInput.trim()}
              className="w-9 h-9 rounded-full bg-red-500 disabled:opacity-40 flex items-center justify-center flex-shrink-0"
              data-testid="btn-send-chat"
            >
              <Send className="w-4 h-4 text-white" />
            </button>
          </div>
        )}
      </div>
    );
  }

  /* ═══ MODE PICKER for broadcaster ═══════════════════════ */
  if (isBroadcast && !streamStarted.current && broadcastMode === "webrtc" && !streaming) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-50 p-6 gap-5" dir="rtl">
        <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-2">
          <Video className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-white text-xl font-bold">اختر طريقة البث</h2>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={() => {
              streamStarted.current = true;
              setBroadcastMode("webrtc");
              // trigger camera start
              (async () => {
                const ms = await startCamera(camFacing);
                if (!ms) return;
                setStreaming(true);
                socketRef.current?.emit("broadcaster", id);
                await fetch(`/api/streams/${id}/start`, { method: "POST", credentials: "include" }).catch(() => {});
                toast({ title: "🔴 البث مباشر الآن", description: "أنت على الهواء الآن" });
              })();
            }}
            className="w-full py-4 rounded-2xl bg-white text-black font-bold text-base flex items-center justify-center gap-2"
            data-testid="btn-start-webrtc"
          >
            <Monitor className="w-5 h-5" />
            بث من المتصفح (كاميرا)
          </button>
          <button
            onClick={() => setBroadcastMode("rtmp")}
            className="w-full py-4 rounded-2xl bg-red-600 text-white font-bold text-base flex items-center justify-center gap-2"
            data-testid="btn-start-rtmp"
          >
            <Radio className="w-5 h-5" />
            بث من OBS / برنامج خارجي
          </button>
          <button
            onClick={() => setLocation("/livestream")}
            className="w-full py-3 rounded-2xl bg-white/5 text-white/60 text-sm"
            data-testid="btn-cancel-mode"
          >
            إلغاء
          </button>
        </div>
      </div>
    );
  }

  /* ═══ MAIN STREAM VIEW (WebRTC or HLS viewer) ════════════ */
  return (
    <div className="relative w-full h-[100dvh] bg-black flex flex-col overflow-hidden select-none" dir="rtl">

      {/* VIDEO AREA */}
      <div className="relative flex-1 overflow-hidden bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isBroadcast}
          data-testid="video-stream"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ backgroundColor: "#000", transform: (isBroadcast && camFacing === "user") ? "scaleX(-1)" : "none" }}
        />

        {/* Camera error */}
        {isBroadcast && cameraError && (() => {
          const ua = navigator.userAgent;
          const isIOS = /iPad|iPhone|iPod/.test(ua);
          const isAndroid = /Android/.test(ua);
          const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
          const isChrome = /Chrome/.test(ua) && !/Edg/.test(ua);

          const titles: Record<string, string> = {
            PERMISSION_DENIED: "محتاجين إذن الكاميرا والميكروفون",
            NO_DEVICE: "مفيش كاميرا متوصلة",
            DEVICE_BUSY: "الكاميرا مشغولة في تطبيق تاني",
            GENERIC: "تعذّر فتح الكاميرا",
          };
          const subtitles: Record<string, string> = {
            PERMISSION_DENIED: "علشان تبدأ البث المباشر، لازم نستخدم الكاميرا والمايك بتاع جهازك",
            NO_DEVICE: "تأكد إن جهازك فيه كاميرا وإنها شغالة",
            DEVICE_BUSY: "اقفل أي تطبيق تاني بيستخدم الكاميرا (Zoom, WhatsApp, إلخ) وحاول تاني",
            GENERIC: "حاول تعيد فتح الصفحة أو استخدم متصفح تاني",
          };

          const steps = cameraError === "PERMISSION_DENIED" ? (
            isIOS && isSafari ? [
              "افتح إعدادات iPhone",
              "اختار: Safari ← الكاميرا والميكروفون",
              "اختار: السماح",
              "ارجع للموقع واضغط حاول مجدداً",
            ] : isAndroid && isChrome ? [
              "اضغط على القفل 🔒 جنب اسم الموقع فوق",
              "اختار: أذونات الموقع",
              "فعّل: الكاميرا والميكروفون",
              "ارجع واضغط حاول مجدداً",
            ] : [
              "اضغط على أيقونة 🔒 أو 🎥 فوق جنب اسم الموقع",
              "اختار: السماح للكاميرا والميكروفون",
              "حدّث الصفحة وحاول تاني",
            ]
          ) : null;

          return (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-black via-zinc-900 to-black text-center px-6 gap-4 z-20 overflow-y-auto py-8">
              <div className="w-24 h-24 rounded-full bg-red-500/20 flex items-center justify-center ring-4 ring-red-500/30">
                <VideoOff className="w-12 h-12 text-red-400" />
              </div>
              <h2 className="text-white font-bold text-xl">{titles[cameraError] || titles.GENERIC}</h2>
              <p className="text-white/70 text-sm max-w-md leading-relaxed">{subtitles[cameraError] || subtitles.GENERIC}</p>

              {steps && (
                <div className="bg-white/10 rounded-2xl p-4 max-w-sm w-full text-right border border-white/10">
                  <p className="text-yellow-300 font-bold text-sm mb-3 flex items-center gap-2 justify-end">
                    خطوات الحل
                    <AlertTriangle className="w-4 h-4" />
                  </p>
                  <ol className="space-y-2 text-white/90 text-sm">
                    {steps.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 justify-end">
                        <span className="flex-1">{s}</span>
                        <span className="w-6 h-6 rounded-full bg-red-500 text-white text-xs flex items-center justify-center flex-shrink-0 font-bold">{i + 1}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              <button
                onClick={() => startCamera(camFacing)}
                className="flex items-center gap-2 px-8 py-3 rounded-full bg-white text-black font-bold text-sm shadow-xl hover:scale-105 transition"
                data-testid="btn-retry-camera"
              >
                <RotateCcw className="w-4 h-4" /> حاول مجدداً
              </button>

              {cameraError === "PERMISSION_DENIED" && (
                <button
                  onClick={() => window.location.reload()}
                  className="text-white/60 text-xs underline"
                  data-testid="btn-reload-page"
                >
                  أو حدّث الصفحة بالكامل
                </button>
              )}
            </div>
          );
        })()}

        {/* Waiting overlay */}
        {!streaming && !cameraError && !ended && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 gap-5 z-10">
            <div className="w-20 h-20 rounded-full border-4 border-red-500/30 flex items-center justify-center animate-pulse">
              <Video className="w-10 h-10 text-red-400" />
            </div>
            <p className="text-white font-semibold text-lg opacity-80">
              {isBroadcast ? "جاري تشغيل الكاميرا..." : "في انتظار البث المباشر..."}
            </p>
            {!isBroadcast && (
              <p className="text-white/40 text-sm">سيبدأ الفيديو تلقائياً عندما يبدأ المضيف البث</p>
            )}
          </div>
        )}

        {/* Stream ended overlay */}
        {!isBroadcast && ended && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 gap-5 z-20 text-white">
            <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center">
              <PhoneOff className="w-10 h-10 text-red-400" />
            </div>
            <div className="text-center">
              <p className="font-bold text-xl mb-1">انتهى البث المباشر</p>
              <p className="text-white/50 text-sm">{stream?.title || ""}</p>
            </div>
            <button
              onClick={() => setLocation("/livestream")}
              className="px-8 py-3 rounded-full bg-white text-black font-bold text-sm"
              data-testid="btn-back-from-ended"
            >
              العودة للبثوث
            </button>
          </div>
        )}

        {/* Audio unlock */}
        {!isBroadcast && streaming && audioBlocked && (
          <button
            onClick={unlockAudio}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-20 cursor-pointer"
            data-testid="btn-unlock-audio"
          >
            <div className="flex flex-col items-center gap-3 bg-yellow-500/95 px-8 py-6 rounded-3xl shadow-2xl">
              <Volume2 className="w-10 h-10 text-white" />
              <p className="text-white text-lg font-bold">اضغط لتشغيل الصوت</p>
              <p className="text-yellow-100 text-sm">المتصفح يحتاج إذنك لتشغيل الصوت</p>
            </div>
          </button>
        )}

        {/* TOP BAR */}
        <div className="absolute top-0 inset-x-0 z-10 bg-gradient-to-b from-black/70 to-transparent px-4 pt-4 pb-12 pointer-events-none">
          <div className="flex items-center gap-2.5 pointer-events-auto">
            <button
              onClick={() => setLocation("/livestream")}
              className="w-9 h-9 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-white flex-shrink-0"
              data-testid="btn-back-stream"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm truncate leading-tight">{stream?.title || "بث مباشر"}</p>
              {stream?.channelName && (
                <p className="text-white/60 text-[11px] truncate">{stream.channelName}</p>
              )}
            </div>
            {(streaming || stream?.status === "live") && (
              <Badge className="bg-red-500 text-white text-xs font-bold gap-1 px-2.5 py-1 flex-shrink-0">
                <span className="w-1.5 h-1.5 bg-white rounded-full inline-block animate-pulse" />
                مباشر
              </Badge>
            )}
            <Badge className="bg-black/60 text-white text-xs gap-1 flex-shrink-0" data-testid="badge-viewer-count">
              <Eye className="w-3 h-3" /> {viewerCount.toLocaleString()}
            </Badge>
          </div>
        </div>

        {/* CHAT MESSAGES (floating) */}
        <div
          className="absolute start-0 w-[65%] px-3 z-10 max-h-[40vh] overflow-hidden flex flex-col-reverse gap-0.5 pointer-events-none"
          style={{ bottom: isBroadcast ? "160px" : "76px" }}
        >
          {[...messages].reverse().slice(0, 10).map((msg, i) => (
            <div key={i} className="flex items-baseline gap-1.5 py-0.5 px-2.5 rounded-xl bg-black/40 backdrop-blur-sm w-fit max-w-full">
              <span className={`text-[11px] font-bold shrink-0 ${msg.isOwner ? "text-red-400" : "text-yellow-300"}`}>
                {msg.userName}{msg.isOwner ? " 🔴" : ""}:
              </span>
              <span className="text-white text-xs leading-snug break-words">{msg.message}</span>
            </div>
          ))}
        </div>

        {/* VIEWER ACTIONS */}
        {!isBroadcast && streaming && !ended && (
          <div className="absolute end-3 z-10 flex flex-col items-center gap-4" style={{ bottom: "88px" }}>
            <div className="rounded-2xl bg-black/70 backdrop-blur px-3 py-2 border border-white/10 text-center max-w-[160px]">
              <p className="text-white text-[11px] font-bold">لو الشاشة سوداء</p>
              <p className="text-white/60 text-[10px] mt-0.5">اطلب من المذيع يرسلك دعوة كاميرا</p>
            </div>
            <button onClick={handleLike} className="flex flex-col items-center gap-0.5" data-testid="btn-stream-like">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all ${liked ? "bg-red-500 scale-110" : "bg-black/60"}`}>
                <Heart className={`w-6 h-6 ${liked ? "text-white fill-white" : "text-white"}`} />
              </div>
              <span className="text-white text-[10px] font-bold drop-shadow">{likesCount}</span>
            </button>
            <button
              onClick={() => {
                const v = videoRef.current;
                if (v) { v.muted = !v.muted; v.volume = v.muted ? 0 : 1; }
              }}
              className="flex flex-col items-center gap-0.5"
              data-testid="btn-viewer-mute"
            >
              <div className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg bg-black/60">
                <Volume2 className="w-6 h-6 text-white" />
              </div>
            </button>
            <button
              onClick={() => {
                const v = videoRef.current;
                if (v) { v.muted = false; v.volume = 1; v.play().catch(() => {}); }
              }}
              className="flex flex-col items-center gap-0.5"
              data-testid="btn-viewer-play-video"
            >
              <div className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg bg-blue-600/80 backdrop-blur">
                <Video className="w-6 h-6 text-white" />
              </div>
              <span className="text-white text-[10px] font-bold drop-shadow">شغّل</span>
            </button>
            <button
              onClick={() => setShowShare(true)}
              className="flex flex-col items-center gap-0.5"
              data-testid="btn-request-camera"
            >
              <div className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg bg-purple-600/80 backdrop-blur">
                <UserPlus className="w-6 h-6 text-white" />
              </div>
              <span className="text-white text-[10px] font-bold drop-shadow">اطلب كاميرا</span>
            </button>

            {/* SHARE BUTTON */}
            <button onClick={() => { setShowShare(true); setShowGiftPanel(false); }} className="flex flex-col items-center gap-0.5" data-testid="btn-share-stream">
              <div className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg bg-blue-600/80 backdrop-blur">
                <Share2 className="w-6 h-6 text-white" />
              </div>
              <span className="text-white text-[10px] font-bold drop-shadow">كاميرا</span>
            </button>

            {/* GIFT BUTTON */}
            {user && (
              <button onClick={() => { setShowGiftPanel(p => !p); setShowShare(false); setShowRechargeModal(false); }} className="flex flex-col items-center gap-0.5" data-testid="btn-gift-panel">
                <div className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg bg-yellow-500/80 backdrop-blur relative">
                  <Gift className="w-6 h-6 text-white" />
                  <span className="absolute -top-1 -end-1 bg-black/70 text-white text-[9px] font-bold rounded-full px-1">{myCoins}</span>
                </div>
                <span className="text-white text-[10px] font-bold drop-shadow">هدية</span>
              </button>
            )}

            {/* COIN RECHARGE BUTTON */}
            {user && (
              <button onClick={() => { setShowRechargeModal(true); setShowGiftPanel(false); setShowShare(false); }} className="flex flex-col items-center gap-0.5" data-testid="btn-recharge-coins">
                <div className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg bg-amber-600/80 backdrop-blur">
                  <span className="text-xl">🪙</span>
                </div>
                <span className="text-white text-[10px] font-bold drop-shadow">شحن</span>
              </button>
            )}

            {/* REPORT STREAM BUTTON (viewer only) */}
            {user && !reportDone && (
              <button
                onClick={() => setShowReportDialog(true)}
                className="flex flex-col items-center gap-0.5"
                data-testid="btn-report-stream"
              >
                <div className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg bg-red-700/60 backdrop-blur">
                  <Flag className="w-5 h-5 text-white" />
                </div>
                <span className="text-white text-[10px] font-bold drop-shadow">بلاغ</span>
              </button>
            )}
            {user && reportDone && (
              <div className="flex flex-col items-center gap-0.5">
                <div className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg bg-green-600/60">
                  <CheckCircle className="w-5 h-5 text-white" />
                </div>
                <span className="text-white text-[10px] font-bold drop-shadow">تم</span>
              </div>
            )}

            {/* RAISE HAND BUTTON */}
            {user && coHostStatus === "idle" && !handRaised && !handInvited && (
              <button onClick={raiseHand} className="flex flex-col items-center gap-0.5" data-testid="btn-raise-hand">
                <div className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg bg-orange-500/80 backdrop-blur">
                  <span className="text-2xl">✋</span>
                </div>
                <span className="text-white text-[10px] font-bold drop-shadow">رفع إيد</span>
              </button>
            )}
            {user && handRaised && !handInvited && (
              <button onClick={lowerHand} className="flex flex-col items-center gap-0.5 animate-pulse" data-testid="btn-lower-hand">
                <div className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg bg-orange-600 backdrop-blur">
                  <span className="text-2xl">✋</span>
                </div>
                <span className="text-white text-[10px] font-bold drop-shadow">انتظار...</span>
              </button>
            )}
            {user && handInvited && coHostStatus === "idle" && (
              <button onClick={() => { setHandInvited(false); requestCoHost(); }} className="flex flex-col items-center gap-0.5 animate-bounce" data-testid="btn-accept-hand-invite">
                <div className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg bg-green-500 backdrop-blur">
                  <span className="text-2xl">🎤</span>
                </div>
                <span className="text-white text-[10px] font-bold drop-shadow">انضم!</span>
              </button>
            )}

            {/* CO-HOST REQUEST BUTTON */}
            {user && coHostStatus === "idle" && (
              <button onClick={requestCoHost} className="flex flex-col items-center gap-0.5" data-testid="btn-request-cohost">
                <div className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg bg-purple-600/80 backdrop-blur">
                  <UserPlus className="w-6 h-6 text-white" />
                </div>
                <span className="text-white text-[10px] font-bold drop-shadow">كاميرا</span>
              </button>
            )}
            {user && coHostStatus === "requesting" && (
              <button className="flex flex-col items-center gap-0.5" disabled data-testid="btn-cohost-pending">
                <div className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg bg-yellow-500/80 backdrop-blur">
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                </div>
                <span className="text-white text-[10px] font-bold drop-shadow">انتظار...</span>
              </button>
            )}
            {user && coHostStatus === "accepted" && (
              <>
                {/* Mute self button */}
                <button
                  onClick={() => {
                    const t = coHostStream.current?.getAudioTracks()[0];
                    if (t) { t.enabled = !t.enabled; }
                  }}
                  className="flex flex-col items-center gap-0.5"
                  data-testid="btn-cohost-self-mute"
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg backdrop-blur ${forceMuted ? "bg-red-600/80" : "bg-zinc-700/80"}`}>
                    {forceMuted ? <MicOff className="w-6 h-6 text-white" /> : <Mic className="w-6 h-6 text-white" />}
                  </div>
                  <span className="text-white text-[10px] font-bold drop-shadow">{forceMuted ? "مكتوم" : "صوت"}</span>
                </button>
                {/* Leave button */}
                <button onClick={leaveCoHost} className="flex flex-col items-center gap-0.5" data-testid="btn-leave-cohost">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg bg-red-600 animate-pulse">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-white text-[10px] font-bold drop-shadow">إنهاء</span>
                </button>
              </>
            )}
            {user && coHostStatus === "rejected" && (
              <button className="flex flex-col items-center gap-0.5" disabled data-testid="btn-cohost-rejected">
                <div className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg bg-zinc-700">
                  <XCircle className="w-6 h-6 text-red-400" />
                </div>
                <span className="text-white text-[10px] font-bold drop-shadow">مرفوض</span>
              </button>
            )}
          </div>
        )}

        {/* CO-HOST PiP — viewer's own camera (shown once camera opens) */}
        {!isBroadcast && (coHostStatus === "requesting" || coHostStatus === "accepted") && (
          <>
            {/* Own cam — full screen when swapped, PiP when not */}
            <video
              ref={coHostSelfVideo}
              autoPlay playsInline muted
              onClick={() => setSelfCamSwapped(s => !s)}
              data-testid="video-cohost-self"
              className={
                selfCamSwapped
                  ? "absolute inset-0 w-full h-full object-cover z-10 cursor-pointer"
                  : "absolute bottom-20 start-3 z-20 w-28 h-40 rounded-2xl object-cover border-2 border-purple-500 shadow-xl cursor-pointer"
              }
              style={selfCamSwapped ? { transform: "scaleX(-1)" } : { transform: "scaleX(-1)" }}
            />
            {/* Swap hint badge */}
            {!selfCamSwapped && coHostStatus === "accepted" && (
              <div className="absolute bottom-20 start-3 z-30 pointer-events-none"
                   style={{ bottom: "calc(5rem + 160px)", left: "0.75rem" }}>
              </div>
            )}
            {/* Status badge on PiP */}
            {!selfCamSwapped && (
              <div className="absolute bottom-20 start-3 z-30 pointer-events-none flex items-end justify-center pb-1"
                   style={{ width: 112, height: 160 }}>
                {coHostStatus === "requesting" && (
                  <span className="text-[10px] text-white bg-yellow-500 rounded-full px-1.5 py-0.5 font-bold mb-1">انتظار...</span>
                )}
                {coHostStatus === "accepted" && (
                  <span className="text-[10px] text-white bg-red-600 rounded-full px-1.5 py-0.5 font-bold animate-pulse mb-1">LIVE</span>
                )}
              </div>
            )}
            {/* When swapped: show swap back hint */}
            {selfCamSwapped && (
              <div className="absolute top-4 start-4 z-30 pointer-events-none">
                <span className="text-[10px] text-white bg-black/60 rounded-full px-2 py-1">اضغط للمبادلة</span>
              </div>
            )}
          </>
        )}

        {/* RAISED HANDS PANEL (broadcaster) */}
        {isBroadcast && raisedHands.length > 0 && showHandsList && (
          <div className="absolute top-16 inset-x-4 z-20 bg-black/85 backdrop-blur-lg rounded-2xl border border-orange-500/40 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="text-lg">✋</span>
                <span className="text-white font-bold text-xs">الأيدي المرفوعة ({raisedHands.length})</span>
              </div>
              <button onClick={() => setShowHandsList(false)} className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
                <X className="w-3 h-3 text-white" />
              </button>
            </div>
            <div className="flex flex-col divide-y divide-white/5">
              {raisedHands.map(h => (
                <div key={h.socketId} className="flex items-center gap-2 px-3 py-2">
                  <div className="w-8 h-8 rounded-full bg-orange-500/30 flex items-center justify-center flex-shrink-0 text-base">✋</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-bold truncate">{h.userName}</p>
                    <p className="text-white/40 text-[10px]">يريد التحدث</p>
                  </div>
                  <button
                    onClick={() => inviteRaisedHand(h.socketId)}
                    className="px-2.5 py-1 rounded-full bg-green-500 text-white text-[10px] font-bold flex-shrink-0"
                    data-testid={`btn-invite-hand-${h.socketId}`}
                  >دعوة</button>
                  <button
                    onClick={() => dismissHand(h.socketId)}
                    className="w-6 h-6 rounded-full bg-red-500/60 flex items-center justify-center flex-shrink-0"
                    data-testid={`btn-dismiss-hand-${h.socketId}`}
                  ><X className="w-3 h-3 text-white" /></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Hand raise count badge for broadcaster */}
        {isBroadcast && raisedHands.length > 0 && !showHandsList && (
          <button
            onClick={() => setShowHandsList(true)}
            className="absolute top-16 start-4 z-20 flex items-center gap-1.5 bg-orange-500 rounded-full px-3 py-1.5 shadow-lg animate-bounce"
            data-testid="btn-show-hands-list"
          >
            <span className="text-sm">✋</span>
            <span className="text-white text-xs font-bold">{raisedHands.length}</span>
          </button>
        )}

        {/* CO-HOST REQUESTS PANEL (broadcaster) */}
        {isBroadcast && coHostRequests.length > 0 && (
          <div className="absolute top-32 inset-x-4 z-20 flex flex-col gap-2">
            <div className="rounded-2xl bg-black/70 backdrop-blur px-3 py-2 border border-white/10">
              <p className="text-white text-xs font-bold">طلبات الضيوف</p>
              <p className="text-white/50 text-[10px] mt-0.5">هذه الطلبات تظهر للمذيع فقط، والجمهور يقدر يرسل طلب من زر الانضمام.</p>
            </div>
            {coHostRequests.map(req => (
              <div key={req.socketId} className="flex items-center gap-2 bg-black/80 backdrop-blur rounded-2xl px-3 py-2.5 border border-purple-500/40">
                <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
                  <UserPlus className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-bold truncate">{req.userName}</p>
                  <p className="text-white/50 text-[10px]">{req.withCamera === false ? "🎙️ صوت فقط" : "📷 صوت وصورة"}</p>
                </div>
                <button
                  onClick={() => acceptCoHost(req.socketId, req.userName)}
                  className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0"
                  data-testid={`btn-accept-cohost-${req.socketId}`}
                >
                  <CheckCircle className="w-4 h-4 text-white" />
                </button>
                <button
                  onClick={() => rejectCoHost(req.socketId)}
                  className="w-8 h-8 rounded-full bg-red-500/80 flex items-center justify-center flex-shrink-0"
                  data-testid={`btn-reject-cohost-${req.socketId}`}
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* CO-HOST PiP Grid — broadcaster sees all guests; tap to swap with main screen */}
        {isBroadcast && activeCoHosts.length > 0 && (
          <>
            {/* Own cam small PiP shown only when a co-host is swapped to full screen */}
            {swappedCohostId && (
              <div
                className="absolute bottom-36 end-3 z-30 w-24 h-36 rounded-xl overflow-hidden border-2 border-white/60 shadow-xl cursor-pointer"
                onClick={() => setSwappedCohostId("")}
                data-testid="video-broadcaster-self-pip"
              >
                <video
                  autoPlay playsInline muted
                  ref={el => {
                    if (el && localStream.current && !el.srcObject) {
                      el.srcObject = localStream.current;
                      el.play().catch(() => {});
                    }
                  }}
                  className="w-full h-full object-cover"
                  style={{ transform: camFacing === "user" ? "scaleX(-1)" : "none" }}
                />
                <div className="absolute bottom-1 inset-x-0 flex justify-center">
                  <span className="text-[9px] text-white bg-black/60 rounded-full px-1.5 py-0.5 font-bold">أنت</span>
                </div>
              </div>
            )}

            {activeCoHosts.map((ch, idx) => {
              const isSwapped = swappedCohostId === ch.socketId;
              const col = idx % 2;
              const row = Math.floor(idx / 2);
              return (
                <div
                  key={ch.socketId}
                  className={isSwapped
                    ? "absolute inset-0 z-10"
                    : "absolute z-20"
                  }
                  style={isSwapped ? {} : {
                    bottom: `${9 + row * 8}rem`,
                    [document.documentElement.dir === "rtl" ? "left" : "right"]: `${0.75 + col * 6.5}rem`,
                  }}
                >
                  {/* Hidden audio element for audio-only guests */}
                  <audio
                    autoPlay
                    ref={el => {
                      if (el) {
                        const ms = coHostStreams.current.get(ch.socketId);
                        if (ms && !ch.hasCamera && !el.srcObject) { el.srcObject = ms; el.play().catch(() => {}); }
                      }
                    }}
                    style={{ display: "none" }}
                  />
                  {/* Video (hidden for audio-only guests) */}
                  {ch.hasCamera !== false ? (
                    <video
                      autoPlay playsInline
                      ref={el => {
                        if (el) {
                          coHostVideoRefs.current.set(ch.socketId, el);
                          const ms = coHostStreams.current.get(ch.socketId);
                          if (ms && !el.srcObject) { el.srcObject = ms; el.play().catch(() => {}); }
                        }
                      }}
                      onClick={() => setSwappedCohostId(isSwapped ? "" : ch.socketId)}
                      className={isSwapped
                        ? "w-full h-full object-cover cursor-pointer"
                        : "w-24 h-36 rounded-xl object-cover border-2 border-purple-500 shadow-xl cursor-pointer"
                      }
                      data-testid={`video-cohost-${idx}`}
                    />
                  ) : (
                    /* Audio-only guest placeholder */
                    <div
                      onClick={() => {}}
                      className={isSwapped
                        ? "w-full h-full bg-zinc-900 flex flex-col items-center justify-center"
                        : "w-24 h-36 rounded-xl bg-zinc-900 border-2 border-purple-500 shadow-xl flex flex-col items-center justify-center gap-2"
                      }
                      data-testid={`video-cohost-${idx}`}
                    >
                      <div className="w-10 h-10 rounded-full bg-purple-600/30 flex items-center justify-center">
                        <Mic className="w-5 h-5 text-purple-300" />
                      </div>
                      <span className="text-[9px] text-purple-300 font-bold">صوت فقط</span>
                    </div>
                  )}
                  {/* Name badge */}
                  <div className={`absolute ${isSwapped ? "top-4 start-4" : "top-1 inset-x-0"} flex items-center justify-center`}>
                    <span className="text-[9px] text-white bg-purple-600 rounded-full px-1.5 py-0.5 font-bold truncate max-w-[100px]">{ch.name}</span>
                  </div>
                  {/* Swap hint when full screen */}
                  {isSwapped && (
                    <div className="absolute top-4 end-4">
                      <span className="text-[10px] text-white bg-black/60 rounded-full px-2 py-1">اضغط للمبادلة</span>
                    </div>
                  )}
                  {/* Muted badge */}
                  {mutedCohosts.has(ch.socketId) && (
                    <div className="absolute bottom-1 start-1">
                      <MicOff className="w-3 h-3 text-red-400" />
                    </div>
                  )}
                  {/* Controls when not swapped */}
                  {!isSwapped && (
                    <>
                      {/* Remove button */}
                      <button
                        onClick={e => { e.stopPropagation(); endCoHostFromBroadcaster(ch.socketId); }}
                        className="absolute -top-1.5 -end-1.5 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center shadow-lg"
                        data-testid={`btn-end-cohost-${idx}`}
                      >
                        <X className="w-2.5 h-2.5 text-white" />
                      </button>
                      {/* Mute/Unmute button */}
                      <button
                        onClick={e => { e.stopPropagation(); toggleMuteCohost(ch.socketId); }}
                        className={`absolute -bottom-1.5 -end-1.5 w-5 h-5 rounded-full flex items-center justify-center shadow-lg ${mutedCohosts.has(ch.socketId) ? "bg-red-500" : "bg-zinc-700"}`}
                        data-testid={`btn-mute-cohost-${idx}`}
                      >
                        {mutedCohosts.has(ch.socketId)
                          ? <MicOff className="w-2.5 h-2.5 text-white" />
                          : <Mic className="w-2.5 h-2.5 text-white" />}
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </>
        )}

        {/* FLYING GIFT ANIMATIONS */}
        {flyingGifts.map(g => (
          <div
            key={g.id}
            className="absolute bottom-40 z-30 pointer-events-none"
            style={{ left: `${g.x}%`, animation: "giftFly 3s ease-out forwards" }}
          >
            <span className="text-5xl drop-shadow-2xl">{g.emoji}</span>
          </div>
        ))}

        {/* BROADCASTER GIFT BANNER (shows who sent, what, and how much received) */}
        {isBroadcast && giftBanners.length > 0 && (
          <div className="absolute top-16 start-3 z-30 pointer-events-none flex flex-col gap-1.5" style={{ maxWidth: "75%" }}>
            {giftBanners.map(b => (
              <div key={b.id} className="bg-gradient-to-l from-yellow-600/90 to-orange-600/90 backdrop-blur-xl rounded-2xl px-3 py-2 flex items-center gap-2.5 shadow-2xl border border-yellow-400/40" style={{ animation: "slideInRight 0.4s ease-out" }}>
                <span className="text-3xl">{b.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold text-sm truncate">{b.userName}</p>
                  <p className="text-yellow-100 text-[10px]">
                    أرسل {b.name} — <span className="font-bold text-white">وصلك {b.received} 🪙</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* IN-STREAM AD — mini banner + expanded bottom-sheet (stream stays alive) */}
        {streaming && adVisible && streamAds.length > 0 && stream?.showAds !== false && (() => {
          const ad = streamAds[currentAdIdx];

          /* ── EXPANDED bottom-sheet (stream continues behind it) ── */
          if (adExpanded) return (
            <div
              className="absolute inset-x-0 bottom-0 z-30 rounded-t-3xl overflow-hidden shadow-2xl"
              style={{ animation: "slideInUp 0.35s ease-out" }}
            >
              {/* translucent backdrop so viewer can still see stream above */}
              <div className="bg-black/92 backdrop-blur-xl pb-8 pt-1">
                {/* drag handle */}
                <div className="flex justify-center mb-3 pt-2">
                  <div className="w-10 h-1 bg-white/30 rounded-full" />
                </div>

                {/* ad label + close */}
                <div className="flex items-center justify-between px-4 mb-3">
                  <span className="text-[10px] text-yellow-400 font-bold bg-yellow-400/15 rounded px-2 py-1">
                    إعلان ممول
                  </span>
                  <button
                    onClick={() => { setAdVisible(false); setAdExpanded(false); }}
                    className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white/60"
                    data-testid="btn-ad-close-expanded"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* ad image */}
                <div className="px-4 mb-3">
                  <img
                    src={ad.media_url}
                    alt={ad.title}
                    className="w-full h-44 object-cover rounded-2xl border border-white/10"
                  />
                </div>

                {/* title + price */}
                <div className="px-4 mb-4">
                  <p className="text-white font-bold text-base leading-snug mb-1">{ad.title}</p>
                  {ad.description && (
                    <p className="text-white/60 text-xs leading-relaxed line-clamp-2">{ad.description}</p>
                  )}
                  {ad.price_egp && (
                    <p className="text-green-400 font-bold text-lg mt-2">
                      {Number(ad.price_egp).toLocaleString("ar-EG")} <span className="text-sm">ج.م</span>
                    </p>
                  )}
                </div>

                {/* CTA buttons — all open new tab, stream stays alive */}
                <div className="px-4 flex gap-2">
                  {ad.whatsapp_number && (
                    <a
                      href={`https://wa.me/${ad.whatsapp_number.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-2 bg-green-500 text-white text-sm font-bold py-3 rounded-2xl"
                      data-testid="btn-ad-whatsapp-expanded"
                    >
                      <SiWhatsapp className="w-4 h-4" />
                      تواصل واتساب
                    </a>
                  )}
                  <a
                    href={`/ads/${ad.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 bg-white/15 border border-white/20 text-white text-sm font-bold py-3 rounded-2xl"
                    data-testid="btn-ad-view-expanded"
                  >
                    عرض الإعلان
                  </a>
                </div>

                {/* back to stream hint */}
                <button
                  onClick={() => setAdExpanded(false)}
                  className="w-full mt-3 text-white/40 text-[11px] text-center py-1"
                  data-testid="btn-ad-back-to-stream"
                >
                  ← العودة للبث المباشر
                </button>
              </div>
            </div>
          );

          /* ── MINI banner (default) ── */
          return (
            <button
              onClick={() => setAdExpanded(true)}
              className="absolute inset-x-3 z-20 flex items-center gap-3 bg-black/85 backdrop-blur-md rounded-2xl p-2.5 border border-white/10 shadow-2xl text-start"
              style={{ bottom: "92px", animation: "slideInLeft 0.4s ease-out" }}
              data-testid="btn-ad-expand"
            >
              {/* thumbnail */}
              <img
                src={ad.media_url}
                alt={ad.title}
                className="w-14 h-14 rounded-xl object-cover flex-shrink-0 border border-white/10"
              />
              {/* info */}
              <div className="flex-1 min-w-0">
                <span className="text-[9px] text-yellow-400 font-bold bg-yellow-400/15 rounded px-1 py-0.5">إعلان</span>
                <p className="text-white text-xs font-bold truncate leading-tight mt-0.5">{ad.title}</p>
                {ad.price_egp && (
                  <p className="text-green-400 text-[11px] font-bold">{Number(ad.price_egp).toLocaleString("ar-EG")} ج.م</p>
                )}
              </div>
              {/* actions */}
              <div className="flex flex-col gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                {ad.whatsapp_number ? (
                  <a
                    href={`https://wa.me/${ad.whatsapp_number.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 bg-green-500 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-xl"
                    data-testid="btn-ad-whatsapp"
                  >
                    <SiWhatsapp className="w-3 h-3" />
                    واتساب
                  </a>
                ) : (
                  <a
                    href={`/ads/${ad.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-white/20 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-xl"
                    data-testid="btn-ad-view"
                  >
                    عرض
                  </a>
                )}
                <button
                  onClick={() => { setAdVisible(false); setAdExpanded(false); }}
                  className="text-white/40 text-[9px] text-center"
                  data-testid="btn-ad-dismiss"
                >
                  إغلاق
                </button>
              </div>
            </button>
          );
        })()}

        {/* AUTO-ACCEPT TOGGLE (broadcaster only) */}
        {isBroadcast && streaming && (
          <button
            onClick={toggleAutoAccept}
            className={`absolute top-3 end-3 z-20 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-bold border transition-all ${
              autoAccept
                ? "bg-purple-600 border-purple-400 text-white"
                : "bg-black/60 border-white/20 text-white/70"
            }`}
            data-testid="btn-toggle-auto-accept"
          >
            <Users className="w-3.5 h-3.5" />
            {autoAccept ? "قبول تلقائي" : "قبول يدوي"}
          </button>
        )}

        {/* ── CONTENT WARNING overlay (shown to broadcaster when flagged) ── */}
        {contentWarning && (
          <div className="absolute inset-x-4 z-40 rounded-2xl overflow-hidden shadow-2xl border-2 border-orange-500"
            style={{ top: "60px", animation: "slideInLeft 0.4s ease-out" }}
          >
            <div className="bg-orange-950/95 backdrop-blur-md p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-orange-300 text-xs font-bold mb-1">تحذير من الإدارة</p>
                  <p className="text-white text-sm leading-relaxed">{contentWarning}</p>
                </div>
                <button onClick={() => setContentWarning(null)} className="text-white/40 flex-shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── KICKED overlay ── */}
        {kicked && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/95 gap-6 text-white px-8 text-center">
            <div className="w-20 h-20 rounded-full bg-red-600/30 flex items-center justify-center">
              <ShieldOff className="w-10 h-10 text-red-400" />
            </div>
            <div>
              <p className="font-bold text-xl mb-3">تم طردك من البث</p>
              <p className="text-white/70 text-sm leading-relaxed">قام المذيع بإخراجك من هذا البث</p>
            </div>
            <button onClick={() => setLocation("/livestream")} className="px-8 py-3 rounded-full bg-white text-black font-bold text-sm" data-testid="btn-after-kicked">
              العودة للبثوث
            </button>
          </div>
        )}

        {/* ── BATTLE INVITE POPUP (broadcaster receives invite) ── */}
        {battleInvite && isBroadcast && (
          <div className="absolute top-20 inset-x-4 z-40 pointer-events-auto">
            <div className="bg-black/90 backdrop-blur-xl rounded-2xl border-2 border-yellow-500/60 p-4 shadow-2xl animate-pulse">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">⚔️</span>
                <div>
                  <p className="text-yellow-400 font-bold text-base">دعوة تحدي!</p>
                  <p className="text-white/70 text-sm">{battleInvite.fromName} يتحداك في جولة</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={acceptBattleInvite} className="flex-1 py-2.5 rounded-xl bg-green-600 text-white font-bold text-sm" data-testid="btn-accept-battle">
                  ✅ قبول التحدي
                </button>
                <button onClick={declineBattleInvite} className="flex-1 py-2.5 rounded-xl bg-red-600/50 text-white font-bold text-sm" data-testid="btn-decline-battle">
                  ❌ رفض
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── CROSS-STREAM BATTLE OVERLAY ── */}
        {battle && (
          <div className="absolute inset-0 z-30 pointer-events-none flex flex-col">
            {/* Opponent video (top half during battle) */}
            <div className="relative w-full" style={{ height: "40%" }}>
              <video ref={opponentVideoRef} autoPlay playsInline className="w-full h-full object-cover bg-black" />
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                <p className="text-white/80 text-xs font-bold">
                  {battle.streamIdA === id ? battle.nameB : battle.nameA}
                </p>
              </div>
            </div>

            {/* Score bar between the two halves */}
            <div className="pointer-events-auto bg-black/90 backdrop-blur-xl border-y border-yellow-500/40 px-3 py-2 flex items-center justify-between gap-2">
              <div className={`flex-1 rounded-lg p-1.5 text-center border ${battle.ended && battle.winner === "A" ? "bg-red-600/40 border-yellow-400" : "bg-red-600/20 border-red-500/30"}`}>
                <p className="text-red-400 text-[10px] font-bold truncate">🔴 {battle.nameA}</p>
                <p className="text-white font-bold text-lg">{battle.totalA.toLocaleString()}</p>
              </div>

              <div className="flex flex-col items-center gap-0.5 min-w-[60px]">
                <span className="text-lg">⚔️</span>
                {battle.active && (
                  <div className="flex items-center gap-1 bg-red-600/30 border border-red-500/40 rounded-full px-2 py-0.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-red-400 font-bold text-xs font-mono">
                      {Math.floor(battle.timeLeft / 60)}:{(battle.timeLeft % 60).toString().padStart(2, "0")}
                    </span>
                  </div>
                )}
                {battle.ended && battle.winner && (
                  <span className="text-yellow-400 text-[10px] font-bold">
                    🏆 {battle.winner === "A" ? battle.nameA : battle.winner === "B" ? battle.nameB : "تعادل!"}
                  </span>
                )}
              </div>

              <div className={`flex-1 rounded-lg p-1.5 text-center border ${battle.ended && battle.winner === "B" ? "bg-blue-600/40 border-yellow-400" : "bg-blue-600/20 border-blue-500/30"}`}>
                <p className="text-blue-400 text-[10px] font-bold truncate">🔵 {battle.nameB}</p>
                <p className="text-white font-bold text-lg">{battle.totalB.toLocaleString()}</p>
              </div>
            </div>

            {/* Battle controls for broadcaster */}
            {isBroadcast && battle.active && (
              <div className="pointer-events-auto px-3 py-1">
                <button onClick={endBattleEarly} className="w-full py-1.5 rounded-xl bg-red-600/50 border border-red-500/30 text-red-300 text-xs font-bold" data-testid="btn-end-battle-early">
                  إنهاء الجولة مبكراً
                </button>
              </div>
            )}

            {/* Battle gift panel (viewers only) */}
            {!isBroadcast && battle.active && user && (
              <div className="pointer-events-auto mt-auto mb-24 mx-2">
                <div className="bg-black/80 backdrop-blur-xl rounded-2xl border border-white/10 p-2.5">
                  <p className="text-white/60 text-[10px] font-bold mb-1.5">🎁 أرسل هدية لمذيعك — المضاعفات للسكور فقط</p>
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {GIFTS.slice(0, 6).map(gift => (
                      <div key={gift.type} className="flex flex-col items-center gap-0.5 min-w-[3.5rem]">
                        <span className="text-xl">{gift.emoji}</span>
                        <span className="text-[8px] text-yellow-400 font-bold">{gift.coins}🪙</span>
                        <div className="flex gap-0.5">
                          {BATTLE_MULTIPLIERS.map(m => (
                            <button key={m.value} onClick={() => sendBattleGift(gift, m.value)}
                              className={`${m.color} text-white text-[7px] font-bold px-1 py-0.5 rounded`}
                              data-testid={`battle-gift-${gift.type}-${m.value}`}>
                              {m.emoji}{m.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── FORCE-END overlay (stream closed by admin or auto-system) ── */}
        {forceEndReason && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/95 gap-6 text-white px-8 text-center">
            <div className="w-20 h-20 rounded-full bg-red-600/30 flex items-center justify-center">
              <ShieldOff className="w-10 h-10 text-red-400" />
            </div>
            <div>
              <p className="font-bold text-xl mb-3">أُغلق البث</p>
              <p className="text-white/70 text-sm leading-relaxed">{forceEndReason}</p>
            </div>
            <button
              onClick={() => setLocation("/livestream")}
              className="px-8 py-3 rounded-full bg-white text-black font-bold text-sm"
              data-testid="btn-after-force-end"
            >
              العودة للبثوث
            </button>
          </div>
        )}

        {/* BROADCASTER CONTROLS (WebRTC) */}
        {isBroadcast && streaming && broadcastMode === "webrtc" && (
          <div className="absolute inset-x-0 z-10 flex items-center justify-center gap-3 px-5" style={{ bottom: "84px" }}>
            <button
              onClick={toggleMute}
              data-testid="btn-toggle-mic"
              className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all border-2 ${muted ? "bg-red-500 border-red-400" : "bg-black/70 border-white/20"}`}
            >
              {muted ? <MicOff className="w-6 h-6 text-white" /> : <Mic className="w-6 h-6 text-white" />}
            </button>
            <button
              onClick={toggleVideo}
              data-testid="btn-toggle-camera"
              className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all border-2 ${videoOff ? "bg-red-500 border-red-400" : "bg-black/70 border-white/20"}`}
            >
              {videoOff ? <VideoOff className="w-6 h-6 text-white" /> : <Video className="w-6 h-6 text-white" />}
            </button>
            {facingSupported && (
              <button
                onClick={flipCamera}
                data-testid="btn-flip-camera"
                className="w-14 h-14 rounded-full flex items-center justify-center shadow-xl bg-black/70 border-2 border-white/20"
              >
                <FlipHorizontal className="w-6 h-6 text-white" />
              </button>
            )}
            {/* SHARE button for broadcaster */}
            <button
              onClick={() => setShowShare(true)}
              data-testid="btn-broadcast-share"
              className="w-14 h-14 rounded-full flex items-center justify-center shadow-xl bg-blue-600 border-2 border-blue-400"
              title="شارك البث"
            >
              <Share2 className="w-6 h-6 text-white" />
            </button>
            <button
              onClick={endStream}
              data-testid="btn-end-stream"
              className="h-14 px-6 rounded-full bg-red-600 flex items-center gap-2 text-white font-bold text-sm shadow-xl"
            >
              <PhoneOff className="w-5 h-5" />
              إنهاء البث
            </button>
          </div>
        )}

        {/* BROADCASTER FLOATING BUTTONS (right side) */}
        {isBroadcast && streaming && (
          <div className="absolute end-3 z-10 flex flex-col items-center gap-2.5" style={{ bottom: "160px" }}>
            <button onClick={() => setShowShare(true)} data-testid="btn-broadcast-share-float" className="flex flex-col items-center gap-0.5">
              <div className="w-11 h-11 rounded-full bg-blue-600/90 backdrop-blur flex items-center justify-center shadow-lg border-2 border-blue-400/50">
                <Share2 className="w-5 h-5 text-white" />
              </div>
              <span className="text-white text-[9px] font-bold drop-shadow">شارك</span>
            </button>
            <button onClick={requestViewerList} data-testid="btn-viewer-list" className="flex flex-col items-center gap-0.5">
              <div className="w-11 h-11 rounded-full bg-zinc-700/90 backdrop-blur flex items-center justify-center shadow-lg border-2 border-white/20">
                <Users className="w-5 h-5 text-white" />
              </div>
              <span className="text-white text-[9px] font-bold drop-shadow">الجمهور</span>
            </button>
            <button onClick={() => { fetchLiveStreamsForBattle(); setShowBattleSetup(true); }} data-testid="btn-battle-setup" className="flex flex-col items-center gap-0.5">
              <div className="w-11 h-11 rounded-full bg-yellow-600/90 backdrop-blur flex items-center justify-center shadow-lg border-2 border-yellow-400/50">
                <span className="text-lg">⚔️</span>
              </div>
              <span className="text-white text-[9px] font-bold drop-shadow">تحدي</span>
            </button>
          </div>
        )}
      </div>

      {/* JOIN MODE DIALOG — guest chooses camera or audio-only */}
      {!isBroadcast && coHostStatus === "choosing" && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setCoHostStatus("idle")}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative w-full max-w-lg bg-zinc-900 rounded-t-3xl p-6 pb-safe" onClick={e => e.stopPropagation()} dir="rtl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-white font-bold text-lg">انضم للبث كضيف</h3>
                <p className="text-white/50 text-xs mt-0.5">اختر طريقة الانضمام</p>
              </div>
              <button onClick={() => setCoHostStatus("idle")} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {/* With camera */}
              <button
                onClick={() => joinAsCoHost(true)}
                className="flex flex-col items-center gap-3 bg-purple-600/20 border border-purple-500/40 rounded-2xl p-5 hover:bg-purple-600/30 transition-colors"
                data-testid="btn-join-with-camera"
              >
                <div className="w-14 h-14 rounded-full bg-purple-600 flex items-center justify-center">
                  <Video className="w-7 h-7 text-white" />
                </div>
                <div className="text-center">
                  <p className="text-white font-bold text-sm">بالكاميرا</p>
                  <p className="text-white/50 text-[11px] mt-0.5">صوت وصورة</p>
                </div>
              </button>
              {/* Audio only */}
              <button
                onClick={() => joinAsCoHost(false)}
                className="flex flex-col items-center gap-3 bg-zinc-700/40 border border-zinc-600/40 rounded-2xl p-5 hover:bg-zinc-700/60 transition-colors"
                data-testid="btn-join-audio-only"
              >
                <div className="w-14 h-14 rounded-full bg-zinc-600 flex items-center justify-center">
                  <Mic className="w-7 h-7 text-white" />
                </div>
                <div className="text-center">
                  <p className="text-white font-bold text-sm">صوت فقط</p>
                  <p className="text-white/50 text-[11px] mt-0.5">بدون كاميرا</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COIN RECHARGE MODAL */}
      {showRechargeModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => { if (purchaseStep !== "pay") { setShowRechargeModal(false); setPurchaseStep("packages"); setSelectedPkg(null); setPayRef(""); } }}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative w-full max-w-lg bg-zinc-900 rounded-t-3xl p-5 pb-safe max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()} dir="rtl">

            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-white font-bold text-lg">
                  {purchaseStep === "packages" && "شحن المحفظة 🪙"}
                  {purchaseStep === "pay" && "إتمام الدفع 💳"}
                  {purchaseStep === "done" && "تم استلام الطلب ✅"}
                </h3>
                <p className="text-yellow-400 text-xs font-bold">رصيدك: {myCoins} عملة</p>
              </div>
              <button onClick={() => { setShowRechargeModal(false); setPurchaseStep("packages"); setSelectedPkg(null); setPayRef(""); }} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* ── Step 1: Packages ── */}
            {purchaseStep === "packages" && (
              <>
                {/* Recharge code */}
                <div className="bg-white/5 rounded-2xl p-3.5 mb-4 border border-white/10">
                  <p className="text-white/60 text-xs mb-2 font-bold">لديك كود شحن؟</p>
                  <div className="flex gap-2">
                    <input type="text" value={rechargeCode} onChange={e => setRechargeCode(e.target.value.toUpperCase())} placeholder="SOUQ-XXXXX-XXXXX"
                      className="flex-1 bg-white/10 border border-white/20 text-white placeholder:text-white/30 rounded-xl px-3 py-2 text-sm font-mono" data-testid="input-recharge-code" dir="ltr" />
                    <button onClick={redeemCoinCode} disabled={rechargeLoading || !rechargeCode.trim()} className="px-4 py-2 rounded-xl bg-yellow-500 text-black font-bold text-sm disabled:opacity-50" data-testid="btn-redeem-code">
                      {rechargeLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "تفعيل"}
                    </button>
                  </div>
                </div>

                {/* Packages grid */}
                <p className="text-white/50 text-xs font-bold mb-2">أو اشتري باقة بالدفع المباشر</p>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {(coinPackages || [
                    { id:1, name:"باقة صغيرة",  coins:100,  price_egp:10,  bonus_coins:0   },
                    { id:2, name:"باقة متوسطة", coins:250,  price_egp:22,  bonus_coins:20  },
                    { id:3, name:"باقة كبيرة",  coins:500,  price_egp:40,  bonus_coins:75  },
                    { id:4, name:"باقة مميزة",  coins:1000, price_egp:70,  bonus_coins:200 },
                    { id:5, name:"باقة الكنز",  coins:3000, price_egp:180, bonus_coins:800 },
                  ]).map((pkg: any) => (
                    <button key={pkg.id}
                      className="bg-gradient-to-b from-yellow-500/20 to-yellow-600/10 border border-yellow-500/30 rounded-2xl p-3 text-right hover:from-yellow-500/30 active:scale-95 transition-all"
                      data-testid={`btn-buy-package-${pkg.id}`}
                      onClick={() => { setSelectedPkg(pkg); setPurchaseStep("pay"); setPayRef(""); }}
                    >
                      <div className="text-2xl mb-0.5">🪙</div>
                      <p className="text-yellow-400 font-bold text-sm">{(pkg.coins + (pkg.bonus_coins || 0)).toLocaleString()} عملة</p>
                      {pkg.bonus_coins > 0 && <p className="text-green-400 text-[10px]">+{pkg.bonus_coins} مجاناً</p>}
                      <p className="text-white font-bold text-base mt-1">{pkg.price_egp} ج.م</p>
                    </button>
                  ))}
                </div>
                <p className="text-white/20 text-[10px] text-center">سيتم إضافة العملات إلى محفظتك بعد مراجعة الدفع • للمساعدة تواصل معنا</p>
              </>
            )}

            {/* ── Step 2: Payment ── */}
            {purchaseStep === "pay" && selectedPkg && (
              <>
                {/* Selected package summary */}
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-3.5 mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-yellow-400 font-bold text-base">{(selectedPkg.coins + (selectedPkg.bonus_coins || 0)).toLocaleString()} عملة</p>
                    {selectedPkg.bonus_coins > 0 && <p className="text-green-400 text-xs">شاملة {selectedPkg.bonus_coins} عملة مجانًا</p>}
                  </div>
                  <div className="text-left">
                    <p className="text-white font-bold text-xl">{selectedPkg.price_egp} ج.م</p>
                    <p className="text-white/40 text-xs">{selectedPkg.name}</p>
                  </div>
                </div>

                {/* Payment method selector */}
                <p className="text-white/60 text-xs font-bold mb-2">اختر طريقة الدفع</p>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {[
                    { key: "vodafone",     label: "فودافون كاش",   sub: "01098559311",      emoji: "📱", color: "border-red-500/50 bg-red-500/10" },
                    { key: "etisalat",     label: "اتصالات كاش",    sub: "01126665741",      emoji: "📱", color: "border-emerald-500/50 bg-emerald-500/10" },
                    { key: "instapay",     label: "إنستاباي",       sub: "01285558567",      emoji: "💳", color: "border-blue-500/50 bg-blue-500/10" },
                    { key: "bank",         label: "تحويل بنكي",     sub: "البنك الأهلي",     emoji: "🏦", color: "border-green-500/50 bg-green-500/10" },
                    { key: "souq",         label: "سوق ماركات",     sub: "تطبيق الدفع",      emoji: "🛍️", color: "border-purple-500/50 bg-purple-500/10" },
                    { key: "installment",  label: "تقسيط فيزا",     sub: "55 يوم بدون فوائد", emoji: "💰", color: "border-yellow-500/50 bg-yellow-500/10" },
                  ].map(m => (
                    <button key={m.key}
                      onClick={() => setPayMethod(m.key as any)}
                      className={`rounded-2xl p-2.5 border-2 transition-all text-center ${payMethod === m.key ? m.color + " border-opacity-100" : "border-white/10 bg-white/5"}`}
                      data-testid={`btn-paymethod-${m.key}`}
                    >
                      <div className="text-xl mb-0.5">{m.emoji}</div>
                      <p className="text-white text-[11px] font-bold">{m.label}</p>
                      <p className="text-white/50 text-[10px]" dir="ltr">{m.sub}</p>
                    </button>
                  ))}
                </div>

                {/* Payment details */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-4">
                  {payMethod === "vodafone" && (
                    <>
                      <p className="text-white/60 text-xs mb-1">حوّل المبلغ لفودافون كاش:</p>
                      <p className="text-white font-bold text-2xl tracking-widest" dir="ltr">01098559311</p>
                      <p className="text-white/40 text-xs mt-1">سوق ماركات للإعلانات</p>
                    </>
                  )}
                  {payMethod === "etisalat" && (
                    <>
                      <p className="text-white/60 text-xs mb-1">حوّل المبلغ لاتصالات كاش:</p>
                      <p className="text-white font-bold text-2xl tracking-widest" dir="ltr">01126665741</p>
                      <p className="text-white/40 text-xs mt-1">سوق ماركات للإعلانات</p>
                    </>
                  )}
                  {payMethod === "instapay" && (
                    <>
                      <p className="text-white/60 text-xs mb-1">حوّل المبلغ عبر إنستاباي لـ:</p>
                      <p className="text-white font-bold text-2xl tracking-widest" dir="ltr">01285558567</p>
                      <p className="text-white/40 text-xs mt-1">سوق ماركات للإعلانات</p>
                    </>
                  )}
                  {payMethod === "bank" && (
                    <>
                      <p className="text-white/60 text-xs mb-1">حوّل المبلغ لحساب البنك التالي:</p>
                      <p className="text-white font-bold text-sm">البنك الأهلي المصري</p>
                      <p className="text-white text-sm" dir="ltr">1234567890123456</p>
                      <p className="text-white/40 text-xs mt-1">باسم: سوق ماركات للإعلانات</p>
                    </>
                  )}
                  {payMethod === "souq" && (
                    <div>
                      <div className="text-center mb-3">
                        <div className="text-3xl mb-1">🛍️</div>
                        <p className="text-white font-bold text-sm">حمّل تطبيق سوق ماركات وادفع منه</p>
                        <p className="text-white/50 text-[11px]">ثم أرسل رقم إيصال الدفع أدناه</p>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        <a href="https://play.google.com/store/apps/details?id=com.apmo.souqmarket" target="_blank" rel="noreferrer"
                          className="flex flex-col items-center gap-1 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl px-2 py-2.5 transition-all"
                          data-testid="btn-download-android">
                          <span className="text-xl">▶</span>
                          <p className="text-white/60 text-[9px]">احصل عليه من</p>
                          <p className="text-white text-[10px] font-bold">Google Play</p>
                        </a>
                        <a href="https://apps.apple.com/eg/app/as-souqmarket/id6740153334" target="_blank" rel="noreferrer"
                          className="flex flex-col items-center gap-1 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl px-2 py-2.5 transition-all"
                          data-testid="btn-download-ios">
                          <span className="text-xl"></span>
                          <p className="text-white/60 text-[9px]">متاح على</p>
                          <p className="text-white text-[10px] font-bold">App Store</p>
                        </a>
                        <a href="https://app.as-souqmarkat.com/?from-splash=false" target="_blank" rel="noreferrer"
                          className="flex flex-col items-center gap-1 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl px-2 py-2.5 transition-all"
                          data-testid="btn-download-huawei">
                          <span className="text-xl">📱</span>
                          <p className="text-white/60 text-[9px]">متاح على</p>
                          <p className="text-white text-[10px] font-bold">App Gallery</p>
                        </a>
                      </div>
                    </div>
                  )}
                  {payMethod === "installment" && (
                    <>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">💰</span>
                        <div>
                          <p className="text-white font-bold text-sm">تقسيط بدون فوائد أو رسوم</p>
                          <p className="text-yellow-400 text-xs font-bold">55 يوم فترة سماح مجانية</p>
                        </div>
                      </div>
                      <div className="space-y-1.5 mb-2">
                        <div className="flex items-center gap-2 bg-white/5 rounded-lg px-2 py-1.5">
                          <span className="text-sm">🏦</span>
                          <p className="text-white/80 text-xs">فيزا البنك الأهلي المصري</p>
                        </div>
                        <div className="flex items-center gap-2 bg-white/5 rounded-lg px-2 py-1.5">
                          <span className="text-sm">💳</span>
                          <p className="text-white/80 text-xs">أي بطاقة فيزا أو ماستر كارد أخرى</p>
                        </div>
                      </div>
                      <p className="text-white/40 text-[10px] border-t border-white/10 pt-2">
                        بعد الدفع أرسل صورة إيصال التقسيط لإتمام الشحن
                      </p>
                    </>
                  )}
                  {payMethod !== "souq" && (
                  <div className="mt-3 pt-3 border-t border-white/10">
                    <p className="text-yellow-400 font-bold text-base">المبلغ: {selectedPkg.price_egp} ج.م</p>
                    <p className="text-white/40 text-[10px]">اكتب في ملاحظة التحويل: "شحن عملات"</p>
                  </div>
                  )}
                </div>

                {/* Payment reference input */}
                <div className="mb-4">
                  <label className="text-white/60 text-xs font-bold mb-1.5 block">
                    {payMethod === "souq" ? "أدخل رقم إيصال الدفع من التطبيق"
                    : payMethod === "installment" ? "أدخل رقم إيصال التقسيط / رقم العملية"
                    : "أدخل رقم مرجع التحويل / رقم العملية"}
                  </label>
                  <input type="text" value={payRef} onChange={e => setPayRef(e.target.value)}
                    placeholder={
                      payMethod === "vodafone" || payMethod === "vodafone2" ? "مثال: 123456789"
                      : payMethod === "instapay" ? "مثال: INST-2024-XXXX"
                      : payMethod === "souq" ? "رقم الإيصال من تطبيق سوق ماركات"
                      : payMethod === "installment" ? "رقم إيصال التقسيط"
                      : "رقم المرجع من البنك"
                    }
                    className="w-full bg-white/10 border border-white/20 text-white placeholder:text-white/30 rounded-xl px-4 py-3 text-sm"
                    data-testid="input-pay-ref" dir="ltr"
                  />
                </div>

                {/* Buttons */}
                <div className="flex gap-2">
                  <button onClick={() => setPurchaseStep("packages")} className="flex-1 py-3 rounded-2xl bg-white/10 text-white font-bold text-sm">رجوع</button>
                  <button onClick={submitPurchaseOrder} disabled={payLoading || !payRef.trim()} className="flex-1 py-3 rounded-2xl bg-yellow-500 text-black font-bold text-sm disabled:opacity-50" data-testid="btn-submit-purchase">
                    {payLoading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : "تأكيد الطلب ✓"}
                  </button>
                </div>
                <p className="text-white/20 text-[10px] text-center mt-3">سيتم مراجعة الطلب وإضافة العملات خلال دقائق</p>
              </>
            )}

            {/* ── Step 3: Done ── */}
            {purchaseStep === "done" && (
              <div className="text-center py-6">
                <div className="text-6xl mb-4">✅</div>
                <h4 className="text-white font-bold text-xl mb-2">تم استلام طلبك!</h4>
                <p className="text-white/60 text-sm mb-1">سيتم مراجعة الدفع وإضافة العملات إلى محفظتك</p>
                <p className="text-yellow-400 text-sm font-bold mb-6">خلال بضع دقائق ⚡</p>
                <button onClick={() => { setShowRechargeModal(false); setPurchaseStep("packages"); setSelectedPkg(null); setPayRef(""); }}
                  className="px-8 py-3 rounded-2xl bg-yellow-500 text-black font-bold">
                  حسناً
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEWER LIST MODAL (broadcaster can kick) */}
      {showViewerList && isBroadcast && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setShowViewerList(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-lg bg-zinc-900 rounded-t-3xl p-5 pb-safe max-h-[70vh] overflow-y-auto" onClick={e => e.stopPropagation()} dir="rtl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-white" />
                <h3 className="text-white font-bold text-lg">الجمهور ({viewersList.length})</h3>
              </div>
              <button onClick={() => setShowViewerList(false)} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
            {viewersList.length === 0 ? (
              <p className="text-white/50 text-sm text-center py-6">لا يوجد مشاهدين حالياً</p>
            ) : (
              <div className="space-y-2">
                {viewersList.map(v => (
                  <div key={v.socketId} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-purple-600/30 flex items-center justify-center">
                        <span className="text-white text-sm font-bold">{v.userName.charAt(0)}</span>
                      </div>
                      <span className="text-white text-sm font-medium">{v.userName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => kickViewer(v.socketId)}
                        className="flex items-center gap-1 bg-red-600/20 border border-red-500/30 text-red-400 text-xs font-bold px-2.5 py-1.5 rounded-lg hover:bg-red-600/40 transition-colors"
                        data-testid={`btn-kick-${v.socketId}`}
                      >
                        <ShieldOff className="w-3 h-3" />
                        طرد
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* BATTLE SETUP MODAL (broadcaster — invite another live stream) */}
      {showBattleSetup && isBroadcast && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setShowBattleSetup(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-lg bg-zinc-900 rounded-t-3xl p-5 pb-safe" onClick={e => e.stopPropagation()} dir="rtl">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <span className="text-2xl">⚔️</span>
                <div>
                  <h3 className="text-white font-bold text-lg">تحدي مذيع آخر</h3>
                  <p className="text-white/50 text-xs">اختر مذيعاً مباشراً لتحديه!</p>
                </div>
              </div>
              <button onClick={() => setShowBattleSetup(false)} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            {battleInviteSent ? (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 text-yellow-400 animate-spin mx-auto mb-3" />
                <p className="text-white font-bold">في انتظار رد المذيع...</p>
                <p className="text-white/50 text-xs mt-1">ينتهي الطلب خلال 30 ثانية</p>
              </div>
            ) : (
              <>
                <div className="bg-white/5 border border-white/10 rounded-xl p-3 mb-4 space-y-1.5">
                  <div className="flex items-center gap-2 text-white/60 text-xs">
                    <span>⏱️</span><span>مدة الجولة: <span className="text-white font-bold">5 دقائق</span></span>
                  </div>
                  <div className="flex items-center gap-2 text-white/60 text-xs">
                    <span>📺</span><span>شاشة مقسومة: <span className="text-white font-bold">بثك + بث الخصم</span></span>
                  </div>
                  <div className="flex items-center gap-2 text-white/60 text-xs">
                    <span>🎁</span><span>جمهور كل مذيع يرسل هدايا لمذيعه</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/60 text-xs">
                    <span>⚡</span><span>مضاعفات: <span className="text-blue-400 font-bold">x2</span> <span className="text-purple-400 font-bold">x3</span> <span className="text-yellow-400 font-bold">x5</span> — للسكور فقط</span>
                  </div>
                </div>

                <p className="text-white/60 text-xs font-bold mb-2">البثوث المباشرة الآن:</p>
                {liveStreamsForBattle.length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-white/40 text-sm">لا يوجد بثوث مباشرة أخرى حالياً</p>
                    <button onClick={fetchLiveStreamsForBattle} className="mt-2 text-yellow-400 text-xs underline" data-testid="btn-refresh-streams">
                      تحديث القائمة
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
                    {liveStreamsForBattle.map((s: any) => (
                      <button
                        key={s.id}
                        onClick={() => sendBattleInvite(String(s.id))}
                        className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-yellow-500/10 hover:border-yellow-500/30 transition-all"
                        data-testid={`btn-invite-stream-${s.id}`}
                      >
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center">
                          <Radio className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1 text-start">
                          <p className="text-white font-bold text-sm truncate">{s.title || `بث #${s.id}`}</p>
                          <p className="text-white/50 text-[10px]">{s.viewerCount || 0} مشاهد</p>
                        </div>
                        <span className="text-yellow-400 text-xs font-bold">⚔️ تحدي</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* SHARE MODAL */}
      {showShare && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setShowShare(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-lg bg-zinc-900 rounded-t-3xl p-6 pb-safe" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-bold text-lg">شارك البث</h3>
              <button onClick={() => setShowShare(false)} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-3 mb-5">
              {shareLinks.map(s => (
                s.copy ? (
                  <button
                    key={s.label}
                    onClick={() => {
                      navigator.clipboard.writeText(streamUrl);
                      toast({ title: `✅ تم نسخ الرابط — افتح ${s.label} والصقه!` });
                      setShowShare(false);
                    }}
                    className="flex flex-col items-center gap-1.5"
                    data-testid={`btn-share-${s.label}`}
                  >
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg" style={{ backgroundColor: s.color }}>
                      <s.icon className={s.textDark ? "text-black text-2xl" : "text-white text-2xl"} />
                    </div>
                    <span className="text-white text-xs">{s.label}</span>
                  </button>
                ) : (
                  <a key={s.label} href={s.href!} target="_blank" rel="noopener noreferrer"
                    className="flex flex-col items-center gap-1.5"
                    data-testid={`btn-share-${s.label}`}
                  >
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg" style={{ backgroundColor: s.color }}>
                      <s.icon className={s.textDark ? "text-black text-2xl" : "text-white text-2xl"} />
                    </div>
                    <span className="text-white text-xs">{s.label}</span>
                  </a>
                )
              ))}
            </div>
            {myRefCode && (
              <div className="bg-amber-500/20 border border-amber-400/30 rounded-xl px-3 py-2 mb-3 text-center">
                <p className="text-amber-300 text-xs font-bold">💰 شارك واكسب! كل مستخدم جديد يسجّل من رابطك = مكافأة</p>
                <p className="text-amber-400/70 text-xs mt-0.5">كودك: <span className="font-mono font-bold">{myRefCode}</span></p>
              </div>
            )}
            <div className="flex items-center gap-2 bg-white/10 rounded-xl px-3 py-2">
              <span className="text-white/70 text-xs flex-1 truncate">{streamShareUrl}</span>
              <button
                onClick={() => { navigator.clipboard.writeText(streamShareUrl); toast({ title: "✅ تم نسخ الرابط" }); }}
                className="bg-white/20 text-white text-xs px-3 py-1.5 rounded-lg font-bold flex-shrink-0"
                data-testid="btn-copy-stream-link"
              >
                نسخ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REPORT DIALOG */}
      {showReportDialog && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setShowReportDialog(false)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative w-full max-w-lg bg-zinc-900 rounded-t-3xl p-5 pb-8" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-red-600/30 flex items-center justify-center">
                  <Flag className="w-4 h-4 text-red-400" />
                </div>
                <h3 className="text-white font-bold text-base">الإبلاغ عن البث</h3>
              </div>
              <button onClick={() => setShowReportDialog(false)} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            <p className="text-white/60 text-xs mb-4 leading-relaxed">
              اختر سبب البلاغ. عند تجاوز عدد البلاغات الحد المسموح به، سيتم تحذير المذيع أو إيقاف البث تلقائياً.
            </p>

            {/* Reason options */}
            <div className="flex flex-col gap-2 mb-5">
              {[
                { value: "revealing_clothes",  label: "ملابس غير لائقة أو إباحية" },
                { value: "sexual_content",     label: "محتوى جنسي أو حديث مخل" },
                { value: "drugs_alcohol",      label: "مخدرات أو كحول أو تدخين" },
                { value: "mixed_conversation", label: "خلطة بين رجال ونساء بطريقة مخالفة" },
                { value: "hate_speech",        label: "إهانة أو تحريض أو خطاب كراهية" },
                { value: "fraud",              label: "احتيال أو نصب" },
                { value: "other",              label: "سبب آخر" },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setReportReason(opt.value)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-start ${
                    reportReason === opt.value
                      ? "border-red-500 bg-red-600/20 text-white"
                      : "border-white/10 bg-white/5 text-white/70"
                  }`}
                  data-testid={`report-reason-${opt.value}`}
                >
                  <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${reportReason === opt.value ? "border-red-400 bg-red-400" : "border-white/30"}`} />
                  <span className="text-sm">{opt.label}</span>
                </button>
              ))}
            </div>

            {/* Submit */}
            <button
              onClick={async () => {
                if (!reportReason || reportSubmitting) return;
                setReportSubmitting(true);
                try {
                  await fetch(`/api/streams/${id}/report`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ reason: reportReason }),
                  });
                  setReportDone(true);
                  setShowReportDialog(false);
                  toast({ title: "✅ تم إرسال البلاغ", description: "شكراً لمساعدتنا في الحفاظ على بيئة آمنة." });
                } catch {
                  toast({ title: "خطأ", description: "فشل إرسال البلاغ. حاول مجدداً.", variant: "destructive" });
                } finally {
                  setReportSubmitting(false);
                }
              }}
              disabled={!reportReason || reportSubmitting}
              className="w-full py-3 rounded-2xl bg-red-600 text-white font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-2"
              data-testid="btn-submit-stream-report"
            >
              {reportSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flag className="w-4 h-4" />}
              إرسال البلاغ
            </button>
          </div>
        </div>
      )}

      {/* GIFT PANEL */}
      {showGiftPanel && !isBroadcast && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setShowGiftPanel(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-lg bg-zinc-900 rounded-t-3xl p-5 pb-safe" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-white font-bold text-lg">أرسل هدية 🎁</h3>
                <p className="text-white/50 text-xs">رصيدك: <span className="text-yellow-400 font-bold">{myCoins} عملة</span></p>
              </div>
              <button onClick={() => setShowGiftPanel(false)} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {GIFTS.map(gift => (
                <button
                  key={gift.type}
                  onClick={() => { sendGift(gift); }}
                  className={`flex flex-col items-center gap-1 bg-white/10 hover:bg-white/20 active:scale-95 transition-all rounded-2xl p-3 border ${myCoins >= gift.coins ? "border-white/10" : "border-red-500/30 opacity-50"}`}
                  data-testid={`btn-gift-${gift.type}`}
                >
                  <span className="text-3xl">{gift.emoji}</span>
                  <span className="text-white text-[10px] font-bold">{gift.name}</span>
                  <span className="text-yellow-400 text-[10px] font-bold">{gift.coins} 🪙</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CHAT INPUT BAR */}
      <div className="flex-shrink-0 bg-zinc-900/95 border-t border-white/10 pb-safe">
        {user ? (
          <div className="flex items-center gap-2 px-3 py-2">
            <Input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
              placeholder="اكتب تعليقاً..."
              maxLength={200}
              className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-white/40 rounded-full h-9 text-sm px-4"
              data-testid="input-chat"
            />
            <button
              onClick={sendChat}
              disabled={!chatInput.trim()}
              className="w-9 h-9 rounded-full bg-red-500 disabled:opacity-40 flex items-center justify-center flex-shrink-0"
              data-testid="btn-send-chat"
            >
              <Send className="w-4 h-4 text-white" />
            </button>
          </div>
        ) : (
          <div className="px-4 py-3 text-center text-white/40 text-sm">
            <button onClick={() => setLocation("/login")} className="text-red-400 font-semibold">سجّل دخولك</button> للمشاركة في الدردشة
          </div>
        )}
      </div>
    </div>
  );
}
