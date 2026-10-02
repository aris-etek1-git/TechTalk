import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  User as UserIcon,
  Bookmark,
  History,
  Sparkles,
  Settings,
  Pencil,
  Check,
  LogOut,
  Info,
  Sun,
  Moon,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../services/api";
import { ContentItem } from "../types/content";
import { mapBackendContentToItem, ALL_INTERESTS } from "../lib/content";
import { VideoTile } from "../components/VideoTile";
import { useTheme, toggleTheme } from "../app/theme";
import { useAppStore } from "../app/store";

type Section = "profil" | "favoris" | "historique" | "abonnements" | "parametres";

const SECTIONS: { id: Section; label: string; icon: typeof UserIcon }[] = [
  { id: "profil", label: "Mon profil", icon: UserIcon },
  { id: "favoris", label: "Mes favoris", icon: Bookmark },
  { id: "historique", label: "Historique", icon: History },
  { id: "abonnements", label: "Abonnements", icon: Sparkles },
  { id: "parametres", label: "Paramètres", icon: Settings },
];

export function ProfileScreen() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const { user, setUser, logout, saved, toggleSave, readIds, readDates, interests, toggleInterest } = useAppStore();

  const section = (params.get("tab") as Section) || "profil";
  const [pool, setPool] = useState<ContentItem[]>([]);
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(user?.name || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .getContents(200, 0)
      .then((c) => setPool(c.map(mapBackendContentToItem)))
      .catch(() => undefined);
  }, []);

  const history = pool.filter((i) => readIds.has(i.id));
  const videos = pool.filter((i) => i.type === "video");
  const readVideos = history.filter((i) => i.type === "video");

  const saveName = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Le nom ne peut pas être vide.");
      return;
    }
    setSaving(true);
    try {
      const res = await api.updateProfile(trimmed);
      if (res.success && res.user) {
        setUser(res.user);
        toast.success("Profil mis à jour !");
        setEditingName(false);
      } else {
        toast.error(res.error || "Échec de la mise à jour.");
      }
    } finally {
      setSaving(false);
    }
  };

  const setSection = (s: Section) => {
    const next = new URLSearchParams(params);
    if (s === "profil") next.delete("tab");
    else next.set("tab", s);
    setParams(next);
  };

  const openItem = (item: ContentItem) => navigate(`/content/${item.id}`, { state: { item } });

  const initials = (user?.name || "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <div className="flex-1 overflow-y-auto tt-scrollbar">
      <div className="max-w-5xl mx-auto px-3 md:px-6 py-6 grid md:grid-cols-[220px_minmax(0,1fr)] gap-6">
        {/* Section menu */}
        <nav className="flex md:flex-col gap-1 md:sticky md:top-6 overflow-x-auto tt-scrollbar">
          {SECTIONS.map(({ id, label, icon: Icon }) => {
            const active = section === id;
            return (
              <button
                key={id}
                onClick={() => setSection(id)}
                className={`tt-btn gap-2.5 px-4 py-2.5 justify-start text-sm whitespace-nowrap ${
                  active ? "bg-primary/10 text-primary font-bold" : "text-muted-foreground hover:text-foreground hover:bg-surface-2"
                }`}
              >
                <Icon size={16} /> {label}
              </button>
            );
          })}
        </nav>

        <div className="min-w-0 tt-fade-up">
          {/* ---------------- Mon profil ---------------- */}
          {section === "profil" && (
            <div className="space-y-6">
              <div className="tt-card p-6 flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
                {user?.picture ? (
                  <img src={user.picture} alt="" className="w-20 h-20 rounded-full object-cover ring-2 ring-primary/40" />
                ) : (
                  <span className="tt-brand-tile w-20 h-20 rounded-full text-xl font-bold">{initials}</span>
                )}
                <div className="flex-1 min-w-0">
                  {editingName ? (
                    <div className="flex items-center gap-2 justify-center sm:justify-start">
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="tt-field px-3 py-1.5 text-sm flex-1 max-w-xs"
                        autoFocus
                      />
                      <button onClick={saveName} disabled={saving} className="tt-btn tt-btn-brand p-2" aria-label="Enregistrer">
                        <Check size={15} />
                      </button>
                      <button onClick={() => setEditingName(false)} className="tt-btn tt-btn-ghost px-3 py-2 text-xs">
                        Annuler
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 justify-center sm:justify-start">
                      <h1 className="text-xl font-bold tracking-tight truncate">{user?.name || "Tech Talker"}</h1>
                      <button
                        onClick={() => {
                          setName(user?.name || "");
                          setEditingName(true);
                        }}
                        className="tt-btn tt-btn-ghost gap-1.5 px-3 py-1 text-[11px]"
                      >
                        <Pencil size={11} /> Modifier le profil
                      </button>
                    </div>
                  )}
                  <p className="text-[12px] text-muted-foreground mt-1">{user?.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Historique", value: readIds.size },
                  { label: "Favoris", value: saved.length },
                  { label: "Jours actifs", value: readDates.length },
                ].map((s) => (
                  <div key={s.label} className="tt-card p-4 text-center">
                    <p className="text-xl font-bold">{s.value}</p>
                    <p className="tt-label mt-1">{s.label}</p>
                  </div>
                ))}
              </div>

              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold">Mes vidéos regardées</h2>
                  <button onClick={() => setSection("historique")} className="text-[12px] font-semibold text-primary hover:underline">
                    Voir tout →
                  </button>
                </div>
                {readVideos.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {readVideos.slice(0, 4).map((i) => (
                      <VideoTile key={i.id} item={i} onOpen={() => openItem(i)} />
                    ))}
                  </div>
                ) : (
                  <p className="text-[13px] text-muted-foreground">Regardez des contenus pour remplir votre historique.</p>
                )}
              </section>
            </div>
          )}

          {/* ---------------- Mes favoris ---------------- */}
          {section === "favoris" && (
            <section>
              <h2 className="text-sm font-bold mb-3">Mes favoris · {saved.length}</h2>
              {saved.length === 0 ? (
                <div className="tt-card p-8 text-center">
                  <p className="text-[13px] text-muted-foreground">
                    Rien d'enregistré pour l'instant. Cliquez sur l'icône marque-page d'une carte pour la retrouver ici.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 tt-stagger">
                  {saved.map((i) => (
                    <div key={i.id} className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <VideoTile item={i} onOpen={() => openItem(i)} />
                      </div>
                      <button
                        onClick={() => toggleSave(i)}
                        className="tt-btn p-2 mt-2 text-muted-foreground hover:text-foreground hover:bg-surface-2"
                        aria-label="Retirer des favoris"
                      >
                        <Bookmark size={15} className="fill-current" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ---------------- Historique ---------------- */}
          {section === "historique" && (
            <section>
              <h2 className="text-sm font-bold mb-3">Historique de lecture · {history.length}</h2>
              {history.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">Aucun contenu consulté pour l'instant.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {history.map((i) => (
                    <VideoTile key={i.id} item={i} onOpen={() => openItem(i)} />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ---------------- Abonnements (intérêts) ---------------- */}
          {section === "abonnements" && (
            <section>
              <h2 className="text-sm font-bold mb-1">Vos centres d'intérêt</h2>
              <p className="text-[13px] text-muted-foreground mb-4">
                Ils personnalisent l'onglet « Abonnements » du flux et le classement « Pour toi ».
              </p>
              <div className="tt-card p-5 flex flex-wrap gap-2">
                {ALL_INTERESTS.map((tag) => {
                  const active = interests.includes(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => toggleInterest(tag)}
                      className={`tt-chip transition-all ${
                        active ? "text-primary ring-1 ring-primary/50 bg-primary/10" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* ---------------- Paramètres ---------------- */}
          {section === "parametres" && (
            <section className="space-y-4 max-w-md">
              <h2 className="text-sm font-bold">Paramètres</h2>
              <div className="tt-card divide-y divide-border/60">
                <div className="flex items-center justify-between px-5 py-4">
                  <div>
                    <p className="text-[13px] font-semibold">Apparence</p>
                    <p className="text-[11px] text-muted-foreground">Thème clair ou sombre</p>
                  </div>
                  <button onClick={toggleTheme} className="tt-btn tt-btn-ghost gap-2 px-4 py-2 text-[12px]">
                    {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
                    {theme === "dark" ? "Clair" : "Sombre"}
                  </button>
                </div>
                <div className="flex items-center justify-between px-5 py-4">
                  <div>
                    <p className="text-[13px] font-semibold">Rôle</p>
                    <p className="text-[11px] text-muted-foreground">{user?.role === "admin" ? "Administrateur" : "Membre"}</p>
                  </div>
                  <span className="tt-chip">{user?.role || "user"}</span>
                </div>
                <Link to="/about" className="flex items-center justify-between px-5 py-4 hover:bg-surface-2 transition-colors">
                  <span className="flex items-center gap-2.5 text-[13px] font-semibold">
                    <Info size={14} className="text-muted-foreground" /> À propos de TechTalk
                  </span>
                  <span className="text-muted-foreground">→</span>
                </Link>
                <button
                  onClick={logout}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-surface-2 transition-colors text-left"
                >
                  <span className="flex items-center gap-2.5 text-[13px] font-semibold text-destructive">
                    <LogOut size={14} /> Se déconnecter
                  </span>
                </button>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
