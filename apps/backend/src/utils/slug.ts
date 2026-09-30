const SLUG_PATTERN = /^[a-z0-9](?:-?[a-z0-9])*$/;

export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140);
}

export function isValidSlug(value: string): boolean {
  return value.length >= 2 && value.length <= 140 && SLUG_PATTERN.test(value);
}
