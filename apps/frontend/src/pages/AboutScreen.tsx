import { ArrowLeft, Rss, Bookmark, Search, User } from "lucide-react";
import { BrandMark, BrandWord } from "../components/Brand";

interface AboutScreenProps {
  onBack: () => void;
}

const SOURCES = ["Dev.to", "TechCrunch", "YouTube", "Reddit"];

const FEATURES = [
  { icon: <Rss size={16} />, title: "Un fil éditorialisé", desc: "Des articles et vidéos tech récents, agrégés depuis le web." },
  { icon: <Bookmark size={16} />, title: "À garder pour plus tard", desc: "Enregistrez un contenu et retrouvez-le quand vous voulez." },
  { icon: <Search size={16} />, title: "Recherche plein texte", desc: "Trouvez exactement ce que vous cherchez, instantanément." },
  { icon: <User size={16} />, title: "Votre profil", desc: "Suivez vos jours actifs et affinez vos centres d'intérêt." },
];

export function AboutScreen({ onBack }: AboutScreenProps) {
  return (
    <div className="tt-fade-up flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-5 py-8 pb-10">
        <button
          onClick={onBack}
          className="-ml-2 mb-6 flex items-center gap-2 rounded-full px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
        >
          <ArrowLeft size={18} />
          <span>Retour au fil</span>
        </button>

        {/* App info */}
        <div className="relative mb-10 flex flex-col items-center overflow-hidden py-4">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-14 left-1/2 h-40 w-64 -translate-x-1/2 rounded-full opacity-60 blur-3xl"
            style={{ background: "var(--sky-soft)" }}
          />
          <BrandMark size={64} radius="16px" glyph={26} />
          <div className="mt-4">
            <BrandWord size="text-xl" />
          </div>
        </div>

        {/* About */}
        <div className="tt-card p-6">
          <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
            TechTalk est un <span className="font-semibold text-foreground">fil tech façon TikTok</span> — découvre,
            scrolle, apprends. Plutôt qu'un timeline saturé, l'app sélectionne des articles et vidéos techniques de
            qualité depuis le web dans un flux unique, pensé pour le mobile. Les recommandations suivent des règles
            simples et lisibles : correspondance de thèmes, popularité et fraîcheur, puis diversité du fil.
          </p>

          <div className="mb-6 flex flex-wrap gap-2">
            {SOURCES.map((s) => (
              <span key={s} className="tt-chip text-muted-foreground">
                {s}
              </span>
            ))}
          </div>

          <div className="tt-divider-brand mb-6" />

          <div className="tt-stagger space-y-5">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex items-start gap-3.5">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-surface-2 ring-1 ring-border">
                  <span className="text-primary">{f.icon}</span>
                </div>
                <div>
                  <div className="text-sm font-semibold tracking-tight text-foreground">{f.title}</div>
                  <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
