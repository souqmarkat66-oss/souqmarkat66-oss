import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Users, UserCheck, Handshake, Radio } from "lucide-react";

const TABS = [
  { id: "following", label: "أتابعهم", icon: UserCheck },
  { id: "followers", label: "يتابعوني", icon: Users },
  { id: "friends", label: "الأصدقاء", icon: Handshake },
] as const;

function nameOf(u: any) {
  return `${u.firstName ?? u.first_name ?? ""} ${u.lastName ?? u.last_name ?? ""}`.trim() || "مستخدم";
}

export default function Follows() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const initialTab = (() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    return TABS.some(x => x.id === t) ? (t as string) : "following";
  })();
  const [tab, setTab] = useState<string>(initialTab);

  const { data: rows = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/social/follows", tab],
    queryFn: () => fetch(`/api/social/follows?type=${tab}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!user,
  });

  const toggleFollow = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/users/${id}/follow`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/social/follows"] }),
    onError: (e: any) => toast({ title: "تعذّرت العملية", description: e?.message, variant: "destructive" }),
  });

  return (
    <div className="container px-4 py-8 max-w-2xl" dir="rtl">
      <h1 className="text-2xl font-black mb-4 flex items-center gap-2"><Users className="w-6 h-6 text-primary" /> المتابعات والأصدقاء</h1>

      <div className="flex gap-2 mb-5">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-1.5 border transition-all ${
              tab === t.id ? "bg-primary text-primary-foreground border-primary" : "bg-muted/40 border-border/60 text-muted-foreground"
            }`}
            data-testid={`tab-${t.id}`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-center text-muted-foreground py-10 text-sm">جارِ التحميل...</p>
      ) : rows.length === 0 ? (
        <div className="text-center py-14">
          <p className="text-4xl mb-3">{tab === "friends" ? "🤝" : "👥"}</p>
          <p className="text-muted-foreground text-sm">
            {tab === "following" ? "لا تتابع أحداً بعد — ادخل على بروفايل أي شخص واضغط متابعة" :
             tab === "followers" ? "لا يتابعك أحد بعد" :
             "الأصدقاء هم المتابعة المتبادلة — تابِع من يتابعك ليصبح صديقاً"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((u: any) => (
            <div key={u.id} className="flex items-center gap-3 bg-muted/30 border border-border/60 rounded-2xl p-3" data-testid={`row-follow-${u.id}`}>
              <button onClick={() => setLocation(`/profile/${u.id}`)} className="w-11 h-11 rounded-full bg-muted overflow-hidden flex items-center justify-center flex-shrink-0">
                {(u.profileImageUrl ?? u.profile_image_url)
                  ? <img src={u.profileImageUrl ?? u.profile_image_url} className="w-full h-full object-cover" alt={nameOf(u)} />
                  : <span className="font-bold">{nameOf(u)[0]}</span>}
              </button>
              <div className="flex-1 min-w-0">
                <button onClick={() => setLocation(`/profile/${u.id}`)} className="font-bold text-sm truncate block">{nameOf(u)}</button>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {u.mutual && <Badge variant="secondary" className="text-[10px] h-4">🤝 صديق</Badge>}
                  {u.liveStreamId && (
                    <Badge className="text-[10px] h-4 bg-red-600 text-white gap-0.5"><Radio className="w-2.5 h-2.5" /> لايف الآن</Badge>
                  )}
                  {!u.liveStreamId && u.online && <Badge variant="outline" className="text-[10px] h-4 text-green-600 border-green-600/40">● متصل</Badge>}
                </div>
              </div>
              {u.liveStreamId && (
                <Button size="sm" className="rounded-full h-8 bg-red-600 hover:bg-red-700 text-white font-bold" onClick={() => setLocation(`/streams/${u.liveStreamId}`)} data-testid={`btn-join-live-${u.id}`}>
                  دخول اللايف
                </Button>
              )}
              {tab === "followers" && !u.mutual ? (
                <Button size="sm" className="rounded-full h-8 font-bold" disabled={toggleFollow.isPending} onClick={() => toggleFollow.mutate(String(u.id))} data-testid={`btn-follow-back-${u.id}`}>
                  + رد المتابعة
                </Button>
              ) : tab !== "followers" ? (
                <Button size="sm" variant="outline" className="rounded-full h-8 font-bold" disabled={toggleFollow.isPending} onClick={() => toggleFollow.mutate(String(u.id))} data-testid={`btn-unfollow-${u.id}`}>
                  إلغاء المتابعة
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
