import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { generateBoard } from '../lib/board.js';
import { publicUrlFor } from '../lib/uploadStorage.js';

export const gameRouter = Router();

// What a player sees when they pick an empty bowl (no prize behind it) —
// shaped exactly like a real serialized prize so the client doesn't need
// any special-casing.
const NO_PRIZE = { id: null, name: 'Better luck next time!', emoji: '🙈', imageUrl: null, isFreeRetry: false };

async function getConfigAndPrizeTypes() {
  let config = await prisma.drawConfig.findUnique({ where: { id: 1 } });
  if (!config) {
    config = await prisma.drawConfig.create({ data: { id: 1 } });
  }
  const prizeTypes = await prisma.prizeType.findMany({ orderBy: { sortOrder: 'asc' } });
  return { config, prizeTypes };
}

function serializePrize(pt) {
  if (!pt) return null;
  return {
    id: pt.id,
    name: pt.name,
    emoji: pt.emoji,
    imageUrl: pt.imagePath ? publicUrlFor(pt.imagePath) : null,
    isFreeRetry: pt.isFreeRetry,
  };
}

// Loads (or transparently regenerates) the board for a session. A board is
// regenerated when: it doesn't exist yet, or the admin has published a new
// configuration since it was made. Running out of turns does NOT auto-
// regenerate anymore — the player must explicitly hit the refresh endpoint
// (POST /api/game/refresh) once all turns are spent.
async function getFreshBoard(sessionId) {
  const { config, prizeTypes } = await getConfigAndPrizeTypes();
  let board = await prisma.playerBoard.findUnique({ where: { sessionId } });

  const needsNewBoard = !board || board.configVersion !== config.configVersion;

  if (needsNewBoard) {
    const cells = generateBoard(prizeTypes);
    if (board) {
      await prisma.prizeWin.deleteMany({ where: { sessionId } });
      board = await prisma.playerBoard.update({
        where: { sessionId },
        data: { configVersion: config.configVersion, cells: JSON.stringify(cells), used: 0 },
      });
    } else {
      board = await prisma.playerBoard.create({
        data: { sessionId, configVersion: config.configVersion, cells: JSON.stringify(cells), used: 0 },
      });
    }
  }
  return { config, prizeTypes, board };
}

gameRouter.get('/state', async (req, res) => {
  const { config, board } = await getFreshBoard(req.sessionId);
  const cells = JSON.parse(board.cells);
  const myPrizes = await prisma.prizeWin.findMany({
    where: { sessionId: req.sessionId },
    orderBy: { wonAt: 'desc' },
  });

  res.json({
    attemptsPerUser: config.attemptsPerUser,
    used: board.used,
    remaining: Math.max(0, config.attemptsPerUser - board.used),
    cells: cells.map((c) => ({ cellIndex: c.cellIndex, status: c.status })),
    myPrizes: myPrizes.map((w) => ({
      cellIndex: w.cellIndex,
      name: w.prizeName,
      emoji: w.prizeEmoji,
      imageUrl: w.prizeImagePath ? publicUrlFor(w.prizeImagePath) : null,
      wonAt: w.wonAt,
    })),
  });
});

gameRouter.post('/pick', async (req, res) => {
  const { cellIndex } = req.body || {};
  if (typeof cellIndex !== 'number') {
    return res.status(400).json({ error: 'cellIndex is required' });
  }

  const { config, prizeTypes, board } = await getFreshBoard(req.sessionId);
  const remaining = config.attemptsPerUser - board.used;
  if (remaining <= 0) {
    return res.status(400).json({ error: 'No turns left — the board will refresh next visit' });
  }

  const cells = JSON.parse(board.cells);
  const cell = cells.find((c) => c.cellIndex === cellIndex);
  if (!cell) return res.status(404).json({ error: 'No such bowl' });
  if (cell.status !== 'available') {
    return res.status(409).json({ error: 'That bowl is already taken — pick another one' });
  }

  cell.status = 'taken';
  const updated = await prisma.playerBoard.update({
    where: { sessionId: req.sessionId },
    data: { cells: JSON.stringify(cells), used: board.used + 1 },
  });

  const prizeType = prizeTypes.find((p) => p.id === cell.prizeTypeId);
  res.json({
    cellIndex,
    prize: cell.prizeTypeId === null ? NO_PRIZE : serializePrize(prizeType),
    used: updated.used,
    remaining: Math.max(0, config.attemptsPerUser - updated.used),
  });
});

gameRouter.post('/refresh', async (req, res) => {
  const { config, prizeTypes } = await getConfigAndPrizeTypes();
  const board = await prisma.playerBoard.findUnique({ where: { sessionId: req.sessionId } });

  if (!board || board.used < config.attemptsPerUser) {
    return res.status(400).json({ error: 'You still have turns left on this board' });
  }

  const cells = generateBoard(prizeTypes);
  await prisma.prizeWin.deleteMany({ where: { sessionId: req.sessionId } });
  const updated = await prisma.playerBoard.update({
    where: { sessionId: req.sessionId },
    data: { configVersion: config.configVersion, cells: JSON.stringify(cells), used: 0 },
  });

  res.json({
    attemptsPerUser: config.attemptsPerUser,
    used: updated.used,
    remaining: config.attemptsPerUser,
    cells: cells.map((c) => ({ cellIndex: c.cellIndex, status: c.status })),
    myPrizes: [],
  });
});

gameRouter.post('/reveal', async (req, res) => {
  const { cellIndex } = req.body || {};
  if (typeof cellIndex !== 'number') {
    return res.status(400).json({ error: 'cellIndex is required' });
  }

  const board = await prisma.playerBoard.findUnique({ where: { sessionId: req.sessionId } });
  if (!board) return res.status(404).json({ error: 'No active board' });

  const cells = JSON.parse(board.cells);
  const cell = cells.find((c) => c.cellIndex === cellIndex);
  if (!cell || cell.status !== 'taken') {
    return res.status(409).json({ error: 'This bowl was not picked yet' });
  }

  if (cell.prizeTypeId === null) {
    const config = await prisma.drawConfig.findUnique({ where: { id: 1 } });
    return res.json({
      prize: NO_PRIZE,
      creditedBack: false,
      used: board.used,
      remaining: Math.max(0, config.attemptsPerUser - board.used),
    });
  }

  const prizeType = await prisma.prizeType.findUnique({ where: { id: cell.prizeTypeId } });
  if (!prizeType) return res.status(500).json({ error: 'Prize type no longer exists' });

  // Avoid double-crediting if the client somehow calls this twice for the
  // same cell (e.g. a flaky connection retried the request).
  const already = await prisma.prizeWin.findFirst({
    where: { sessionId: req.sessionId, boardId: board.id, cellIndex },
  });

  let usedAfter = board.used;
  if (!already) {
    await prisma.prizeWin.create({
      data: {
        sessionId: req.sessionId,
        boardId: board.id,
        cellIndex,
        prizeTypeId: prizeType.id,
        prizeName: prizeType.name,
        prizeEmoji: prizeType.emoji,
        prizeImagePath: prizeType.imagePath,
        isFreeRetry: prizeType.isFreeRetry,
      },
    });

    if (prizeType.isFreeRetry) {
      usedAfter = Math.max(0, board.used - 1);
      await prisma.playerBoard.update({ where: { id: board.id }, data: { used: usedAfter } });
    } else {
      // Permanent record for the admin's Claims list / Excel export, plus a
      // running "collected" counter per prize. Free retries are skipped —
      // they're not a physical prize being handed out.
      const profile = await prisma.playerProfile.findUnique({ where: { sessionId: req.sessionId } });
      await prisma.claim.create({
        data: {
          sessionId: req.sessionId,
          phone: profile?.phone || 'Unknown',
          cellIndex,
          prizeTypeId: prizeType.id,
          prizeName: prizeType.name,
          prizeEmoji: prizeType.emoji,
          prizeImagePath: prizeType.imagePath,
        },
      });
      // Pool inventory shrinks as prizes get claimed (floored at 0), and the
      // collected counter ticks up — both in one update.
      const current = await prisma.prizeType.findUnique({ where: { id: prizeType.id } });
      await prisma.prizeType.update({
        where: { id: prizeType.id },
        data: {
          qty: Math.max(0, current.qty - 1),
          claimedCount: { increment: 1 },
        },
      });
    }
  }

  const config = await prisma.drawConfig.findUnique({ where: { id: 1 } });
  res.json({
    prize: serializePrize(prizeType),
    creditedBack: prizeType.isFreeRetry,
    used: usedAfter,
    remaining: Math.max(0, config.attemptsPerUser - usedAfter),
  });
});
