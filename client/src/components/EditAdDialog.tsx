import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, X, Image as ImageIcon, Video } from "lucide-react";
import { useUpdateAd } from "@/hooks/use-ads";
import { useToast } from "@/hooks/use-toast";
import { UploadZone } from "@/components/UploadZone";

interface Ad {
  id: number;
  title: string;
  description: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
  priceEGP?: number | null;
  whatsappNumber?: string | null;
}

interface EditAdDialogProps {
  ad: Ad;
  open: boolean;
  onClose: () => void;
}

export function EditAdDialog({ ad, open, onClose }: EditAdDialogProps) {
  const { toast } = useToast();
  const updateAd = useUpdateAd();

  const [title, setTitle] = useState(ad.title);
  const [description, setDescription] = useState(ad.description ?? "");
  const [mediaUrl, setMediaUrl] = useState(ad.mediaUrl ?? "");
  const [mediaType, setMediaType] = useState(ad.mediaType ?? "image");
  const [priceEGP, setPriceEGP] = useState(ad.priceEGP ? String(ad.priceEGP) : "");
  const [whatsapp, setWhatsapp] = useState(ad.whatsappNumber ?? "");

  const handleSave = async () => {
    if (!title.trim() || title.trim().length < 2) {
      toast({ variant: "destructive", title: "العنوان مطلوب (حرفان على الأقل)" });
      return;
    }
    if (!description.trim() || description.trim().length < 5) {
      toast({ variant: "destructive", title: "الوصف مطلوب (5 أحرف على الأقل)" });
      return;
    }
    try {
      await updateAd.mutateAsync({
        id: ad.id,
        data: {
          title: title.trim(),
          description: description.trim(),
          mediaUrl: mediaUrl.trim() || undefined,
          mediaType: mediaType as any,
          priceEGP: priceEGP ? Number(priceEGP) : undefined,
          whatsappNumber: whatsapp.trim() || undefined,
        },
      });
      toast({ title: "✅ تم تعديل الإعلان بنجاح!" });
      onClose();
    } catch (e: any) {
      toast({ variant: "destructive", title: "فشل التعديل", description: e.message });
    }
  };

  const isVideo = mediaUrl && (mediaUrl.endsWith(".mp4") || mediaUrl.endsWith(".webm") || mediaType === "video");

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right text-lg font-bold flex items-center gap-2">
            ✏️ تعديل الإعلان
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">

          {/* Title */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">العنوان *</Label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="عنوان الإعلان..."
              className={title.trim().length < 2 ? "border-red-400" : ""}
              data-testid="edit-input-title"
            />
            {title.trim().length < 2 && <p className="text-xs text-red-500">⚠ العنوان مطلوب</p>}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">الوصف *</Label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="وصف الإعلان..."
              rows={3}
              className={description.trim().length < 5 ? "border-red-400" : ""}
              data-testid="edit-input-description"
            />
            {description.trim().length < 5 && <p className="text-xs text-red-500">⚠ الوصف مطلوب (5 أحرف)</p>}
          </div>

          {/* Media */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">الصورة / الفيديو</Label>

            {/* Preview */}
            {mediaUrl && (
              <div className="relative rounded-xl overflow-hidden bg-black/5 border">
                {isVideo ? (
                  <video src={mediaUrl} className="w-full max-h-48 object-contain" controls />
                ) : (
                  <img src={mediaUrl} alt="media" className="w-full max-h-48 object-contain" />
                )}
                <button
                  onClick={() => { setMediaUrl(""); setMediaType("image"); }}
                  className="absolute top-2 left-2 w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 shadow"
                  data-testid="edit-btn-remove-media"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="absolute bottom-2 right-2">
                  <span className="text-[10px] bg-black/60 text-white rounded px-1.5 py-0.5">
                    {isVideo ? "🎬 فيديو" : "🖼 صورة"}
                  </span>
                </div>
              </div>
            )}

            {/* Upload zone */}
            {!mediaUrl && (
              <UploadZone
                value={mediaUrl}
                onChange={(url) => {
                  setMediaUrl(url);
                  const isVid = url.endsWith(".mp4") || url.endsWith(".webm") || url.endsWith(".mov");
                  setMediaType(isVid ? "video" : "image");
                }}
                label="ارفع صورة أو فيديو جديد"
              />
            )}

            {/* URL input */}
            {!mediaUrl && (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">أو أدخل رابطاً</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                <Input
                  placeholder="https://example.com/image.jpg"
                  dir="ltr"
                  onChange={e => {
                    const url = e.target.value.trim();
                    setMediaUrl(url);
                    const isVid = url.endsWith(".mp4") || url.endsWith(".webm");
                    setMediaType(isVid ? "video" : "image");
                  }}
                  data-testid="edit-input-media-url"
                />
              </div>
            )}
          </div>

          {/* Price */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">السعر (ج.م) — اختياري</Label>
            <Input
              type="number"
              value={priceEGP}
              onChange={e => setPriceEGP(e.target.value)}
              placeholder="0"
              min="0"
              data-testid="edit-input-price"
            />
          </div>

          {/* WhatsApp */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">رقم واتساب — اختياري</Label>
            <Input
              value={whatsapp}
              onChange={e => setWhatsapp(e.target.value)}
              placeholder="01xxxxxxxxx"
              dir="ltr"
              data-testid="edit-input-whatsapp"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={updateAd.isPending}
            >
              إلغاء
            </Button>
            <Button
              className="flex-1 gap-2"
              onClick={handleSave}
              disabled={updateAd.isPending || title.trim().length < 2 || description.trim().length < 5}
              data-testid="edit-btn-save"
            >
              {updateAd.isPending
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
