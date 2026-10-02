import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Clapperboard, Inbox, LayoutGrid, RefreshCw, Rows3, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { api } from "../services/api";
import { ContentItem } from "../types/content";
import { formatCount, mapBackendContentToItem, matchesInterests, rankForUser } from "../lib/content";
import { FeedCard } from "../components/FeedCard";
import { VideoTile } from "../components/VideoTile";
import { ShortsFeed } from "../components/ShortsFeed";
import { SourceBadge } from "../components/SourceBadge";
import { useAppStore } from "../app/store";

type FeedMode = "flux" | "videos" | "shorts";
type LengthFilter = "long" | "short";

const MODES: { id: FeedMode; label: string; icon: typeof Rows3 }[] = [
  { id: "flux", label: "Découverte", icon: Rows3 },
  { id: "videos", label: "YouTube", icon: LayoutGrid },
  { id: "shorts", label: "Vertical", icon: Clapperboard },
];

function durationMinutes(item: ContentItem): number {
  if (!item.duration) return 0;
  return parseInt(item.duration.split(":")[0], 10) || 0;
}

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
  const { savedIds, toggleSave, likedIds, toggleLike, interests, markRead } = useAppStore();
  const [searchParams, setSearchParams] = useSearchParams();

  const tab = searchParams.get("tab") === "abonnements" ? "abonnements" : "pour-toi";
  const modeParam = searchParams.get("mode");
  const mode: FeedMode =
    modeParam === "videos" || modeParam === "shorts" ? modeParam : "flux";
  const length: LengthFilter = searchParams.get("length") === "short" ? "short" : "long";

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set(key, value);
    setSearchParams(next, { replace: true });
  };

  const pageSize = mode === "flux" ? 30 : 60;

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
        const contents = await api.getContents(
          pageSize,
          nextOffset,
          undefined,
          mode === "flux" ? undefined : "video",
          categoryParam
        );
        const mapped = contents.map(mapBackendContentToItem);
        setRaw((prev) => (replace ? mapped : [...prev, ...mapped]));
        setOffset(nextOffset);
        setHasMore(contents.length >= pageSize);
      } catch (err) {
        console.error("Failed to fetch feed:", err);
        setError("Impossible de charger le flux. Vérifiez votre connexion et réessayez.");
      } finally {
        setLoading(false);
      }
    },
    [tab, interests, mode, pageSize]
  );

  useEffect(() => {
    setRaw([]);
    load(0, true);
  }, [load]);

  const items = useMemo(() => {
    const base = tab === "abonnements" ? raw.filter((i) => matchesInterests(i, interests)) : rankForUser(raw, interests);
    if (mode === "flux") return base;
    const videos = base.filter((i) => i.type === "video");
    if (mode === "shorts") return videos.filter((i) => i.youtubeId);
    return length === "short" ? videos.filter((i) => durationMinutes(i) < 4) : videos.filter((i) => durationMinutes(i) >= 4);
  }, [raw, tab, interests, mode, length]);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const shouldObserve = !loading && !error && hasMore && raw.length > 0;
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !shouldObserve) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) load(offset + pageSize, false);
      },
      { rootMargin: "500px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [shouldObserve, load, offset, pageSize]);

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

  const loadMore = useCallback(() => {
    if (shouldObserve) load(offset + pageSize, false);
  }, [shouldObserve, load, offset, pageSize]);

  /* Shorts take over the whole viewport: no page padding, no scrolling shell. */
  if (mode === "shorts") {
    return (
      <div className="flex-1 min-h-0 flex flex-col">
        <FeedBar
          tab={tab}
          mode={mode}
          length={length}
          onTab={(t) => setParam("tab", t)}
          onMode={(m) => setParam("mode", m)}
          onLength={(l) => setParam("length", l)}
        />
        {loading && items.length === 0 ? (
          <ShortsSkeleton />
        ) : items.length === 0 ? (
          <EmptyState tab={tab} mode={mode} />
        ) : (
          <ShortsFeed
            items={items}
            savedIds={savedIds}
            likedIds={likedIds}
            onLoadMore={loadMore}
            onSave={toggleSave}
            onLike={toggleLike}
            onShare={shareItem}
            onOpen={openItem}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto tt-scrollbar">
      <div className="max-w-3xl mx-auto px-3 md:px-6 pt-4 pb-16">
        <FeedBar
          tab={tab}
          mode={mode}
          length={length}
          onTab={(t) => setParam("tab", t)}
          onMode={(m) => setParam("mode", m)}
          onLength={(l) => setParam("length", l)}
        />

        {loading && raw.length === 0 && (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {!loading && !error && items.length === 0 && <EmptyState tab={tab} mode={mode} />}

        {mode === "flux" && (
          <div className="space-y-4 tt-stagger">
            {items.map((item) => (
              <FeedCard
                key={item.id}
                item={item}
                isSaved={savedIds.has(item.id)}
                isLiked={likedIds.has(item.id)}
                onOpen={() => openItem(item)}
                onSave={() => toggleSave(item)}
                onLike={() => toggleLike(item)}
                onShare={() => shareItem(item)}
              />
            ))}
          </div>
        )}

        {mode === "videos" && (
          <div className="tt-stagger grid grid-cols-1 gap-x-4 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <div key={item.id}>
                <VideoTile item={item} onOpen={() => openItem(item)} />
                <div className="mt-2.5 flex gap-2.5">
                  <span className="tt-brand-tile mt-0.5 h-8 w-8 flex-shrink-0 rounded-full text-[10px] font-bold">
                    {item.author.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold leading-snug line-clamp-2 cursor-pointer hover:text-primary">
                      {item.title}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span>{item.author}</span>
                      <span>·</span>
                      <span>{formatCount(item.views)} vues</span>
                      <span>·</span>
                      <span>{item.date}</span>
                      <SourceBadge source={item.source} />
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

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

function FeedBar({
  tab,
  mode,
  length,
  onTab,
  onMode,
  onLength,
}: {
  tab: "pour-toi" | "abonnements";
  mode: FeedMode;
  length: LengthFilter;
  onTab: (tab: "pour-toi" | "abonnements") => void;
  onMode: (mode: FeedMode) => void;
  onLength: (length: LengthFilter) => void;
}) {
  return (
    <div className="mb-5">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-glass-border pb-3">
        <div className="flex items-center gap-5">
          {(["pour-toi", "abonnements"] as const).map((id) => {
            const active = tab === id;
            return (
              <button key={id} onClick={() => onTab(id)} className="tt-btn relative px-1 pb-2 text-[15px]">
                <span className={active ? "text-foreground font-bold" : "text-muted-foreground font-medium"}>
                  {id === "pour-toi" && <Sparkles size={13} className="inline -mt-0.5 mr-1 text-primary" />}
                  {id === "pour-toi" ? "Pour toi" : "Abonnements"}
                </span>
                {active && (
                  <span
                    className="absolute bottom-[-13px] left-0 right-0 h-[3px] rounded-full"
                    style={{ background: "var(--violet)" }}
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="tt-glass ml-auto flex items-center gap-1 rounded-full p-1">
          {MODES.map(({ id, label, icon: Icon }) => {
            const active = mode === id;
            return (
              <button
                key={id}
                onClick={() => onMode(id)}
                title={label}
                className={`tt-btn gap-1.5 px-3 py-1.5 text-[12px] ${
                  active ? "tt-btn-brand" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon size={14} />
                <span className="hidden sm:inline">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {mode === "videos" && (
        <div className="mt-4 flex items-center gap-2">
          {(
            [
              { id: "long" as const, label: "Format long" },
              { id: "short" as const, label: "Format court" },
            ]
          ).map(({ id, label }) => (
            <button
              key={id}
              onClick={() => onLength(id)}
              className={`tt-chip transition-colors ${
                length === id ? "tt-chip-active font-semibold" : "text-muted-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ShortsSkeleton() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="tt-skeleton h-[70vh] w-[min(430px,90vw)] rounded-[28px]" />
    </div>
  );
}

function EmptyState({ tab, mode }: { tab: "pour-toi" | "abonnements"; mode: FeedMode }) {
  return (
    <div className="py-16 text-center space-y-4">
      <div className="flex justify-center">
        <span className="tt-glass tt-btn w-14 h-14">
          {tab === "abonnements" ? (
            <Sparkles size={22} className="text-primary" />
          ) : (
            <Inbox size={22} className="text-primary" />
          )}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">
        {tab === "abonnements"
          ? "Aucun contenu dans vos centres d'intérêt. Modifiez vos intérêts dans votre profil."
          : mode === "shorts"
            ? "Pas encore de vidéos lisibles en Shorts."
            : "Aucun contenu pour le moment. Revenez plus tard !"}
      </p>
    </div>
  );
}
