import { useEffect, useRef, useState } from "react";
import { useParams, useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Radio, Users, Heart, Send, MicOff, VideoOff, PhoneOff, Mic, Video, Share2, Eye, MessageCircle } from "lucide-react";
import { io, Socket } from "socket.io-client";
import type { LiveStream as LiveStreamType } from "@shared/schema";

interface ChatMsg { id: number; userName: string; message: string; timestamp: string; }

export default function LiveStream() {
  const { id } = useParams<{ id: string }>();
  const search = useSearch();
  const isBroadcast = search.includes("mode=broadcast");
  const { user } = useAuth();
  const { toast } = useToast();

  const videoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [viewerCount, setViewerCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { data: stream, isLoading } = useQuery<LiveStreamType>({
    queryKey: ["/api/streams", Number(id)],
    queryFn: () => fetch(`/api/streams/${id}`).then(r => r.json()),
    refetchInterval: 10000,
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
    if (historyMessages) setMessages(historyMessages.map((m: any) => ({ id: m.id, userName: m.userName, message: m.message, timestamp: m.createdAt })));
  }, [historyMessages]);

  useEffect(() => {
    if (stream) setLikesCount(stream.likesCount || 0);
  }, [stream]);

  useEffect(() => {
    const socket = io({ path: "/socket.io" });
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
      socket.emit("leave-stream", id);
      socket.disconnect();
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      peersRef.current.forEach(pc => pc.close());
    };
  }, [id, isBroadcast]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const createPeer = (socket: Socket, viewerId?: string) => {
    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }] });
    pc.onicecandidate = (e) => { if (e.candidate) socket.emit("candidate", viewerId || "broadcaster", e.candidate); };
    return pc;
  };

  const setupBroadcaster = async (socket: Socket) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.muted = true; }
      setStreaming(true);

      socket.emit("broadcaster", id);
      await fetch(`/api/streams/${id}/start`, { method: "POST", credentials: "include" });

      socket.on("watcher", async (watcherId: string) => {
        const pc = createPeer(socket, watcherId);
        peersRef.current.set(watcherId, pc);
        stream.getTracks().forEach(t => pc.addTrack(t, stream));
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("offer", watcherId, pc.localDescription);
      });

      socket.on("answer", async (watcherId: string, desc: RTCSessionDescriptionInit) => {
        await peersRef.current.get(watcherId)?.setRemoteDescription(desc);
      });

      socket.on("candidate", async (watcherId: string, candidate: RTCIceCandidateInit) => {
        await peersRef.current.get(watcherId)?.addIceCandidate(new RTCIceCandidate(candidate));
      });
    } catch (err: any) {
      toast({ variant: "destructive", title: "خطأ في الكاميرا", description: err.message });
    }
  };

  const setupWatcher = (socket: Socket) => {
    socket.emit("watcher", id);

    socket.on("broadcaster", () => socket.emit("watcher", id));
    socket.on("broadcaster-disconnected", () => {
      if (videoRef.current) videoRef.current.srcObject = null;
      toast({ title: "انتهى البث المباشر" });
    });

    socket.on("offer", async (broadcasterId: string, desc: RTCSessionDescriptionInit) => {
      const pc = createPeer(socket);
      peersRef.current.set("broadcaster", pc);
      pc.ontrack = (e) => { if (videoRef.current) videoRef.current.srcObject = e.streams[0]; };
      socket.on("candidate", async (_: string, candidate: RTCIceCandidateInit) => {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      });
      await pc.setRemoteDescription(desc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("answer", broadcasterId, pc.localDescription);
    });
  };

  const sendChat = () => {
    if (!chatInput.trim() || !user) return;
    socketRef.current?.emit("chat-message", {
      streamId: id, userId: user.id, userName: user.firstName || "مستخدم", message: chatInput.trim()
    });
    setChatInput("");
  };

  const handleLike = () => {
    setLiked(!liked);
    if (!liked) { setLikesCount(c => c + 1); socketRef.current?.emit("stream-like", id); }
    if (user) fetch("/api/likes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetType: "stream", targetId: Number(id) }), credentials: "include" });
  };

  const toggleMute = () => {
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = muted; });
    setMuted(!muted);
  };

  const toggleVideo = () => {
    localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = videoOff; });
    setVideoOff(!videoOff);
  };

  if (isLoading) return <div className="container py-12"><Skeleton className="aspect-video rounded-3xl" /></div>;

  return (
    <div className="container px-4 py-6">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Video Player */}
        <div className="flex-1">
          <div className="relative rounded-3xl overflow-hidden bg-black aspect-video shadow-2xl">
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-contain" />
            {!streaming && !isBroadcast && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                <div className="text-center text-white">
                  <Radio className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-lg">في انتظار البث...</p>
                </div>
              </div>
            )}
            <div className="absolute top-4 start-4 flex items-center gap-3">
              {(stream?.status === 'live' || streaming) && (
                <Badge className="bg-red-500 text-white gap-1 px-3 py-1 animate-pulse">
                  <Radio className="w-3 h-3" /> مباشر
                </Badge>
              )}
              <Badge variant="secondary" className="gap-1 bg-black/60 text-white backdrop-blur">
                <Eye className="w-3 h-3" /> {viewerCount}
              </Badge>
            </div>
            {isBroadcast && streaming && (
              <div className="absolute bottom-4 start-4 end-4 flex justify-center gap-3">
                <Button size="sm" variant="secondary" onClick={toggleMute} className={`rounded-full ${muted ? 'bg-red-500 text-white' : 'bg-black/60 text-white'}`}>
                  {muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </Button>
                <Button size="sm" variant="secondary" onClick={toggleVideo} className={`rounded-full ${videoOff ? 'bg-red-500 text-white' : 'bg-black/60 text-white'}`}>
                  {videoOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                </Button>
                <Button size="sm" onClick={() => endStreamMutation.mutate()} className="rounded-full bg-red-600 hover:bg-red-700 text-white gap-1">
                  <PhoneOff className="w-4 h-4" /> إنهاء البث
                </Button>
              </div>
            )}
          </div>

          <div className="mt-4 flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold">{stream?.title}</h1>
              {stream?.description && <p className="text-muted-foreground mt-1">{stream.description}</p>}
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={handleLike} variant={liked ? "default" : "outline"} className="gap-2">
                <Heart className={`w-4 h-4 ${liked ? 'fill-current' : ''}`} />
                {likesCount.toLocaleString()}
              </Button>
              <Button variant="outline" className="gap-2" onClick={() => { navigator.clipboard.writeText(window.location.href); toast({ title: "تم نسخ الرابط!" }); }}>
                <Share2 className="w-4 h-4" />
                مشاركة
              </Button>
            </div>
          </div>
        </div>

        {/* Live Chat */}
        <div className="lg:w-80 flex flex-col">
          <div className="bg-card border rounded-2xl overflow-hidden flex flex-col h-[500px]">
            <div className="p-4 border-b flex items-center gap-2 bg-muted/30">
              <MessageCircle className="w-4 h-4 text-primary" />
              <span className="font-bold">الدردشة المباشرة</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {messages.map((msg, i) => (
                <div key={i} className="text-sm">
                  <span className="font-semibold text-primary">{msg.userName}: </span>
                  <span className="text-foreground">{msg.message}</span>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="p-3 border-t flex gap-2">
              {user ? (
                <>
                  <Input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChat()} placeholder="أرسل رسالة..." className="flex-1 h-9 text-sm rounded-full" />
                  <Button size="sm" onClick={sendChat} className="h-9 w-9 p-0 rounded-full">
                    <Send className="w-4 h-4" />
                  </Button>
                </>
              ) : (
                <a href="/api/login" className="w-full">
                  <Button variant="outline" size="sm" className="w-full text-xs">سجل دخول للمشاركة</Button>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
