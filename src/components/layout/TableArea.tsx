import { useGameStore } from '@/store/game-store';
import { PokerTable } from '@/components/table/PokerTable';
import { PlayerSeat } from '@/components/seat/PlayerSeat';

// Seats positioned 10%-90% to stay inside the 16:9 container with margin.
const SEAT_POSITIONS = [
  { top: '88%', left: '50%' },   // 0: bottom center (human)
  { top: '74%', left: '12%' },   // 1: bottom-left
  { top: '50%', left: '10%' },   // 2: left
  { top: '18%', left: '12%' },   // 3: top-left
  { top: '10%', left: '50%' },   // 4: top center
  { top: '18%', left: '88%' },   // 5: top-right
  { top: '50%', left: '90%' },   // 6: right
  { top: '74%', left: '88%' },   // 7: bottom-right
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
   * Layout strategy:
   * - The outer div fills the available flex space and centers its child.
   * - The inner div has aspect-[16/9]. Its width is capped so that the
   *   resulting height never exceeds what's available (viewport minus
   *   TopBar 44px + ActionPanel 130px + padding ≈ 200px total).
   *   Formula: maxWidth = availableHeight * (16/9)
   */
  return (
    <div className="w-full h-full flex items-center justify-center px-2 py-1">
      <div
        className="relative w-full aspect-[16/9]"
        style={{
          /* Smaller table so player seats don't overlap each other */
          maxWidth: 'min(640px, 88vw, calc((100vh - 210px) * 16 / 9))',
          filter: 'drop-shadow(0 6px 20px rgba(0,0,0,0.5))',
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
