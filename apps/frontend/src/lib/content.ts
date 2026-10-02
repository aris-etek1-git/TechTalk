import { ContentItem, ContentTag } from "../types/content";

const FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&h=500&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&h=500&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&h=500&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&h=500&fit=crop&auto=format",
];

/* Deterministic pseudo-random from the content id, so the same card always
   shows the same engagement numbers between renders and sessions. */
function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function formatCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + " M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + " k";
  return String(n);
}

export function relativeDateFr(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const minutes = Math.floor((Date.now() - then) / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "hier";
  if (days < 7) return `il y a ${days} jours`;
  if (days < 30) return `il y a ${Math.floor(days / 7)} semaine${Math.floor(days / 7) > 1 ? "s" : ""}`;
  if (days < 365) return `il y a ${Math.floor(days / 30)} mois`;
  return `il y a ${Math.floor(days / 365)} an(s)`;
}

function guessCategory(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("typescript") || t.includes("react") || t.includes("next") || t.includes("frontend") || t.includes("css")) return "Web Dev";
  if (t.includes("rust") || t.includes("c++") || t.includes("systems") || t.includes("kernel")) return "Systems";
  if (t.includes("ai") || t.includes("gpt") || t.includes("claude") || t.includes("intelligence") || t.includes("ml")) return "IA / Machine Learning";
  if (t.includes("database") || t.includes("postgres") || t.includes("sql")) return "Data";
  if (t.includes("kubernetes") || t.includes("docker") || t.includes("aws") || t.includes("devops")) return "DevOps";
  if (t.includes("security") || t.includes("cyber") || t.includes("vulnerab")) return "Cybersécurité";
  if (t.includes("mobile") || t.includes("ios") || t.includes("android") || t.includes("flutter")) return "Mobile";
  return "Technologie";
}

/* Providers hand over raw titles, so feed text can still carry the HTML
   entities it came with ("&#39;" for an apostrophe). textContent on a parsed
   fragment decodes them without ever running markup. */
const htmlParser = typeof DOMParser === "undefined" ? null : new DOMParser();

function decodeText(value: unknown): string {
  const raw = String(value ?? "");
  if (!raw.includes("&") || !htmlParser) return raw;
  return htmlParser.parseFromString(raw, "text/html").documentElement.textContent ?? raw;
}

/* Rows aggregated before the providers spoke French still carry an English
   placeholder, and a card that says "No description available." in a French
   interface reads as broken. */
const PLACEHOLDER = /^(no description available\.?|aucune description( disponible)?\.?)$/i;

function cleanSummary(value: unknown): string {
  const text = decodeText(value).replace(/\s+/g, " ").trim();
  return PLACEHOLDER.test(text) ? "" : text;
}

function guessAuthor(source: string): string {
  const s = source.toLowerCase();
  if (s.includes("dev.to")) return "Dev.to";
  if (s.includes("techcrunch")) return "TechCrunch";
  if (s.includes("youtube")) return "YouTube";
  if (s.includes("reddit")) return "Reddit";
  if (s.includes("medium")) return "Medium";
  return source || "TechTalk";
}

export function mapBackendContentToItem(c: any): ContentItem {
  const h = hashId(String(c.id));
  /* Channel and feed names arrive from scraping with stray whitespace, which
     makes the author look duplicated on the card. */
  const source: string = String(c.source ?? "").replace(/\s+/g, " ").trim() || "TechTalk";

  let image = c.image || "";
  let youtubeId = "";
  if (c.type === "video") {
    const match = String(c.url || "").match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
    if (match?.[1]) {
      youtubeId = match[1];
      image = image || `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
    }
  }
  if (!image) image = FALLBACK_IMAGES[h % FALLBACK_IMAGES.length];

  const wordCount = c.summary ? String(c.summary).split(/\s+/).length : 0;
  const readTime = c.type !== "video" ? `${Math.max(1, Math.round(wordCount / 180))} min` : undefined;

  let duration: string | undefined;
  if (c.type === "video") {
    const minutes = 3 + (h % 15);
    const seconds = (h >>> 4) % 60;
    duration = `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  const categories: string[] | undefined =
    c.categories && c.categories.length > 0 ? c.categories : undefined;
  const category = categories?.[0] || guessCategory(String(c.title || ""));

  const likes = 120 + (h % 90_000);
  const comments = 3 + ((h >>> 3) % Math.max(4, Math.floor(likes / 40)));
  const views = likes * (8 + (h % 20));

  return {
    id: c.id,
    type: c.type,
    source: source as ContentItem["source"],
    title: decodeText(c.title),
    url: c.url,
    summary: cleanSummary(c.summary) || "Aucune description.",
    image,
    duration,
    readTime,
    author: c.authorName || guessAuthor(source),
    category,
    categories,
    body: cleanSummary(c.summary) || "Aucun contenu.",
    bodyHtml: c.body || null,
    date: relativeDateFr(c.createdAt),
    publishedAt: c.createdAt,
    likes,
    comments,
    views,
    embedCode: c.embedCode,
    youtubeId: youtubeId || undefined,
  };
}

/* ------------------------------------------------------------------
   Feed items. Ranking, diversity and cursor pagination already happened
   on the server (§10/§11/§57), so here a row is only normalized for
   display and carries the reasons the ranker gave (§82).
------------------------------------------------------------------ */
export function mapFeedItemToItem(f: any): ContentItem {
  const tags = Array.isArray(f.tags) ? f.tags : [];
  const item = mapBackendContentToItem({
    ...f,
    authorName: f.author,
    categories: tags.map((t: any) => String(t.name)).filter(Boolean),
  });
  return {
    ...item,
    tags,
    reasons: Array.isArray(f.reasons) ? f.reasons : [],
    matchedTags: Array.isArray(f.matchedTags) ? f.matchedTags : [],
    seen: Boolean(f.seen),
  };
}

export const TAG_KIND_LABELS: Record<ContentTag["kind"], string> = {
  topic: "Sujets",
  skill: "Compétences",
  language: "Langages",
  tool: "Outils",
};

export type TagGroups = { kind: ContentTag["kind"]; label: string; tags: ContentTag[] }[];

/** The picker shows the dictionary grouped, never as one flat list of 40 chips. */
export function groupTagsByKind(tags: ContentTag[]): TagGroups {
  const order: ContentTag["kind"][] = ["topic", "skill", "language", "tool"];
  return order
    .map((kind) => ({ kind, label: TAG_KIND_LABELS[kind], tags: tags.filter((t) => t.kind === kind) }))
    .filter((group) => group.tags.length > 0);
}

/* Interests live on the server now (§16). The cache only exists so a reload
   paints the right chips before /users/me/interests answers. */
const INTEREST_CACHE_KEY = "teachtalk_interest_slugs";

export function loadInterestSlugs(): string[] {
  try {
    const raw = localStorage.getItem(INTEREST_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
}

export function saveInterestSlugs(slugs: string[]): void {
  localStorage.setItem(INTEREST_CACHE_KEY, JSON.stringify(slugs));
}

export const SIDEBAR_CATEGORIES: { label: string; value: string }[] = [
  { label: "Web Dev", value: "Web Dev" },
  { label: "Mobile", value: "Mobile" },
  { label: "IA / Machine Learning", value: "IA / Machine Learning" },
  { label: "DevOps", value: "DevOps" },
  { label: "Data", value: "Data" },
  { label: "Cybersécurité", value: "Cybersécurité" },
  { label: "Systems", value: "Systems" },
  { label: "Big Data", value: "Big Data" },
];
