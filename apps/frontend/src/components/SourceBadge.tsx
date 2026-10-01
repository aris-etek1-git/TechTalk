import { ContentSource } from "../types/content";

/* Hue per source, with a light-mode text tone dark enough to stay readable
   on a white card. */
const SOURCE_STYLES: Record<string, { chip: string; dot: string }> = {
  Reddit: { chip: "bg-primary/15 text-primary border-primary/25", dot: "bg-primary" },
  YouTube: { chip: "bg-primary/15 text-primary border-primary/25", dot: "bg-primary" },
  GitHub: { chip: "bg-foreground/10 text-foreground border-border", dot: "bg-foreground" },
  LeetCode: { chip: "bg-accent/15 text-accent border-accent/25", dot: "bg-accent" },
  Medium: { chip: "bg-accent/15 text-accent border-accent/25", dot: "bg-accent" },
  "Dev.to": { chip: "bg-foreground/10 text-foreground border-border", dot: "bg-muted-foreground" },
  TechCrunch: { chip: "bg-accent/15 text-accent border-accent/25", dot: "bg-accent" },
};

export function SourceBadge({ source }: { source: ContentSource }) {
  const s = SOURCE_STYLES[source] || {
    chip: "bg-accent/15 text-accent border-accent/25",
    dot: "bg-accent",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${s.chip}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
      {source}
    </span>
  );
}
