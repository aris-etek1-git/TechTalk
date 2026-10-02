import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Search,
  X,
  Users,
  GraduationCap,
  Compass,
  TrendingUp,
  Play,
  FolderGit2,
  Sparkles,
  ArrowUpRight,
  ArrowLeft,
  Plus,
  GitBranch,
  ExternalLink,
} from "lucide-react";
import { api, Campus, Project, TagRef } from "../services/api";
import { ContentItem } from "../types/content";
import { mapBackendContentToItem, mapFeedItemToItem, formatCount, relativeDateFr } from "../lib/content";
import { VideoTile } from "../components/VideoTile";
import { FeedCard } from "../components/FeedCard";
import { useAppStore } from "../app/store";

/* Facebook-style explore: one structured page that mixes the entity types a
   learner actually browses — topics, videos, projects, creators, communities —
   as labelled sections rather than one flat list. A search or a chosen topic
   collapses the hub into a focused stream, which is the same behaviour. */

const PROJECT_STATUS_LABELS: Record<Project["status"], string> = {
  idea: "Idée",
  planned: "Planifié",
  in_progress: "En cours",
  completed: "Terminé",
  abandoned: "Abandonné",
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();
}

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  action,
}: {
  icon: typeof Compass;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <span className="tt-btn tt-glass p-2 text-primary">
          <Icon size={16} />
        </span>
        <div>
          <h2 className="text-[15px] font-bold tracking-tight">{title}</h2>
          {subtitle && <p className="text-[12px] text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

function TopicChip({ tag, active, onClick }: { tag: TagRef; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`tt-chip whitespace-nowrap px-3.5 py-2 text-[12px] transition-all ${active ? "tt-btn-brand border-transparent" : "text-muted-foreground hover:text-foreground"}`}>
      #{tag.name}
      {typeof tag.usageCount === "number" && tag.usageCount > 0 && (
        <span className="ml-1.5 text-[10px] opacity-70">{formatCount(tag.usageCount)}</span>
      )}
    </button>
  );
}

function ProjectCard({ project }: { project: Project }) {
  return (
    <div className="tt-card tt-card-hover flex h-full flex-col p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="tt-chip text-[10px]">{PROJECT_STATUS_LABELS[project.status]}</span>
        <span className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground">
          <Users size={11} /> {project.owner.name}
        </span>
      </div>
      <h3 className="text-[14px] font-bold leading-snug line-clamp-1">{project.name}</h3>
      {project.description && <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground line-clamp-2">{project.description}</p>}
      {project.technologies.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {project.technologies.slice(0, 4).map((tech) => (
            <span key={tech} className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              {tech}
            </span>
          ))}
        </div>
      )}
      <div className="mt-auto flex items-center gap-3 pt-3 text-[11px] text-muted-foreground">
        {project.repositoryUrl && (
          <a href={project.repositoryUrl} target="_blank" rel="noreferrer" className="tt-btn gap-1 hover:text-foreground">
            <GitBranch size={12} /> Code
          </a>
        )}
        {project.demoUrl && (
          <a href={project.demoUrl} target="_blank" rel="noreferrer" className="tt-btn gap-1 hover:text-foreground">
            <ExternalLink size={12} /> Démo
          </a>
        )}
        <span className="ml-auto">{relativeDateFr(project.createdAt)}</span>
      </div>
    </div>
  );
}

export function ExploreScreen() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { markRead, savedIds, toggleSave, likedIds, toggleLike } = useAppStore();

  const q = params.get("q")?.trim() || "";
  const topicSlug = params.get("topic") || "";

  const [topics, setTopics] = useState<TagRef[]>([]);
  const [poured, setPoured] = useState<ContentItem[]>([]); // "Pour vous"
  const [videos, setVideos] = useState<ContentItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [pool, setPool] = useState<ContentItem[]>([]); // creator source
  const [homeLoading, setHomeLoading] = useState(true);

  const [focusItems, setFocusItems] = useState<ContentItem[]>([]);
  const [focusTag, setFocusTag] = useState<TagRef | null>(null);
  const [searchTags, setSearchTags] = useState<TagRef[]>([]);
  const [searchProjects, setSearchProjects] = useState<Project[]>([]);
  const [focusLoading, setFocusLoading] = useState(false);
  const [inputValue, setInputValue] = useState(q);
  useEffect(() => setInputValue(q), [q]);

  const mode: "home" | "topic" | "search" = q ? "search" : topicSlug ? "topic" : "home";

  const loadHome = useCallback(async () => {
    setHomeLoading(true);
    const [feed, vids, prj, tags, camp, all] = await Promise.allSettled([
      api.getFeed({ limit: 8 }),
      api.getContents(12, 0, undefined, "video"),
      api.getProjects({ limit: 6 }),
      api.getTags({ limit: 16 }),
      api.getCampuses(),
      api.getContents(80, 0),
    ]);
    if (feed.status === "fulfilled") setPoured(feed.value.items.map(mapFeedItemToItem));
    if (vids.status === "fulfilled") setVideos(vids.value.map(mapBackendContentToItem));
    if (prj.status === "fulfilled") setProjects(prj.value);
    if (tags.status === "fulfilled") setTopics(tags.value);
    if (camp.status === "fulfilled") setCampuses(camp.value);
    if (all.status === "fulfilled") setPool(all.value.map(mapBackendContentToItem));
    setHomeLoading(false);
  }, []);

  useEffect(() => {
    if (mode !== "home") return;
    loadHome();
  }, [mode, loadHome]);

  // Topic and search both produce one focused stream, so they share an effect.
  useEffect(() => {
    if (mode === "home") return;
    let cancelled = false;
    setFocusLoading(true);
    (async () => {
      try {
        if (mode === "topic") {
          const { tag, contents } = await api.getTagContents(topicSlug, { limit: 30 });
          if (cancelled) return;
          setFocusTag(tag);
          setSearchTags([]);
          setSearchProjects([]);
          setFocusItems(contents.map(mapBackendContentToItem));
        } else {
          // §35/§56: one query, grouped across contents, subjects and projects.
          // If the grouped endpoint is unavailable, fall back to a plain search
          // so the results stream never dead-ends.
          try {
            const r = await api.search(q, 12);
            if (cancelled) return;
            setFocusTag(null);
            setSearchTags(r.tags as TagRef[]);
            setSearchProjects(r.projects);
            setFocusItems(r.contents.map(mapBackendContentToItem));
          } catch {
            const contents = await api.getContents(40, 0, q);
            if (cancelled) return;
            setFocusTag(null);
            setSearchTags([]);
            setSearchProjects([]);
            setFocusItems(contents.map(mapBackendContentToItem));
          }
        }
      } catch (err) {
        console.error("Explore focus failed:", err);
        if (!cancelled) {
          setFocusItems([]);
          setSearchTags([]);
          setSearchProjects([]);
        }
      } finally {
        if (!cancelled) setFocusLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, topicSlug, q]);

  const creators = useMemo(() => {
    const map = new Map<string, { name: string; count: number; likes: number }>();
    for (const i of pool) {
      const prev = map.get(i.author);
      if (prev) {
        prev.count += 1;
        prev.likes += i.likes;
      } else {
        map.set(i.author, { name: i.author, count: 1, likes: i.likes });
      }
    }
    return Array.from(map.values())
      .filter((c) => c.name && c.name !== "TechTalk")
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [pool]);

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "q" && value) next.delete("q");
    else if (key === "q" && value) next.delete("topic");
    setParams(next);
  };

  const submit = (value: string) => setParam("q", value.trim() || null);

  const openItem = (item: ContentItem) => {
    markRead(item);
    navigate(`/content/${item.id}`, { state: { item } });
  };

  const shareItem = async (item: ContentItem) => {
    const link = `${window.location.origin}/content/${item.id}`;
    try {
      if (navigator.share) await navigator.share({ title: item.title, url: link });
      else await navigator.clipboard.writeText(link);
    } catch {
      /* partage annulé */
    }
  };

  return (
    <div className="flex-1 overflow-y-auto tt-scrollbar">
      <div className="mx-auto max-w-5xl px-3 md:px-6 py-5">
        {/* Search */}
        <div className="relative mb-4">
          <input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit(inputValue)}
            placeholder="Rechercher un sujet, une vidéo, un projet..."
            className="tt-field w-full py-2.5 pl-10 pr-10 text-sm"
          />
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
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

        {/* Topic rail — always present, it is the spine of the hub */}
        {topics.length > 0 && (
          <div className="-mx-3 mb-6 flex gap-2 overflow-x-auto px-3 pb-1 tt-scrollbar">
            <button
              onClick={() => setParam("topic", null)}
              className={`tt-chip whitespace-nowrap px-3.5 py-2 text-[12px] ${mode === "home" ? "tt-btn-brand border-transparent" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Compass size={12} className="mr-1 inline" /> Tendances
            </button>
            {topics.map((t) => (
              <TopicChip key={t.id} tag={t} active={mode === "topic" && t.slug === topicSlug} onClick={() => setParam("topic", t.slug)} />
            ))}
          </div>
        )}

        {/* ---------------- Focused stream: topic or search ---------------- */}
        {mode !== "home" && (
          <section className="tt-fade-up">
            <button onClick={() => setParam(topicSlug ? "topic" : "q", null)} className="tt-btn mb-3 gap-1.5 text-[12px] text-muted-foreground hover:text-foreground">
              <ArrowLeft size={14} /> {mode === "topic" ? focusTag?.name : `« ${q} »`} — retour
            </button>
            <h1 className="mb-4 text-[17px] font-bold tracking-tight">
              {mode === "topic" && focusTag ? `Contenus · ${focusTag.name}` : `Résultats pour « ${q} »`}
            </h1>

            {focusLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="tt-card flex gap-4 p-4">
                    <div className="tt-skeleton aspect-[16/9] w-72 rounded-2xl" />
                    <div className="flex-1 space-y-2 py-1">
                      <div className="tt-skeleton h-4 w-3/4" />
                      <div className="tt-skeleton h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : mode === "search" && focusItems.length === 0 && searchTags.length === 0 && searchProjects.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Rien trouvé pour « {q} ». Essayez un autre mot ou explorez les sujets tendance.
              </p>
            ) : (
              <div className="space-y-8">
                {/* Matching subjects, only in global search */}
                {mode === "search" && searchTags.length > 0 && (
                  <div>
                    <div className="mb-3 flex items-center gap-2 text-muted-foreground">
                      <TrendingUp size={15} />
                      <span className="tt-label">Sujets</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {searchTags.map((t) => (
                        <TopicChip key={t.id} tag={t} active={false} onClick={() => setParam("topic", t.slug)} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Matching public projects */}
                {mode === "search" && searchProjects.length > 0 && (
                  <div>
                    <div className="mb-3 flex items-center gap-2 text-muted-foreground">
                      <FolderGit2 size={15} />
                      <span className="tt-label">Projets</span>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {searchProjects.map((p) => (
                        <ProjectCard key={p.id} project={p} />
                      ))}
                    </div>
                  </div>
                )}

                {focusItems.length > 0 && (
                  <div>
                    {mode === "search" && (
                      <div className="mb-3 flex items-center gap-2 text-muted-foreground">
                        <Play size={15} />
                        <span className="tt-label">Contenus</span>
                      </div>
                    )}
                    <div className="space-y-4 tt-stagger">
                      {focusItems.map((item) => (
                        <FeedCard
                          key={item.id}
                          item={item}
                          isSaved={savedIds.has(item.id)}
                          isLiked={likedIds.has(item.id)}
                          onOpen={() => openItem(item)}
                          onSave={() => toggleSave(item)}
                          onLike={() => toggleLike(item)}
                          onShare={() => shareItem(item)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* ---------------- Home hub ---------------- */}
        {mode === "home" && (
          <div className="space-y-9 tt-fade-up">
            {/* Pour vous */}
            <section>
              <SectionHeader
                icon={Sparkles}
                title="Pour vous"
                subtitle="Recommandé selon vos centres d'intérêt"
                action={<Link to="/feed" className="text-[12px] font-semibold text-primary hover:underline">Tout le flux →</Link>}
              />
              {homeLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="tt-card flex gap-4 p-4">
                      <div className="tt-skeleton aspect-[16/9] w-72 rounded-2xl" />
                      <div className="flex-1 space-y-2 py-1">
                        <div className="tt-skeleton h-4 w-3/4" />
                        <div className="tt-skeleton h-3 w-2/3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4 tt-stagger">
                  {poured.map((item) => (
                    <FeedCard
                      key={item.id}
                      item={item}
                      isSaved={savedIds.has(item.id)}
                      isLiked={likedIds.has(item.id)}
                      onOpen={() => openItem(item)}
                      onSave={() => toggleSave(item)}
                      onLike={() => toggleLike(item)}
                      onShare={() => shareItem(item)}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Vidéos */}
            <section>
              <SectionHeader icon={Play} title="Vidéos à regarder" subtitle="Formats longs et Shorts de la semaine" />
              <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
                {videos.map((item) => (
                  <VideoTile key={item.id} item={item} onOpen={() => openItem(item)} />
                ))}
                {homeLoading && Array.from({ length: 3 }).map((_, i) => <div key={i} className="tt-skeleton aspect-video rounded-xl" />)}
              </div>
            </section>

            {/* Projets */}
            <section>
              <SectionHeader
                icon={FolderGit2}
                title="Projets publiés"
                subtitle="Ce que les étudiants ont construit"
                action={
                  <Link to="/create" className="tt-btn tt-btn-ghost gap-1.5 px-3 py-1.5 text-[12px]">
                    <Plus size={13} /> Publier
                  </Link>
                }
              />
              {projects.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {projects.map((p) => (
                    <ProjectCard key={p.id} project={p} />
                  ))}
                </div>
              ) : (
                <p className="text-[13px] text-muted-foreground">Aucun projet public pour l'instant. Soyez le premier à publier le vôtre.</p>
              )}
            </section>

            {/* Créateurs */}
            <section>
              <SectionHeader icon={Users} title="Créateurs en vue" subtitle="Les comptes qui publient le plus" />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {creators.map((c) => (
                  <button
                    key={c.name}
                    onClick={() => submit(c.name)}
                    className="tt-card tt-card-hover flex flex-col items-center gap-2 p-4 text-center"
                  >
                    <span className="tt-brand-tile flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold">{initials(c.name)}</span>
                    <span className="line-clamp-1 text-[13px] font-bold">{c.name}</span>
                    <span className="text-[11px] text-muted-foreground">{c.count} contenus · {formatCount(c.likes)} réactions</span>
                  </button>
                ))}
              </div>
            </section>

            {/* Communautés */}
            <section>
              <SectionHeader
                icon={GraduationCap}
                title="Communautés"
                subtitle="Vos campus : annales, groupes, événements"
                action={<Link to="/campus" className="text-[12px] font-semibold text-primary hover:underline">Explorer →</Link>}
              />
              <div className="space-y-2">
                {campuses.slice(0, 4).map((c) => (
                  <Link key={c.id} to="/campus" className="tt-card tt-card-hover flex items-center gap-4 p-4">
                    <span className="tt-brand-tile flex h-10 w-10 items-center justify-center rounded-xl">
                      <GraduationCap size={17} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{c.name}</p>
                      <p className="truncate text-[12px] text-muted-foreground">
                        {c.organization.name}
                        {c.city ? ` · ${c.city}` : ""}
                      </p>
                    </div>
                    <span className="tt-btn tt-btn-ghost ml-auto flex-shrink-0 px-4 py-1.5 text-[12px]">
                      <ArrowUpRight size={13} className="mr-1" /> {c.myRole ? "Mon campus" : "Rejoindre"}
                    </span>
                  </Link>
                ))}
                {campuses.length === 0 && !homeLoading && <p className="text-[13px] text-muted-foreground">Aucune communauté disponible.</p>}
              </div>
            </section>

            {/* Raccourcis thématiques */}
            <section className="border-t border-border/60 pt-6">
              <div className="mb-3 flex items-center gap-2 text-muted-foreground">
                <TrendingUp size={15} />
                <span className="tt-label">Parcourir par domaine</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {["Frontend", "Backend", "Systèmes", "Cybersécurité", "IA / Machine Learning", "DevOps", "Data", "Mobile"].map((label) => (
                  <button key={label} onClick={() => submit(label)} className="tt-chip px-3.5 py-2 text-[12px] text-muted-foreground hover:text-foreground">
                    {label}
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
