import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, X, Upload, Image as ImageIcon, Music } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Reel {
  id: number;
  title: string;
  description: string | null;
  videoUrl: string | null;
  audioUrl: string | null;
}

interface EditReelDialogProps {
  reel: Reel;
  open: boolean;
  onClose: () => void;
}

export function EditReelDialog({ reel, open, onClose }: EditReelDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState(reel.title);
  const [description, setDescription] = useState(reel.description ?? "");
  const [videoUrl, setVideoUrl] = useState(reel.videoUrl ?? "");
  const [audioUrl, setAudioUrl] = useState(reel.audioUrl ?? "");
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);

  const mediaFileRef = useRef<HTMLInputElement>(null);
  const audioFileRef = useRef<HTMLInputElement>(null);

  const isImage = (url: string) => /\.(jpg|jpeg|png|gif|webp|bmp|svg|avif)(\?|$)/i.test(url);
  const isJsonArray = (url: string) => { try { const v = JSON.parse(url); return Array.isArray(v); } catch { return false; } };

  const uploadFile = async (file: File): Promise<string> => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd, credentials: "include" });
    if (!res.ok) throw new Error("فشل الرفع");
    const data = await res.json();
    return data.url as string;
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    e.target.value = "";
    setUploadingMedia(true);
    try {
      const urls = await Promise.all(files.map(uploadFile));
      if (urls.length === 1) setVideoUrl(urls[0]);
      else setVideoUrl(JSON.stringify(urls));
    } catch {
      toast({ variant: "destructive", title: "فشل رفع الملف" });
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploadingAudio(true);
    try {
      setAudioUrl(await uploadFile(file));
    } catch {
      toast({ variant: "destructive", title: "فشل رفع الصوت" });
    } finally {
      setUploadingAudio(false);
    }
  };

  const mediaPreview = () => {
    if (!videoUrl) return null;
    if (isJsonArray(videoUrl)) {
      const imgs: string[] = JSON.parse(videoUrl);
      return (
        <div className="grid grid-cols-3 gap-1 rounded-xl overflow-hidden">
          {imgs.slice(0, 6).map((src, i) => (
            <img key={i} src={src} alt="" className="aspect-square object-cover w-full" />
          ))}
        </div>
      );
    }
    if (isImage(videoUrl)) return <img src={videoUrl} alt="preview" className="w-full max-h-48 object-contain rounded-xl border" />;
    return <video src={videoUrl} controls className="w-full max-h-48 rounded-xl border" />;
  };

  const updateMut = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/reels/${reel.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          videoUrl: videoUrl.trim() || null,
          audioUrl: audioUrl.trim() || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "فشل التعديل");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reels"] });
      toast({ title: "✅ تم تعديل الريل بنجاح!" });
      onClose();
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل التعديل", description: e.message }),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right text-lg font-bold">✏️ تعديل الريل</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">

          {/* Title */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">العنوان *</Label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="عنوان الريل..."
              className={title.trim().length < 2 ? "border-red-400" : ""}
              data-testid="edit-reel-title"
            />
            {title.trim().length < 2 && <p className="text-xs text-red-500">⚠ العنوان مطلوب</p>}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">الوصف / التعليق</Label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="وصف أو تعليق اختياري..."
              rows={2}
            />
          </div>

          {/* Media */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">الصورة / الفيديو</Label>
            {videoUrl ? (
              <div className="space-y-2">
                {mediaPreview()}
                <button
                  onClick={() => setVideoUrl("")}
                  className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600"
                >
                  <X className="w-3.5 h-3.5" /> إزالة المحتوى الحالي
                </button>
              </div>
            ) : (
              <div
                onClick={() => mediaFileRef.current?.click()}
                className="border-2 border-dashed border-muted-foreground/30 rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
              >
                {uploadingMedia
                  ? <><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /><p className="text-xs text-muted-foreground mt-2">جاري الرفع...</p></>
                  : <><ImageIcon className="w-8 h-8 mx-auto text-muted-foreground mb-2" /><p className="text-sm font-medium">ارفع صورة أو فيديو</p><p className="text-xs text-muted-foreground">يمكن رفع أكثر من صورة</p></>
                }
                <input ref={mediaFileRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleMediaUpload} />
              </div>
            )}
          </div>

          {/* Audio */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">الموسيقى / الصوت</Label>
            {audioUrl ? (
              <div className="flex items-center gap-2 bg-green-500/10 rounded-lg p-2">
                <audio src={audioUrl} controls className="flex-1 h-8" />
                <button
                  onClick={() => setAudioUrl("")}
                  className="w-6 h-6 rounded-full bg-red-500 text-white text-xs flex items-center justify-center hover:bg-red-600"
                >✕</button>
              </div>
            ) : (
              <div
                onClick={() => audioFileRef.current?.click()}
                className="border-2 border-dashed border-muted-foreground/30 rounded-xl p-4 text-center cursor-pointer hover:border-green-500/50 hover:bg-green-500/5 transition-all"
              >
                {uploadingAudio
                  ? <><Loader2 className="w-5 h-5 animate-spin mx-auto text-green-500" /><p className="text-xs text-muted-foreground mt-1">جاري رفع الصوت...</p></>
                  : <><Music className="w-6 h-6 mx-auto text-muted-foreground mb-1" /><p className="text-sm">ارفع ملف صوتي (MP3)</p></>
                }
                <input ref={audioFileRef} type="file" accept="audio/*" className="hidden" onChange={handleAudioUpload} />
              </div>
            )}
          </div>

          {/* Buttons */}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={updateMut.isPending}>
              إلغاء
            </Button>
            <Button
              className="flex-1 gap-2"
              onClick={() => updateMut.mutate()}
              disabled={updateMut.isPending || title.trim().length < 2}
              data-testid="edit-reel-save"
            >
              {updateMut.isPending
                ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري الحفظ...</>
                : <>✅ حفظ التعديلات</>
              }
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
