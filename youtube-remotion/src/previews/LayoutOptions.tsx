import { AbsoluteFill, Img, staticFile } from "remotion";
import { fontFamily } from "../fonts";

const BACKGROUND = "#f5efe3";
const CARD_BG = "#ffffff";
const CARD_BORDER = "#f0e9dc";
const CARD_SHADOW = "0 12px 40px rgba(20, 20, 20, 0.06)";
const STICKER_SHADOW = "0 8px 24px rgba(20, 20, 20, 0.18)";
const INK = "#1a1a1a";
const MUTED = "#5a5a5a";
const WORDMARK_COLOR = "#a09a8e";

const RECAP_ITEMS = [
  { translit: "sàng", thai: "สั่ง", english: "to order" },
  { translit: "a-ròoy", thai: "อร่อย", english: "delicious" },
  { translit: "phèt", thai: "เผ็ด", english: "spicy" },
  { translit: "mâi phèt", thai: "ไม่เผ็ด", english: "not spicy" },
  { translit: "gèp ngern", thai: "เก็บเงิน", english: "check please" },
  { translit: "khǎaw", thai: "ขอ", english: "may I have" },
  { translit: "ìm", thai: "อิ่ม", english: "I'm full" },
  { translit: "náe-nam", thai: "แนะนำ", english: "to recommend" },
];

const RECAP_IMAGE = "images/YT-S01-E01/img-014-eight-icon-grid-recap.png";

const PiPPlaceholder: React.FC = () => (
  <div
    style={{
      position: "absolute",
      left: 0,
      top: 0,
      width: 810,
      height: 1080,
      backgroundColor: "#1f1d1a",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#6e6a64",
      fontSize: 28,
      fontFamily: "sans-serif",
    }}
  >
    PiP placeholder (810×1080)
  </div>
);

interface RecapGridProps {
  cardWidth: number;
  cardHeight: number;
  padding: string;
  translitSize: number;
  thaiSize: number;
  englishSize: number;
  gapRow: number;
  gapCol: number;
}

const RecapGrid: React.FC<RecapGridProps> = ({
  padding,
  translitSize,
  thaiSize,
  englishSize,
  gapRow,
  gapCol,
}) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: `${gapRow}px ${gapCol}px`,
      padding,
      fontFamily,
      alignContent: "center",
    }}
  >
    {RECAP_ITEMS.map((item, i) => (
      <div
        key={i}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          justifyContent: "center",
        }}
      >
        <div
          style={{
            fontSize: translitSize,
            fontWeight: 600,
            color: INK,
            letterSpacing: "-0.01em",
            lineHeight: 1.1,
          }}
        >
          {item.translit}
        </div>
        <div
          style={{
            fontSize: thaiSize,
            fontWeight: 400,
            color: INK,
            lineHeight: 1.2,
          }}
        >
          {item.thai}
        </div>
        <div
          style={{
            fontSize: englishSize,
            fontWeight: 400,
            color: MUTED,
            lineHeight: 1.25,
          }}
        >
          {item.english}
        </div>
      </div>
    ))}
  </div>
);

const OptionLabel: React.FC<{ text: string }> = ({ text }) => (
  <div
    style={{
      position: "absolute",
      top: 20,
      left: 24,
      fontFamily,
      fontSize: 16,
      fontWeight: 600,
      color: "#ffffff",
      backgroundColor: "rgba(26, 26, 26, 0.65)",
      padding: "6px 12px",
      borderRadius: 8,
      letterSpacing: "0.04em",
    }}
  >
    {text}
  </div>
);

export const LayoutOptionA: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: BACKGROUND }}>
    <PiPPlaceholder />
    {/* CardPanel: 1030×1000 */}
    <div
      style={{
        position: "absolute",
        top: 40,
        right: 40,
        width: 1030,
        height: 1000,
        backgroundColor: CARD_BG,
        borderRadius: 24,
        border: `2px solid ${CARD_BORDER}`,
        boxShadow: CARD_SHADOW,
        overflow: "visible",
      }}
    >
      <RecapGrid
        cardWidth={1030}
        cardHeight={1000}
        padding="72px 72px 120px 72px"
        translitSize={42}
        thaiSize={34}
        englishSize={22}
        gapRow={36}
        gapCol={36}
      />
      {/* Wordmark bottom-left inside card */}
      <div
        style={{
          position: "absolute",
          left: 48,
          bottom: 36,
          fontFamily,
          fontSize: 20,
          fontWeight: 500,
          color: WORDMARK_COLOR,
          letterSpacing: "0.04em",
        }}
      >
        thai with nine
      </div>
    </div>
    {/* Sticker — overlapping bottom-right corner of card */}
    <div
      style={{
        position: "absolute",
        /* card right edge at x=1880, card bottom at y=1040; sticker overlaps ~150px in */
        right: -20,
        bottom: -20,
        width: 280,
        height: 280,
        transform: "rotate(-4deg)",
        borderRadius: 20,
        backgroundColor: BACKGROUND,
        padding: 6,
        boxShadow: STICKER_SHADOW,
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: "#ffffff",
          borderRadius: 14,
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 12,
        }}
      >
        <Img
          src={staticFile(RECAP_IMAGE)}
          style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
        />
      </div>
    </div>
    <OptionLabel text="A — CORNER STICKER" />
  </AbsoluteFill>
);

export const LayoutOptionB: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: BACKGROUND }}>
    <PiPPlaceholder />
    {/* CardPanel: 1030×1000, clean rect */}
    <div
      style={{
        position: "absolute",
        top: 40,
        right: 40,
        width: 1030,
        height: 1000,
        backgroundColor: CARD_BG,
        borderRadius: 24,
        border: `2px solid ${CARD_BORDER}`,
        boxShadow: CARD_SHADOW,
        overflow: "hidden",
      }}
    >
      <RecapGrid
        cardWidth={1030}
        cardHeight={1000}
        padding="72px"
        translitSize={42}
        thaiSize={34}
        englishSize={22}
        gapRow={36}
        gapCol={36}
      />
      {/* Wordmark inside card bottom-right, small */}
      <div
        style={{
          position: "absolute",
          right: 36,
          bottom: 24,
          fontFamily,
          fontSize: 16,
          fontWeight: 500,
          color: WORDMARK_COLOR,
          letterSpacing: "0.04em",
        }}
      >
        thai with nine
      </div>
    </div>
    {/* Floating circular bubble off-card, at composition bottom-right outside card */}
    {/* Card ends at bottom=1040 and right=1880. Place bubble clearly below card in unused strip */}
    {/* Since card fills to y=1040 there's only 40px below. Instead, place bubble against card's right edge but outside composition right bound? That would clip. Move to card's bottom-right corner just touching outside */}
    <div
      style={{
        position: "absolute",
        right: 20,
        bottom: 20,
        width: 240,
        height: 240,
        transform: "rotate(-2deg)",
        borderRadius: "50%",
        backgroundColor: BACKGROUND,
        padding: 5,
        boxShadow: STICKER_SHADOW,
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: "#ffffff",
          borderRadius: "50%",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <Img
          src={staticFile(RECAP_IMAGE)}
          style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
        />
      </div>
    </div>
    <OptionLabel text="B — FLOATING BUBBLE" />
  </AbsoluteFill>
);

export const LayoutOptionC: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: BACKGROUND }}>
    <PiPPlaceholder />
    {/* CardPanel: 1030×1000 */}
    <div
      style={{
        position: "absolute",
        top: 40,
        right: 40,
        width: 1030,
        height: 1000,
        backgroundColor: CARD_BG,
        borderRadius: 24,
        border: `2px solid ${CARD_BORDER}`,
        boxShadow: CARD_SHADOW,
        overflow: "hidden",
      }}
    >
      <RecapGrid
        cardWidth={1030}
        cardHeight={1000}
        padding="72px 72px 72px 72px"
        translitSize={42}
        thaiSize={34}
        englishSize={22}
        gapRow={36}
        gapCol={36}
      />
      {/* Stamp inside card bottom-right */}
      <div
        style={{
          position: "absolute",
          right: 48,
          bottom: 48,
          width: 220,
          height: 220,
          transform: "rotate(-6deg)",
          borderRadius: "50%",
          backgroundColor: BACKGROUND,
          padding: 6,
          boxShadow: "0 6px 18px rgba(20, 20, 20, 0.14)",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            border: `2px dashed ${CARD_BORDER}`,
            backgroundColor: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <Img
            src={staticFile(RECAP_IMAGE)}
            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
          />
        </div>
      </div>
    </div>
    {/* Wordmark below card (no room since card ends at 1040, composition ends at 1080) */}
    <div
      style={{
        position: "absolute",
        left: 870,
        bottom: 10,
        fontFamily,
        fontSize: 18,
        fontWeight: 500,
        color: WORDMARK_COLOR,
        letterSpacing: "0.04em",
      }}
    >
      thai with nine
    </div>
    <OptionLabel text="C — STAMP INSIDE CARD" />
  </AbsoluteFill>
);

export const LayoutOptionE: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: BACKGROUND }}>
    <PiPPlaceholder />
    {/* Full logo at top-left of PiP */}
    <Img
      src={staticFile("logo-full.png")}
      style={{
        position: "absolute",
        top: 32,
        left: 32,
        width: 260,
        height: "auto",
        zIndex: 5,
      }}
    />
    {/* CardPanel: 1030×1000 */}
    <div
      style={{
        position: "absolute",
        top: 40,
        right: 40,
        width: 1030,
        height: 1000,
        backgroundColor: CARD_BG,
        borderRadius: 24,
        border: `2px solid ${CARD_BORDER}`,
        boxShadow: CARD_SHADOW,
        overflow: "hidden",
      }}
    >
      <RecapGrid
        cardWidth={1030}
        cardHeight={1000}
        padding="72px"
        translitSize={42}
        thaiSize={34}
        englishSize={22}
        gapRow={36}
        gapCol={36}
      />
      {/* Wordmark inside card bottom-right, small */}
      <div
        style={{
          position: "absolute",
          right: 36,
          bottom: 24,
          fontFamily,
          fontSize: 16,
          fontWeight: 500,
          color: WORDMARK_COLOR,
          letterSpacing: "0.04em",
        }}
      >
        thai with nine
      </div>
    </div>
    {/* Bubble shifted up and left: mostly over PiP (ends x=810), only ~40px into card (starts x=850).
        300×300, left=580, top=10 → spans x=580-880, y=10-310. ~230px over PiP, ~30px over card. */}
    <div
      style={{
        position: "absolute",
        top: 10,
        left: 580,
        width: 300,
        height: 300,
        transform: "rotate(-3deg)",
        borderRadius: "50%",
        backgroundColor: BACKGROUND,
        padding: 6,
        boxShadow: "0 10px 30px rgba(20, 20, 20, 0.22)",
        zIndex: 10,
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: "#ffffff",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 36,
          overflow: "hidden",
        }}
      >
        <Img
          src={staticFile(RECAP_IMAGE)}
          style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
        />
      </div>
    </div>
    <OptionLabel text="E — TOP-CENTRE BUBBLE" />
  </AbsoluteFill>
);

export const LayoutOptionD: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: BACKGROUND }}>
    <PiPPlaceholder />
    {/* CardPanel: 1030×940 (shorter to leave escape strip) */}
    <div
      style={{
        position: "absolute",
        top: 40,
        right: 40,
        width: 1030,
        height: 940,
        backgroundColor: CARD_BG,
        borderRadius: 24,
        border: `2px solid ${CARD_BORDER}`,
        boxShadow: CARD_SHADOW,
        overflow: "visible",
      }}
    >
      <RecapGrid
        cardWidth={1030}
        cardHeight={940}
        padding="68px 68px 140px 68px"
        translitSize={40}
        thaiSize={32}
        englishSize={20}
        gapRow={32}
        gapCol={32}
      />
    </div>
    {/* Escaping sticker: 60% inside card bottom-right, 40% spilling below */}
    <div
      style={{
        position: "absolute",
        /* card bottom at y=980 (40+940). Sticker 320 tall, 60% inside = 192 above card bottom */
        right: 60,
        bottom: 10,
        width: 320,
        height: 320,
        transform: "rotate(5deg)",
        borderRadius: 22,
        backgroundColor: BACKGROUND,
        padding: 6,
        boxShadow: "0 10px 28px rgba(20, 20, 20, 0.2)",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: "#ffffff",
          borderRadius: 16,
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 14,
        }}
      >
        <Img
          src={staticFile(RECAP_IMAGE)}
          style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
        />
      </div>
    </div>
    {/* Wordmark in free strip bottom-left of composition right column */}
    <div
      style={{
        position: "absolute",
        left: 870,
        bottom: 28,
        fontFamily,
        fontSize: 20,
        fontWeight: 500,
        color: WORDMARK_COLOR,
        letterSpacing: "0.04em",
      }}
    >
      thai with nine
    </div>
    <OptionLabel text="D — PEEK FROM EDGE" />
  </AbsoluteFill>
);
