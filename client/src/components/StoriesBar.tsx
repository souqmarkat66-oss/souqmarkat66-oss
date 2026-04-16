import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useState, useRef, useEffect } from "react";
import { Plus, X, Eye, ChevronLeft, ChevronRight, Trash2, Camera } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface StoryGroup {
  userId: string;
  userName: string;
  profileImage: string | null;
  stories: any[];
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} د`;
  const hrs = Math.floor(mins / 60);
  return `${hrs} س`;
}

export default function StoriesBar() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [viewerOpen, setViewerOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState<StoryGroup | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<any>(null);

  const { data: storyGroups = [] } = useQuery<StoryGroup[]>({
    queryKey: ["/api/stories"],
    queryFn: () => fetch("/api/stories").then(r => r.json()),
    refetchInterval: 30000,
  });

  const myGroup = storyGroups.find(g => g.userId === user?.id);
  const otherGroups = storyGroups.filter(g => g.userId !== user?.id);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("media", file);
    if (caption) fd.append("caption", caption);
    try {
      const res = await fetch("/api/stories", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      if (!res.ok) throw new Error("فشل الرفع");
      toast({ title: "✅ تم نشر حالتك!" });
      setCaption("");
      qc.invalidateQueries({ queryKey: ["/api/stories"] });
    } catch {
      toast({ title: "❌ فشل رفع الحالة", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const openStory = (group: StoryGroup, index = 0) => {
    setActiveGroup(group);
    setActiveIndex(index);
    setViewerOpen(true);
    setProgress(0);
    markViewed(group.stories[index]?.id);
  };

  const markViewed = (storyId: number) => {
    if (!user || !storyId) return;
    fetch(`/api/stories/${storyId}/view`, { method: "POST", credentials: "include" }).catch(() => {});
  };

  const nextStory = () => {
    if (!activeGroup) return;
    if (activeIndex < activeGroup.stories.length - 1) {
      const next = activeIndex + 1;
      setActiveIndex(next);
      setProgress(0);
      markViewed(activeGroup.stories[next]?.id);
    } else {
      const currentIdx = storyGroups.findIndex(g => g.userId === activeGroup.userId);
      if (currentIdx < storyGroups.length - 1) {
        const nextGroup = storyGroups[currentIdx + 1];
        setActiveGroup(nextGroup);
        setActiveIndex(0);
        setProgress(0);
        markViewed(nextGroup.stories[0]?.id);
      } else {
        setViewerOpen(false);
      }
    }
  };

  const prevStory = () => {
    if (activeIndex > 0) {
      setActiveIndex(activeIndex - 1);
      setProgress(0);
    }
  };

  const deleteStory = async (storyId: number) => {
    try {
      await fetch(`/api/stories/${storyId}`, { method: "DELETE", credentials: "include" });
      toast({ title: "✅ تم حذف الحالة" });
      setViewerOpen(false);
      qc.invalidateQueries({ queryKey: ["/api/stories"] });
    } catch {
      toast({ title: "❌ فشل الحذف", variant: "destructive" });
    }
  };

  useEffect(() => {
    if (!viewerOpen || !activeGroup) return;
    setProgress(0);
    const duration = activeGroup.stories[activeIndex]?.media_type === "video" ? 15000 : 5000;
    const interval = 50;
    let elapsed = 0;
    timerRef.current = setInterval(() => {
      elapsed += interval;
      setProgress((elapsed / duration) * 100);
      if (elapsed >= duration) {
        clearInterval(timerRef.current);
        nextStory();
      }
    }, interval);
    return () => clearInterval(timerRef.current);
  }, [viewerOpen, activeGroup?.userId, activeIndex]);

  const currentStory = activeGroup?.stories[activeIndex];

  return (
    <>
      <div className="relative mb-4">
        <div ref={scrollRef} className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide px-1">
          {user && (
            <button
              onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center gap-1 flex-shrink-0"
              disabled={uploading}
              data-testid="btn-add-story"
            >
              <div className={`w-16 h-16 rounded-full border-2 border-dashed ${myGroup ? 'border-primary' : 'border-muted-foreground/30'} flex items-center justify-center relative overflow-hidden`}>
                {myGroup?.profileImage || user?.profileImageUrl ? (
                  <img src={myGroup?.profileImage || user?.profileImageUrl || ''} alt="" className="w-full h-full object-cover opacity-60" />
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center text-muted-foreground">
                    <Camera className="w-5 h-5" />
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <Plus className="w-5 h-5 text-white" />
                </div>
              </div>
              <span className="text-[10px] text-muted-foreground font-medium">
                {uploading ? "جاري..." : "حالتك"}
              </span>
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleUpload} />

          {myGroup && (
            <button
              onClick={() => openStory(myGroup)}
              className="flex flex-col items-center gap-1 flex-shrink-0"
              data-testid="btn-my-stories"
            >
              <div className="w-16 h-16 rounded-full border-[3px] border-primary p-0.5">
                <div className="w-full h-full rounded-full overflow-hidden bg-muted">
                  {myGroup.profileImage ? (
                    <img src={myGroup.profileImage} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-primary font-bold text-lg">{(myGroup.userName || '?')[0]}</div>
                  )}
                </div>
              </div>
              <span className="text-[10px] font-medium truncate max-w-[64px]">حالاتي ({myGroup.stories.length})</span>
            </button>
          )}

          {otherGroups.map(group => (
            <button
              key={group.userId}
              onClick={() => openStory(group)}
              className="flex flex-col items-center gap-1 flex-shrink-0"
              data-testid={`story-${group.userId}`}
            >
              <div className="w-16 h-16 rounded-full border-[3px] border-gradient-to-r border-pink-500 p-0.5 bg-gradient-to-tr from-pink-500 via-red-500 to-yellow-500">
                <div className="w-full h-full rounded-full overflow-hidden bg-background">
                  {group.profileImage ? (
                    <img src={group.profileImage} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-primary font-bold text-lg bg-muted">{(group.userName || '?')[0]}</div>
                  )}
                </div>
              </div>
              <span className="text-[10px] font-medium truncate max-w-[64px]">{group.userName}</span>
            </button>
          ))}

          {storyGroups.length === 0 && !user && (
            <div className="text-xs text-muted-foreground py-4 text-center w-full">سجل دخول لمشاهدة الحالات</div>
          )}
        </div>
      </div>

      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-w-md w-full p-0 rounded-2xl overflow-hidden bg-black border-0 h-[85vh] max-h-[700px] flex flex-col">
          {activeGroup && currentStory && (
            <>
              <div className="flex gap-0.5 px-2 pt-2">
                {activeGroup.stories.map((_: any, i: number) => (
                  <div key={i} className="flex-1 h-0.5 rounded-full bg-white/20 overflow-hidden">
                    <div
                      className="h-full bg-white rounded-full transition-all"
                      style={{ width: i < activeIndex ? '100%' : i === activeIndex ? `${progress}%` : '0%' }}
                    />
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between px-3 pt-2 pb-1">
                <div className="flex items-center gap-2">
                  {activeGroup.profileImage ? (
                    <img src={activeGroup.profileImage} alt="" className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm">{(activeGroup.userName || '?')[0]}</div>
                  )}
                  <div>
                    <p className="text-white text-sm font-bold">{activeGroup.userName}</p>
                    <p className="text-white/50 text-[10px]">{timeAgo(currentStory.created_at)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {activeGroup.userId === user?.id && (
                    <button onClick={() => deleteStory(currentStory.id)} className="text-white/60 hover:text-red-400 transition-colors" data-testid="btn-delete-story">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                  <button onClick={() => setViewerOpen(false)} className="text-white/60 hover:text-white">
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="flex-1 relative flex items-center justify-center overflow-hidden" onClick={nextStory}>
                {currentStory.media_type === "video" ? (
                  <video src={currentStory.media_url} autoPlay muted playsInline className="max-w-full max-h-full object-contain" />
                ) : (
                  <img src={currentStory.media_url} alt="" className="max-w-full max-h-full object-contain" />
                )}

                <button
                  onClick={e => { e.stopPropagation(); prevStory(); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/30 flex items-center justify-center text-white/70 hover:text-white"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                <button
                  onClick={e => { e.stopPropagation(); nextStory(); }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/30 flex items-center justify-center text-white/70 hover:text-white"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              </div>

              <div className="px-4 py-3">
                {currentStory.caption && (
                  <p className="text-white text-sm mb-2 text-center">{currentStory.caption}</p>
                )}
                <div className="flex items-center justify-center gap-1 text-white/40 text-xs">
                  <Eye className="w-3.5 h-3.5" />
                  <span>{currentStory.views_count || 0} مشاهدة</span>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
