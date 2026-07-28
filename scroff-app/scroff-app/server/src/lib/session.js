import { nanoid } from 'nanoid';

const SESSION_COOKIE = 'scroff_session';
const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;

// Players never log in. Instead each browser gets a random, unguessable
// session id stored in an httpOnly cookie the first time it hits the API.
// That id is what "who am I" resolves to for turns / boards / prize history.
// Swapping this out for real player accounts later only touches this file
// and the two spots that read req.sessionId.
export function ensureSession(req, res, next) {
  let sessionId = req.cookies?.[SESSION_COOKIE];
  if (!sessionId) {
    sessionId = nanoid(24);
    res.cookie(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: ONE_YEAR_MS,
    });
  }
  req.sessionId = sessionId;
  next();
}
