import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";

const PLATFORM_QA: Record<string, string> = {
  "ما هي المنصة": "شبكة سوق للإعلانات هي منصة إعلانية مصرية متكاملة تتيح:\n• نشر إعلانات الفيديو والصور\n• البث المباشر عبر قنوات\n• ريلز قصيرة بأسلوب TikTok\n• حملات إعلانية بنظام CPM و CPC\n• دفع واستلام أموال بالجنيه المصري\n• استهداف 26 محافظة مصرية",
  "كيف أنشئ إعلان": "لإنشاء إعلان:\n1. اضغط 'إنشاء إعلان' من الشريط العلوي\n2. اختر نوع الوسيطة (صورة/فيديو)\n3. أدخل العنوان والوصف\n4. يمكنك استخدام الذكاء الاصطناعي لكتابة النص (3 كريدت مجاناً)\n5. اضغط نشر والإعلان سيظهر فوراً",
  "كيف أبدأ بث": "لبدء بث مباشر:\n1. يجب أن يكون لديك قناة مُنشأة\n2. اذهب إلى 'بدء بث' من القائمة\n3. اختر جودة البث (1080p/720p/480p)\n4. اختر الكاميرا والميكروفون\n5. يمكن مشاركة الشاشة بدلاً من الكاميرا\n6. الإعلانات تظهر تلقائياً للمشاهدين",
  "كيف أسحب أرباحي": "لسحب الأرباح:\n1. اذهب إلى صفحة الإيرادات\n2. اضغط 'طلب سحب'\n3. أدخل المبلغ ورقم المحفظة\n4. الدفع عبر: فودافون كاش (01098553911) أو اتصالات (01126665741) أو InstaPay (01285558567)\n5. يُعالَج الطلب خلال 24-48 ساعة",
  "ما هي نسبة الأرباح": "نظام توزيع الأرباح:\n• الناشر (صاحب القناة/الموقع): 60%\n• المنصة: 40%\nالأسعار الافتراضية:\n• CPM (لكل 1000 ظهور): 15 جنيه\n• يمكن تعديلها من لوحة الإدارة",
  "كيف أنشئ قناة": "لإنشاء قناة:\n1. اضغط على 'القنوات' في القائمة العلوية\n2. اضغط 'إنشاء قناة جديدة'\n3. أدخل اسم القناة والوصف واللغة\n4. يمكن إضافة صورة غلاف وبانر\n5. بعد الإنشاء يمكنك البث وتحصيل الأرباح",
  "كيف أنشئ ريلز": "لنشر ريل:\n1. اذهب إلى صفحة الريلز\n2. اضغط 'إضافة ريل'\n3. ارفع الفيديو أو الصورة\n4. أضف العنوان والوصف\n5. الريلز تظهر للمستخدمين بأسلوب TikTok العمودي",
  "كيف أنشئ حملة": "لإنشاء حملة إعلانية:\n1. اذهب إلى 'الحملات' من القائمة\n2. اضغط 'إنشاء حملة'\n3. حدد الميزانية اليومية والإجمالية بالجنيه المصري\n4. اختر المحافظة المستهدفة (من 26 محافظة)\n5. اربط الحملة بإعلانك\n6. الحملة تبدأ فوراً بعد الموافقة",
  "كيف أرسل رسالة": "لإرسال رسالة:\n1. اذهب إلى صفحة الإعلان\n2. اضغط 'تواصل مع البائع'\n3. أو اذهب إلى صفحة الرسائل مباشرة\n4. يمكنك تتبع الرسائل الواردة والصادرة",
  "كيف أستخدم الذكاء الاصطناعي": "الذكاء الاصطناعي في المنصة:\n• 3 كريدت مجانية عند التسجيل\n• بعدها: 50 جنيه/كريدت\n• يكتب لك نصوص إعلانية احترافية\n• يولّد صور إعلانية بالذكاء الاصطناعي\n• يكتشف الاحتيال تلقائياً في الإعلانات",
  "كيف أدفع": "طرق الدفع المتاحة:\n📱 فودافون كاش: 01098553911\n📲 اتصالات (e&) كاش: 01126665741\n💳 InstaPay: 01285558567\nجميع المبالغ بالجنيه المصري فقط",
  "ما هي المحافظات": "المنصة تستهدف 26 محافظة مصرية:\nالقاهرة، الجيزة، الإسكندرية، الدقهلية، الشرقية، القليوبية، البحيرة، المنوفية، الغربية، كفر الشيخ، دمياط، بورسعيد، الإسماعيلية، السويس، شمال سيناء، جنوب سيناء، الفيوم، بني سويف، المنيا، أسيوط، سوهاج، قنا، الأقصر، أسوان، البحر الأحمر، الوادي الجديد",
};

export function PlatformAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: "user" | "bot"; text: string }[]>([
    { role: "bot", text: "مرحباً أحمد! 👋 أنا مساعد شبكة سوق للإعلانات.\nيمكنني مساعدتك في فهم أي جانب من المنصة. اختر سؤالاً أو اكتب استفسارك." }
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

    await new Promise(r => setTimeout(r, 500));

    const preset = Object.entries(PLATFORM_QA).find(([k]) =>
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
          context: "أنت مساعد ذكي للمسؤول عن منصة شبكة سوق للإعلانات. المنصة مصرية، الأسعار بالجنيه المصري. تشمل: إعلانات، قنوات، بث مباشر، ريلز، حملات إعلانية CPM/CPC، استهداف 26 محافظة، دفع عبر فودافون كاش وInstaPay واتصالات، ذكاء اصطناعي لكتابة الإعلانات. كن مختصراً ومفيداً للأدمن."
        })
      });
      if (res.ok) {
        const d = await res.json();
        setMessages(m => [...m, { role: "bot", text: d.reply || d.message || "عذراً، حاول مرة أخرى." }]);
      } else {
        throw new Error();
      }
    } catch {
      const fallbacks = [
        "يمكنك الاطلاع على إحصائيات المنصة من لوحة الأدمن أعلاه.",
        "للمزيد من التفاصيل، راجع صفحة دليل ربط الإعلانات.",
        "جميع الإعدادات متاحة من تبويب الإعدادات في لوحة الأدمن.",
      ];
      setMessages(m => [...m, { role: "bot", text: fallbacks[Math.floor(Math.random() * fallbacks.length)] }]);
    }
    setLoading(false);
  };

  const QUICK = ["ما هي المنصة", "كيف أنشئ إعلان", "كيف أبدأ بث", "ما هي نسبة الأرباح", "كيف أدفع"];

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 left-6 z-50 w-14 h-14 rounded-full bg-primary shadow-xl flex items-center justify-center hover:bg-primary/90 active:scale-95 transition-all"
        data-testid="btn-platform-assistant"
        title="مساعد المنصة"
      >
        {open ? <X className="w-6 h-6 text-white" /> : <MessageCircle className="w-6 h-6 text-white" />}
      </button>

      {open && (
        <div
          dir="rtl"
          className="fixed bottom-24 left-6 z-50 w-80 max-h-[520px] flex flex-col bg-background border border-border rounded-2xl shadow-2xl overflow-hidden"
        >
          <div className="bg-primary px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">م</div>
            <div>
              <p className="text-white font-bold text-sm">مساعد سوق الذكي</p>
              <p className="text-white/70 text-xs">شرح المنصة وطرق الاستخدام 🟢</p>
            </div>
            <button onClick={() => setOpen(false)} className="mr-auto text-white/70 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-3 py-2 border-b border-border/40 flex gap-1.5 overflow-x-auto scrollbar-none">
            {QUICK.map(q => (
              <button
                key={q}
                onClick={() => { setInput(q); }}
                className="text-xs px-2.5 py-1 rounded-full border border-primary/30 text-primary hover:bg-primary/10 transition-all whitespace-nowrap flex-shrink-0"
              >
                {q}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3" style={{ maxHeight: 290 }}>
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
                <div className={`max-w-[82%] rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-primary text-white rounded-br-sm"
                    : "bg-muted text-foreground rounded-bl-sm"
                }`}>
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
              placeholder="اسأل عن أي جزء في المنصة..."
              className="text-xs h-8"
              dir="rtl"
              data-testid="input-platform-chat"
            />
            <Button
              size="sm"
              className="h-8 w-8 p-0 flex-shrink-0"
              onClick={send}
              disabled={loading || !input.trim()}
              data-testid="btn-platform-send"
            >
              <Send className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
