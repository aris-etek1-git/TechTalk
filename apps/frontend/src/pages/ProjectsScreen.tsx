import { useState } from "react";
import { ExternalLink, GitBranch, Github, Plus, Star } from "lucide-react";

type Project = {
  name: string;
  author: string;
  description: string;
  technologies: string[];
  difficulty: "Débutant" | "Intermédiaire" | "Avancé";
  stars: number;
  status: "Idée" | "Planifié" | "En cours" | "Terminé";
  openSource: boolean;
  isNew: boolean;
};

const PROJECTS: Project[] = [
  {
    name: "Lumen Search",
    author: "Maya K.",
    description: "Moteur de recherche local, rapide et lisible pour des notes techniques.",
    technologies: ["Rust", "Search", "Systems"],
    difficulty: "Avancé",
    stars: 128,
    status: "En cours",
    openSource: true,
    isNew: false,
  },
  {
    name: "Campus OS",
    author: "Collectif ENSA",
    description: "Un kit open source pour organiser ressources, événements et entraide étudiante.",
    technologies: ["TypeScript", "React", "Campus"],
    difficulty: "Intermédiaire",
    stars: 84,
    status: "Terminé",
    openSource: true,
    isNew: false,
  },
  {
    name: "Tiny Vision Lab",
    author: "Noah A.",
    description: "Expériences reproductibles autour de la vision par ordinateur sur petits modèles.",
    technologies: ["Python", "IA", "Recherche"],
    difficulty: "Avancé",
    stars: 56,
    status: "Planifié",
    openSource: false,
    isNew: true,
  },
  {
    name: "API Atlas",
    author: "Samir B.",
    description: "Une collection d’APIs Fastify documentées par des cas d’usage réels.",
    technologies: ["Node.js", "Fastify", "REST"],
    difficulty: "Débutant",
    stars: 41,
    status: "En cours",
    openSource: true,
    isNew: true,
  },
];

const FILTERS = ["Tous", "Open source", "Nouveaux", "Par technologie", "Par difficulté"] as const;
type Filter = (typeof FILTERS)[number];

function groupBy(items: Project[], key: (p: Project) => string) {
  const groups = new Map<string, Project[]>();
  for (const item of items) {
    const k = key(item);
    groups.set(k, [...(groups.get(k) ?? []), item]);
  }
  return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], "fr"));
}

export function ProjectsScreen() {
  const [filter, setFilter] = useState<Filter>("Tous");

  const visible = PROJECTS.filter((p) =>
    filter === "Open source" ? p.openSource : filter === "Nouveaux" ? p.isNew : true
  );
  const groups =
    filter === "Par technologie"
      ? groupBy(visible, (p) => p.technologies[0])
      : filter === "Par difficulté"
        ? groupBy(visible, (p) => p.difficulty)
        : null;

  return (
    <div className="flex-1 overflow-y-auto tt-scrollbar">
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <header className="tt-fade-up">
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Les idées deviennent visibles.</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">Des projets réels, par technologie et par intention.</p>
          </header>
          <button className="tt-btn tt-btn-brand shrink-0 gap-2 px-4 py-2.5 text-xs">
            <Plus size={14} /> Ajouter un projet
          </button>
        </div>

        <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map((id) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={`tt-chip shrink-0 transition-colors ${
                filter === id ? "tt-chip-active font-semibold" : "text-muted-foreground"
              }`}
            >
              {id}
            </button>
          ))}
        </div>

        {groups ? (
          <div className="space-y-8">
            {groups.map(([label, items]) => (
              <section key={label}>
                <h2 className="tt-label mb-4">{label}</h2>
                <ProjectGrid items={items} />
              </section>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <p className="tt-card p-8 text-center text-sm text-muted-foreground">
            Aucun projet dans cette sélection pour le moment.
          </p>
        ) : (
          <ProjectGrid items={visible} />
        )}
      </div>
    </div>
  );
}

function ProjectGrid({ items }: { items: Project[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 tt-stagger">
      {items.map((project) => (
        <article key={project.name} className="tt-card tt-card-hover p-5">
          <div className="flex items-start justify-between gap-3">
            <span className="tt-brand-tile h-10 w-10 rounded-xl">
              <Github size={18} />
            </span>
            <span className="tt-chip text-[10px]">{project.status}</span>
          </div>
          <h3 className="mt-5 text-lg font-bold">{project.name}</h3>
          <p className="mt-1 text-xs text-muted-foreground">par {project.author}</p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{project.description}</p>
          <div className="mt-5 flex flex-wrap gap-1.5">
            {project.technologies.map((tag) => (
              <span key={tag} className="tt-chip text-[10px]">
                {tag}
              </span>
            ))}
            <span className="tt-chip text-[10px]">{project.difficulty}</span>
          </div>
          <div className="mt-5 flex items-center gap-4 border-t border-border pt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Star size={13} className="text-primary" /> {project.stars}
            </span>
            <span className="flex items-center gap-1">
              <GitBranch size={13} /> 12 contributions
            </span>
            <a
              href="https://github.com/explore"
              target="_blank"
              rel="noreferrer"
              className="tt-btn tt-btn-secondary ml-auto gap-1 px-3 py-1.5 text-[11px]"
            >
              Voir <ExternalLink size={12} />
            </a>
          </div>
        </article>
      ))}
    </div>
  );
}
