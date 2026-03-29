import { useState, useRef, useEffect } from "react";
import { ShieldCheck, Lock, Eye, EyeOff, RotateCcw, KeyRound, CheckCircle, AlertCircle, Loader2, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

type Screen = "lock" | "setup" | "recover" | "reset";

interface AdminPinLockProps {
  onUnlocked: () => void;
}

// ── Keypad Button ─────────────────────────────────────────────────
function Key({ label, sub, onClick }: { label: string; sub?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="relative flex flex-col items-center justify-center w-20 h-16 rounded-2xl bg-white/5 hover:bg-white/15 active:bg-white/20 active:scale-95 border border-white/10 transition-all duration-150 select-none group"
    >
      <span className="text-white text-2xl font-light group-active:text-primary transition-colors">{label}</span>
      {sub && <span className="text-white/30 text-[9px] tracking-widest uppercase mt-0.5">{sub}</span>}
    </button>
  );
}

// ── PIN dots ──────────────────────────────────────────────────────
function PinDots({ length, filled, shake }: { length: number; filled: number; shake: boolean }) {
  return (
    <div className={`flex gap-4 justify-center my-6 transition-all ${shake ? "animate-shake" : ""}`}>
      {Array.from({ length }).map((_, i) => (
        <div
          key={i}
          className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
            i < filled
              ? "bg-primary border-primary scale-110"
              : "bg-transparent border-white/30"
          }`}
        />
      ))}
    </div>
  );
}

export default function AdminPinLock({ onUnlocked }: AdminPinLockProps) {
  const { toast } = useToast();
  const [screen, setScreen] = useState<Screen>("lock");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);
  const [noPinSet, setNoPinSet] = useState(false);

  // setup screen
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [step, setStep] = useState<"enter" | "confirm">("enter");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryPhone, setRecoveryPhone] = useState("");

  // recover screen
  const [recoveryInput, setRecoveryInput] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [resetPin, setResetPin] = useState("");

  const PIN_LENGTH = 6;

  // ── check on mount if PIN is set ──────────────────────────────
  useEffect(() => {
    fetch("/api/admin/pin/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ pin: "" }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.noPinSet) {
          setNoPinSet(true);
          setScreen("setup");
        }
      })
      .catch(() => {});
  }, []);

  // ── keypad input ───────────────────────────────────────────────
  const appendDigit = (d: string) => {
    if (pin.length < PIN_LENGTH) setPin(p => p + d);
  };
  const deleteLast = () => setPin(p => p.slice(0, -1));

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  // ── verify PIN ────────────────────────────────────────────────
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
            setTimeout(() => setPin(""), 400);
          }
        })
        .catch(() => { setLoading(false); triggerShake(); setTimeout(() => setPin(""), 400); });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, screen]);

  // ── setup PIN ─────────────────────────────────────────────────
  const handleSetupNext = () => {
    if (newPin.length < 4) return toast({ variant: "destructive", title: "PIN لازم 4 أرقام على الأقل" });
    if (step === "enter") { setStep("confirm"); return; }
    if (newPin !== confirmPin) {
      toast({ variant: "destructive", title: "⚠️ PIN غير متطابق" });
      setConfirmPin(""); return;
    }
    setLoading(true);
    fetch("/api/admin/pin/set", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ pin: newPin, recoveryEmail, recoveryPhone }),
    })
      .then(r => r.json())
      .then(d => {
        setLoading(false);
        if (d.success) { toast({ title: "✅ تم ضبط PIN بنجاح!" }); onUnlocked(); }
        else toast({ variant: "destructive", title: d.message });
      })
      .catch(() => setLoading(false));
  };

  // ── recovery ──────────────────────────────────────────────────
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
    if (resetPin.length < 4) return toast({ variant: "destructive", title: "PIN لازم 4 أرقام" });
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
        if (d.success) { toast({ title: "✅ تم تغيير PIN بنجاح!" }); setScreen("lock"); setPin(""); }
        else toast({ variant: "destructive", title: d.message });
      })
      .catch(() => setLoading(false));
  };

  // ════════════════════════════════════════════════════════════════
  // ══  LOCK SCREEN  ══════════════════════════════════════════════
  // ════════════════════════════════════════════════════════════════
  if (screen === "lock") return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* background blur circles */}
      <div className="absolute top-1/4 -left-20 w-72 h-72 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-72 h-72 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />

      {/* icon */}
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-2xl shadow-primary/30 mb-6">
        <ShieldCheck className="w-10 h-10 text-white" />
      </div>

      <h1 className="text-white text-2xl font-extrabold tracking-tight mb-1">لوحة التحكم</h1>
      <p className="text-white/40 text-sm mb-2">أدخل رقم PIN للمتابعة</p>

      {/* PIN dots */}
      <PinDots length={PIN_LENGTH} filled={pin.length} shake={shake} />

      {/* loading spinner */}
      {loading && (
        <div className="mb-4">
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
        </div>
      )}

      {/* keypad */}
      <div className="grid grid-cols-3 gap-3 mt-2">
        {["1","2","3","4","5","6","7","8","9"].map(d => (
          <Key key={d} label={d} onClick={() => appendDigit(d)} />
        ))}
        <Key label="⌫" onClick={deleteLast} />
        <Key label="0" onClick={() => appendDigit("0")} />
        <Key label="✓" onClick={() => {}} />
      </div>

      {/* forgot PIN */}
      <button
        onClick={() => setScreen("recover")}
        className="mt-8 text-white/40 hover:text-white/70 text-sm flex items-center gap-1.5 transition-colors"
      >
        <RotateCcw className="w-3.5 h-3.5" /> نسيت PIN؟
      </button>

      {/* change PIN */}
      <button
        onClick={() => setScreen("setup")}
        className="mt-2 text-white/30 hover:text-white/60 text-xs flex items-center gap-1 transition-colors"
      >
        <Settings2 className="w-3 h-3" /> تغيير PIN
      </button>
    </div>
  );

  // ════════════════════════════════════════════════════════════════
  // ══  SETUP SCREEN  ═════════════════════════════════════════════
  // ════════════════════════════════════════════════════════════════
  if (screen === "setup") return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-xl shadow-primary/30 mx-auto mb-6">
          <KeyRound className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-white text-xl font-bold text-center mb-1">
          {noPinSet ? "ضبط PIN لأول مرة" : "تغيير PIN"}
        </h2>
        <p className="text-white/40 text-xs text-center mb-8">
          {step === "enter" ? "اختار PIN من 4-8 أرقام" : "أكّد الـ PIN مرة تانية"}
        </p>

        <div className="space-y-4">
          <div className="relative">
            <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <Input
              type={showPin ? "text" : "password"}
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={8}
              placeholder={step === "enter" ? "PIN الجديد" : "تأكيد PIN"}
              value={step === "enter" ? newPin : confirmPin}
              onChange={e => {
                const v = e.target.value.replace(/\D/g, "");
                step === "enter" ? setNewPin(v) : setConfirmPin(v);
              }}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 pr-10 pl-10 tracking-widest text-lg text-center"
              data-testid="input-new-pin"
            />
            <button onClick={() => setShowPin(s => !s)} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
              {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {step === "confirm" && (
            <button onClick={() => { setStep("enter"); setConfirmPin(""); }} className="text-white/40 text-xs hover:text-white/60 w-full text-center">
              ← رجوع
            </button>
          )}

          {step === "enter" && (
            <>
              <div className="pt-2">
                <p className="text-white/40 text-xs mb-2 text-center">بيانات الاسترداد (لو نسيت PIN)</p>
                <Input
                  type="email"
                  placeholder="إيميل الاسترداد"
                  value={recoveryEmail}
                  onChange={e => setRecoveryEmail(e.target.value)}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 mb-2"
                  data-testid="input-recovery-email"
                />
                <Input
                  type="tel"
                  placeholder="رقم التليفون (مثال: 01xxxxxxxxx)"
                  value={recoveryPhone}
                  onChange={e => setRecoveryPhone(e.target.value)}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 font-mono"
                  data-testid="input-recovery-phone"
                />
              </div>
            </>
          )}

          <Button
            onClick={handleSetupNext}
            disabled={loading || (step === "enter" ? newPin.length < 4 : confirmPin.length < 4)}
            className="w-full h-12 text-base font-bold bg-gradient-to-r from-primary to-purple-600 hover:opacity-90"
            data-testid="btn-setup-pin"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : step === "enter" ? "التالي ›" : "✓ تأكيد وحفظ"}
          </Button>

          {!noPinSet && (
            <button onClick={() => setScreen("lock")} className="text-white/30 text-xs hover:text-white/60 w-full text-center">
              إلغاء
            </button>
          )}
        </div>
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════════════
  // ══  RECOVER SCREEN  ═══════════════════════════════════════════
  // ════════════════════════════════════════════════════════════════
  if (screen === "recover") return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-xl shadow-amber-500/30 mx-auto mb-6">
          <RotateCcw className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-white text-xl font-bold text-center mb-1">استرداد PIN</h2>
        <p className="text-white/40 text-xs text-center mb-8">أدخل الإيميل أو رقم التليفون اللي سجّلته</p>

        <div className="space-y-4">
          <Input
            type="text"
            placeholder="الإيميل أو رقم التليفون"
            value={recoveryInput}
            onChange={e => setRecoveryInput(e.target.value)}
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
            data-testid="input-recovery"
          />

          <div className="flex items-start gap-2 bg-amber-500/10 rounded-xl p-3 border border-amber-500/20">
            <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <p className="text-amber-300/80 text-xs">
              لو البيانات صح، هتاخد رمز إعادة ضبط مؤقت صالح 15 دقيقة
            </p>
          </div>

          <Button
            onClick={handleRecover}
            disabled={loading || !recoveryInput}
            className="w-full h-12 font-bold bg-gradient-to-r from-amber-500 to-orange-600 hover:opacity-90"
            data-testid="btn-recover"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "تأكيد الاسترداد"}
          </Button>

          <button onClick={() => setScreen("lock")} className="text-white/30 text-xs hover:text-white/60 w-full text-center">
            ← رجوع للـ PIN
          </button>
        </div>
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════════════
  // ══  RESET SCREEN  ═════════════════════════════════════════════
  // ════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center shadow-xl shadow-green-500/30 mx-auto mb-6">
          <CheckCircle className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-white text-xl font-bold text-center mb-1">تم التحقق ✓</h2>
        <p className="text-white/40 text-xs text-center mb-8">اختار PIN جديد</p>

        <div className="space-y-4">
          <div className="relative">
            <Input
              type={showPin ? "text" : "password"}
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={8}
              placeholder="PIN الجديد (4-8 أرقام)"
              value={resetPin}
              onChange={e => setResetPin(e.target.value.replace(/\D/g, ""))}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 tracking-widest text-lg text-center pr-10"
              data-testid="input-reset-pin"
            />
            <button onClick={() => setShowPin(s => !s)} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
              {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <Button
            onClick={handleReset}
            disabled={loading || resetPin.length < 4}
            className="w-full h-12 font-bold bg-gradient-to-r from-green-500 to-teal-600 hover:opacity-90"
            data-testid="btn-reset-pin"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "✓ حفظ PIN الجديد"}
          </Button>
        </div>
      </div>
    </div>
  );
}
