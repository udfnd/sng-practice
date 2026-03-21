import { useGameStore } from '@/store/game-store';
import { PokerTable } from '@/components/table/PokerTable';
import { PlayerSeat } from '@/components/seat/PlayerSeat';

// Seat positions — spread wider to avoid overlap with larger card/text sizes.
// The container uses aspect-[16/11] for more vertical room.
// Positions are tuned so cards + info badges never collide.
const SEAT_POSITIONS = [
  { top: '92%', left: '50%' },   // 0: bottom center (human)
  { top: '78%', left: '8%' },    // 1: bottom-left
  { top: '46%', left: '-2%' },   // 2: left
  { top: '8%',  left: '10%' },   // 3: top-left
  { top: '-2%', left: '50%' },   // 4: top center
  { top: '8%',  left: '90%' },   // 5: top-right
  { top: '46%', left: '102%' },  // 6: right
  { top: '78%', left: '92%' },   // 7: bottom-right
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
    <div className="relative w-full flex-1 flex items-center justify-center overflow-visible px-4 sm:px-8">
      {/* Inner container with fixed aspect ratio — overflow visible so edge seats render */}
      <div
        className="relative w-full max-w-5xl aspect-[16/11]"
        style={{ filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.6))' }}
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
