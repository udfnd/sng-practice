import { useGameStore } from '@/store/game-store';
import { PokerTable } from '@/components/table/PokerTable';
import { PlayerSeat } from '@/components/seat/PlayerSeat';

// Seat positions as percentages of container (top/left)
// Arranged in oval pattern per design spec:
// Seat 0 (human): 270° bottom center
// Seat 1: 225° bottom-left
// Seat 2: 180° left
// Seat 3: 135° top-left
// Seat 4: 90° top center
// Seat 5: 45° top-right
// Seat 6: 0° right
// Seat 7: 315° bottom-right
const SEAT_POSITIONS = [
  { top: '88%', left: '50%' },   // 0: bottom center (human) - 270°
  { top: '75%', left: '12%' },   // 1: bottom-left - 225°
  { top: '48%', left: '3%' },    // 2: left - 180°
  { top: '12%', left: '12%' },   // 3: top-left - 135°
  { top: '5%', left: '50%' },    // 4: top center - 90°
  { top: '12%', left: '88%' },   // 5: top-right - 45°
  { top: '48%', left: '97%' },   // 6: right - 0°
  { top: '75%', left: '88%' },   // 7: bottom-right - 315°
];

export function TableArea() {
  const players = useGameStore((s) => s.gameState?.players ?? []);
  const communityCards = useGameStore((s) => s.gameState?.communityCards ?? []);
  const mainPot = useGameStore((s) => s.gameState?.mainPot ?? 0);
  const sidePots = useGameStore((s) => s.gameState?.sidePots ?? []);
  const buttonSeat = useGameStore((s) => s.gameState?.buttonSeatIndex ?? -1);

  const totalPot = mainPot + sidePots.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="relative w-full max-w-4xl aspect-[16/10] mx-auto px-1 sm:px-0">
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
