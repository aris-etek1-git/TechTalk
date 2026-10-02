import { ContentSource } from "../types/content";

/* The source name already says which platform it is: the badge stays
   neutral so orange keeps meaning "you acted on this". */
export function SourceBadge({ source }: { source: ContentSource }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border border-border bg-secondary text-secondary-foreground">
      <span className="w-1 h-1 rounded-full flex-shrink-0 bg-muted-foreground" />
      {source}
    </span>
  );
}
