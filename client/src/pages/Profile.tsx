import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AdCard } from "@/components/AdCard";
import { MessageCircle, LayoutGrid, Eye, Heart, Tv, Star, Shield, AlertTriangle, Sparkles } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

const ALL_INTERESTS = [
  { id: "tech", label: "تقنية وإلكترونيات", emoji: "📱" },
  { id: "fashion", label: "ملابس وأزياء", emoji: "👗" },
  { id: "food", label: "طعام ومطاعم", emoji: "🍕" },
  { id: "real_estate", label: "عقارات", emoji: "🏠" },
  { id: "cars", label: "سيارات", emoji: "🚗" },
  { id: "health", label: "صحة وجمال", emoji: "💊" },
  { id: "education", label: "تعليم ودورات", emoji: "📚" },
  { id: "travel", label: "سياحة وسفر", emoji: "✈️" },
  { id: "sports", label: "رياضة ولياقة", emoji: "⚽" },
  { id: "finance", label: "مال وأعمال", emoji: "💰" },
  { id: "kids", label: "أطفال وعائلة", emoji: "👶" },
  { id: "gaming", label: "ألعاب ترفيه", emoji: "🎮" },
];

export default function Profile() {
  const [, params] = useRoute("/profile/:userId");
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);

  const targetUserId = params?.userId || user?.id;
  const isOwn = user?.id === targetUserId;

  const { data: profile, isLoading } = useQuery<any>({
    queryKey: ["/api/profile", targetUserId],
    queryFn: () => fetch(`/api/profile/${targetUserId}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!targetUserId,
  });

  useEffect(() => {
    if (profile?.user?.interests && isOwn) {
      setSelectedInterests(profile.user.interests.split(",").filter(Boolean));
    }
  }, [profile?.user?.interests, isOwn]);

  const interestsMutation = useMutation({
    mutationFn: (interests: string[]) => apiRequest("PATCH", "/api/auth/me/interests", { interests }),
    onSuccess: () => {
      toast({ title: "✅ تم حفظ اهتماماتك" });
      qc.invalidateQueries({ queryKey: ["/api/profile", targetUserId] });
    },
  });

  const { data: userAds = [] } = useQuery<any[]>({
    queryKey: ["/api/profile", targetUserId, "ads"],
    queryFn: () => fetch(`/api/profile/${targetUserId}/ads`, { credentials: "include" }).then(r => r.json()),
    enabled: !!targetUserId,
  });

  const reportMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/fraud/report", {
      targetType: "user",
      targetId: 0,
      reason: reportReason,
    }),
    onSuccess: () => {
      setReportOpen(false);
      toast({ title: "✅ تم إرسال البلاغ للإدارة" });
    },
  });

  const startChat = () => {
    if (!user) { setLocation("/login"); return; }
    setLocation(`/messages?with=${targetUserId}`);
  };

  if (isLoading) return (
    <div className="container px-4 py-12 max-w-4xl" dir="rtl">
      <Skeleton className="h-36 rounded-3xl mb-6" />
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-2 gap-4">
        {[1,2,3,4].map(i => <Skeleton key={i} className="aspect-[4/3] rounded-2xl" />)}
      </div>
    </div>
  );

  if (!profile || profile.message) return (
    <div className="container px-4 py-20 text-center" dir="rtl">
      <p className="text-muted-foreground">المستخدم غير موجود</p>
      <Button variant="link" onClick={() => setLocation("/")}>الرئيسية</Button>
    </div>
  );

  const { user: profileUser, stats, channel } = profile;
  const fullName = `${profileUser.first_name || ""} ${profileUser.last_name || ""}`.trim() || "مستخدم";

  return (
    <div className="container px-4 py-10 max-w-4xl" dir="rtl">

      {/* Profile Card */}
      <div className="bg-gradient-to-br from-primary/10 via-background to-secondary/5 border border-border/60 rounded-3xl p-6 mb-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-3xl font-bold flex-shrink-0 shadow-lg">
            {profileUser.profile_image_url ? (
              <img src={profileUser.profile_image_url} alt={fullName} className="w-full h-full rounded-full object-cover" />
            ) : (
              (fullName[0] || "م")
            )}
          </div>

          {/* Info */}
          <div className="flex-1 text-center sm:text-right">
            <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
              <h1 className="text-2xl font-black">{fullName}</h1>
              {channel?.is_verified && (
                <Badge className="bg-blue-500 text-white gap-1 text-xs">
                  <Shield className="w-3 h-3" /> موثّق
                </Badge>
              )}
            </div>
            {profileUser.created_at && (
              <p className="text-xs text-muted-foreground mb-3">
                عضو منذ {format(new Date(profileUser.created_at), "MMMM yyyy", { locale: ar })}
              </p>
            )}
            <div className="flex gap-2 justify-center sm:justify-start flex-wrap">
              {channel && (
                <a href={`/channels/${channel.id}`}>
                  <Badge variant="outline" className="gap-1.5 cursor-pointer hover:bg-primary/5">
                    <Tv className="w-3 h-3 text-purple-500" /> {channel.name}
                  </Badge>
                </a>
              )}
              {channel?.is_monetized && (
                <Badge className="bg-yellow-500/10 text-yellow-700 border-yellow-500/30 gap-1">
                  <Star className="w-3 h-3" /> ناشر مُربَّح
                </Badge>
              )}
            </div>
          </div>

          {/* Actions */}
          {!isOwn && user && (
            <div className="flex gap-2 flex-shrink-0">
              <Button size="sm" className="gap-2" onClick={startChat} data-testid="btn-start-chat">
                <MessageCircle className="w-4 h-4" /> راسله
              </Button>
              <Button
                size="sm" variant="outline"
                className="gap-2 border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                onClick={() => setReportOpen(true)}
                data-testid="btn-report-user"
              >
                <AlertTriangle className="w-3 h-3" /> بلاغ
              </Button>
            </div>
          )}
          {isOwn && (
            <Button size="sm" variant="outline" onClick={() => setLocation("/my-content")}>
              إدارة محتواي
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { icon: LayoutGrid, label: "الإعلانات", value: stats?.count || 0, color: "text-primary" },
          { icon: Eye, label: "المشاهدات", value: Number(stats?.views || 0).toLocaleString("ar-EG"), color: "text-blue-500" },
          { icon: Heart, label: "الإعجابات", value: Number(stats?.likes || 0).toLocaleString("ar-EG"), color: "text-red-500" },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-card border border-border/60 rounded-2xl p-4 text-center">
            <Icon className={`w-5 h-5 mx-auto mb-2 ${color}`} />
            <p className="text-2xl font-black">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Interests Section — only for profile owner */}
      {isOwn && (
        <div className="bg-card border border-border/60 rounded-2xl p-5 mb-6" dir="rtl">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-primary" />
            <h2 className="font-bold text-sm">اهتماماتك — يُستخدم لتخصيص الإعلانات التي تصلك</h2>
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {ALL_INTERESTS.map(({ id, label, emoji }) => {
              const active = selectedInterests.includes(id);
              return (
                <button
                  key={id}
                  data-testid={`interest-${id}`}
                  onClick={() => setSelectedInterests(prev =>
                    active ? prev.filter(i => i !== id) : [...prev, id]
                  )}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all
                    ${active
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-background text-muted-foreground border-border/60 hover:border-primary/40"
                    }`}
                >
                  <span>{emoji}</span> {label}
                </button>
              );
            })}
          </div>
          <Button
            size="sm"
            className="gap-2"
            onClick={() => interestsMutation.mutate(selectedInterests)}
            disabled={interestsMutation.isPending}
            data-testid="btn-save-interests"
          >
            {interestsMutation.isPending ? "جاري الحفظ..." : "حفظ الاهتمامات"}
          </Button>
        </div>
      )}

      {/* Ads Grid */}
      <div className="mb-4 flex items-center gap-2">
        <LayoutGrid className="w-4 h-4 text-primary" />
        <h2 className="font-bold">إعلانات {isOwn ? "أنشأتها" : fullName}</h2>
        <Badge variant="secondary">{userAds.length}</Badge>
      </div>

      {userAds.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p>لا توجد إعلانات منشورة بعد</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {userAds.map((ad: any, i: number) => (
            <AdCard key={ad.id} ad={ad} index={i} />
          ))}
        </div>
      )}

      {/* Report Dialog */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" /> بلاغ عن مستخدم
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-yellow-50 dark:bg-yellow-950/20 rounded-xl p-3">
              <p className="text-sm text-yellow-700 dark:text-yellow-400">
                البلاغات الكاذبة تُعرّضك للتعليق. استخدم هذه الميزة بمسؤولية.
              </p>
            </div>
            <div>
              <label className="text-sm font-medium block mb-2">سبب البلاغ</label>
              <Textarea
                value={reportReason}
                onChange={e => setReportReason(e.target.value)}
                placeholder="اشرح سبب البلاغ بالتفصيل..."
                className="min-h-[100px]"
              />
            </div>
            <Button
              className="w-full gap-2 bg-red-500 hover:bg-red-600 text-white"
              onClick={() => reportMutation.mutate()}
              disabled={!reportReason.trim() || reportMutation.isPending}
            >
              إرسال البلاغ
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
