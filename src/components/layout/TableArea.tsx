import { useGameStore } from '@/store/game-store';
import { PokerTable } from '@/components/table/PokerTable';
import { PlayerSeat } from '@/components/seat/PlayerSeat';

/*
 * Poker table layout with 8 seats around an elliptical table.
 *
 * Architecture:
 * - Outer container fills available space (flex-1 from parent)
 * - Inner "board" div is position:relative, centered, aspect-ratio fixed
 * - Table felt is absolutely positioned in the CENTER of the board (inset 20%/15%)
 * - Seats are absolutely positioned around the BOARD edges (outside the felt)
 *
 * The key insight: the felt is SMALLER than the board container.
 * Seats sit in the gap between felt edge and board edge.
 * Since seats use % of the board (not the felt), they never overlap the felt.
 *
 *          [S4]
 *     [S3]       [S5]
 *   [S2] ╭─────────╮ [S6]
 *         │  FELT   │
 *   [S1] ╰─────────╯ [S7]
 *          [S0]
 */

// Positions as % of the BOARD container (not the felt).
// Felt occupies roughly 20%-80% horizontally, 18%-82% vertically.
// Seats are placed OUTSIDE the felt zone.
const SEAT_POSITIONS: { top: string; left: string }[] = [
  { top: '95%', left: '50%' },   // 0: bottom center (hero)
  { top: '78%', left: '6%' },    // 1: bottom-left
  { top: '48%', left: '1%' },    // 2: left
  { top: '14%', left: '10%' },   // 3: top-left
  { top: '1%',  left: '50%' },   // 4: top center
  { top: '14%', left: '90%' },   // 5: top-right
  { top: '48%', left: '99%' },   // 6: right
  { top: '78%', left: '94%' },   // 7: bottom-right
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

  /*
   * Sizing: the board container fills available width/height but maintains
   * a 16:9 aspect ratio. It's capped so it fits within:
   *   width: viewport - SidePanel(240px) - padding
   *   height: viewport - TopBar(40px) - ActionPanel(120px) - padding
   */
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '8px 80px',
        boxSizing: 'border-box',
      }}
    >
      {/* Board container — holds felt + seats */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '860px',
          aspectRatio: '16 / 9',
          /* Constrain height so it doesn't push ActionPanel off screen */
          maxHeight: 'calc(100vh - 210px)',
        }}
      >
        {/* Table felt — centered, smaller than board */}
        <div
          style={{
            position: 'absolute',
            top: '18%',
            bottom: '18%',
            left: '14%',
            right: '14%',
          }}
        >
          <PokerTable communityCards={communityCards} potAmount={totalPot} />
        </div>

        {/* Player seats — positioned around the board edges */}
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
