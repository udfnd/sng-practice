import { useGameStore } from '@/store/game-store';
import { PokerTable } from '@/components/table/PokerTable';
import { PlayerSeat } from '@/components/seat/PlayerSeat';

const SEAT_POSITIONS = [
  { top: '80%', left: '50%' },   // 0: bottom center (human)
  { top: '70%', left: '15%' },   // 1: bottom left
  { top: '40%', left: '5%' },    // 2: middle left
  { top: '10%', left: '15%' },   // 3: top left
  { top: '5%', left: '40%' },    // 4: top center-left
  { top: '5%', left: '60%' },    // 5: top center-right
  { top: '10%', left: '85%' },   // 6: top right
  { top: '40%', left: '95%' },   // 7: middle right
];

export function TableArea() {
  const players = useGameStore((s) => s.gameState?.players ?? []);
  const communityCards = useGameStore((s) => s.gameState?.communityCards ?? []);
  const mainPot = useGameStore((s) => s.gameState?.mainPot ?? 0);
  const sidePots = useGameStore((s) => s.gameState?.sidePots ?? []);
  const buttonSeat = useGameStore((s) => s.gameState?.buttonSeatIndex ?? -1);

  const totalPot = mainPot + sidePots.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="relative w-full max-w-4xl aspect-[16/10] mx-auto">
      <PokerTable communityCards={communityCards} potAmount={totalPot} />
      {players.map((player) => {
        const pos = SEAT_POSITIONS[player.seatIndex];
        if (!pos) return null;
        return (
          <div
            key={player.id}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ top: pos.top, left: pos.left }}
          >
            <PlayerSeat player={player} isButton={player.seatIndex === buttonSeat} />
          </div>
        );
      })}
    </div>
  );
}
