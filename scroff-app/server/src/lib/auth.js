import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret-change-me';
const ADMIN_COOKIE = 'scroff_admin';
const SESSION_TTL = '12h';

export async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

export function signAdminToken(admin) {
  return jwt.sign({ sub: admin.id, username: admin.username }, JWT_SECRET, {
    expiresIn: SESSION_TTL,
  });
}

export function setAdminCookie(res, token) {
  res.cookie(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 12,
  });
}

export function clearAdminCookie(res) {
  res.clearCookie(ADMIN_COOKIE);
}

export function readAdminToken(req) {
  return req.cookies?.[ADMIN_COOKIE] || null;
}

export function verifyAdminToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}
