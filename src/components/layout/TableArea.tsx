import { useGameStore } from '@/store/game-store';
import { PokerTable } from '@/components/table/PokerTable';
import { PlayerSeat } from '@/components/seat/PlayerSeat';

/*
 * Layout uses CSS Grid to eliminate all absolute-positioning overlap.
 *
 * 5-column × 5-row grid:
 *
 *  col:    1      2      3       4      5
 *  row 1:  .      S3     S4      S5     .
 *  row 2:  S2     .    TABLE     .      S6
 *  row 3:  S1     .    TABLE     .      S7
 *  row 4:  .      .     S0       .      .
 *
 * The table felt spans rows 2–3, cols 2–4.
 * Each seat is in its own cell — no overlaps.
 */

const EMPTY_PLAYERS: never[] = [];
const EMPTY_CARDS: never[] = [];
const EMPTY_SIDE_POTS: never[] = [];

// Map seat index to [row, col, justifySelf, alignSelf]
// Grid is 1-indexed
const SEAT_GRID: Record<number, { row: number; col: number; justify: string; align: string }> = {
  0: { row: 4, col: 3, justify: 'center', align: 'end' },   // Hero - bottom center
  1: { row: 3, col: 1, justify: 'end',    align: 'center' }, // bottom-left
  2: { row: 2, col: 1, justify: 'end',    align: 'center' }, // left
  3: { row: 1, col: 2, justify: 'end',    align: 'start' },  // top-left
  4: { row: 1, col: 3, justify: 'center', align: 'start' },  // top-center
  5: { row: 1, col: 4, justify: 'start',  align: 'start' },  // top-right
  6: { row: 2, col: 5, justify: 'start',  align: 'center' }, // right
  7: { row: 3, col: 5, justify: 'start',  align: 'center' }, // bottom-right
};

export function TableArea() {
  const players = useGameStore((s) => s.gameState?.players) ?? EMPTY_PLAYERS;
  const communityCards = useGameStore((s) => s.gameState?.communityCards) ?? EMPTY_CARDS;
  const mainPot = useGameStore((s) => s.gameState?.mainPot) ?? 0;
  const sidePots = useGameStore((s) => s.gameState?.sidePots) ?? EMPTY_SIDE_POTS;
  const buttonSeat = useGameStore((s) => s.gameState?.buttonSeatIndex) ?? -1;

  const totalPot = mainPot + sidePots.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="w-full h-full flex items-center justify-center overflow-hidden" style={{ padding: '8px 0' }}>
      {/*
       * Grid container — fixed aspect ratio, bounded by viewport.
       * TopBar ~40px + ActionPanel ~120px + grid padding = ~180px reserved.
       */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 2fr 1fr 1fr',
          gridTemplateRows: 'auto 1fr 1fr auto',
          width: 'min(calc(100vw - 24px), calc((100vh - 180px) * 16 / 9))',
          maxWidth: '960px',
          height: 'min(calc(100vh - 180px), calc((100vw - 24px) * 9 / 16))',
          maxHeight: '540px',
          gap: '4px',
        }}
      >
        {/* Table felt — spans rows 2–3, cols 2–4 */}
        <div
          style={{
            gridRow: '2 / 4',
            gridColumn: '2 / 5',
            padding: '4px',
          }}
        >
          <PokerTable communityCards={communityCards} potAmount={totalPot} />
        </div>

        {/* Player seats in their dedicated grid cells */}
        {players.map((player) => {
          const grid = SEAT_GRID[player.seatIndex];
          if (!grid) return null;
          return (
            <div
              key={player.id}
              style={{
                gridRow: grid.row,
                gridColumn: grid.col,
                display: 'flex',
                alignItems: grid.align === 'start' ? 'flex-start' : grid.align === 'end' ? 'flex-end' : 'center',
                justifyContent: grid.justify === 'start' ? 'flex-start' : grid.justify === 'end' ? 'flex-end' : 'center',
                padding: player.seatIndex === 0 ? '4px 0 0 0' : '2px',
                minWidth: 0,
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
