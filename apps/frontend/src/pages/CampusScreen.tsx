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
    <div className="flex-1 overflow-y-auto px-4 py-5">
      <div className="max-w-2xl mx-auto space-y-7 pb-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={18} />
          <span className="text-sm">Back to Feed</span>
        </button>

        <section className="space-y-3">
          <h2 className="text-[11px] font-mono text-muted-foreground uppercase tracking-[0.15em]">
            My campuses · {mine.length}
          </h2>

          {loadingMine && <p className="text-sm text-muted-foreground">Loading…</p>}

          {error && !loadingMine && (
            <div className="p-3 rounded-xl bg-secondary border border-border flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">{error}</p>
              <button onClick={loadMine} className="text-sm text-primary shrink-0">
                Retry
              </button>
            </div>
          )}

          {!loadingMine && !error && mine.length === 0 && (
            <div className="p-5 rounded-2xl bg-secondary border border-border text-center">
              <div className="w-12 h-12 rounded-2xl bg-muted border border-border flex items-center justify-center mx-auto mb-3">
                <GraduationCap size={20} className="text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                You have not joined a campus yet. Search for your school below.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {mine.map((campus) => (
              <div key={campus.id} className="p-3 rounded-xl bg-secondary border border-border group">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{campus.name}</p>
                    <p className="text-[11px] font-mono text-muted-foreground truncate">
                      {campus.organization.name}
                      {campus.city ? ` · ${campus.city}` : ""}
                    </p>
                  </div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-primary/80 shrink-0">
                    {campus.myRole}
                  </span>
                </div>
                {campus.description && (
                  <p className="text-[11px] text-muted-foreground mt-2 line-clamp-2">{campus.description}</p>
                )}
                <button
                  onClick={() => handleLeave(campus)}
                  disabled={busyId === campus.id}
                  className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                  <LogOut size={12} />
                  Leave
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-[11px] font-mono text-muted-foreground uppercase tracking-[0.15em]">Discover</h2>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="School or city — Epitech, Lyon…"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {loadingResults && <p className="text-sm text-muted-foreground">Searching…</p>}

          {!loadingResults && query.trim().length >= 2 && results.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No campus matches “{query.trim()}”. Private campuses are hidden until you join them.
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {results
              .filter((campus) => !mineIds.has(campus.id))
              .map((campus) => (
                <div
                  key={campus.id}
                  className="p-3 rounded-xl bg-secondary border border-border flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-foreground truncate">{campus.name}</p>
                      {!campus.isPublic && <Lock size={11} className="text-muted-foreground shrink-0" />}
                    </div>
                    <p className="text-[11px] font-mono text-muted-foreground truncate">
                      {campus.organization.name}
                      {campus.city ? ` · ${campus.city}` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => handleJoin(campus)}
                    disabled={busyId === campus.id}
                    className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-[11px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
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
