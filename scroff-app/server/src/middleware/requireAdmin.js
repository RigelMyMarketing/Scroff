import { readAdminToken, verifyAdminToken } from '../lib/auth.js';

export function requireAdmin(req, res, next) {
  const token = readAdminToken(req);
  const payload = token && verifyAdminToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Admin login required' });
  }
  req.admin = payload;
  next();
}
