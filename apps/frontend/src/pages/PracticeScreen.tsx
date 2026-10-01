import { ArrowUpRight, BrainCircuit, Code2, Database, LockKeyhole, Server, Trophy } from "lucide-react";

const TRACKS = [
  { title: "Algorithms", level: "Fondations", icon: BrainCircuit, color: "text-primary", platform: "LeetCode · Codeforces", tasks: "240 exercices", url: "https://leetcode.com/" },
  { title: "Frontend", level: "Construire", icon: Code2, color: "text-accent", platform: "Frontend Mentor · GitHub", tasks: "68 challenges", url: "https://github.com/explore" },
  { title: "Backend", level: "Systèmes", icon: Server, color: "text-accent", platform: "GitHub · docs", tasks: "42 parcours", url: "https://github.com/explore" },
  { title: "Data & AI", level: "Explorer", icon: Database, color: "text-primary", platform: "Kaggle · Papers", tasks: "31 notebooks" },
  { title: "Cybersecurity", level: "Défense", icon: LockKeyhole, color: "text-accent", platform: "TryHackMe · CTF", tasks: "19 rooms" },
  { title: "Competitions", level: "Se mesurer", icon: Trophy, color: "text-primary", platform: "Codeforces · Kaggle", tasks: "12 événements" },
];

export function PracticeScreen() {
  return (
    <div className="flex-1 overflow-y-auto tt-scrollbar">
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
        <header className="mb-8 max-w-2xl tt-fade-up">
          <p className="tt-label mb-3">Practice / terrain d'entraînement</p>
          <h1 className="text-3xl font-extrabold md:text-5xl">Apprendre devient concret.</h1>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">Des exercices, des challenges et des plateformes externes rangés par intention. TechTalk vous aide à choisir le prochain geste, pas à tout héberger.</p>
        </header>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 tt-stagger">
          {TRACKS.map(({ title, level, icon: Icon, color, platform, tasks, url }) => (
            <article key={title} className="tt-card tt-card-hover relative overflow-hidden p-5">
              <div className="mb-8 flex items-start justify-between"><span className={`tt-brand-tile h-11 w-11 rounded-xl ${color}`}><Icon size={19} /></span><span className="tt-label">{level}</span></div>
              <h2 className="text-lg font-extrabold">{title}</h2>
              <p className="mt-2 text-xs text-muted-foreground">{platform}</p>
              <div className="mt-6 flex items-center justify-between border-t border-border pt-3"><span className="text-xs font-semibold">{tasks}</span><a href={url} target="_blank" rel="noreferrer" className="tt-btn tt-btn-ghost gap-1 px-3 py-1.5 text-xs">Ouvrir <ArrowUpRight size={13} /></a></div>
            </article>
          ))}
        </div>
        <section className="mt-10 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="tt-card p-6"><p className="tt-label mb-3">Votre rythme</p><h2 className="text-xl font-extrabold">Le parcours du jour</h2><div className="mt-5 space-y-4"><div><div className="mb-2 flex justify-between text-xs"><span>Graphes · BFS / DFS</span><strong>60%</strong></div><div className="h-2 bg-surface-2"><div className="h-2 w-3/5 bg-accent" /></div></div><div><div className="mb-2 flex justify-between text-xs"><span>Projet API Fastify</span><strong>30%</strong></div><div className="h-2 bg-surface-2"><div className="h-2 w-[30%] bg-primary" /></div></div></div></div>
          <div className="tt-card border-primary/30 p-6"><p className="tt-label text-primary">Prochain défi</p><h2 className="mt-3 text-xl font-extrabold">Construire un indexeur de documents</h2><p className="mt-2 text-sm text-muted-foreground">Reliez apprentissage, pratique et projet dans un seul mouvement.</p><button className="tt-btn tt-btn-brand mt-6 px-4 py-2 text-xs">Commencer le défi</button></div>
        </section>
        <section className="mt-4 tt-card border-accent/30 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="tt-label text-accent">LeetCode / session rapide</p><h2 className="mt-2 text-xl font-extrabold">Résoudre un problème, puis comprendre pourquoi.</h2><p className="mt-2 text-sm text-muted-foreground">Filtrez votre prochain exercice par difficulté et gardez la trace de votre progression dans TechTalk.</p></div>
            <a href="https://leetcode.com/problemset/" target="_blank" rel="noreferrer" className="tt-btn tt-btn-blue shrink-0 gap-2 px-4 py-2.5 text-xs">Ouvrir LeetCode <ArrowUpRight size={13} /></a>
          </div>
          <div className="mt-5 flex flex-wrap gap-2"><span className="tt-chip tt-chip-active">Easy · 84</span><span className="tt-chip">Medium · 126</span><span className="tt-chip">Hard · 30</span><span className="tt-chip">Arrays</span><span className="tt-chip">Graphs</span></div>
        </section>
      </div>
    </div>
  );
}
