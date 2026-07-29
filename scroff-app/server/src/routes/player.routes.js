import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

export const playerRouter = Router();

// Very loose validation — just enough to catch empty/garbage input. We're
// not sending SMS or verifying anything, just recording a contact number
// against this session so the admin can match claims to a person.
const PHONE_RE = /^[0-9+\s-]{7,20}$/;

playerRouter.get('/profile', async (req, res) => {
  const profile = await prisma.playerProfile.findUnique({ where: { sessionId: req.sessionId } });
  res.json({ phone: profile?.phone || null });
});

playerRouter.post('/profile', async (req, res) => {
  const { phone } = req.body || {};
  const trimmed = typeof phone === 'string' ? phone.trim() : '';
  if (!PHONE_RE.test(trimmed)) {
    return res.status(400).json({ error: 'Enter a valid phone number' });
  }
  const profile = await prisma.playerProfile.upsert({
    where: { sessionId: req.sessionId },
    update: { phone: trimmed },
    create: { sessionId: req.sessionId, phone: trimmed },
  });
  res.json({ phone: profile.phone });
});
