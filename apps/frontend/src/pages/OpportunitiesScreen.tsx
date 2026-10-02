import { useState } from "react";
import { ArrowUpRight, CalendarClock, Globe2, MapPin, Sparkles } from "lucide-react";

type OpportunityType = "Stage" | "Emploi" | "Bourse" | "Hackathon" | "Recherche";

type Opportunity = {
  title: string;
  organization: string;
  type: OpportunityType;
  location: string;
  country: string;
  remote: boolean;
  deadline: string;
  deadlineInDays: number | null;
  skills: string[];
  match: number;
  matchedSkills: number;
};

const OPPORTUNITIES: Opportunity[] = [
  {
    title: "Stage Backend TypeScript",
    organization: "Northstar Labs",
    type: "Stage",
    location: "Remote · Europe",
    country: "Europe",
    remote: true,
    deadline: "Dans 12 jours",
    deadlineInDays: 12,
    skills: ["TypeScript", "Node.js", "PostgreSQL"],
    match: 92,
    matchedSkills: 3,
  },
  {
    title: "Hackathon Climate Data",
    organization: "Open Data House",
    type: "Hackathon",
    location: "Paris · Hybride",
    country: "France",
    remote: false,
    deadline: "Dans 18 jours",
    deadlineInDays: 18,
    skills: ["Python", "Data", "Travail d’équipe"],
    match: 84,
    matchedSkills: 2,
  },
  {
    title: "Bourse Open Source",
    organization: "Code Commons",
    type: "Bourse",
    location: "International",
    country: "International",
    remote: true,
    deadline: "30 avril 2027",
    deadlineInDays: null,
    skills: ["Git", "Documentation", "Communauté"],
    match: 78,
    matchedSkills: 2,
  },
  {
    title: "Assistant recherche · Vision",
    organization: "Vision Lab",
    type: "Recherche",
    location: "Dakar · Sur place",
    country: "Sénégal",
    remote: false,
    deadline: "Dans 27 jours",
    deadlineInDays: 27,
    skills: ["Python", "PyTorch", "Recherche"],
    match: 76,
    matchedSkills: 3,
  },
];

const FILTERS = ["Pour vous", "Stage", "Hackathon", "Bourse", "Recherche", "Remote", "Deadline proche"] as const;
type Filter = (typeof FILTERS)[number];

function matchFilter(o: Opportunity, filter: Filter): boolean {
  if (filter === "Pour vous") return true;
  if (filter === "Remote") return o.remote;
  if (filter === "Deadline proche") return o.deadlineInDays !== null && o.deadlineInDays <= 15;
  return o.type === filter;
}

export function OpportunitiesScreen() {
  const [filter, setFilter] = useState<Filter>("Pour vous");
  const visible = OPPORTUNITIES.filter((o) => matchFilter(o, filter));

  return (
    <div className="flex-1 overflow-y-auto tt-scrollbar">
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
        <header className="mb-8 max-w-3xl tt-fade-up">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Le prochain mouvement compte.</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Stages, bourses et hackathons filtrés selon vos compétences.</p>
        </header>

        <div className="mb-6 flex flex-wrap gap-2">
          {FILTERS.map((id) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={`tt-chip transition-colors ${
                filter === id ? "tt-chip-active font-semibold" : "text-muted-foreground"
              }`}
            >
              {id}
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <p className="tt-card p-8 text-center text-sm text-muted-foreground">
            Aucune opportunité dans cette sélection pour le moment.
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2 tt-stagger">
            {visible.map((item) => (
              <article key={item.title} className="tt-card tt-card-hover p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="tt-label">{item.type}</span>
                    <h2 className="mt-2 text-lg font-bold">{item.title}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">{item.organization}</p>
                  </div>
                  <div className="border border-primary px-2 py-1 text-center">
                    <strong className="block text-sm text-primary">{item.match}%</strong>
                    <span className="tt-label">
                      pertinence
                    </span>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <MapPin size={13} /> {item.location}
                  </span>
                  <span className="flex items-center gap-1">
                    <CalendarClock size={13} /> {item.deadline}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {item.skills.map((skill) => (
                    <span key={skill} className="tt-chip text-[10px]">
                      {skill}
                    </span>
                  ))}
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-border pt-3">
                  <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Sparkles size={13} className="text-primary" /> Pourquoi : {item.matchedSkills}{" "}
                    compétences correspondent
                  </span>
                  <a
                    href="https://www.linkedin.com/jobs/"
                    target="_blank"
                    rel="noreferrer"
                    className="tt-btn tt-btn-secondary gap-1 px-3 py-1.5 text-xs"
                  >
                    Ouvrir <ArrowUpRight size={13} />
                  </a>
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="mt-8 tt-card flex items-center gap-4 p-5">
          <Globe2 className="shrink-0 text-muted-foreground" size={22} />
          <div>
            <h2 className="font-bold">Une opportunité n’est pas qu’une offre.</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              TechTalk relie compétences, projets, personnes et contexte pour expliquer pourquoi elle
              mérite votre attention.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
