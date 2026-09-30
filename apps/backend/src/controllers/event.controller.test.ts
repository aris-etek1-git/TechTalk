import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL ||= 'postgres://test:test@localhost:5432/test';
  process.env.JWT_SECRET ||= 'unit-test-secret';
});

const queue = vi.hoisted(() => ({ results: [] as unknown[], sets: [] as unknown[] }));

vi.mock('../db/db.js', () => {
  const chain: any = new Proxy(function () {}, {
    get(_target, prop) {
      if (prop === 'then') {
        return (resolve: (value: unknown) => void) => resolve(queue.results.shift() ?? []);
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
  handleCreateEvent,
  handleGetEvent,
  handleRsvpEvent,
  handleUpdateEvent,
} from './event.controller.js';

const CAMPUS_ID = '1a1b3a4c-5d6e-4a7b-8c9d-0e1f2a3b4c5d';
const OTHER_CAMPUS_ID = '9e9e3a4c-5d6e-4a7b-8c9d-0e1f2a3b4c5d';
const EVENT_ID = '2b2b3a4c-5d6e-4a7b-8c9d-0e1f2a3b4c5d';
const GROUP_ID = '5f5f3a4c-5d6e-4a7b-8c9d-0e1f2a3b4c5d';
const USER_ID = '3c3c3a4c-5d6e-4a7b-8c9d-0e1f2a3b4c5d';

const inTwoDays = new Date(Date.now() + 172800000);

const campusRow = { id: CAMPUS_ID, isPublic: true, organizationId: '4d4d3a4c-5d6e-4a7b-8c9d-0e1f2a3b4c5d' };

function eventRow(overrides: Record<string, unknown> = {}) {
  return {
    id: EVENT_ID,
    campusId: CAMPUS_ID,
    groupId: null,
    title: 'Soirée révision',
    description: null,
    location: 'Bloc C',
    startsAt: inTwoDays,
    endsAt: null,
    capacity: null,
    status: 'scheduled',
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

const createBody = {
  title: 'Soirée révision',
  location: 'Bloc C',
  startsAt: inTwoDays.toISOString(),
};

beforeEach(() => {
  queue.results = [];
  queue.sets = [];
});

describe('handleCreateEvent', () => {
  it('refuses an event that starts in the past', async () => {
    const reply = makeReply();

    await handleCreateEvent(
      makeRequest({
        params: { campusId: CAMPUS_ID },
        body: { ...createBody, startsAt: new Date(Date.now() - 60000).toISOString() },
        campusAccess: access(1),
      }),
      reply
    );

    expect(reply.statusCode).toBe(400);
    expect(queue.results).toHaveLength(0);
  });

  it('refuses an ending time before the starting time', async () => {
    const reply = makeReply();

    await handleCreateEvent(
      makeRequest({
        params: { campusId: CAMPUS_ID },
        body: { ...createBody, endsAt: new Date(inTwoDays.getTime() - 3600000).toISOString() },
        campusAccess: access(1),
      }),
      reply
    );

    expect(reply.statusCode).toBe(400);
    expect(reply.body.fields.endsAt).toBeDefined();
  });

  it('will not attach a group from another campus', async () => {
    queue.results = [[{ id: GROUP_ID, campusId: OTHER_CAMPUS_ID }]];
    const reply = makeReply();

    await handleCreateEvent(
      makeRequest({
        params: { campusId: CAMPUS_ID },
        body: { ...createBody, groupId: GROUP_ID },
        campusAccess: access(1),
      }),
      reply
    );

    expect(reply.statusCode).toBe(403);
  });
});

describe('handleGetEvent', () => {
  it('refuses a student who joined no campus', async () => {
    queue.results = [[eventRow()], [campusRow], []];
    const reply = makeReply();

    await handleGetEvent(makeRequest({ params: { eventId: EVENT_ID } }), reply);

    expect(reply.statusCode).toBe(403);
  });
});

describe('handleRsvpEvent', () => {
  it('refuses a seat when every seat is taken', async () => {
    queue.results = [
      [eventRow({ capacity: 30 })],
      [campusRow],
      [{ role: 'member' }],
      [],
      [{ goingCount: 30 }],
    ];
    const reply = makeReply();

    await handleRsvpEvent(
      makeRequest({ params: { eventId: EVENT_ID }, body: { status: 'going' } }),
      reply
    );

    expect(reply.statusCode).toBe(409);
  });

  it('keeps an interested reply out of the seat count', async () => {
    queue.results = [
      [eventRow({ capacity: 1 })],
      [campusRow],
      [{ role: 'member' }],
      [{ eventId: EVENT_ID, userId: USER_ID, status: 'interested' }],
      [{ eventId: EVENT_ID, goingCount: 1 }],
      [],
    ];
    const reply = makeReply();

    await handleRsvpEvent(
      makeRequest({ params: { eventId: EVENT_ID }, body: { status: 'interested' } }),
      reply
    );

    expect(reply.statusCode).toBe(200);
    expect(reply.body.event.seatsLeft).toBe(0);
  });

  it('will not take a spot on a cancelled event', async () => {
    queue.results = [[eventRow({ status: 'cancelled' })], [campusRow], [{ role: 'member' }]];
    const reply = makeReply();

    await handleRsvpEvent(
      makeRequest({ params: { eventId: EVENT_ID }, body: { status: 'going' } }),
      reply
    );

    expect(reply.statusCode).toBe(409);
  });
});

describe('handleUpdateEvent', () => {
  it('lets the organizer cancel without deleting the event', async () => {
    queue.results = [
      [eventRow({ createdBy: USER_ID })],
      [campusRow],
      [{ role: 'member' }],
      [eventRow({ createdBy: USER_ID, status: 'cancelled' })],
    ];
    const reply = makeReply();

    await handleUpdateEvent(
      makeRequest({ params: { eventId: EVENT_ID }, body: { status: 'cancelled' } }),
      reply
    );

    expect(reply.statusCode).toBe(200);
    expect(queue.sets).toContainEqual({ status: 'cancelled' });
  });

  it('refuses a plain campus member who did not organize it', async () => {
    queue.results = [[eventRow()], [campusRow], [{ role: 'member' }]];
    const reply = makeReply();

    await handleUpdateEvent(
      makeRequest({ params: { eventId: EVENT_ID }, body: { location: 'Ailleurs' } }),
      reply
    );

    expect(reply.statusCode).toBe(403);
  });

  it('compares a lone endsAt against the stored starting time', async () => {
    queue.results = [[eventRow({ createdBy: USER_ID })], [campusRow], [{ role: 'member' }]];
    const reply = makeReply();

    await handleUpdateEvent(
      makeRequest({
        params: { eventId: EVENT_ID },
        body: { endsAt: new Date(inTwoDays.getTime() - 3600000).toISOString() },
      }),
      reply
    );

    expect(reply.statusCode).toBe(400);
  });
});
