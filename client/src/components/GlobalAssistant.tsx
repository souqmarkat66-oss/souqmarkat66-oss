import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";

const QA: Record<string, string> = {
  "ما هي المنصة": "شبكة سوق للإعلانات منصة مصرية تتيح:\n• نشر الإعلانات (صور وفيديو)\n• البث المباشر وقنوات المحتوى\n• ريلز قصيرة بأسلوب TikTok\n• حملات إعلانية CPM/CPC بالجنيه المصري\n• استهداف 26 محافظة مصرية",

  "كيف أسجل": "التسجيل مجاني وسريع:\n1. اضغط 'تسجيل الدخول' من القائمة العلوية\n2. سجّل بحسابك الشخصي\n3. اختر دورك: معلن، صاحب قناة، أو مستخدم\n4. ستتمكن فوراً من النشر والتفاعل",

  "كيف أنشر إعلان": "لنشر إعلان:\n1. اضغط 'إنشاء إعلان' في الشريط العلوي\n2. أضف صورة أو فيديو للإعلان\n3. اكتب العنوان والوصف (أو استخدم AI)\n4. اختر اللغة والمنطقة المستهدفة\n5. اضغط نشر — الإعلان يظهر فوراً",

  "كيف أبدأ قناة": "لإنشاء قناة:\n1. اذهب إلى 'القنوات' من القائمة\n2. اضغط 'إنشاء قناة'\n3. أدخل اسم القناة والوصف\n4. بعد الإنشاء يمكنك البث مباشرة وكسب الأرباح",

  "كيف أبدأ بث": "لبدء بث مباشر:\n1. أنشئ قناة أولاً إن لم يكن لديك واحدة\n2. اذهب إلى 'بدء بث' في القائمة\n3. اختر جودة البث وأجهزة الصوت والصورة\n4. يمكنك مشاركة الشاشة بدلاً من الكاميرا\n5. الإعلانات تظهر تلقائياً للمشاهدين وتكسب أرباحاً",

  "كيف أكسب مال": "طرق الكسب على المنصة:\n• صاحب قناة: 60% من إيرادات الإعلانات\n• إعلانك في البث المباشر: مدفوع لكل ظهور ونقرة\n• الريلز: تفاعل يرفع انتشارك\nالسحب عبر: فودافون كاش / اتصالات / InstaPay",

  "كيف أسحب أرباح": "لسحب أرباحك:\n1. اذهب إلى صفحة 'الإيرادات'\n2. اضغط 'طلب سحب'\n3. أدخل المبلغ ورقم محفظتك\nطرق الدفع:\n📱 فودافون كاش: 01098553911\n📲 اتصالات كاش: 0112666571\n💳 InstaPay: 01285558567",

  "كيف أشتري إعلانات": "لشراء حملة إعلانية:\n1. اذهب إلى 'الحملات' من القائمة\n2. اضغط 'إنشاء حملة'\n3. حدد ميزانيتك اليومية والإجمالية\n4. اختر المحافظة المستهدفة (26 محافظة)\n5. ربط الحملة بإعلانك — وتبدأ فوراً",

  "كيف أراسل": "للتواصل مع البائع أو الناشر:\n1. افتح صفحة الإعلان\n2. اضغط 'تواصل مع البائع'\n3. أو اذهب لصفحة 'الرسائل' مباشرة\n4. ستصلك الرسائل الواردة مع إشعار",

  "ما هي طرق الدفع": "طرق الدفع المتاحة بالجنيه المصري:\n📱 فودافون كاش: 01098553911\n📲 اتصالات (e&) كاش: 0112666571\n💳 InstaPay: 01285558567\n🛒 تطبيق سوق ماركات: دفع مباشر",

  "كيف أرفع ريلز": "لنشر ريل:\n1. اذهب إلى 'الريلز' من القائمة\n2. اضغط 'إضافة ريل'\n3. ارفع الفيديو أو الصورة\n4. أضف عنواناً ووصفاً\n5. الريلز تظهر عمودياً بأسلوب TikTok",

  "كيف أستخدم ذكاء اصطناعي": "الذكاء الاصطناعي في المنصة:\n• 3 كريدت مجانية عند التسجيل\n• بعدها 50 جنيه/كريدت\n• يكتب نصوص إعلانية احترافية\n• يولد صور بالذكاء الاصطناعي\n• يكتشف المحتوى المخالف تلقائياً",

  "ما المحافظات المتاحة": "المنصة تستهدف 26 محافظة مصرية:\nالقاهرة، الجيزة، الإسكندرية، الدقهلية، الشرقية، القليوبية، البحيرة، المنوفية، الغربية، كفر الشيخ، دمياط، بورسعيد، الإسماعيلية، السويس، شمال سيناء، جنوب سيناء، الفيوم، بني سويف، المنيا، أسيوط، سوهاج، قنا، الأقصر، أسوان، البحر الأحمر، الوادي الجديد",
};

const QUICK = [
  "كيف أنشر إعلان",
  "كيف أبدأ قناة",
  "كيف أكسب مال",
  "كيف أسحب أرباح",
  "ما هي طرق الدفع",
];

export function GlobalAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: "user" | "bot"; text: string }[]>([
    {
      role: "bot",
      text: "مرحباً! 👋 أنا مساعد شبكة سوق للإعلانات.\nيمكنني مساعدتك في أي شيء — سواء كنت معلناً، ناشراً، أو صاحب محتوى.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const q = input.trim();
    if (!q) return;
    setMessages(m => [...m, { role: "user", text: q }]);
    setInput("");
    setLoading(true);

    await new Promise(r => setTimeout(r, 450));

    const preset = Object.entries(QA).find(([k]) =>
      q.includes(k) || k.split(" ").some(word => word.length > 2 && q.includes(word))
    );

    if (preset) {
      setMessages(m => [...m, { role: "bot", text: preset[1] }]);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          message: q,
          context: "أنت مساعد دعم ذكي لمنصة شبكة سوق للإعلانات المصرية. تساعد المستخدمين من معلنين وناشرين وأصحاب قنوات وأصحاب محتوى. المنصة تشمل: إعلانات، قنوات، بث مباشر، ريلز، حملات CPM/CPC، 26 محافظة مصرية، دفع بالجنيه عبر فودافون كاش واتصالات وInstaPay. كن ودوداً ومختصراً وباللغة العربية."
        }),
      });
      if (res.ok) {
        const d = await res.json();
        setMessages(m => [...m, { role: "bot", text: d.reply || d.message || "عذراً، حاول مرة أخرى." }]);
      } else throw new Error();
    } catch {
      const fallback = [
        "يمكنك إنشاء إعلانك من زر 'إنشاء إعلان' في القائمة العلوية.",
        "للاستفسارات، تواصل معنا عبر الرسائل الداخلية أو WhatsApp.",
        "اطلع على صفحة 'دليل الربط' للمزيد من التفاصيل التقنية.",
      ];
      setMessages(m => [...m, { role: "bot", text: fallback[Math.floor(Math.random() * fallback.length)] }]);
    }
    setLoading(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 left-6 z-50 w-14 h-14 rounded-full bg-primary shadow-2xl flex items-center justify-center hover:bg-primary/90 active:scale-95 transition-all"
        data-testid="btn-global-assistant"
        title="مساعد سوق الذكي"
        aria-label="مساعد سوق الذكي"
      >
        {open ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <MessageCircle className="w-6 h-6 text-white" />
        )}
      </button>

      {open && (
        <div
          dir="rtl"
          className="fixed bottom-24 left-6 z-50 w-80 max-h-[520px] flex flex-col bg-background border border-border rounded-2xl shadow-2xl overflow-hidden"
        >
          <div className="bg-primary px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-base flex-shrink-0">
              م
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm">مساعد سوق الذكي</p>
              <p className="text-white/70 text-xs">معلنين • ناشرين • أصحاب محتوى 🟢</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-white/70 hover:text-white flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-3 py-2 border-b border-border/40 flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {QUICK.map(q => (
              <button
                key={q}
                onClick={() => setInput(q)}
                className="text-xs px-2.5 py-1 rounded-full border border-primary/30 text-primary hover:bg-primary/10 transition-all whitespace-nowrap flex-shrink-0"
              >
                {q}
              </button>
            ))}
          </div>

          <div
            className="flex-1 overflow-y-auto p-3 space-y-3"
            style={{ maxHeight: 290 }}
          >
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}
              >
                <div
                  className={`max-w-[82%] rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-primary text-white rounded-br-sm"
                      : "bg-muted text-foreground rounded-bl-sm"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-end">
                <div className="bg-muted rounded-2xl rounded-bl-sm px-3 py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="p-3 border-t border-border/40 flex gap-2">
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && send()}
              placeholder="اسأل أي شيء..."
              className="text-xs h-8"
              dir="rtl"
              data-testid="input-global-chat"
            />
            <Button
              size="sm"
              className="h-8 w-8 p-0 flex-shrink-0"
              onClick={send}
              disabled={loading || !input.trim()}
              data-testid="btn-global-send"
            >
              <Send className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
