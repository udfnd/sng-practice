import { useGameStore } from '@/store/game-store';
import { PokerTable } from '@/components/table/PokerTable';
import { PlayerSeat } from '@/components/seat/PlayerSeat';

/*
 * 8-seat poker table. Seats sit ON the table edge (not outside it).
 * The table felt fills the entire container, and seats are placed
 * at positions along the elliptical rim.
 *
 *            [S4]
 *       [S3]      [S5]
 *     [S2]          [S6]
 *       [S1]      [S7]
 *            [S0]
 */

// Positions as % of the table container.
// These follow the ellipse edge so seats sit ON the table rim.
// Spread seats wider along the ellipse to prevent left/right stacking.
// S1/S3 and S5/S7 are pushed toward the horizontal center so they
// follow the ellipse curve rather than bunching at the left/right edges.
const SEAT_POSITIONS: { top: string; left: string }[] = [
  { top: '97%', left: '50%' },   // 0: bottom center (hero)
  { top: '82%', left: '18%' },   // 1: bottom-left (pushed right from 10%)
  { top: '50%', left: '2%' },    // 2: left (stays at edge)
  { top: '14%', left: '18%' },   // 3: top-left (pushed right from 10%)
  { top: '2%',  left: '50%' },   // 4: top center
  { top: '14%', left: '82%' },   // 5: top-right (pushed left from 90%)
  { top: '50%', left: '98%' },   // 6: right (stays at edge)
  { top: '82%', left: '82%' },   // 7: bottom-right (pushed left from 90%)
];

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
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4px 16px',
        boxSizing: 'border-box',
        overflow: 'visible',
      }}
    >
      {/* Table container — felt + seats are same coordinate space */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '820px',
          aspectRatio: '2 / 1',
          maxHeight: 'calc(100vh - 210px)',
          overflow: 'visible',
        }}
      >
        {/* Table felt — fills entire container */}
        <div style={{ position: 'absolute', inset: 0 }}>
          <PokerTable communityCards={communityCards} potAmount={totalPot} />
        </div>

        {/* Player seats — ON the table edge */}
        {players.map((player) => {
          const pos = SEAT_POSITIONS[player.seatIndex];
          if (!pos) return null;
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
              <PlayerSeat player={player} isButton={player.seatIndex === buttonSeat} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
