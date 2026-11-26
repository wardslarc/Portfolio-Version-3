export const SLUG_MAX_LENGTH = 80;
export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Convert a title or arbitrary string into a URL-safe lowercase slug. */
export function slugify(input: string, maxLength = SLUG_MAX_LENGTH): string {
  const normalized = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (normalized.length <= maxLength) return normalized;
  return normalized.slice(0, maxLength).replace(/-+$/g, "");
}

export function isValidSlug(slug: string): boolean {
  return slug.length >= 1 && slug.length <= SLUG_MAX_LENGTH && SLUG_REGEX.test(slug);
}

/**
 * Given a desired string and an async collision check, returns a valid unique slug
 * by appending -2, -3, ... when needed while keeping length <= SLUG_MAX_LENGTH.
 */
export async function makeUniqueSlug(
  desired: string,
  isTaken: (candidate: string) => Promise<boolean>,
): Promise<string> {
  const base = slugify(desired) || "untitled";
  if (!(await isTaken(base))) return base;

  for (let n = 2; n < 10_000; n++) {
    const suffix = `-${n}`;
    const maxBaseLen = SLUG_MAX_LENGTH - suffix.length;
    const truncatedBase = base.slice(0, maxBaseLen).replace(/-+$/g, "") || "post";
    const candidate = `${truncatedBase}${suffix}`;
    if (!(await isTaken(candidate))) return candidate;
  }

  return `${base.slice(0, SLUG_MAX_LENGTH - 9)}-${Date.now().toString(36).slice(-8)}`;
}
