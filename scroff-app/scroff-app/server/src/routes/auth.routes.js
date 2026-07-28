import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import {
  verifyPassword,
  signAdminToken,
  setAdminCookie,
  clearAdminCookie,
} from '../lib/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

export const authRouter = Router();

authRouter.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  const admin = await prisma.admin.findUnique({ where: { username } });
  if (!admin) {
    return res.status(401).json({ error: 'Incorrect username or password' });
  }
  const ok = await verifyPassword(password, admin.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: 'Incorrect username or password' });
  }
  const token = signAdminToken(admin);
  setAdminCookie(res, token);
  res.json({ username: admin.username });
});

authRouter.post('/logout', (req, res) => {
  clearAdminCookie(res);
  res.json({ ok: true });
});

authRouter.get('/me', requireAdmin, (req, res) => {
  res.json({ username: req.admin.username });
});
