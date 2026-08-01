export const BOARD_SIZE = 50; // 10 x 5 layout

// Sum of physical stock across all prizes — informational only now (no
// longer used to size the board; see generateBoard below).
export function totalQty(prizeTypes) {
  return prizeTypes.reduce((sum, p) => sum + Number(p.qty || 0), 0);
}

// Sum of board-odds weight (%) across all prizes — this is what generateBoard
// actually uses, and what publishing validates (must not exceed 100).
export function totalWeight(prizeTypes) {
  return prizeTypes.reduce((sum, p) => sum + Number(p.weight || 0), 0);
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Builds a fresh, shuffled 50-cell board. Each prize's `weight` (a % out of
// 100) decides how many of the 50 bowls it gets — this is completely
// independent of `qty` (physical stock), which only gates *whether* a prize
// is eligible to appear at all: a prize with weight > 0 but qty === 0 is
// out of stock and gets skipped (free-retry prizes have no physical stock,
// so they're always eligible regardless of qty). Any percentage not
// covered by an eligible prize's weight becomes an empty "no prize" bowl.
export function generateBoard(prizeTypes) {
  const total = totalWeight(prizeTypes);
  if (total > 100) {
    throw new Error(`Prize weights can't exceed 100%, got ${total}%`);
  }

  const eligible = prizeTypes.filter((p) => p.isFreeRetry || p.qty > 0);

  let ids = [];
  eligible.forEach((pt) => {
    const cellCount = Math.floor((Number(pt.weight || 0) / 100) * BOARD_SIZE);
    for (let i = 0; i < cellCount; i++) ids.push(pt.id);
  });
  while (ids.length < BOARD_SIZE) ids.push(null); // empty bowl, no prize behind it
  ids = ids.slice(0, BOARD_SIZE); // rounding safety net, should never actually trim anything
  ids = shuffle(ids);
  return ids.map((prizeTypeId, cellIndex) => ({
    cellIndex,
    prizeTypeId,
    status: 'available', // 'available' | 'taken'
  }));
}
