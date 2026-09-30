import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL ||= 'postgres://test:test@localhost:5432/test';
  process.env.JWT_SECRET ||= 'unit-test-secret';
});

const queue = vi.hoisted(() => ({
  results: [] as unknown[],
  values: [] as unknown[],
  sets: [] as unknown[],
}));

// Every awaited drizzle call takes the next queued result, so a test states the
// exact read order of the handler. An Error entry rejects instead.
vi.mock('../db/db.js', () => {
  const chain: any = new Proxy(function () {}, {
    get(_target, prop) {
      if (prop === 'then') {
        return (resolve: (value: unknown) => void, reject: (error: unknown) => void) => {
          const next = queue.results.shift() ?? [];
          return next instanceof Error ? reject(next) : resolve(next);
        };
      }
      if (prop === 'values') {
        return (value: unknown) => {
          queue.values.push(value);
          return chain;
        };
      }
      if (prop === 'set') {
        return (value: unknown) => {
          queue.sets.push(value);
          return chain;
        };
      }
      return () => chain;
    },
    apply: () => chain,
  });
  return { db: chain };
});

import {
  handleCreateGroup,
  handleJoinGroup,
  handleLeaveGroup,
  handleUpdateGroup,
} from './group.controller.js';

const CAMPUS_ID = '1a1b3a4c-5d6e-4a7b-8c9d-0e1f2a3b4c5d';
const GROUP_ID = '2b2b3a4c-5d6e-4a7b-8c9d-0e1f2a3b4c5d';
const USER_ID = '3c3c3a4c-5d6e-4a7b-8c9d-0e1f2a3b4c5d';

const campusRow = { id: CAMPUS_ID, isPublic: true, organizationId: '4d4d3a4c-5d6e-4a7b-8c9d-0e1f2a3b4c5d' };

function groupRow(overrides: Record<string, unknown> = {}) {
  return {
    id: GROUP_ID,
    campusId: CAMPUS_ID,
    name: 'Revision Sysadmin',
    slug: 'revision-sysadmin',
    description: null,
    topic: 'revision',
    capacity: null,
    createdBy: 'someone-else',
    createdAt: new Date(),
    ...overrides,
  };
}

function access(rank: number) {
  return {
    campus: campusRow,
    membership: rank > 0 ? { role: 'member' } : null,
    rank,
    isPlatformAdmin: false,
  } as any;
}

function makeRequest(options: { params?: Record<string, string>; body?: unknown; campusAccess?: any } = {}) {
  return {
    params: options.params ?? {},
    query: {},
    body: options.body,
    user: { id: USER_ID, role: 'user' },
    campusAccess: options.campusAccess,
    log: { error: vi.fn() },
  } as any;
}

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

beforeEach(() => {
  queue.results = [];
  queue.values = [];
  queue.sets = [];
});

describe('handleCreateGroup', () => {
  it('makes its creator a host of the new group', async () => {
    queue.results = [[groupRow()]];
    const reply = makeReply();

    await handleCreateGroup(
      makeRequest({ params: { campusId: CAMPUS_ID }, body: { name: 'Revision Sysadmin' }, campusAccess: access(1) }),
      reply
    );

    expect(reply.statusCode).toBe(201);
    expect(queue.values[1]).toEqual({ groupId: GROUP_ID, userId: USER_ID, role: 'host' });
  });

  it('maps a duplicate slug to 409', async () => {
    queue.results = [Object.assign(new Error('duplicate key value'), { code: '23505' })];
    const reply = makeReply();

    await handleCreateGroup(
      makeRequest({ params: { campusId: CAMPUS_ID }, body: { name: 'Revision Sysadmin' }, campusAccess: access(1) }),
      reply
    );

    expect(reply.statusCode).toBe(409);
  });
});

describe('handleJoinGroup', () => {
  it('refuses a student who joined no campus', async () => {
    queue.results = [[groupRow()], [campusRow], []];
    const reply = makeReply();

    await handleJoinGroup(makeRequest({ params: { groupId: GROUP_ID } }), reply);

    expect(reply.statusCode).toBe(403);
  });

  it('refuses a seat when the group is already full', async () => {
    queue.results = [[groupRow({ capacity: 2 })], [campusRow], [{ role: 'member' }], [{ memberCount: 2 }]];
    const reply = makeReply();

    await handleJoinGroup(makeRequest({ params: { groupId: GROUP_ID } }), reply);

    expect(reply.statusCode).toBe(409);
  });

  it('does not insert when the group is full', async () => {
    queue.results = [[groupRow({ capacity: 1 })], [campusRow], [{ role: 'member' }], [{ memberCount: 1 }]];

    await handleJoinGroup(makeRequest({ params: { groupId: GROUP_ID } }), makeReply());

    expect(queue.values).toHaveLength(0);
  });

  it('reports 200 when the caller is already a member', async () => {
    queue.results = [[groupRow()], [campusRow], [{ role: 'member' }], []];
    const reply = makeReply();

    await handleJoinGroup(makeRequest({ params: { groupId: GROUP_ID } }), reply);

    expect(reply.statusCode).toBe(200);
    expect(reply.body.message).toBe('You are already in this group.');
  });

  it('creates the membership row on a real join', async () => {
    queue.results = [[groupRow()], [campusRow], [{ role: 'member' }], [{ groupId: GROUP_ID, userId: USER_ID, role: 'member' }]];
    const reply = makeReply();

    await handleJoinGroup(makeRequest({ params: { groupId: GROUP_ID } }), reply);

    expect(reply.statusCode).toBe(201);
  });
});

describe('handleLeaveGroup', () => {
  it('404s when the caller is not in the group', async () => {
    queue.results = [[groupRow()], [campusRow], []];
    const reply = makeReply();

    await handleLeaveGroup(makeRequest({ params: { groupId: GROUP_ID } }), reply);

    expect(reply.statusCode).toBe(404);
  });

  it('hands the group to the longest-standing member when the last host leaves', async () => {
    queue.results = [
      [groupRow()],
      [campusRow],
      [{ role: 'member' }],
      [{ role: 'host', userId: USER_ID }],
      [],
      [],
      [{ id: 'row-2', userId: 'someone-else', role: 'member' }],
    ];
    const reply = makeReply();

    await handleLeaveGroup(makeRequest({ params: { groupId: GROUP_ID } }), reply);

    expect(reply.statusCode).toBe(200);
    expect(queue.sets).toContainEqual({ role: 'host' });
  });

  it('leaves the other host alone', async () => {
    queue.results = [
      [groupRow()],
      [campusRow],
      [{ role: 'member' }],
      [{ role: 'host', userId: USER_ID }],
      [],
      [{ role: 'host', userId: 'someone-else' }],
    ];
    const reply = makeReply();

    await handleLeaveGroup(makeRequest({ params: { groupId: GROUP_ID } }), reply);

    expect(reply.statusCode).toBe(200);
    expect(queue.sets).toHaveLength(0);
  });
});

describe('handleUpdateGroup', () => {
  it('refuses a plain member who does not host the group', async () => {
    queue.results = [[groupRow()], [campusRow], [{ role: 'member' }], []];
    const reply = makeReply();

    await handleUpdateGroup(
      makeRequest({ params: { groupId: GROUP_ID }, body: { name: 'Renamed by nobody' } }),
      reply
    );

    expect(reply.statusCode).toBe(403);
  });

  it('rewrites the slug when only the name changes', async () => {
    queue.results = [[groupRow()], [], []];
    const reply = makeReply();

    await handleUpdateGroup(
      makeRequest({
        params: { groupId: GROUP_ID },
        body: { name: 'Soirée Projets' },
        campusAccess: access(2),
      }),
      reply
    );

    expect(reply.statusCode).toBe(200);
    expect(queue.sets[0]).toMatchObject({ name: 'Soirée Projets', slug: 'soiree-projets' });
  });
});
