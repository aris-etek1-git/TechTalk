export type ContentSource = "Reddit" | "YouTube" | "GitHub" | "LeetCode" | "Medium" | "Dev.to" | "TechCrunch";
export type ContentType = "article" | "video" | "social_post";

/** A taxonomy tag (§9) as the feed and the tag endpoints return it. */
export interface ContentTag {
  id: string;
  slug: string;
  name: string;
  kind: "topic" | "skill" | "language" | "tool";
}

export interface ContentItem {
  id: string;
  type: ContentType;
  source: ContentSource;
  title: string;
  url: string;
  summary: string;
  image: string;
  duration?: string;
  readTime?: string;
  author: string;
  category: string;
  categories?: string[];
  body: string;
  bodyHtml?: string;
  date: string;
  publishedAt: string;
  likes: number;
  comments: number;
  views: number;
  embedCode?: string | null;
  youtubeId?: string;
  /** Full tag rows, when the item came from /api/feed or /api/content/:id. */
  tags?: ContentTag[];
  /* Ranking transparency (§82): why this item is in the page at all. */
  reasons?: string[];
  matchedTags?: string[];
  seen?: boolean;
}
