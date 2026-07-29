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
// Quantities no longer have to add up to exactly BOARD_SIZE — any shortfall
// (whether the admin configured fewer prizes on purpose, or the pool simply
// ran low from claims depleting it) is filled with empty "no prize" cells
// instead. Only an *over*-assignment (more prizes than bowls) is still an
// error, since that genuinely can't fit on the board.
export function generateBoard(prizeTypes) {
  const total = totalQty(prizeTypes);
  if (total > BOARD_SIZE) {
    throw new Error(`Prize quantities can't exceed ${BOARD_SIZE}, got ${total}`);
  }
  let ids = [];
  for (const pt of prizeTypes) {
    for (let i = 0; i < pt.qty; i++) ids.push(pt.id);
  }
  while (ids.length < BOARD_SIZE) ids.push(null); // empty bowl, no prize behind it
  ids = shuffle(ids);
  return ids.map((prizeTypeId, cellIndex) => ({
    cellIndex,
    prizeTypeId,
    status: 'available', // 'available' | 'taken'
  }));
}
