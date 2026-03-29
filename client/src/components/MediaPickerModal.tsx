import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import {
  Image, Video, Upload, Trash2, Check, Search, X, Loader2,
  FolderOpen, Copy, HardDrive
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

interface MediaPickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string, type: "image" | "video") => void;
  accept?: "image" | "video" | "both";
}

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function MediaPickerModal({ open, onClose, onSelect, accept = "both" }: MediaPickerModalProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState<"all" | "image" | "video">("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: files = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/files"],
    queryFn: () => fetch("/api/files", { credentials: "include" }).then(r => r.json()),
    enabled: open,
  });

  const deleteFile = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/files/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/files"] });
      if (selected?.id === deleteFile.variables) setSelected(null);
      toast({ title: "🗑️ تم حذف الملف" });
    },
  });

  const handleUpload = useCallback(async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    let uploadedCount = 0;
    for (const file of Array.from(fileList)) {
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: fd, credentials: "include" });
        if (res.ok) uploadedCount++;
      } catch {}
    }
    await qc.invalidateQueries({ queryKey: ["/api/files"] });
    setUploading(false);
    toast({ title: `✅ تم رفع ${uploadedCount} ملف` });
  }, [qc, toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    handleUpload(e.dataTransfer.files);
  }, [handleUpload]);

  const filtered = files.filter(f => {
    const isImg = f.mimeType?.startsWith("image/");
    const isVid = f.mimeType?.startsWith("video/");
    if (accept === "image" && !isImg) return false;
    if (accept === "video" && !isVid) return false;
    if (filter === "image" && !isImg) return false;
    if (filter === "video" && !isVid) return false;
    if (search && !f.originalName?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalSize = files.reduce((sum, f) => sum + (f.size || 0), 0);

  const handleSelect = () => {
    if (!selected) return;
    const type = selected.mimeType?.startsWith("video/") ? "video" : "image";
    onSelect(selected.url, type);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-4xl w-full h-[85vh] flex flex-col p-0 gap-0" dir="rtl">
        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-3 border-b flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-primary" />
            مكتبة الوسائط
          </DialogTitle>
          <DialogDescription className="text-xs">
            {files.length} ملف · {formatBytes(totalSize)} مستخدم
          </DialogDescription>
        </DialogHeader>

        {/* Toolbar */}
        <div className="flex items-center gap-2 px-5 py-3 border-b flex-shrink-0 flex-wrap">
          {/* Filter tabs */}
          <div className="flex rounded-lg border overflow-hidden">
            {(["all", "image", "video"] as const).map(t => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors
                  ${filter === t ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >
                {t === "all" ? "الكل" : t === "image" ? "🖼️ صور" : "🎬 فيديو"}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="ابحث باسم الملف..."
              className="pr-8 h-8 text-sm"
            />
            {search && <button className="absolute left-2 top-1/2 -translate-y-1/2" onClick={() => setSearch("")}><X className="w-3.5 h-3.5 text-muted-foreground" /></button>}
          </div>

          {/* Upload button */}
          <Button size="sm" className="gap-1.5 h-8" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            رفع ملف
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={accept === "image" ? "image/*" : accept === "video" ? "video/*" : "image/*,video/*"}
            className="hidden"
            onChange={e => handleUpload(e.target.files)}
          />
        </div>

        {/* Grid */}
        <div
          className="flex-1 overflow-y-auto p-4"
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
        >
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center h-full gap-4 border-2 border-dashed border-border rounded-2xl text-muted-foreground cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
                <Upload className="w-8 h-8 opacity-40" />
              </div>
              <div className="text-center">
                <p className="font-medium">{files.length === 0 ? "مكتبتك فارغة" : "لا توجد نتائج"}</p>
                <p className="text-sm mt-1">{files.length === 0 ? "اسحب الملفات هنا أو اضغط لرفع ملفات" : "جرب تغيير الفلتر أو البحث"}</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
              {filtered.map(file => {
                const isImg = file.mimeType?.startsWith("image/");
                const isVid = file.mimeType?.startsWith("video/");
                const isSelected = selected?.id === file.id;
                return (
                  <div
                    key={file.id}
                    onClick={() => setSelected(isSelected ? null : file)}
                    data-testid={`media-file-${file.id}`}
                    className={`relative group cursor-pointer rounded-xl overflow-hidden border-2 transition-all aspect-square
                      ${isSelected ? "border-primary shadow-lg shadow-primary/20 scale-[0.97]" : "border-transparent hover:border-primary/30"}`}
                  >
                    {isImg ? (
                      <img src={file.url} alt={file.originalName} className="w-full h-full object-cover bg-muted" />
                    ) : isVid ? (
                      <div className="w-full h-full bg-black flex items-center justify-center relative">
                        <video src={file.url} className="w-full h-full object-cover opacity-70" muted />
                        <Video className="absolute w-6 h-6 text-white" />
                      </div>
                    ) : (
                      <div className="w-full h-full bg-muted flex items-center justify-center">
                        <HardDrive className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}

                    {/* Selected check */}
                    {isSelected && (
                      <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      </div>
                    )}

                    {/* Hover overlay */}
                    <div className={`absolute inset-0 bg-black/60 flex flex-col items-center justify-end p-1.5 opacity-0 group-hover:opacity-100 transition-opacity ${isSelected ? "opacity-100" : ""}`}>
                      <p className="text-white text-[9px] text-center truncate w-full">{file.originalName}</p>
                    </div>

                    {/* Delete btn */}
                    <button
                      onClick={e => { e.stopPropagation(); if (confirm("حذف هذا الملف؟")) deleteFile.mutate(file.id); }}
                      className="absolute top-1 left-1 w-6 h-6 rounded-lg bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-600"
                      data-testid={`btn-delete-file-${file.id}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer — file details + actions */}
        <div className="border-t px-5 py-4 flex-shrink-0">
          {selected ? (
            <div className="flex items-center gap-4">
              {/* Thumb */}
              <div className="w-12 h-12 rounded-xl overflow-hidden bg-muted flex-shrink-0">
                {selected.mimeType?.startsWith("image/")
                  ? <img src={selected.url} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center"><Video className="w-5 h-5 text-muted-foreground" /></div>
                }
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{selected.originalName}</p>
                <p className="text-xs text-muted-foreground">
                  {formatBytes(selected.size)} · {selected.mimeType} · {selected.createdAt ? format(new Date(selected.createdAt), "dd/MM/yyyy", { locale: ar }) : ""}
                </p>
              </div>
              {/* Actions */}
              <div className="flex gap-2 flex-shrink-0">
                <Button
                  variant="outline" size="sm" className="gap-1 text-xs"
                  onClick={() => { navigator.clipboard.writeText(window.location.origin + selected.url); toast({ title: "✅ تم نسخ الرابط" }); }}
                >
                  <Copy className="w-3 h-3" /> نسخ الرابط
                </Button>
                <Button size="sm" className="gap-1 text-xs" onClick={handleSelect} data-testid="btn-select-media">
                  <Check className="w-3 h-3" /> اختر هذا الملف
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">اختر ملفاً من المكتبة أو ارفع ملفاً جديداً</p>
              <Button variant="outline" size="sm" onClick={onClose}>إغلاق</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
