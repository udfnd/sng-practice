import { useGameStore } from '@/store/game-store';
import type { Standing } from '@/types';

interface ResultsScreenProps {
  onPlayAgain: () => void;
}

function getOrdinal(n: number): string {
  const suffix = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (suffix[(v - 20) % 10] ?? suffix[v] ?? suffix[0]!);
}

export function ResultsScreen({ onPlayAgain }: ResultsScreenProps) {
  const standings = useGameStore((s) => s.standings);
  const gameState = useGameStore((s) => s.gameState);

  if (!standings) return null;

  // Build player name map from last known game state
  const nameMap = new Map<string, string>(
    (gameState?.players ?? []).map((p) => [p.id, p.name]),
  );

  const humanStanding = standings.find((s) => {
    const p = gameState?.players.find((pl) => pl.id === s.playerId);
    return p?.isHuman;
  });

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 p-4">
      <div className="w-full max-w-md bg-gray-800 rounded-lg p-6 space-y-6">
        <h1 className="text-2xl font-bold text-center">Tournament Complete</h1>

        {humanStanding && (
          <div className="text-center py-4 bg-gray-700 rounded-lg">
            <div className="text-4xl font-bold text-yellow-400">
              {getOrdinal(humanStanding.position)}
            </div>
            <div className="text-sm text-gray-400 mt-1">Your finish</div>
          </div>
        )}

        {/* Standings table */}
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Final Standings
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 border-b border-gray-700">
                <th className="text-left py-1">Place</th>
                <th className="text-left py-1">Player</th>
                <th className="text-right py-1">Hands</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((s: Standing) => {
                const name = nameMap.get(s.playerId) ?? s.playerId;
                const isHuman = gameState?.players.find((p) => p.id === s.playerId)?.isHuman;
                return (
                  <tr
                    key={s.playerId}
                    className={`border-b border-gray-700/50 ${isHuman ? 'text-blue-300' : 'text-gray-300'}`}
                  >
                    <td className="py-1">{getOrdinal(s.position)}</td>
                    <td className="py-1 font-medium">{name}{isHuman ? ' (You)' : ''}</td>
                    <td className="py-1 text-right text-gray-400">{s.handsPlayed}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <button
          onClick={onPlayAgain}
          className="w-full py-3 bg-green-600 hover:bg-green-500 rounded-lg font-bold text-lg transition-colors"
        >
          Play Again
        </button>
      </div>
    </div>
  );
}
