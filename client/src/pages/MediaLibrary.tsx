import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Upload, Trash2, Search, X, Loader2, Image, Video, Copy,
  HardDrive, FolderOpen, Filter, Grid3x3, List, Check, ExternalLink
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

function formatBytes(bytes: number) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function MediaLibrary() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [filter, setFilter] = useState<"all" | "image" | "video">("all");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [previewFile, setPreviewFile] = useState<any | null>(null);

  const { data: files = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/files"],
    queryFn: () => fetch("/api/files", { credentials: "include" }).then(r => r.json()),
    enabled: !!user,
  });

  const deleteFile = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/files/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["/api/files"] });
      setSelected(prev => { const next = new Set(prev); next.delete(id); return next; });
      if (previewFile?.id === id) setPreviewFile(null);
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
    toast({ title: `✅ تم رفع ${uploadedCount} ملف بنجاح` });
  }, [qc, toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleUpload(e.dataTransfer.files);
  }, [handleUpload]);

  const deleteSelected = async () => {
    if (!confirm(`حذف ${selected.size} ملف؟`)) return;
    for (const id of selected) { await deleteFile.mutateAsync(id).catch(() => {}); }
    setSelected(new Set());
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(window.location.origin + url);
    toast({ title: "✅ تم نسخ الرابط" });
  };

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Stats
  const imageFiles = files.filter(f => f.mimeType?.startsWith("image/"));
  const videoFiles = files.filter(f => f.mimeType?.startsWith("video/"));
  const totalSize  = files.reduce((s, f) => s + (f.size || 0), 0);

  const filtered = files.filter(f => {
    const isImg = f.mimeType?.startsWith("image/");
    const isVid = f.mimeType?.startsWith("video/");
    if (filter === "image" && !isImg) return false;
    if (filter === "video" && !isVid) return false;
    if (search && !f.originalName?.toLowerCase().includes(search.toLowerCase()) && !f.url?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (!user) return (
    <div className="container py-20 text-center text-muted-foreground">
      <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
      <p>يرجى تسجيل الدخول أولاً</p>
    </div>
  );

  return (
    <div className="container px-4 py-8 max-w-7xl" dir="rtl">
      {/* ── Header ───────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FolderOpen className="w-7 h-7 text-primary" />
            مكتبة الوسائط
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            جميع الصور والفيديوهات التي رفعتها — أعد استخدامها في إعلاناتك وحملاتك
          </p>
        </div>
        <Button
          className="gap-2" onClick={() => fileInputRef.current?.click()} disabled={uploading}
          data-testid="btn-upload-media"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          رفع ملفات
        </Button>
        <input
          ref={fileInputRef} type="file" multiple accept="image/*,video/*"
          className="hidden" onChange={e => handleUpload(e.target.files)}
        />
      </div>

      {/* ── Stats Cards ──────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: "إجمالي الملفات", value: files.length, icon: HardDrive, color: "text-blue-500" },
          { label: "الصور",          value: imageFiles.length, icon: Image,     color: "text-green-500" },
          { label: "الفيديوهات",     value: videoFiles.length, icon: Video,     color: "text-purple-500" },
          { label: "المساحة المستخدمة", value: formatBytes(totalSize), icon: HardDrive, color: "text-orange-500" },
        ].map(s => (
          <Card key={s.label} className="rounded-xl">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center bg-muted`}>
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <div>
                <div className="font-bold text-lg leading-tight">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Toolbar ──────────────────────────────── */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {/* Filter */}
        <div className="flex rounded-xl border overflow-hidden">
          {([["all","الكل"],["image","🖼️ صور"],["video","🎬 فيديو"]] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFilter(val as any)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors
                ${filter === val ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="ابحث باسم الملف..."
            className="pr-8 h-9 text-sm"
            data-testid="input-media-search"
          />
          {search && <button className="absolute left-2 top-1/2 -translate-y-1/2" onClick={() => setSearch("")}><X className="w-3.5 h-3.5 text-muted-foreground" /></button>}
        </div>

        <div className="flex-1" />

        {/* Bulk delete */}
        {selected.size > 0 && (
          <Button variant="destructive" size="sm" className="gap-1" onClick={deleteSelected}>
            <Trash2 className="w-3.5 h-3.5" /> حذف ({selected.size})
          </Button>
        )}

        {/* View mode */}
        <div className="flex rounded-xl border overflow-hidden">
          <button onClick={() => setViewMode("grid")} className={`p-2 transition-colors ${viewMode === "grid" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
            <Grid3x3 className="w-4 h-4" />
          </button>
          <button onClick={() => setViewMode("list")} className={`p-2 transition-colors ${viewMode === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
            <List className="w-4 h-4" />
          </button>
        </div>

        <span className="text-xs text-muted-foreground">{filtered.length} ملف</span>
      </div>

      <div className="flex gap-4">
        {/* ── File Grid / List ─────────────────────── */}
        <div
          className={`flex-1 ${isDragging ? "ring-2 ring-primary ring-offset-2 rounded-2xl" : ""}`}
          onDrop={handleDrop}
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
        >
          {isLoading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-24 gap-4 border-2 border-dashed border-border rounded-2xl cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center">
                <Upload className="w-10 h-10 opacity-30" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-lg">{files.length === 0 ? "مكتبتك فارغة" : "لا توجد نتائج"}</p>
                <p className="text-muted-foreground text-sm mt-1">
                  {files.length === 0 ? "اسحب الملفات هنا أو اضغط لرفع ملفات جديدة" : "جرب تغيير الفلتر أو البحث"}
                </p>
                {files.length === 0 && (
                  <Button className="mt-4 gap-2" onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                    <Upload className="w-4 h-4" /> ارفع أول ملف
                  </Button>
                )}
              </div>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {filtered.map(file => {
                const isImg = file.mimeType?.startsWith("image/");
                const isVid = file.mimeType?.startsWith("video/");
                const isSelected = selected.has(file.id);
                const isPreviewing = previewFile?.id === file.id;
                return (
                  <div
                    key={file.id}
                    className={`group relative rounded-xl overflow-hidden border-2 cursor-pointer transition-all aspect-square
                      ${isPreviewing ? "border-primary ring-2 ring-primary/30" : isSelected ? "border-primary/60" : "border-transparent hover:border-primary/20"}`}
                    onClick={() => setPreviewFile(isPreviewing ? null : file)}
                    data-testid={`media-item-${file.id}`}
                  >
                    {/* Thumbnail */}
                    {isImg
                      ? <img src={file.url} alt={file.originalName} className="w-full h-full object-cover bg-muted" loading="lazy" />
                      : isVid
                        ? <div className="w-full h-full bg-black relative"><video src={file.url} className="w-full h-full object-cover opacity-60" muted /><Video className="absolute inset-0 m-auto w-7 h-7 text-white" /></div>
                        : <div className="w-full h-full bg-muted flex items-center justify-center"><HardDrive className="w-7 h-7 text-muted-foreground" /></div>
                    }

                    {/* Overlay */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                      <div className="flex justify-between">
                        {/* Checkbox */}
                        <button
                          onClick={e => { e.stopPropagation(); toggleSelect(file.id); }}
                          className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors
                            ${isSelected ? "bg-primary border-primary" : "border-white bg-black/30"}`}
                        >
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </button>
                        {/* Delete */}
                        <button
                          onClick={e => { e.stopPropagation(); if (confirm("حذف هذا الملف؟")) deleteFile.mutate(file.id); }}
                          className="w-6 h-6 rounded-md bg-red-500 flex items-center justify-center hover:bg-red-600 transition-colors"
                          data-testid={`btn-delete-${file.id}`}
                        >
                          <Trash2 className="w-3 h-3 text-white" />
                        </button>
                      </div>
                      <p className="text-white text-[10px] truncate text-center">{file.originalName}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* List view */
            <div className="space-y-1">
              {filtered.map(file => {
                const isImg = file.mimeType?.startsWith("image/");
                const isVid = file.mimeType?.startsWith("video/");
                const isSelected = selected.has(file.id);
                return (
                  <div
                    key={file.id}
                    onClick={() => setPreviewFile(previewFile?.id === file.id ? null : file)}
                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors hover:bg-muted/60
                      ${previewFile?.id === file.id ? "bg-primary/5 ring-1 ring-primary/20" : ""}`}
                    data-testid={`media-list-${file.id}`}
                  >
                    {/* Checkbox */}
                    <button onClick={e => { e.stopPropagation(); toggleSelect(file.id); }}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? "bg-primary border-primary" : "border-border"}`}>
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </button>
                    {/* Thumb */}
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                      {isImg ? <img src={file.url} alt="" className="w-full h-full object-cover" />
                        : isVid ? <div className="w-full h-full bg-black flex items-center justify-center"><Video className="w-4 h-4 text-white" /></div>
                          : <HardDrive className="w-4 h-4 text-muted-foreground m-auto" />}
                    </div>
                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{file.originalName}</p>
                      <p className="text-xs text-muted-foreground">{formatBytes(file.size)} · {file.mimeType}</p>
                    </div>
                    {/* Date */}
                    <span className="text-xs text-muted-foreground flex-shrink-0">{file.createdAt ? format(new Date(file.createdAt), "dd/MM/yyyy", { locale: ar }) : ""}</span>
                    {/* Actions */}
                    <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 flex-shrink-0" onClick={e => e.stopPropagation()}>
                      <button onClick={() => copyUrl(file.url)} className="p-1.5 rounded-lg hover:bg-muted"><Copy className="w-3.5 h-3.5 text-muted-foreground" /></button>
                      <button onClick={() => { if (confirm("حذف؟")) deleteFile.mutate(file.id); }} className="p-1.5 rounded-lg hover:bg-red-50"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Preview Panel ────────────────────────── */}
        {previewFile && (
          <div className="w-64 flex-shrink-0">
            <Card className="rounded-2xl sticky top-4">
              <CardContent className="p-4">
                {/* Preview */}
                <div className="aspect-square rounded-xl overflow-hidden bg-muted mb-3">
                  {previewFile.mimeType?.startsWith("image/")
                    ? <img src={previewFile.url} alt={previewFile.originalName} className="w-full h-full object-contain" />
                    : previewFile.mimeType?.startsWith("video/")
                      ? <video src={previewFile.url} controls className="w-full h-full" />
                      : <div className="w-full h-full flex items-center justify-center"><HardDrive className="w-10 h-10 text-muted-foreground" /></div>
                  }
                </div>

                {/* File details */}
                <div className="space-y-2 text-sm mb-4">
                  <p className="font-medium break-all text-sm">{previewFile.originalName}</p>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <div className="flex justify-between"><span>النوع</span><span className="font-mono text-xs">{previewFile.mimeType?.split("/")[1]?.toUpperCase()}</span></div>
                    <div className="flex justify-between"><span>الحجم</span><span>{formatBytes(previewFile.size)}</span></div>
                    <div className="flex justify-between"><span>تاريخ الرفع</span><span>{previewFile.createdAt ? format(new Date(previewFile.createdAt), "dd/MM/yyyy", { locale: ar }) : ""}</span></div>
                  </div>
                </div>

                {/* URL */}
                <div className="bg-muted rounded-lg p-2 mb-3">
                  <p className="text-[10px] text-muted-foreground mb-1">رابط الملف</p>
                  <p className="text-xs font-mono break-all leading-relaxed text-foreground">{previewFile.url}</p>
                </div>

                {/* Actions */}
                <div className="space-y-2">
                  <Button size="sm" className="w-full gap-1.5" onClick={() => copyUrl(previewFile.url)} data-testid="btn-copy-url">
                    <Copy className="w-3.5 h-3.5" /> نسخ الرابط
                  </Button>
                  <Button size="sm" variant="outline" className="w-full gap-1.5" asChild>
                    <a href={previewFile.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-3.5 h-3.5" /> فتح في تبويب جديد
                    </a>
                  </Button>
                  <Button
                    size="sm" variant="destructive" className="w-full gap-1.5"
                    onClick={() => { if (confirm("حذف هذا الملف نهائياً؟")) deleteFile.mutate(previewFile.id); }}
                    data-testid="btn-preview-delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> حذف الملف
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Drag overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-50 bg-primary/10 border-4 border-dashed border-primary flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <Upload className="w-16 h-16 text-primary mx-auto mb-4 animate-bounce" />
            <p className="text-2xl font-bold text-primary">أفلت الملفات هنا</p>
          </div>
        </div>
      )}
    </div>
  );
}
