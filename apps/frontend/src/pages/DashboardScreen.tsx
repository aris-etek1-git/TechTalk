import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Bookmark, Eye, Heart, Share2, Sparkles, MousePointerClick } from "lucide-react";
import { api, InteractionSummary, InteractionType } from "../services/api";
import { useAppStore } from "../app/store";
import { formatCount } from "../lib/content";

const METRICS: { type: InteractionType; label: string; icon: typeof Eye }[] = [
  { type: "view", label: "Contenus vus", icon: Eye },
  { type: "click", label: "Ouvertures", icon: MousePointerClick },
  { type: "like", label: "J'aime", icon: Heart },
  { type: "save", label: "Enregistrés", icon: Bookmark },
  { type: "share", label: "Partagés", icon: Share2 },
];

export function DashboardScreen() {
  const { user, interests, interestSlugs, toggleInterest } = useAppStore();
  const [summary, setSummary] = useState<InteractionSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .getInteractionSummary(30)
      .then((s) => !cancelled && setSummary(s))
      .catch(() => !cancelled && setSummary(null))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const countByType = useMemo(() => {
    const map = new Map<InteractionType, number>();
    for (const row of summary?.totals ?? []) map.set(row.type, row.count);
    return map;
  }, [summary]);

  // Real behaviour-derived topics, falling back to followed interests.
  const signals = useMemo(() => {
    const fromActivity = (summary?.topTags ?? []).slice(0, 6);
    if (fromActivity.length) return fromActivity.map((t) => ({ slug: t.slug, name: t.name, count: t.count }));
    return (interestSlugs || []).slice(0, 6).map((slug, i) => ({ slug, name: interests[i] || slug, count: 0 }));
  }, [summary, interestSlugs, interests]);

  const topSignal = signals[0];

  return (
    <div className="flex-1 overflow-y-auto tt-scrollbar">
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
        <header className="mb-8 tt-fade-up">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Bonjour {user?.name?.split(" ")[0] || "Tech Talker"}.
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">Votre activité des 30 derniers jours.</p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {METRICS.map(({ type, label, icon: Icon }) => (
            <div key={type} className="tt-card p-5">
              <div className="flex items-center gap-2">
                <Icon size={15} className="text-muted-foreground" />
                <p className="tt-label">{label}</p>
              </div>
              <p className="mt-3 text-3xl font-bold tabular-nums">
                {loading ? "—" : formatCount(countByType.get(type) ?? 0)}
              </p>
            </div>
          ))}

          <div className="tt-card p-5">
            <p className="tt-label">Vos signaux</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {signals.length ? (
                signals.map((s) => {
                  const following = interestSlugs?.includes(s.slug);
                  return (
                    <button
                      key={s.slug}
                      onClick={() => toggleInterest({ id: s.slug, slug: s.slug, name: s.name, kind: "topic" })}
                      className={`tt-chip text-[10px] ${following ? "tt-chip-active" : ""}`}
                      title={s.count ? `${s.count} interactions` : undefined}
                    >
                      #{s.name}
                    </button>
                  );
                })
              ) : (
                <p className="text-[12px] text-muted-foreground">Pas encore assez d'activité pour dégager des thèmes.</p>
              )}
            </div>
            <Link to="/profile?tab=abonnements" className="mt-4 inline-flex items-center text-xs font-semibold text-primary">
              Ajuster mes intérêts <ArrowRight size={13} className="ml-1" />
            </Link>
          </div>
        </div>

        <section className="tt-card mt-6 p-6">
          <p className="tt-label mb-2">Recommandation</p>
          <Sparkles className="my-3 text-muted-foreground" size={20} />
          {topSignal ? (
            <>
              <h2 className="text-xl font-bold">
                Vous suivez de près « {topSignal.name} ».
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {topSignal.count
                  ? `${topSignal.count} de vos interactions concernent ce thème.`
                  : "C'est l'un de vos intérêts déclarés."}{" "}
                Approfondissez-le dans l'explorateur.
              </p>
              <Link to={`/explore?topic=${encodeURIComponent(topSignal.slug)}`} className="tt-btn tt-btn-brand mt-5 gap-2 px-4 py-2 text-xs">
                Explorer « {topSignal.name} » <ArrowRight size={13} />
              </Link>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold">Commencez à suivre vos thèmes.</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Sélectionnez quelques sujets pour personnaliser votre flux et vos recommandations.
              </p>
              <Link to="/profile?tab=abonnements" className="tt-btn tt-btn-brand mt-5 gap-2 px-4 py-2 text-xs">
                Choisir des intérêts <ArrowRight size={13} />
              </Link>
            </>
          )}
        </section>

        <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="text-muted-foreground/70">
            Les recommandations viennent de votre propre activité, jamais d'un simple score de popularité.
          </span>
        </div>
      </div>
    </div>
  );
}
