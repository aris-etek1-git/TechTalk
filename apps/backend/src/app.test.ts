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

const CAMPUS_ID = '2f1b3a4c-5d6e-4a7b-8c9d-0e1f2a3b4c5d';
const USER_ID = '7a1b3a4c-5d6e-4a7b-8c9d-0e1f2a3b4c5d';
const OTHER_USER_ID = '9b1b3a4c-5d6e-4a7b-8c9d-0e1f2a3b4c5d';

let app: FastifyInstance;

function bearer(payload: { role?: string }) {
  return { authorization: `Bearer ${app.jwt.sign({ id: USER_ID, email: 'marcellin@epitech.eu', ...payload })}` };
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

describe('route registration', () => {
  it('serves the health check without a token', async () => {
    const response = await app.inject('/api/health');
    expect(response.statusCode).toBe(200);
  });

  it('rejects an unauthenticated campus request', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/campuses/mine' });
    expect(response.statusCode).toBe(401);
  });

  // 'mine' is a static sibling of '/:campusId': reaching the controller here
  // proves find-my-way did not swallow it into the campus lookup route.
  it('routes /api/campuses/mine to the member list, not to the campus lookup', async () => {
    queue.results = [[]];
    const response = await app.inject({ method: 'GET', url: '/api/campuses/mine', headers: bearer({ role: 'user' }) });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ campuses: [] });
  });

  it('answers 404 for an unknown campus instead of 403', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/campuses/${CAMPUS_ID}`,
      headers: bearer({ role: 'user' }),
    });

    expect(response.statusCode).toBe(404);
  });

  it('keeps campus creation behind the platform admin role', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/campuses',
      headers: bearer({ role: 'user' }),
      payload: { organizationId: OTHER_USER_ID, name: 'Campus Test' },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().message).toContain('administrators');
  });

  it('applies the campus role guard before the member-update controller', async () => {
    queue.results = [
      [{ id: CAMPUS_ID, isPublic: true }],
      [{ campusId: CAMPUS_ID, userId: USER_ID, role: 'member' }],
    ];
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/campuses/${CAMPUS_ID}/members/${OTHER_USER_ID}`,
      headers: bearer({ role: 'user' }),
      payload: { role: 'moderator' },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().message).toContain("'admin' role");
  });

  it('rejects a payload that fails validation before any query runs', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/campuses',
      headers: bearer({ role: 'admin' }),
      payload: { organizationId: 'not-a-uuid', name: 'x' },
    });

    expect(response.statusCode).toBe(400);
    expect(queue.results).toHaveLength(0);
  });

  it('routes /api/groups/mine to my groups, not to the group lookup', async () => {
    queue.results = [[]];
    const response = await app.inject({ method: 'GET', url: '/api/groups/mine', headers: bearer({ role: 'user' }) });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ groups: [] });
  });

  it('routes /api/events/mine to my events, not to the event lookup', async () => {
    queue.results = [[], []];
    const response = await app.inject({ method: 'GET', url: '/api/events/mine', headers: bearer({ role: 'user' }) });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ events: [] });
  });

  it('applies the campus membership guard before a group is created', async () => {
    queue.results = [[{ id: CAMPUS_ID, isPublic: true }], []];
    const response = await app.inject({
      method: 'POST',
      url: `/api/campuses/${CAMPUS_ID}/groups`,
      headers: bearer({ role: 'user' }),
      payload: { name: 'Revision Algo' },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().message).toContain("'member' role");
    expect(queue.results).toHaveLength(0);
  });
});
