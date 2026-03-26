import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Copy, Check, Code2, Globe, Tv, Radio, Smartphone, ChevronDown, ChevronUp } from "lucide-react";

/* ─── Copy Button ─────────────────────────────────────────── */
function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const handle = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast({ title: "✅ تم النسخ!" });
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handle}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all"
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "تم النسخ" : "نسخ"}
    </button>
  );
}

/* ─── Code Block ──────────────────────────────────────────── */
function CodeBlock({ code, lang = "html" }: { code: string; lang?: string }) {
  return (
    <div className="rounded-xl overflow-hidden border border-border/50 mt-3">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900">
        <span className="text-xs text-gray-400 font-mono">{lang}</span>
        <CopyBtn text={code} />
      </div>
      <pre className="bg-gray-950 text-green-400 text-xs font-mono p-4 overflow-x-auto whitespace-pre-wrap leading-relaxed">
        {code}
      </pre>
    </div>
  );
}

/* ─── Accordion Step ──────────────────────────────────────── */
function Step({
  num, icon, title, desc, children
}: { num: number; icon: React.ReactNode; title: string; desc: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border/60 rounded-2xl overflow-hidden hover:border-primary/40 transition-all">
      <button
        className="w-full flex items-center gap-4 p-5 text-right hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 text-lg font-bold">
          {num}
        </div>
        <div className="flex items-center gap-3 flex-1">
          <div className="text-primary">{icon}</div>
          <div className="text-right">
            <p className="font-bold text-sm">{title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
      </button>
      {open && <div className="px-5 pb-5 border-t border-border/40 pt-4 bg-muted/10">{children}</div>}
    </div>
  );
}

export default function EmbedGuide() {
  const { user } = useAuth();
  const { data: campaigns = [] } = useQuery<any[]>({
    queryKey: ["/api/campaigns"],
    queryFn: () => fetch("/api/campaigns", { credentials: "include" }).then(r => r.json()),
    enabled: !!user,
  });

  const activeCampaigns = campaigns.filter((c: any) => c.status === "active");
  const firstCampaign = activeCampaigns[0];
  const embedCode = firstCampaign?.embedCode || `<script src="https://souqads.net/api/campaigns/embed.js?id=YOUR_ID&key=YOUR_KEY" async></script>`;
  const campaignId = firstCampaign?.id || "YOUR_ID";

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Hero */}
      <div className="bg-gradient-to-br from-primary/20 via-background to-secondary/10 border-b border-border/40">
        <div className="container px-4 py-14 text-center">
          <Badge className="mb-4 gap-2 text-sm px-4 py-1.5">
            <Code2 className="w-4 h-4" /> دليل التضمين
          </Badge>
          <h1 className="text-3xl md:text-4xl font-black mb-3">كيف تربط الإعلانات بمنصتك؟</h1>
          <p className="text-muted-foreground text-base max-w-xl mx-auto">
            خطوات بسيطة لإضافة إعلانات شبكة سوق في أي موقع، قناة، بث مباشر، أو تطبيق موبايل — وابدأ في كسب المال فوراً.
          </p>
          {activeCampaigns.length > 0 && (
            <div className="mt-4 inline-flex items-center gap-2 bg-green-500/10 text-green-700 dark:text-green-400 rounded-full px-4 py-2 text-sm font-bold border border-green-500/20">
              🟢 لديك {activeCampaigns.length} حملة نشطة جاهزة للتضمين
            </div>
          )}
        </div>
      </div>

      <div className="container px-4 py-12 max-w-3xl">

        {/* ── Section: Website ─────────────────────────────────── */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black">الموقع الإلكتروني</h2>
              <p className="text-xs text-muted-foreground">HTML / WordPress / أي موقع ويب</p>
            </div>
          </div>
          <div className="space-y-3">
            <Step num={1} icon={<Copy className="w-4 h-4" />} title="انسخ كود التضمين" desc="سكريبت يُولَّد إعلانات تلقائياً في الصفحة">
              <p className="text-sm text-muted-foreground mb-2">ضع هذا الكود قبل <code className="bg-muted px-1 rounded">{"</body>"}</code> في صفحة HTML الخاصة بك:</p>
              <CodeBlock code={embedCode} lang="html" />
              {!user && <p className="text-xs text-amber-600 mt-2">⚠ سجّل دخولك لرؤية كودك الشخصي</p>}
            </Step>
            <Step num={2} icon={<Code2 className="w-4 h-4" />} title="أضف حاوية الإعلان (اختياري)" desc="تحكم في مكان ظهور الإعلان">
              <CodeBlock code={`<!-- حاوية الإعلان -->
<div id="souq-ad-container" style="max-width:728px; margin:0 auto;">
  <!-- الإعلان يظهر هنا تلقائياً -->
</div>

${embedCode}`} lang="html" />
            </Step>
            <Step num={3} icon={<Check className="w-4 h-4" />} title="تتبع النقرات والظهورات" desc="راقب أداء الإعلان في لوحة التحكم">
              <CodeBlock code={`<!-- بكسل تتبع الظهور (ضعه عند تحميل الصفحة) -->
<img src="/api/campaigns/${campaignId}/impression" width="1" height="1" style="display:none" />

<!-- بكسل تتبع النقر (ضعه على زر الإجراء) -->
<a href="/api/campaigns/${campaignId}/click?redirect=YOUR_URL">
  اعرف أكثر
</a>`} lang="html" />
            </Step>
          </div>
        </div>

        {/* ── Section: Channel ─────────────────────────────────── */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
              <Tv className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black">القنوات</h2>
              <p className="text-xs text-muted-foreground">قنوات شبكة سوق — تضمين تلقائي</p>
            </div>
          </div>
          <div className="space-y-3">
            <Step num={1} icon={<Tv className="w-4 h-4" />} title="أنشئ قناتك" desc="إذا لم يكن لديك قناة بعد">
              <p className="text-sm text-muted-foreground">اذهب إلى <a href="/channels" className="text-primary font-bold underline">صفحة القنوات</a> وأنشئ قناتك. الإعلانات ستظهر تلقائياً في صفحة قناتك لزوارك.</p>
            </Step>
            <Step num={2} icon={<Code2 className="w-4 h-4" />} title="ربط الإعلانات بالقناة عبر API" desc="للتكامل البرمجي المتقدم">
              <CodeBlock code={`// جلب إعلان عشوائي نشط لعرضه في قناتك
fetch('/api/campaigns/random')
  .then(r => r.json())
  .then(ad => {
    console.log(ad); // { id, name, mediaUrl, targetUrl, ... }
    // اعرض الإعلان في قناتك
  });`} lang="javascript" />
            </Step>
            <Step num={3} icon={<Check className="w-4 h-4" />} title="اطلب التحقق والتربيح" desc="وثّق قناتك لبدء كسب المال">
              <p className="text-sm text-muted-foreground">بعد بناء جمهورك، اذهب إلى <a href="/revenue" className="text-primary font-bold underline">صفحة الإيرادات</a> واطلب تفعيل التربيح. ستحصل على <strong>60%</strong> من إيراد كل إعلان يُعرَض على قناتك.</p>
            </Step>
          </div>
        </div>

        {/* ── Section: Live Stream ─────────────────────────────── */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-600 flex items-center justify-center">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black">البث المباشر</h2>
              <p className="text-xs text-muted-foreground">إعلانات داخل بثك المباشر</p>
            </div>
          </div>
          <div className="space-y-3">
            <Step num={1} icon={<Radio className="w-4 h-4" />} title="فعّل عرض الإعلانات في البث" desc="خيار متاح عند إنشاء البث">
              <p className="text-sm text-muted-foreground mb-2">عند إنشاء بث جديد، فعّل خيار <strong>"عرض الإعلانات"</strong>. الإعلانات ستظهر في الشريط الجانبي لكل المشاهدين تلقائياً.</p>
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-3">
                <p className="text-xs text-green-700 dark:text-green-400 font-bold">💡 كل مشاهد = إمكانية أكبر للأرباح! كلما زاد عدد المشاهدين، زادت إيراداتك.</p>
              </div>
            </Step>
            <Step num={2} icon={<Code2 className="w-4 h-4" />} title="تضمين إعلانات في بث خارجي (OBS/RTMP)" desc="للبث من تطبيقات خارجية">
              <CodeBlock code={`// أضف هذا الكود في Browser Source في OBS
// عنوان URL:
https://YOUR_DOMAIN/api/campaigns/overlay?streamId=STREAM_ID&theme=dark

// أو استخدم WebSocket لتحديث الإعلانات تلقائياً
const ws = new WebSocket('wss://YOUR_DOMAIN/ws');
ws.onmessage = (e) => {
  const { type, ad } = JSON.parse(e.data);
  if (type === 'ad_display') showAd(ad);
};`} lang="javascript" />
            </Step>
          </div>
        </div>

        {/* ── Section: Mobile App ──────────────────────────────── */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-600 flex items-center justify-center">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black">تطبيقات الموبايل</h2>
              <p className="text-xs text-muted-foreground">Android / iOS / Flutter / React Native</p>
            </div>
          </div>
          <div className="space-y-3">
            <Step num={1} icon={<Code2 className="w-4 h-4" />} title="جلب الإعلانات عبر REST API" desc="بسيطة وتعمل مع أي تطبيق">
              <CodeBlock code={`// جلب جميع الحملات النشطة
GET https://YOUR_DOMAIN/api/campaigns?status=active

// الرد:
[
  {
    "id": ${campaignId},
    "name": "اسم الحملة",
    "mediaUrl": "/uploads/ad-image.jpg",
    "mediaType": "image",       // image | video
    "targetUrl": "https://...",
    "cpmRateEGP": 15
  }
]`} lang="json" />
            </Step>
            <Step num={2} icon={<Check className="w-4 h-4" />} title="تسجيل الظهورات والنقرات" desc="لضمان احتساب إيراداتك">
              <CodeBlock code={`// عند ظهور الإعلان للمستخدم:
GET /api/campaigns/${campaignId}/impression

// عند نقر المستخدم على الإعلان:
GET /api/campaigns/${campaignId}/click

// Flutter مثال:
void onAdShown(int adId) async {
  await http.get(Uri.parse('/api/campaigns/\$adId/impression'));
}

void onAdTapped(int adId) async {
  await http.get(Uri.parse('/api/campaigns/\$adId/click'));
}`} lang="dart" />
            </Step>
            <Step num={3} icon={<Smartphone className="w-4 h-4" />} title="React Native / Expo" desc="كود جاهز للنسخ">
              <CodeBlock code={`import { useEffect, useState } from 'react';
import { Image, TouchableOpacity, Linking } from 'react-native';

function SouqAd() {
  const [ad, setAd] = useState(null);

  useEffect(() => {
    fetch('https://YOUR_DOMAIN/api/campaigns/random')
      .then(r => r.json())
      .then(data => {
        setAd(data);
        // سجّل الظهور
        fetch('/api/campaigns/' + data.id + '/impression');
      });
  }, []);

  if (!ad) return null;

  return (
    <TouchableOpacity onPress={() => {
      fetch('/api/campaigns/' + ad.id + '/click');
      Linking.openURL(ad.targetUrl);
    }}>
      <Image source={{ uri: ad.mediaUrl }} style={{ width: '100%', height: 80 }} />
    </TouchableOpacity>
  );
}`} lang="jsx" />
            </Step>
          </div>
        </div>

        {/* ── Quick API Reference ──────────────────────────────── */}
        <div className="rounded-2xl border border-border/60 overflow-hidden mb-10">
          <div className="bg-gray-900 px-5 py-4">
            <h3 className="text-white font-black text-base">📖 مرجع API السريع</h3>
          </div>
          <div className="divide-y divide-border/40">
            {[
              { method: "GET", path: "/api/campaigns", desc: "كل الحملات النشطة" },
              { method: "GET", path: `/api/campaigns/${campaignId}`, desc: "تفاصيل حملة محددة" },
              { method: "GET", path: "/api/campaigns/random", desc: "إعلان عشوائي نشط" },
              { method: "GET", path: `/api/campaigns/${campaignId}/impression`, desc: "تسجيل ظهور إعلان" },
              { method: "GET", path: `/api/campaigns/${campaignId}/click`, desc: "تسجيل نقرة على الإعلان" },
            ].map(({ method, path, desc }) => (
              <div key={path} className="flex items-center gap-4 px-5 py-3">
                <Badge variant="outline" className={`text-xs font-mono flex-shrink-0 ${method === "GET" ? "border-green-500/40 text-green-600" : "border-blue-500/40 text-blue-600"}`}>
                  {method}
                </Badge>
                <code className="text-xs font-mono text-primary flex-1 truncate">{path}</code>
                <span className="text-xs text-muted-foreground flex-shrink-0">{desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── CTA ─────────────────────────────────────────────── */}
        <div className="text-center bg-gradient-to-br from-primary/10 to-secondary/10 rounded-2xl p-8 border border-primary/20">
          <p className="text-2xl font-black mb-2">جاهز تبدأ؟</p>
          <p className="text-muted-foreground text-sm mb-5">ابدأ حملتك الأولى الآن وابدأ الربح من جمهورك</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <a href="/campaigns">
              <Button className="gap-2">🚀 إنشاء حملة إعلانية</Button>
            </a>
            <a href="/revenue">
              <Button variant="outline" className="gap-2">💰 عرض إيراداتي</Button>
            </a>
          </div>
        </div>
      </div>

    </div>
  );
}
