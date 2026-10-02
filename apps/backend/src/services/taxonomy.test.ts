import { describe, it, expect, vi } from 'vitest';

// The seed is matched in isolation: importing this module opens a database
// connection through taxonomy, which a pure keyword test must not need.
vi.mock('../db/db.js', () => ({ db: {} }));

import { TAG_SEED, deriveTags } from './taxonomy.js';

const slugs = (...texts: string[]) => deriveTags(...texts).map((def) => def.slug);

describe('deriveTags', () => {
  it('finds the tags of the example in §9', () => {
    const tags = slugs('Build a Fastify REST API');
    expect(tags).toContain('fastify');
    expect(tags).toContain('api');
    expect(tags).toContain('backend');
  });

  it('does not match a keyword inside a longer word', () => {
    expect(slugs('Designing a logo for my brand')).not.toContain('go');
    expect(slugs('Reactive programming explained')).not.toContain('react');
    expect(slugs('This email says hello')).not.toContain('intelligence-artificielle');
  });

  it('reads French and English titles alike', () => {
    expect(slugs('Tutoriel C++ : les pointeurs en mémoire')).toEqual(
      expect.arrayContaining(['c-plus-plus', 'systemes'])
    );
    expect(slugs('Apprendre Rust et le borrow checker')).toEqual(expect.arrayContaining(['rust']));
  });

  it('tells the Go language from the verb, which a word boundary cannot', () => {
    expect(slugs('Our page tells you to go and fix their settings')).not.toContain('go');
    expect(slugs('Go vs Rust for backend services')).toContain('go');
    expect(slugs('A golden gate for your API')).not.toContain('go');
  });

  it('infers the domain a tool belongs to', () => {
    expect(slugs('Docker and Kubernetes in production')).toEqual(
      expect.arrayContaining(['devops', 'cloud'])
    );
    expect(slugs('React hooks for beginners')).toContain('frontend');
  });

  it('returns nothing for text with no dictionary hit', () => {
    expect(slugs('Une nouvelle intéressante sur les prix')).toHaveLength(0);
    expect(slugs('', null, undefined)).toHaveLength(0);
  });

  it('never returns the same tag twice for repeated mentions', () => {
    expect(slugs('TypeScript generics in TypeScript')).toEqual(['typescript']);
  });

  it('keeps the seed free of duplicate slugs and empty keyword lists', () => {
    const seen = new Set<string>();
    for (const def of TAG_SEED) {
      expect(seen.has(def.slug)).toBe(false);
      seen.add(def.slug);
      expect(def.keywords.length).toBeGreaterThan(0);
    }
  });

  it('searches the whole text a content carries', () => {
    expect(slugs('Weekly roundup', '  ', 'Everything about Kubernetes and GitOps')).toContain('cloud');
  });
});
