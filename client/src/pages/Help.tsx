import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  ChevronDown, ChevronUp, HelpCircle, MessageSquare, Mail,
  PlusCircle, Radio, Tv, Film, Megaphone, DollarSign,
  LogIn, CheckCircle, PlayCircle, ExternalLink
} from "lucide-react";

/* ─── FAQ Accordion ─────────────────────────────────────────── */
const FAQS = [
  {
    q: "كيف أنشر إعلاناً على المنصة؟",
    a: "سجّل دخولك، ثم اضغط على 'إعلان جديد' من القائمة العلوية. أدخل عنوان الإعلان، الوصف، السعر، أضف صوراً أو فيديو، ثم اضغط 'نشر'. الإعلان يظهر فوراً للجميع.",
  },
  {
    q: "هل نشر الإعلانات مجاني؟",
    a: "نعم! نشر الإعلانات المبوّبة مجاني تماماً. يمكنك نشر إعلانك بدون أي رسوم. الخدمات المدفوعة هي فقط: تمييز الإعلان (Boost) والحملات الإعلانية الاحترافية.",
  },
  {
    q: "كيف أبدأ بثاً مباشراً؟",
    a: "من القائمة العلوية اضغط 'بث مباشر'، أو من صفحة القنوات. أدخل عنوان البث واختر الخصوصية، ثم اضغط 'ابدأ البث'. ستحتاج للسماح للمتصفح باستخدام الكاميرا والميكروفون.",
  },
  {
    q: "كيف أكسب المال من قناتي؟",
    a: "أنشئ قناة وابنِ جمهورك. عندما تصل لعدد مشتركين كافٍ، اذهب لصفحة 'الإيرادات' واطلب تفعيل التربيح. ستحصل على 60% من إيراد كل إعلان يُعرَض على قناتك.",
  },
  {
    q: "ما الفرق بين الإعلان المبوّب والحملة الإعلانية؟",
    a: "الإعلان المبوّب: مثل إعلانات السوبر ماركت — ينشر منتجك أو خدمتك ليراه الزوار. أما الحملة الإعلانية: فهي مثل Google Ads أو Facebook Ads — تستهدف جمهوراً محدداً وتدفع مقابل كل ظهور أو نقرة، وتُعرَض داخل المنصة.",
  },
  {
    q: "ما طرق الدفع المتاحة؟",
    a: "ندعم: فودافون كاش (01098559311)، اتصالات كاش (01126665741)، وInstaPay (01285558567). بعد التحويل، ارفع صورة الإيصال في صفحة المدفوعات وسيتم التفعيل خلال ساعات.",
  },
  {
    q: "كيف أنشئ ريلز (مقطع قصير)؟",
    a: "اذهب لصفحة 'ريلز' من القائمة، اضغط على زر الكاميرا أو رفع فيديو. الريلز هي مقاطع فيديو قصيرة تعرض بشكل عمودي كامل الشاشة — مثل TikTok.",
  },
  {
    q: "هل يمكنني استهداف محافظة معينة في إعلاني؟",
    a: "نعم! عند إنشاء الإعلان، يمكنك اختيار المحافظة المستهدفة من خريطة مصر الـ 26 محافظة. وفي الحملات الإعلانية يمكنك استهداف عمر وجنس واهتمامات معينة أيضاً.",
  },
  {
    q: "كيف أرفع إيصال الدفع؟",
    a: "بعد التحويل، اذهب لصفحة 'المدفوعات' من قائمة حسابك. اختر نوع الخدمة، أدخل رقم الهاتف الذي حوّلت منه، ثم ارفع صورة الإيصال. يتم مراجعته خلال 24 ساعة.",
  },
  {
    q: "هل المنصة متاحة على الجوال؟",
    a: "نعم! الموقع يعمل بشكل كامل على الجوال من المتصفح. كما يتوفر تطبيق 'سوق ماركات' على App Store وGoogle Play للتحميل المجاني.",
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border/60 rounded-2xl overflow-hidden hover:border-primary/30 transition-all">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-4 p-5 text-right hover:bg-muted/30 transition-colors"
        data-testid="btn-faq-toggle"
      >
        <span className="font-bold text-sm leading-relaxed">{q}</span>
        {open
          ? <ChevronUp className="w-5 h-5 text-primary flex-shrink-0" />
          : <ChevronDown className="w-5 h-5 text-muted-foreground flex-shrink-0" />}
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1 bg-muted/10 border-t border-border/40">
          <p className="text-sm text-muted-foreground leading-relaxed">{a}</p>
        </div>
      )}
    </div>
  );
}

/* ─── Feature Cards ─────────────────────────────────────────── */
const FEATURES = [
  {
    icon: PlusCircle,
    emoji: "📢",
    title: "نشر إعلان",
    desc: "أنشر إعلانك في ثوانٍ — سيارات، عقارات، إلكترونيات، ملابس، وأكثر من 20 فئة. الإعلان يظهر لآلاف الزوار فوراً.",
    color: "text-green-600",
    bg: "bg-green-500/10",
    border: "hover:border-green-500/40",
    href: "/create",
    cta: "انشر الآن",
    videoLabel: "طريقة نشر الإعلان",
    videoId: "dQw4w9WgXcQ",
  },
  {
    icon: Radio,
    emoji: "🎥",
    title: "البث المباشر",
    desc: "ابثّ مباشرةً من الكاميرا مع دردشة حية ومشاركين. يمكنك إضافة Co-host وعرض إعلانات لكسب المال أثناء البث.",
    color: "text-red-600",
    bg: "bg-red-500/10",
    border: "hover:border-red-500/40",
    href: "/stream/start",
    cta: "ابدأ البث",
    videoLabel: "كيف تبدأ بثاً مباشراً",
    videoId: "dQw4w9WgXcQ",
  },
  {
    icon: Tv,
    emoji: "📺",
    title: "القنوات",
    desc: "أنشئ قناتك واحصل على مشتركين مثل YouTube. شارك محتواك واربح من الإعلانات التي تُعرَض على قناتك.",
    color: "text-purple-600",
    bg: "bg-purple-500/10",
    border: "hover:border-purple-500/40",
    href: "/channels",
    cta: "تصفح القنوات",
    videoLabel: "كيف تنشئ قناتك",
    videoId: "dQw4w9WgXcQ",
  },
  {
    icon: Film,
    emoji: "🎬",
    title: "الريلز",
    desc: "انشر مقاطع فيديو قصيرة تُعرَض بشكل عمودي مثل TikTok. أفضل طريقة للوصول لجمهور جديد بسرعة.",
    color: "text-pink-600",
    bg: "bg-pink-500/10",
    border: "hover:border-pink-500/40",
    href: "/reels",
    cta: "شاهد الريلز",
    videoLabel: "كيف تنشر ريلز",
    videoId: "dQw4w9WgXcQ",
  },
  {
    icon: Megaphone,
    emoji: "🎯",
    title: "الحملات الإعلانية",
    desc: "أطلق حملة إعلانية احترافية تستهدف العمر والمحافظة والاهتمامات بنظام CPM أو CPC بالجنيه المصري.",
    color: "text-blue-600",
    bg: "bg-blue-500/10",
    border: "hover:border-blue-500/40",
    href: "/campaigns",
    cta: "إنشاء حملة",
    videoLabel: "شرح الحملات الإعلانية",
    videoId: "dQw4w9WgXcQ",
  },
  {
    icon: DollarSign,
    emoji: "💰",
    title: "الإيرادات",
    desc: "تتبع أرباحك من قناتك وريلزك وبثوثك. اطلب سحب رصيدك عبر فودافون كاش أو InstaPay مباشرةً.",
    color: "text-teal-600",
    bg: "bg-teal-500/10",
    border: "hover:border-teal-500/40",
    href: "/revenue",
    cta: "عرض الإيرادات",
    videoLabel: "كيف تسحب أرباحك",
    videoId: "dQw4w9WgXcQ",
  },
];

/* ─── YouTube Embed Card ─────────────────────────────────────── */
function VideoCard({ label, videoId }: { label: string; videoId: string }) {
  const [playing, setPlaying] = useState(false);
  const thumb = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  return (
    <div className="mt-4 rounded-xl overflow-hidden border border-border/50 bg-black/5">
      {playing ? (
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
          className="w-full aspect-video"
          allow="autoplay; encrypted-media"
          allowFullScreen
          title={label}
        />
      ) : (
        <button
          onClick={() => setPlaying(true)}
          className="relative w-full aspect-video group"
          data-testid="btn-play-video"
          aria-label={`تشغيل فيديو: ${label}`}
        >
          <img src={thumb} alt={label} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/40 group-hover:bg-black/50 transition-colors flex flex-col items-center justify-center gap-2">
            <div className="w-14 h-14 rounded-full bg-red-600 flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
              <PlayCircle className="w-8 h-8 text-white fill-white" />
            </div>
            <span className="text-white text-sm font-bold drop-shadow">{label}</span>
          </div>
        </button>
      )}
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────────────── */
export default function Help() {
  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-primary/15 via-background to-secondary/10 border-b border-border/40">
        <div className="container px-4 py-16 text-center">
          <Badge className="mb-4 gap-2 text-sm px-4 py-1.5">
            <HelpCircle className="w-4 h-4" /> مركز المساعدة
          </Badge>
          <h1 className="text-3xl md:text-5xl font-black mb-4 leading-tight">
            كيف تستخدم شبكة سوق للإعلانات؟
          </h1>
          <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto leading-relaxed mb-8">
            دليل شامل بالعربي لكل الميزات — من نشر الإعلانات والبث المباشر وحتى كسب المال من قناتك. كل شيء موضّح بالفيديو والخطوات.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/login">
              <Button size="lg" className="gap-2 h-12 px-6 shadow-lg shadow-primary/20">
                <LogIn className="w-5 h-5" /> ابدأ الآن مجاناً
              </Button>
            </Link>
            <a
              href="https://wa.me/201098559311?text=مرحباً، أحتاج مساعدة في استخدام منصة سوق للإعلانات"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button size="lg" variant="outline" className="gap-2 h-12 px-6">
                <MessageSquare className="w-5 h-5 text-green-500" /> تواصل مع الدعم
              </Button>
            </a>
          </div>
        </div>
      </div>

      <div className="container px-4 py-12 max-w-4xl mx-auto">

        {/* ── Getting Started Steps ─────────────────────────── */}
        <div className="mb-14">
          <h2 className="text-2xl font-black mb-2 text-center">ابدأ في 3 خطوات</h2>
          <p className="text-muted-foreground text-sm text-center mb-8">بسيط وسريع — ما تحتاج خبرة تقنية</p>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                num: "1",
                icon: "📝",
                title: "سجّل حسابك",
                desc: "أنشئ حساباً مجانياً بالإيميل أو رقم الهاتف في أقل من دقيقة.",
                color: "from-primary/20 to-primary/5",
                border: "border-primary/20",
              },
              {
                num: "2",
                icon: "📢",
                title: "انشر أو ابثّ",
                desc: "أنشر إعلانك المبوّب، ابدأ قناتك، أو أطلق بثاً مباشراً بضغطة واحدة.",
                color: "from-blue-500/20 to-blue-500/5",
                border: "border-blue-500/20",
              },
              {
                num: "3",
                icon: "💰",
                title: "اربح من جمهورك",
                desc: "فعّل التربيح واحصل على 60% من إيراد كل إعلان يُعرَض على محتواك.",
                color: "from-green-500/20 to-green-500/5",
                border: "border-green-500/20",
              },
            ].map(s => (
              <div
                key={s.num}
                className={`rounded-2xl bg-gradient-to-br ${s.color} border ${s.border} p-6 text-center`}
              >
                <div className="w-12 h-12 rounded-full bg-white/70 dark:bg-white/10 flex items-center justify-center text-2xl mx-auto mb-4 shadow">
                  {s.icon}
                </div>
                <div className="inline-flex w-7 h-7 rounded-full bg-foreground text-background text-xs font-black items-center justify-center mb-2">
                  {s.num}
                </div>
                <h3 className="font-black text-base mb-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Features with Videos ─────────────────────────── */}
        <div className="mb-14">
          <h2 className="text-2xl font-black mb-2 text-center">شرح الميزات بالفيديو</h2>
          <p className="text-muted-foreground text-sm text-center mb-8">اضغط على أي فيديو لمشاهدة الشرح الكامل</p>
          <div className="grid md:grid-cols-2 gap-6">
            {FEATURES.map(f => (
              <Card
                key={f.title}
                className={`rounded-2xl border-border/50 ${f.border} transition-all hover:shadow-lg`}
                data-testid={`card-feature-${f.title}`}
              >
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-xl ${f.bg} flex items-center justify-center flex-shrink-0`}>
                      <f.icon className={`w-5 h-5 ${f.color}`} />
                    </div>
                    <div>
                      <div className="text-lg">{f.emoji}</div>
                      <h3 className="font-black text-base leading-none">{f.title}</h3>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-3">{f.desc}</p>
                  <Link href={f.href}>
                    <Button size="sm" variant="outline" className={`gap-1.5 text-xs ${f.color} border-current/30`}>
                      {f.cta} <ExternalLink className="w-3 h-3" />
                    </Button>
                  </Link>
                  <VideoCard label={f.videoLabel} videoId={f.videoId} />
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="mt-4 text-center">
            <p className="text-xs text-muted-foreground">
              💡 الفيديوهات للتوضيح — يتم تحديثها بشكل دوري من فريق سوق للإعلانات
            </p>
          </div>
        </div>

        {/* ── FAQ ─────────────────────────────────────────────── */}
        <div className="mb-14">
          <h2 className="text-2xl font-black mb-2 text-center">أسئلة شائعة</h2>
          <p className="text-muted-foreground text-sm text-center mb-8">إجابات على أكثر الأسئلة المطروحة</p>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <FaqItem key={i} q={faq.q} a={faq.a} />
            ))}
          </div>
        </div>

        {/* ── Tips ─────────────────────────────────────────────── */}
        <div className="mb-14 bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-6 border border-amber-200 dark:border-amber-800">
          <h2 className="text-lg font-black mb-4 flex items-center gap-2">
            💡 نصائح للمبتدئين
          </h2>
          <ul className="space-y-3">
            {[
              "أضف صوراً واضحة وعالية الجودة — الإعلانات ذات الصور تحصل على 5 أضعاف المشاهدات.",
              "اكتب وصفاً تفصيلياً بالسعر والمكان والتواصل — المستخدمون يريدون كل المعلومات.",
              "شارك إعلانك على واتساب وفيسبوك لزيادة الوصول.",
              "فعّل إشعارات المنصة لتلقّي تنبيهات فورية عند التفاعل مع إعلانك.",
              "حدّث إعلانك بانتظام ليظهر في أعلى النتائج.",
            ].map((tip, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <CheckCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <span className="text-amber-900 dark:text-amber-100">{tip}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* ── Support CTA ──────────────────────────────────────── */}
        <div className="rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10 border border-primary/20 p-8 text-center">
          <h2 className="text-2xl font-black mb-2">محتاج مساعدة أكتر؟</h2>
          <p className="text-muted-foreground text-sm mb-6 max-w-md mx-auto">
            فريق الدعم متاح يومياً من الساعة 9 صباحاً حتى 11 مساءً للإجابة على أسئلتك.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <a
              href="https://wa.me/201098559311?text=مرحباً، أحتاج مساعدة في استخدام منصة سوق للإعلانات"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="btn-whatsapp-support"
            >
              <Button className="gap-2 bg-green-600 hover:bg-green-700 text-white h-11 px-6">
                <MessageSquare className="w-4 h-4" />
                واتساب الدعم
              </Button>
            </a>
            <a href="mailto:souqmarkat66@gmail.com" data-testid="btn-email-support">
              <Button variant="outline" className="gap-2 h-11 px-6">
                <Mail className="w-4 h-4" />
                souqmarkat66@gmail.com
              </Button>
            </a>
          </div>
          <div className="mt-6 pt-6 border-t border-border/40">
            <p className="text-sm text-muted-foreground mb-3">لم تسجّل بعد؟</p>
            <Link href="/login">
              <Button size="lg" className="gap-2 shadow-lg shadow-primary/20">
                <LogIn className="w-5 h-5" /> ابدأ مجاناً الآن
              </Button>
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
