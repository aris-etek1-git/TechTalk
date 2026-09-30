import { describe, it, expect, vi } from 'vitest';

// storage.ts pulls in config/env.ts, which refuses to load without these two.
vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL ||= 'postgres://test:test@localhost:5432/test';
  process.env.JWT_SECRET ||= 'test-secret';
});

import { ALLOWED_UPLOAD_TYPES, buildStorageKey, safeFileName, sniffMimeType } from './storage.js';

describe('sniffMimeType', () => {
  it('recognises a PDF by its header, not by its label', () => {
    expect(sniffMimeType(Buffer.from('%PDF-1.7\nrest of the file'))).toBe('application/pdf');
  });

  it('recognises the two scanned-image formats', () => {
    expect(sniffMimeType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]))).toBe('image/png');
    expect(sniffMimeType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
  });

  it('rejects anything else, however it was declared', () => {
    expect(sniffMimeType(Buffer.from('#!/bin/sh\nrm -rf /'))).toBeNull();
    expect(sniffMimeType(Buffer.from('%PD'))).toBeNull();
    expect(sniffMimeType(Buffer.alloc(0))).toBeNull();
  });
});

describe('safeFileName', () => {
  it('removes characters that could escape the Content-Disposition header', () => {
    expect(safeFileName('a"b\nc\\d.pdf')).toBe('abcd.pdf');
    expect(safeFileName('annale\x00.pdf')).toBe('annale.pdf');
  });

  it('caps the length and never returns an empty value', () => {
    expect(safeFileName('x'.repeat(400)).length).toBe(200);
    expect(safeFileName('   ')).toBe('document');
    expect(safeFileName('"\r\n')).toBe('document');
  });
});

describe('buildStorageKey', () => {
  it('derives the key from ids only, so a filename cannot address another object', () => {
    const key = buildStorageKey('course-1', 'ab12cd', 'application/pdf');
    expect(key).toBe('documents/course-1/ab12cd.pdf');
    expect(key).not.toMatch(/\.\./);
  });

  it('only emits extensions from the allowlist', () => {
    expect(buildStorageKey('c', 'h', 'image/png')).toBe('documents/c/h.png');
    expect(buildStorageKey('c', 'h', 'application/x-msdownload')).toBe('documents/c/h.bin');
    expect(Object.values(ALLOWED_UPLOAD_TYPES)).toEqual(['pdf', 'png', 'jpg']);
  });
});
