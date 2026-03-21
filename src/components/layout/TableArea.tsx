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
const SEAT_POSITIONS: { top: string; left: string }[] = [
  { top: '96%', left: '50%' },   // 0: bottom center (hero)
  { top: '80%', left: '10%' },   // 1: bottom-left
  { top: '50%', left: '2%' },    // 2: left
  { top: '16%', left: '10%' },   // 3: top-left
  { top: '2%',  left: '50%' },   // 4: top center
  { top: '16%', left: '90%' },   // 5: top-right
  { top: '50%', left: '98%' },   // 6: right
  { top: '80%', left: '90%' },   // 7: bottom-right
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
