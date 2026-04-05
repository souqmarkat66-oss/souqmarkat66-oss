import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { io, Socket } from "socket.io-client";
import {
  Mic, MicOff, Video, VideoOff, PhoneOff,
  Eye, Send, ArrowRight, Heart, RotateCcw,
  WifiOff, Volume2, VolumeX, FlipHorizontal,
  Copy, Check, Radio, Monitor,
} from "lucide-react";
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

  // RTMP mode state
  const [broadcastMode,   setBroadcastMode]   = useState<"webrtc"|"rtmp">("webrtc");
  const [rtmpKey,         setRtmpKey]         = useState<string>("");
  const [rtmpUrl,         setRtmpUrl]         = useState<string>("rtmp://ads-as.com/live");
  const [copiedKey,       setCopiedKey]       = useState(false);
  const [copiedUrl,       setCopiedUrl]       = useState(false);
  const [hlsUrl,          setHlsUrl]          = useState<string>("");
  const [rtmpSetup,       setRtmpSetup]       = useState(false); // broadcaster done picking mode

  /* ── refs ── */
  const videoRef      = useRef<HTMLVideoElement>(null);
  const hlsVideoRef   = useRef<HTMLVideoElement>(null);
  const socketRef     = useRef<Socket | null>(null);
  const localStream   = useRef<MediaStream | null>(null);
  const peers         = useRef<Map<string, RTCPeerConnection>>(new Map());
  const streamStarted = useRef(false);
  const hlsInstance   = useRef<any>(null);

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
    }

    return () => {
      socket.emit("leave-stream", id);
      socket.disconnect();
      localStream.current?.getTracks().forEach(t => t.stop());
      peers.current.forEach(pc => pc.close());
      peers.current.clear();
      if (hlsInstance.current) { hlsInstance.current.destroy(); hlsInstance.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isBroadcast]);

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

      {/* CHAT INPUT BAR */}
      <div className="flex-shrink-0 bg-zinc-900/95 border-t border-white/10 safe-bottom">
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
