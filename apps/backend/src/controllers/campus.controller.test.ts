import { describe, it, expect, beforeEach, vi } from 'vitest';

const queue = vi.hoisted(() => ({ results: [] as unknown[] }));

vi.mock('../db/db.js', () => {
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

import { handleJoinCampus, handleLeaveCampus } from './campus.controller.js';

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

function makeRequest() {
  return { params: { campusId: CAMPUS_ID }, user: { id: USER_ID }, log: { error: vi.fn() } } as any;
}

function campusRow(isPublic: boolean, emailDomains: string[] = []) {
  return [{ campus: { id: CAMPUS_ID, isPublic }, organization: { id: 'o1', emailDomains } }];
}

beforeEach(() => {
  queue.results = [];
});

describe('handleJoinCampus', () => {
  it('lets anyone join a public campus', async () => {
    queue.results = [campusRow(true), [{ id: 'm1', campusId: CAMPUS_ID, userId: USER_ID, role: 'member' }]];
    const reply = makeReply();

    await handleJoinCampus(makeRequest(), reply);

    expect(reply.statusCode).toBe(201);
    expect(reply.body.membership.role).toBe('member');
  });

  it('refuses a private campus when the email domain does not match', async () => {
    queue.results = [
      campusRow(false, ['epitech.eu']),
      [{ email: 'someone@gmail.com' }],
      ['must-not-be-reached'],
    ];
    const reply = makeReply();

    await handleJoinCampus(makeRequest(), reply);

    expect(reply.statusCode).toBe(403);
    expect(queue.results).toEqual([['must-not-be-reached']]);
  });

  it('admits a private campus member whose verified domain matches', async () => {
    queue.results = [
      campusRow(false, ['epitech.eu']),
      [{ email: 'marcellin@Epitech.EU' }],
      [{ id: 'm1', campusId: CAMPUS_ID, userId: USER_ID, role: 'member' }],
    ];
    const reply = makeReply();

    await handleJoinCampus(makeRequest(), reply);

    expect(reply.statusCode).toBe(201);
  });

  it('is idempotent for an existing member', async () => {
    queue.results = [campusRow(true), []];
    const reply = makeReply();

    await handleJoinCampus(makeRequest(), reply);

    expect(reply.statusCode).toBe(200);
  });

  it('rejects a malformed campus id before touching the database', async () => {
    const reply = makeReply();
    const request = { params: { campusId: 'drop-tables' }, user: { id: USER_ID }, log: { error: vi.fn() } } as any;

    await handleJoinCampus(request, reply);

    expect(reply.statusCode).toBe(400);
    expect(queue.results).toEqual([]);
  });
});

describe('handleLeaveCampus', () => {
  it('blocks the last admin from leaving', async () => {
    queue.results = [
      [{ id: CAMPUS_ID, isPublic: true }],
      [{ campusId: CAMPUS_ID, userId: USER_ID, role: 'admin' }],
      [{ admins: 1 }],
      [{ role: 'admin' }],
    ];
    const reply = makeReply();

    await handleLeaveCampus(makeRequest(), reply);

    expect(reply.statusCode).toBe(409);
  });

  it('lets a regular member leave', async () => {
    queue.results = [
      [{ id: CAMPUS_ID, isPublic: true }],
      [{ campusId: CAMPUS_ID, userId: USER_ID, role: 'member' }],
      [{ admins: 1 }],
      [{ role: 'member' }],
      [],
    ];
    const reply = makeReply();

    await handleLeaveCampus(makeRequest(), reply);

    expect(reply.statusCode).toBe(200);
  });

  it('answers 404 for a non-member', async () => {
    queue.results = [[{ id: CAMPUS_ID, isPublic: true }], []];
    const reply = makeReply();

    await handleLeaveCampus(makeRequest(), reply);

    expect(reply.statusCode).toBe(404);
  });
});
