import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  selectFn: vi.fn(),
  fromFn: vi.fn(),
  innerJoinFn: vi.fn(),
  whereFn: vi.fn(),
  orderByFn: vi.fn(),
  limitFn: vi.fn(),
}));

vi.mock('../db/db.js', () => ({
  db: { select: mocks.selectFn, innerJoin: mocks.innerJoinFn },
}));

import { handleGlobalSearch } from './search.controller.js';

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

// Every chain (content/tags: from→where→orderBy→limit; projects: from→innerJoin→where→orderBy→limit)
// ends at limitFn, which resolves to the same empty group for all three concurrent queries.
function buildChain() {
  mocks.limitFn.mockResolvedValue([]);
  mocks.orderByFn.mockReturnValue({ limit: mocks.limitFn });
  mocks.whereFn.mockReturnValue({ orderBy: mocks.orderByFn });
  mocks.innerJoinFn.mockReturnValue({ where: mocks.whereFn });
  mocks.fromFn.mockReturnValue({ where: mocks.whereFn, innerJoin: mocks.innerJoinFn });
  mocks.selectFn.mockReturnValue({ from: mocks.fromFn });
}

describe('handleGlobalSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildChain();
  });

  it('rejects an empty query before touching the database', async () => {
    const reply = makeReply();
    await handleGlobalSearch({ query: { q: '' }, log: { error: vi.fn() } } as any, reply);

    expect(reply.statusCode).toBe(400);
    expect(mocks.selectFn).not.toHaveBeenCalled();
  });

  it('rejects a missing query', async () => {
    const reply = makeReply();
    await handleGlobalSearch({ query: {}, log: { error: vi.fn() } } as any, reply);

    expect(reply.statusCode).toBe(400);
  });

  it('returns the three grouped result sets for a valid query', async () => {
    const reply = makeReply();
    await handleGlobalSearch({ query: { q: 'graph' }, log: { error: vi.fn() } } as any, reply);

    expect(reply.statusCode).toBe(200);
    expect(reply.body).toMatchObject({ query: 'graph', contents: [], tags: [], projects: [] });
    // three concurrent groups all issued their query
    expect(mocks.limitFn).toHaveBeenCalledTimes(3);
  });

  it('passes the requested per-group limit to every query', async () => {
    const reply = makeReply();
    await handleGlobalSearch({ query: { q: 'ai', limit: '30' }, log: { error: vi.fn() } } as any, reply);

    expect(reply.statusCode).toBe(200);
    expect(mocks.limitFn).toHaveBeenCalledWith(30);
  });

  it('rejects a limit above the allowed maximum', async () => {
    const reply = makeReply();
    await handleGlobalSearch({ query: { q: 'ai', limit: '999' }, log: { error: vi.fn() } } as any, reply);

    expect(reply.statusCode).toBe(400);
    expect(mocks.selectFn).not.toHaveBeenCalled();
  });
});
