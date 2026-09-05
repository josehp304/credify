/**
 * Internal-only gate. The Express API is no longer public: every route except
 * /health and the extension bridge is reachable only via the Next.js proxy,
 * which authenticates the browser session and attaches this shared secret.
 */
export const requireInternal = (req, res, next) => {
  const secret = process.env.INTERNAL_API_SECRET;
  // Startup validation in server.js guarantees `secret` is set; this guard is
  // defense-in-depth in case the middleware is reused elsewhere.
  if (!secret || req.headers['x-internal-secret'] !== secret) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  next();
};

/**
 * Minimal fixed-window IP rate limiter for the one deliberately public route
 * (the extension bridge). No external dependency; state is per-process.
 */
export const rateLimit = ({ windowMs = 60_000, max = 30 } = {}) => {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    // Drop expired windows so the map cannot grow unboundedly.
    if (hits.size > 5_000) {
      for (const [ip, entry] of hits) {
        if (now - entry.start > windowMs) hits.delete(ip);
      }
    }
    const key = req.ip || 'unknown';
    let entry = hits.get(key);
    if (!entry || now - entry.start > windowMs) {
      entry = { start: now, count: 0 };
      hits.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      return res.status(429).json({ success: false, error: 'Too many requests, slow down.' });
    }
    next();
  };
};
