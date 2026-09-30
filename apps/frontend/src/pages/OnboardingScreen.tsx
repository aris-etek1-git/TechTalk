import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Rss, ArrowRight, Sparkles } from "lucide-react";
import { ALL_INTERESTS, saveInterests } from "../lib/content";
import { loadInterests } from "../lib/content";

export function OnboardingScreen() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string[]>(loadInterests);

  const toggle = (tag: string) =>
    setSelected((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));

  const finish = () => {
    saveInterests(selected);
    localStorage.setItem("teachtalk_onboarding_done", "1");
    navigate("/feed");
  };

  return (
    <div className="min-h-dvh tt-shell flex items-center justify-center px-4">
      <div className="w-full max-w-lg tt-card p-8 tt-fade-up">
        <div className="flex items-center gap-2.5 mb-6">
          <span className="tt-brand-tile w-9 h-9 rounded-xl">
            <Rss size={16} />
          </span>
          <span className="text-lg font-extrabold tracking-tight">
            Tech<span className="tt-gradient-text">Talk</span>
          </span>
        </div>

        <span className="tt-chip mb-3">
          <Sparkles size={11} className="text-primary" /> Dernière étape
        </span>
        <h1 className="text-2xl font-extrabold tracking-tight mb-2">Qu'est-ce qui vous passionne ?</h1>
        <p className="text-[13px] text-muted-foreground mb-6">
          Sélectionnez vos centres d'intérêt : ils personnalisent votre flux « Pour toi » et l'onglet « Abonnements ».
        </p>

        <div className="flex flex-wrap gap-2 mb-8 tt-stagger">
          {ALL_INTERESTS.map((tag) => {
            const active = selected.includes(tag);
            return (
              <button
                key={tag}
                onClick={() => toggle(tag)}
                className={`tt-chip text-sm! px-4! py-2! transition-all ${
                  active ? "tt-btn-brand text-white! border-transparent" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between">
          <button onClick={finish} className="tt-btn px-4 py-2 text-[13px] text-muted-foreground hover:text-foreground">
            Passer
          </button>
          <button onClick={finish} className="tt-btn tt-btn-brand px-6 py-3 text-sm gap-2">
            Commencer l'exploration <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
