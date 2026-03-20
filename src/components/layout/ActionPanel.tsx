import { useState } from 'react';
import { useGameStore } from '@/store/game-store';

export function ActionPanel() {
  const phase = useGameStore((s) => s.gameState?.phase);
  const isHumanTurn = useGameStore((s) => s.isHumanTurn);
  const sendAction = useGameStore((s) => s.sendAction);
  const bettingRound = useGameStore((s) => s.gameState?.bettingRound);
  const humanPlayer = useGameStore((s) => s.gameState?.players.find((p) => p.isHuman));

  const [raiseAmount, setRaiseAmount] = useState(0);

  if (!isHumanTurn || !humanPlayer || !bettingRound) {
    return (
      <div className="flex items-center justify-center py-4 text-gray-500">
        {phase === 'WAITING' ? 'Press Start to begin' : 'Waiting...'}
      </div>
    );
  }

  const facingBet = bettingRound.currentBet;
  const canCheck = humanPlayer.currentBet >= facingBet;
  const callAmount = Math.min(facingBet - humanPlayer.currentBet, humanPlayer.chips);
  const minRaise = facingBet + bettingRound.lastFullRaiseSize;

  return (
    <div className="flex items-center gap-3 py-3 px-4 bg-gray-800 rounded-lg mx-4 mb-4">
      <button
        onClick={() => sendAction('FOLD', 0)}
        className="px-4 py-2 bg-red-700 hover:bg-red-600 rounded font-semibold text-sm"
      >
        Fold
      </button>

      {canCheck ? (
        <button
          onClick={() => sendAction('CHECK', 0)}
          className="px-4 py-2 bg-blue-700 hover:bg-blue-600 rounded font-semibold text-sm"
        >
          Check
        </button>
      ) : (
        <button
          onClick={() => sendAction('CALL', callAmount)}
          className="px-4 py-2 bg-green-700 hover:bg-green-600 rounded font-semibold text-sm"
        >
          Call {callAmount}
        </button>
      )}

      <div className="flex items-center gap-2">
        <input
          type="range"
          min={minRaise}
          max={humanPlayer.chips + humanPlayer.currentBet}
          value={raiseAmount || minRaise}
          onChange={(e) => setRaiseAmount(Number(e.target.value))}
          className="w-32"
        />
        <button
          onClick={() => sendAction('RAISE', raiseAmount || minRaise)}
          className="px-4 py-2 bg-yellow-700 hover:bg-yellow-600 rounded font-semibold text-sm"
        >
          Raise {raiseAmount || minRaise}
        </button>
      </div>

      <button
        onClick={() => sendAction('RAISE', humanPlayer.chips + humanPlayer.currentBet)}
        className="px-4 py-2 bg-red-800 hover:bg-red-700 rounded font-semibold text-sm ml-auto"
      >
        All-In {humanPlayer.chips}
      </button>
    </div>
  );
}
