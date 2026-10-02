import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL ||= 'postgres://test:test@localhost:5432/test';
  process.env.JWT_SECRET ||= 'integration-test-secret';
});

const queue = vi.hoisted(() => ({ results: [] as unknown[] }));

vi.mock('./db/db.js', () => {
  const chain: any = new Proxy(function () {}, {
    get(_target, prop) {
      if (prop === 'then') {
        return (resolve: (value: unknown) => void) => resolve(queue.results.shift() ?? []);
      }
      return () => chain;
    },
    apply: () => chain,
  });
  return { db: chain };
});

import { createApp } from './app.js';
import type { FastifyInstance } from 'fastify';

const USER_ID = '7a1b3a4c-5d6e-4a7b-8c9d-0e1f2a3b4c5d';
const TARGET_ID = '9b1b3a4c-5d6e-4a7b-8c9d-0e1f2a3b4c5d';
const CONTENT_ID = '3f1b3a4c-5d6e-4a7b-8c9d-0e1f2a3b4c5d';

let app: FastifyInstance;

function bearer(role = 'user') {
  return { authorization: `Bearer ${app.jwt.sign({ id: USER_ID, email: 'marcellin@epitech.eu', role })}` };
}

beforeAll(async () => {
  app = await createApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  queue.results = [];
});

describe('tag discovery routes', () => {
  it('requires a token to list tags', async () => {
    const response = await app.inject('/api/tags');
    expect(response.statusCode).toBe(401);
  });

  it('lists tags for a search term', async () => {
    queue.results = [[{ id: 't1', slug: 'rust', name: 'Rust', kind: 'language', usageCount: 4 }]];
    const response = await app.inject({ method: 'GET', url: '/api/tags?q=rust', headers: bearer() });

    expect(response.statusCode).toBe(200);
    expect(response.json().tags).toHaveLength(1);
  });

  it('answers 404 for a tag that does not exist', async () => {
    queue.results = [[]];
    const response = await app.inject({
      method: 'GET',
      url: '/api/tags/does-not-exist/contents',
      headers: bearer(),
    });

    expect(response.statusCode).toBe(404);
  });

  it('keeps the tag backfill administrator-only', async () => {
    queue.results = [[{ id: 't1', slug: 'rust', name: 'Rust' }]];
    const asUser = await app.inject({ method: 'POST', url: '/api/tags/backfill', headers: bearer('user') });
    expect(asUser.statusCode).toBe(403);

    queue.results = [[{ id: CONTENT_ID }]];
    const asAdmin = await app.inject({ method: 'POST', url: '/api/tags/backfill', headers: bearer('admin') });
    expect(asAdmin.statusCode).toBe(200);
    expect(asAdmin.json()).toHaveProperty('tagged');
  });
});

describe('profile and interests', () => {
  it('creates a profile row when the account has none', async () => {
    queue.results = [
      [{ id: 'p1', userId: USER_ID, visibility: 'private' }],
      [{ id: USER_ID, name: 'Marcellin', email: 'm@epitech.eu', username: null, picture: null }],
      [],
      [],
    ];
    const response = await app.inject({ method: 'GET', url: '/api/users/me/profile', headers: bearer() });

    expect(response.statusCode).toBe(200);
    expect(response.json().profile.visibility).toBe('private');
  });

  it('rejects an empty profile patch', async () => {
    queue.results = [[{ id: 'p1', userId: USER_ID }]];
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/users/me/profile',
      headers: bearer(),
      payload: {},
    });

    expect(response.statusCode).toBe(400);
  });

  it('refuses to invent a tag through the interest picker', async () => {
    queue.results = [[{ id: 't1', slug: 'react', name: 'React' }]];
    const response = await app.inject({
      method: 'PUT',
      url: '/api/users/me/interests',
      headers: bearer(),
      payload: { tags: ['react', 'react-js-alias'] },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().message).toContain('react-js-alias');
  });

  it('accepts a picker selection made of known tags', async () => {
    queue.results = [[{ id: 't1', slug: 'react' }, { id: 't2', slug: 'typescript' }]];
    const response = await app.inject({
      method: 'PUT',
      url: '/api/users/me/interests',
      headers: bearer(),
      payload: { tags: ['react', 'typescript'] },
    });

    expect(response.statusCode).toBe(200);
  });

  it('marks onboarding done only when it was not skipped', async () => {
    queue.results = [
      [{ id: 'p1', userId: USER_ID }],
      [{ id: 'p1', userId: USER_ID, onboardedAt: new Date().toISOString() }],
      [{ id: 't1', slug: 'rust' }],
      [],
    ];
    const response = await app.inject({
      method: 'POST',
      url: '/api/users/me/onboarding',
      headers: bearer(),
      payload: { level: 'intermediate', learningGoals: ['Apprendre Rust'], tags: ['rust'] },
    });

    expect(response.statusCode).toBe(200);
  });
});

describe('public profile visibility (§47, §48)', () => {
  const profileRow = {
    id: 'p1',
    userId: TARGET_ID,
    bio: 'Étudiant en systèmes',
    level: 'intermediate',
    learningGoals: [],
    preferredLanguages: ['fr'],
    visibility: 'private',
    onboardedAt: null,
  };

  it('hides a private profile as a 404 so accounts cannot be probed', async () => {
    queue.results = [[{ id: TARGET_ID, name: 'Obafemi', username: 'obafemi', picture: null }], [profileRow]];
    const response = await app.inject({ method: 'GET', url: '/api/users/obafemi/profile', headers: bearer() });

    expect(response.statusCode).toBe(404);
  });

  it('shows a public profile to an anonymous visitor', async () => {
    queue.results = [[{ id: TARGET_ID, name: 'Obafemi', username: 'obafemi', picture: null }], [{ ...profileRow, visibility: 'public' }]];
    const response = await app.inject({ method: 'GET', url: '/api/users/obafemi/profile' });

    expect(response.statusCode).toBe(200);
    expect(response.json().user.username).toBe('obafemi');
  });

  it('keeps a school-only profile away from outsiders', async () => {
    queue.results = [
      [{ id: TARGET_ID, name: 'Obafemi', username: 'obafemi', picture: null }],
      [{ ...profileRow, visibility: 'school_only' }],
      [],
    ];
    const response = await app.inject({ method: 'GET', url: '/api/users/obafemi/profile', headers: bearer() });

    expect(response.statusCode).toBe(403);
  });

  it('grants a school-only profile to a classmate', async () => {
    queue.results = [
      [{ id: TARGET_ID, name: 'Obafemi', username: 'obafemi', picture: null }],
      [{ ...profileRow, visibility: 'school_only' }],
      [{ organizationId: 'org1' }],
    ];
    const response = await app.inject({ method: 'GET', url: '/api/users/obafemi/profile', headers: bearer() });

    expect(response.statusCode).toBe(200);
  });

  it('never resolves a profile by email', async () => {
    queue.results = [[]];
    const response = await app.inject({
      method: 'GET',
      url: `/api/users/${encodeURIComponent('marcellin@epitech.eu')}/profile`,
    });

    expect(response.statusCode).toBe(404);
  });
});

describe('interaction telemetry (§13, §80)', () => {
  it('rejects an unknown interaction type', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/interactions',
      headers: bearer(),
      payload: { items: [{ contentId: CONTENT_ID, type: 'hover' }] },
    });

    expect(response.statusCode).toBe(400);
  });

  it('rejects a completion rate outside 0..1', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/interactions',
      headers: bearer(),
      payload: { items: [{ contentId: CONTENT_ID, type: 'view', completionRate: 1.4 }] },
    });

    expect(response.statusCode).toBe(400);
  });

  it('answers 422 when none of the contents exist', async () => {
    queue.results = [[]];
    const response = await app.inject({
      method: 'POST',
      url: '/api/interactions',
      headers: bearer(),
      payload: { items: [{ contentId: CONTENT_ID, type: 'view', surface: 'feed' }] },
    });

    expect(response.statusCode).toBe(422);
  });

  it('records the signals that reference real contents', async () => {
    queue.results = [[{ id: CONTENT_ID }], [{ id: 'i1' }, { id: 'i2' }]];
    const response = await app.inject({
      method: 'POST',
      url: '/api/interactions',
      headers: bearer(),
      payload: {
        items: [
          { contentId: CONTENT_ID, type: 'view', watchTimeSeconds: 42, completionRate: 0.3, surface: 'feed' },
          { contentId: CONTENT_ID, type: 'like', surface: 'shorts' },
        ],
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().recorded).toBe(2);
  });

  it('exposes the behavioural totals behind the feed', async () => {
    queue.results = [
      [{ type: 'view', count: 12 }],
      [{ slug: 'rust', name: 'Rust', count: 5 }],
    ];
    const response = await app.inject({ method: 'GET', url: '/api/interactions/summary', headers: bearer() });

    expect(response.statusCode).toBe(200);
    expect(response.json().topTags[0].slug).toBe('rust');
  });
});
