import { describe, it, expect } from 'vitest';
import { isValidSlug, slugify } from './slug.js';

describe('slugify', () => {
  it('normalizes accents, case and separators', () => {
    expect(slugify('  École Polytechnique "Fédérale" ')).toBe('ecole-polytechnique-federale');
  });

  it('collapses repeated separators and trims them', () => {
    expect(slugify('Paris -- Sud--Ouest')).toBe('paris-sud-ouest');
  });

  it('keeps digits and rejects emoji-only input', () => {
    expect(slugify('Campus 2B')).toBe('campus-2b');
    expect(slugify('🎓')).toBe('');
  });

  it('caps the result at the column width', () => {
    expect(slugify('a'.repeat(200)).length).toBeLessThanOrEqual(140);
  });
});

describe('isValidSlug', () => {
  it('accepts lowercase slugs with single hyphens', () => {
    expect(isValidSlug('epitech-lyon')).toBe(true);
  });

  it('rejects shapes that would break URL routing', () => {
    expect(isValidSlug('')).toBe(false);
    expect(isValidSlug('a')).toBe(false);
    expect(isValidSlug('-lead')).toBe(false);
    expect(isValidSlug('trail-')).toBe(false);
    expect(isValidSlug('double--hyphen')).toBe(false);
    expect(isValidSlug('../etc/passwd')).toBe(false);
    expect(isValidSlug('UPPER')).toBe(false);
  });
});
