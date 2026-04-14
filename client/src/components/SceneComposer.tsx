import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, X, Download, ZoomIn, ZoomOut, Move, RotateCcw, RefreshCw, Wand2 } from "lucide-react";
import { removeBackground } from "@imgly/background-removal";

const PRESET_BACKGROUNDS = [
  { id: "news-ar", label: "ستوديو أخبار عربي", color: "#1a237e", gradient: "linear-gradient(135deg,#0d1b6e 0%,#1565c0 50%,#0d47a1 100%)", pattern: "news" },
  { id: "office-gold", label: "مكتب ذهبي فاخر", color: "#bf8700", gradient: "linear-gradient(135deg,#3e2723 0%,#6d4c41 40%,#bf8700 100%)", pattern: "office" },
  { id: "market-egypt", label: "سوق مصري شعبي", color: "#e65100", gradient: "linear-gradient(135deg,#bf360c 0%,#e64a19 50%,#ff6d00 100%)", pattern: "market" },
  { id: "tech-dark", label: "خلفية تقنية داكنة", color: "#00838f", gradient: "linear-gradient(135deg,#006064 0%,#0097a7 50%,#26c6da 100%)", pattern: "tech" },
  { id: "luxury-white", label: "فاخر أبيض", color: "#e0e0e0", gradient: "linear-gradient(135deg,#fafafa 0%,#eeeeee 50%,#bdbdbd 100%)", pattern: "luxury" },
  { id: "green", label: "شاشة خضراء", color: "#00c853", gradient: "linear-gradient(135deg,#00c853 0%,#69f0ae 100%)", pattern: "green" },
  { id: "store", label: "واجهة متجر", color: "#6a1b9a", gradient: "linear-gradient(135deg,#4a148c 0%,#7b1fa2 50%,#ab47bc 100%)", pattern: "store" },
  { id: "outdoor", label: "خارجي طبيعي", color: "#2e7d32", gradient: "linear-gradient(135deg,#1b5e20 0%,#388e3c 50%,#81c784 100%)", pattern: "outdoor" },
];

interface SceneComposerProps {
  onExport?: (dataUrl: string) => void;
  onClose?: () => void;
}

export default function SceneComposer({ onExport, onClose }: SceneComposerProps) {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgFileInputRef = useRef<HTMLInputElement>(null);

  const [personImg, setPersonImg] = useState<HTMLImageElement | null>(null);
  const [bgImg, setBgImg] = useState<HTMLImageElement | null>(null);
  const [selectedBg, setSelectedBg] = useState<typeof PRESET_BACKGROUNDS[0] | null>(null);
  const [customBgUrl, setCustomBgUrl] = useState<string>("");
  const [removingBg, setRemovingBg] = useState(false);
  const [personReady, setPersonReady] = useState(false);

  const [scale, setScale] = useState(0.65);
  const [posX, setPosX] = useState(0.5);
  const [posY, setPosY] = useState(0.85);
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, px: 0, py: 0 });
  const [generatingAiBg, setGeneratingAiBg] = useState(false);
  const [bgText, setBgText] = useState("");

  const CANVAS_W = 1280;
  const CANVAS_H = 720;

  const drawScene = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    if (bgImg) {
      ctx.drawImage(bgImg, 0, 0, CANVAS_W, CANVAS_H);
    } else if (selectedBg) {
      const grad = ctx.createLinearGradient(0, 0, CANVAS_W, CANVAS_H);
      const stops = selectedBg.gradient.match(/#[0-9a-f]{3,8}/gi) || ["#1a237e", "#0d47a1"];
      grad.addColorStop(0, stops[0]);
      grad.addColorStop(0.5, stops[1] || stops[0]);
      grad.addColorStop(1, stops[2] || stops[1] || stops[0]);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      drawBgPattern(ctx, selectedBg.pattern);
    } else {
      const grad = ctx.createLinearGradient(0, 0, CANVAS_W, CANVAS_H);
      grad.addColorStop(0, "#1a1a2e");
      grad.addColorStop(1, "#16213e");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }

    if (personImg && personReady) {
      const pw = personImg.naturalWidth;
      const ph = personImg.naturalHeight;
      const drawH = CANVAS_H * scale;
      const drawW = (pw / ph) * drawH;
      const x = posX * CANVAS_W - drawW / 2;
      const y = posY * CANVAS_H - drawH;
      ctx.drawImage(personImg, x, y, drawW, drawH);
    }
  }, [bgImg, selectedBg, personImg, personReady, scale, posX, posY]);

  useEffect(() => { drawScene(); }, [drawScene]);

  function drawBgPattern(ctx: CanvasRenderingContext2D, pattern: string) {
    ctx.save();
    ctx.globalAlpha = 0.15;
    switch (pattern) {
      case "news":
        ctx.fillStyle = "#ffffff";
        for (let i = 0; i < 8; i++) {
          ctx.fillRect(0, CANVAS_H - 60 - i * 80, CANVAS_W, 2);
        }
        ctx.font = "bold 48px sans-serif";
        ctx.fillStyle = "#ffd700";
        ctx.fillText("● LIVE", 40, 60);
        break;
      case "tech":
        ctx.strokeStyle = "#00ffff";
        ctx.lineWidth = 1;
        for (let x = 0; x < CANVAS_W; x += 80) {
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_H); ctx.stroke();
        }
        for (let y = 0; y < CANVAS_H; y += 80) {
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_W, y); ctx.stroke();
        }
        break;
      case "luxury":
        ctx.fillStyle = "#c9a227";
        for (let i = 0; i < 20; i++) {
          ctx.fillRect(i * 64, 0, 32, CANVAS_H);
        }
        break;
      case "office":
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, CANVAS_H - 4, CANVAS_W, 4);
        ctx.fillRect(0, CANVAS_H - 40, CANVAS_W, 2);
        break;
    }
    ctx.restore();
  }

  async function handlePersonUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setRemovingBg(true);
    setPersonReady(false);
    try {
      const blob = await removeBackground(file, {
        output: { format: "image/png", quality: 0.95 },
        progress: (key: string, current: number, total: number) => {
          if (key === "compute:inference") {
          }
        }
      } as any);
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => { setPersonImg(img); setPersonReady(true); };
      img.src = url;
      toast({ title: "✅ تم حذف الخلفية بنجاح!", className: "bg-green-600 text-white border-none" });
    } catch {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { setPersonImg(img); setPersonReady(true); };
      img.src = url;
      toast({ title: "📷 تم تحميل الصورة (بدون حذف خلفية)", description: "تأكد إن الصورة PNG بخلفية شفافة" });
    } finally {
      setRemovingBg(false);
    }
  }

  function handleBgUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { setBgImg(img); setSelectedBg(null); setCustomBgUrl(url); };
    img.src = url;
  }

  async function handleGenerateAiBg() {
    if (!bgText.trim()) { toast({ variant: "destructive", title: "اكتب وصف الخلفية المطلوبة" }); return; }
    setGeneratingAiBg(true);
    try {
      const r = await fetch("/api/ai/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: `Professional advertising background scene: ${bgText}. Wide 16:9 format, no people, photorealistic, high quality, Arabic market aesthetic`, quality: "hd", size: "1792x1024" }),
        credentials: "include"
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message);
      const imgUrl = data.url || data.imageUrl;
      if (!imgUrl) throw new Error("لم يُرسل رابط الصورة");
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => { setBgImg(img); setSelectedBg(null); setCustomBgUrl(imgUrl); };
      img.onerror = () => {
        fetch(imgUrl).then(r => r.blob()).then(blob => {
          const url = URL.createObjectURL(blob);
          const img2 = new Image();
          img2.onload = () => { setBgImg(img2); setSelectedBg(null); };
          img2.src = url;
        });
      };
      img.src = imgUrl;
      toast({ title: "🎨 تم توليد الخلفية!" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "فشل توليد الخلفية", description: e.message });
    } finally { setGeneratingAiBg(false); }
  }

  function handleExport() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    if (onExport) { onExport(dataUrl); toast({ title: "✅ تم استخدام المشهد في الإعلان!" }); }
    else {
      const a = document.createElement("a");
      a.href = dataUrl; a.download = `scene-${Date.now()}.png`; a.click();
    }
  }

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!personReady) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top) * scaleY;

    if (personImg) {
      const ph = CANVAS_H * scale;
      const pw = (personImg.naturalWidth / personImg.naturalHeight) * ph;
      const px = posX * CANVAS_W;
      const py = posY * CANVAS_H;
      if (Math.abs(cx - px) < pw / 2 + 30 && cy > py - ph - 30 && cy < py + 30) {
        setDragging(true);
        setDragStart({ x: e.clientX, y: e.clientY, px: posX, py: posY });
      }
    }
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!dragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const dx = (e.clientX - dragStart.x) / rect.width;
    const dy = (e.clientY - dragStart.y) / rect.height;
    setPosX(Math.max(0.05, Math.min(0.95, dragStart.px + dx)));
    setPosY(Math.max(0.2, Math.min(1.0, dragStart.py + dy)));
  }

  function handleMouseUp() { setDragging(false); }

  function resetPerson() { setPersonImg(null); setPersonReady(false); }

  return (
    <div className="border-2 border-amber-400 rounded-xl p-4 bg-amber-50 dark:bg-amber-950/20 space-y-4" dir="rtl">
      <div className="flex items-center gap-2">
        <span className="text-lg">🎭</span>
        <p className="text-sm font-bold text-amber-800 dark:text-amber-300">مركّب المشاهد — صمّم مشهدك الإعلاني الاحترافي</p>
        {onClose && (
          <Button type="button" size="sm" variant="ghost" className="mr-auto h-6 w-6 p-0" onClick={onClose}>
            <X className="w-3 h-3" />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Controls */}
        <div className="space-y-3">
          {/* Person Upload */}
          <div>
            <p className="text-xs font-bold text-amber-800 dark:text-amber-300 mb-1.5">① رفع صورة الشخص (تُحذف الخلفية تلقائياً):</p>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePersonUpload} data-testid="input-scene-person" />
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={removingBg}
                onClick={() => fileInputRef.current?.click()}
                className="gap-2 border-amber-400 text-amber-700 hover:bg-amber-100 flex-1"
                data-testid="btn-scene-upload-person"
              >
                {removingBg ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> جاري حذف الخلفية...</> : <><Upload className="w-3.5 h-3.5" /> رفع صورة الشخص</>}
              </Button>
              {personImg && (
                <Button type="button" size="sm" variant="ghost" onClick={resetPerson} className="px-2" data-testid="btn-scene-reset-person">
                  <X className="w-3.5 h-3.5 text-red-500" />
                </Button>
              )}
            </div>
            {personImg && personReady && (
              <p className="text-[11px] text-green-600 mt-1">✅ الشخص جاهز — اسحبه على الكانفس لتغيير موضعه</p>
            )}
          </div>

          {/* Background Selection */}
          <div>
            <p className="text-xs font-bold text-amber-800 dark:text-amber-300 mb-1.5">② اختر الخلفية:</p>
            <div className="grid grid-cols-4 gap-1.5">
              {PRESET_BACKGROUNDS.map(bg => (
                <button
                  key={bg.id}
                  type="button"
                  onClick={() => { setSelectedBg(bg); setBgImg(null); setCustomBgUrl(""); }}
                  className={`rounded-lg overflow-hidden border-2 transition-all ${selectedBg?.id === bg.id && !bgImg ? "border-amber-500 ring-2 ring-amber-400 scale-105" : "border-transparent hover:border-amber-400"}`}
                  title={bg.label}
                  data-testid={`btn-scene-bg-${bg.id}`}
                >
                  <div className="h-9 w-full" style={{ background: bg.gradient }} />
                  <p className="text-[9px] text-center py-0.5 bg-white dark:bg-gray-800 leading-tight px-0.5 truncate">{bg.label}</p>
                </button>
              ))}
            </div>

            <div className="flex gap-2 mt-2">
              <input ref={bgFileInputRef} type="file" accept="image/*" className="hidden" onChange={handleBgUpload} />
              <Button type="button" size="sm" variant="outline" onClick={() => bgFileInputRef.current?.click()} className="gap-1.5 text-xs border-amber-400 text-amber-700 flex-1" data-testid="btn-scene-upload-bg">
                <Upload className="w-3 h-3" /> خلفية من جهازك
              </Button>
            </div>

            {/* AI Background Generation */}
            <div className="mt-2 space-y-1.5">
              <input
                type="text"
                value={bgText}
                onChange={e => setBgText(e.target.value)}
                placeholder="مثال: ستوديو تلفزيوني فاخر، سوق مصري ملوّن..."
                className="w-full text-xs border border-amber-300 rounded-lg px-2 py-1.5 focus:outline-none focus:border-amber-500 bg-white dark:bg-gray-800"
                data-testid="input-scene-bg-prompt"
              />
              <Button
                type="button"
                size="sm"
                disabled={generatingAiBg || !bgText.trim()}
                onClick={handleGenerateAiBg}
                className="w-full gap-1.5 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                data-testid="btn-scene-gen-ai-bg"
              >
                {generatingAiBg ? <><Loader2 className="w-3 h-3 animate-spin" /> جاري التوليد...</> : <><Wand2 className="w-3 h-3" /> توليد خلفية AI</>}
              </Button>
            </div>
          </div>

          {/* Position & Scale Controls */}
          {personImg && personReady && (
            <div className="space-y-2 bg-white dark:bg-gray-800 rounded-lg p-3 border border-amber-200">
              <p className="text-xs font-bold text-amber-800 dark:text-amber-300">③ ضبط الحجم والموضع:</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <ZoomOut className="w-3.5 h-3.5 text-amber-600" />
                  <Slider value={[scale]} onValueChange={([v]) => setScale(v)} min={0.1} max={1.2} step={0.01} className="flex-1" data-testid="slider-scene-scale" />
                  <ZoomIn className="w-3.5 h-3.5 text-amber-600" />
                  <span className="text-[11px] w-10 text-right text-amber-700">{Math.round(scale * 100)}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-amber-600 w-12">أفقي</span>
                  <Slider value={[posX]} onValueChange={([v]) => setPosX(v)} min={0.05} max={0.95} step={0.01} className="flex-1" data-testid="slider-scene-posx" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-amber-600 w-12">رأسي</span>
                  <Slider value={[posY]} onValueChange={([v]) => setPosY(v)} min={0.2} max={1.0} step={0.01} className="flex-1" data-testid="slider-scene-posy" />
                </div>
                <Button type="button" size="sm" variant="outline" onClick={() => { setScale(0.65); setPosX(0.5); setPosY(0.85); }} className="w-full gap-1.5 text-xs border-amber-300 text-amber-600" data-testid="btn-scene-reset-pos">
                  <RotateCcw className="w-3 h-3" /> إعادة تعيين الموضع
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Move className="w-3 h-3" /> أو اسحب الشخص مباشرة على الكانفس</p>
            </div>
          )}
        </div>

        {/* Right: Canvas Preview */}
        <div className="space-y-2">
          <p className="text-xs font-bold text-amber-800 dark:text-amber-300">معاينة المشهد (16:9):</p>
          <div
            ref={containerRef}
            className="relative w-full bg-gray-900 rounded-xl overflow-hidden border-2 border-amber-300 shadow-lg"
            style={{ aspectRatio: "16/9" }}
          >
            <canvas
              ref={canvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              className="w-full h-full cursor-move"
              style={{ cursor: dragging ? "grabbing" : personReady ? "grab" : "default" }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              data-testid="canvas-scene-preview"
            />
            {!selectedBg && !bgImg && !personImg && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white/50 pointer-events-none">
                <span className="text-4xl mb-2">🎭</span>
                <p className="text-sm">ارفع صورة الشخص واختر خلفية</p>
              </div>
            )}
            {removingBg && (
              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white">
                <Loader2 className="w-8 h-8 animate-spin mb-2" />
                <p className="text-sm font-bold">جاري حذف الخلفية بالذكاء الاصطناعي...</p>
                <p className="text-xs opacity-75">قد يستغرق 10-30 ثانية</p>
              </div>
            )}
          </div>

          {/* Export Buttons */}
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handleExport}
              disabled={!personReady && !selectedBg && !bgImg}
              className="flex-1 gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold"
              data-testid="btn-scene-export"
            >
              ✅ استخدم في الإعلان
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                const canvas = canvasRef.current;
                if (!canvas) return;
                const a = document.createElement("a");
                a.href = canvas.toDataURL("image/png");
                a.download = `scene-${Date.now()}.png`;
                a.click();
              }}
              className="gap-1.5 border-amber-400 text-amber-700"
              data-testid="btn-scene-download"
            >
              <Download className="w-3.5 h-3.5" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                if (onExport && personReady) {
                  const canvas = canvasRef.current;
                  if (!canvas) return;
                  const url = canvas.toDataURL("image/png");
                  toast({ title: "📤 يمكنك استخدام هذه الصورة في مذيع AI أو صورة ناطقة" });
                  onExport(url);
                }
              }}
              className="gap-1.5 border-purple-400 text-purple-600"
              title="استخدم في مذيع AI"
              data-testid="btn-scene-use-presenter"
            >
              🎬
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground text-center">الصورة بدقة 1280×720 — مناسبة للـ D-ID ومذيع AI</p>
        </div>
      </div>
    </div>
  );
}
