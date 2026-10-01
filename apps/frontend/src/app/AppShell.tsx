import { useState, FormEvent } from "react";
import { Link, Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  Home,
  Compass,
  PlusSquare,
  Bookmark,
  History,
  GraduationCap,
  BookOpen,
  Users,
  Search,
  Bell,
  Menu,
  X,
  Youtube,
  MessageCircle,
  Code2,
  Newspaper,
  BookText,
  Layers,
} from "lucide-react";
import { ThemeToggle } from "../components/ThemeToggle";
import { Brand } from "../components/Brand";
import { useAppStore } from "./store";
import { SIDEBAR_CATEGORIES } from "../lib/content";

const NAV_ITEMS = [
  { to: "/feed", label: "Accueil", icon: Home },
  { to: "/explore", label: "Explorer", icon: Compass },
  { to: "/create", label: "Créer", icon: PlusSquare },
  { to: "/profile?tab=favoris", label: "Favoris", icon: Bookmark },
  { to: "/profile?tab=historique", label: "Historique", icon: History },
];

const CAMPUS_ITEMS = [
  { to: "/campus", label: "Campus", icon: GraduationCap },
  { to: "/annals", label: "Annales", icon: BookOpen },
  { to: "/campus-life", label: "Vie de campus", icon: Users },
];

const SOURCES = [
  { label: "YouTube", value: "YouTube", icon: Youtube, tint: "text-primary" },
  { label: "Reddit", value: "Reddit", icon: MessageCircle, tint: "text-accent" },
  { label: "Dev.to", value: "Dev.to", icon: Code2, tint: "text-blue-400" },
  { label: "TechCrunch", value: "TechCrunch", icon: Newspaper, tint: "text-blue-500" },
  { label: "Medium", value: "Medium", icon: BookText, tint: "text-blue-300" },
];

function SidebarLink({
  to,
  label,
  icon: Icon,
  tint,
  size = 19,
  onNavigate,
}: {
  to: string;
  label: string;
  icon: typeof Home;
  tint?: string;
  size?: number;
  onNavigate?: () => void;
}) {
  const { pathname, search } = useLocation();
  const [path, query] = to.split("?");
  const active = pathname === path && (!query || search.slice(1).split("&").every((kv) => search.includes(kv)));
  return (
    <Link
      to={to}
      onClick={onNavigate}
      className={[
        "tt-btn gap-3 px-3 py-2.5 justify-start text-sm",
        active
          ? "bg-accent/12 text-accent font-bold ring-1 ring-primary/20"
          : "text-muted-foreground hover:text-foreground hover:bg-surface-2",
      ].join(" ")}
    >
      <Icon size={size} className={tint} />
      {label}
    </Link>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex flex-col gap-6 px-3 py-5 h-full overflow-y-auto tt-scrollbar">
      <Link to="/feed" onClick={onNavigate} className="flex items-center gap-2.5 px-2">
        <Brand size={32} />
      </Link>

      <nav className="flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) => (
          <SidebarLink key={item.to} {...item} onNavigate={onNavigate} />
        ))}
        <div className="tt-divider-brand my-2" />
        {CAMPUS_ITEMS.map((item) => (
          <SidebarLink key={item.to} {...item} onNavigate={onNavigate} />
        ))}
      </nav>

      <div>
        <h3 className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Sources
        </h3>
        <div className="flex flex-col gap-0.5">
          {SOURCES.map(({ label, value, icon: Icon, tint }) => (
            <SidebarLink
              key={value}
              to={`/explore?source=${encodeURIComponent(value)}`}
              label={label}
              icon={Icon}
              tint={tint}
              size={16}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      </div>

      <div>
        <h3 className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Catégories
        </h3>
        <div className="flex flex-wrap gap-1.5 px-1">
          {SIDEBAR_CATEGORIES.map((cat) => (
            <Link
              key={cat.value}
              to={`/explore?category=${encodeURIComponent(cat.value)}`}
              onClick={onNavigate}
              className="tt-chip hover:text-primary transition-colors"
            >
              <Layers size={10} />
              {cat.label}
            </Link>
          ))}
        </div>
      </div>

      <p className="px-3 mt-auto pt-4 text-[10px] leading-relaxed text-muted-foreground/70">
        Contenu agrégé depuis YouTube, Reddit et d'autres sources. TechTalk n'héberge aucun média.
      </p>
    </div>
  );
}

export function AppShell() {
  const navigate = useNavigate();
  const { user } = useAppStore();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [query, setQuery] = useState("");

  const submitSearch = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/explore?q=${encodeURIComponent(q)}` : "/explore");
  };

  return (
    <div className="h-dvh tt-shell flex overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 flex-shrink-0 border-r border-glass-border bg-sidebar backdrop-blur-2xl">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 border-r border-glass-border bg-sidebar shadow-2xl backdrop-blur-2xl">
            <button
              onClick={() => setDrawerOpen(false)}
              className="tt-btn absolute top-3 right-2 p-2 text-muted-foreground"
              aria-label="Fermer le menu"
            >
              <X size={18} />
            </button>
            <SidebarContent onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="z-40 flex-shrink-0 tt-glass-strong border-b border-glass-border">
          <div className="px-3 md:px-5 h-14 flex items-center gap-2">
            <button
              onClick={() => setDrawerOpen(true)}
              className="tt-btn lg:hidden p-2 text-muted-foreground hover:text-foreground hover:bg-surface-2"
              aria-label="Ouvrir le menu"
            >
              <Menu size={20} />
            </button>

            <Link to="/feed" className="lg:hidden flex items-center gap-2 mr-1">
              <Brand size={28} radius="10px" glyph={13} />
            </Link>

            <form onSubmit={submitSearch} className="relative flex-1 max-w-xl">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher des vidéos, créateurs, sujets..."
                className="tt-field w-full pl-10 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground"
              />
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
              />
            </form>

            <div className="flex items-center gap-0.5 ml-auto">
              <button className="tt-btn relative p-2 text-muted-foreground hover:text-foreground hover:bg-surface-2" aria-label="Notifications">
                <Bell size={18} />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary" />
              </button>
              <ThemeToggle />
              <Link
                to="/profile"
                className="tt-btn p-1 ml-1"
                aria-label="Profil"
              >
                {user?.picture ? (
                  <img src={user.picture} alt={user.name || "Profil"} className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <span className="tt-brand-tile w-8 h-8 rounded-full opacity-90">
                    <Users size={15} />
                  </span>
                )}
              </Link>
            </div>
          </div>
        </header>

        <div className="flex-1 flex flex-col overflow-hidden">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
