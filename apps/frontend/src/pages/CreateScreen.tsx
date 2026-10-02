import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Video, Link2, FileText, Image as ImageIcon, Send } from "lucide-react";
import { toast } from "sonner";
import { api } from "../services/api";
import { SIDEBAR_CATEGORIES } from "../lib/content";

type Kind = "video" | "link" | "text" | "image";

const KINDS: { id: Kind; label: string; icon: typeof Video }[] = [
  { id: "video", label: "Vidéo", icon: Video },
  { id: "link", label: "Lien", icon: Link2 },
  { id: "text", label: "Texte", icon: FileText },
  { id: "image", label: "Image", icon: ImageIcon },
];

function inferSource(url: string): string {
  const u = url.toLowerCase();
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "YouTube";
  if (u.includes("reddit.com")) return "Reddit";
  if (u.includes("github.com")) return "GitHub";
  if (u.includes("leetcode.com")) return "LeetCode";
  if (u.includes("twitter.com") || u.includes("x.com")) return "X";
  if (u.includes("dev.to")) return "Dev.to";
  if (u.includes("medium.com")) return "Medium";
  if (u.includes("techcrunch.com")) return "TechCrunch";
  return "Web";
}

function Toggle({ on, onChange, label, hint }: { on: boolean; onChange: () => void; label: string; hint?: string }) {
  return (
    <button
      type="button"
      onClick={onChange}
      role="switch"
      aria-checked={on}
      className="tt-btn w-full justify-between px-4 py-3 hover:bg-surface-2 text-left"
    >
      <span>
        <span className="block text-[13px] font-semibold">{label}</span>
        {hint && <span className="block text-[11px] text-muted-foreground mt-0.5">{hint}</span>}
      </span>
      <span
        className={`w-10 h-6 rounded-full p-0.5 transition-colors flex-shrink-0 ${on ? "bg-primary" : "bg-[var(--switch-background)]"}`}
      >
        <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-4" : ""}`} />
      </span>
    </button>
  );
}

export function CreateScreen() {
  const navigate = useNavigate();
  const [kind, setKind] = useState<Kind>("video");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [publish, setPublish] = useState(true);
  const [addToFavs, setAddToFavs] = useState(false);
  const [notify, setNotify] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const toggleCategory = (c: string) =>
    setCategories((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const finalTitle = title.trim() || (url.trim() ? url.trim().split("/").filter(Boolean).pop() : "");
    if (!finalTitle) {
      toast.error("Ajoutez au moins un titre ou un lien.");
      return;
    }
    if (kind !== "text" && !url.trim()) {
      toast.error("Ce type de post nécessite un lien.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.createContent({
        title: finalTitle,
        url: url.trim() || `teachtalk://note/${Date.now()}`,
        source: inferSource(url),
        type: kind === "video" ? "video" : "article",
        summary: description.trim() || undefined,
      });
      if (!res.success || !res.content) {
        toast.error(res.error || "Échec de la publication.");
        return;
      }
      if (addToFavs) await api.addBookmark(res.content.id);
      toast.success(publish ? "Contenu publié !" : "Enregistré dans vos favoris !");
      if (notify) toast.info("Vous recevrez les mises à jour de ce contenu.");
      navigate(`/content/${res.content.id}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto tt-scrollbar">
      <div className="max-w-2xl mx-auto px-4 py-6 tt-fade-up">
        <h1 className="text-xl font-bold tracking-tight mb-5">Créer un post</h1>

        {/* Type tabs */}
        <div className="grid grid-cols-4 gap-2 mb-6">
          {KINDS.map(({ id, label, icon: Icon }) => {
            const active = kind === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setKind(id)}
                className={`tt-btn py-2.5 text-[13px] gap-2 ${active ? "tt-btn-brand" : "tt-btn-ghost"}`}
              >
                <Icon size={15} /> {label}
              </button>
            );
          })}
        </div>

        <form onSubmit={submit} className="space-y-5">
          {kind !== "text" && (
            <div>
              <label className="block text-[13px] font-semibold mb-1.5">
                {kind === "video" ? "Ajouter une vidéo" : kind === "link" ? "Ajouter un lien" : "Ajouter une image"}
              </label>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Collez un lien YouTube, Reddit, X ou GitHub..."
                className="tt-field w-full px-4 py-3 text-sm"
              />
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Exemple : https://youtube.com/watch?v=xxxx — TechTalk n'héberge rien, le contenu reste lié à sa source.
              </p>
            </div>
          )}

          <div>
            <label className="block text-[13px] font-semibold mb-1.5">Titre (optionnel)</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Build a modern app with Next.js"
              className="tt-field w-full px-4 py-3 text-sm"
            />
          </div>

          <div>
            <label className="block text-[13px] font-semibold mb-1.5">Description (optionnel)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ajoutez une description ou un résumé..."
              rows={4}
              className="tt-field w-full px-4 py-3 text-sm resize-none"
            />
          </div>

          <div>
            <label className="block text-[13px] font-semibold mb-2">Catégories</label>
            <div className="flex flex-wrap gap-2">
              {SIDEBAR_CATEGORIES.map((c) => {
                const active = categories.includes(c.value);
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => toggleCategory(c.value)}
                    className={`tt-chip transition-all ${active ? "text-primary ring-1 ring-primary/50 bg-primary/10" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              La classification automatique du backend prevaut si aucune catégorie n'est précisée.
            </p>
          </div>

          <div className="tt-card divide-y divide-border/60 overflow-hidden">
            <Toggle on={publish} onChange={() => setPublish((v) => !v)} label="Publier sur TechTalk" hint="Rendre ce contenu visible dans le flux" />
            <Toggle on={addToFavs} onChange={() => setAddToFavs((v) => !v)} label="Ajouter à mes favoris" />
            <Toggle on={notify} onChange={() => setNotify((v) => !v)} label="Recevoir des notifications" />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="tt-btn tt-btn-brand w-full py-3.5 text-sm gap-2"
          >
            {submitting ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Send size={15} /> Publier
              </>
            )}
          </button>
          <p className="text-[11px] text-muted-foreground text-center -mt-2">
            Réservé aux comptes administrateur pour l'instant (modération du contenu agrégé).
          </p>
        </form>
      </div>
    </div>
  );
}
