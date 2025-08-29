import { config, renderConfig } from '@/config/config.js';
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';

// Constant-time equality (prevents trivial timing leaks)
function safeEqual(
  a: string | Buffer<ArrayBuffer>,
  b: string | Buffer<ArrayBuffer>,
) {
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  if (A.length !== B.length) return false;
  return crypto.timingSafeEqual(A, B);
}

function parseKeyEntry(s: string) {
  return /^[A-Za-z0-9+/=]+$/.test(s)
    ? Buffer.from(s, 'base64')
    : Buffer.from(s);
}

/** Extract API key from headers.
 * Prefer Authorization: Bearer <key> or X-API-Key.
 */
function extractApiKey(req: Request) {
  const auth = req.get('authorization');
  if (auth?.startsWith('Bearer ')) return auth.slice(7).trim();
  return req.get('x-api-key');
}

export const requireRenderApiKey: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const renderer = req.params.renderer;
  if (!renderer)
    return res.status(400).json({ error: 'Missing renderer parameter' });

  const cfg = renderConfig[renderer];
  if (!cfg)
    return res
      .status(500)
      .json({ error: `renderer ${renderer} not configured` });

  if (cfg.keys === null) {
    return next();
  }

  const presented = extractApiKey(req);
  if (!presented) {
    res.set('WWW-Authenticate', 'Bearer realm="render"');
    return res.status(401).json({ error: 'missing api key' });
  }

  const match = cfg.keys.find((sec) => safeEqual(presented, sec));

  if (!match) return res.status(403).json({ error: 'invalid api key' });

  req.auth = { apiKey: match ?? 'unknown' };
  return next();
};

// Rate limit hash
function hashedKeyOrIp(req: Request) {
  const k = extractApiKey(req) ?? req.ip;
  if (!k) {
    throw new Error('No API key or IP address found');
  }
  return crypto.createHash('sha256').update(k).digest('hex');
}

/*
export const renderLimiter = rateLimit({
  windowMs: 60_000, // 1 minute
  limit: 60, // adjust to your capacity
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: hashedKeyOrIp, // uses SHA-256 of API key (or IP if none)
  }); */
