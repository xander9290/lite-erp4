/** Local-process protection for this initial application. Replace with a shared limiter when running multiple instances. */
export function createLoginLimiter(limit = 10, windowMs = 60_000, maxKeys = 1000) {
  const attempts = new Map<string, { count: number; expires: number }>();
  return {
    allow(key: string, now = Date.now()) {
      const entry = attempts.get(key);
      if (entry && entry.expires > now) { if (entry.count >= limit) return false; entry.count++; return true; }
      for (const [key, value] of attempts) if (value.expires <= now) attempts.delete(key);
      if (attempts.size >= maxKeys) attempts.delete(attempts.keys().next().value!);
      attempts.set(key, { count: 1, expires: now + windowMs });
      return true;
    },
    clear(key: string) { attempts.delete(key); },
  };
}
