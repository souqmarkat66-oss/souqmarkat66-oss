import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AdCard } from "@/components/AdCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MessageCircle, LayoutGrid, Eye, Heart, Tv, Star, Shield, AlertTriangle, Sparkles, Edit2, Camera, Copy, Gift, Check, Users, Cake, Briefcase, MapPin, ExternalLink, ThumbsUp, UserPlus, UserCheck, BarChart3 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

function StarRating({ value, onChange, readonly = false, size = "md" }: {
  value: number; onChange?: (v: number) => void; readonly?: boolean; size?: "sm" | "md" | "lg";
}) {
  const [hover, setHover] = useState(0);
  const sz = size === "sm" ? "w-4 h-4" : size === "lg" ? "w-8 h-8" : "w-6 h-6";
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(n => (
        <button
          key={n}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(n)}
          onMouseEnter={() => !readonly && setHover(n)}
          onMouseLeave={() => setHover(0)}
          className={`transition-transform ${readonly ? "cursor-default" : "hover:scale-125 cursor-pointer"}`}
          data-testid={`star-${n}`}
        >
          <Star className={`${sz} ${(hover || value) >= n ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
        </button>
      ))}
    </div>
  );
}

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editPhoto, setEditPhoto] = useState<File | null>(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState("");
  const [referralInput, setReferralInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [referralStats, setReferralStats] = useState<{ count: string; earned: string } | null>(null);
  const [myRating, setMyRating] = useState(0);
  const [myReview, setMyReview] = useState("");
  const [showRatingForm, setShowRatingForm] = useState(false);
  const [myCoins, setMyCoins] = useState(0);
  const [giftPanelOpen, setGiftPanelOpen] = useState(false);
  const [sentGift, setSentGift] = useState<string | null>(null);

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
    if (profile?.user && isOwn) {
      setEditFirstName(profile.user.first_name || "");
      setEditLastName(profile.user.last_name || "");
      setEditBio(profile.user.bio || "");
    }
  }, [profile?.user, isOwn]);

  const { data: referralData } = useQuery<any>({
    queryKey: ["/api/auth/me/referral"],
    queryFn: () => fetch("/api/auth/me/referral", { credentials: "include" }).then(r => r.json()),
    enabled: !!isOwn && !!user,
  });

  useEffect(() => {
    if (referralData) {
      setReferralCode(referralData.code || "");
      setReferralStats(referralData.stats || null);
    }
  }, [referralData]);

  // Auto-apply pending referral code stored from ?ref=CODE URL param
  useEffect(() => {
    if (!isOwn || !user || !referralData) return;
    const pending = localStorage.getItem("pending_referral_code");
    if (!pending) return;
    localStorage.removeItem("pending_referral_code");
    fetch("/api/auth/me/use-referral", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: pending }),
    }).then(r => r.json()).then(data => {
      if (data.ok) {
        toast({ title: `🎁 تم تطبيق رمز الإحالة! حصلت على ${data.bonus} جنيه مكافأة ترحيبية` });
        qc.invalidateQueries({ queryKey: ["/api/auth/me/referral"] });
      }
    }).catch(() => {});
  }, [isOwn, user, referralData]);

  const { data: userAds = [] } = useQuery<any[]>({
    queryKey: ["/api/profile", targetUserId, "ads"],
    queryFn: () => fetch(`/api/profile/${targetUserId}/ads`, { credentials: "include" }).then(r => r.json()),
    enabled: !!targetUserId,
  });

  const { data: ratingsData } = useQuery<{ ratings: any[]; avg: number; count: number }>({
    queryKey: ["/api/ratings/user", targetUserId],
    queryFn: () => fetch(`/api/ratings/user/${targetUserId}`).then(r => r.json()),
    enabled: !!targetUserId,
  });

  const { data: followData } = useQuery<any>({
    queryKey: ["/api/users", targetUserId, "followers"],
    queryFn: () => fetch(`/api/users/${targetUserId}/followers`).then(r => r.json()),
    enabled: !!targetUserId,
  });

  const { data: isFollowingData } = useQuery<any>({
    queryKey: ["/api/users", targetUserId, "follow"],
    queryFn: () => fetch(`/api/users/${targetUserId}/follow`, { credentials: "include" }).then(r => r.json()),
    enabled: !!targetUserId && !isOwn && !!user,
  });

  const followMutation = useMutation({
    mutationFn: () => fetch(`/api/users/${targetUserId}/follow`, { method: "POST", credentials: "include" }).then(r => r.json()),
    onSuccess: (data: any) => {
      toast({ title: data.following ? "✅ تمت المتابعة" : "تم إلغاء المتابعة" });
      qc.invalidateQueries({ queryKey: ["/api/users", targetUserId, "follow"] });
      qc.invalidateQueries({ queryKey: ["/api/users", targetUserId, "followers"] });
    },
  });

  const { data: myStats } = useQuery<any>({
    queryKey: ["/api/my-stats"],
    queryFn: () => fetch("/api/my-stats", { credentials: "include" }).then(r => r.json()),
    enabled: !!isOwn && !!user,
  });

  const ratingMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/ratings", {
      targetType: "user",
      targetId: String(targetUserId),
      rating: myRating,
      review: myReview || null,
    }),
    onSuccess: () => {
      toast({ title: "✅ تم إرسال تقييمك، شكراً!" });
      setShowRatingForm(false);
      qc.invalidateQueries({ queryKey: ["/api/ratings/user", targetUserId] });
    },
    onError: () => toast({ title: "❌ حدث خطأ أثناء إرسال التقييم", variant: "destructive" }),
  });

  const interestsMutation = useMutation({
    mutationFn: (interests: string[]) => apiRequest("PATCH", "/api/auth/me/interests", { interests }),
    onSuccess: () => {
      toast({ title: "✅ تم حفظ اهتماماتك" });
      qc.invalidateQueries({ queryKey: ["/api/profile", targetUserId] });
    },
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

  const editMutation = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      if (editFirstName) fd.append("firstName", editFirstName);
      if (editLastName) fd.append("lastName", editLastName);
      fd.append("bio", editBio);
      if (editPhoto) fd.append("photo", editPhoto);
      const res = await fetch("/api/auth/me/profile", {
        method: "PATCH",
        credentials: "include",
        body: fd,
      });
      if (!res.ok) throw new Error("فشل التحديث");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "✅ تم تحديث البروفايل" });
      setEditOpen(false);
      setEditPhoto(null);
      setEditPhotoPreview(null);
      qc.invalidateQueries({ queryKey: ["/api/profile", targetUserId] });
      qc.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: (e: any) => toast({ title: "❌ " + e.message, variant: "destructive" }),
  });

  const useReferralMutation = useMutation({
    mutationFn: (code: string) => apiRequest("POST", "/api/auth/me/use-referral", { code }),
    onSuccess: (data: any) => {
      toast({ title: `🎁 تم تفعيل رمز الإحالة! حصلت على ${data.bonus} جنيه مكافأة` });
      setReferralInput("");
      qc.invalidateQueries({ queryKey: ["/api/auth/me/referral"] });
    },
    onError: (e: any) => {
      const msg = e.message?.includes("already_used") ? "استخدمت رمز إحالة من قبل"
        : e.message?.includes("invalid_code") ? "رمز الإحالة غير صحيح"
        : e.message?.includes("self_referral") ? "لا يمكنك استخدام رمزك الخاص"
        : "حدث خطأ";
      toast({ title: "❌ " + msg, variant: "destructive" });
    },
  });

  const PROFILE_GIFTS = [
    { type: "rose",    emoji: "🌹", name: "وردة",      coins: 5   },
    { type: "heart",   emoji: "❤️", name: "قلب",       coins: 10  },
    { type: "clap",    emoji: "👏", name: "تصفيق",     coins: 5   },
    { type: "star",    emoji: "⭐", name: "نجمة",      coins: 20  },
    { type: "fire",    emoji: "🔥", name: "نار",       coins: 30  },
    { type: "crown",   emoji: "👑", name: "تاج",       coins: 50  },
    { type: "rocket",  emoji: "🚀", name: "صاروخ",     coins: 75  },
    { type: "diamond", emoji: "💎", name: "ألماسة",    coins: 100 },
    { type: "trophy",  emoji: "🏆", name: "كأس",       coins: 150 },
    { type: "castle",  emoji: "🏰", name: "قصر",       coins: 500 },
  ];

  // Fetch my coin balance
  useEffect(() => {
    if (!user || isOwn) return;
    fetch("/api/coins/wallet", { credentials: "include" })
      .then(r => r.json())
      .then(d => setMyCoins(d.coins || 0))
      .catch(() => {});
  }, [user, isOwn]);

  const sendProfileGiftMutation = useMutation({
    mutationFn: async (gift: typeof PROFILE_GIFTS[0]) => {
      const res = await apiRequest("POST", "/api/coins/transfer", {
        toUserId: targetUserId,
        coins: gift.coins,
        message: `هدية ${gift.emoji} ${gift.name}`,
      });
      return { ...res, gift };
    },
    onSuccess: (data: any) => {
      setMyCoins(prev => prev - data.gift.coins);
      setSentGift(data.gift.emoji);
      toast({ title: `${data.gift.emoji} تم إرسال ${data.gift.name}!`, description: `خصم ${data.gift.coins} عملة من رصيدك` });
      setTimeout(() => setSentGift(null), 3000);
    },
    onError: (e: any) => toast({ title: "❌ فشل الإرسال — تأكد من رصيدك", variant: "destructive" }),
  });

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditPhoto(file);
    const reader = new FileReader();
    reader.onload = ev => setEditPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const copyReferralLink = () => {
    const link = `${window.location.origin}?ref=${referralCode}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "✅ تم نسخ رابط الإحالة" });
  };

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
      <Button variant="ghost" onClick={() => setLocation("/")}>الرئيسية</Button>
    </div>
  );

  const { user: profileUser, stats, channel } = profile;
  const fullName = `${profileUser.first_name || ""} ${profileUser.last_name || ""}`.trim() || "مستخدم";
  const avatarSrc = editPhotoPreview || profileUser.profile_image_url;

  return (
    <div className="container px-4 py-10 max-w-4xl" dir="rtl">

      {/* Profile Card */}
      <div className="bg-gradient-to-br from-primary/10 via-background to-secondary/5 border border-border/60 rounded-3xl p-6 mb-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          {/* Avatar */}
          <div className="relative flex-shrink-0 group">
            <div
              className={`w-28 h-28 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-3xl font-bold shadow-lg overflow-hidden ${isOwn ? 'cursor-pointer' : ''}`}
              onClick={() => isOwn && setEditOpen(true)}
            >
              {avatarSrc ? (
                <img src={avatarSrc} alt={fullName} className="w-full h-full object-cover" />
              ) : (
                (fullName[0] || "م")
              )}
              {/* Hover overlay for owner */}
              {isOwn && (
                <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera className="w-7 h-7 text-white" />
                </div>
              )}
            </div>
            {isOwn && (
              <button
                onClick={() => setEditOpen(true)}
                className="absolute -bottom-1 -left-1 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white shadow-lg hover:bg-primary/90 transition hover:scale-110"
                data-testid="btn-edit-avatar"
                title="تغيير الصورة"
              >
                <Camera className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 text-center sm:text-right">
            <div className="flex items-center justify-center sm:justify-start gap-2 mb-1 flex-wrap">
              <h1 className="text-2xl font-black">{fullName}</h1>
              {channel?.is_verified && (
                <Badge className="bg-blue-500 text-white gap-1 text-xs">
                  <Shield className="w-3 h-3" /> موثّق
                </Badge>
              )}
              {ratingsData && ratingsData.count > 0 && (
                <div className="flex items-center gap-1" title={`${ratingsData.count} تقييم`}>
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  <span className="text-sm font-bold text-yellow-600">{ratingsData.avg.toFixed(1)}</span>
                  <span className="text-xs text-muted-foreground">({ratingsData.count})</span>
                </div>
              )}
              {isOwn && (
                <button
                  onClick={() => setEditOpen(true)}
                  className="w-7 h-7 rounded-full bg-primary/10 hover:bg-primary/20 border border-primary/20 flex items-center justify-center text-primary transition-all hover:scale-110"
                  title="تعديل الاسم والبروفايل"
                  data-testid="btn-edit-name-inline"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {profileUser.bio ? (
              <p className="text-sm text-muted-foreground mb-2 max-w-sm">{profileUser.bio}</p>
            ) : isOwn ? (
              <button
                onClick={() => setEditOpen(true)}
                className="text-xs text-primary/60 hover:text-primary mb-2 underline underline-offset-2 transition-colors"
                data-testid="btn-add-bio"
              >
                + أضف وصفاً لبروفايلك
              </button>
            ) : null}
            {profileUser.created_at && (
              <p className="text-xs text-muted-foreground mb-2">
                عضو منذ {format(new Date(profileUser.created_at), "MMMM yyyy", { locale: ar })}
              </p>
            )}
            {/* Gender & Account Type badges */}
            {(profileUser.gender || profileUser.account_type) && (
              <div className="flex flex-wrap gap-2 mb-2 justify-center sm:justify-start">
                {profileUser.gender && (
                  <Badge variant="outline" className="gap-1 text-xs">
                    {profileUser.gender === "male" ? "🧑 ذكر" : "👩 أنثى"}
                  </Badge>
                )}
                {profileUser.account_type && (
                  <Badge variant="outline" className={`gap-1 text-xs ${
                    profileUser.account_type === "business" ? "border-amber-300 text-amber-700" :
                    profileUser.account_type === "broadcaster" ? "border-purple-300 text-purple-700" :
                    profileUser.account_type === "freelancer" ? "border-cyan-300 text-cyan-700" :
                    "border-border"
                  }`}>
                    {profileUser.account_type === "personal" ? "👤 شخصي" :
                     profileUser.account_type === "business" ? "🏪 تجاري" :
                     profileUser.account_type === "broadcaster" ? "📹 مذيع" :
                     profileUser.account_type === "freelancer" ? "💼 فريلانسر" :
                     profileUser.account_type}
                  </Badge>
                )}
              </div>
            )}
            {/* Social Info */}
            {(profileUser.birthday || profileUser.job_title || profileUser.company || profileUser.city || profileUser.governorate) && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2 justify-center sm:justify-start">
                {profileUser.birthday && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Cake className="w-3 h-3 text-pink-500" />
                    {new Date(profileUser.birthday).toLocaleDateString("ar-EG", { day: "numeric", month: "long" })}
                  </span>
                )}
                {(profileUser.job_title || profileUser.company) && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Briefcase className="w-3 h-3 text-blue-500" />
                    {profileUser.job_title}{profileUser.company ? ` · ${profileUser.company}` : ""}
                  </span>
                )}
                {(profileUser.city || profileUser.governorate) && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="w-3 h-3 text-red-500" />
                    {profileUser.city || profileUser.governorate}
                  </span>
                )}
              </div>
            )}
            {isOwn && !(profileUser.birthday || profileUser.job_title) && (
              <button
                onClick={() => setLocation("/social")}
                className="text-xs text-primary/60 hover:text-primary mb-2 underline underline-offset-2 transition-colors flex items-center gap-1"
                data-testid="btn-add-social-info"
              >
                <ExternalLink className="w-3 h-3" /> + أضف معلوماتك الاجتماعية
              </button>
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

          {/* Follower counts */}
          {followData && (
            <div className="flex gap-4 mt-2 justify-center sm:justify-start text-sm">
              <div className="flex items-center gap-1.5 cursor-pointer hover:text-primary transition-colors" data-testid="followers-count">
                <Users className="w-4 h-4 text-primary" />
                <span className="font-bold">{followData.followersCount}</span>
                <span className="text-muted-foreground text-xs">متابع</span>
              </div>
              <div className="flex items-center gap-1.5" data-testid="following-count">
                <span className="font-bold">{followData.followingCount}</span>
                <span className="text-muted-foreground text-xs">يتابع</span>
              </div>
            </div>
          )}

          {/* Actions */}
          {!isOwn && user && (
            <div className="flex gap-2 flex-shrink-0 flex-wrap justify-center sm:justify-end">
              <Button
                size="sm"
                className={`gap-2 ${isFollowingData?.following ? "bg-muted text-foreground hover:bg-muted/80" : ""}`}
                variant={isFollowingData?.following ? "outline" : "default"}
                onClick={() => followMutation.mutate()}
                disabled={followMutation.isPending}
                data-testid="btn-follow-user"
              >
                {isFollowingData?.following ? (
                  <><UserCheck className="w-4 h-4" /> متابَع</>
                ) : (
                  <><UserPlus className="w-4 h-4" /> تابع</>
                )}
              </Button>
              <Button size="sm" className="gap-2" onClick={startChat} data-testid="btn-start-chat">
                <MessageCircle className="w-4 h-4" /> راسله
              </Button>
              <Button
                size="sm" variant="outline"
                className="gap-2 border-yellow-300 text-yellow-700 hover:bg-yellow-50 dark:hover:bg-yellow-950/20"
                onClick={() => setShowRatingForm(v => !v)}
                data-testid="btn-rate-seller"
              >
                <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" /> قيّمه
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
            <div className="flex gap-2 flex-shrink-0 flex-col sm:flex-row">
              <Button size="sm" className="gap-2" onClick={() => setEditOpen(true)} data-testid="btn-edit-profile">
                <Edit2 className="w-4 h-4" /> تعديل البروفايل
              </Button>
              <Button size="sm" variant="outline" onClick={() => setLocation("/my-content")}>
                إدارة محتواي
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
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

      {/* Advertiser Stats Dashboard */}
      {isOwn && myStats && (
        <div className="bg-card border border-border/60 rounded-2xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-primary" />
            <h2 className="font-bold">إحصائيات إعلاناتك</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {[
              { label: "إجمالي الإعلانات", value: myStats.totalAds, sub: `${myStats.activeAds} نشط`, color: "text-blue-500", icon: "📋" },
              { label: "إجمالي المشاهدات", value: myStats.totalViews?.toLocaleString(), sub: "لجميع إعلاناتك", color: "text-emerald-500", icon: "👀" },
              { label: "إجمالي الإعجابات", value: myStats.totalLikes?.toLocaleString(), sub: "تفاعل الجمهور", color: "text-pink-500", icon: "❤️" },
              { label: "المتابعون", value: myStats.followersCount, sub: "يتابعون حسابك", color: "text-purple-500", icon: "👥" },
            ].map(s => (
              <div key={s.label} className="bg-muted/40 rounded-xl p-3 text-center">
                <div className="text-lg mb-1">{s.icon}</div>
                <div className={`text-xl font-black ${s.color}`}>{s.value}</div>
                <div className="text-[10px] text-muted-foreground font-medium">{s.label}</div>
                <div className="text-[9px] text-muted-foreground">{s.sub}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-muted/40 rounded-xl p-3 text-center">
              <div className="text-lg mb-1">🔗</div>
              <div className="text-xl font-black text-amber-500">{myStats.totalClicks}</div>
              <div className="text-[10px] text-muted-foreground font-medium">نقرات على الروابط</div>
            </div>
            <div className="bg-muted/40 rounded-xl p-3 text-center">
              <div className="text-lg mb-1">💬</div>
              <div className="text-xl font-black text-cyan-500">{myStats.uniqueMessages}</div>
              <div className="text-[10px] text-muted-foreground font-medium">تواصلوا معك</div>
            </div>
          </div>
          {myStats.topAds?.length > 0 && (
            <div>
              <h3 className="text-sm font-bold mb-2 flex items-center gap-1">🏆 أفضل إعلاناتك أداءً</h3>
              <div className="space-y-2">
                {myStats.topAds.map((ad: any, i: number) => (
                  <a key={ad.id} href={`/ads/${ad.id}`} className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted/50 transition-colors" data-testid={`top-ad-${i}`}>
                    <span className="text-xs font-bold text-muted-foreground w-4">{i+1}</span>
                    {ad.media_url && (
                      <img src={ad.media_url} alt="" className="w-10 h-10 rounded-lg object-cover" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{ad.title}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {ad.price_egp ? `${Number(ad.price_egp).toLocaleString()} ج.م` : "بدون سعر"}
                      </div>
                    </div>
                    <div className="flex gap-3 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-0.5"><Eye className="w-3 h-3" /> {ad.views_count || 0}</span>
                      <span className="flex items-center gap-0.5"><Heart className="w-3 h-3" /> {ad.likes_count || 0}</span>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Seller Ratings Section */}
      <div className="bg-card border border-border/60 rounded-2xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
            <h2 className="font-bold">تقييمات البائع</h2>
            {ratingsData && ratingsData.count > 0 && (
              <Badge variant="secondary">{ratingsData.count} تقييم</Badge>
            )}
          </div>
          {ratingsData && ratingsData.count > 0 && (
            <div className="flex items-center gap-2">
              <StarRating value={Math.round(ratingsData.avg)} readonly size="sm" />
              <span className="font-black text-xl text-yellow-600">{ratingsData.avg.toFixed(1)}</span>
              <span className="text-xs text-muted-foreground">/ 5</span>
            </div>
          )}
        </div>

        {/* Rating form for non-owners */}
        {!isOwn && user && showRatingForm && (
          <div className="bg-muted/40 rounded-xl p-4 mb-4 border border-border/60">
            <p className="text-sm font-semibold mb-3">✍️ قيّم هذا البائع</p>
            <div className="flex items-center gap-3 mb-3">
              <StarRating value={myRating} onChange={setMyRating} size="lg" />
              {myRating > 0 && (
                <span className="text-sm text-muted-foreground">
                  {["", "ضعيف", "مقبول", "جيد", "جيد جداً", "ممتاز"][myRating]}
                </span>
              )}
            </div>
            <Textarea
              value={myReview}
              onChange={e => setMyReview(e.target.value)}
              placeholder="اكتب تعليقك (اختياري)..."
              className="min-h-[80px] resize-none text-sm mb-3"
              maxLength={300}
              data-testid="input-rating-review"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                className="gap-2 bg-yellow-500 hover:bg-yellow-600 text-white"
                onClick={() => ratingMutation.mutate()}
                disabled={myRating === 0 || ratingMutation.isPending}
                data-testid="btn-submit-rating"
              >
                <ThumbsUp className="w-3.5 h-3.5" />
                {ratingMutation.isPending ? "جاري الإرسال..." : "إرسال التقييم"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowRatingForm(false)}>إلغاء</Button>
            </div>
          </div>
        )}

        {/* Reviews list */}
        {ratingsData && ratingsData.ratings.length > 0 ? (
          <div className="space-y-3">
            {ratingsData.ratings.slice(0, 5).map((r: any) => (
              <div key={r.id} className="flex gap-3 p-3 bg-muted/30 rounded-xl">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/40 to-secondary/40 flex items-center justify-center text-white text-sm font-bold shrink-0">
                  {r.user_name?.[0] || "م"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold truncate">{r.user_name}</span>
                    <StarRating value={r.rating} readonly size="sm" />
                  </div>
                  {r.review && <p className="text-sm text-muted-foreground">{r.review}</p>}
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    {r.created_at ? (() => { try { return format(new Date(r.created_at), "d MMM yyyy", { locale: ar }); } catch { return ""; } })() : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <Star className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">لا توجد تقييمات بعد</p>
            {!isOwn && user && !showRatingForm && (
              <Button
                size="sm" variant="outline"
                className="mt-3 gap-2 border-yellow-300 text-yellow-700"
                onClick={() => setShowRatingForm(true)}
                data-testid="btn-be-first-rater"
              >
                <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" /> كن أول من يقيّم
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Referral Section — only for owner */}
      {isOwn && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/10 border border-amber-200/60 dark:border-amber-800/40 rounded-2xl p-5 mb-6" dir="rtl">
          <div className="flex items-center gap-2 mb-4">
            <Gift className="w-5 h-5 text-amber-600" />
            <h2 className="font-bold text-amber-900 dark:text-amber-400">ادعُ صديق واكسب مكافأة</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-white/60 dark:bg-white/5 rounded-xl p-3 text-center">
              <Users className="w-5 h-5 mx-auto mb-1 text-amber-600" />
              <p className="text-xl font-black">{referralStats?.count || 0}</p>
              <p className="text-xs text-muted-foreground">أصدقاء دعوتهم</p>
            </div>
            <div className="bg-white/60 dark:bg-white/5 rounded-xl p-3 text-center">
              <Gift className="w-5 h-5 mx-auto mb-1 text-green-600" />
              <p className="text-xl font-black">{Number(referralStats?.earned || 0).toFixed(0)} ج</p>
              <p className="text-xs text-muted-foreground">مكافأتك المكتسبة</p>
            </div>
          </div>
          {referralCode && (
            <div className="bg-white/80 dark:bg-white/10 rounded-xl p-3 mb-3" dir="rtl">
              <p className="text-xs text-muted-foreground mb-1">رمز الإحالة الخاص بك</p>
              <p className="font-mono font-bold text-xl text-amber-700 dark:text-amber-400 tracking-widest mb-3">{referralCode}</p>
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={copyReferralLink} className="gap-2" data-testid="btn-copy-referral">
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  {copied ? "تم النسخ" : "نسخ الرابط"}
                </Button>
                <Button
                  size="sm"
                  className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                  data-testid="btn-share-whatsapp-referral"
                  onClick={() => {
                    const link = `${window.location.origin}?ref=${referralCode}`;
                    const msg = encodeURIComponent(
                      `🎉 أدعوك تنضم لشبكة سوق الإعلانات!\n📢 أعلن عن منتجاتك، شاهد البث المباشر، واكسب أرباح\n🔗 سجّل الآن: ${link}\n🎁 كود الإحالة: ${referralCode} — هتحصل على مكافأة ترحيبية!`
                    );
                    window.open(`https://wa.me/?text=${msg}`, "_blank");
                  }}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.854L.057 23.5l5.797-1.521A11.932 11.932 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.844 0-3.576-.49-5.073-1.346l-.364-.216-3.44.902.919-3.357-.236-.373A9.958 9.958 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
                  شارك على واتساب
                </Button>
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <Input
              placeholder="لديك رمز إحالة؟ أدخله هنا..."
              value={referralInput}
              onChange={e => setReferralInput(e.target.value.toUpperCase())}
              className="font-mono uppercase text-sm"
              dir="ltr"
              data-testid="input-referral-code"
            />
            <Button
              size="sm"
              onClick={() => useReferralMutation.mutate(referralInput)}
              disabled={!referralInput.trim() || useReferralMutation.isPending}
              className="shrink-0 bg-amber-600 hover:bg-amber-700"
              data-testid="btn-use-referral"
            >
              تفعيل
            </Button>
          </div>
        </div>
      )}

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

      {/* ── GIFT GALLERY — visible only when viewing someone else's profile ── */}
      {!isOwn && user && (
        <div className="bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-950/20 dark:to-rose-950/10 border border-rose-200/60 dark:border-rose-800/40 rounded-2xl p-5 mb-6" dir="rtl">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-rose-500" />
              <h2 className="font-bold text-rose-900 dark:text-rose-400">أرسل هدية لـ {fullName}</h2>
            </div>
            <div className="flex items-center gap-1.5 bg-white/70 dark:bg-white/10 rounded-full px-3 py-1 border border-rose-200/60">
              <span className="text-amber-500 text-sm">🪙</span>
              <span className="font-black text-sm text-foreground">{myCoins.toLocaleString()}</span>
              <span className="text-muted-foreground text-xs">عملة</span>
            </div>
          </div>

          {/* Sent gift animation */}
          {sentGift && (
            <div className="flex justify-center mb-3">
              <div className="bg-white/80 dark:bg-white/10 rounded-2xl px-6 py-3 text-center shadow-lg border border-rose-200">
                <p className="text-4xl mb-1 animate-bounce">{sentGift}</p>
                <p className="text-rose-600 text-xs font-bold">تم الإرسال!</p>
              </div>
            </div>
          )}

          {/* Gift grid */}
          <div className="grid grid-cols-5 gap-2 mb-3">
            {PROFILE_GIFTS.map(gift => {
              const canAfford = myCoins >= gift.coins;
              return (
                <button
                  key={gift.type}
                  onClick={() => canAfford && sendProfileGiftMutation.mutate(gift)}
                  disabled={!canAfford || sendProfileGiftMutation.isPending}
                  data-testid={`profile-gift-${gift.type}`}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all active:scale-90
                    ${canAfford
                      ? "bg-white/80 dark:bg-white/10 border-rose-200/60 hover:border-rose-400 hover:shadow-md cursor-pointer"
                      : "bg-white/40 dark:bg-white/5 border-gray-200/40 opacity-50 cursor-not-allowed"
                    }`}
                >
                  <span className="text-2xl leading-none">{gift.emoji}</span>
                  <span className="text-[9px] text-muted-foreground font-medium leading-none">{gift.name}</span>
                  <div className="flex items-center gap-0.5">
                    <span className="text-[8px] text-amber-500">🪙</span>
                    <span className="text-[9px] font-black text-amber-600">{gift.coins}</span>
                  </div>
                </button>
              );
            })}
          </div>

          <p className="text-center text-xs text-muted-foreground">
            💝 هداياك تظهر في محفظة {fullName} مباشرة
          </p>
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

      {/* Edit Profile Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Edit2 className="w-5 h-5 text-primary" /> تعديل البروفايل
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            {/* Avatar Upload — clickable */}
            <div className="flex flex-col items-center gap-2">
              <div
                className="relative group cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="w-28 h-28 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-3xl font-bold overflow-hidden shadow-xl ring-4 ring-primary/20">
                  {editPhotoPreview ? (
                    <img src={editPhotoPreview} alt="preview" className="w-full h-full object-cover" />
                  ) : profileUser.profile_image_url ? (
                    <img src={profileUser.profile_image_url} alt={fullName} className="w-full h-full object-cover" />
                  ) : (
                    (fullName[0] || "م")
                  )}
                  <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                    <Camera className="w-6 h-6 text-white" />
                    <span className="text-white text-[10px] font-medium">تغيير</span>
                  </div>
                </div>
                <div className="absolute -bottom-1 -left-1 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white shadow-lg border-2 border-background">
                  <Camera className="w-4 h-4" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">اضغط على الصورة لتغييرها</p>
              {editPhotoPreview && (
                <button
                  onClick={() => { setEditPhoto(null); setEditPhotoPreview(null); }}
                  className="text-xs text-red-500 hover:underline"
                >
                  إلغاء تغيير الصورة
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoChange}
              />
            </div>

            {/* Name */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold flex items-center gap-1.5">
                <Edit2 className="w-3.5 h-3.5 text-primary" /> الاسم
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">الاسم الأول</Label>
                  <Input
                    value={editFirstName}
                    onChange={e => setEditFirstName(e.target.value)}
                    placeholder="مثال: أحمد"
                    className="h-10"
                    data-testid="input-first-name"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">اسم العائلة</Label>
                  <Input
                    value={editLastName}
                    onChange={e => setEditLastName(e.target.value)}
                    placeholder="مثال: محمد"
                    className="h-10"
                    data-testid="input-last-name"
                  />
                </div>
              </div>
            </div>

            {/* Bio */}
            <div>
              <Label className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                <MessageCircle className="w-3.5 h-3.5 text-primary" /> وصف قصير
              </Label>
              <Textarea
                value={editBio}
                onChange={e => setEditBio(e.target.value)}
                placeholder="اكتب وصفاً قصيراً عنك أو عن نشاطك التجاري..."
                className="min-h-[90px] resize-none"
                maxLength={200}
                data-testid="input-bio"
              />
              <p className="text-xs text-muted-foreground text-left mt-1">{editBio.length}/200</p>
            </div>

            <Button
              className="w-full gap-2 h-11 text-base font-bold"
              onClick={() => editMutation.mutate()}
              disabled={editMutation.isPending}
              data-testid="btn-save-profile"
            >
              {editMutation.isPending ? (
                <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> جارٍ الحفظ...</>
              ) : (
                <><Check className="w-4 h-4" /> حفظ التغييرات</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
