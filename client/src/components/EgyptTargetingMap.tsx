import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Users, Target, Check } from "lucide-react";

const EGYPT_AREAS = [
  {
    id: "delta",
    name: "منطقة الدلتا",
    color: "#22c55e",
    bgColor: "bg-green-500/10 hover:bg-green-500/20 border-green-300 dark:border-green-800",
    activeBg: "bg-green-500/30 border-green-500",
    emoji: "🌾",
    population: "35 مليون",
    govs: ["الدقهلية", "الشرقية", "المنوفية", "البحيرة", "كفر الشيخ", "الغربية", "دمياط"],
  },
  {
    id: "cairo",
    name: "القاهرة الكبرى",
    color: "#3b82f6",
    bgColor: "bg-blue-500/10 hover:bg-blue-500/20 border-blue-300 dark:border-blue-800",
    activeBg: "bg-blue-500/30 border-blue-500",
    emoji: "🏙️",
    population: "22 مليون",
    govs: ["القاهرة", "الجيزة"],
  },
  {
    id: "alex",
    name: "الإسكندرية والساحل",
    color: "#0ea5e9",
    bgColor: "bg-sky-500/10 hover:bg-sky-500/20 border-sky-300 dark:border-sky-800",
    activeBg: "bg-sky-500/30 border-sky-500",
    emoji: "🌊",
    population: "6 مليون",
    govs: ["الإسكندرية", "مطروح"],
  },
  {
    id: "canal",
    name: "منطقة القناة",
    color: "#f59e0b",
    bgColor: "bg-amber-500/10 hover:bg-amber-500/20 border-amber-300 dark:border-amber-800",
    activeBg: "bg-amber-500/30 border-amber-500",
    emoji: "⚓",
    population: "4 مليون",
    govs: ["السويس", "الإسماعيلية", "بورسعيد"],
  },
  {
    id: "upper",
    name: "الصعيد",
    color: "#f97316",
    bgColor: "bg-orange-500/10 hover:bg-orange-500/20 border-orange-300 dark:border-orange-800",
    activeBg: "bg-orange-500/30 border-orange-500",
    emoji: "🏛️",
    population: "26 مليون",
    govs: ["المنيا", "أسيوط", "سوهاج", "قنا", "الأقصر", "أسوان", "الفيوم", "بني سويف"],
  },
  {
    id: "sinai",
    name: "سيناء",
    color: "#8b5cf6",
    bgColor: "bg-violet-500/10 hover:bg-violet-500/20 border-violet-300 dark:border-violet-800",
    activeBg: "bg-violet-500/30 border-violet-500",
    emoji: "🏔️",
    population: "700 ألف",
    govs: ["شمال سيناء", "جنوب سيناء"],
  },
  {
    id: "desert",
    name: "الصحراء والبحر الأحمر",
    color: "#ec4899",
    bgColor: "bg-pink-500/10 hover:bg-pink-500/20 border-pink-300 dark:border-pink-800",
    activeBg: "bg-pink-500/30 border-pink-500",
    emoji: "🏜️",
    population: "500 ألف",
    govs: ["البحر الأحمر", "الوادي الجديد"],
  },
];

const INTERESTS = [
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

const AGE_GROUPS = [
  { id: "18-24", label: "18 - 24 سنة", note: "جيل Z" },
  { id: "25-34", label: "25 - 34 سنة", note: "جيل الألفية" },
  { id: "35-44", label: "35 - 44 سنة", note: "الفئة الشرائية" },
  { id: "45-54", label: "45 - 54 سنة", note: "البالغون" },
  { id: "55+", label: "55+ سنة", note: "كبار السن" },
];

interface Props {
  selectedRegions: string[];
  selectedInterests: string[];
  selectedAges: string[];
  onRegionsChange: (regions: string[]) => void;
  onInterestsChange: (interests: string[]) => void;
  onAgesChange: (ages: string[]) => void;
}

export function EgyptTargetingMap({
  selectedRegions, selectedInterests, selectedAges,
  onRegionsChange, onInterestsChange, onAgesChange
}: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const toggleRegion = (gov: string) => {
    if (selectedRegions.includes(gov)) {
      onRegionsChange(selectedRegions.filter(r => r !== gov));
    } else {
      onRegionsChange([...selectedRegions, gov]);
    }
  };

  const toggleArea = (area: typeof EGYPT_AREAS[0]) => {
    const all = area.govs;
    const allSelected = all.every(g => selectedRegions.includes(g));
    if (allSelected) {
      onRegionsChange(selectedRegions.filter(r => !all.includes(r)));
    } else {
      const merged = Array.from(new Set([...selectedRegions, ...all]));
      onRegionsChange(merged);
    }
  };

  const toggleInterest = (id: string) => {
    if (selectedInterests.includes(id)) {
      onInterestsChange(selectedInterests.filter(i => i !== id));
    } else {
      onInterestsChange([...selectedInterests, id]);
    }
  };

  const toggleAge = (id: string) => {
    if (selectedAges.includes(id)) {
      onAgesChange(selectedAges.filter(a => a !== id));
    } else {
      onAgesChange([...selectedAges, id]);
    }
  };

  const totalSelected = selectedRegions.length;
  const reachEst = selectedRegions.length === 0
    ? "اختر مناطق للوصول"
    : `~${(selectedRegions.length * 1.2).toFixed(1)} مليون مستخدم محتمل`;

  return (
    <div className="space-y-5" dir="rtl">
      {/* Header Stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-primary" />
          <h3 className="font-bold text-base">خريطة الاستهداف الجغرافي 🇪🇬</h3>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Users className="w-4 h-4" />
          <span className="font-medium">{reachEst}</span>
        </div>
      </div>

      {/* EGYPT SVG-STYLE MAP (visual grid) */}
      <div className="bg-gradient-to-b from-sky-50 to-amber-50 dark:from-sky-950/20 dark:to-amber-950/20 rounded-2xl p-4 border">
        {/* Simple visual of Egypt map using positioned cards */}
        <div className="text-center text-xs font-bold text-muted-foreground mb-3">🌊 البحر المتوسط</div>

        {/* Row 1: Coast */}
        <div className="flex justify-center gap-2 mb-2">
          {EGYPT_AREAS.filter(a => a.id === "alex").map(area => (
            <AreaBlock key={area.id} area={area} selectedRegions={selectedRegions} onToggle={() => toggleArea(area)} onExpand={() => setExpanded(expanded === area.id ? null : area.id)} expanded={expanded === area.id} onToggleGov={toggleRegion} />
          ))}
          {EGYPT_AREAS.filter(a => a.id === "delta").map(area => (
            <AreaBlock key={area.id} area={area} selectedRegions={selectedRegions} onToggle={() => toggleArea(area)} onExpand={() => setExpanded(expanded === area.id ? null : area.id)} expanded={expanded === area.id} onToggleGov={toggleRegion} />
          ))}
        </div>

        {/* Row 2: Cairo + Canal */}
        <div className="flex justify-center gap-2 mb-2">
          {EGYPT_AREAS.filter(a => a.id === "cairo").map(area => (
            <AreaBlock key={area.id} area={area} selectedRegions={selectedRegions} onToggle={() => toggleArea(area)} onExpand={() => setExpanded(expanded === area.id ? null : area.id)} expanded={expanded === area.id} onToggleGov={toggleRegion} />
          ))}
          {EGYPT_AREAS.filter(a => a.id === "canal").map(area => (
            <AreaBlock key={area.id} area={area} selectedRegions={selectedRegions} onToggle={() => toggleArea(area)} onExpand={() => setExpanded(expanded === area.id ? null : area.id)} expanded={expanded === area.id} onToggleGov={toggleRegion} />
          ))}
          {EGYPT_AREAS.filter(a => a.id === "sinai").map(area => (
            <AreaBlock key={area.id} area={area} selectedRegions={selectedRegions} onToggle={() => toggleArea(area)} onExpand={() => setExpanded(expanded === area.id ? null : area.id)} expanded={expanded === area.id} onToggleGov={toggleRegion} />
          ))}
        </div>

        {/* Row 3: Upper Egypt + Desert */}
        <div className="flex justify-center gap-2 mb-2">
          {EGYPT_AREAS.filter(a => a.id === "upper").map(area => (
            <AreaBlock key={area.id} area={area} selectedRegions={selectedRegions} onToggle={() => toggleArea(area)} onExpand={() => setExpanded(expanded === area.id ? null : area.id)} expanded={expanded === area.id} onToggleGov={toggleRegion} />
          ))}
          {EGYPT_AREAS.filter(a => a.id === "desert").map(area => (
            <AreaBlock key={area.id} area={area} selectedRegions={selectedRegions} onToggle={() => toggleArea(area)} onExpand={() => setExpanded(expanded === area.id ? null : area.id)} expanded={expanded === area.id} onToggleGov={toggleRegion} />
          ))}
        </div>

        <div className="text-center text-xs font-bold text-muted-foreground mt-3">🏜️ السودان</div>

        {/* Quick actions */}
        <div className="flex gap-2 mt-3 justify-center flex-wrap">
          <Button type="button" size="sm" variant="outline" className="text-xs h-7"
            onClick={() => onRegionsChange(EGYPT_AREAS.flatMap(a => a.govs))}>
            تحديد الكل
          </Button>
          <Button type="button" size="sm" variant="outline" className="text-xs h-7"
            onClick={() => onRegionsChange([])}>
            إلغاء الكل
          </Button>
          {totalSelected > 0 && (
            <Badge className="text-xs">{totalSelected} محافظة محددة</Badge>
          )}
        </div>
      </div>

      {/* INTERESTS */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" /> الاهتمامات والفئات المستهدفة
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="flex flex-wrap gap-2">
            {INTERESTS.map(interest => {
              const active = selectedInterests.includes(interest.id);
              return (
                <button
                  key={interest.id}
                  type="button"
                  onClick={() => toggleInterest(interest.id)}
                  data-testid={`interest-${interest.id}`}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-all ${
                    active
                      ? "bg-primary text-white border-primary shadow-sm"
                      : "bg-muted border-border hover:border-primary/50 hover:bg-muted/80"
                  }`}
                >
                  <span>{interest.emoji}</span>
                  <span>{interest.label}</span>
                  {active && <Check className="w-3 h-3" />}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* AGE GROUPS */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" /> الفئة العمرية
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="flex flex-wrap gap-2">
            {AGE_GROUPS.map(age => {
              const active = selectedAges.includes(age.id);
              return (
                <button
                  key={age.id}
                  type="button"
                  onClick={() => toggleAge(age.id)}
                  data-testid={`age-${age.id}`}
                  className={`flex flex-col items-center px-4 py-2 rounded-xl border text-sm font-medium transition-all min-w-[90px] ${
                    active
                      ? "bg-primary text-white border-primary"
                      : "bg-muted border-border hover:border-primary/50"
                  }`}
                >
                  <span className="font-bold">{age.label}</span>
                  <span className="text-[10px] opacity-70">{age.note}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AreaBlock({
  area, selectedRegions, onToggle, onExpand, expanded, onToggleGov
}: {
  area: typeof EGYPT_AREAS[0];
  selectedRegions: string[];
  onToggle: () => void;
  onExpand: () => void;
  expanded: boolean;
  onToggleGov: (gov: string) => void;
}) {
  const selectedCount = area.govs.filter(g => selectedRegions.includes(g)).length;
  const allSelected = selectedCount === area.govs.length;
  const someSelected = selectedCount > 0 && !allSelected;

  return (
    <div className="flex-1 min-w-[130px] max-w-[200px]">
      <div
        className={`rounded-xl border-2 p-3 cursor-pointer transition-all ${
          allSelected ? area.activeBg : someSelected ? area.bgColor + " border-dashed" : area.bgColor
        }`}
      >
        <div className="flex items-center justify-between mb-1" onClick={onToggle}>
          <div className="flex items-center gap-1.5">
            <span className="text-lg">{area.emoji}</span>
            <div>
              <div className="text-xs font-bold leading-tight">{area.name}</div>
              <div className="text-[10px] opacity-60">{area.population}</div>
            </div>
          </div>
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
            allSelected ? "bg-primary border-primary" : someSelected ? "border-primary" : "border-muted-foreground/40"
          }`}>
            {allSelected && <Check className="w-3 h-3 text-white" />}
            {someSelected && <div className="w-2 h-2 rounded-full bg-primary" />}
          </div>
        </div>
        {selectedCount > 0 && (
          <div className="text-[10px] text-primary font-medium">{selectedCount}/{area.govs.length} محافظة</div>
        )}
        <button
          type="button"
          onClick={onExpand}
          className="text-[10px] text-muted-foreground underline mt-1 hover:text-primary"
        >
          {expanded ? "إخفاء" : "تفصيل"}
        </button>
        {expanded && (
          <div className="mt-2 space-y-1">
            {area.govs.map(gov => (
              <label
                key={gov}
                className="flex items-center gap-1.5 cursor-pointer text-xs py-0.5 hover:text-primary"
                onClick={() => onToggleGov(gov)}
              >
                <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${
                  selectedRegions.includes(gov) ? "bg-primary border-primary" : "border-muted-foreground/50"
                }`}>
                  {selectedRegions.includes(gov) && <Check className="w-2 h-2 text-white" />}
                </div>
                {gov}
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
