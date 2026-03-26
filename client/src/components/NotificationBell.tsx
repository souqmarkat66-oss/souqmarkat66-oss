import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Bell, Check, Trash2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

const TYPE_ICONS: Record<string, string> = {
  like: "❤️",
  comment: "💬",
  payment: "💰",
  campaign_approved: "✅",
  campaign_rejected: "❌",
  new_subscriber: "🔔",
  fraud_alert: "🚨",
  system: "📢",
};

export function NotificationBell() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: countData } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    queryFn: () => fetch("/api/notifications/unread-count", { credentials: "include" }).then(r => r.json()),
    enabled: !!user,
    refetchInterval: 15000,
  });

  const { data: notifications = [] } = useQuery<any[]>({
    queryKey: ["/api/notifications"],
    queryFn: () => fetch("/api/notifications", { credentials: "include" }).then(r => r.json()),
    enabled: !!user,
  });

  const readAllMutation = useMutation({
    mutationFn: () => apiRequest("PUT", "/api/notifications/read-all"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/notifications"] });
      qc.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/notifications/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/notifications"] });
      qc.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const markReadMutation = useMutation({
    mutationFn: (id: number) => apiRequest("PUT", `/api/notifications/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/notifications"] });
      qc.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  if (!user) return null;

  const unread = countData?.count || 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-full w-9 h-9"
          data-testid="btn-notification-bell"
        >
          <Bell className="w-5 h-5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1 leading-none">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-80 max-h-[480px] flex flex-col p-0 overflow-hidden"
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" />
            <span className="font-bold text-sm">الإشعارات</span>
            {unread > 0 && (
              <Badge variant="destructive" className="text-xs h-5 px-1.5">{unread}</Badge>
            )}
          </div>
          {unread > 0 && (
            <Button
              variant="ghost" size="sm"
              className="text-xs h-7 gap-1 text-primary"
              onClick={() => readAllMutation.mutate()}
              disabled={readAllMutation.isPending}
            >
              <Check className="w-3 h-3" /> قراءة الكل
            </Button>
          )}
        </div>

        {/* Notifications List */}
        <div className="overflow-y-auto flex-1">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Bell className="w-10 h-10 mb-2 opacity-20" />
              <p className="text-sm">لا توجد إشعارات</p>
            </div>
          ) : (
            notifications.map((n: any) => (
              <div
                key={n.id}
                className={`flex items-start gap-3 px-4 py-3 border-b border-border/30 transition-colors hover:bg-muted/30 cursor-pointer ${!n.is_read ? "bg-primary/5" : ""}`}
                onClick={() => {
                  markReadMutation.mutate(n.id);
                  if (n.link) setLocation(n.link);
                }}
              >
                <div className="text-xl flex-shrink-0 mt-0.5">{TYPE_ICONS[n.type] || "📢"}</div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm leading-tight mb-0.5 ${!n.is_read ? "font-bold" : "font-medium"}`}>
                    {n.title}
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{n.body}</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">
                    {n.created_at && format(new Date(n.created_at), "dd MMM، h:mm a", { locale: ar })}
                  </p>
                </div>
                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                  {!n.is_read && <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
                  <button
                    onClick={e => { e.stopPropagation(); deleteMutation.mutate(n.id); }}
                    className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-all p-0.5"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
