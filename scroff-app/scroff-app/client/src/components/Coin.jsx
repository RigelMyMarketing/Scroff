export default function Coin({ size = 52 }) {
  return (
    <div className="coin" style={{ width: size, height: size }}>
      <span className="glyph" style={{ fontSize: size * 0.42 }}>
        S
      </span>
    </div>
  );
}
