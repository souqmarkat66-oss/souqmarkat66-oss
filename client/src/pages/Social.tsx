import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Gift, Share2, Copy, Check, Users, Cake, Clock, Heart, Image,
  Video, Briefcase, MapPin, Smile, Calendar, Star, Send, MessageCircle,
  ChevronRight, PartyPopper, Sparkles, Trophy
} from "lucide-react";
import { useLocation } from "wouter";

const ARABIC_MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const RELATIONSHIP_OPTIONS = [
  { value: "", label: "اختياري" },
  { value: "single", label: "أعزب/ة 💁" },
  { value: "married", label: "متزوج/ة 💍" },
  { value: "engaged", label: "مخطوب/ة 💑" },
  { value: "complicated", label: "معقدة 🤷" },
];

function formatBirthday(birthday: string | null) {
  if (!birthday) return null;
  const d = new Date(birthday);
  return `${d.getDate()} ${ARABIC_MONTHS[d.getMonth()]}`;
}

function daysUntilBirthday(birthday: string) {
  const today = new Date();
  const b = new Date(birthday);
  const next = new Date(today.getFullYear(), b.getMonth(), b.getDate());
  if (next < today) next.setFullYear(today.getFullYear() + 1);
  const diff = Math.round((next.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "اليوم 🎂";
  if (diff === 1) return "غداً";
  return `بعد ${diff} يوم`;
}

export default function Social() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();

  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"invite"|"memories"|"birthdays"|"profile">("invite");

  // Social profile edit states
  const [birthday, setBirthday] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [city, setCity] = useState("");
  const [relationship, setRelationship] = useState("");
  const [savedProfile, setSavedProfile] = useState(false);

  const { data: referralData } = useQuery<any>({
    queryKey: ["/api/auth/me/referral"],
    queryFn: () => fetch("/api/auth/me/referral", { credentials: "include" }).then(r => r.json()),
    enabled: !!user,
  });

  const { data: inviteData } = useQuery<any>({
    queryKey: ["/api/social/invite-link"],
    queryFn: () => fetch("/api/social/invite-link", { credentials: "include" }).then(r => r.json()),
    enabled: !!user,
  });

  const { data: memories } = useQuery<any>({
    queryKey: ["/api/social/memories"],
    queryFn: () => fetch("/api/social/memories", { credentials: "include" }).then(r => r.json()),
    enabled: !!user && activeTab === "memories",
  });

  const { data: birthdays } = useQuery<any>({
    queryKey: ["/api/social/birthdays"],
    queryFn: () => fetch("/api/social/birthdays", { credentials: "include" }).then(r => r.json()),
    enabled: !!user && activeTab === "birthdays",
  });

  const { data: myProfile } = useQuery<any>({
    queryKey: ["/api/profile", user?.id],
    queryFn: () => fetch(`/api/profile/${user?.id}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!user,
  });

  useEffect(() => {
    if (myProfile?.user) {
      setBirthday(myProfile.user.birthday?.split("T")[0] || "");
      setJobTitle(myProfile.user.job_title || "");
      setCompany(myProfile.user.company || "");
      setCity(myProfile.user.city || myProfile.user.governorate || "");
      setRelationship(myProfile.user.relationship_status || "");
    }
  }, [myProfile?.user]);

  const socialMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", "/api/auth/me/social", { birthday, jobTitle, company, city, relationshipStatus: relationship }),
    onSuccess: () => {
      toast({ title: "✅ تم حفظ معلوماتك الاجتماعية" });
      qc.invalidateQueries({ queryKey: ["/api/profile", user?.id] });
      setSavedProfile(true);
      setTimeout(() => setSavedProfile(false), 3000);
    },
    onError: () => toast({ title: "❌ فشل الحفظ", variant: "destructive" }),
  });

  const copyInvite = () => {
    if (!inviteData?.copyText) return;
    navigator.clipboard.writeText(inviteData.copyText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
      toast({ title: "✅ تم نسخ رسالة الدعوة!" });
    });
  };

  const today = new Date();
  const todayStr = `${today.getDate()} ${ARABIC_MONTHS[today.getMonth()]} ${today.getFullYear()}`;

  const TABS = [
    { id: "invite", label: "ادعُ أصدقاء", icon: Gift },
    { id: "memories", label: "ذكرياتي", icon: Clock },
    { id: "birthdays", label: "أعياد الميلاد", icon: Cake },
    { id: "profile", label: "ملفي الاجتماعي", icon: Smile },
  ] as const;

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center" dir="rtl">
        <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-30" />
        <h2 className="text-xl font-bold mb-2">سجّل دخولك أولاً</h2>
        <p className="text-muted-foreground text-sm mb-6">لازم تكون مسجّل عشان تستخدم الميزات الاجتماعية</p>
        <Button onClick={() => setLocation("/login")}>تسجيل الدخول</Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
          <Users className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold">الميزات الاجتماعية</h1>
          <p className="text-xs text-muted-foreground">ادعُ أصدقاءك، ذكرياتك، وأعياد الميلاد</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all flex-shrink-0 ${
                isActive ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
              data-testid={`tab-social-${tab.id}`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── TAB: Invite Friends ── */}
      {activeTab === "invite" && (
        <div className="space-y-4">
          {/* Referral Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="border rounded-2xl p-4 text-center bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800">
              <Trophy className="w-6 h-6 text-green-600 mx-auto mb-1" />
              <div className="text-2xl font-extrabold text-green-700 dark:text-green-400">
                {referralData?.stats?.count || 0}
              </div>
              <div className="text-xs text-green-600 dark:text-green-500">أصدقاء انضموا</div>
            </div>
            <div className="border rounded-2xl p-4 text-center bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-950/20 dark:to-amber-950/20 border-yellow-200 dark:border-yellow-800">
              <Gift className="w-6 h-6 text-yellow-600 mx-auto mb-1" />
              <div className="text-2xl font-extrabold text-yellow-700 dark:text-yellow-400">
                {referralData?.stats?.earned || 0} ج.م
              </div>
              <div className="text-xs text-yellow-600 dark:text-yellow-500">مكافآت كسبتها</div>
            </div>
          </div>

          {/* Referral Code Card */}
          <div className="border rounded-2xl p-5 bg-gradient-to-br from-primary/5 to-purple-500/5 border-primary/20">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-primary" />
              <h3 className="font-extrabold text-base">كود الإحالة الخاص بك</h3>
            </div>
            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1 bg-background border border-primary/30 rounded-xl px-4 py-3 font-mono text-xl font-extrabold text-primary text-center tracking-widest">
                {referralData?.code || "—"}
              </div>
              <button
                onClick={copyInvite}
                className="w-12 h-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-all"
                data-testid="btn-copy-invite"
              >
                {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              كل صديق يسجّل بكودك → أنت وهو تاخدوا مكافأة 🎁
            </p>
          </div>

          {/* Share Buttons */}
          <div className="space-y-2">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <Share2 className="w-4 h-4" />
              شارك عبر
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <a
                href={inviteData?.whatsappLink || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-3 rounded-xl bg-green-500 text-white font-bold text-sm hover:bg-green-600 transition-all"
                data-testid="btn-share-whatsapp"
              >
                <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                واتساب
              </a>
              <a
                href={inviteData?.telegramLink || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-500 text-white font-bold text-sm hover:bg-blue-600 transition-all"
                data-testid="btn-share-telegram"
              >
                <Send className="w-5 h-5" />
                تيليجرام
              </a>
              <button
                onClick={copyInvite}
                className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-primary/40 text-primary font-bold text-sm hover:bg-primary/5 transition-all col-span-2"
                data-testid="btn-copy-message"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? "تم النسخ!" : "نسخ رسالة الدعوة كاملة"}
              </button>
            </div>
          </div>

          {/* How it works */}
          <div className="border rounded-2xl p-4 bg-muted/20">
            <h3 className="font-bold text-sm mb-3">كيف يعمل نظام الإحالة؟</h3>
            <div className="space-y-2.5">
              {[
                { step: "1", text: "شارك كودك مع أصدقائك", icon: "📤" },
                { step: "2", text: "صديقك يسجّل باستخدام كودك", icon: "👤" },
                { step: "3", text: "انتوا الاتنين بتاخدوا مكافأة ج.م", icon: "🎁" },
                { step: "4", text: "المكافأة تضاف لرصيدك تلقائياً", icon: "✅" },
              ].map(item => (
                <div key={item.step} className="flex items-center gap-3">
                  <span className="text-lg">{item.icon}</span>
                  <span className="text-sm">{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: Memories ── */}
      {activeTab === "memories" && (
        <div className="space-y-4">
          {/* Today's date header */}
          <div className="border rounded-2xl p-4 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 border-purple-200 dark:border-purple-800">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-5 h-5 text-purple-600" />
              <h3 className="font-extrabold text-base text-purple-700 dark:text-purple-400">في هذا اليوم</h3>
            </div>
            <p className="text-sm text-purple-600 dark:text-purple-500">{todayStr} — ذكريات من السنوات الماضية</p>
          </div>

          {!memories && (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-24 rounded-2xl bg-muted animate-pulse" />)}
            </div>
          )}

          {memories && (memories.ads?.length === 0 && memories.reels?.length === 0) && (
            <div className="text-center py-16">
              <Clock className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
              <h3 className="font-bold text-base mb-1">لا توجد ذكريات اليوم</h3>
              <p className="text-sm text-muted-foreground">لما تنشر إعلانات وريلز، هتظهر هنا كل سنة في نفس اليوم</p>
            </div>
          )}

          {/* Memory ads */}
          {memories?.ads?.map((ad: any) => {
            const year = new Date(ad.created_at).getFullYear();
            const yearsAgo = today.getFullYear() - year;
            return (
              <div key={`ad-${ad.id}`} className="border rounded-2xl overflow-hidden hover:shadow-md transition-shadow cursor-pointer" onClick={() => setLocation(`/ads/${ad.id}`)}>
                <div className="flex items-center gap-2 px-4 py-2 bg-purple-50 dark:bg-purple-950/30 border-b border-purple-100 dark:border-purple-900">
                  <PartyPopper className="w-4 h-4 text-purple-500" />
                  <span className="text-xs font-bold text-purple-600 dark:text-purple-400">
                    قبل {yearsAgo} {yearsAgo === 1 ? "سنة" : "سنوات"}
                  </span>
                </div>
                <div className="flex gap-3 p-3">
                  {ad.media_url && (
                    <img src={ad.media_url} alt={ad.title} className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 mb-0.5">
                      <Image className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">إعلان</span>
                    </div>
                    <p className="font-bold text-sm leading-tight line-clamp-1">{ad.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{ad.description}</p>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Memory reels */}
          {memories?.reels?.map((reel: any) => {
            const year = new Date(reel.created_at).getFullYear();
            const yearsAgo = today.getFullYear() - year;
            return (
              <div key={`reel-${reel.id}`} className="border rounded-2xl overflow-hidden hover:shadow-md transition-shadow cursor-pointer" onClick={() => setLocation("/reels")}>
                <div className="flex items-center gap-2 px-4 py-2 bg-pink-50 dark:bg-pink-950/30 border-b border-pink-100 dark:border-pink-900">
                  <PartyPopper className="w-4 h-4 text-pink-500" />
                  <span className="text-xs font-bold text-pink-600 dark:text-pink-400">
                    قبل {yearsAgo} {yearsAgo === 1 ? "سنة" : "سنوات"}
                  </span>
                </div>
                <div className="flex gap-3 p-3">
                  {(reel.thumbnail_url || reel.video_url) && (
                    <img src={reel.thumbnail_url || reel.video_url} alt={reel.title} className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 mb-0.5">
                      <Video className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">ريلز</span>
                    </div>
                    <p className="font-bold text-sm leading-tight line-clamp-1">{reel.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{reel.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── TAB: Birthdays ── */}
      {activeTab === "birthdays" && (
        <div className="space-y-4">
          {/* Today's Birthdays */}
          {birthdays?.today?.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Cake className="w-5 h-5 text-pink-500" />
                <h3 className="font-extrabold">🎂 أعياد ميلاد اليوم!</h3>
              </div>
              <div className="space-y-2">
                {birthdays.today.map((u: any) => (
                  <div key={u.id} className="flex items-center gap-3 p-3 rounded-2xl bg-gradient-to-l from-pink-50 to-red-50 dark:from-pink-950/20 dark:to-red-950/20 border border-pink-200 dark:border-pink-900 cursor-pointer hover:shadow-sm transition-shadow" onClick={() => setLocation(`/profile/${u.id}`)}>
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-pink-400 to-red-400 flex items-center justify-center flex-shrink-0">
                      {u.profile_image_url ? (
                        <img src={u.profile_image_url} alt="avatar" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xl text-white font-bold">{(u.first_name || "?")[0]}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm">{u.first_name} {u.last_name}</p>
                      <p className="text-xs text-pink-600 font-bold">🎉 عيد ميلاد سعيد!</p>
                    </div>
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(`🎂 عيد ميلاد سعيد ${u.first_name}! 🎉`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-xl bg-green-500 text-white font-bold hover:bg-green-600 transition-all"
                      data-testid={`btn-wish-birthday-${u.id}`}
                    >
                      <svg className="w-3.5 h-3.5 fill-white" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      تهنئة
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-5 h-5 text-blue-500" />
              <h3 className="font-bold">أعياد ميلاد قادمة</h3>
            </div>

            {!birthdays && (
              <div className="space-y-2">
                {[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}
              </div>
            )}

            {birthdays && birthdays.upcoming?.length === 0 && birthdays.today?.length === 0 && (
              <div className="text-center py-12">
                <Cake className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
                <h3 className="font-bold mb-1">لا توجد أعياد ميلاد قريبة</h3>
                <p className="text-sm text-muted-foreground">اشترك في قنوات أصدقائك وهيظهروا هنا لما يضيفوا تاريخ ميلادهم</p>
              </div>
            )}

            <div className="space-y-2">
              {birthdays?.upcoming?.map((u: any) => (
                <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl border hover:bg-muted/10 transition-colors cursor-pointer" onClick={() => setLocation(`/profile/${u.id}`)}>
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-blue-400 to-purple-400 flex items-center justify-center flex-shrink-0">
                    {u.profile_image_url ? (
                      <img src={u.profile_image_url} alt="avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-base text-white font-bold">{(u.first_name || "?")[0]}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm">{u.first_name} {u.last_name}</p>
                    <p className="text-xs text-muted-foreground">{formatBirthday(u.birthday)}</p>
                  </div>
                  <Badge variant="secondary" className="text-[10px] font-bold shrink-0">
                    {daysUntilBirthday(u.birthday)}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Add your birthday hint */}
          {!myProfile?.user?.birthday && (
            <div className="border-2 border-dashed border-primary/30 rounded-2xl p-4 text-center">
              <Cake className="w-8 h-8 mx-auto mb-2 text-primary/50" />
              <p className="text-sm font-bold mb-1">لم تُضف تاريخ ميلادك بعد</p>
              <p className="text-xs text-muted-foreground mb-3">أضفه حتى يتذكرك أصدقاؤك</p>
              <Button size="sm" variant="outline" onClick={() => setActiveTab("profile")}>
                إضافة تاريخ الميلاد
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Social Profile ── */}
      {activeTab === "profile" && (
        <div className="space-y-4">
          <div className="border rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Smile className="w-5 h-5 text-primary" />
              <h3 className="font-extrabold text-base">معلوماتك الاجتماعية</h3>
            </div>
            <p className="text-xs text-muted-foreground -mt-2">تظهر على بروفايلك وتساعد الآخرين يتعرفوا عليك</p>

            {/* Birthday */}
            <div className="space-y-1">
              <label className="text-xs font-bold flex items-center gap-1">
                <Cake className="w-3.5 h-3.5 text-pink-500" />
                تاريخ الميلاد
              </label>
              <Input
                type="date"
                value={birthday}
                onChange={e => setBirthday(e.target.value)}
                className="text-sm h-9"
                data-testid="input-birthday"
              />
              {birthday && (
                <p className="text-[10px] text-muted-foreground">سيظهر كـ: {formatBirthday(birthday)}</p>
              )}
            </div>

            {/* Job Title */}
            <div className="space-y-1">
              <label className="text-xs font-bold flex items-center gap-1">
                <Briefcase className="w-3.5 h-3.5 text-blue-500" />
                المسمى الوظيفي
              </label>
              <Input
                placeholder="مثال: مدير تسويق، مبرمج، طالب..."
                value={jobTitle}
                onChange={e => setJobTitle(e.target.value)}
                className="text-sm h-9"
                data-testid="input-job-title"
                maxLength={80}
              />
            </div>

            {/* Company */}
            <div className="space-y-1">
              <label className="text-xs font-bold flex items-center gap-1">
                <Star className="w-3.5 h-3.5 text-yellow-500" />
                الشركة / المؤسسة
              </label>
              <Input
                placeholder="اسم الشركة أو العمل"
                value={company}
                onChange={e => setCompany(e.target.value)}
                className="text-sm h-9"
                data-testid="input-company"
                maxLength={80}
              />
            </div>

            {/* City */}
            <div className="space-y-1">
              <label className="text-xs font-bold flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-red-500" />
                المدينة / المحافظة
              </label>
              <Input
                placeholder="مثال: القاهرة، الإسكندرية..."
                value={city}
                onChange={e => setCity(e.target.value)}
                className="text-sm h-9"
                data-testid="input-city"
                maxLength={60}
              />
            </div>

            {/* Relationship Status */}
            <div className="space-y-1">
              <label className="text-xs font-bold flex items-center gap-1">
                <Heart className="w-3.5 h-3.5 text-red-500" />
                الحالة الاجتماعية (اختياري)
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {RELATIONSHIP_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setRelationship(opt.value)}
                    className={`text-xs py-2 px-3 rounded-xl border font-medium transition-all ${
                      relationship === opt.value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border hover:border-primary/40 hover:bg-primary/5"
                    }`}
                    data-testid={`btn-relationship-${opt.value}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <Button
              className="w-full"
              onClick={() => socialMutation.mutate()}
              disabled={socialMutation.isPending}
              data-testid="btn-save-social"
            >
              {savedProfile ? "✅ تم الحفظ!" : socialMutation.isPending ? "جاري الحفظ..." : "💾 حفظ المعلومات"}
            </Button>
          </div>

          {/* Preview card */}
          {(birthday || jobTitle || company || city) && (
            <div className="border rounded-2xl p-4 bg-muted/20">
              <p className="text-xs font-bold mb-3 text-muted-foreground">معاينة بروفايلك</p>
              <div className="space-y-1.5">
                {birthday && (
                  <div className="flex items-center gap-2 text-sm">
                    <Cake className="w-4 h-4 text-pink-500" />
                    <span>{formatBirthday(birthday)}</span>
                  </div>
                )}
                {jobTitle && (
                  <div className="flex items-center gap-2 text-sm">
                    <Briefcase className="w-4 h-4 text-blue-500" />
                    <span>{jobTitle}{company ? ` في ${company}` : ""}</span>
                  </div>
                )}
                {city && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-red-500" />
                    <span>{city}</span>
                  </div>
                )}
                {relationship && (
                  <div className="flex items-center gap-2 text-sm">
                    <Heart className="w-4 h-4 text-red-500" />
                    <span>{RELATIONSHIP_OPTIONS.find(r => r.value === relationship)?.label}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
