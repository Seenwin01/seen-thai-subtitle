// Pure TTL logic for clearing old jobs. The fs sweep lives in the route.

export function ttlMs(): number {
  const hours = Number(process.env.JOB_TTL_HOURS) || 24;
  return Math.max(0, hours) * 3600 * 1000;
}

/** Ids whose mtime is older than ttl relative to now. ttl<=0 disables expiry. */
export function expiredIds(
  items: Array<{ id: string; mtime: number }>,
  now: number,
  ttl: number
): string[] {
  if (ttl <= 0) return [];
  return items.filter((it) => now - it.mtime > ttl).map((it) => it.id);
}
