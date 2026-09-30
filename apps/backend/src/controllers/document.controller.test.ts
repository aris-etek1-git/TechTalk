import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL ||= 'postgres://test:test@localhost:5432/test';
  process.env.JWT_SECRET ||= 'unit-test-secret';
  process.env.MAX_UPLOAD_MB ||= '1';
});

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

// The bucket is never reached in these cases, but keep the boundary explicit.
vi.mock('../services/storage.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/storage.js')>();
  return { ...actual, putObject: vi.fn(async () => undefined), deleteObject: vi.fn(async () => undefined) };
});

import { handleDownloadDocument, handleListDocuments, handleUploadDocument } from './document.controller.js';

const COURSE_ID = '2f1b3a4c-5d6e-4a7b-8c9d-0e1f2a3b4c5d';
const DOC_ID = '5c1b3a4c-5d6e-4a7b-8c9d-0e1f2a3b4c5d';
const ORG_ID = '8b1b3a4c-5d6e-4a7b-8c9d-0e1f2a3b4c5d';
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

function makeRequest(params: Record<string, string>) {
  return {
    params,
    query: {},
    user: { id: USER_ID, role: 'user' },
    log: { error: vi.fn() },
    isMultipart: () => true,
  } as any;
}

function fakeFile(contentType: string, bytes: Buffer, fields: Record<string, { value: string }> = {}) {
  return {
    filename: `scan.${contentType === 'pdf' ? 'pdf' : 'txt'}`,
    fields,
    file: { truncated: false },
    toBuffer: async () => bytes,
  };
}

const courseRow = [{ course: { id: COURSE_ID, organizationId: ORG_ID }, organizationName: 'Epitech' }];

beforeEach(() => {
  queue.results = [];
});

describe('handleListDocuments', () => {
  it('refuses a student who joined no campus of the school', async () => {
    queue.results = [courseRow, []];
    const reply = makeReply();

    await handleListDocuments(makeRequest({ courseId: COURSE_ID }), reply);

    expect(reply.statusCode).toBe(403);
  });

  it('lists approved documents to a campus member', async () => {
    queue.results = [
      courseRow,
      [{ role: 'member' }],
      [
        {
          id: DOC_ID,
          courseId: COURSE_ID,
          title: 'Sysadmin S4',
          fileName: 'a.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 10,
          period: 'S4',
          academicYear: '2025-2026',
          status: 'approved',
          downloads: 0,
          uploaderId: 'other',
          createdAt: new Date(),
          storageKey: 'documents/private/a.pdf',
          checksum: 'abc',
        },
      ],
    ];
    const reply = makeReply();

    await handleListDocuments(makeRequest({ courseId: COURSE_ID }), reply);

    expect(reply.statusCode).toBe(200);
    // The bucket key must never reach the client.
    expect(JSON.stringify(reply.body)).not.toContain('documents/private');
    expect(reply.body.documents[0].status).toBe('approved');
    expect(reply.body.documents[0].canModerate).toBe(false);
  });
});

describe('handleUploadDocument', () => {
  it('answers 400 when the request is not multipart', async () => {
    const reply = makeReply();
    const request = makeRequest({ courseId: COURSE_ID });
    request.isMultipart = () => false;
    request.file = async () => {
      throw new Error('Request is not a multipart request');
    };

    await handleUploadDocument(request, reply);

    expect(reply.statusCode).toBe(400);
    expect(queue.results).toHaveLength(0);
  });

  it('rejects a file whose bytes are not a PDF or an image', async () => {
    queue.results = [courseRow, [{ role: 'member' }]];
    const reply = makeReply();
    const request = makeRequest({ courseId: COURSE_ID });
    request.file = async () => fakeFile('pdf', Buffer.from('#!/bin/sh\necho pwned\n'));

    await handleUploadDocument(request, reply);

    expect(reply.statusCode).toBe(415);
  });

  it('rejects an upload above the configured size cap', async () => {
    queue.results = [courseRow, [{ role: 'member' }]];
    const reply = makeReply();
    const request = makeRequest({ courseId: COURSE_ID });
    request.file = async () => fakeFile('pdf', Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(1024 * 1024)]));

    await handleUploadDocument(request, reply);

    expect(reply.statusCode).toBe(413);
  });

  it('refuses to store a second copy of the same bytes', async () => {
    queue.results = [courseRow, [{ role: 'member' }], [{ id: DOC_ID }]];
    const reply = makeReply();
    const request = makeRequest({ courseId: COURSE_ID });
    request.file = async () => fakeFile('pdf', Buffer.from('%PDF-1.4\nsame scan\n'));

    await handleUploadDocument(request, reply);

    expect(reply.statusCode).toBe(409);
  });

  it('rejects a semester label that would not match the list filters', async () => {
    queue.results = [courseRow, [{ role: 'member' }]];
    const reply = makeReply();
    const request = makeRequest({ courseId: COURSE_ID });
    request.file = async () =>
      fakeFile('pdf', Buffer.from('%PDF-1.4\nscan\n'), { period: { value: 'semestre 4' } });

    await handleUploadDocument(request, reply);

    expect(reply.statusCode).toBe(400);
  });

  it('keeps the semester and the academic year of an accepted upload', async () => {
    queue.results = [
      courseRow,
      [{ role: 'member' }],
      [],
      [
        {
          id: DOC_ID,
          courseId: COURSE_ID,
          title: 'Sysadmin',
          storageKey: 'documents/private/a.pdf',
          checksum: 'abc',
          fileName: 'a.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 12,
          period: 'S4',
          academicYear: '2025-2026',
          status: 'pending',
          downloads: 0,
          uploaderId: USER_ID,
          createdAt: new Date(),
        },
      ],
    ];
    const reply = makeReply();
    const request = makeRequest({ courseId: COURSE_ID });
    request.file = async () =>
      fakeFile('pdf', Buffer.from('%PDF-1.4\nscan\n'), {
        period: { value: 'S4' },
        academicYear: { value: '2025-2026' },
      });

    await handleUploadDocument(request, reply);

    expect(reply.statusCode).toBe(201);
    expect(reply.body.document.period).toBe('S4');
    expect(reply.body.document.academicYear).toBe('2025-2026');
  });
});

describe('handleDownloadDocument', () => {
  it('will not hand out a URL for someone else\u2019s unapproved upload', async () => {
    queue.results = [
      [{ document: { id: DOC_ID, status: 'pending', uploaderId: 'someone-else', storageKey: 'k', fileName: 'x.pdf' }, course: { organizationId: ORG_ID } }],
      [{ role: 'member' }],
    ];
    const reply = makeReply();

    await handleDownloadDocument(makeRequest({ documentId: DOC_ID }), reply);

    expect(reply.statusCode).toBe(403);
  });
});
