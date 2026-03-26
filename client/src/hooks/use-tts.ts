import { useState, useRef, useCallback } from "react";

export type TTSVoice = "alloy" | "nova" | "shimmer" | "echo" | "fable" | "onyx";

export function useTTS() {
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const generate = useCallback(async (
    text: string,
    voice: TTSVoice = "nova",
    autoPlay = true
  ): Promise<string | null> => {
    if (!text.trim()) return null;
    setLoading(true);
    try {
      const res = await fetch("/api/ai/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text, voice }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "فشل التوليد");
      const url = data.url as string;
      setAudioUrl(url);
      if (autoPlay) {
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onplay = () => setPlaying(true);
        audio.onended = () => setPlaying(false);
        audio.onpause = () => setPlaying(false);
        await audio.play();
      }
      return url;
    } finally {
      setLoading(false);
    }
  }, []);

  const play = useCallback((url?: string) => {
    const src = url || audioUrl;
    if (!src) return;
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(src);
    audioRef.current = audio;
    audio.onplay = () => setPlaying(true);
    audio.onended = () => setPlaying(false);
    audio.onpause = () => setPlaying(false);
    audio.play();
  }, [audioUrl]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setPlaying(false);
  }, []);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setPlaying(false);
  }, []);

  const reset = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setAudioUrl(null);
    setPlaying(false);
  }, []);

  return { generate, play, pause, stop, reset, loading, playing, audioUrl };
}
