import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, GraduationCap, Lock, LogOut, Search, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { api, Campus } from "../services/api";

interface CampusScreenProps {
  onBack: () => void;
}

export function CampusScreen({ onBack }: CampusScreenProps) {
  const [mine, setMine] = useState<Campus[]>([]);
  const [results, setResults] = useState<Campus[]>([]);
  const [query, setQuery] = useState("");
  const [loadingMine, setLoadingMine] = useState(true);
  const [loadingResults, setLoadingResults] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadMine = useCallback(async () => {
    setLoadingMine(true);
    setError(null);
    try {
      setMine(await api.getMyCampuses());
    } catch (err: any) {
      setError(err.message || "Failed to load your campuses");
    } finally {
      setLoadingMine(false);
    }
  }, []);

  useEffect(() => {
    loadMine();
  }, [loadMine]);

  // Debounced so typing a school name does not send one search per keystroke.
  useEffect(() => {
    const search = query.trim();
    if (search.length < 2) {
      setResults([]);
      setLoadingResults(false);
      return;
    }
    setLoadingResults(true);
    const timer = window.setTimeout(async () => {
      try {
        setResults(await api.getCampuses({ search }));
      } catch (err: any) {
        toast.error(err.message || "Search failed");
      } finally {
        setLoadingResults(false);
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [query]);

  const mineIds = new Set(mine.map((c) => c.id));

  async function handleJoin(campus: Campus) {
    setBusyId(campus.id);
    const result = await api.joinCampus(campus.id);
    setBusyId(null);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(`You joined ${campus.organization.name} — ${campus.name}`);
    setResults((prev) => prev.filter((c) => c.id !== campus.id));
    await loadMine();
  }

  async function handleLeave(campus: Campus) {
    setBusyId(campus.id);
    const result = await api.leaveCampus(campus.id);
    setBusyId(null);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setMine((prev) => prev.filter((c) => c.id !== campus.id));
  }

  return (
    <div className="tt-scrollbar flex-1 overflow-y-auto px-4 py-6">
      <div className="tt-fade-up mx-auto max-w-2xl space-y-9 pb-8">
        <button
          onClick={onBack}
          className="-ml-2 inline-flex items-center gap-2 rounded-full px-2 py-1.5 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
        >
          <ArrowLeft size={18} />
          <span className="text-sm">Back to Feed</span>
        </button>

        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            My campuses · {mine.length}
          </h2>

          {loadingMine && (
            <div className="space-y-3">
              <div className="tt-skeleton h-24 rounded-2xl" />
              <p className="text-sm text-muted-foreground">Loading…</p>
            </div>
          )}

          {error && !loadingMine && (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4">
              <p className="text-sm text-foreground">{error}</p>
              <button onClick={loadMine} className="tt-btn tt-btn-ghost shrink-0 px-4 py-2 text-sm text-primary">
                Retry
              </button>
            </div>
          )}

          {!loadingMine && !error && mine.length === 0 && (
            <div className="tt-card tt-ring-brand p-8 text-center">
              <div className="tt-glass tt-btn mx-auto mb-4 h-14 w-14 rounded-full text-muted-foreground">
                <GraduationCap size={22} className="text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">
                You have not joined a campus yet. Search for your school below.
              </p>
            </div>
          )}

          <div className="tt-stagger grid grid-cols-1 gap-3 md:grid-cols-2">
            {mine.map((campus) => (
              <div key={campus.id} className="tt-card tt-card-hover p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold tracking-tight text-foreground">{campus.name}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {campus.organization.name}
                      {campus.city ? ` · ${campus.city}` : ""}
                    </p>
                  </div>
                  <span className="inline-flex shrink-0 items-center rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
                    {campus.myRole}
                  </span>
                </div>
                {campus.description && (
                  <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{campus.description}</p>
                )}
                <button
                  onClick={() => handleLeave(campus)}
                  disabled={busyId === campus.id}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                >
                  <LogOut size={12} />
                  Leave
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Discover</h2>
          <div className="relative">
            <Search
              size={15}
              className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-muted-foreground"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="School or city — Epitech, Lyon…"
              className="tt-field w-full py-3 pl-11 pr-4 text-sm text-foreground placeholder:text-muted-foreground"
            />
          </div>

          {loadingResults && <p className="text-sm text-muted-foreground">Searching…</p>}

          {!loadingResults && query.trim().length >= 2 && results.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No campus matches “{query.trim()}”. Private campuses are hidden until you join them.
            </p>
          )}

          <div className="tt-stagger grid grid-cols-1 gap-3 md:grid-cols-2">
            {results
              .filter((campus) => !mineIds.has(campus.id))
              .map((campus) => (
                <div key={campus.id} className="tt-card tt-card-hover flex items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-semibold tracking-tight text-foreground">{campus.name}</p>
                      {!campus.isPublic && <Lock size={11} className="shrink-0 text-muted-foreground" />}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {campus.organization.name}
                      {campus.city ? ` · ${campus.city}` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => handleJoin(campus)}
                    disabled={busyId === campus.id}
                    className="tt-btn tt-btn-brand shrink-0 gap-1.5 px-4 py-2 text-xs"
                  >
                    {campus.myRole ? <Users size={12} /> : <UserPlus size={12} />}
                    {busyId === campus.id ? "…" : "Join"}
                  </button>
                </div>
              ))}
          </div>
        </section>
      </div>
    </div>
  );
}
