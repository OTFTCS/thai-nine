import { interpolate, useCurrentFrame } from "remotion";
import { fontFamily } from "../../fonts";
import type { RecapGridCardProps, RecapGridItem } from "../../data/types";

const CELL_FADE_FRAMES = 6;
const CELL_STAGGER = 4;

function columnsFor(n: number): number {
  if (n <= 4) return n;
  if (n === 5 || n === 6) return 3;
  if (n === 9) return 3;
  return 4;
}

const Cell: React.FC<{ item: RecapGridItem; index: number }> = ({ item, index }) => {
  const frame = useCurrentFrame();
  const start = index * CELL_STAGGER;
  const opacity = interpolate(
    frame,
    [start, start + CELL_FADE_FRAMES],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "center",
        gap: 4,
        opacity,
      }}
    >
      <div
        style={{
          fontSize: 28,
          fontWeight: 600,
          color: "#1a1a1a",
          letterSpacing: "-0.01em",
          lineHeight: 1.1,
        }}
      >
        {item.translit}
      </div>
      <div
        style={{
          fontSize: 24,
          fontWeight: 400,
          color: "#1a1a1a",
          lineHeight: 1.2,
        }}
      >
        {item.thai}
      </div>
      {item.english && (
        <div
          style={{
            fontSize: 15,
            fontWeight: 400,
            color: "#5a5a5a",
            lineHeight: 1.2,
          }}
        >
          {item.english}
        </div>
      )}
    </div>
  );
};

export const RecapGridCard: React.FC<RecapGridCardProps> = ({ items }) => {
  const cols = columnsFor(items.length);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: "24px 28px",
        padding: "40px 48px",
        fontFamily,
        alignContent: "center",
      }}
    >
      {items.map((item, i) => (
        <Cell key={i} item={item} index={i} />
      ))}
    </div>
  );
};
