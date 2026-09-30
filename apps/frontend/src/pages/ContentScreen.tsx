import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  BookmarkCheck,
  Plus,
  ExternalLink,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../services/api";
import { ContentItem } from "../types/content";
import { mapBackendContentToItem, formatCount } from "../lib/content";
import { VideoTile } from "../components/VideoTile";
import { SourceBadge } from "../components/SourceBadge";
import { useAppStore } from "../app/store";

const EMBED_ALLOWED_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

function sanitizeEmbedCode(html: string | null | undefined): string {
  if (!html) return "";
  const match = html.match(/<iframe[^>]*\bsrc=["']([^"']+)["']/i);
  if (!match) return "";
  try {
    const url = new URL(match[1]);
    if (!EMBED_ALLOWED_HOSTS.has(url.hostname)) return "";
    if (!url.pathname.startsWith("/embed/")) return "";
    return `<iframe title="Lecteur vidéo" src="${url.toString()}" width="100%" height="100%" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
  } catch {
    return "";
  }
}

interface LocalComment {
  author: string;
  text: string;
  at: string;
}

export function ContentScreen() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { savedIds, toggleSave, markRead, user } = useAppStore();

  const [item, setItem] = useState<ContentItem | null>(
    (location.state as { item?: ContentItem } | null)?.item ?? null
  );
  const [pool, setPool] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(!item);
  const [liked, setLiked] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [suggestFilter, setSuggestFilter] = useState<string>("Tout");
  const [comments, setComments] = useState<LocalComment[]>([]);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    let cancelled = false;
    api
      .getContents(60, 0)
      .then((contents) => {
        if (cancelled) return;
        const mapped = contents.map(mapBackendContentToItem);
        setPool(mapped);
        if (!item) {
          const found = mapped.find((c) => c.id === id);
          if (found) {
            setItem(found);
            markRead(found);
          }
        }
      })
      .catch(() => undefined)
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!item) return;
    try {
      const raw = localStorage.getItem(`teachtalk_comments_${item.id}`);
      setComments(raw ? JSON.parse(raw) : []);
    } catch {
      setComments([]);
    }
  }, [item]);

  const suggestions = useMemo(() => {
    if (!item) return [];
    const tags = new Set([item.category, ...(item.categories || [])].map((t) => t.toLowerCase()));
    return pool
      .filter((p) => p.id !== item.id)
      .filter((p) => (suggestFilter === "Tout" ? true : p.source === suggestFilter))
      .sort((a, b) => {
        const aMatch = [a.category, ...(a.categories || [])].filter((t) => tags.has(t.toLowerCase())).length;
        const bMatch = [b.category, ...(b.categories || [])].filter((t) => tags.has(t.toLowerCase())).length;
        if (aMatch !== bMatch) return bMatch - aMatch;
        return b.likes - a.likes;
      })
      .slice(0, 10);
  }, [pool, item, suggestFilter]);

  const sourceChips = useMemo(() => {
    const set = new Set(pool.map((p) => p.source));
    return ["Tout", ...Array.from(set)];
  }, [pool]);

  if (loading && !item) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-6 space-y-4">
          <div className="tt-skeleton aspect-[16/9] rounded-2xl" />
          <div className="tt-skeleton h-6 w-2/3" />
          <div className="tt-skeleton h-4 w-1/3" />
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
        <p className="text-sm text-muted-foreground">Contenu introuvable.</p>
        <Link to="/feed" className="tt-btn tt-btn-brand px-5 py-2.5 text-sm">
          Retour au flux
        </Link>
      </div>
    );
  }

  const isSaved = savedIds.has(item.id);

  const share = async () => {
    const link = `${window.location.origin}/content/${item!.id}`;
    try {
      if (navigator.share) await navigator.share({ title: item!.title, url: link });
      else {
        await navigator.clipboard.writeText(link);
        toast.success("Lien copié !");
      }
    } catch {
      /* annulé */
    }
  };

  const addComment = (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    const next = [...comments, { author: user?.name || "Anonyme", text, at: new Date().toISOString() }];
    setComments(next);
    localStorage.setItem(`teachtalk_comments_${item!.id}`, JSON.stringify(next));
    setDraft("");
  };

  return (
    <div className="flex-1 overflow-y-auto tt-scrollbar">
      <div className="max-w-6xl mx-auto px-3 md:px-6 py-5 grid lg:grid-cols-[minmax(0,1fr)_320px] gap-6">
        {/* Main column */}
        <div className="min-w-0 tt-fade-up">
          <button
            onClick={() => navigate(-1)}
            className="tt-btn mb-3 gap-2 px-2 py-1.5 text-[13px] text-muted-foreground hover:text-foreground hover:bg-surface-2"
          >
            <ArrowLeft size={16} /> Retour
          </button>

          {/* Player / hero */}
          <div className="relative aspect-video rounded-2xl overflow-hidden bg-black border border-border">
            {item.type === "video" && item.embedCode ? (
              <div
                className="w-full h-full [&>iframe]:w-full [&>iframe]:h-full"
                dangerouslySetInnerHTML={{ __html: sanitizeEmbedCode(item.embedCode) }}
              />
            ) : (
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="block w-full h-full group">
                <img src={item.image} alt={item.title} className="w-full h-full object-cover opacity-90" />
                <span className="absolute inset-0 tt-scrim" />
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="tt-glass-strong w-16 h-16 rounded-full inline-flex items-center justify-center border-white/20 group-hover:scale-110 transition-transform">
                    <ExternalLink size={22} className="text-white" />
                  </span>
                </span>
              </a>
            )}
          </div>

          <h1 className="text-xl md:text-2xl font-extrabold tracking-tight leading-snug mt-4 mb-3">
            {item.title}
          </h1>

          {/* Author + actions */}
          <div className="tt-card p-4 flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <span className="tt-brand-tile w-10 h-10 rounded-full text-[11px] font-bold flex-shrink-0">
                {item.author.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold truncate">{item.author}</p>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                  <SourceBadge source={item.source} /> {item.date}
                </p>
              </div>
            </div>
            <button
              onClick={() => toast.info("Les abonnements aux créateurs arrivent bientôt !")}
              className="tt-btn tt-btn-brand px-5 py-2 text-sm flex-shrink-0 gap-1.5"
            >
              <Plus size={14} /> S'abonner
            </button>
            <div className="flex items-center gap-1 sm:border-l sm:border-border/60 sm:pl-3">
              <button
                onClick={() => setLiked((v) => !v)}
                className={`tt-btn gap-1.5 px-3 py-2 text-[12px] ${liked ? "text-primary bg-primary/10" : "text-muted-foreground hover:bg-surface-2"}`}
              >
                <Heart size={15} className={liked ? "fill-primary" : ""} /> {formatCount(item.likes + (liked ? 1 : 0))}
              </button>
              <span className="tt-btn gap-1.5 px-3 py-2 text-[12px] text-muted-foreground">
                <MessageCircle size={15} /> {formatCount(item.comments + comments.length)}
              </span>
              <button onClick={share} className="tt-btn gap-1.5 px-3 py-2 text-[12px] text-muted-foreground hover:bg-surface-2">
                <Share2 size={15} /> <span className="hidden md:inline">Partager</span>
              </button>
              <button
                onClick={() => toggleSave(item)}
                className={`tt-btn gap-1.5 px-3 py-2 text-[12px] ${isSaved ? "text-primary bg-primary/10" : "text-muted-foreground hover:bg-surface-2"}`}
              >
                {isSaved ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
                <span className="hidden md:inline">{isSaved ? "Enregistré" : "Enregistrer"}</span>
              </button>
            </div>
          </div>

          {/* Description */}
          <div className="tt-card p-4 mb-4">
            <p className={`text-[13px] leading-relaxed text-foreground/85 ${expanded ? "" : "line-clamp-3"}`}>
              {item.bodyHtml ? (
                <span className="article-body" dangerouslySetInnerHTML={{ __html: item.bodyHtml }} />
              ) : (
                item.summary
              )}
            </p>
            <button onClick={() => setExpanded((v) => !v)} className="text-[12px] font-semibold text-primary mt-2 hover:underline">
              {expanded ? "Réduire" : "... plus"}
            </button>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {(item.categories && item.categories.length > 0 ? item.categories : [item.category]).map((tag) => (
                <span key={tag} className="text-[11px] font-medium text-primary/90 bg-primary/8 px-2 py-0.5 rounded-full">
                  #{tag.toLowerCase().replace(/\s+/g, "")}
                </span>
              ))}
            </div>
          </div>

          {/* Original source */}
          <div className="tt-card p-4 mb-6 flex items-center gap-3">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1">Source originale</p>
              <p className="text-sm font-semibold truncate">{item.source}</p>
            </div>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="tt-btn tt-btn-ghost ml-auto px-4 py-2 text-[13px] gap-1.5 flex-shrink-0"
            >
              Voir sur {item.source} <ExternalLink size={13} />
            </a>
          </div>

          {/* Comments (local to this browser — no backend yet) */}
          <section className="tt-card p-4">
            <h2 className="text-sm font-bold mb-4">Commentaires ({comments.length})</h2>
            <form onSubmit={addComment} className="flex items-center gap-2 mb-5">
              <span className="tt-brand-tile w-8 h-8 rounded-full flex-shrink-0 overflow-hidden">
                {user?.picture ? <img src={user.picture} alt="" className="w-full h-full object-cover" /> : "🙂"}
              </span>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Écrire un commentaire..."
                className="tt-field flex-1 px-3.5 py-2 text-sm"
              />
              <button type="submit" className="tt-btn tt-btn-brand p-2.5" aria-label="Envoyer">
                <Send size={15} />
              </button>
            </form>
            {comments.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">Aucun commentaire. Lancez la discussion !</p>
            ) : (
              <ul className="space-y-4">
                {comments.map((c, i) => (
                  <li key={i} className="flex gap-2.5">
                    <span className="tt-brand-tile w-7 h-7 rounded-full text-[10px] font-bold flex-shrink-0">
                      {c.author.slice(0, 1).toUpperCase()}
                    </span>
                    <div>
                      <p className="text-[12px] font-semibold">
                        {c.author}{" "}
                        <span className="text-muted-foreground font-normal ml-1">
                          {new Date(c.at).toLocaleDateString("fr-FR")}
                        </span>
                      </p>
                      <p className="text-[13px] text-foreground/85 leading-relaxed">{c.text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[10px] text-muted-foreground/70 mt-4">
              Les commentaires sont enregistrés localement dans votre navigateur (pas encore de backend).
            </p>
          </section>
        </div>

        {/* Suggestions sidebar */}
        <aside className="hidden lg:block">
          <h2 className="text-sm font-bold mb-3">Suggestions</h2>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {sourceChips.map((s) => (
              <button
                key={s}
                onClick={() => setSuggestFilter(s)}
                className={`tt-btn px-3 py-1 text-[11px] font-semibold ${
                  suggestFilter === s ? "tt-btn-brand" : "tt-btn-ghost"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="space-y-1">
            {suggestions.map((s) => (
              <VideoTile
                key={s.id}
                item={s}
                compact
                onOpen={() => navigate(`/content/${s.id}`, { state: { item: s } })}
              />
            ))}
            {suggestions.length === 0 && (
              <p className="text-[12px] text-muted-foreground px-1">Aucune suggestion pour ce filtre.</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
