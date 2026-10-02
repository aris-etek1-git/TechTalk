import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, TagRef, USER_LEVELS, UserLevel } from "../services/api";
import { groupTagsByKind } from "../lib/content";
import { Brand } from "../components/Brand";
import { useAppStore } from "../app/store";

const LEVEL_LABELS: Record<UserLevel, string> = {
  beginner: "Débutant",
  intermediate: "Intermédiaire",
  advanced: "Avancé",
  professional: "Pro",
};

export function OnboardingScreen() {
  const navigate = useNavigate();
  const { interestTags, applyInterestsLocal } = useAppStore();

  const [tags, setTags] = useState<TagRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(interestTags.map((t) => t.slug)));
  const [level, setLevel] = useState<UserLevel>("beginner");

  useEffect(() => {
    let cancelled = false;
    api
      .getTags({ limit: 60 })
      .then((list) => !cancelled && setTags(list))
      .catch(() => !cancelled && toast.error("Impossible de charger les sujets."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const groups = useMemo(() => groupTagsByKind(tags), [tags]);
  const chosenTags = useMemo(() => tags.filter((t) => selected.has(t.slug)), [tags, selected]);

  const toggle = (slug: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });

  const finish = async (skipped: boolean) => {
    setSaving(true);
    const slugs = skipped ? [] : Array.from(selected);
    const res = await api.completeOnboarding({
      skipped,
      level,
      tags: slugs.length > 0 ? slugs : undefined,
    });
    if (!res.success) {
      setSaving(false);
      toast.error(res.error ?? "Enregistrement impossible. Réessayez.");
      return;
    }
    applyInterestsLocal(skipped ? [] : chosenTags);
    localStorage.setItem("teachtalk_onboarding_done", "1");
    navigate("/feed");
  };

  return (
    <div className="min-h-dvh tt-shell flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-xl tt-card p-8 tt-fade-up">
        <div className="flex items-center gap-2.5 mb-6">
          <Brand size={36} radius="12px" glyph={17} wordSize="text-lg" />
        </div>

        <span className="tt-chip mb-3">
          <Sparkles size={11} className="text-primary" /> Dernière étape
        </span>
        <h1 className="mb-2 text-2xl font-bold tracking-tight">Construisons votre flux</h1>
        <p className="mb-6 text-[13px] text-muted-foreground">
          Deux réglages : votre niveau et ce qui vous passionne. Ils personnalisent le flux « Pour toi » et l'onglet « Abonnements ».
        </p>

        {/* Level */}
        <p className="tt-label mb-2">Votre niveau</p>
        <div className="mb-6 flex flex-wrap gap-2">
          {USER_LEVELS.map((id) => (
            <button
              key={id}
              onClick={() => setLevel(id)}
              className={`tt-chip px-3.5 py-2 text-[12px] transition-colors ${
                level === id ? "tt-chip-active font-semibold" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {LEVEL_LABELS[id]}
            </button>
          ))}
        </div>

        {/* Topics, grouped by the taxonomy kind so 40 chips read as a structure */}
        <p className="tt-label mb-2">
          Vos centres d'intérêt{" "}
          <span className="text-muted-foreground">({selected.size} sélectionné{selected.size > 1 ? "s" : ""})</span>
        </p>
        {loading ? (
          <div className="flex h-40 items-center justify-center text-muted-foreground">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : (
          <div className="mb-8 max-h-64 space-y-4 overflow-y-auto pr-1 tt-scrollbar">
            {groups.map((group) => (
              <div key={group.kind}>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{group.label}</p>
                <div className="flex flex-wrap gap-2">
                  {group.tags.map((tag) => {
                    const active = selected.has(tag.slug);
                    return (
                      <button
                        key={tag.id}
                        onClick={() => toggle(tag.slug)}
                        className={`tt-chip px-3.5 py-2 text-[12px] transition-all ${
                          active ? "tt-btn-brand border-transparent" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between">
          <button onClick={() => finish(true)} disabled={saving} className="tt-btn px-4 py-2 text-[13px] text-muted-foreground hover:text-foreground">
            Passer
          </button>
          <button
            onClick={() => finish(false)}
            disabled={saving || selected.size === 0}
            className="tt-btn tt-btn-brand gap-2 px-6 py-3 text-sm disabled:opacity-50"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />} Commencer l'exploration
          </button>
        </div>
      </div>
    </div>
  );
}
