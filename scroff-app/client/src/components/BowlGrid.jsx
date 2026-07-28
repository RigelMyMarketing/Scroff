export default function BowlGrid({ cells, canPlay, onPick, flushingCell }) {
  return (
    <div className="grid-wrap">
      <div className="grid grid-10x5">
        {cells.map((cell) => {
          const taken = cell.status === 'taken';
          const locked = !taken && !canPlay;
          const cls = [
            'bowl-tile',
            taken ? 'taken' : '',
            locked ? 'locked' : '',
            flushingCell === cell.cellIndex ? 'flushing' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <button
              key={cell.cellIndex}
              type="button"
              className={cls}
              disabled={taken || locked}
              onClick={() => onPick(cell.cellIndex)}
              title={`Bowl #${cell.cellIndex + 1}`}
            >
              <span className="num">{cell.cellIndex + 1}</span>
              <span>{taken ? '🧻' : '🚽'}</span>
            </button>
          );
        })}
      </div>
      <div className="legend">
        <span>
          <i className="avail" /> Available
        </span>
        <span>
          <i className="gone" /> Already taken
        </span>
      </div>
    </div>
  );
}
