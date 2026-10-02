import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { toast } from "sonner";
import { api, InterestTag, User as ApiUser } from "../services/api";
import { ContentItem } from "../types/content";
import { mapBackendContentToItem, loadInterestSlugs, saveInterestSlugs } from "../lib/content";
import { startTelemetryLifecycle } from "../lib/telemetry";

interface AppStore {
  user: ApiUser | null;
  setUser: (u: ApiUser) => void;
  logout: () => void;

  saved: ContentItem[];
  savedIds: Set<string>;
  savedError: string | null;
  toggleSave: (item: ContentItem) => Promise<void>;

  likedIds: Set<string>;
  toggleLike: (item: ContentItem) => Promise<void>;

  readIds: Set<string>;
  readDates: string[];
  markRead: (item: ContentItem) => void;

  /* §16: interests are taxonomy tags (§9) stored on the account, not a local
     preference — the feed ranker on the server reads the same rows. */
  interestTags: InterestTag[];
  interests: string[];
  interestSlugs: string[];
  toggleInterest: (tag: InterestTag) => Promise<void>;
  setInterests: (tags: InterestTag[]) => Promise<void>;
  /** Sync the store after a call that already persisted interests elsewhere
      (onboarding writes them alongside the level and the done-stamp). */
  applyInterestsLocal: (tags: InterestTag[]) => void;
}

const Ctx = createContext<AppStore | null>(null);

export function useAppStore(): AppStore {
  const store = useContext(Ctx);
  if (!store) throw new Error("useAppStore must be used inside AppStoreProvider");
  return store;
}

export function AppStoreProvider({
  children,
  user,
  onUserUpdate,
  onLogout,
}: {
  children: ReactNode;
  user: ApiUser | null;
  onUserUpdate: (u: ApiUser) => void;
  onLogout: () => void;
}) {
  const [saved, setSaved] = useState<ContentItem[]>([]);
  const [savedError, setSavedError] = useState<string | null>(null);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [interestTags, setInterestTags] = useState<InterestTag[]>([]);

  const todayKey = () => new Date().toISOString().slice(0, 10);

  const [readIds, setReadIds] = useState<Set<string>>(() => {
    const raw = localStorage.getItem("teachtalk_read_ids");
    if (!raw) return new Set();
    try {
      return new Set(JSON.parse(raw));
    } catch {
      return new Set();
    }
  });

  const [readDates, setReadDates] = useState<string[]>(() => {
    const raw = localStorage.getItem("teachtalk_read_dates");
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    let cancelled = false;
    api
      .getBookmarks()
      .then((bookmarks) => {
        if (!cancelled) setSaved(bookmarks.map(mapBackendContentToItem));
      })
      .catch((err) => {
        console.error("Failed to fetch bookmarks:", err);
        setSavedError("Impossible de charger vos favoris");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    api
      .getLikes()
      .then((ids) => {
        if (!cancelled) setLikedIds(new Set(ids));
      })
      .catch((err) => {
        console.error("Failed to fetch likes:", err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    startTelemetryLifecycle();
  }, []);

  useEffect(() => {
    let cancelled = false;
    api
      .getMyInterests()
      .then((tags) => {
        if (cancelled) return;
        setInterestTags(tags);
        saveInterestSlugs(tags.map((t) => t.slug));
      })
      .catch((err) => {
        console.error("Failed to fetch interests:", err);
        const cached = loadInterestSlugs();
        if (cached.length > 0) {
          // Offline cache: only the slug survives, so the label is rebuilt from
          // it. Saving still works — the server keys on the slug, never the name.
          setInterestTags(
            cached.map((slug) => ({
              id: slug,
              slug,
              name: slug.replace(/[-_]/g, " ").replace(/^\w/, (c) => c.toUpperCase()),
              kind: "topic" as const,
            }))
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    api.getServerReading().then((server) => {
      if (cancelled || !server) return;
      const localIdsRaw = localStorage.getItem("teachtalk_read_ids");
      const localIds = localIdsRaw ? JSON.parse(localIdsRaw) : [];
      const localDatesRaw = localStorage.getItem("teachtalk_read_dates");
      const localDates = localDatesRaw && Array.isArray(JSON.parse(localDatesRaw)) ? JSON.parse(localDatesRaw) : [];

      const mergedIds = Array.from(new Set([...localIds, ...server.readIds]));
      const mergedDates = Array.from(new Set([...localDates, ...server.readDates]));

      localStorage.setItem("teachtalk_read_ids", JSON.stringify(mergedIds));
      localStorage.setItem("teachtalk_read_dates", JSON.stringify(mergedDates));
      setReadIds(new Set(mergedIds));
      setReadDates(mergedDates);

      const serverSet = new Set(server.readIds);
      const localOnlyIds = localIds.filter((id: string) => !serverSet.has(id));
      if (localOnlyIds.length > 0) api.syncReadingBatch(localOnlyIds);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleSave = async (item: ContentItem) => {
    const isCurrentlySaved = saved.some((i) => i.id === item.id);
    if (isCurrentlySaved) {
      setSaved((prev) => prev.filter((i) => i.id !== item.id));
      await api.deleteBookmark(item.id);
    } else {
      const mapped = { ...item };
      setSaved((prev) => [...prev, mapped]);
      await api.addBookmark(item.id);
    }
  };

  const toggleLike = async (item: ContentItem) => {
    const isLiked = likedIds.has(item.id);
    // Optimistic: the heart answers immediately, the server confirms after.
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (isLiked) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
    const res = isLiked ? await api.deleteLike(item.id) : await api.addLike(item.id);
    if (!res.success) {
      setLikedIds((prev) => {
        const next = new Set(prev);
        if (isLiked) next.add(item.id);
        else next.delete(item.id);
        return next;
      });
      toast.error(res.error ?? "Le like n’a pas été enregistré.");
    }
  };

  const markRead = (item: ContentItem) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(item.id);
      localStorage.setItem("teachtalk_read_ids", JSON.stringify(Array.from(next)));
      return next;
    });
    setReadDates((prev) => {
      const key = todayKey();
      if (prev.includes(key)) return prev;
      const next = [...prev, key];
      localStorage.setItem("teachtalk_read_dates", JSON.stringify(next));
      return next;
    });
    api.markContentRead(item.id);
  };

  /** Replace the whole set (§16 lets the picker be revised at any time). */
  const setInterests = async (next: InterestTag[]) => {
    const previous = interestTags;
    const bySlug = (list: InterestTag[]) => list.map((t) => t.slug);
    setInterestTags(next);
    saveInterestSlugs(bySlug(next));
    const res = await api.saveMyInterests(bySlug(next));
    if (!res.success) {
      setInterestTags(previous);
      saveInterestSlugs(bySlug(previous));
      toast.error(res.error ?? "Centres d’intérêt non enregistrés.");
      return;
    }
    // The server answers with the rows it actually stored, so a slug that was
    // renamed or merged upstream cannot drift on the client.
    setInterestTags(res.tags ?? next);
    saveInterestSlugs(bySlug(res.tags ?? next));
  };

  const toggleInterest = (tag: InterestTag) =>
    setInterests(
      interestTags.some((t) => t.slug === tag.slug)
        ? interestTags.filter((t) => t.slug !== tag.slug)
        : [...interestTags, tag]
    );

  const applyInterestsLocal = (tags: InterestTag[]) => {
    setInterestTags(tags);
    saveInterestSlugs(tags.map((t) => t.slug));
  };

  return (
    <Ctx.Provider
      value={{
        user,
        setUser: onUserUpdate,
        logout: onLogout,
        saved,
        savedIds: new Set(saved.map((i) => i.id)),
        savedError,
        toggleSave,
        likedIds,
        toggleLike,
        readIds,
        readDates,
        markRead,
        interestTags,
        interests: interestTags.map((t) => t.name),
        interestSlugs: interestTags.map((t) => t.slug),
        toggleInterest,
        setInterests,
        applyInterestsLocal,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
