import { useState } from "react";
import { Play, Bookmark, BookmarkCheck, Heart, MessageCircle, Share2 } from "lucide-react";
import { ContentItem } from "../types/content";
import { formatCount } from "../lib/content";
import { SourceBadge } from "./SourceBadge";

interface FeedCardProps {
  item: ContentItem;
  isSaved: boolean;
  isLiked: boolean;
  onOpen: () => void;
  onSave: () => void;
  onLike: () => void;
  onShare?: () => void;
}

export function FeedCard({ item, isSaved, isLiked, onOpen, onSave, onLike, onShare }: FeedCardProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const [pop, setPop] = useState(false);
  const [likePop, setLikePop] = useState(false);

  /* Aggregated items often carry the platform as their author, and showing
     "Dev.to" twice on one line reads as a bug. */
  const sameAuthorAndSource = item.author.trim().toLowerCase() === item.source.trim().toLowerCase();

  const initials = item.author
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const handleSave = () => {
    onSave();
    setPop(true);
    window.setTimeout(() => setPop(false), 320);
  };

  const handleLike = () => {
    onLike();
    setLikePop(true);
    window.setTimeout(() => setLikePop(false), 320);
  };

  return (
    <article className="tt-card tt-card-hover p-4 flex flex-col sm:flex-row gap-4">
      <span className="tt-claw tt-claw-sm tt-claw-corner tt-claw-hover tt-claw-ghost" aria-hidden />
      {/* Thumbnail */}
      <div
        className="relative sm:w-72 md:w-80 flex-shrink-0 aspect-[16/9] rounded-xl bg-surface-2 overflow-hidden cursor-pointer group"
        onClick={onOpen}
      >
        {imgFailed ? (
          <div className="w-full h-full flex items-center justify-center" style={{ background: "var(--surface-2)" }}>
            <Play size={28} className="text-muted-foreground/50" />
          </div>
        ) : (
          <img
            src={item.image}
            alt={item.title}
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover group-hover:scale-[1.05] transition-transform duration-700"
          />
        )}
        {item.type === "video" && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/55 transition-transform group-hover:scale-105">
              <Play size={16} className="text-white fill-white ml-0.5" />
            </span>
          </span>
        )}
        <span className="absolute bottom-2 right-2 rounded bg-black/65 px-1.5 py-0.5 font-mono text-[11px] text-white">
          {item.type === "video" ? item.duration : item.readTime}
        </span>
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center gap-2 mb-1.5">
          {sameAuthorAndSource ? (
            <SourceBadge source={item.source} />
          ) : (
            <>
              <span className="tt-brand-tile h-6 w-6 flex-shrink-0 rounded-full text-[9px] font-bold">
                {initials}
              </span>
              <span className="text-[13px] font-semibold truncate">{item.author}</span>
              <SourceBadge source={item.source} />
            </>
          )}
          <div className="ml-auto flex items-center gap-3 text-[12px] text-muted-foreground flex-shrink-0">
            <button
              onClick={handleLike}
              aria-pressed={isLiked}
              aria-label={isLiked ? "Retirer le like" : "Liker"}
              className={`tt-btn flex items-center gap-1 p-1 -mr-1 ${likePop ? "tt-pop" : ""} ${
                isLiked ? "text-primary" : "hover:text-foreground"
              }`}
            >
              <Heart size={13} className={isLiked ? "fill-primary" : "fill-primary/20"} />
              {formatCount(item.likes + (isLiked ? 1 : 0))}
            </button>
            <span className="hidden sm:flex items-center gap-1">
              <MessageCircle size={13} />
              {formatCount(item.comments)}
            </span>
          </div>
        </div>

        <h2
          className="text-[15px] font-bold text-foreground leading-snug line-clamp-2 tracking-tight cursor-pointer hover:text-primary transition-colors"
          onClick={onOpen}
        >
          {item.title}
        </h2>
        <p className="text-[13px] text-muted-foreground leading-relaxed line-clamp-2 mt-1 cursor-pointer" onClick={onOpen}>
          {item.summary}
        </p>

        <div className="flex flex-wrap items-center gap-1.5 mt-auto pt-3">
          {(item.categories && item.categories.length > 0 ? item.categories : [item.category])
            .slice(0, 4)
            .map((tag) => (
              <span key={tag} className="tt-chip text-[11px]">
                #{tag}
              </span>
            ))}
          <span className="ml-auto flex items-center gap-1">
            <button
              onClick={onShare}
              className="tt-btn p-1.5 text-muted-foreground hover:text-foreground hover:bg-surface-2"
              aria-label="Partager"
            >
              <Share2 size={15} />
            </button>
            <button
              onClick={handleSave}
              aria-label={isSaved ? "Retirer des favoris" : "Enregistrer"}
              className={`tt-btn p-1.5 ${pop ? "tt-pop" : ""} ${
                isSaved ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-surface-2"
              }`}
            >
              {isSaved ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
            </button>
            <span className="text-[11px] text-muted-foreground ml-1 whitespace-nowrap">{item.date}</span>
          </span>
        </div>
      </div>
    </article>
  );
}
