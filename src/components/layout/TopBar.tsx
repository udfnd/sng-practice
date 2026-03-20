import { useGameStore } from '@/store/game-store';

export function TopBar() {
  const blindLevel = useGameStore((s) => s.gameState?.blindLevel);
  const handNumber = useGameStore((s) => s.gameState?.handNumber ?? 0);
  const activePlayers = useGameStore((s) => s.gameState?.players.filter((p) => p.isActive).length ?? 0);

  return (
    <header className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700 text-sm">
      <div className="flex gap-4">
        <span className="text-gray-400">
          Level {blindLevel?.level ?? 1}: {blindLevel?.sb ?? 10}/{blindLevel?.bb ?? 20}
          {blindLevel?.ante ? ` (${blindLevel.ante})` : ''}
        </span>
        <span className="text-gray-400">Hand #{handNumber}</span>
      </div>
      <div className="flex gap-4">
        <span className="text-gray-400">{activePlayers} players</span>
      </div>
    </header>
  );
}
