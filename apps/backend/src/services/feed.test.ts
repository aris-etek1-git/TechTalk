import { describe, it, expect } from 'vitest';
import {
  applyDiversity,
  decodeCursor,
  encodeCursor,
  scoreCandidate,
  type FeedCandidate,
  type FeedSignals,
} from './feed.js';

const NOW = new Date('2026-10-02T12:00:00.000Z');
const TAG_REACT = { id: 'tag-react', slug: 'react', name: 'React', kind: 'tool' as const };
const TAG_RUST = { id: 'tag-rust', slug: 'rust', name: 'Rust', kind: 'language' as const };
const TAG_BACKEND = { id: 'tag-backend', slug: 'backend', name: 'Backend', kind: 'topic' as const };

function candidate(over: Partial<FeedCandidate> = {}): FeedCandidate {
  return {
    id: over.id ?? 'c1',
    title: 'Titre',
    url: 'https://example.com/1',
    source: over.source ?? 'Dev.to',
    type: 'article',
    summary: null,
    image: null,
    author: null,
    publishedAt: over.publishedAt ?? NOW,
    createdAt: over.createdAt ?? NOW,
    tags: over.tags ?? [],
  };
}

function signals(over: Partial<FeedSignals> = {}): FeedSignals {
  return {
    interests: over.interests ?? new Set(),
    liked: over.liked ?? new Set(),
    saved: over.saved ?? new Set(),
    seen: over.seen ?? new Set(),
    skipped: over.skipped ?? new Set(),
    popularity: over.popularity ?? new Map(),
  };
}

const score = (over: Partial<FeedCandidate>, sig: Partial<FeedSignals> = {}) =>
  scoreCandidate(candidate(over), signals(sig), NOW).score;

describe('scoreCandidate (§11 level 4)', () => {
  it('ranks an interest match above an unrelated item', () => {
    const matched = score({ tags: [TAG_REACT] }, { interests: new Set(['tag-react']) });
    expect(matched).toBeGreaterThan(score({}, {}));
  });

  it('rewards two matched tags but stops counting at two', () => {
    const two = score({ tags: [TAG_REACT, TAG_BACKEND] }, { interests: new Set(['tag-react', 'tag-backend']) });
    const three = score(
      { tags: [TAG_REACT, TAG_BACKEND, TAG_RUST] },
      { interests: new Set(['tag-react', 'tag-backend', 'tag-rust']) }
    );
    expect(two).toBeCloseTo(three, 6);
  });

  it('pushes a brand new item above a two-month-old one', () => {
    const fresh = score({ publishedAt: NOW });
    const stale = score({ publishedAt: new Date(NOW.getTime() - 60 * 86400_000) });
    expect(fresh).toBeGreaterThan(stale);
  });

  it('demotes what the user already read and buries what they skipped', () => {
    const clean = score({ tags: [TAG_REACT] }, { interests: new Set(['tag-react']) });
    const seen = score({ tags: [TAG_REACT] }, { interests: new Set(['tag-react']), seen: new Set(['c1']) });
    const skipped = score({ tags: [TAG_REACT] }, { interests: new Set(['tag-react']), skipped: new Set(['c1']) });
    expect(seen).toBeLessThan(clean);
    expect(skipped).toBeLessThan(seen);
  });

  it('lifts liked and saved items without letting popularity shout', () => {
    const liked = score({}, { liked: new Set(['c1']) });
    expect(liked).toBeGreaterThan(score({}, {}));

    const popular = score({}, { popularity: new Map([['c1', 200]]) });
    const barely = score({}, { popularity: new Map([['c1', 2]]) });
    expect(popular).toBeGreaterThan(barely);
    // log1p: 100x more likes must not mean 100x the score
    expect(popular - barely).toBeLessThan(6);
  });

  it('names the tags and the age that produced the ranking', () => {
    const result = scoreCandidate(
      candidate({ tags: [TAG_RUST] }),
      signals({ interests: new Set(['tag-rust']), popularity: new Map([['c1', 8]]) }),
      NOW
    );
    expect(result.reasons).toContain('Rust');
    expect(result.reasons).toContain('Nouveau');
    expect(result.reasons).toContain('8 likes');
  });
});

describe('applyDiversity (§76)', () => {
  const item = (id: string, tag: typeof TAG_REACT, source = 'YouTube') =>
    scoreCandidate(candidate({ id, source, tags: [tag] }), signals(), NOW);

  const distinct = Array.from({ length: 10 }, (_, i) =>
    item(`u${i}`, { id: `unique-${i}`, slug: `s${i}`, name: `S${i}`, kind: 'topic' as const })
  );
  const cluster = Array.from({ length: 10 }, (_, i) => item(`r${i}`, TAG_REACT));

  it('stops a single tag from owning the page', () => {
    const page = applyDiversity([...cluster, ...distinct], 6);
    expect(page).toHaveLength(6);
    const clustered = page.filter((entry) => entry.candidate.tags.some((t) => t.id === 'tag-react')).length;
    expect(clustered * 2).toBeLessThanOrEqual(page.length);
  });

  it('mixes sources instead of serving one channel six times', () => {
    const page = applyDiversity(
      [
        ...Array.from({ length: 10 }, (_, i) => item(`y${i}`, { id: 'a', slug: 'a', name: 'A', kind: 'topic' as const }, 'YouTube')),
        ...Array.from({ length: 10 }, (_, i) => item(`d${i}`, { id: 'b', slug: 'b', name: 'B', kind: 'topic' as const }, 'Dev.to')),
      ],
      8
    );
    expect(new Set(page.map((entry) => entry.candidate.source)).size).toBe(2);
  });

  it('still fills the page when the catalog is narrower than the caps', () => {
    const page = applyDiversity(cluster, 10);
    expect(page).toHaveLength(10);
  });
});

describe('cursor (§57)', () => {
  it('round-trips the key it encodes', () => {
    const row = { createdAt: new Date('2026-10-01T09:30:00.000Z'), id: '3f1b3a4c-5d6e-4a7b-8c9d-0e1f2a3b4c5d' };
    const decoded = decodeCursor(encodeCursor(row));
    expect(decoded?.id).toBe(row.id);
    expect(decoded?.createdAt.toISOString()).toBe(row.createdAt.toISOString());
  });

  it('refuses a cursor it did not mint', () => {
    expect(decodeCursor(undefined)).toBeNull();
    expect(decodeCursor('not-a-cursor')).toBeNull();
    expect(decodeCursor(Buffer.from('garbage', 'utf8').toString('base64url'))).toBeNull();
  });
});
