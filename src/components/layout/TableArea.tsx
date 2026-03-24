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

// Convert degrees to ellipse-edge percentage coordinates.
// The oval has aspect-ratio 2:1, so we scale the x-axis by 2.
// Degrees follow clock convention: 0=right, 90=top, 180=left, 270=bottom.
// We use standard math angles (counterclockwise from right) but the
// design spec uses clockwise from bottom, so we map accordingly.
function degToPos(deg: number): { top: string; left: string } {
  // Design degrees: 0=right, 90=top, 180=left, 270=bottom (clockwise from right)
  // Convert to standard math radians (counter-clockwise from right)
  const rad = (deg * Math.PI) / 180;
  // Ellipse: a=0.5 (x-radius), b=0.5 (y-radius) in normalized coords [0,1]
  // But the container has aspect-ratio 2:1, so visual x-radius = 1.0 container width,
  // and visual y-radius = 0.5 container height. We parametrize on the unit circle
  // and project onto the ellipse perimeter in percentage space.
  const x = 50 + 50 * Math.cos(rad);   // 0%..100% along width
  const y = 50 - 50 * Math.sin(rad);   // 0%..100% along height (y-axis flipped)
  return { left: `${x.toFixed(1)}%`, top: `${y.toFixed(1)}%` };
}

// Seat degree positions — counter-clockwise from hero.
// Seats increase to the LEFT (counter-clockwise) from hero's perspective.
//   Seat 0 (human): 270° — bottom center
//   Seat 1: 225° — bottom-left
//   Seat 2: 180° — left
//   Seat 3: 135° — top-left
//   Seat 4:  90° — top center
//   Seat 5:  45° — top-right
//   Seat 6:   0° — right
//   Seat 7: 315° — bottom-right
const SEAT_DEGREES = [270, 225, 180, 135, 90, 45, 0, 315] as const;

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
