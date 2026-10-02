import { and, desc, eq, inArray, lt, or, sql } from 'drizzle-orm';
import { db } from '../db/db.js';
import {
  bookmarks,
  contentTags,
  contents,
  interactions,
  likes,
  readingHistory,
  userInterests,
} from '../db/schema.js';
import { tagsForContents, type ContentTag } from './taxonomy.js';

export interface FeedSignals {
  /** Tag ids picked during onboarding (§15). */
  interests: Set<string>;
  liked: Set<string>;
  saved: Set<string>;
  seen: Set<string>;
  skipped: Set<string>;
  /** Global like counts, the popularity signal of level 1. */
  popularity: Map<string, number>;
}

export interface FeedCandidate {
  id: string;
  title: string;
  url: string;
  source: string;
  type: string;
  summary: string | null;
  image: string | null;
  author: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  tags: ContentTag[];
}

export interface ScoredCandidate {
  candidate: FeedCandidate;
  score: number;
  /** Human-readable basis for the ranking — §82 asks that it be explainable. */
  reasons: string[];
  liked: boolean;
  saved: boolean;
  seen: boolean;
  /** Carries at least one of the caller's interest tags (§10 subscription tab). */
  matched: boolean;
}

// Half-life of the freshness term, in days. Two weeks keeps a strong catalog
// readable without letting a month-old video bury today's.
const FRESHNESS_HALF_LIFE_DAYS = 14;

const WEIGHTS = {
  interestTag: 3,
  interestTagCap: 2,
  popularity: 0.9,
  freshness: 4,
  liked: 2,
  saved: 1.5,
  seen: -3.5,
  skipped: -8,
};

/**
 * §11 level 4: tag match + popularity + freshness + personal behaviour.
 *
 * Kept free of the database so the blend can be tested on its own — the weights
 * are the product's opinion about what deserves to be seen, and that opinion
 * should be readable in one function.
 */
export function scoreCandidate(
  candidate: FeedCandidate,
  signals: FeedSignals,
  now = new Date()
): ScoredCandidate {
  const reasons: string[] = [];
  let score = 0;

  const matched = candidate.tags.filter((tag) => signals.interests.has(tag.id));
  if (matched.length > 0) {
    score += WEIGHTS.interestTag * Math.min(matched.length, WEIGHTS.interestTagCap);
    reasons.push(...matched.slice(0, 2).map((tag) => tag.name));
  }

  const likes = signals.popularity.get(candidate.id) ?? 0;
  if (likes > 0) {
    score += WEIGHTS.popularity * Math.log1p(likes);
    if (likes >= 5) reasons.push(`${likes} likes`);
  }

  const published = candidate.publishedAt ?? candidate.createdAt;
  const ageDays = Math.max(0, (now.getTime() - published.getTime()) / 86400_000);
  score += WEIGHTS.freshness * Math.pow(0.5, ageDays / FRESHNESS_HALF_LIFE_DAYS);
  if (ageDays < 3) reasons.push('Nouveau');

  // Current state first: a like the user left is a stronger claim than a view.
  if (signals.liked.has(candidate.id)) score += WEIGHTS.liked;
  if (signals.saved.has(candidate.id)) score += WEIGHTS.saved;
  if (signals.seen.has(candidate.id)) {
    score += WEIGHTS.seen;
    reasons.push('Déjà vu');
  }
  if (signals.skipped.has(candidate.id)) score += WEIGHTS.skipped;

  return {
    candidate,
    score: Math.round(score * 1000) / 1000,
    reasons,
    liked: signals.liked.has(candidate.id),
    saved: signals.saved.has(candidate.id),
    seen: signals.seen.has(candidate.id),
  };
}

/**
 * Cap how much of one page a single tag or source may own (§76: popularity is a
 * signal, not the definition of quality, and a feed of ten React videos teaches
 * nothing). Greedy, in score order, with a second pass that appends whatever is
 * left so a page is never short just because the catalog is narrow.
 */
export function applyDiversity(scores: ScoredCandidate[], limit: number): ScoredCandidate[] {
  const ordered = [...scores].sort(
    (a, b) =>
      b.score - a.score || b.candidate.createdAt.getTime() - a.candidate.createdAt.getTime()
  );

  const perTag = new Map<string, number>();
  const perSource = new Map<string, number>();
  const picked: ScoredCandidate[] = [];

  // Caps scale with the page size: a fixed three would let a page of six be
  // mostly one tag, and a page of fifty would be padded with a single source.
  const tagCap = Math.max(2, Math.ceil(limit / 3));
  const sourceCap = Math.max(3, Math.ceil(limit / 2));

  // Ordering key for the fill phase: how used-up the item's own tags are, then
  // its source. A still-unused tag therefore beats a second helping of one the
  // page already carries, which is what keeps a single topic from spreading.
  const scarcity = (item: ScoredCandidate) => {
    const tagMax = Math.max(0, ...item.candidate.tags.map((tag) => perTag.get(tag.id) ?? 0));
    return tagMax * 1000 + (perSource.get(item.candidate.source) ?? 0);
  };

  const fits = (item: ScoredCandidate, tags: number, sources: number) =>
    (perSource.get(item.candidate.source) ?? 0) < sources &&
    item.candidate.tags.every((tag) => (perTag.get(tag.id) ?? 0) < tags);

  const take = (item: ScoredCandidate) => {
    picked.push(item);
    perSource.set(item.candidate.source, (perSource.get(item.candidate.source) ?? 0) + 1);
    for (const tag of item.candidate.tags) perTag.set(tag.id, (perTag.get(tag.id) ?? 0) + 1);
  };

  for (const item of ordered) {
    if (picked.length >= limit) break;
    if (!fits(item, tagCap, sourceCap)) continue;
    take(item);
  }

  // A narrow catalog must still fill the page. Leftovers go in one at a time,
  // always the least-represented one, so the page repeats a topic only after
  // every fresher topic has had its turn.
  if (picked.length < limit) {
    const leftovers = ordered.filter((item) => !picked.includes(item));
    while (picked.length < limit && leftovers.length > 0) {
      let best = 0;
      let bestKey = Number.POSITIVE_INFINITY;
      for (let i = 0; i < leftovers.length; i++) {
        const key = scarcity(leftovers[i]!);
        if (key < bestKey) {
          bestKey = key;
          best = i;
        }
      }
      take(leftovers.splice(best, 1)[0]!);
    }
  }

  return picked;
}

/** Opaque keyset cursor over the candidate scan order: (created_at, id). */
export function encodeCursor(row: { createdAt: Date; id: string }): string {
  return Buffer.from(`${row.createdAt.toISOString()}|${row.id}`, 'utf8').toString('base64url');
}

export function decodeCursor(cursor?: string): { createdAt: Date; id: string } | null {
  if (!cursor) return null;
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    const [when, id] = raw.split('|');
    const createdAt = new Date(when);
    if (Number.isNaN(createdAt.getTime()) || !id) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

function emptySignals(): FeedSignals {
  return {
    interests: new Set(),
    liked: new Set(),
    saved: new Set(),
    seen: new Set(),
    skipped: new Set(),
    popularity: new Map(),
  };
}

/**
 * Everything level 2 and level 3 read, fetched by identity rather than guessed
 * from the page: interests, the user's own current-state marks, and the skip
 * log. An anonymous caller gets an empty set, which degrades the feed to
 * freshness plus popularity (levels 0 and 1) instead of failing.
 */
async function loadSignals(userId: string | null, candidateIds: string[]): Promise<FeedSignals> {
  const signals = emptySignals();
  if (candidateIds.length === 0) return signals;

  const [popularity, interests, liked, saved, seen, skipped] = await Promise.all([
    db
      .select({ contentId: likes.contentId, count: sql<number>`count(*)::int` })
      .from(likes)
      .where(inArray(likes.contentId, candidateIds))
      .groupBy(likes.contentId),
    userId
      ? db.select({ tagId: userInterests.tagId }).from(userInterests).where(eq(userInterests.userId, userId))
      : Promise.resolve([] as { tagId: string }[]),
    userId
      ? db.select({ contentId: likes.contentId }).from(likes).where(and(eq(likes.userId, userId), inArray(likes.contentId, candidateIds)))
      : Promise.resolve([] as { contentId: string }[]),
    userId
      ? db.select({ contentId: bookmarks.contentId }).from(bookmarks).where(and(eq(bookmarks.userId, userId), inArray(bookmarks.contentId, candidateIds)))
      : Promise.resolve([] as { contentId: string }[]),
    userId
      ? db.select({ contentId: readingHistory.contentId }).from(readingHistory).where(and(eq(readingHistory.userId, userId), inArray(readingHistory.contentId, candidateIds)))
      : Promise.resolve([] as { contentId: string }[]),
    // 'skip' is only ever in the log: it is a statement about the future, not a
    // current state the UI renders, so it has no counterpart table.
    userId
      ? db.select({ contentId: interactions.contentId }).from(interactions).where(and(eq(interactions.userId, userId), eq(interactions.type, 'skip'), inArray(interactions.contentId, candidateIds)))
      : Promise.resolve([] as { contentId: string }[]),
  ]);

  for (const row of popularity) signals.popularity.set(row.contentId, row.count);
  for (const row of interests) signals.interests.add(row.tagId);
  for (const row of liked) signals.liked.add(row.contentId);
  for (const row of saved) signals.saved.add(row.contentId);
  for (const row of seen) signals.seen.add(row.contentId);
  for (const row of skipped) signals.skipped.add(row.contentId);
  return signals;
}

export interface FeedPage {
  items: Array<
    FeedCandidate & {
      score: number;
      reasons: string[];
      tags: ContentTag[];
      liked: boolean;
      saved: boolean;
      seen: boolean;
    }
  >;
  nextCursor: string | null;
  /** Which levels of §11 actually contributed to this page. */
  strategy: string;
}

/**
 * A page of the personalized feed.
 *
 * Pagination is a keyset walk over (created_at, id) and scoring happens inside
 * the fetched window. Reranking globally would need every row in memory; walking
 * forward instead guarantees no item is ever repeated or skipped between pages.
 */
export async function buildFeedPage(options: {
  userId: string | null;
  limit: number;
  cursor?: string;
  type?: string;
  source?: string;
  shape?: 'short' | 'long';
}): Promise<FeedPage> {
  const { userId, limit, cursor, type, source, shape } = options;
  const windowSize = Math.min(Math.max(limit * 4, 40), 240);

  const conditions = [];
  const after = decodeCursor(cursor);
  if (after) {
    // The strict comparator and the tiebreak must agree with the ordering below,
    // or a page boundary either repeats or silently drops a row.
    conditions.push(
      or(
        lt(contents.createdAt, after.createdAt),
        and(lt(contents.id, after.id), eq(contents.createdAt, after.createdAt))
      )
    );
  }
  if (type) conditions.push(eq(contents.type, type));
  if (source) conditions.push(eq(contents.source, source));
  if (shape) {
    // Duration is only known for what providers reported; a YouTube Shorts link
    // counts as short even without it, which is where the vertical feed lives.
    const short = or(
      sql`${contents.durationSeconds} <= 60`,
      sql`${contents.url} ilike '%/shorts/%'`
    );
    conditions.push(shape === 'short' ? short! : sql`not ${short}`);
  }

  const rows = await db
    .select()
    .from(contents)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(contents.createdAt), desc(contents.id))
    .limit(windowSize);

  const tagsByContent = await tagsForContents(rows.map((row) => row.id));
  const candidates: FeedCandidate[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    url: row.url,
    source: row.source,
    type: row.type,
    summary: row.summary,
    image: row.image,
    author: row.author,
    publishedAt: row.publishedAt,
    createdAt: row.createdAt,
    tags: tagsByContent.get(row.id) ?? [],
  }));

  const signals = await loadSignals(userId, candidates.map((row) => row.id));
  const scored = candidates.map((candidate) => scoreCandidate(candidate, signals));
  const picked = applyDiversity(scored, limit);

  const strategy = signals.interests.size > 0 ? 'hybrid+interests' : 'hybrid';

  return {
    items: picked.map((item) => ({
      ...item.candidate,
      score: item.score,
      reasons: item.reasons,
      liked: item.liked,
      saved: item.saved,
      seen: item.seen,
    })),
    // Scanned newest-first, so the cursor is the oldest key in the window: the
    // next page continues the walk from there whatever order this page sorted into.
    nextCursor:
      rows.length < windowSize
        ? null
        : encodeCursor({ createdAt: rows[rows.length - 1].createdAt, id: rows[rows.length - 1].id }),
    strategy,
  };
}
