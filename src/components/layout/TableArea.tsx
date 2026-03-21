import { useGameStore } from '@/store/game-store';
import { PokerTable } from '@/components/table/PokerTable';
import { PlayerSeat } from '@/components/seat/PlayerSeat';

// Seat positions — placed along the table edge.
// Uses a wider container with padding so seats stay within bounds.
const SEAT_POSITIONS = [
  { top: '90%', left: '50%' },   // 0: bottom center (human)
  { top: '76%', left: '10%' },   // 1: bottom-left
  { top: '50%', left: '2%' },    // 2: left
  { top: '14%', left: '10%' },   // 3: top-left
  { top: '2%',  left: '50%' },   // 4: top center
  { top: '14%', left: '90%' },   // 5: top-right
  { top: '50%', left: '98%' },   // 6: right
  { top: '76%', left: '90%' },   // 7: bottom-right
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
    <div className="relative w-full flex-1 flex items-center justify-center px-10 sm:px-14 py-2 min-h-0 overflow-hidden">
      <div
        className="relative w-full max-w-4xl aspect-[16/10]"
        style={{
          filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.6))',
          /* Shrink width so height fits: TopBar ~44px + ActionPanel 140px + padding */
          maxWidth: 'min(100%, calc((100vh - 200px) * 1.6))',
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
