import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Search,
  Play,
  Youtube,
  MessageCircle,
  Github,
  Twitter,
  Layers,
  Sparkles,
  Users,
  Gift,
  ArrowRight,
} from "lucide-react";
import { api } from "../services/api";
import { ContentItem } from "../types/content";
import { mapBackendContentToItem } from "../lib/content";
import { VideoTile } from "../components/VideoTile";
import { ThemeToggle } from "../components/ThemeToggle";
import { Brand } from "../components/Brand";

const FEATURES = [
  {
    icon: Layers,
    title: "Contenu agrégé",
    text: "YouTube, Reddit, X, GitHub et plus encore, réunis dans un seul flux.",
  },
  {
    icon: Sparkles,
    title: "IA & Recommandations",
    text: "Des suggestions adaptées à vos centres d'intérêt de développeur.",
  },
  {
    icon: Users,
    title: "Communauté",
    text: "Échangez avec des devs et étudiants du monde entier pour améliorer votre workflow.",
  },
  {
    icon: Gift,
    title: "100% gratuit",
    text: "Accédez à du contenu de qualité sans payer.",
  },
];

const SOURCE_CHIPS = [
  { icon: Youtube, label: "YouTube", tint: "bg-red-500 text-white" },
  { icon: MessageCircle, label: "Reddit", tint: "bg-orange-500 text-white" },
  { icon: Twitter, label: "X", tint: "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-black" },
  { icon: Github, label: "GitHub", tint: "bg-neutral-800 text-white dark:bg-neutral-200 dark:text-black" },
];

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
      <header className="sticky top-0 z-40 tt-glass-strong border-b border-glass-border">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2.5">
            <Brand size={32} />
          </Link>
          <nav className="hidden md:flex items-center gap-1 ml-6 text-sm text-muted-foreground">
            <Link to="/" className="tt-btn px-3 py-1.5 text-foreground font-semibold">Accueil</Link>
            <Link to={loggedIn ? "/feed" : "/login"} className="tt-btn px-3 py-1.5 hover:text-foreground">Explorer</Link>
            <Link to={loggedIn ? "/campus" : "/login"} className="tt-btn px-3 py-1.5 hover:text-foreground">Communauté</Link>
            <Link to={loggedIn ? "/annals" : "/login"} className="tt-btn px-3 py-1.5 hover:text-foreground">Ressources</Link>
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            <ThemeToggle />
            {loggedIn ? (
              <Link to="/feed" className="tt-btn tt-btn-brand px-4 py-2 text-sm">
                Ma plateforme
              </Link>
            ) : (
              <>
                <Link to="/login" className="tt-btn tt-btn-ghost px-4 py-2 text-sm">
                  Se connecter
                </Link>
                <Link to="/login" className="tt-btn tt-btn-brand px-4 py-2 text-sm">
                  S'inscrire
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1">
        <section className="max-w-6xl mx-auto px-4 pt-14 md:pt-20 pb-12 grid md:grid-cols-2 gap-10 items-center">
          <div className="tt-fade-up">
            <span className="tt-chip mb-5">
              <Sparkles size={11} className="text-primary" />
              Découverte de contenu tech
            </span>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-[1.1] mb-5">
              La plateforme vidéo
              <br />
              des <span className="tt-accent-blue">développeurs</span>
            </h1>
            <p className="text-[15px] text-muted-foreground leading-relaxed mb-7 max-w-md">
              Découvrez, apprenez et partagez autour du code, de la tech et de l'IA.
              Des vidéos, des tutos, des extraits de conférences et bien encore — le tout
              agrégé depuis YouTube, Reddit et d'autres sources.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link to={loggedIn ? "/feed" : "/login"} className="tt-btn tt-btn-brand px-6 py-3 text-sm gap-2">
                Commencer <ArrowRight size={15} />
              </Link>
              <Link to={loggedIn ? "/explore" : "/login"} className="tt-btn tt-btn-blue px-6 py-3 text-sm gap-2">
                <Search size={15} /> Explorer
              </Link>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-7">
              <span className="text-[11px] uppercase tracking-widest text-muted-foreground mr-1">Sources</span>
              {SOURCE_CHIPS.map(({ icon: Icon, label, tint }) => (
                <span key={label} className="tt-glass inline-flex items-center gap-1.5 rounded-full pl-1 pr-3 py-1 text-[12px] font-medium">
                  <span className={`w-5 h-5 rounded-full ${tint} flex items-center justify-center`}>
                    <Icon size={11} />
                  </span>
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* Illustration */}
          <div className="relative hidden md:flex items-center justify-center tt-fade-up" aria-hidden>
            <div className="relative w-[380px] h-[300px]">
              <div className="absolute inset-x-6 bottom-6 h-[210px] rounded-2xl overflow-hidden border border-border shadow-2xl" style={{ background: "var(--surface)" }}>
                <div className="h-7 flex items-center gap-1.5 px-3 border-b border-border/60">
                  <span className="w-2 h-2 rounded-full bg-red-400" />
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                </div>
                <div className="p-4 space-y-3">
                  <div className="tt-skeleton h-3 w-3/4" style={{ background: "var(--surface-2)" }} />
                  <div className="tt-skeleton h-3 w-full" style={{ background: "var(--surface-2)" }} />
                  <div className="tt-skeleton h-3 w-2/3" style={{ background: "var(--surface-2)" }} />
                  <div className="mt-4 aspect-[16/9] rounded-xl flex items-center justify-center" style={{ background: "var(--sheen-flat), var(--blue)" }}>
                    <Play size={30} className="text-white fill-white ml-1" />
                  </div>
                </div>
              </div>
              {SOURCE_CHIPS.map(({ icon: Icon, tint }, i) => (
                <span
                  key={i}
                  className={`absolute w-11 h-11 rounded-2xl ${tint} flex items-center justify-center text-white shadow-xl border border-white/20`}
                  style={{
                    left: [12, 300, 60, 285][i],
                    top: [0, 30, 210, 155][i],
                    transform: `rotate(${[-8, 6, 10, -5][i]}deg)`,
                  }}
                >
                  <Icon size={20} />
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="max-w-6xl mx-auto px-4 py-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 tt-stagger">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="tt-card p-5 text-center">
                <span className="tt-brand-tile mx-auto w-11 h-11 rounded-2xl mb-3">
                  <Icon size={18} />
                </span>
                <h3 className="text-[14px] font-bold mb-1.5">{title}</h3>
                <p className="text-[12px] text-muted-foreground leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Popular videos (only when logged in — the API is authenticated) */}
        {popular.length > 0 && (
          <section className="max-w-6xl mx-auto px-4 py-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-extrabold tracking-tight">Vidéos populaires</h2>
              <Link to="/explore" className="text-[13px] font-semibold text-primary hover:underline">
                Voir tout →
              </Link>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 tt-stagger">
              {popular.map((item) => (
                <VideoTile key={item.id} item={item} onOpen={() => navigate(`/content/${item.id}`, { state: { item } })} />
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/60 mt-10">
        <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Brand size={28} radius="10px" glyph={13} />
            <div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Apprends. Explore. Progresse.</p>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Contenu agrégé (YouTube, Reddit, X, GitHub, etc.) · Recommandations par règles · Communauté · Thème clair / sombre · Mobile &amp; desktop
          </p>
        </div>
      </footer>
    </div>
  );
}
