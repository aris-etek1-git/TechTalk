import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Search, X, Users, Flame, GraduationCap } from "lucide-react";
import { api, Campus } from "../services/api";
import { ContentItem } from "../types/content";
import { mapBackendContentToItem, formatCount } from "../lib/content";
import { VideoTile } from "../components/VideoTile";
import { SourceBadge } from "../components/SourceBadge";
import { useAppStore } from "../app/store";

type ExploreTab = "tout" | "videos" | "createurs" | "communautes";

const TABS: { id: ExploreTab; label: string }[] = [
  { id: "tout", label: "Tout" },
  { id: "videos", label: "Vidéos" },
  { id: "createurs", label: "Créateurs" },
  { id: "communautes", label: "Communautés" },
];

export function ExploreScreen() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { savedIds, toggleSave, markRead } = useAppStore();

  const q = params.get("q") || "";
  const source = params.get("source") || "";
  const category = params.get("category") || "";
  const tab = (params.get("tab") as ExploreTab) || "tout";

  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [inputValue, setInputValue] = useState(q);

  useEffect(() => setInputValue(q), [q]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .getContents(100, 0, q || undefined)
      .then((contents) => {
        if (!cancelled) setItems(contents.map(mapBackendContentToItem));
      })
      .catch((err) => console.error("Search failed:", err))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [q]);

  useEffect(() => {
    if (tab !== "communautes") return;
    api.getCampuses().then(setCampuses).catch(() => setCampuses([]));
  }, [tab]);

  const results = useMemo(() => {
    let list = items;
    if (source) list = list.filter((i) => i.source === source);
    if (category)
      list = list.filter((i) =>
        [i.category, ...(i.categories || [])].some(
          (t) => t.toLowerCase() === category.toLowerCase() || t.toLowerCase().includes(category.toLowerCase())
        )
      );
    if (tab === "videos") list = list.filter((i) => i.type === "video");
    return list;
  }, [items, source, category, tab]);

  const creators = useMemo(() => {
    const map = new Map<string, { name: string; count: number; likes: number; item: ContentItem }>();
    for (const i of results) {
      const key = i.author;
      const prev = map.get(key);
      if (prev) {
        prev.count += 1;
        prev.likes += i.likes;
      } else {
        map.set(key, { name: key, count: 1, likes: i.likes, item: i });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [results]);

  const setTab = (t: ExploreTab) => {
    const next = new URLSearchParams(params);
    if (t === "tout") next.delete("tab");
    else next.set("tab", t);
    setParams(next);
  };

  const submit = (value: string) => {
    const next = new URLSearchParams(params);
    if (value.trim()) next.set("q", value.trim());
    else next.delete("q");
    setParams(next);
  };

  const clearFilters = () => {
    const next = new URLSearchParams(params);
    next.delete("source");
    next.delete("category");
    setParams(next);
  };

  const openItem = (item: ContentItem) => {
    markRead(item);
    navigate(`/content/${item.id}`, { state: { item } });
  };

  const heading = q
    ? `Résultats pour "${q}"`
    : category
      ? `Catégorie : ${category}`
      : source
        ? `Source : ${source}`
        : "Découvrir";

  return (
    <div className="flex-1 overflow-y-auto tt-scrollbar">
      <div className="max-w-5xl mx-auto px-3 md:px-6 py-5">
        {/* Search bar + tabs */}
        <div className="relative mb-4 max-w-xl">
          <input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit(inputValue)}
            placeholder="Rechercher des vidéos, créateurs, sujets..."
            className="tt-field w-full pl-10 pr-10 py-2.5 text-sm"
          />
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          {inputValue && (
            <button
              onClick={() => {
                setInputValue("");
                submit("");
              }}
              className="tt-btn absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground"
              aria-label="Effacer"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-5 border-b border-border/60 mb-2">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} className="tt-btn relative px-1 pb-2.5 text-sm">
                <span className={active ? "text-foreground font-bold" : "text-muted-foreground font-medium"}>{t.label}</span>
                {active && (
                  <span className="absolute bottom-[-1px] left-0 right-0 h-[3px] rounded-full" style={{ background: "var(--brand-gradient)" }} />
                )}
              </button>
            );
          })}
        </div>

        {/* Active filters */}
        {(source || category) && (
          <div className="flex items-center gap-2 mt-3 text-[12px]">
            {source && <span className="tt-chip">Source : {source}</span>}
            {category && <span className="tt-chip">Catégorie : {category}</span>}
            <button onClick={clearFilters} className="text-muted-foreground hover:text-foreground underline underline-offset-2">
              Effacer
            </button>
          </div>
        )}

        <h1 className="text-[17px] font-extrabold tracking-tight mt-4 mb-4">{heading}</h1>

        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="tt-card overflow-hidden">
                <div className="tt-skeleton aspect-[16/9] rounded-none" />
                <div className="p-3 space-y-2">
                  <div className="tt-skeleton h-4 w-3/4" />
                  <div className="tt-skeleton h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && tab !== "createurs" && tab !== "communautes" && (
          <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 tt-stagger">
              {results.map((item) => (
                <VideoTile key={item.id} item={item} onOpen={() => openItem(item)} />
              ))}
            </div>
            <div className="hidden lg:block space-y-1">
              {results.slice(0, 12).map((item) => (
                <div key={item.id} className="tt-card p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <SourceBadge source={item.source} />
                    <span className="text-[11px] text-muted-foreground ml-auto">{item.date}</span>
                  </div>
                  <p
                    className="text-[13px] font-bold leading-snug line-clamp-2 cursor-pointer hover:text-primary transition-colors"
                    onClick={() => openItem(item)}
                  >
                    {item.title}
                  </p>
                  <p className="text-[12px] text-muted-foreground line-clamp-2 mt-1">{item.summary}</p>
                  <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      {item.author}
                    </span>
                    <span className="ml-auto flex items-center gap-1">
                      <Flame size={11} className="text-primary" /> {formatCount(item.likes)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && tab === "createurs" && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 tt-stagger">
            {creators.map((c) => (
              <div key={c.name} className="tt-card p-5 flex flex-col items-center text-center gap-2">
                <span className="tt-brand-tile w-14 h-14 rounded-full text-sm font-bold">
                  {c.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
                </span>
                <p className="text-sm font-bold">{c.name}</p>
                <p className="text-[12px] text-muted-foreground">
                  {c.count} contenu{c.count > 1 ? "s" : ""} · {formatCount(c.likes)} réactions
                </p>
                <button
                  onClick={() => submit(c.name)}
                  className="tt-btn tt-btn-ghost px-4 py-1.5 text-[12px] mt-1 gap-1.5"
                >
                  <Users size={13} /> Voir les contenus
                </button>
              </div>
            ))}
            {creators.length === 0 && <p className="text-sm text-muted-foreground">Aucun créateur trouvé.</p>}
          </div>
        )}

        {!loading && tab === "communautes" && (
          <div className="space-y-3">
            <p className="text-[13px] text-muted-foreground mb-2">
              Les communautés TechTalk sont vos campus — rejoignez le vôtre pour partager annales, groupes et événements.
            </p>
            {campuses.map((c) => (
              <Link key={c.id} to="/campus" className="tt-card tt-card-hover p-4 flex items-center gap-4">
                <span className="tt-brand-tile w-10 h-10 rounded-xl">
                  <GraduationCap size={17} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold truncate">{c.name}</p>
                  <p className="text-[12px] text-muted-foreground truncate">
                    {c.organization.name}
                    {c.city ? ` · ${c.city}` : ""}
                    {c.description ? ` · ${c.description}` : ""}
                  </p>
                </div>
                <span className="tt-btn tt-btn-ghost ml-auto px-4 py-1.5 text-[12px] flex-shrink-0">
                  {c.myRole ? "Mon campus" : "Rejoindre"}
                </span>
              </Link>
            ))}
            {campuses.length === 0 && <p className="text-sm text-muted-foreground">Aucune communauté disponible.</p>}
          </div>
        )}

        {!loading && tab !== "createurs" && tab !== "communautes" && results.length === 0 && (
          <div className="py-16 text-center space-y-3">
            <p className="text-sm text-muted-foreground">Aucun résultat. Essayez d'autres mots-clés ou retirez les filtres.</p>
          </div>
        )}
      </div>
    </div>
  );
}
