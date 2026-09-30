import { describe, it, expect, beforeEach, vi } from 'vitest';

// Any drizzle chain is awaited for its next queued result, so tests describe
// query order instead of re-implementing the query builder.
const queue = vi.hoisted(() => ({ results: [] as unknown[] }));

vi.mock('../db/db.js', () => {
  const chain: any = new Proxy(function () {}, {
    get(_target, prop) {
      if (prop === 'then') {
        return (resolve: (value: unknown) => void) => resolve(queue.results.shift() ?? []);
      }
      if (prop === 'returning' || prop === 'all' || prop === 'execute') {
        return () => chain;
      }
      return () => chain;
    },
    apply: () => chain,
  });
  return { db: chain };
});

import { requireCampusRole, requireCampusVisible } from './campus-access.js';

const CAMPUS_ID = '2f1b3a4c-5d6e-4a7b-8c9d-0e1f2a3b4c5d';
const USER_ID = '7a1b3a4c-5d6e-4a7b-8c9d-0e1f2a3b4c5d';

function makeReply() {
  const reply: any = {
    statusCode: 200,
    body: null,
    status(code: number) {
      reply.statusCode = code;
      return reply;
    },
    send(payload: unknown) {
      reply.body = payload;
      return reply;
    },
  };
  return reply;
}

function makeRequest(role: string | undefined, membership?: { role: string }) {
  const request: any = {
    params: { campusId: CAMPUS_ID },
    user: { id: USER_ID, email: 'marcellin@epitech.eu', role },
    log: { error: vi.fn() },
    campusAccess: undefined,
  };
  queue.results.push(
    [{ id: CAMPUS_ID, isPublic: true }],
    membership ? [{ campusId: CAMPUS_ID, userId: USER_ID, ...membership }] : [],
  );
  return request;
}

beforeEach(() => {
  queue.results = [];
});

describe('requireCampusRole', () => {
  it('returns 404 when the campus does not exist', async () => {
    queue.results = [[]];
    const reply = makeReply();
    const request: any = { params: { campusId: CAMPUS_ID }, user: { id: USER_ID }, log: { error: vi.fn() } };

    await requireCampusRole('member')(request, reply);

    expect(reply.statusCode).toBe(404);
  });

  it('returns 404 when campusId is not a uuid', async () => {
    const reply = makeReply();
    const request: any = { params: { campusId: 'not-a-uuid' }, user: { id: USER_ID }, log: { error: vi.fn() } };

    await requireCampusRole('member')(request, reply);

    // No query is issued, so the missing campus path is what answers.
    expect(reply.statusCode).toBe(404);
  });

  it('rejects a visitor without membership', async () => {
    const reply = makeReply();
    await requireCampusRole('member')(makeRequest('user'), reply);

    expect(reply.statusCode).toBe(403);
  });

  it('accepts a member when only member level is required', async () => {
    const reply = makeReply();
    await requireCampusRole('member')(makeRequest('user', { role: 'member' }), reply);

    expect(reply.statusCode).toBe(200);
    expect(reply.body).toBeNull();
  });

  it('rejects a member asking for moderator rights', async () => {
    const reply = makeReply();
    await requireCampusRole('moderator')(makeRequest('user', { role: 'member' }), reply);

    expect(reply.statusCode).toBe(403);
  });

  it('lets a platform admin through without a membership row', async () => {
    const reply = makeReply();
    await requireCampusRole('admin')(makeRequest('admin'), reply);

    expect(reply.statusCode).toBe(200);
    expect(reply.body).toBeNull();
  });

  it('answers 500 without leaking when the database fails', async () => {
    const reply = makeReply();
    const request = makeRequest('user');
    queue.results = [Promise.reject(new Error('connection lost'))];

    await requireCampusRole('member')(request, reply);

    expect(reply.statusCode).toBe(500);
    expect(JSON.stringify(reply.body)).not.toContain('connection lost');
  });
});

describe('requireCampusVisible', () => {
  it('allows anyone to read a public campus', async () => {
    const reply = makeReply();
    await requireCampusVisible(makeRequest('user'), reply);

    expect(reply.statusCode).toBe(200);
    expect(reply.body).toBeNull();
  });

  it('hides a private campus from a non-member', async () => {
    const request = makeRequest('user');
    queue.results = [[{ id: CAMPUS_ID, isPublic: false }], []];
    const reply = makeReply();

    await requireCampusVisible(request, reply);

    expect(reply.statusCode).toBe(403);
  });

  it('shows a private campus to its members', async () => {
    const reply = makeReply();
    const request: any = { params: { campusId: CAMPUS_ID }, user: { id: USER_ID }, log: { error: vi.fn() } };
    queue.results = [
      [{ id: CAMPUS_ID, isPublic: false }],
      [{ campusId: CAMPUS_ID, userId: USER_ID, role: 'member' }],
    ];

    await requireCampusVisible(request, reply);

    expect(reply.statusCode).toBe(200);
    expect(reply.body).toBeNull();
  });
});
