import { eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db/db.js';
import { contentTags, contents, tags, type TagKind } from '../db/schema.js';

export interface TagDef {
  slug: string;
  name: string;
  kind: TagKind;
  keywords: string[];
}

// §9 needs tags that search, discovery, recommendation, progression and the
// school program all resolve onto the same row. A curated dictionary makes that
// hold: free-form extraction would mint `react`, `ReactJS` and `react-js` as
// three separate interests a student cannot pick between.
export const TAG_SEED: TagDef[] = [
  // --- Domains -----------------------------------------------------------
  { slug: 'algorithmes', name: 'Algorithmes', kind: 'topic', keywords: ['algorithm', 'algorithms', 'algorithmes', 'big o', 'complexity', 'data structure', 'dynamic programming', 'recursion', 'sorting', 'graphes', 'arbres', 'dynamique'] },
  { slug: 'frontend', name: 'Frontend', kind: 'topic', keywords: ['frontend', 'front-end', 'ui', 'ux', 'css', 'html', 'web design', 'accessibility'] },
  { slug: 'backend', name: 'Backend', kind: 'topic', keywords: ['backend', 'back-end', 'server side', 'server-side', 'scalability', 'load balancing', 'idempotency', 'checkout', 'payment', 'webhook'] },
  { slug: 'developpement-web', name: 'Développement web', kind: 'topic', keywords: ['web development', 'developpement web', 'web app', 'website', 'full stack', 'fullstack', 'http', 'browser'] },
  { slug: 'intelligence-artificielle', name: 'Intelligence artificielle', kind: 'topic', keywords: ['ai', 'artificial intelligence', 'intelligence artificielle', 'machine learning', 'deep learning', 'neural network', 'llm', 'gpt', 'genai', 'agents ia'] },
  { slug: 'data', name: 'Data', kind: 'topic', keywords: ['data engineering', 'data science', 'analytics', 'pipeline de donnees', 'etl', 'spark', 'pandas', 'visualization'] },
  { slug: 'cybersecurite', name: 'Cybersécurité', kind: 'topic', keywords: ['security', 'cybersecurity', 'cybersecurite', 'sécurité', 'vulnerability', 'exploit', 'penetration testing', 'ctf', 'encryption', 'malware', 'breach'] },
  { slug: 'systemes', name: 'Systèmes', kind: 'topic', keywords: ['system', 'operating system', 'kernel', 'concurrency', 'multithreading', 'memory', 'low level', 'embedded', 'compiler', 'pointeur', 'embarque', 'thread'] },
  { slug: 'bases-de-donnees', name: 'Bases de données', kind: 'topic', keywords: ['database', 'bases de donnees', 'sql', 'nosql', 'indexing', 'query optimization', 'transactions', 'orm'] },
  { slug: 'devops', name: 'DevOps', kind: 'topic', keywords: ['devops', 'ci cd', 'ci/cd', 'deployment', 'pipeline', 'monitoring', 'observability', 'infrastructure as code', 'sre', 'docker', 'kubernetes', 'container'] },
  { slug: 'cloud', name: 'Cloud', kind: 'topic', keywords: ['cloud', 'serverless', 'aws', 'azure', 'gcp', 'terraform', 'kubernetes', 'docker', 'container'] },
  { slug: 'mobile', name: 'Mobile', kind: 'topic', keywords: ['mobile', 'android', 'ios', 'swift', 'kotlin', 'flutter', 'react native'] },
  { slug: 'open-source', name: 'Open source', kind: 'topic', keywords: ['open source', 'open-source', 'contributing', 'maintainer', 'license', 'github sponsor'] },
  { slug: 'architecture-logicielle', name: 'Architecture logicielle', kind: 'topic', keywords: ['architecture', 'microservices', 'design pattern', 'domain driven', 'hexagonal', 'clean code', 'solid', 'circuit breaker', 'message broker', 'concurrency pattern'] },
  { slug: 'reseaux', name: 'Réseaux', kind: 'topic', keywords: ['network', 'reseaux', 'tcp', 'dns', 'socket', 'protocol', 'load balancer', 'message broker', 'circuit breaker', 'idempotency', 'rate limit'] },
  { slug: 'carriere', name: 'Carrière', kind: 'topic', keywords: ['career', 'carriere', 'internship', 'stage', 'job interview', 'entretien', 'resume', 'cv', 'hiring', 'junior', 'senior'] },
  { slug: 'projets', name: 'Projets', kind: 'topic', keywords: ['project', 'projet', 'portfolio', 'side project', 'hackathon', 'build a', 'tutorial'] },
  { slug: 'pratique', name: 'Pratique', kind: 'topic', keywords: ['practice', 'pratique', 'exercise', 'exercice', 'leetcode', 'codewars', 'coding challenge', 'competition'] },
  { slug: 'apprentissage', name: 'Apprentissage', kind: 'topic', keywords: ['learn', 'apprendre', 'course', 'cours', 'curriculum', 'roadmap', 'study', 'beginner', 'debutant'] },

  // --- Languages ---------------------------------------------------------
  { slug: 'typescript', name: 'TypeScript', kind: 'language', keywords: ['typescript', 'ts'] },
  { slug: 'javascript', name: 'JavaScript', kind: 'language', keywords: ['javascript', 'js', 'ecmascript', 'es6'] },
  { slug: 'python', name: 'Python', kind: 'language', keywords: ['python', 'pytest', 'django', 'flask', 'fastapi'] },
  { slug: 'rust', name: 'Rust', kind: 'language', keywords: ['rust', 'cargo', 'ownership', 'borrow checker'] },
  { slug: 'c-plus-plus', name: 'C++', kind: 'language', keywords: ['c++', 'cpp', 'g++', 'std::', 'pointeur'] },
  { slug: 'c', name: 'C', kind: 'language', keywords: ['calloc', 'malloc', 'libc', 'c language'] },
  { slug: 'go', name: 'Go', kind: 'language', keywords: ['golang', 'goroutine', '/\\bGo\\b(?!ld)/'] },
  { slug: 'java', name: 'Java', kind: 'language', keywords: ['java', 'spring boot', 'maven', 'jvm'] },
  { slug: 'sql', name: 'SQL', kind: 'language', keywords: ['postgresql', 'postgres', 'mysql', 'sqlite', 'join', 'select', 'where clause'] },

  // --- Tools -------------------------------------------------------------
  { slug: 'react', name: 'React', kind: 'tool', keywords: ['react', 'reactjs', 'hooks', 'jsx', 'next.js', 'nextjs'] },
  { slug: 'nodejs', name: 'Node.js', kind: 'tool', keywords: ['node', 'nodejs', 'node.js', 'npm', 'pnpm', 'v8'] },
  { slug: 'fastify', name: 'Fastify', kind: 'tool', keywords: ['fastify'] },
  { slug: 'express', name: 'Express', kind: 'tool', keywords: ['express', 'koa', 'hono'] },
  { slug: 'tailwind-css', name: 'Tailwind CSS', kind: 'tool', keywords: ['tailwind', 'tailwindcss'] },
  { slug: 'git', name: 'Git', kind: 'tool', keywords: ['git', 'github', 'gitlab', 'commit', 'branch', 'pull request'] },
  { slug: 'api', name: 'API', kind: 'tool', keywords: ['api', 'apis', 'graphql', 'grpc', 'websocket', 'endpoint', 'webhook'] },
  { slug: 'linux', name: 'Linux', kind: 'tool', keywords: ['linux', 'bash', 'shell', 'ubuntu', 'terminal', 'systemd'] },
  { slug: 'drizzle', name: 'Drizzle', kind: 'tool', keywords: ['drizzle', 'prisma', 'kysely'] },
  { slug: 'vite', name: 'Vite', kind: 'tool', keywords: ['vite', 'webpack', 'esbuild', 'bundler'] },
];

const SLUG_BY_INDEX = new Map(TAG_SEED.map((def) => [def.slug, def]));

// A viewer who watches a Fastify tutorial is watching a backend tutorial, even
// when the title never says so. §11 level 2 compares interests to content tags,
// and students pick domains, not tools, so the tool hit has to carry its domain.
// Languages are deliberately absent: TypeScript belongs to both sides.
const DOMAIN_HINTS: Record<string, string[]> = {
  react: ['frontend', 'developpement-web'],
  'tailwind-css': ['frontend', 'developpement-web'],
  vite: ['frontend', 'developpement-web'],
  fastify: ['backend', 'developpement-web'],
  express: ['backend', 'developpement-web'],
  nodejs: ['backend'],
  api: ['backend'],
  drizzle: ['backend', 'bases-de-donnees'],
  sql: ['bases-de-donnees'],
  docker: ['devops', 'cloud'],
  kubernetes: ['devops', 'cloud'],
  linux: ['systemes'],
  rust: ['systemes'],
  'c-plus-plus': ['systemes'],
  python: ['data'],
  graphql: ['backend', 'api'],
};

/**
 * Match tag keywords on non-alphanumeric boundaries. A plain `includes` would
 * tag every "logo" as Go and every "reactive" as React, and a feed built on
 * those false positives teaches the user nothing.
 */
type Compiled = { def: TagDef; loose: RegExp[]; exact: RegExp[] };

/**
 * Two matching modes. Plain keywords are matched case-insensitively on a
 * lowercased haystack, tolerating one trailing 's' so `algorithm` catches
 * `algorithms` (only 's' — allowing 'es' would read "goes" as the Go language).
 * A keyword written between slashes is a raw, case-sensitive regex applied to
 * the original text; that is how `Go` is told apart from the verb in "go and
 * fix your settings", which a word boundary alone cannot separate.
 */
const PATTERNS: Compiled[] = TAG_SEED.map((def) => ({
  def,
  loose: def.keywords
    .filter((keyword) => !keyword.startsWith('/'))
    .map(
      (keyword) =>
        new RegExp(`(?:^|[^a-z0-9])${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?(?:[^a-z0-9]|$)`, 'i')
    ),
  exact: def.keywords
    .filter((keyword) => keyword.startsWith('/'))
    .map((keyword) => new RegExp(keyword.slice(1, -1))),
}));

/** The dictionary tags present in the given text, domains before tools. */
export function deriveTags(...texts: Array<string | null | undefined>): TagDef[] {
  const original = texts.filter(Boolean).join(' \u0000 ');
  const haystack = original.toLowerCase();
  const hits = PATTERNS.filter(
    ({ loose, exact }) => loose.some((p) => p.test(haystack)) || exact.some((p) => p.test(original))
  ).map(({ def }) => def);

  const seen = new Set(hits.map((def) => def.slug));
  // PATTERNS is built from TAG_SEED, which lists domains first, so pushing a
  // hinted domain keeps every hit in dictionary order.
  for (const def of [...hits]) {
    for (const slug of DOMAIN_HINTS[def.slug] ?? []) {
      if (seen.has(slug)) continue;
      const hinted = SLUG_BY_INDEX.get(slug);
      if (!hinted) continue;
      seen.add(slug);
      hits.push(hinted);
    }
  }

  return hits;
}

/** Insert the missing definitions and return every requested slug's id. */
export async function ensureTags(defs: Pick<TagDef, 'slug' | 'name' | 'kind'>[]): Promise<Map<string, string>> {
  if (defs.length === 0) return new Map();

  await db
    .insert(tags)
    .values(defs.map((def) => ({ slug: def.slug, name: def.name, kind: def.kind })))
    .onConflictDoNothing({ target: tags.slug });

  // Read back by slug, never by position: an upsert that skipped returns no row,
  // so positional pairing would attach the wrong tag to a content.
  const rows = await db
    .select({ id: tags.id, slug: tags.slug })
    .from(tags)
    .where(inArray(tags.slug, defs.map((def) => def.slug)));

  return new Map(rows.map((row) => [row.slug, row.id]));
}

/**
 * Attach derived tags to one content and keep `usage_count` a real count of
 * the join rows, not an estimate.
 */
export async function tagContent(contentId: string, defs: TagDef[]): Promise<string[]> {
  if (defs.length === 0) return [];

  const idsBySlug = await ensureTags(defs);
  const values = defs
    .map((def) => idsBySlug.get(def.slug))
    .filter((id): id is string => Boolean(id))
    .map((tagId) => ({ contentId, tagId }));
  if (values.length === 0) return [];

  const inserted = await db
    .insert(contentTags)
    .values(values)
    .onConflictDoNothing({ target: [contentTags.contentId, contentTags.tagId] })
    .returning({ tagId: contentTags.tagId });

  if (inserted.length > 0) {
    const insertedIds = inserted.map((row) => row.tagId);
    await db
      .update(tags)
      .set({ usageCount: sql`${tags.usageCount} + 1` })
      .where(inArray(tags.id, insertedIds));
  }

  return values.map((value) => value.tagId);
}

/**
 * Tag every content that carries no label yet, from its own text. Live scraping
 * and this backfill share `tagContent`, so neither can invent a slug the picker
 * does not already offer.
 */
export async function tagUntaggedContents(limit = 200): Promise<number> {
  const rows = await db
    .select({ id: contents.id, title: contents.title, summary: contents.summary, body: contents.body })
    .from(contents)
    .where(sql`not exists (select 1 from content_tags ct where ct.content_id = ${contents.id})`)
    .limit(limit);

  let tagged = 0;
  for (const row of rows) {
    const attached = await tagContent(row.id, deriveTags(row.title, row.summary, row.body));
    if (attached.length > 0) tagged += 1;
  }
  return tagged;
}

/**
 * Set every `usage_count` from the join table. The Explore ordering reads this
 * column, so a drifted counter would silently rank a dead tag above a live one.
 */
export async function rebuildTagUsageCounts(): Promise<void> {
  await db.execute(
    sql`update tags t set usage_count = (
           select count(*)::int from content_tags ct where ct.tag_id = t.id
         )`
  );
}

export type ContentTag = Pick<TagDef, 'slug' | 'name' | 'kind'> & { id: string };

/** Tags for a page of contents, in one query, keyed by content id. */
export async function tagsForContents(contentIds: string[]): Promise<Map<string, ContentTag[]>> {
  const byContent = new Map<string, ContentTag[]>();
  if (contentIds.length === 0) return byContent;

  const rows = await db
    .select({
      contentId: contentTags.contentId,
      id: tags.id,
      slug: tags.slug,
      name: tags.name,
      kind: tags.kind,
    })
    .from(contentTags)
    .innerJoin(tags, eq(contentTags.tagId, tags.id))
    .where(inArray(contentTags.contentId, contentIds));

  for (const row of rows) {
    const list = byContent.get(row.contentId) ?? [];
    list.push({ id: row.id, slug: row.slug, name: row.name, kind: row.kind as TagKind });
    byContent.set(row.contentId, list);
  }
  return byContent;
}

export function tagDefBySlug(slug: string): TagDef | undefined {
  return SLUG_BY_INDEX.get(slug);
}
