export const BOARD_SIZE = 50; // 10 x 5 layout

export function totalQty(prizeTypes) {
  return prizeTypes.reduce((sum, p) => sum + Number(p.qty || 0), 0);
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Builds a fresh, shuffled 50-cell board from the admin's prize distribution.
// Throws if the quantities don't add up to exactly BOARD_SIZE — callers
// should validate before invoking this, but it's a hard guarantee here too.
export function generateBoard(prizeTypes) {
  const total = totalQty(prizeTypes);
  if (total !== BOARD_SIZE) {
    throw new Error(`Prize quantities must total ${BOARD_SIZE}, got ${total}`);
  }
  let ids = [];
  for (const pt of prizeTypes) {
    for (let i = 0; i < pt.qty; i++) ids.push(pt.id);
  }
  ids = shuffle(ids);
  return ids.map((prizeTypeId, cellIndex) => ({
    cellIndex,
    prizeTypeId,
    status: 'available', // 'available' | 'taken'
  }));
}
