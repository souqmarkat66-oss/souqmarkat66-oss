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
  Share2, Gift,
} from "lucide-react";
import { SiWhatsapp, SiFacebook, SiX, SiTelegram } from "react-icons/si";
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
  type CoHostStatus = "idle"|"requesting"|"accepted"|"rejected";
  const [coHostStatus,    setCoHostStatus]    = useState<CoHostStatus>("idle");
  const [coHostRequests,  setCoHostRequests]  = useState<{socketId:string; userName:string}[]>([]);
  const [activeCoHosts,   setActiveCoHosts]   = useState<{socketId:string; name:string}[]>([]);
  const [autoAccept,      setAutoAccept]      = useState(false);

  // In-stream ads state
  const [streamAds,       setStreamAds]       = useState<any[]>([]);
  const [currentAdIdx,    setCurrentAdIdx]    = useState(0);
  const [adVisible,       setAdVisible]       = useState(false);

  // Share & Gift state
  const [showShare,       setShowShare]       = useState(false);
  const [showGiftPanel,   setShowGiftPanel]   = useState(false);
  interface FlyingGift { id: number; emoji: string; x: number; }
  const [flyingGifts,     setFlyingGifts]     = useState<FlyingGift[]>([]);
  const [myCoins,         setMyCoins]         = useState(500); // starter coins

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
        ? "الرجاء السماح للمتصفح بالوصول للكاميرا والميكروفون"
        : "تعذّر فتح الكاميرا — تأكد من عدم استخدامها في تطبيق آخر";
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

      // ── Co-host events (broadcaster side) ──
      socket.on("cohost-request", (data: { socketId: string; userName: string }) => {
        coHostNamesMap.current.set(data.socketId, data.userName);
        setCoHostRequests(prev => [...prev.filter(r => r.socketId !== data.socketId), data]);
        toast({ title: "🎙️ طلب مشاركة", description: `${data.userName} يريد الانضمام للبث` });
      });

      socket.on("cohost-auto-joined", (data: { socketId: string; userName: string }) => {
        coHostNamesMap.current.set(data.socketId, data.userName);
        setActiveCoHosts(prev => [...prev.filter(c => c.socketId !== data.socketId), { socketId: data.socketId, name: data.userName }]);
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
        toast({ title: "انتهت المشاركة", description: "غادر أحد الضيوف البث" });
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
    }

    // ── Gift events (both broadcaster and viewer) ──
    socket.on("stream-gift", (data: { id: number; giftEmoji: string; giftName: string; giftCoins: number; userName: string }) => {
      const x = 10 + Math.random() * 60;
      const flyId = Date.now() + Math.random();
      setFlyingGifts(prev => [...prev, { id: flyId, emoji: data.giftEmoji, x }]);
      setTimeout(() => setFlyingGifts(prev => prev.filter(g => g.id !== flyId)), 3000);
      if (isBroadcast) {
        toast({ title: `🎁 هدية من ${data.userName}!`, description: `${data.giftEmoji} ${data.giftName} — ${data.giftCoins} عملة` });
      }
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
      if (hlsInstance.current) { hlsInstance.current.destroy(); hlsInstance.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isBroadcast]);

  /* ─── In-stream ads ─────────────────────────────────── */
  useEffect(() => {
    if (!streaming) return;
    // Fetch a pool of active ads
    fetch("/api/ads?limit=20&status=active", { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        const ads = Array.isArray(data) ? data : (data.ads || []);
        const imageAds = ads.filter((a: any) => a.media_type === "image" || !a.media_type);
        if (imageAds.length > 0) setStreamAds(imageAds);
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
  const requestCoHost = async () => {
    if (!user) return;

    // Must open camera HERE — inside a user-gesture handler — so mobile browsers allow it
    setCoHostStatus("requesting");
    toast({ title: "📷 جاري فتح الكاميرا...", description: "اسمح للمتصفح بالوصول للكاميرا والميكروفون" });

    const ms = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      audio: { echoCancellation: true, noiseSuppression: true },
    }).catch((err) => {
      console.error("getUserMedia error:", err);
      return null;
    });

    if (!ms) {
      setCoHostStatus("idle");
      toast({ title: "تعذّر فتح الكاميرا", description: "اسمح للمتصفح بالوصول للكاميرا والميكروفون ثم حاول مجدداً", variant: "destructive" });
      return;
    }

    // Store stream now — so cohost-accepted handler can use it without another getUserMedia call
    coHostStream.current = ms;

    // Show self-preview immediately
    if (coHostSelfVideo.current) {
      coHostSelfVideo.current.srcObject = ms;
      coHostSelfVideo.current.muted = true;
      coHostSelfVideo.current.play().catch(() => {});
    }

    const userName = `${(user as any).firstName || ""} ${(user as any).lastName || ""}`.trim() || "مستخدم";
    socketRef.current?.emit("request-cohost", { streamId: id, userId: (user as any).id, userName });
    toast({ title: "⏳ تم إرسال الطلب", description: "في انتظار موافقة المُذيع" });
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
    socketRef.current?.emit("accept-cohost", { streamId: id, guestSocketId: socketId, guestName: userName });
    setCoHostRequests(prev => prev.filter(r => r.socketId !== socketId));
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
    toast({ title: newVal ? "✅ القبول التلقائي مفعّل" : "القبول التلقائي معطّل", description: newVal ? "كل من يطلب سيدخل مباشرة" : "ستراجع طلبات المشاركة يدوياً" });
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
    });
    setMyCoins(prev => prev - gift.coins);
  };

  /* ─── Share helpers ───────────────────────────────────── */
  const streamUrl = typeof window !== "undefined" ? `${window.location.origin}/streams/${id}` : "";
  const shareText = encodeURIComponent(`شاهد البث المباشر على شبكة سوق! ${streamUrl}`);
  const shareLinks = [
    { icon: SiWhatsapp,  label: "واتساب",   color: "#25D366", href: `https://wa.me/?text=${shareText}` },
    { icon: SiFacebook,  label: "فيسبوك",   color: "#1877F2", href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(streamUrl)}` },
    { icon: SiX,         label: "تويتر X",  color: "#000000", href: `https://twitter.com/intent/tweet?text=${shareText}` },
    { icon: SiTelegram,  label: "تيليغرام", color: "#26A5E4", href: `https://t.me/share/url?url=${encodeURIComponent(streamUrl)}&text=${encodeURIComponent("شاهد البث المباشر على شبكة سوق!")}` },
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
        {isBroadcast && cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black text-center px-6 gap-5 z-20">
            <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center">
              <VideoOff className="w-10 h-10 text-red-400" />
            </div>
            <p className="text-white font-bold text-base">{cameraError}</p>
            <button
              onClick={() => startCamera(camFacing)}
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-white text-black font-bold text-sm"
              data-testid="btn-retry-camera"
            >
              <RotateCcw className="w-4 h-4" /> حاول مجدداً
            </button>
          </div>
        )}

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

            {/* SHARE BUTTON */}
            <button onClick={() => { setShowShare(true); setShowGiftPanel(false); }} className="flex flex-col items-center gap-0.5" data-testid="btn-share-stream">
              <div className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg bg-blue-600/80 backdrop-blur">
                <Share2 className="w-6 h-6 text-white" />
              </div>
              <span className="text-white text-[10px] font-bold drop-shadow">مشاركة</span>
            </button>

            {/* GIFT BUTTON */}
            {user && (
              <button onClick={() => { setShowGiftPanel(p => !p); setShowShare(false); }} className="flex flex-col items-center gap-0.5" data-testid="btn-gift-panel">
                <div className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg bg-yellow-500/80 backdrop-blur relative">
                  <Gift className="w-6 h-6 text-white" />
                  <span className="absolute -top-1 -end-1 bg-black/70 text-white text-[9px] font-bold rounded-full px-1">{myCoins}</span>
                </div>
                <span className="text-white text-[10px] font-bold drop-shadow">هدية</span>
              </button>
            )}

            {/* CO-HOST REQUEST BUTTON */}
            {user && coHostStatus === "idle" && (
              <button onClick={requestCoHost} className="flex flex-col items-center gap-0.5" data-testid="btn-request-cohost">
                <div className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg bg-purple-600/80 backdrop-blur">
                  <UserPlus className="w-6 h-6 text-white" />
                </div>
                <span className="text-white text-[10px] font-bold drop-shadow">مشاركة</span>
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
              <button onClick={leaveCoHost} className="flex flex-col items-center gap-0.5" data-testid="btn-leave-cohost">
                <div className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg bg-red-600 animate-pulse">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <span className="text-white text-[10px] font-bold drop-shadow">إنهاء</span>
              </button>
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
          <div className="absolute bottom-20 start-3 z-20">
            <video
              ref={coHostSelfVideo}
              autoPlay playsInline muted
              className="w-28 h-40 rounded-2xl object-cover border-2 border-purple-500 shadow-xl"
              data-testid="video-cohost-self"
            />
            {coHostStatus === "requesting" && (
              <div className="absolute inset-0 flex items-end justify-center pb-1">
                <span className="text-[10px] text-white bg-yellow-500 rounded-full px-1.5 py-0.5 font-bold">انتظار...</span>
              </div>
            )}
            {coHostStatus === "accepted" && (
              <div className="absolute inset-0 flex items-end justify-center pb-1">
                <span className="text-[10px] text-white bg-red-600 rounded-full px-1.5 py-0.5 font-bold animate-pulse">LIVE</span>
              </div>
            )}
          </div>
        )}

        {/* CO-HOST REQUESTS PANEL (broadcaster) */}
        {isBroadcast && coHostRequests.length > 0 && (
          <div className="absolute top-16 inset-x-4 z-20 flex flex-col gap-2">
            {coHostRequests.map(req => (
              <div key={req.socketId} className="flex items-center gap-2 bg-black/80 backdrop-blur rounded-2xl px-3 py-2.5 border border-purple-500/40">
                <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
                  <UserPlus className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-bold truncate">{req.userName}</p>
                  <p className="text-white/50 text-[10px]">يطلب المشاركة بالصوت والصورة</p>
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

        {/* CO-HOST PiP Grid — broadcaster sees all guests */}
        {isBroadcast && activeCoHosts.length > 0 && (
          <div className="absolute bottom-36 start-3 z-20 flex flex-col gap-2">
            {activeCoHosts.map((ch, idx) => (
              <div key={ch.socketId} className="relative">
                <video
                  autoPlay playsInline
                  ref={el => {
                    if (el) {
                      coHostVideoRefs.current.set(ch.socketId, el);
                      const ms = coHostStreams.current.get(ch.socketId);
                      if (ms && !el.srcObject) { el.srcObject = ms; el.play().catch(() => {}); }
                    }
                  }}
                  className="w-24 h-36 rounded-xl object-cover border-2 border-purple-500 shadow-xl"
                  data-testid={`video-cohost-${idx}`}
                />
                <div className="absolute top-1 inset-x-0 flex items-center justify-center">
                  <span className="text-[9px] text-white bg-purple-600 rounded-full px-1 py-0.5 font-bold truncate max-w-[80px]">{ch.name}</span>
                </div>
                <button
                  onClick={() => endCoHostFromBroadcaster(ch.socketId)}
                  className="absolute -top-1.5 -end-1.5 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center shadow-lg"
                  data-testid={`btn-end-cohost-${idx}`}
                >
                  <X className="w-2.5 h-2.5 text-white" />
                </button>
              </div>
            ))}
          </div>
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

        {/* IN-STREAM AD BANNER */}
        {streaming && adVisible && streamAds.length > 0 && stream?.showAds !== false && (() => {
          const ad = streamAds[currentAdIdx];
          return (
            <div className="absolute inset-x-3 z-20 flex items-center gap-3 bg-black/85 backdrop-blur-md rounded-2xl p-2.5 border border-white/10 shadow-2xl"
              style={{ bottom: "92px", animation: "slideInLeft 0.4s ease-out" }}
            >
              {/* Ad thumbnail */}
              <img
                src={ad.media_url}
                alt={ad.title}
                className="w-14 h-14 rounded-xl object-cover flex-shrink-0 border border-white/10"
              />
              {/* Ad info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 mb-0.5">
                  <span className="text-[9px] text-yellow-400 font-bold bg-yellow-400/15 rounded px-1 py-0.5">إعلان</span>
                </div>
                <p className="text-white text-xs font-bold truncate leading-tight">{ad.title}</p>
                {ad.price_egp && (
                  <p className="text-green-400 text-[11px] font-bold">{Number(ad.price_egp).toLocaleString("ar-EG")} ج.م</p>
                )}
              </div>
              {/* CTA button */}
              <div className="flex flex-col gap-1.5 flex-shrink-0">
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
                    className="bg-white/20 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-xl"
                    data-testid="btn-ad-view"
                  >
                    عرض
                  </a>
                )}
                <button
                  onClick={() => setAdVisible(false)}
                  className="text-white/40 text-[9px] text-center"
                  data-testid="btn-ad-dismiss"
                >
                  إغلاق
                </button>
              </div>
            </div>
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
      </div>

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
            <div className="grid grid-cols-4 gap-4 mb-5">
              {shareLinks.map(s => (
                <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer"
                  className="flex flex-col items-center gap-1.5"
                  data-testid={`btn-share-${s.label}`}
                >
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg" style={{ backgroundColor: s.color }}>
                    <s.icon className="text-white text-2xl" />
                  </div>
                  <span className="text-white text-xs">{s.label}</span>
                </a>
              ))}
            </div>
            <div className="flex items-center gap-2 bg-white/10 rounded-xl px-3 py-2">
              <span className="text-white/70 text-xs flex-1 truncate">{streamUrl}</span>
              <button
                onClick={() => { navigator.clipboard.writeText(streamUrl); toast({ title: "✅ تم نسخ الرابط" }); }}
                className="bg-white/20 text-white text-xs px-3 py-1.5 rounded-lg font-bold flex-shrink-0"
                data-testid="btn-copy-stream-link"
              >
                نسخ
              </button>
            </div>
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
