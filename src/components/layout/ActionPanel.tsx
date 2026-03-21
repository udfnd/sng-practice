import { useState } from 'react';
import { useGameStore } from '@/store/game-store';
import { formatAmount, bbToChips, chipsToBB } from '@/utils/format-chips';

export function ActionPanel() {
  const isHumanTurn = useGameStore((s) => s.isHumanTurn);
  const validActions = useGameStore((s) => s.validActions);
  const minRaise = useGameStore((s) => s.minRaise);
  const callAmount = useGameStore((s) => s.callAmount);
  const submitAction = useGameStore((s) => s.submitAction);
  const isPlaying = useGameStore((s) => s.isPlaying);
  const humanPlayer = useGameStore((s) => s.gameState?.players.find((p) => p.isHuman));
  const gameState = useGameStore((s) => s.gameState);
  const displayMode = useGameStore((s) => s.displayMode);

  // raiseAmount is always stored in chips internally
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

  const bb = gameState.blindLevel.bb;

  // Total chips available for betting
  const totalChips = humanPlayer.chips + humanPlayer.currentBet;

  // Effective min/max for the slider (always in chips)
  const effectiveMin = minRaise || bb;
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

  // BB mode slider: step in 0.5 BB increments, range in BB units
  const isBBMode = displayMode === 'bb';

  // Slider props differ by mode
  const sliderMin = isBBMode ? chipsToBB(effectiveMin, bb) : effectiveMin;
  const sliderMax = isBBMode ? chipsToBB(effectiveMax, bb) : effectiveMax;
  const sliderStep = isBBMode ? 0.5 : bb;
  const sliderValue = isBBMode ? chipsToBB(currentRaiseAmt, bb) : currentRaiseAmt;

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    if (isBBMode) {
      // Convert BB back to chips
      setRaiseAmount(bbToChips(val, bb));
    } else {
      setRaiseAmount(val);
    }
  };

  // Helper: clamp a chip amount to slider range
  const clampChips = (chips: number) =>
    Math.min(Math.max(chips, effectiveMin), effectiveMax);

  // Preset BB sizes (in BB units) for BB mode
  const bbPresets: { label: string; bb: number }[] = [
    { label: '2 BB', bb: 2 },
    { label: '2.5 BB', bb: 2.5 },
    { label: '3 BB', bb: 3 },
  ];

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
            Call {formatAmount(callAmount, bb, displayMode)}
          </button>
        )}

        {canBetOrRaise && (
          <button
            onClick={() => handleBetOrRaise(currentRaiseAmt)}
            className={`${btnBase} bg-yellow-700 hover:bg-yellow-600 flex-1 sm:flex-none`}
          >
            {canRaise ? 'Raise' : 'Bet'} {formatAmount(currentRaiseAmt, bb, displayMode)}
          </button>
        )}

        <button
          onClick={() => submitAction('RAISE', totalChips)}
          className={`${btnBase} bg-red-800 hover:bg-red-700 ml-auto disabled:opacity-40 disabled:cursor-not-allowed`}
          disabled={!canBetOrRaise && !canCall}
        >
          All-In {formatAmount(humanPlayer.chips, bb, displayMode)}
        </button>
      </div>

      {/* Bet/Raise slider and presets */}
      {canBetOrRaise && effectiveMax > effectiveMin && (
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={sliderMin}
            max={sliderMax}
            step={sliderStep}
            value={sliderValue}
            onChange={handleSliderChange}
            className="flex-1 h-2"
          />
          <span className="text-xs text-gray-400 w-16 text-right tabular-nums">
            {formatAmount(currentRaiseAmt, bb, displayMode)}
          </span>

          {/* Preset buttons */}
          {isBBMode ? (
            // BB mode: show fixed BB size presets + pot-based presets
            <div className="flex gap-1 flex-wrap">
              {bbPresets.map(({ label, bb: bbAmt }) => {
                const chips = bbToChips(bbAmt, bb);
                if (chips < effectiveMin || chips > effectiveMax) return null;
                return (
                  <button
                    key={label}
                    onClick={() => setRaiseAmount(clampChips(chips))}
                    className="min-h-8 px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-all duration-150 active:scale-95 touch-manipulation whitespace-nowrap"
                  >
                    {label}
                  </button>
                );
              })}
              {pot > 0 && (
                <>
                  <button
                    onClick={() => setRaiseAmount(clampChips(Math.floor(pot / 2)))}
                    className="min-h-8 px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-all duration-150 active:scale-95 touch-manipulation"
                  >
                    1/2
                  </button>
                  <button
                    onClick={() => setRaiseAmount(clampChips(pot))}
                    className="min-h-8 px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-all duration-150 active:scale-95 touch-manipulation"
                  >
                    Pot
                  </button>
                </>
              )}
            </div>
          ) : (
            // Chips mode: keep existing pot-based presets
            pot > 0 && (
              <div className="flex gap-1">
                <button
                  onClick={() =>
                    setRaiseAmount(
                      clampChips(Math.floor(pot / 2))
                    )
                  }
                  className="min-h-8 px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-all duration-150 active:scale-95 touch-manipulation"
                >
                  1/2
                </button>
                <button
                  onClick={() =>
                    setRaiseAmount(
                      clampChips(Math.floor((pot * 3) / 4))
                    )
                  }
                  className="min-h-8 px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-all duration-150 active:scale-95 touch-manipulation"
                >
                  3/4
                </button>
                <button
                  onClick={() =>
                    setRaiseAmount(clampChips(pot))
                  }
                  className="min-h-8 px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-all duration-150 active:scale-95 touch-manipulation"
                >
                  Pot
                </button>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
