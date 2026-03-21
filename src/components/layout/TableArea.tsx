import { useGameStore } from '@/store/game-store';
import { PokerTable } from '@/components/table/PokerTable';
import { PlayerSeat } from '@/components/seat/PlayerSeat';

/*
 * Layout: the OUTER container is larger than the table felt.
 * Seats are positioned in the outer container, sitting OUTSIDE the felt.
 * The felt (PokerTable) is centered and smaller (inset ~15% on sides, ~20% top/bottom).
 * This gives seats room to breathe without overlapping each other or the felt.
 *
 *   [Seat4]___________________________[       ]
 *  [S3] /                              \ [S5]
 *  [S2]|        FELT (table)           | [S6]
 *  [S1] \______________________________/ [S7]
 *              [Seat0 - Hero]
 */
const SEAT_POSITIONS = [
  { top: '95%', left: '50%' },   // 0: bottom center (human)
  { top: '78%', left: '5%' },    // 1: bottom-left
  { top: '50%', left: '0%' },    // 2: left
  { top: '15%', left: '5%' },    // 3: top-left
  { top: '2%',  left: '50%' },   // 4: top center
  { top: '15%', left: '95%' },   // 5: top-right
  { top: '50%', left: '100%' },  // 6: right
  { top: '78%', left: '95%' },   // 7: bottom-right
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
    <div className="w-full h-full flex items-center justify-center">
      {/* Outer container — seats live here, sized to fit viewport */}
      <div
        className="relative aspect-[16/9]"
        style={{
          /*
           * Width: fit screen width (with padding for edge seats ~80px each side)
           * but also constrained by height so nothing clips vertically.
           * TopBar ~44px + ActionPanel ~130px + padding = ~190px reserved.
           */
          width: 'min(calc(100vw - 160px), calc((100vh - 190px) * 16 / 9))',
          maxWidth: '900px',
        }}
      >
        {/* The felt table — inset inside the outer container */}
        <div className="absolute" style={{ top: '18%', bottom: '18%', left: '12%', right: '12%' }}>
          <PokerTable communityCards={communityCards} potAmount={totalPot} />
        </div>

        {/* Player seats — positioned in the outer container (outside the felt) */}
        {players.map((player) => {
          const pos = SEAT_POSITIONS[player.seatIndex];
          if (!pos) return null;
          return (
            <div
              key={player.id}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-10"
              style={{ top: pos.top, left: pos.left }}
            >
              <PlayerSeat player={player} isButton={player.seatIndex === buttonSeat} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
