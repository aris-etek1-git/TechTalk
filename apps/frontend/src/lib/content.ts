import { ContentItem } from "../types/content";

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
  const source: string = c.source || "TechTalk";

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
    title: c.title,
    url: c.url,
    summary: c.summary || "Aucune description disponible.",
    image,
    duration,
    readTime,
    author: c.authorName || guessAuthor(source),
    category,
    categories,
    body: c.summary || "Aucun contenu disponible.",
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
   Rule-based ranking (no ML): tag match + popularity + freshness,
   then a diversity pass that avoids consecutive same-category cards.
------------------------------------------------------------------ */
export function rankForUser(items: ContentItem[], interests: string[]): ContentItem[] {
  const interestSet = new Set(interests.map((i) => i.toLowerCase()));

  const scored = items.map((item) => {
    let score = 0;
    const tags = [item.category, ...(item.categories || [])].map((t) => t.toLowerCase());
    const matches = tags.filter((t) =>
      [...interestSet].some((i) => t.includes(i) || i.includes(t))
    ).length;
    score += matches * 40;
    score += Math.log10(Math.max(1, item.likes)) * 12;
    const ageDays = (Date.now() - new Date(item.publishedAt).getTime()) / 86_400_000;
    score += Math.max(0, 30 - ageDays * 1.5);
    return { item, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const out: ContentItem[] = [];
  const pending = scored.map((s) => s.item);
  while (pending.length > 0) {
    let idx = pending.findIndex(
      (p, i) => i === 0 || p.category !== out[out.length - 1]?.category
    );
    if (idx === -1) idx = 0;
    out.push(...pending.splice(idx, 1));
  }
  return out;
}

export function matchesInterests(item: ContentItem, interests: string[]): boolean {
  if (interests.length === 0) return false;
  const tags = [item.category, ...(item.categories || [])].map((t) => t.toLowerCase());
  return interests.some((i) => {
    const l = i.toLowerCase();
    return tags.some((t) => t.includes(l) || l.includes(t));
  });
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

export const ALL_INTERESTS = [
  "AI & ML",
  "Frontend",
  "Backend",
  "Systems",
  "Security",
  "DevOps",
  "Databases",
  "Cloud",
  "Mobile",
  "Data",
];

export function loadInterests(): string[] {
  const raw = localStorage.getItem("teachtalk_interests");
  return raw ? JSON.parse(raw) : ["AI & ML", "Frontend", "Systems", "Security", "DevOps"];
}

export function saveInterests(next: string[]): void {
  localStorage.setItem("teachtalk_interests", JSON.stringify(next));
}
