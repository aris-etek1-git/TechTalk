import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Search,
  Play,
  Layers,
  Sparkles,
  Users,
  Compass,
  ArrowRight,
} from "lucide-react";
import { api } from "../services/api";
import { ContentItem } from "../types/content";
import { mapBackendContentToItem } from "../lib/content";
import { VideoTile } from "../components/VideoTile";
import { ThemeToggle } from "../components/ThemeToggle";
import { Brand } from "../components/Brand";

const FEATURES = [
  { icon: Layers, title: "Agrégé", text: "YouTube, Reddit, Dev.to et GitHub dans un seul flux." },
  { icon: Sparkles, title: "Personnalisé", text: "Vos intérêts et votre niveau décident de l'ordre." },
  { icon: Compass, title: "Ordonné", text: "Apprendre, pratiquer, construire, puis postuler." },
  { icon: Users, title: "Campus", text: "Les ressources et les gens autour de votre école." },
];

const SOURCES = ["YouTube", "Reddit", "Dev.to", "GitHub", "LeetCode"];

export function LandingScreen() {
  const navigate = useNavigate();
  const loggedIn = !!api.getToken();
  const [popular, setPopular] = useState<ContentItem[]>([]);

  useEffect(() => {
    if (!loggedIn) return;
    api
      .getContents(4, 0)
      .then((c) => setPopular(c.map(mapBackendContentToItem)))
      .catch(() => setPopular([]));
  }, [loggedIn]);

  return (
    <div className="min-h-dvh tt-shell flex flex-col">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-6">
          <Link to="/" className="flex items-center">
            <Brand size={30} />
          </Link>
          <nav className="hidden md:flex items-center gap-1 text-sm text-muted-foreground">
            <Link to="/" className="tt-btn px-3 py-1.5 text-foreground font-semibold">Accueil</Link>
            <Link to={loggedIn ? "/explore" : "/login"} className="tt-btn px-3 py-1.5 hover:text-foreground">Explorer</Link>
            <Link to={loggedIn ? "/campus" : "/login"} className="tt-btn px-3 py-1.5 hover:text-foreground">Campus</Link>
            <Link to={loggedIn ? "/annals" : "/login"} className="tt-btn px-3 py-1.5 hover:text-foreground">Annales</Link>
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            <ThemeToggle />
            {loggedIn ? (
              <Link to="/feed" className="tt-btn tt-btn-brand whitespace-nowrap px-4 py-2 text-sm">
                Ma plateforme
              </Link>
            ) : (
              <>
                <Link to="/login" className="tt-btn tt-btn-ghost whitespace-nowrap px-4 py-2 text-sm">
                  Se connecter
                </Link>
                <Link to="/login" className="tt-btn tt-btn-brand whitespace-nowrap px-4 py-2 text-sm">
                  S'inscrire
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto grid max-w-5xl items-center gap-12 px-4 pt-20 pb-16 md:grid-cols-[1.05fr_.95fr] md:pt-24">
          <div className="tt-fade-up">
            <h1 className="text-4xl font-bold leading-[1.1] tracking-tight md:text-[3.25rem]">
              Tout le contenu tech,
              <br />
              réuni dans un seul flux.
            </h1>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-muted-foreground">
              Vidéos, articles, exercices et opportunités choisis selon ce que vous
              apprenez et ce que vous voulez devenir.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to={loggedIn ? "/feed" : "/login"} className="tt-btn tt-btn-brand px-6 py-3 text-sm gap-2">
                Commencer <ArrowRight size={15} />
              </Link>
              <Link to={loggedIn ? "/explore" : "/login"} className="tt-btn tt-btn-ghost px-6 py-3 text-sm gap-2">
                <Search size={15} /> Explorer
              </Link>
            </div>
            <p className="tt-label mt-9">
              Sources&nbsp;
              <span className="font-sans normal-case tracking-normal text-[12px] text-muted-foreground">
                {SOURCES.join(" · ")}
              </span>
            </p>
          </div>

          {/* Product preview */}
          <div className="relative hidden justify-center md:flex tt-fade-up" aria-hidden>
            <div className="w-full max-w-[400px] overflow-hidden rounded-xl border border-border bg-card shadow-raised">
              <div className="flex h-8 items-center gap-1.5 border-b border-border px-3.5">
                <span className="h-2 w-2 rounded-full bg-surface-3" />
                <span className="h-2 w-2 rounded-full bg-surface-3" />
                <span className="h-2 w-2 rounded-full bg-surface-3" />
                <span className="tt-label ml-2 text-[9px]">techtalk / fil</span>
              </div>
              <div className="space-y-4 p-5">
                <div className="flex items-center gap-3">
                  <span className="tt-logo-mark h-9 w-9 rounded-lg">
                    <Play size={15} className="fill-primary-foreground" />
                  </span>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="tt-skeleton h-2.5 w-2/3" />
                    <div className="tt-skeleton h-2.5 w-1/3" />
                  </div>
                </div>
                <div className="aspect-video rounded-lg bg-surface-2" />
                <div className="space-y-2">
                  <div className="tt-skeleton h-2.5 w-full" />
                  <div className="tt-skeleton h-2.5 w-4/5" />
                </div>
                <div className="flex gap-1.5">
                  <span className="tt-chip text-[10px]">TypeScript</span>
                  <span className="tt-chip text-[10px]">Backend</span>
                  <span className="tt-chip tt-chip-active text-[10px]">Enregistré</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-5xl border-t border-border px-4">
          <div className="grid gap-x-10 gap-y-8 py-12 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div key={title}>
                <Icon size={17} className="text-muted-foreground" />
                <h3 className="mt-4 text-[14px] font-bold">{title}</h3>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Popular videos (only when logged in — the API is authenticated) */}
        {popular.length > 0 && (
          <section className="mx-auto max-w-5xl border-t border-border px-4 py-12">
            <div className="mb-5 flex items-baseline justify-between">
              <h2 className="text-lg font-bold tracking-tight">Vidéos populaires</h2>
              <Link to="/explore" className="text-[13px] font-semibold text-primary hover:underline">
                Tout voir
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4 tt-stagger lg:grid-cols-4">
              {popular.map((item) => (
                <VideoTile key={item.id} item={item} onOpen={() => navigate(`/content/${item.id}`, { state: { item } })} />
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-4 py-7 md:flex-row">
          <Brand size={26} radius="8px" glyph={12} />
          <p className="text-[11px] text-muted-foreground">Apprends. Explore. Progresse.</p>
        </div>
      </footer>
    </div>
  );
}
