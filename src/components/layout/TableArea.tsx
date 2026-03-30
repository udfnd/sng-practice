import { useGameStore } from '@/store/game-store';
import { PokerTable } from '@/components/table/PokerTable';
import { PlayerSeat } from '@/components/seat/PlayerSeat';

/*
 * 8-seat poker table. Seats sit ON the table edge (not outside it).
 * The table felt fills the entire container, and seats are placed
 * at positions along the elliptical rim using degree-based positioning.
 *
 * Counter-clockwise layout (standard poker viewing convention):
 * Seats increase to the LEFT (counter-clockwise) from hero's perspective.
 * Action flows clockwise (left of BB first), but visually seats go CCW.
 *
 * Degree system (0°=right, 90°=top, 180°=left, 270°=bottom):
 *   Seat 0 (human): 270° — bottom center
 *   Seat 1: 225° — bottom-left (to hero's left)
 *   Seat 2: 180° — left
 *   Seat 3: 135° — top-left
 *   Seat 4:  90° — top center
 *   Seat 5:  45° — top-right
 *   Seat 6:   0° — right
 *   Seat 7: 315° — bottom-right (to hero's right)
 *
 *            [S4]
 *       [S3]      [S5]
 *     [S2]          [S6]
 *       [S1]      [S7]
 *            [S0]  (hero)
 */

// Convert degrees to race-track (stadium) perimeter percentage coordinates.
// The container has aspect-ratio 2:1. The race-track shape has semicircular
// caps on the left and right ends with straight sections on top and bottom.
//
// In percentage-space (center at 50%,50%):
//   - Semicircle caps are visually circular with radius = half the height
//   - Cap centers at x=25% and x=75% (i.e., ±25 from center)
//   - In %-space the caps are ellipses: semi-x=25, semi-y=50 (circular when rendered 2:1)
//   - Straight sections span x ∈ [25%, 75%] at y=0% (top) and y=100% (bottom)
//
// Degrees: 0=right, 90=top, 180=left, 270=bottom (standard math, CCW from right).
// A ray from center at angle θ intersects the stadium boundary.
function degToPos(deg: number): { top: string; left: string } {
  const rad = (deg * Math.PI) / 180;
  const cosA = Math.cos(rad);
  const sinA = Math.sin(rad);

  // Threshold: cos²θ = 1/5 separates cap zones from straight zones.
  // When cos²θ ≥ 0.2, the ray hits a semicircle cap; otherwise a straight edge.
  const COS2_THRESHOLD = 0.2;

  let x: number;
  let y: number;

  if (cosA * cosA >= COS2_THRESHOLD) {
    // Ray hits a semicircle cap (right or left).
    // Derived from ray–ellipse intersection with cap center at (±25, 0).
    const t = 200 * Math.abs(cosA) / (3 * cosA * cosA + 1);
    x = t * cosA;
    y = t * sinA;
  } else if (sinA > 0) {
    // Ray hits the top straight edge (y = +50 in math coords → top = 0%)
    const t = 50 / sinA;
    x = t * cosA;
    y = 50;
  } else {
    // Ray hits the bottom straight edge (y = -50 in math coords → top = 100%)
    const t = -50 / sinA;
    x = t * cosA;
    y = -50;
  }

  // Convert from math coords (center-origin, y-up) to CSS percentage (top-left origin, y-down)
  const left = 50 + x;
  const top = 50 - y;

  return { left: `${left.toFixed(1)}%`, top: `${top.toFixed(1)}%` };
}

// Seat degree positions — counter-clockwise from hero.
// Seats increase to the LEFT (counter-clockwise) from hero's perspective.
// Diagonal seats (1,3,5,7) shifted 15° toward the nearest straight edge
// so they sit closer to the center of the race-track table.
//   Seat 0 (human): 270° — bottom center
//   Seat 1: 240° — bottom-left (was 225°, shifted toward bottom)
//   Seat 2: 180° — left
//   Seat 3: 120° — top-left (was 135°, shifted toward top)
//   Seat 4:  90° — top center
//   Seat 5:  60° — top-right (was 45°, shifted toward top)
//   Seat 6:   0° — right
//   Seat 7: 300° — bottom-right (was 315°, shifted toward bottom)
const SEAT_DEGREES = [270, 240, 180, 120, 90, 60, 0, 300] as const;

const SEAT_POSITIONS = SEAT_DEGREES.map(degToPos);

const EMPTY_PLAYERS: never[] = [];
const EMPTY_CARDS: never[] = [];
const EMPTY_SIDE_POTS: never[] = [];

export function TableArea() {
  const players = useGameStore((s) => s.gameState?.players) ?? EMPTY_PLAYERS;
  const communityCards = useGameStore((s) => s.gameState?.communityCards) ?? EMPTY_CARDS;
  const mainPot = useGameStore((s) => s.gameState?.mainPot) ?? 0;
  const sidePots = useGameStore((s) => s.gameState?.sidePots) ?? EMPTY_SIDE_POTS;
  const buttonSeat = useGameStore((s) => s.gameState?.buttonSeatIndex) ?? -1;

  const totalPot = mainPot + sidePots.reduce((s, p) => s + p.amount, 0);

  return (
    <div
      className="tablearea-outer"
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
        overflow: 'visible',
      }}
    >
      {/* Table container — felt + seats share the same coordinate space.
          The seats are placed at the ellipse perimeter using percentage coords,
          so the table div itself defines the reference frame.
          Padding on the outer wrapper gives seats room to breathe. */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '760px',
          aspectRatio: '2 / 1',
          maxHeight: 'calc(100vh - 260px)',
          overflow: 'visible',
        }}
      >
        {/* Table felt — fills entire container */}
        <div style={{ position: 'absolute', inset: 0 }}>
          <PokerTable communityCards={communityCards} potAmount={totalPot} />
        </div>

        {/* Player seats — positioned on the table ellipse perimeter */}
        {players.map((player) => {
          const pos = SEAT_POSITIONS[player.seatIndex];
          if (!pos) return null;
          const isHero = player.isHuman;
          return (
            <div
              key={player.id}
              style={{
                position: 'absolute',
                top: pos.top,
                left: pos.left,
                transform: 'translate(-50%, -50%)',
                zIndex: 10,
              }}
            >
              <PlayerSeat
                player={player}
                isButton={player.seatIndex === buttonSeat}
                isHero={isHero}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
