import { Router } from 'express';
import { nanoid } from 'nanoid';
import ExcelJS from 'exceljs';
import { prisma } from '../lib/prisma.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { uploadPrizeImage, publicUrlFor } from '../lib/uploadStorage.js';
import { totalQty, totalWeight, BOARD_SIZE } from '../lib/board.js';

export const adminRouter = Router();
adminRouter.use(requireAdmin);

function serializePrize(pt) {
  return {
    id: pt.id,
    name: pt.name,
    emoji: pt.emoji,
    imageUrl: pt.imagePath ? publicUrlFor(pt.imagePath) : null,
    weight: pt.weight,
    qty: pt.qty,
    isFreeRetry: pt.isFreeRetry,
    sortOrder: pt.sortOrder,
  };
}

// "Collected" is always a live count of Claims rows for this prize, never a
// stored field — so deleting/clearing claims is reflected immediately,
// wherever a single prize gets serialized back to the admin.
async function serializePrizeWithClaims(pt) {
  const claimedCount = await prisma.claim.count({ where: { prizeTypeId: pt.id } });
  return { ...serializePrize(pt), claimedCount };
}

adminRouter.get('/overview', async (req, res) => {
  let config = await prisma.drawConfig.findUnique({ where: { id: 1 } });
  if (!config) config = await prisma.drawConfig.create({ data: { id: 1 } });
  const prizeTypes = await prisma.prizeType.findMany({ orderBy: { sortOrder: 'asc' } });

  // "Collected" isn't a separately-maintained counter — it's a live count of
  // rows in the Claims table per prize. That way, clearing or deleting
  // claims automatically brings this number back down to match, with
  // nothing extra to keep in sync.
  const claimCounts = await prisma.claim.groupBy({ by: ['prizeTypeId'], _count: { _all: true } });
  const claimedCountByPrize = {};
  claimCounts.forEach((c) => {
    claimedCountByPrize[c.prizeTypeId] = c._count._all;
  });

  // Live "how many are left" stats, aggregated across every currently-active
  // player board — useful context for the admin even though players
  // themselves never see a remaining count (per spec).
  const boards = await prisma.playerBoard.findMany({ where: { configVersion: config.configVersion } });
  const remainingByPrize = {};
  prizeTypes.forEach((p) => (remainingByPrize[p.id] = 0));
  boards.forEach((b) => {
    JSON.parse(b.cells).forEach((c) => {
      if (c.status === 'available' && remainingByPrize[c.prizeTypeId] !== undefined) {
        remainingByPrize[c.prizeTypeId] += 1;
      }
    });
  });

  res.json({
    attemptsPerUser: config.attemptsPerUser,
    configVersion: config.configVersion,
    totalQty: totalQty(prizeTypes),
    totalWeight: totalWeight(prizeTypes),
    boardSize: BOARD_SIZE,
    activeBoards: boards.length,
    prizeTypes: prizeTypes.map((p) => ({
      ...serializePrize(p),
      claimedCount: claimedCountByPrize[p.id] || 0,
      remainingOnActiveBoards: remainingByPrize[p.id] ?? 0,
    })),
  });
});

adminRouter.post('/prize-types', async (req, res) => {
  const { name, emoji, weight, qty, isFreeRetry } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Prize name is required' });
  const count = await prisma.prizeType.count();
  const pt = await prisma.prizeType.create({
    data: {
      name,
      emoji: emoji || '🎁',
      weight: Math.max(0, Number(weight) || 0),
      qty: Number(qty) || 0,
      isFreeRetry: Boolean(isFreeRetry),
      sortOrder: count,
    },
  });
  res.status(201).json(await serializePrizeWithClaims(pt));
});

adminRouter.patch('/prize-types/:id', async (req, res) => {
  const { name, emoji, weight, qty, isFreeRetry } = req.body || {};
  const data = {};
  if (name !== undefined) data.name = name;
  if (emoji !== undefined) data.emoji = emoji;
  if (weight !== undefined) data.weight = Math.max(0, Number(weight) || 0);
  if (qty !== undefined) data.qty = Math.max(0, Number(qty) || 0);
  if (isFreeRetry !== undefined) data.isFreeRetry = Boolean(isFreeRetry);
  try {
    const pt = await prisma.prizeType.update({ where: { id: req.params.id }, data });
    res.json(await serializePrizeWithClaims(pt));
  } catch {
    res.status(404).json({ error: 'Prize type not found' });
  }
});

adminRouter.delete('/prize-types/:id', async (req, res) => {
  try {
    await prisma.prizeType.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: 'Prize type not found' });
  }
});

adminRouter.post('/prize-types/:id/image', uploadPrizeImage.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image file received' });
  try {
    const pt = await prisma.prizeType.update({
      where: { id: req.params.id },
      data: { imagePath: req.file.filename },
    });
    res.json(await serializePrizeWithClaims(pt));
  } catch {
    res.status(404).json({ error: 'Prize type not found' });
  }
});

// Permanent list of every real prize claimed — the phone number is what
// lets the admin match a claim back to a person.
adminRouter.get('/claims', async (req, res) => {
  const claims = await prisma.claim.findMany({ orderBy: { claimedAt: 'desc' }, take: 2000 });
  res.json({
    claims: claims.map((c) => ({
      id: c.id,
      phone: c.phone,
      prizeName: c.prizeName,
      prizeEmoji: c.prizeEmoji,
      imageUrl: c.prizeImagePath ? publicUrlFor(c.prizeImagePath) : null,
      cellIndex: c.cellIndex,
      claimedAt: c.claimedAt,
    })),
  });
});

// Deletes every claim record — used by the admin's "Clear all" button.
// Restores stock: each prize's qty gets back exactly as many units as the
// claims being removed for it, since those units are no longer considered
// "given out". Doesn't touch weight (board odds) at all.
adminRouter.delete('/claims', async (req, res) => {
  const counts = await prisma.claim.groupBy({ by: ['prizeTypeId'], _count: { _all: true } });
  const restoreOps = counts.map((c) =>
    prisma.prizeType.updateMany({
      where: { id: c.prizeTypeId },
      data: { qty: { increment: c._count._all } },
    }),
  );
  const results = await prisma.$transaction([...restoreOps, prisma.claim.deleteMany()]);
  const deleteResult = results[results.length - 1];
  res.json({ deleted: deleteResult.count });
});

// Deletes one claim record by id, restoring 1 unit of stock for its prize.
adminRouter.delete('/claims/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid claim id' });
  }
  try {
    const claim = await prisma.claim.findUnique({ where: { id } });
    if (!claim) return res.status(404).json({ error: 'Claim not found' });
    await prisma.$transaction([
      prisma.prizeType.updateMany({
        where: { id: claim.prizeTypeId },
        data: { qty: { increment: 1 } },
      }),
      prisma.claim.delete({ where: { id } }),
    ]);
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: 'Claim not found' });
  }
});

// Downloads the full claims list as an .xlsx file.
adminRouter.get('/claims/export', async (req, res) => {
  const claims = await prisma.claim.findMany({ orderBy: { claimedAt: 'desc' } });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Claims');
  sheet.columns = [
    { header: 'Phone Number', key: 'phone', width: 20 },
    { header: 'Prize', key: 'prizeName', width: 28 },
    { header: 'Bowl #', key: 'bowl', width: 10 },
    { header: 'Claimed At', key: 'claimedAt', width: 22 },
  ];
  sheet.getRow(1).font = { bold: true };

  claims.forEach((c) => {
    sheet.addRow({
      phone: c.phone,
      prizeName: c.prizeName,
      bowl: c.cellIndex + 1,
      claimedAt: new Date(c.claimedAt).toLocaleString(),
    });
  });

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader('Content-Disposition', `attachment; filename="scroff-claims-${Date.now()}.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
});

adminRouter.put('/settings', async (req, res) => {
  const { attemptsPerUser } = req.body || {};
  const value = Math.max(1, Number(attemptsPerUser) || 1);
  const config = await prisma.drawConfig.upsert({
    where: { id: 1 },
    update: { attemptsPerUser: value },
    create: { id: 1, attemptsPerUser: value },
  });
  res.json({ attemptsPerUser: config.attemptsPerUser });
});

// Publishing bumps configVersion. Every player's board is lazily
// regenerated (and their prize history cleared) the next time they touch
// the game API — see getFreshBoard() in game.routes.js.
adminRouter.post('/publish', async (req, res) => {
  const prizeTypes = await prisma.prizeType.findMany();
  const total = totalWeight(prizeTypes);
  if (total > 100) {
    return res.status(400).json({ error: `Prize weights can't exceed 100%, currently ${total}%` });
  }
  const config = await prisma.drawConfig.upsert({
    where: { id: 1 },
    update: { configVersion: `v-${Date.now()}-${nanoid(6)}` },
    create: { id: 1, configVersion: `v-${Date.now()}-${nanoid(6)}` },
  });
  res.json({ ok: true, configVersion: config.configVersion });
});
