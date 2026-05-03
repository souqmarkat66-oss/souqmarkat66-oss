import { useState, useEffect } from "react";
import {
  ShieldCheck, Lock, Eye, EyeOff, RotateCcw, KeyRound,
  CheckCircle, AlertCircle, Loader2, Settings2, Copy, CopyCheck,
  Sparkles, KeySquare, UserCog
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

type Screen = "loading" | "generated" | "lock" | "recover" | "change" | "change-password";

interface AdminPinLockProps {
  onUnlocked: () => void;
}

function PinKey({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center w-20 h-16 rounded-2xl bg-white/5 hover:bg-white/15 active:bg-white/20 active:scale-95 border border-white/10 transition-all duration-150 select-none"
    >
      <span className="text-white text-2xl font-light">{label}</span>
    </button>
  );
}

function PinDots({ length, filled, shake }: { length: number; filled: number; shake: boolean }) {
  return (
    <div className={`flex gap-4 justify-center my-6 ${shake ? "animate-bounce" : ""}`}>
      {Array.from({ length }).map((_, i) => (
        <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${i < filled ? "bg-primary border-primary scale-110" : "bg-transparent border-white/30"}`} />
      ))}
    </div>
  );
}

function PinDisplay({ pin, visible }: { pin: string; visible: boolean }) {
  return (
    <span className="text-5xl font-mono font-extrabold tracking-[0.3em] text-white">
      {visible ? pin : "••••••"}
    </span>
  );
}

const bg = "min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col items-center justify-center p-6 relative overflow-hidden";

const Glow = () => (
  <>
    <div className="absolute top-1/4 -left-20 w-72 h-72 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
    <div className="absolute bottom-1/4 -right-20 w-72 h-72 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />
  </>
);

export default function AdminPinLock({ onUnlocked }: AdminPinLockProps) {
  const { toast } = useToast();
  const [screen, setScreen] = useState<Screen>("loading");


  // generated / recovered PIN display
  const [displayPin, setDisplayPin] = useState("");
  const [pinVisible, setPinVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isRecoveredPin, setIsRecoveredPin] = useState(false);

  // lock screen
  const [pin, setPin] = useState("");
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);

  // recover screen
  const [recoverInput, setRecoverInput] = useState("");
  const [recoverPassword, setRecoverPassword] = useState("");
  const [recoverPassVisible, setRecoverPassVisible] = useState(false);

  // change PIN
  const [newPin1, setNewPin1] = useState("");
  const [newPin2, setNewPin2] = useState("");
  const [newPinStep, setNewPinStep] = useState<"first" | "confirm">("first");
  const [changePinVisible, setChangePinVisible] = useState(false);

  // change password
  const [curPass, setCurPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confPass, setConfPass] = useState("");
  const [passVisible, setPassVisible] = useState(false);

  const PIN_LENGTH = 6;

  // ── Init: auto-generate PIN if first time ──────────────────────
  useEffect(() => {
    fetch("/api/admin/pin/init", { credentials: "include" })
      .then(r => r.json())
      .then(d => {
        if (d.generated) {
          setDisplayPin(d.pin);
          setIsRecoveredPin(false);
          setScreen("generated");
        } else {
          setScreen("lock");
        }
      })
      .catch(() => setScreen("lock"));
  }, []);

  // ── Auto-verify when PIN full ───────────────────────────────────
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
            setShake(true);
            setTimeout(() => { setShake(false); setPin(""); }, 600);
            toast({ variant: "destructive", title: "❌ PIN غير صحيح، حاول مجدداً" });
          }
        })
        .catch(() => { setLoading(false); setPin(""); });
    }
  }, [pin, screen]);

  const handleCopy = () => {
    navigator.clipboard.writeText(displayPin).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // ── Recover: email/phone + password → auto-generate new PIN ────
  const handleRecover = () => {
    if (!recoverInput || !recoverPassword) return toast({ variant: "destructive", title: "أدخل الإيميل أو التليفون وكلمة السر" });
    setLoading(true);
    fetch("/api/admin/pin/recover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ input: recoverInput, password: recoverPassword }),
    })
      .then(r => r.json())
      .then(d => {
        setLoading(false);
        if (d.success && d.pin) {
          setDisplayPin(d.pin);
          setPinVisible(false);
          setCopied(false);
          setIsRecoveredPin(true);
          setScreen("generated");
        } else {
          toast({ variant: "destructive", title: d.message || "البيانات غير صحيحة" });
        }
      })
      .catch(() => setLoading(false));
  };

  // ── Change PIN ──────────────────────────────────────────────────
  const handleChangePinSave = () => {
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
        if (d.success) { toast({ title: "✅ تم تغيير PIN بنجاح" }); setPin(""); setScreen("lock"); }
        else toast({ variant: "destructive", title: d.message });
      })
      .catch(() => setLoading(false));
  };

  // ── Change Password ─────────────────────────────────────────────
  const handleChangePassword = () => {
    if (newPass !== confPass) return toast({ variant: "destructive", title: "⚠️ كلمات السر غير متطابقة" });
    if (newPass.length < 6) return toast({ variant: "destructive", title: "كلمة السر لازم تكون 6 أحرف على الأقل" });
    setLoading(true);
    fetch("/api/admin/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ currentPassword: curPass, newPassword: newPass }),
    })
      .then(r => r.json())
      .then(d => {
        setLoading(false);
        if (d.success) {
          toast({ title: "✅ تم تغيير كلمة السر بنجاح" });
          setCurPass(""); setNewPass(""); setConfPass("");
          setScreen("lock");
        } else {
          toast({ variant: "destructive", title: d.message });
        }
      })
      .catch(() => setLoading(false));
  };

  // ══════════════════════════════════════════════════════════
  // LOADING
  // ══════════════════════════════════════════════════════════
  if (screen === "loading") return (
    <div className={bg}>
      <Loader2 className="w-10 h-10 text-primary animate-spin" />
    </div>
  );

  // ══════════════════════════════════════════════════════════
  // GENERATED / RECOVERED PIN — show the PIN to admin
  // ══════════════════════════════════════════════════════════
  if (screen === "generated") return (
    <div className={bg}>
      <Glow />
      <div className="w-full max-w-sm text-center">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-2xl shadow-primary/30 mx-auto mb-6">
          <Sparkles className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-white text-2xl font-extrabold mb-1">
          {isRecoveredPin ? "تم توليد PIN جديد" : "تم توليد PIN تلقائياً"}
        </h1>
        <p className="text-white/50 text-sm mb-8">
          {isRecoveredPin ? "احفظ الـ PIN الجديد — ستحتاجه في كل مرة تدخل" : "احتفظ بهذا الـ PIN — ستحتاجه في كل مرة تدخل لوحة التحكم"}
        </p>

        <div className="bg-white/5 border border-white/10 rounded-3xl p-8 mb-6">
          <p className="text-white/40 text-xs mb-3 tracking-widest uppercase">رقم PIN الخاص بك</p>
          <div className="flex items-center justify-center gap-3 mb-4">
            <PinDisplay pin={displayPin} visible={pinVisible} />
            <button onClick={() => setPinVisible(v => !v)} className="text-white/30 hover:text-white/70 transition-colors">
              {pinVisible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          <button onClick={handleCopy} className="flex items-center gap-2 mx-auto text-sm text-primary hover:text-primary/80 transition-colors">
            {copied ? <CopyCheck className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? "تم النسخ!" : "نسخ الـ PIN"}
          </button>
        </div>

        <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 mb-6 text-right">
          <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
          <p className="text-amber-300/80 text-sm">
            <strong className="text-amber-300">مهم:</strong> احفظ هذا الـ PIN الآن. لن يُعرَض مرة أخرى.
          </p>
        </div>

        <Button
          className="w-full h-13 text-base font-bold bg-gradient-to-r from-primary to-purple-600 hover:opacity-90 rounded-2xl"
          onClick={() => { setPin(""); setScreen("lock"); }}
          data-testid="btn-pin-understood"
        >
          <ShieldCheck className="w-5 h-5 me-2" />
          حفظت الـ PIN — متابعة لتسجيل الدخول
        </Button>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════
  // LOCK SCREEN — numeric keypad
  // ══════════════════════════════════════════════════════════
  if (screen === "lock") return (
    <div className={bg}>
      <Glow />
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-2xl shadow-primary/30 mb-4">
        <ShieldCheck className="w-10 h-10 text-white" />
      </div>
      <h1 className="text-white text-2xl font-extrabold tracking-tight mb-1">لوحة التحكم</h1>
      <p className="text-white/40 text-sm mb-1">أدخل رقم PIN للمتابعة</p>

      <PinDots length={PIN_LENGTH} filled={pin.length} shake={shake} />

      {loading && <Loader2 className="w-5 h-5 text-primary animate-spin mb-2" />}

      <div className="grid grid-cols-3 gap-3">
        {["1","2","3","4","5","6","7","8","9"].map(d => (
          <PinKey key={d} label={d} onClick={() => { if (pin.length < PIN_LENGTH) setPin(p => p + d); }} />
        ))}
        <PinKey label="⌫" onClick={() => setPin(p => p.slice(0, -1))} />
        <PinKey label="0" onClick={() => { if (pin.length < PIN_LENGTH) setPin(p => p + "0"); }} />
        <PinKey label="✓" onClick={() => {}} />
      </div>

      {/* Actions */}
      <div className="flex flex-col items-center gap-2 mt-8">
        <button
          onClick={() => { setRecoverInput(""); setRecoverPassword(""); setScreen("recover"); }}
          className="text-white/40 hover:text-white/70 text-sm flex items-center gap-1.5 transition-colors"
          data-testid="btn-forgot-pin"
        >
          <RotateCcw className="w-3.5 h-3.5" /> نسيت PIN؟ (استرداد)
        </button>
        <button
          onClick={() => { setNewPin1(""); setNewPin2(""); setNewPinStep("first"); setScreen("change"); }}
          className="text-white/30 hover:text-white/60 text-xs flex items-center gap-1 transition-colors"
          data-testid="btn-change-pin"
        >
          <KeyRound className="w-3 h-3" /> تغيير PIN
        </button>
        <button
          onClick={() => { setCurPass(""); setNewPass(""); setConfPass(""); setScreen("change-password"); }}
          className="text-white/30 hover:text-white/60 text-xs flex items-center gap-1 transition-colors"
          data-testid="btn-change-password"
        >
          <UserCog className="w-3 h-3" /> تغيير كلمة السر
        </button>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════
  // RECOVER — email/phone + password → system generates new PIN
  // ══════════════════════════════════════════════════════════
  if (screen === "recover") return (
    <div className={bg}>
      <Glow />
      <div className="w-full max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-xl shadow-amber-500/30 mx-auto mb-5">
          <RotateCcw className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-white text-xl font-bold text-center mb-1">استرداد PIN</h2>
        <p className="text-white/40 text-xs text-center mb-7">أدخل بيانات حسابك للتحقق وتوليد PIN جديد تلقائياً</p>

        <div className="space-y-3">
          <Input
            type="text"
            placeholder="الإيميل أو رقم التليفون"
            value={recoverInput}
            onChange={e => setRecoverInput(e.target.value)}
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-12"
            data-testid="input-recover-id"
          />

          <div className="relative">
            <Input
              type={recoverPassVisible ? "text" : "password"}
              placeholder="كلمة السر"
              value={recoverPassword}
              onChange={e => setRecoverPassword(e.target.value)}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-12 pl-10"
              data-testid="input-recover-pass"
            />
            <button
              onClick={() => setRecoverPassVisible(v => !v)}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
            >
              {recoverPassVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <div className="flex items-start gap-2 bg-blue-500/10 rounded-xl p-3 border border-blue-500/20">
            <CheckCircle className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
            <p className="text-blue-300/80 text-xs">بعد التحقق، النظام سيولّد PIN جديد ويعرضه لك تلقائياً</p>
          </div>

          <Button
            onClick={handleRecover}
            disabled={loading || !recoverInput || !recoverPassword}
            className="w-full h-12 font-bold bg-gradient-to-r from-amber-500 to-orange-600 hover:opacity-90 rounded-xl"
            data-testid="btn-recover-submit"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><RotateCcw className="w-4 h-4 me-2" /> تحقق وولّد PIN جديد</>}
          </Button>

          <button onClick={() => setScreen("lock")} className="text-white/30 text-xs hover:text-white/60 w-full text-center pt-1">
            ← رجوع
          </button>
        </div>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════
  // CHANGE PIN (manually choose new PIN)
  // ══════════════════════════════════════════════════════════
  if (screen === "change") return (
    <div className={bg}>
      <Glow />
      <div className="w-full max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-xl shadow-primary/30 mx-auto mb-5">
          <KeySquare className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-white text-xl font-bold text-center mb-1">تغيير PIN</h2>
        <p className="text-white/40 text-xs text-center mb-7">
          {newPinStep === "first" ? "أدخل PIN الجديد (4-8 أرقام)" : "أكّد PIN الجديد مجدداً"}
        </p>

        <div className="space-y-4">
          <div className="relative">
            <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <Input
              type={changePinVisible ? "text" : "password"}
              inputMode="numeric"
              maxLength={8}
              placeholder={newPinStep === "first" ? "PIN الجديد" : "تأكيد PIN"}
              value={newPinStep === "first" ? newPin1 : newPin2}
              onChange={e => {
                const v = e.target.value.replace(/\D/g, "");
                newPinStep === "first" ? setNewPin1(v) : setNewPin2(v);
              }}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 pr-10 pl-10 tracking-widest text-lg text-center h-14"
              data-testid="input-new-pin"
            />
            <button onClick={() => setChangePinVisible(v => !v)} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
              {changePinVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {newPinStep === "first" ? (
            <Button
              onClick={() => {
                if (newPin1.length < 4) return toast({ variant: "destructive", title: "PIN لازم 4 أرقام على الأقل" });
                setNewPinStep("confirm");
              }}
              className="w-full h-12 font-bold bg-gradient-to-r from-primary to-purple-600 hover:opacity-90"
            >
              التالي ›
            </Button>
          ) : (
            <>
              <Button
                onClick={handleChangePinSave}
                disabled={loading || newPin2.length < 4}
                className="w-full h-12 font-bold bg-gradient-to-r from-primary to-purple-600 hover:opacity-90"
                data-testid="btn-save-new-pin"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "✓ حفظ PIN الجديد"}
              </Button>
              <button onClick={() => { setNewPinStep("first"); setNewPin2(""); }} className="text-white/30 text-xs hover:text-white/60 w-full text-center">
                ← رجوع لتغيير PIN
              </button>
            </>
          )}
          <button onClick={() => setScreen("lock")} className="text-white/30 text-xs hover:text-white/60 w-full text-center">إلغاء</button>
        </div>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════
  // CHANGE PASSWORD
  // ══════════════════════════════════════════════════════════
  return (
    <div className={bg}>
      <Glow />
      <div className="w-full max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center shadow-xl shadow-green-500/30 mx-auto mb-5">
          <UserCog className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-white text-xl font-bold text-center mb-1">تغيير كلمة السر</h2>
        <p className="text-white/40 text-xs text-center mb-7">أدخل كلمة السر الحالية والجديدة</p>

        <div className="space-y-3">
          {[
            { label: "كلمة السر الحالية", value: curPass, set: setCurPass, testId: "input-cur-pass" },
            { label: "كلمة السر الجديدة", value: newPass, set: setNewPass, testId: "input-new-pass" },
            { label: "تأكيد كلمة السر الجديدة", value: confPass, set: setConfPass, testId: "input-conf-pass" },
          ].map(({ label, value, set, testId }) => (
            <div key={testId} className="relative">
              <Input
                type={passVisible ? "text" : "password"}
                placeholder={label}
                value={value}
                onChange={e => set(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-12 pl-10"
                data-testid={testId}
              />
              <button onClick={() => setPassVisible(v => !v)} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                {passVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          ))}

          <Button
            onClick={handleChangePassword}
            disabled={loading || !curPass || !newPass || !confPass}
            className="w-full h-12 font-bold bg-gradient-to-r from-green-500 to-teal-600 hover:opacity-90 rounded-xl mt-2"
            data-testid="btn-save-new-pass"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "✓ حفظ كلمة السر الجديدة"}
          </Button>

          <button onClick={() => setScreen("lock")} className="text-white/30 text-xs hover:text-white/60 w-full text-center pt-1">
            ← رجوع
          </button>
        </div>
      </div>
    </div>
  );
}
