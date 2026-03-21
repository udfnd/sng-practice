import { useState } from 'react';
import { useGameStore } from '@/store/game-store';

export function ActionPanel() {
  const isHumanTurn = useGameStore((s) => s.isHumanTurn);
  const validActions = useGameStore((s) => s.validActions);
  const minRaise = useGameStore((s) => s.minRaise);
  const callAmount = useGameStore((s) => s.callAmount);
  const submitAction = useGameStore((s) => s.submitAction);
  const isPlaying = useGameStore((s) => s.isPlaying);
  const humanPlayer = useGameStore((s) => s.gameState?.players.find((p) => p.isHuman));
  const gameState = useGameStore((s) => s.gameState);

  const [raiseAmount, setRaiseAmount] = useState(0);

  if (!isPlaying) {
    return null;
  }

  if (!isHumanTurn || !humanPlayer || !gameState) {
    return (
      <div className="flex items-center justify-center py-4 text-gray-500 text-sm h-16 safe-bottom">
        Waiting for action...
      </div>
    );
  }

  const canFold = validActions.includes('FOLD');
  const canCheck = validActions.includes('CHECK');
  const canCall = validActions.includes('CALL');
  const canBet = validActions.includes('BET');
  const canRaise = validActions.includes('RAISE');
  const canBetOrRaise = canBet || canRaise;

  // Total chips available for betting
  const totalChips = humanPlayer.chips + humanPlayer.currentBet;

  // Effective min/max for the slider
  const effectiveMin = minRaise || gameState.blindLevel.bb;
  const effectiveMax = totalChips;
  const currentRaiseAmt = raiseAmount || effectiveMin;

  // Pot size for preset buttons
  const pot = gameState.mainPot + gameState.sidePots.reduce((s, sp) => s + sp.amount, 0);

  const handleBetOrRaise = (amount: number) => {
    const actionType = canRaise ? 'RAISE' : 'BET';
    submitAction(actionType, amount);
  };

  const btnBase =
    'min-h-12 px-4 py-2 rounded font-semibold text-sm transition-all duration-150 active:scale-95 select-none touch-manipulation';

  return (
    <div className="flex flex-col gap-2 py-3 px-4 bg-gray-800 rounded-lg mx-2 sm:mx-4 mb-2 sm:mb-4 safe-bottom">
      {/* Main action buttons */}
      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
        {canFold && (
          <button
            onClick={() => submitAction('FOLD', 0)}
            className={`${btnBase} bg-red-700 hover:bg-red-600 flex-1 sm:flex-none`}
          >
            Fold
          </button>
        )}

        {canCheck && (
          <button
            onClick={() => submitAction('CHECK', 0)}
            className={`${btnBase} bg-blue-700 hover:bg-blue-600 flex-1 sm:flex-none`}
          >
            Check
          </button>
        )}

        {canCall && (
          <button
            onClick={() => submitAction('CALL', callAmount)}
            className={`${btnBase} bg-green-700 hover:bg-green-600 flex-1 sm:flex-none`}
          >
            Call {callAmount}
          </button>
        )}

        {canBetOrRaise && (
          <button
            onClick={() => handleBetOrRaise(currentRaiseAmt)}
            className={`${btnBase} bg-yellow-700 hover:bg-yellow-600 flex-1 sm:flex-none`}
          >
            {canRaise ? 'Raise' : 'Bet'} {currentRaiseAmt}
          </button>
        )}

        <button
          onClick={() => submitAction('RAISE', totalChips)}
          className={`${btnBase} bg-red-800 hover:bg-red-700 ml-auto disabled:opacity-40 disabled:cursor-not-allowed`}
          disabled={!canBetOrRaise && !canCall}
        >
          All-In {humanPlayer.chips}
        </button>
      </div>

      {/* Bet/Raise slider and presets */}
      {canBetOrRaise && effectiveMax > effectiveMin && (
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={effectiveMin}
            max={effectiveMax}
            step={gameState.blindLevel.bb}
            value={currentRaiseAmt}
            onChange={(e) => setRaiseAmount(Number(e.target.value))}
            className="flex-1 h-2"
          />
          <span className="text-xs text-gray-400 w-14 text-right tabular-nums">
            {currentRaiseAmt}
          </span>

          {/* Preset buttons — 3 cols on mobile, inline on desktop */}
          {pot > 0 && (
            <div className="flex gap-1">
              <button
                onClick={() =>
                  setRaiseAmount(
                    Math.min(Math.max(Math.floor(pot / 2), effectiveMin), effectiveMax)
                  )
                }
                className="min-h-8 px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-all duration-150 active:scale-95 touch-manipulation"
              >
                1/2
              </button>
              <button
                onClick={() =>
                  setRaiseAmount(
                    Math.min(
                      Math.max(Math.floor((pot * 3) / 4), effectiveMin),
                      effectiveMax
                    )
                  )
                }
                className="min-h-8 px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-all duration-150 active:scale-95 touch-manipulation"
              >
                3/4
              </button>
              <button
                onClick={() =>
                  setRaiseAmount(Math.min(Math.max(pot, effectiveMin), effectiveMax))
                }
                className="min-h-8 px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-all duration-150 active:scale-95 touch-manipulation"
              >
                Pot
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
