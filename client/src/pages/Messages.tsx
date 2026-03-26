import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Send, ArrowRight, User } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

export default function Messages() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [activePartner, setActivePartner] = useState<string | null>(null);
  const [text, setText] = useState("");

  const { data: conversations = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/messages"],
    queryFn: () => fetch("/api/messages", { credentials: "include" }).then(r => r.json()),
    enabled: !!user,
    refetchInterval: 5000,
  });

  const { data: thread = [] } = useQuery<any[]>({
    queryKey: ["/api/messages", activePartner],
    queryFn: () => fetch(`/api/messages/${activePartner}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!activePartner,
    refetchInterval: 3000,
  });

  const sendMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/messages", { toUserId: activePartner, message: text }),
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["/api/messages", activePartner] });
      qc.invalidateQueries({ queryKey: ["/api/messages"] });
    },
  });

  if (!user) return (
    <div className="container px-4 py-20 text-center" dir="rtl">
      <p className="text-muted-foreground">يجب تسجيل الدخول أولاً</p>
    </div>
  );

  return (
    <div className="container px-4 py-8 max-w-5xl" dir="rtl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          <MessageCircle className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-black">الرسائل المباشرة</h1>
          <p className="text-xs text-muted-foreground">تواصل مع البائعين والمشترين مباشرةً</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[520px]">
        {/* Conversations Sidebar */}
        <div className="border border-border/60 rounded-2xl overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b bg-muted/30">
            <p className="font-bold text-sm">المحادثات</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="space-y-3 p-3">
                {[1,2,3].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-10">
                <MessageCircle className="w-10 h-10 mb-2 opacity-20" />
                <p className="text-sm">لا توجد رسائل بعد</p>
                <p className="text-xs mt-1 text-center px-4">ابدأ محادثة من صفحة أي إعلان</p>
              </div>
            ) : (
              conversations.map((conv: any) => (
                <button
                  key={conv.partner_id}
                  onClick={() => setActivePartner(conv.partner_id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 border-b border-border/30 text-right hover:bg-muted/30 transition-colors ${activePartner === conv.partner_id ? "bg-primary/5 border-r-2 border-r-primary" : ""}`}
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="font-bold text-xs truncate">{conv.partner_id?.slice(0, 8)}...</p>
                      {!conv.is_read && conv.from_user_id !== user.id && (
                        <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{conv.message}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat Thread */}
        <div className="md:col-span-2 border border-border/60 rounded-2xl overflow-hidden flex flex-col">
          {!activePartner ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <MessageCircle className="w-16 h-16 mb-3 opacity-10" />
              <p className="text-sm font-medium">اختر محادثة من القائمة</p>
              <p className="text-xs mt-1">أو ابدأ محادثة جديدة من صفحة إعلان</p>
            </div>
          ) : (
            <>
              {/* Thread Header */}
              <div className="px-4 py-3 border-b bg-muted/30 flex items-center gap-3">
                <button onClick={() => setActivePartner(null)} className="md:hidden">
                  <ArrowRight className="w-4 h-4" />
                </button>
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-4 h-4 text-primary" />
                </div>
                <p className="font-bold text-sm">{activePartner.slice(0, 12)}...</p>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {thread.map((msg: any) => {
                  const isMine = msg.from_user_id === user.id;
                  return (
                    <div key={msg.id} className={`flex ${isMine ? "justify-start" : "justify-end"}`}>
                      <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${isMine ? "bg-primary text-white rounded-br-sm" : "bg-muted rounded-bl-sm"}`}>
                        <p className="text-sm leading-relaxed">{msg.message}</p>
                        <p className={`text-[10px] mt-1 ${isMine ? "text-white/60" : "text-muted-foreground"}`}>
                          {msg.created_at && format(new Date(msg.created_at), "h:mm a", { locale: ar })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Input */}
              <div className="p-3 border-t border-border/40 flex gap-2">
                <Input
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && text.trim() && sendMutation.mutate()}
                  placeholder="اكتب رسالتك..."
                  className="flex-1 h-10"
                  dir="rtl"
                  data-testid="input-message"
                />
                <Button
                  size="sm" className="h-10 w-10 p-0"
                  onClick={() => text.trim() && sendMutation.mutate()}
                  disabled={!text.trim() || sendMutation.isPending}
                  data-testid="btn-send-message"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
