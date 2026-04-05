import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { io, Socket } from "socket.io-client";
import {
  Mic, MicOff, Video, VideoOff, PhoneOff,
  Eye, Send, ArrowRight, Heart, RotateCcw,
  WifiOff, Volume2, VolumeX, FlipHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

/* ─── ICE servers ─────────────────────────────────────── */
const ICE: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "turn:openrelay.metered.ca:80",    username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443",   username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443",   username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turns:openrelay.metered.ca:443",  username: "openrelayproject", credential: "openrelayproject" },
];

interface ChatMsg {
  userName: string;
  message: string;
  isOwner?: boolean;
}

/* ═══════════════════════════════════════════════════════ */
export default function LiveStream() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const params = new URLSearchParams(window.location.search);
  const isBroadcast = params.get("mode") === "broadcast";

  /* ── state ── */
  const [streaming,        setStreaming]        = useState(false);
  const [viewerCount,      setViewerCount]      = useState(0);
  const [muted,            setMuted]            = useState(false);
  const [videoOff,         setVideoOff]         = useState(false);
  const [liked,            setLiked]            = useState(false);
  const [likesCount,       setLikesCount]       = useState(0);
  const [messages,         setMessages]         = useState<ChatMsg[]>([]);
  const [chatInput,        setChatInput]        = useState("");
  const [audioBlocked,     setAudioBlocked]     = useState(false);
  const [ended,            setEnded]            = useState(false);
  const [camFacing,        setCamFacing]        = useState<"user" | "environment">("user");
  const [cameraError,      setCameraError]      = useState("");
  const [facingSupported,  setFacingSupported]  = useState(false);

  /* ── refs ── */
  const videoRef      = useRef<HTMLVideoElement>(null);
  const socketRef     = useRef<Socket | null>(null);
  const localStream   = useRef<MediaStream | null>(null);
  const peers         = useRef<Map<string, RTCPeerConnection>>(new Map());
  const streamStarted = useRef(false);

  /* ── query: stream info ── */
  const { data: stream } = useQuery<any>({
    queryKey: ["/api/streams", id],
    queryFn: () => fetch(`/api/streams/${id}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!id,
    refetchInterval: 5000,
  });

  /* ─── create peer connection ─────────────────────────── */
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
          videoRef.current
            .play()
            .then(() => { setAudioBlocked(false); setStreaming(true); })
            .catch(() => { setAudioBlocked(true); setStreaming(true); });
        }
      };
    }

    return pc;
  }, [isBroadcast]);

  /* ─── start camera (broadcaster) ────────────────────── */
  const startCamera = useCallback(async (facing: "user" | "environment" = "user") => {
    try {
      // detect if facingMode switching is supported
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === "videoinput");
      setFacingSupported(videoDevices.length > 1);

      const ms = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });

      // Replace tracks in existing peers when camera switches
      if (localStream.current) {
        const oldTracks = localStream.current.getTracks();
        const newVideoTrack = ms.getVideoTracks()[0];
        peers.current.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === "video");
          if (sender && newVideoTrack) sender.replaceTrack(newVideoTrack);
        });
        oldTracks.forEach(t => t.stop());
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

  /* ─── socket + WebRTC setup ─────────────────────────── */
  useEffect(() => {
    if (!id) return;

    const socket = io({ path: "/socket.io", transports: ["websocket", "polling"] });
    socketRef.current = socket;

    /* ── shared events ── */
    socket.on("viewer-count",  (n: number)  => setViewerCount(n));
    socket.on("stream-like",   ()           => setLikesCount(p => p + 1));
    socket.on("chat-message",  (msg: ChatMsg) =>
      setMessages(prev => [...prev.slice(-60), msg])
    );

    socket.on("connect", () => {
      socket.emit("join-stream", id);
    });

    /* ══ BROADCASTER ══════════════════════════════════ */
    if (isBroadcast) {

      // When a viewer is ready to receive
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

      // Start camera & go live
      (async () => {
        if (streamStarted.current) return;
        streamStarted.current = true;

        const ms = await startCamera(camFacing);
        if (!ms) return;

        setStreaming(true);
        socket.emit("broadcaster", id);
        await fetch(`/api/streams/${id}/start`, { method: "POST", credentials: "include" }).catch(() => {});
        toast({ title: "🔴 البث مباشر الآن", description: "أنت على الهواء — يمكن للمشاهدين رؤيتك الآن" });
      })();
    }

    /* ══ VIEWER ═══════════════════════════════════════ */
    if (!isBroadcast) {

      // Server tells us broadcaster is live → request stream
      socket.on("broadcaster", () => {
        socket.emit("watcher", id);
      });

      socket.on("offer", async (bcastId: string, offer: RTCSessionDescriptionInit) => {
        let pc = peers.current.get(bcastId);
        if (!pc) {
          pc = newPeer(bcastId);
          peers.current.set(bcastId, pc);
        }
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
      });
    }

    return () => {
      socket.emit("leave-stream", id);
      socket.disconnect();
      localStream.current?.getTracks().forEach(t => t.stop());
      peers.current.forEach(pc => pc.close());
      peers.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isBroadcast]);

  /* ─── flip camera ────────────────────────────────────── */
  const flipCamera = async () => {
    const next: "user" | "environment" = camFacing === "user" ? "environment" : "user";
    setCamFacing(next);
    await startCamera(next);
  };

  /* ─── mute / video off ───────────────────────────────── */
  const toggleMute = () => {
    const track = localStream.current?.getAudioTracks()[0];
    if (track) { track.enabled = !track.enabled; setMuted(!track.enabled); }
  };

  const toggleVideo = () => {
    const track = localStream.current?.getVideoTracks()[0];
    if (track) { track.enabled = !track.enabled; setVideoOff(!track.enabled); }
  };

  /* ─── end stream ─────────────────────────────────────── */
  const endStream = async () => {
    await fetch(`/api/streams/${id}/end`, { method: "POST", credentials: "include" }).catch(() => {});
    localStream.current?.getTracks().forEach(t => t.stop());
    queryClient.invalidateQueries({ queryKey: ["/api/streams"] });
    setLocation("/livestream");
  };

  /* ─── chat ───────────────────────────────────────────── */
  const sendChat = () => {
    if (!chatInput.trim() || !user) return;
    const userName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || "مستخدم";
    socketRef.current?.emit("chat-message", {
      streamId: id,
      userId: user.id,
      userName,
      message: chatInput.trim(),
      isOwner: isBroadcast,
    });
    setChatInput("");
  };

  /* ─── like ───────────────────────────────────────────── */
  const handleLike = () => {
    if (liked) return;
    setLiked(true);
    socketRef.current?.emit("stream-like", id);
  };

  /* ─── unlock audio (viewer) ─────────────────────────── */
  const unlockAudio = () => {
    if (videoRef.current) {
      videoRef.current.muted = false;
      videoRef.current.volume = 1;
      videoRef.current.play().catch(() => {});
      setAudioBlocked(false);
    }
  };

  /* ─── render ─────────────────────────────────────────── */
  const userName = user ? `${(user as any).firstName || ""} ${(user as any).lastName || ""}`.trim() || "مستخدم" : "";

  return (
    <div className="relative w-full h-[100dvh] bg-black flex flex-col overflow-hidden select-none" dir="rtl">

      {/* ══ VIDEO AREA ═══════════════════════════════════ */}
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

        {/* ── Camera error ── */}
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

        {/* ── Waiting overlay ── */}
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

        {/* ── Stream ended overlay (viewer) ── */}
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

        {/* ── Audio unlock overlay (viewer) ── */}
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

        {/* ── TOP BAR ── */}
        <div className="absolute top-0 inset-x-0 z-10 bg-gradient-to-b from-black/70 to-transparent px-4 pt-4 pb-12 pointer-events-none">
          <div className="flex items-center gap-2.5 pointer-events-auto">
            {/* Back */}
            <button
              onClick={() => setLocation("/livestream")}
              className="w-9 h-9 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-white flex-shrink-0"
              data-testid="btn-back-stream"
            >
              <ArrowRight className="w-4 h-4" />
            </button>

            {/* Title */}
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm truncate leading-tight">
                {stream?.title || "بث مباشر"}
              </p>
              {stream?.channelName && (
                <p className="text-white/60 text-[11px] truncate">{stream.channelName}</p>
              )}
            </div>

            {/* Live badge */}
            {(streaming || stream?.status === "live") && (
              <Badge className="bg-red-500 text-white text-xs font-bold gap-1 px-2.5 py-1 flex-shrink-0">
                <span className="w-1.5 h-1.5 bg-white rounded-full inline-block animate-pulse" />
                مباشر
              </Badge>
            )}

            {/* Viewer count */}
            <Badge className="bg-black/60 text-white text-xs gap-1 flex-shrink-0" data-testid="badge-viewer-count">
              <Eye className="w-3 h-3" /> {viewerCount.toLocaleString()}
            </Badge>
          </div>
        </div>

        {/* ── CHAT MESSAGES (floating, bottom-left) ── */}
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

        {/* ── VIEWER ACTIONS (right side) ── */}
        {!isBroadcast && streaming && !ended && (
          <div
            className="absolute end-3 z-10 flex flex-col items-center gap-4"
            style={{ bottom: "88px" }}
          >
            {/* Like */}
            <button
              onClick={handleLike}
              className="flex flex-col items-center gap-0.5"
              data-testid="btn-stream-like"
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all ${liked ? "bg-red-500 scale-110" : "bg-black/60"}`}>
                <Heart className={`w-6 h-6 ${liked ? "text-white fill-white" : "text-white"}`} />
              </div>
              <span className="text-white text-[10px] font-bold drop-shadow">{likesCount}</span>
            </button>

            {/* Mute toggle for viewer */}
            <button
              onClick={() => {
                if (videoRef.current) {
                  const nowMuted = !videoRef.current.muted;
                  videoRef.current.muted = nowMuted;
                  videoRef.current.volume = nowMuted ? 0 : 1;
                }
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

        {/* ── BROADCASTER CONTROLS ── */}
        {isBroadcast && streaming && (
          <div
            className="absolute inset-x-0 z-10 flex items-center justify-center gap-3 px-5"
            style={{ bottom: "84px" }}
          >
            {/* Mute mic */}
            <button
              onClick={toggleMute}
              data-testid="btn-toggle-mic"
              className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all border-2 ${
                muted ? "bg-red-500 border-red-400" : "bg-black/70 border-white/20 hover:bg-black/90"
              }`}
            >
              {muted ? <MicOff className="w-6 h-6 text-white" /> : <Mic className="w-6 h-6 text-white" />}
            </button>

            {/* Toggle camera */}
            <button
              onClick={toggleVideo}
              data-testid="btn-toggle-camera"
              className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all border-2 ${
                videoOff ? "bg-red-500 border-red-400" : "bg-black/70 border-white/20 hover:bg-black/90"
              }`}
            >
              {videoOff ? <VideoOff className="w-6 h-6 text-white" /> : <Video className="w-6 h-6 text-white" />}
            </button>

            {/* Flip camera (mobile only) */}
            {facingSupported && (
              <button
                onClick={flipCamera}
                data-testid="btn-flip-camera"
                className="w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all bg-black/70 border-2 border-white/20 hover:bg-black/90"
              >
                <FlipHorizontal className="w-6 h-6 text-white" />
              </button>
            )}

            {/* End stream */}
            <button
              onClick={endStream}
              data-testid="btn-end-stream"
              className="h-14 px-6 rounded-full bg-red-600 hover:bg-red-700 flex items-center gap-2 text-white font-bold text-sm shadow-xl transition-all"
            >
              <PhoneOff className="w-5 h-5" />
              إنهاء البث
            </button>
          </div>
        )}

      </div>{/* end video area */}

      {/* ══ CHAT INPUT BAR ════════════════════════════════ */}
      <div className="flex-shrink-0 bg-zinc-900/95 border-t border-white/10 safe-bottom">
        {user ? (
          <div className="flex items-center gap-2 px-3 py-2">
            <Input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
              placeholder="اكتب تعليقاً..."
              maxLength={200}
              className="flex-1 h-10 rounded-full bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:bg-white/15 text-sm"
              data-testid="input-chat"
            />
            <Button
              size="sm"
              onClick={sendChat}
              disabled={!chatInput.trim()}
              className="h-10 w-10 p-0 rounded-full flex-shrink-0"
              data-testid="btn-send-chat"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <div className="px-4 py-2">
            <a href="/login">
              <Button variant="outline" className="w-full rounded-full border-white/20 text-white bg-white/10 hover:bg-white/20 text-sm h-10">
                سجّل دخول للمشاركة في الدردشة
              </Button>
            </a>
          </div>
        )}
      </div>

    </div>
  );
}
