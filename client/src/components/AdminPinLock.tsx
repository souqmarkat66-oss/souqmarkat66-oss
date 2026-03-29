import { useState, useEffect } from "react";
import { ShieldCheck, Lock, Eye, EyeOff, RotateCcw, KeyRound, CheckCircle, AlertCircle, Loader2, Settings2, Copy, CopyCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

type Screen = "loading" | "generated" | "lock" | "recover" | "reset" | "change";

interface AdminPinLockProps {
  onUnlocked: () => void;
}

function Key({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="relative flex flex-col items-center justify-center w-20 h-16 rounded-2xl bg-white/5 hover:bg-white/15 active:bg-white/20 active:scale-95 border border-white/10 transition-all duration-150 select-none group"
    >
      <span className="text-white text-2xl font-light group-active:text-primary transition-colors">{label}</span>
    </button>
  );
}

function PinDots({ length, filled, shake }: { length: number; filled: number; shake: boolean }) {
  return (
    <div className={`flex gap-4 justify-center my-6 ${shake ? "animate-bounce" : ""}`}>
      {Array.from({ length }).map((_, i) => (
        <div
          key={i}
          className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
            i < filled ? "bg-primary border-primary scale-110" : "bg-transparent border-white/30"
          }`}
        />
      ))}
    </div>
  );
}

export default function AdminPinLock({ onUnlocked }: AdminPinLockProps) {
  const { toast } = useToast();
  const [screen, setScreen] = useState<Screen>("loading");
  const [generatedPin, setGeneratedPin] = useState("");
  const [copied, setCopied] = useState(false);

  const [pin, setPin] = useState("");
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPin, setShowPin] = useState(false);

  // recover
  const [recoveryInput, setRecoveryInput] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [resetPin, setResetPin] = useState("");

  // change
  const [newPin1, setNewPin1] = useState("");
  const [newPin2, setNewPin2] = useState("");
  const [changePinStep, setChangePinStep] = useState<"first" | "confirm">("first");

  const PIN_LENGTH = 6;

  // ── On mount: check if PIN is set, auto-generate if not ─────────
  useEffect(() => {
    fetch("/api/admin/pin/init", { credentials: "include" })
      .then(r => r.json())
      .then(d => {
        if (d.generated) {
          setGeneratedPin(d.pin);
          setScreen("generated");
        } else {
          setScreen("lock");
        }
      })
      .catch(() => setScreen("lock"));
  }, []);

  const appendDigit = (d: string) => {
    if (pin.length < PIN_LENGTH) setPin(p => p + d);
  };
  const deleteLast = () => setPin(p => p.slice(0, -1));

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 600);
  };

  // ── Auto-verify when PIN full ────────────────────────────────────
  useEffect(() => {
    if (pin.length === PIN_LENGTH && screen === "lock") {
      setLoading(true);
      fetch("/api/admin/pin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ pin }),
      })
        .then(r => r.json())
        .then(d => {
          setLoading(false);
          if (d.valid) {
            onUnlocked();
          } else {
            triggerShake();
            toast({ variant: "destructive", title: "❌ PIN غير صحيح" });
            setTimeout(() => setPin(""), 400);
          }
        })
        .catch(() => { setLoading(false); triggerShake(); setTimeout(() => setPin(""), 400); });
    }
  }, [pin, screen]);

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedPin).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // ── recover ──────────────────────────────────────────────────────
  const handleRecover = () => {
    setLoading(true);
    fetch("/api/admin/pin/recover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ input: recoveryInput }),
    })
      .then(r => r.json())
      .then(d => {
        setLoading(false);
        if (d.success) { setResetToken(d.resetToken); setScreen("reset"); }
        else toast({ variant: "destructive", title: d.message || "بيانات غير صحيحة" });
      })
      .catch(() => setLoading(false));
  };

  const handleReset = () => {
    if (resetPin.length < 4) return toast({ variant: "destructive", title: "PIN لازم 4 أرقام على الأقل" });
    setLoading(true);
    fetch("/api/admin/pin/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ newPin: resetPin, resetToken }),
    })
      .then(r => r.json())
      .then(d => {
        setLoading(false);
        if (d.success) { toast({ title: "✅ تم تغيير PIN" }); setScreen("lock"); setPin(""); }
        else toast({ variant: "destructive", title: d.message });
      })
      .catch(() => setLoading(false));
  };

  // ── change PIN ───────────────────────────────────────────────────
  const handleChangePinSave = () => {
    if (newPin1.length < 4) return toast({ variant: "destructive", title: "PIN لازم 4 أرقام على الأقل" });
    if (newPin1 !== newPin2) return toast({ variant: "destructive", title: "⚠️ الـ PIN غير متطابق" });
    setLoading(true);
    fetch("/api/admin/pin/set", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ pin: newPin1 }),
    })
      .then(r => r.json())
      .then(d => {
        setLoading(false);
        if (d.success) { toast({ title: "✅ تم تغيير PIN بنجاح" }); setScreen("lock"); setPin(""); }
        else toast({ variant: "destructive", title: d.message });
      })
      .catch(() => setLoading(false));
  };

  const bg = "min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col items-center justify-center p-6 relative overflow-hidden";

  // ═══════════════════════════════════════════════════════════════
  // LOADING
  // ═══════════════════════════════════════════════════════════════
  if (screen === "loading") return (
    <div className={bg}>
      <Loader2 className="w-10 h-10 text-primary animate-spin" />
    </div>
  );

  // ═══════════════════════════════════════════════════════════════
  // GENERATED PIN SCREEN (first time only)
  // ═══════════════════════════════════════════════════════════════
  if (screen === "generated") return (
    <div className={bg}>
      <div className="absolute top-1/4 -left-20 w-72 h-72 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-72 h-72 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm text-center">
        {/* Icon */}
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-2xl shadow-primary/30 mx-auto mb-6">
          <Sparkles className="w-10 h-10 text-white" />
        </div>

        <h1 className="text-white text-2xl font-extrabold mb-2">تم توليد PIN تلقائياً</h1>
        <p className="text-white/50 text-sm mb-8">احتفظ بهذا الـ PIN — ستحتاجه في كل مرة تدخل لوحة التحكم</p>

        {/* PIN Display */}
        <div className="bg-white/5 border border-white/10 rounded-3xl p-8 mb-6">
          <p className="text-white/40 text-xs mb-3 tracking-widest uppercase">رقم PIN الخاص بك</p>
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="text-5xl font-mono font-extrabold tracking-[0.3em] text-white">
              {showPin ? generatedPin : "••••••"}
            </span>
            <button
              onClick={() => setShowPin(s => !s)}
              className="text-white/30 hover:text-white/70 transition-colors ml-2"
            >
              {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          <button
            onClick={handleCopy}
            className="flex items-center gap-2 mx-auto text-sm text-primary hover:text-primary/80 transition-colors"
          >
            {copied ? <CopyCheck className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? "تم النسخ!" : "نسخ الـ PIN"}
          </button>
        </div>

        {/* Warning */}
        <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 mb-6 text-right">
          <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
          <p className="text-amber-300/80 text-sm">
            <strong className="text-amber-300">مهم:</strong> احفظ هذا الـ PIN الآن. لن يُعرَض مرة أخرى. يمكنك تغييره لاحقاً من داخل اللوحة.
          </p>
        </div>

        <Button
          className="w-full h-13 text-base font-bold bg-gradient-to-r from-primary to-purple-600 hover:opacity-90 rounded-2xl"
          onClick={() => setScreen("lock")}
          data-testid="btn-pin-understood"
        >
          <ShieldCheck className="w-5 h-5 me-2" />
          حفظت الـ PIN — متابعة لتسجيل الدخول
        </Button>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════
  // LOCK SCREEN
  // ═══════════════════════════════════════════════════════════════
  if (screen === "lock") return (
    <div className={bg}>
      <div className="absolute top-1/4 -left-20 w-72 h-72 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-72 h-72 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />

      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-2xl shadow-primary/30 mb-6">
        <ShieldCheck className="w-10 h-10 text-white" />
      </div>

      <h1 className="text-white text-2xl font-extrabold tracking-tight mb-1">لوحة التحكم</h1>
      <p className="text-white/40 text-sm mb-2">أدخل رقم PIN للمتابعة</p>

      <PinDots length={PIN_LENGTH} filled={pin.length} shake={shake} />

      {loading && <div className="mb-4"><Loader2 className="w-5 h-5 text-primary animate-spin" /></div>}

      <div className="grid grid-cols-3 gap-3 mt-2">
        {["1","2","3","4","5","6","7","8","9"].map(d => (
          <Key key={d} label={d} onClick={() => appendDigit(d)} />
        ))}
        <Key label="⌫" onClick={deleteLast} />
        <Key label="0" onClick={() => appendDigit("0")} />
        <Key label="✓" onClick={() => {}} />
      </div>

      <button onClick={() => setScreen("recover")} className="mt-8 text-white/40 hover:text-white/70 text-sm flex items-center gap-1.5 transition-colors">
        <RotateCcw className="w-3.5 h-3.5" /> نسيت PIN؟
      </button>
      <button onClick={() => { setChangePinStep("first"); setNewPin1(""); setNewPin2(""); setScreen("change"); }} className="mt-2 text-white/30 hover:text-white/60 text-xs flex items-center gap-1 transition-colors">
        <Settings2 className="w-3 h-3" /> تغيير PIN
      </button>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════
  // RECOVER SCREEN
  // ═══════════════════════════════════════════════════════════════
  if (screen === "recover") return (
    <div className={bg}>
      <div className="w-full max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-xl shadow-amber-500/30 mx-auto mb-6">
          <RotateCcw className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-white text-xl font-bold text-center mb-1">استرداد PIN</h2>
        <p className="text-white/40 text-xs text-center mb-8">أدخل الإيميل أو رقم التليفون اللي سجّلته</p>

        <div className="space-y-4">
          <Input
            type="text" placeholder="الإيميل أو رقم التليفون"
            value={recoveryInput} onChange={e => setRecoveryInput(e.target.value)}
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
            data-testid="input-recovery"
          />
          <div className="flex items-start gap-2 bg-amber-500/10 rounded-xl p-3 border border-amber-500/20">
            <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <p className="text-amber-300/80 text-xs">يجب أن يطابق الإيميل أو الرقم اللي سجّلته عند ضبط PIN</p>
          </div>
          <Button onClick={handleRecover} disabled={loading || !recoveryInput}
            className="w-full h-12 font-bold bg-gradient-to-r from-amber-500 to-orange-600 hover:opacity-90"
            data-testid="btn-recover">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "تأكيد الاسترداد"}
          </Button>
          <button onClick={() => setScreen("lock")} className="text-white/30 text-xs hover:text-white/60 w-full text-center">← رجوع للـ PIN</button>
        </div>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════
  // RESET SCREEN
  // ═══════════════════════════════════════════════════════════════
  if (screen === "reset") return (
    <div className={bg}>
      <div className="w-full max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center shadow-xl shadow-green-500/30 mx-auto mb-6">
          <CheckCircle className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-white text-xl font-bold text-center mb-1">تم التحقق ✓</h2>
        <p className="text-white/40 text-xs text-center mb-8">اختار PIN جديد</p>
        <div className="space-y-4">
          <div className="relative">
            <Input
              type={showPin ? "text" : "password"} inputMode="numeric" maxLength={8}
              placeholder="PIN الجديد (4-8 أرقام)"
              value={resetPin} onChange={e => setResetPin(e.target.value.replace(/\D/g, ""))}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 tracking-widest text-lg text-center pr-10"
              data-testid="input-reset-pin"
            />
            <button onClick={() => setShowPin(s => !s)} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
              {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <Button onClick={handleReset} disabled={loading || resetPin.length < 4}
            className="w-full h-12 font-bold bg-gradient-to-r from-green-500 to-teal-600 hover:opacity-90"
            data-testid="btn-reset-pin">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "✓ حفظ PIN الجديد"}
          </Button>
        </div>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════
  // CHANGE PIN SCREEN
  // ═══════════════════════════════════════════════════════════════
  return (
    <div className={bg}>
      <div className="w-full max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-xl shadow-primary/30 mx-auto mb-6">
          <KeyRound className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-white text-xl font-bold text-center mb-1">تغيير PIN</h2>
        <p className="text-white/40 text-xs text-center mb-8">
          {changePinStep === "first" ? "أدخل PIN الجديد (4-8 أرقام)" : "أكّد PIN الجديد"}
        </p>
        <div className="space-y-4">
          <div className="relative">
            <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <Input
              type={showPin ? "text" : "password"} inputMode="numeric" maxLength={8}
              placeholder={changePinStep === "first" ? "PIN الجديد" : "تأكيد PIN"}
              value={changePinStep === "first" ? newPin1 : newPin2}
              onChange={e => {
                const v = e.target.value.replace(/\D/g, "");
                changePinStep === "first" ? setNewPin1(v) : setNewPin2(v);
              }}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 pr-10 pl-10 tracking-widest text-lg text-center"
              data-testid="input-change-pin"
            />
            <button onClick={() => setShowPin(s => !s)} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
              {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {changePinStep === "first" ? (
            <Button onClick={() => { if (newPin1.length >= 4) setChangePinStep("confirm"); else toast({ variant: "destructive", title: "PIN لازم 4 أرقام على الأقل" }); }}
              className="w-full h-12 font-bold bg-gradient-to-r from-primary to-purple-600 hover:opacity-90">
              التالي ›
            </Button>
          ) : (
            <>
              <Button onClick={handleChangePinSave} disabled={loading || newPin2.length < 4}
                className="w-full h-12 font-bold bg-gradient-to-r from-primary to-purple-600 hover:opacity-90"
                data-testid="btn-change-pin-save">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "✓ تأكيد وحفظ"}
              </Button>
              <button onClick={() => { setChangePinStep("first"); setNewPin2(""); }} className="text-white/30 text-xs hover:text-white/60 w-full text-center">← رجوع</button>
            </>
          )}
          <button onClick={() => setScreen("lock")} className="text-white/30 text-xs hover:text-white/60 w-full text-center">إلغاء</button>
        </div>
      </div>
    </div>
  );
}
