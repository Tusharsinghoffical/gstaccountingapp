/**
 * In-memory sliding-window rate limiter for sensitive routes
 * (Auth, File streaming, OCR, AI calls).
 * Automatically evicts stale entries to prevent memory bloat.
 */

interface RateLimitRecord {
  timestamps: number[];
}

const store = new Map<string, RateLimitRecord>();

// Cleanup stale records every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    store.forEach((record, key) => {
      // Keep only timestamps from the last 15 minutes
      record.timestamps = record.timestamps.filter((t) => now - t < 15 * 60 * 1000);
      if (record.timestamps.length === 0) {
        store.delete(key);
      }
    });
  }, 5 * 60 * 1000).unref?.();
}

export interface RateLimitOptions {
  limit: number;       // Maximum allowed requests in window
  windowMs: number;    // Window length in milliseconds
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  retryAfterSeconds: number;
  totalHits: number;
}

export function checkRateLimit(
  identifier: string,
  options: RateLimitOptions = { limit: 10, windowMs: 60 * 1000 }
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - options.windowMs;

  let record = store.get(identifier);
  if (!record) {
    record = { timestamps: [] };
    store.set(identifier, record);
  }

  // Filter timestamps to only those within the current sliding window
  record.timestamps = record.timestamps.filter((t) => t > windowStart);

  if (record.timestamps.length >= options.limit) {
    // Exceeded limit: calculate seconds until the oldest request falls out of the window
    const oldest = record.timestamps[0];
    const retryAfterMs = oldest + options.windowMs - now;
    const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));

    return {
      success: false,
      remaining: 0,
      retryAfterSeconds,
      totalHits: record.timestamps.length,
    };
  }

  // Record this hit
  record.timestamps.push(now);

  return {
    success: true,
    remaining: options.limit - record.timestamps.length,
    retryAfterSeconds: 0,
    totalHits: record.timestamps.length,
  };
}

/**
 * Resets rate limit for a specific identifier (e.g. after successful auth/test)
 */
export function resetRateLimit(identifier: string) {
  store.delete(identifier);
}
