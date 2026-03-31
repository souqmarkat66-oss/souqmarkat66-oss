import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQueryClient } from "@tanstack/react-query";

const INTEREST_CATEGORIES = [
  { id: "real_estate", label: "🏠 عقارات" },
  { id: "cars", label: "🚗 سيارات" },
  { id: "electronics", label: "📱 إلكترونيات" },
  { id: "fashion", label: "👗 ملابس وموضة" },
  { id: "food", label: "🍕 طعام ومطاعم" },
  { id: "health", label: "💊 صحة وجمال" },
  { id: "education", label: "📚 تعليم" },
  { id: "entertainment", label: "🎬 ترفيه" },
  { id: "sports", label: "⚽ رياضة" },
  { id: "travel", label: "✈️ سفر وسياحة" },
  { id: "business", label: "💼 أعمال وتجارة" },
  { id: "home", label: "🛋️ منزل وديكور" },
];

export function InterestOnboarding() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (dismissed) return;
    const key = `interests_set_${user.id}`;
    if (localStorage.getItem(key)) return;
    if (!(user as any).interests || ((user as any).interests || "").trim() === "") {
      setOpen(true);
    }
  }, [user, dismissed]);

  const toggle = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const save = async () => {
    if (selected.length === 0) { handleSkip(); return; }
    setSaving(true);
    try {
      await fetch("/api/auth/me/interests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interests: selected.join(",") }),
        credentials: "include",
      });
      qc.invalidateQueries({ queryKey: ["/api/auth/user"] });
      if (user?.id) localStorage.setItem(`interests_set_${user.id}`, "1");
    } catch {}
    setSaving(false);
    setOpen(false);
  };

  const handleSkip = () => {
    if (user?.id) localStorage.setItem(`interests_set_${user.id}`, "1");
    setDismissed(true);
    setOpen(false);
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleSkip(); }}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-xl font-extrabold text-center">👋 مرحباً بك في سوق!</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground text-center mb-4">
          اختر اهتماماتك لنعرض لك الإعلانات المناسبة لك
        </p>
        <div className="flex flex-wrap gap-2 justify-center mb-6">
          {INTEREST_CATEGORIES.map(cat => (
            <Badge
              key={cat.id}
              variant={selected.includes(cat.id) ? "default" : "outline"}
              className="cursor-pointer px-3 py-1.5 text-sm transition-all select-none hover:scale-105"
              onClick={() => toggle(cat.id)}
              data-testid={`interest-${cat.id}`}
            >
              {cat.label}
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Button className="flex-1" onClick={save} disabled={saving} data-testid="btn-save-interests">
            {saving ? "جاري الحفظ..." : `حفظ الاهتمامات (${selected.length})`}
          </Button>
          <Button variant="ghost" onClick={handleSkip} className="text-muted-foreground" data-testid="btn-skip-interests">
            تخطي
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
