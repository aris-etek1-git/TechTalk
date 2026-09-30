import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Inbox, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { api } from "../services/api";
import { ContentItem } from "../types/content";
import { mapBackendContentToItem, rankForUser, matchesInterests } from "../lib/content";
import { FeedCard } from "../components/FeedCard";
import { useAppStore } from "../app/store";

const PAGE = 30;

function SkeletonCard() {
  return (
    <div className="tt-card p-4 flex flex-col sm:flex-row gap-4">
      <div className="tt-skeleton sm:w-72 md:w-80 aspect-[16/9] rounded-2xl flex-shrink-0" />
      <div className="flex-1 space-y-3 py-1">
        <div className="tt-skeleton h-4 w-40 rounded-full" />
        <div className="tt-skeleton h-4 w-4/5" />
        <div className="tt-skeleton h-3 w-full" />
        <div className="tt-skeleton h-3 w-2/3" />
        <div className="tt-skeleton h-4 w-32 rounded-full mt-4" />
      </div>
    </div>
  );
}

export function FeedScreen() {
  const navigate = useNavigate();
  const { savedIds, toggleSave, interests, markRead } = useAppStore();

  const [tab, setTab] = useState<"pour-toi" | "abonnements">("pour-toi");
  const [raw, setRaw] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const load = useCallback(
    async (nextOffset: number, replace: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const categoryParam = tab === "abonnements" && interests.length > 0 ? interests : undefined;
        const contents = await api.getContents(PAGE, nextOffset, undefined, undefined, categoryParam);
        const mapped = contents.map(mapBackendContentToItem);
        setRaw((prev) => (replace ? mapped : [...prev, ...mapped]));
        setOffset(nextOffset);
        setHasMore(contents.length >= PAGE);
      } catch (err) {
        console.error("Failed to fetch feed:", err);
        setError("Impossible de charger le flux. Vérifiez votre connexion et réessayez.");
      } finally {
        setLoading(false);
      }
    },
    [tab, interests]
  );

  useEffect(() => {
    setRaw([]);
    load(0, true);
  }, [load]);

  const items = useMemo(() => {
    if (tab === "abonnements") return raw.filter((i) => matchesInterests(i, interests));
    return rankForUser(raw, interests);
  }, [raw, tab, interests]);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const shouldObserve = !loading && !error && hasMore && raw.length > 0;
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !shouldObserve) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) load(offset + PAGE, false);
      },
      { rootMargin: "500px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [shouldObserve, load, offset]);

  const openItem = (item: ContentItem) => {
    markRead(item);
    navigate(`/content/${item.id}`, { state: { item } });
  };

  const shareItem = async (item: ContentItem) => {
    const link = `${window.location.origin}/content/${item.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: item.title, url: link });
      } else {
        await navigator.clipboard.writeText(link);
        toast.success("Lien copié dans le presse-papiers !");
      }
    } catch {
      /* partage annulé */
    }
  };

  const tabs = [
    { id: "pour-toi" as const, label: "Pour toi" },
    { id: "abonnements" as const, label: "Abonnements" },
  ];

  return (
    <div className="flex-1 overflow-y-auto tt-scrollbar">
      <div className="max-w-3xl mx-auto px-3 md:px-6 pt-4 pb-16">
        {/* Tabs */}
        <div className="flex items-center gap-6 border-b border-border/60 mb-5">
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="tt-btn relative px-1 pb-3 text-[15px]"
              >
                <span className={active ? "text-foreground font-bold" : "text-muted-foreground font-medium"}>
                  {t.id === "pour-toi" && (
                    <Sparkles size={13} className="inline -mt-0.5 mr-1 text-primary" />
                  )}
                  {t.label}
                </span>
                {active && (
                  <span className="absolute bottom-[-1px] left-0 right-0 h-[3px] rounded-full" style={{ background: "var(--brand-gradient)" }} />
                )}
              </button>
            );
          })}
        </div>

        {loading && raw.length === 0 && (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="py-16 text-center space-y-4">
            <div className="flex justify-center">
              <span className="tt-glass tt-btn w-14 h-14">
                {tab === "abonnements" ? <Sparkles size={22} className="text-primary" /> : <Inbox size={22} className="text-primary" />}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {tab === "abonnements"
                ? "Aucun contenu dans vos centres d'intérêt. Modifiez vos intérêts dans votre profil."
                : "Aucun contenu pour le moment. Revenez plus tard !"}
            </p>
          </div>
        )}

        <div className="space-y-4 tt-stagger">
          {items.map((item) => (
            <FeedCard
              key={item.id}
              item={item}
              isSaved={savedIds.has(item.id)}
              onOpen={() => openItem(item)}
              onSave={() => toggleSave(item)}
              onShare={() => shareItem(item)}
            />
          ))}
        </div>

        {shouldObserve && (
          <div ref={sentinelRef} className="py-6 flex justify-center">
            <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        )}

        {!loading && error && (
          <div className="tt-card tt-ring-brand p-8 text-center space-y-4 max-w-md mx-auto mt-6">
            <p className="text-sm text-muted-foreground">{error}</p>
            <button onClick={() => load(0, true)} className="tt-btn tt-btn-brand px-5 py-2.5 text-sm gap-2">
              <RefreshCw size={14} /> Réessayer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
