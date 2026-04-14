import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, X, Download, ZoomIn, ZoomOut, RotateCcw, Wand2, Eraser, RefreshCw } from "lucide-react";

const PRESET_BACKGROUNDS = [
  { id: "news-ar", label: "ستوديو أخبار", gradient: "linear-gradient(135deg,#0d1b6e 0%,#1565c0 50%,#0d47a1 100%)", pattern: "news" },
  { id: "office-gold", label: "مكتب ذهبي", gradient: "linear-gradient(135deg,#3e2723 0%,#6d4c41 40%,#bf8700 100%)", pattern: "office" },
  { id: "market-egypt", label: "سوق مصري", gradient: "linear-gradient(135deg,#bf360c 0%,#e64a19 50%,#ff6d00 100%)", pattern: "market" },
  { id: "tech-dark", label: "تقنية داكنة", gradient: "linear-gradient(135deg,#006064 0%,#0097a7 50%,#26c6da 100%)", pattern: "tech" },
  { id: "luxury-white", label: "فاخر أبيض", gradient: "linear-gradient(135deg,#fafafa 0%,#eeeeee 50%,#bdbdbd 100%)", pattern: "luxury" },
  { id: "green-screen", label: "شاشة خضراء", gradient: "linear-gradient(135deg,#00c853 0%,#69f0ae 100%)", pattern: "green" },
  { id: "purple-store", label: "متجر بنفسجي", gradient: "linear-gradient(135deg,#4a148c 0%,#7b1fa2 50%,#ab47bc 100%)", pattern: "store" },
  { id: "outdoor", label: "خارجي طبيعي", gradient: "linear-gradient(135deg,#1b5e20 0%,#388e3c 50%,#81c784 100%)", pattern: "outdoor" },
];

interface SceneComposerProps {
  onExport?: (dataUrl: string) => void;
  onClose?: () => void;
}

export default function SceneComposer({ onExport, onClose }: SceneComposerProps) {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgFileInputRef = useRef<HTMLInputElement>(null);

  const [personBlobUrl, setPersonBlobUrl] = useState<string>("");
  const [personImg, setPersonImg] = useState<HTMLImageElement | null>(null);
  const [bgImg, setBgImg] = useState<HTMLImageElement | null>(null);
  const [bgBlobUrl, setBgBlobUrl] = useState<string>("");
  const [selectedBg, setSelectedBg] = useState<typeof PRESET_BACKGROUNDS[0] | null>(PRESET_BACKGROUNDS[0]);

  const [removingBg, setRemovingBg] = useState(false);
  const [removeBgStatus, setRemoveBgStatus] = useState("");
  const [personReady, setPersonReady] = useState(false);
  const [generatingAiBg, setGeneratingAiBg] = useState(false);
  const [bgPrompt, setBgPrompt] = useState("");

  const [scale, setScale] = useState(0.65);
  const [posX, setPosX] = useState(0.5);
  const [posY, setPosY] = useState(0.88);
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, px: 0.5, py: 0.88 });
  const [tolerance, setTolerance] = useState(45);
  const [origPersonFile, setOrigPersonFile] = useState<File | null>(null);

  const CANVAS_W = 1280;
  const CANVAS_H = 720;

  function drawBgPattern(ctx: CanvasRenderingContext2D, pattern: string) {
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    switch (pattern) {
      case "news":
        for (let y = CANVAS_H - 40; y > 0; y -= 90) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_W, y); ctx.stroke(); }
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = "#ffd700";
        ctx.font = "bold 42px sans-serif";
        ctx.fillText("● LIVE", 36, 52);
        break;
      case "tech":
        for (let x = 0; x < CANVAS_W; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_H); ctx.stroke(); }
        for (let y = 0; y < CANVAS_H; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_W, y); ctx.stroke(); }
        break;
      case "luxury":
        for (let i = 0; i < 20; i++) { ctx.fillStyle = "#c9a227"; ctx.globalAlpha = 0.1; ctx.fillRect(i * 64, 0, 32, CANVAS_H); }
        break;
      case "office":
        ctx.fillStyle = "#ffffff"; ctx.globalAlpha = 0.12;
        ctx.fillRect(0, CANVAS_H - 4, CANVAS_W, 4);
        ctx.fillRect(0, CANVAS_H - 50, CANVAS_W, 2);
        break;
    }
    ctx.restore();
  }

  const drawScene = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    if (bgImg) {
      ctx.drawImage(bgImg, 0, 0, CANVAS_W, CANVAS_H);
    } else if (selectedBg) {
      const colors = selectedBg.gradient.match(/#[0-9a-fA-F]{3,8}/g) || ["#1a237e", "#0d47a1"];
      const grad = ctx.createLinearGradient(0, 0, CANVAS_W, CANVAS_H);
      grad.addColorStop(0, colors[0]);
      grad.addColorStop(0.5, colors[1] || colors[0]);
      grad.addColorStop(1, colors[2] || colors[1] || colors[0]);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      drawBgPattern(ctx, selectedBg.pattern);
    } else {
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }

    if (personImg && personReady) {
      const ph = CANVAS_H * scale;
      const pw = (personImg.naturalWidth / personImg.naturalHeight) * ph;
      const x = posX * CANVAS_W - pw / 2;
      const y = posY * CANVAS_H - ph;
      ctx.drawImage(personImg, x, y, pw, ph);
    }
  }, [bgImg, selectedBg, personImg, personReady, scale, posX, posY]);

  useEffect(() => { drawScene(); }, [drawScene]);

  async function removeBackgroundServer(file: File, tol = 45): Promise<string> {
    setRemoveBgStatus("جاري تحليل الصورة...");
    const formData = new FormData();
    formData.append("image", file);
    const res = await fetch(`/api/ai/remove-bg?tolerance=${tol}`, {
      method: "POST",
      body: formData,
      credentials: "include"
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || "فشل حذف الخلفية");
    }
    const data = await res.json();
    setRemoveBgStatus("جاري تحميل الصورة...");
    const imgRes = await fetch(data.url);
    const blob = await imgRes.blob();
    return URL.createObjectURL(blob);
  }

  async function handlePersonUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setOrigPersonFile(file);
    setRemovingBg(true);
    setPersonReady(false);
    setRemoveBgStatus("جاري حذف الخلفية...");
    try {
      const blobUrl = await removeBackgroundServer(file, tolerance);
      loadPersonFromBlobUrl(blobUrl);
    } catch (err: any) {
      toast({ variant: "destructive", title: "فشل حذف الخلفية", description: err.message });
      const originalUrl = URL.createObjectURL(file);
      loadPersonFromBlobUrl(originalUrl);
    } finally {
      setRemovingBg(false);
      setRemoveBgStatus("");
    }
  }

  function loadPersonFromBlobUrl(blobUrl: string) {
    if (personBlobUrl) URL.revokeObjectURL(personBlobUrl);
    setPersonBlobUrl(blobUrl);
    const img = new Image();
    img.onload = () => { setPersonImg(img); setPersonReady(true); };
    img.onerror = () => toast({ variant: "destructive", title: "تعذّر تحميل الصورة" });
    img.src = blobUrl;
  }

  async function handleRetryWithTolerance() {
    if (!origPersonFile) return;
    setRemovingBg(true);
    setPersonReady(false);
    setRemoveBgStatus("جاري إعادة المحاولة...");
    try {
      const blobUrl = await removeBackgroundServer(origPersonFile, tolerance);
      loadPersonFromBlobUrl(blobUrl);
    } catch (err: any) {
      toast({ variant: "destructive", title: "فشل", description: err.message });
    } finally { setRemovingBg(false); setRemoveBgStatus(""); }
  }

  function handleBgUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (bgBlobUrl) URL.revokeObjectURL(bgBlobUrl);
    const url = URL.createObjectURL(file);
    setBgBlobUrl(url);
    const img = new Image();
    img.onload = () => { setBgImg(img); setSelectedBg(null); };
    img.onerror = () => toast({ variant: "destructive", title: "تعذّر تحميل الخلفية" });
    img.src = url;
  }

  async function handleGenerateAiBg() {
    if (!bgPrompt.trim()) { toast({ variant: "destructive", title: "اكتب وصف الخلفية" }); return; }
    setGeneratingAiBg(true);
    try {
      const r = await fetch("/api/ai/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: `Professional advertising background (NO PEOPLE, wide shot, 16:9): ${bgPrompt}. Photorealistic, high quality, cinematic lighting, Arabic market style`, size: "1792x1024" }),
        credentials: "include"
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message);
      const imgUrl = data.url || data.imageUrl;
      if (!imgUrl) throw new Error("لم يُرجع الرابط");
      if (bgBlobUrl) URL.revokeObjectURL(bgBlobUrl);
      const imgRes = await fetch(imgUrl);
      const blob = await imgRes.blob();
      const blobUrl = URL.createObjectURL(blob);
      setBgBlobUrl(blobUrl);
      const img = new Image();
      img.onload = () => { setBgImg(img); setSelectedBg(null); };
      img.src = blobUrl;
      toast({ title: "🎨 تم توليد الخلفية!", className: "bg-amber-600 text-white border-none" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "فشل توليد الخلفية", description: e.message });
    } finally { setGeneratingAiBg(false); }
  }

  function handleExportCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const dataUrl = canvas.toDataURL("image/png");
      if (onExport) onExport(dataUrl);
      else {
        const a = document.createElement("a");
        a.href = dataUrl; a.download = `scene-${Date.now()}.png`; a.click();
      }
    } catch (err: any) {
      if (err?.name === "SecurityError") {
        toast({ variant: "destructive", title: "خطأ CORS", description: "تأكد إن جميع الصور من نفس الموقع" });
      } else {
        toast({ variant: "destructive", title: "فشل التصدير", description: err?.message });
      }
    }
  }

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!personReady || !personImg) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = CANVAS_W / rect.width;
    const sy = CANVAS_H / rect.height;
    const cx = (e.clientX - rect.left) * sx;
    const cy = (e.clientY - rect.top) * sy;
    const ph = CANVAS_H * scale;
    const pw = (personImg.naturalWidth / personImg.naturalHeight) * ph;
    const px = posX * CANVAS_W;
    const py = posY * CANVAS_H;
    if (Math.abs(cx - px) < pw / 2 + 40 && cy > py - ph - 40 && cy < py + 40) {
      setDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY, px: posX, py: posY });
    }
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!dragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const dx = (e.clientX - dragStart.x) / rect.width;
    const dy = (e.clientY - dragStart.y) / rect.height;
    setPosX(Math.max(0.05, Math.min(0.95, dragStart.px + dx)));
    setPosY(Math.max(0.15, Math.min(1.0, dragStart.py + dy)));
  }

  function handleMouseUp() { setDragging(false); }

  return (
    <div className="border-2 border-amber-400 rounded-xl p-4 bg-amber-50 dark:bg-amber-950/20 space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-lg">🎭</span>
        <p className="text-sm font-bold text-amber-800 dark:text-amber-300">مركّب المشاهد — ضع شخصك على خلفية احترافية</p>
        {onClose && (
          <Button type="button" size="sm" variant="ghost" className="mr-auto h-6 w-6 p-0" onClick={onClose}>
            <X className="w-3 h-3" />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── Controls ── */}
        <div className="space-y-3">

          {/* Person Upload */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-3 border border-amber-200 space-y-2">
            <p className="text-xs font-bold text-amber-800 dark:text-amber-300">① صورة الشخص (تُحذف الخلفية تلقائياً):</p>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePersonUpload} data-testid="input-scene-person" />
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" disabled={removingBg}
                onClick={() => fileInputRef.current?.click()}
                className="gap-2 border-amber-400 text-amber-700 hover:bg-amber-100 flex-1"
                data-testid="btn-scene-upload-person">
                {removingBg
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {removeBgStatus || "جاري المعالجة..."}</>
                  : <><Upload className="w-3.5 h-3.5" /> {personReady ? "تغيير الصورة" : "رفع صورة الشخص"}</>}
              </Button>
              {personReady && (
                <Button type="button" size="sm" variant="ghost" onClick={() => { setPersonImg(null); setPersonReady(false); setPersonBlobUrl(""); setOrigPersonFile(null); }} className="px-2" data-testid="btn-scene-reset-person">
                  <X className="w-3.5 h-3.5 text-red-500" />
                </Button>
              )}
            </div>
            {personReady && <p className="text-[11px] text-green-600 flex gap-1">✅ الشخص جاهز — اسحبه على الكانفس لتغيير موضعه</p>}
            {origPersonFile && (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-amber-700 w-20">دقة الحذف:</span>
                  <Slider value={[tolerance]} onValueChange={([v]) => setTolerance(v)} min={10} max={90} step={5} className="flex-1" data-testid="slider-scene-tolerance" />
                  <span className="text-[11px] w-8 text-amber-700">{tolerance}</span>
                </div>
                <Button type="button" size="sm" variant="outline" disabled={removingBg} onClick={handleRetryWithTolerance}
                  className="w-full gap-1.5 text-[11px] border-amber-300 text-amber-700" data-testid="btn-scene-retry-rembg">
                  <RefreshCw className="w-3 h-3" /> إعادة حذف الخلفية بهذه الدقة
                </Button>
                <p className="text-[10px] text-muted-foreground">زوّد الدقة إذا بقي من الخلفية، نقّصها إذا اختفى من الشخص</p>
              </div>
            )}
          </div>

          {/* Background Selection */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-3 border border-amber-200 space-y-2">
            <p className="text-xs font-bold text-amber-800 dark:text-amber-300">② الخلفية:</p>
            <div className="grid grid-cols-4 gap-1.5">
              {PRESET_BACKGROUNDS.map(bg => (
                <button key={bg.id} type="button"
                  onClick={() => { setSelectedBg(bg); setBgImg(null); setBgBlobUrl(""); }}
                  className={`rounded-lg overflow-hidden border-2 transition-all ${selectedBg?.id === bg.id && !bgImg ? "border-amber-500 ring-2 ring-amber-300 scale-105" : "border-transparent hover:border-amber-400"}`}
                  title={bg.label} data-testid={`btn-scene-bg-${bg.id}`}>
                  <div className="h-8 w-full" style={{ background: bg.gradient }} />
                  <p className="text-[9px] text-center py-0.5 bg-white dark:bg-gray-700 leading-tight px-0.5 truncate">{bg.label}</p>
                </button>
              ))}
            </div>

            <input ref={bgFileInputRef} type="file" accept="image/*" className="hidden" onChange={handleBgUpload} />
            <Button type="button" size="sm" variant="outline" onClick={() => bgFileInputRef.current?.click()}
              className="w-full gap-1.5 text-xs border-amber-300 text-amber-600" data-testid="btn-scene-upload-bg">
              <Upload className="w-3 h-3" /> رفع خلفية من جهازك
            </Button>

            <div className="flex gap-2">
              <input type="text" value={bgPrompt} onChange={e => setBgPrompt(e.target.value)}
                placeholder="مثال: ستوديو تلفزيوني فاخر بألوان ذهبية..."
                className="flex-1 text-xs border border-amber-300 rounded-lg px-2 py-1.5 focus:outline-none focus:border-amber-500 bg-white dark:bg-gray-800"
                data-testid="input-scene-bg-prompt" />
              <Button type="button" size="sm" disabled={generatingAiBg || !bgPrompt.trim()} onClick={handleGenerateAiBg}
                className="gap-1 bg-amber-600 hover:bg-amber-700 text-white text-xs px-3 shrink-0" data-testid="btn-scene-gen-ai-bg">
                {generatingAiBg ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                AI
              </Button>
            </div>
          </div>

          {/* Position & Scale Controls */}
          {personReady && (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-3 border border-amber-200 space-y-2">
              <p className="text-xs font-bold text-amber-800 dark:text-amber-300">③ ضبط الحجم والموضع:</p>
              <div className="flex items-center gap-2">
                <ZoomOut className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <Slider value={[scale]} onValueChange={([v]) => setScale(v)} min={0.1} max={1.2} step={0.01} className="flex-1" data-testid="slider-scene-scale" />
                <ZoomIn className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="text-[11px] w-10 text-right text-amber-700 shrink-0">{Math.round(scale * 100)}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-amber-600 w-10 shrink-0">أفقي</span>
                <Slider value={[posX]} onValueChange={([v]) => setPosX(v)} min={0.05} max={0.95} step={0.01} className="flex-1" data-testid="slider-scene-posx" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-amber-600 w-10 shrink-0">رأسي</span>
                <Slider value={[posY]} onValueChange={([v]) => setPosY(v)} min={0.15} max={1.0} step={0.01} className="flex-1" data-testid="slider-scene-posy" />
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => { setScale(0.65); setPosX(0.5); setPosY(0.88); }}
                className="w-full gap-1.5 text-xs border-amber-200 text-amber-600" data-testid="btn-scene-reset-pos">
                <RotateCcw className="w-3 h-3" /> إعادة تعيين الموضع
              </Button>
            </div>
          )}
        </div>

        {/* ── Canvas Preview ── */}
        <div className="space-y-2">
          <p className="text-xs font-bold text-amber-800 dark:text-amber-300">معاينة المشهد (16:9):</p>
          <div className="relative w-full bg-gray-900 rounded-xl overflow-hidden border-2 border-amber-300 shadow-lg" style={{ aspectRatio: "16/9" }}>
            <canvas
              ref={canvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              className="w-full h-full"
              style={{ cursor: dragging ? "grabbing" : personReady ? "grab" : "default" }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              data-testid="canvas-scene-preview"
            />
            {!personReady && !selectedBg && !bgImg && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white/50 pointer-events-none">
                <span className="text-4xl mb-2">🎭</span>
                <p className="text-sm">ارفع صورة الشخص واختر خلفية</p>
              </div>
            )}
            {removingBg && (
              <div className="absolute inset-0 bg-black/65 flex flex-col items-center justify-center text-white gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
                <p className="text-sm font-bold">{removeBgStatus || "جاري معالجة الصورة..."}</p>
                <p className="text-xs opacity-70">من 3 إلى 10 ثوانٍ</p>
              </div>
            )}
            {generatingAiBg && (
              <div className="absolute inset-0 bg-black/65 flex flex-col items-center justify-center text-white gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
                <p className="text-sm font-bold">جاري توليد الخلفية بالـ AI...</p>
                <p className="text-xs opacity-70">قد يستغرق 30-60 ثانية</p>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={handleExportCanvas}
              disabled={!personReady && !selectedBg && !bgImg}
              className="flex-1 gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold"
              data-testid="btn-scene-export">
              ✅ استخدم في الإعلان
            </Button>
            <Button type="button" size="sm" variant="outline"
              onClick={() => { const a = document.createElement("a"); const c = canvasRef.current; if (c) { a.href = c.toDataURL("image/png"); a.download = `scene-${Date.now()}.png`; a.click(); } }}
              className="gap-1.5 border-amber-400 text-amber-700 px-3"
              data-testid="btn-scene-download">
              <Download className="w-3.5 h-3.5" />
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground text-center">الصورة 1280×720 — مناسبة للـ D-ID ومذيع AI والإعلانات</p>
        </div>
      </div>
    </div>
  );
}
