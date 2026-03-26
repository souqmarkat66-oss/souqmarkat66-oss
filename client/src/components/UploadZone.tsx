import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X, Image, Video, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface UploadZoneProps {
  value?: string;
  onChange: (url: string) => void;
  accept?: string;
  label?: string;
}

export function UploadZone({ value, onChange, accept = "image/*,video/*", label = "ارفع صورة أو فيديو" }: UploadZoneProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(value || "");
  const [isVideo, setIsVideo] = useState(false);
  const { toast } = useToast();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setIsVideo(file.type.startsWith("video/"));
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData, credentials: "include" });
      if (!res.ok) throw new Error("فشل الرفع");
      const data = await res.json();
      setPreview(data.url);
      onChange(data.url);
      toast({ title: "تم الرفع بنجاح!" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "خطأ في الرفع", description: err.message });
    } finally {
      setUploading(false);
    }
  };

  const clear = () => { setPreview(""); onChange(""); };

  return (
    <div>
      <input ref={fileRef} type="file" accept={accept} onChange={handleFile} className="hidden" />
      {preview ? (
        <div className="relative rounded-xl overflow-hidden border">
          {isVideo ? (
            <video src={preview} className="w-full max-h-48 object-contain bg-black" controls />
          ) : (
            <img src={preview} className="w-full max-h-48 object-contain bg-muted" alt="Preview" />
          )}
          <Button size="icon" variant="destructive" onClick={clear} className="absolute top-2 end-2 w-7 h-7">
            <X className="w-3 h-3" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="w-full border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center gap-3 hover:border-primary hover:bg-primary/5 transition-colors cursor-pointer disabled:opacity-50"
        >
          {uploading ? (
            <><Loader2 className="w-8 h-8 animate-spin text-primary" /><span className="text-sm text-muted-foreground">جاري الرفع...</span></>
          ) : (
            <>
              <div className="flex gap-2">
                <Image className="w-6 h-6 text-muted-foreground" />
                <Video className="w-6 h-6 text-muted-foreground" />
              </div>
              <span className="text-sm font-medium">{label}</span>
              <span className="text-xs text-muted-foreground">PNG, JPG, MP4, MOV حتى 200MB</span>
              <div className="flex items-center gap-2 mt-1 bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-medium">
                <Upload className="w-3 h-3" /> رفع مباشر
              </div>
            </>
          )}
        </button>
      )}
    </div>
  );
}
