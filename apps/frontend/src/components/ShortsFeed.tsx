import { useEffect, useRef, useState } from "react";
import { Bookmark, ExternalLink, Heart, MessageCircle, Play, Share2 } from "lucide-react";
import { ContentItem } from "../types/content";
import { formatCount } from "../lib/content";
import { SourceBadge } from "./SourceBadge";

interface ShortsFeedProps {
  items: ContentItem[];
  savedIds: Set<string>;
  onLoadMore: () => void;
  onSave: (item: ContentItem) => void;
  onShare: (item: ContentItem) => void;
  onOpen: (item: ContentItem) => void;
}

/* Vertical, snap-scrolling, one-item-per-screen stream. Only the active tile
   mounts a player, so scrolling stays cheap on mobile. */
export function ShortsFeed({ items, savedIds, onLoadMore, onShare, onSave, onOpen }: ShortsFeedProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  const indexRef = useRef(0);
  indexRef.current = active;

  const scrollTo = (i: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(i, items.length - 1));
    el.scrollTo({ top: clamped * el.clientHeight, behavior: "smooth" });
  };

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => {
      const next = Math.round(el.scrollTop / el.clientHeight);
      setActive((prev) => (prev === next ? prev : next));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        scrollTo(indexRef.current + 1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        scrollTo(indexRef.current - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items.length]);

  useEffect(() => {
    if (active >= items.length - 3) onLoadMore();
  }, [active, items.length, onLoadMore]);

  const toggleLike = (id: string) =>
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div
      ref={scrollerRef}
      className="h-full flex-1 overflow-y-auto snap-y snap-mandatory tt-scrollbar overscroll-contain"
    >
      {items.map((item, i) => {
        const isActive = i === active;
        const isSaved = savedIds.has(item.id);
        const isLiked = likedIds.has(item.id);
        return (
          <section
            key={item.id}
            className="h-full snap-start snap-always flex items-center justify-center px-3 py-3"
          >
            <div className="relative h-full w-full max-w-[430px] overflow-hidden rounded-[28px] border border-glass-border bg-black shadow-raised">
              {isActive && item.youtubeId ? (
                <iframe
                  title={item.title}
                  className="absolute inset-0 h-full w-full"
                  src={`https://www.youtube-nocookie.com/embed/${item.youtubeId}?autoplay=1&mute=1&playsinline=1&rel=0`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <button
                  onClick={() => onOpen(item)}
                  className="absolute inset-0 h-full w-full text-left"
                  aria-label={`Ouvrir ${item.title}`}
                >
                  <img
                    src={item.image}
                    alt={item.title}
                    className="h-full w-full object-cover"
                    loading={i > 1 ? "lazy" : "eager"}
                  />
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="tt-glass-strong flex h-14 w-14 items-center justify-center rounded-full">
                      <Play size={22} className="ml-0.5" />
                    </span>
                  </span>
                </button>
              )}

              <span className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 tt-scrim" />

              {/* Action rail */}
              <div className="absolute bottom-28 right-3 flex flex-col items-center gap-4">
                <RailButton
                  label={formatCount(item.likes + (isLiked ? 1 : 0))}
                  active={isLiked}
                  activeClass="text-primary"
                  onClick={() => toggleLike(item.id)}
                >
                  <Heart size={20} className={isLiked ? "fill-primary" : ""} />
                </RailButton>
                <RailButton label={formatCount(item.comments)} onClick={() => onOpen(item)}>
                  <MessageCircle size={20} />
                </RailButton>
                <RailButton
                  label={isSaved ? "Sauvé" : "Sauver"}
                  active={isSaved}
                  activeClass="text-accent"
                  onClick={() => onSave(item)}
                >
                  <Bookmark size={20} className={isSaved ? "fill-accent" : ""} />
                </RailButton>
                <RailButton label="Partager" onClick={() => onShare(item)}>
                  <Share2 size={20} />
                </RailButton>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tt-glass flex h-11 w-11 items-center justify-center rounded-full text-white"
                  aria-label="Ouvrir la source"
                >
                  <ExternalLink size={18} />
                </a>
              </div>

              {/* Meta */}
              <div className="absolute inset-x-0 bottom-0 p-4 pr-16 text-white">
                <div className="mb-2 flex items-center gap-2 text-[11px] opacity-90">
                  <SourceBadge source={item.source} />
                  <span className="font-mono">{item.duration ?? item.category}</span>
                  <span>· {formatCount(item.views)} vues</span>
                </div>
                <p className="line-clamp-2 text-[15px] font-bold leading-snug tracking-tight">
                  {item.title}
                </p>
                <p className="mt-1 text-[12px] opacity-80">
                  {item.author} · {item.date}
                </p>
              </div>

              {/* Progress */}
              <div className="absolute inset-x-4 top-4 h-[3px] overflow-hidden rounded-full bg-white/25">
                <div
                  className="h-full rounded-full bg-white transition-[width] duration-300"
                  style={{ width: `${items.length ? ((i + 1) / items.length) * 100 : 0}%` }}
                />
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function RailButton({
  children,
  label,
  active,
  activeClass = "",
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  active?: boolean;
  activeClass?: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1 text-white">
      <span
        className={`tt-glass flex h-11 w-11 items-center justify-center rounded-full transition-transform active:scale-90 ${
          active ? activeClass : ""
        }`}
      >
        {children}
      </span>
      <span className="text-[10px] font-semibold">{label}</span>
    </button>
  );
}
