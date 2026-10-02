import { useState } from "react";
import { Play } from "lucide-react";
import { ContentItem } from "../types/content";
import { formatCount } from "../lib/content";

interface VideoTileProps {
  item: ContentItem;
  onOpen: () => void;
  compact?: boolean;
}

export function VideoTile({ item, onOpen, compact = false }: VideoTileProps) {
  const [imgFailed, setImgFailed] = useState(false);

  if (compact) {
    return (
      <button onClick={onOpen} className="tt-btn w-full gap-2.5 p-1.5 justify-start hover:bg-surface-2 text-left">
        <span className="relative w-24 aspect-[16/9] rounded-lg overflow-hidden bg-surface-2 flex-shrink-0">
          {!imgFailed ? (
            <img src={item.image} alt="" onError={() => setImgFailed(true)} className="w-full h-full object-cover" />
          ) : null}
          <span className="absolute bottom-0.5 right-0.5 text-[9px] font-mono text-white bg-black/70 px-1 rounded">
            {item.type === "video" ? item.duration : item.readTime}
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] font-semibold text-foreground leading-snug line-clamp-2">{item.title}</span>
          <span className="block text-[10px] text-muted-foreground mt-0.5 truncate">
            {item.author} · {formatCount(item.views)} vues · {item.date}
          </span>
        </span>
      </button>
    );
  }

  return (
    <button onClick={onOpen} className="tt-card tt-card-hover overflow-hidden group text-left w-full">
      <span className="relative block aspect-[16/9] bg-surface-2 overflow-hidden">
        {imgFailed ? (
          <span className="w-full h-full flex items-center justify-center" style={{ background: "var(--sky-soft)" }}>
            <Play size={24} className="text-muted-foreground/50" />
          </span>
        ) : (
          <img
            src={item.image}
            alt={item.title}
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover group-hover:scale-[1.05] transition-transform duration-700"
          />
        )}
        <span className="absolute inset-0 tt-scrim opacity-50" />
        <span className="absolute bottom-2 right-2 text-[11px] font-mono text-white bg-black/60 px-1.5 py-0.5 rounded-md">
          {item.type === "video" ? item.duration : item.readTime}
        </span>
      </span>
      <span className="block p-3">
        <span className="block text-[13px] font-bold text-foreground leading-snug line-clamp-2 tracking-tight">{item.title}</span>
        <span className="block text-[11px] text-muted-foreground mt-1.5 truncate">
          {item.author} · {formatCount(item.views)} vues · {item.date}
        </span>
      </span>
    </button>
  );
}
