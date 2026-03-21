import { useGameStore } from '@/store/game-store';
import { PokerTable } from '@/components/table/PokerTable';
import { PlayerSeat } from '@/components/seat/PlayerSeat';

// All positions stay within 8%–92% so nothing overflows the container.
// The table felt is inset further, so seats sit on or just outside the felt edge.
const SEAT_POSITIONS = [
  { top: '88%', left: '50%' },   // 0: bottom center (human)
  { top: '75%', left: '12%' },   // 1: bottom-left
  { top: '50%', left: '8%' },    // 2: left
  { top: '18%', left: '12%' },   // 3: top-left
  { top: '8%',  left: '50%' },   // 4: top center
  { top: '18%', left: '88%' },   // 5: top-right
  { top: '50%', left: '92%' },   // 6: right
  { top: '75%', left: '88%' },   // 7: bottom-right
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
    <div className="w-full h-full flex items-center justify-center p-4">
      <div
        className="relative aspect-[16/10]"
        style={{
          /* Size: fill available space but never exceed bounds */
          width: 'min(100%, 780px)',
          height: 'min(100%, calc(100% - 8px))',
          /* If height is the constraint, derive width from it */
          maxWidth: 'calc(min(100%, calc(100% - 8px)) * 1.6)',
          filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.6))',
        }}
      >
        <PokerTable communityCards={communityCards} potAmount={totalPot} />
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
