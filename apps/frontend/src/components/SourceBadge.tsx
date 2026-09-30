import { ContentSource } from "../types/content";

/* Hue per source, with a light-mode text tone dark enough to stay readable
   on a white card. */
const SOURCE_STYLES: Record<string, { chip: string; dot: string }> = {
  Reddit: { chip: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/25", dot: "bg-orange-500" },
  YouTube: { chip: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/25", dot: "bg-red-500" },
  Medium: { chip: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/25", dot: "bg-emerald-500" },
  "Dev.to": { chip: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/25", dot: "bg-slate-400" },
  TechCrunch: { chip: "bg-lime-500/15 text-lime-700 dark:text-lime-300 border-lime-500/25", dot: "bg-lime-500" },
};

export function SourceBadge({ source }: { source: ContentSource }) {
  const s = SOURCE_STYLES[source] || {
    chip: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/25",
    dot: "bg-sky-500",
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
