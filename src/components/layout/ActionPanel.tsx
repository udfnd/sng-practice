import { useState, useEffect, useCallback } from 'react';
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

  const [raiseAmount, setRaiseAmount] = useState(0);
  const [allInConfirm, setAllInConfirm] = useState(false);

  const canFold = validActions.includes('FOLD');
  const canCheck = validActions.includes('CHECK');
  const canCall = validActions.includes('CALL');
  const canBet = validActions.includes('BET');
  const canRaise = validActions.includes('RAISE');
  const canBetOrRaise = canBet || canRaise;

  const bb = gameState?.blindLevel.bb ?? 20;
  const totalChips = humanPlayer ? humanPlayer.chips + humanPlayer.currentBet : 0;
  const effectiveMin = minRaise || bb;
  const effectiveMax = totalChips || bb;
  const currentRaiseAmt = raiseAmount || effectiveMin;
  const pot = gameState
    ? gameState.mainPot + gameState.sidePots.reduce((s, sp) => s + sp.amount, 0)
    : 0;

  const handleBetOrRaise = useCallback((amount: number) => {
    const actionType = canRaise ? 'RAISE' : 'BET';
    submitAction(actionType, amount);
    setAllInConfirm(false);
  }, [canRaise, submitAction]);

  const handleAllIn = useCallback(() => {
    if (allInConfirm) {
      // If raise/bet is available use RAISE; otherwise this is a call all-in
      if (canBetOrRaise) {
        submitAction('RAISE', totalChips);
      } else {
        // canCall only — submit a CALL with the player's full stack (all-in call)
        submitAction('CALL', callAmount);
      }
      setAllInConfirm(false);
    } else {
      setAllInConfirm(true);
      setTimeout(() => setAllInConfirm(false), 3000);
    }
  }, [allInConfirm, canBetOrRaise, submitAction, totalChips, callAmount]);

  // Keyboard shortcuts — must be called on EVERY render (no conditional)
  useEffect(() => {
    if (!isHumanTurn) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      switch (e.key.toUpperCase()) {
        case 'F':
          if (canFold) submitAction('FOLD', 0);
          break;
        case 'C':
          if (canCheck) submitAction('CHECK', 0);
          else if (canCall) submitAction('CALL', callAmount);
          break;
        case 'R':
          if (canBetOrRaise) handleBetOrRaise(currentRaiseAmt);
          break;
        case 'A':
          if (canBetOrRaise || canCall) handleAllIn();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isHumanTurn, canFold, canCheck, canCall, canBetOrRaise, currentRaiseAmt, callAmount, allInConfirm, submitAction, handleBetOrRaise, handleAllIn]);

  // Early returns AFTER all hooks
  if (!isPlaying) return null;

  if (!isHumanTurn || !humanPlayer || !gameState) {
    return (
      <div
        className="flex items-center justify-center py-4 text-sm h-16 safe-bottom"
        style={{ color: '#64748b' }}
      >
        Waiting for action...
      </div>
    );
  }

  const isBBMode = displayMode === 'bb';
  const sliderMin = isBBMode ? chipsToBB(effectiveMin, bb) : effectiveMin;
  const sliderMax = isBBMode ? chipsToBB(effectiveMax, bb) : effectiveMax;
  const sliderStep = isBBMode ? 0.5 : bb;
  const sliderValue = isBBMode ? chipsToBB(currentRaiseAmt, bb) : currentRaiseAmt;

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setRaiseAmount(isBBMode ? bbToChips(val, bb) : val);
  };

  const clampChips = (chips: number) =>
    Math.min(Math.max(chips, effectiveMin), effectiveMax);

  const bbPresets: { label: string; bb: number }[] = [
    { label: '2 BB', bb: 2 },
    { label: '2.5 BB', bb: 2.5 },
    { label: '3 BB', bb: 3 },
  ];

  const btnBase =
    'min-h-14 px-4 py-2 rounded-lg font-bold text-sm transition-all duration-150 active:scale-95 select-none touch-manipulation focus:outline-none focus:ring-2 focus:ring-offset-1';
  const presetBtnClass =
    'min-h-10 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 active:scale-95 touch-manipulation focus:outline-none';

  return (
    <div
      className="flex flex-col gap-2 py-3 px-4 rounded-xl mx-2 sm:mx-4 mb-2 sm:mb-4 safe-bottom"
      style={{
        background: 'linear-gradient(180deg, #1a2130 0%, #141b24 100%)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 -4px 16px rgba(0,0,0,0.3)',
      }}
    >
      {/* Main action buttons */}
      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
        {canFold && (
          <button
            onClick={() => { submitAction('FOLD', 0); setAllInConfirm(false); }}
            className={`${btnBase} flex-1 sm:flex-none focus:ring-red-500`}
            style={{
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              color: '#fff',
              boxShadow: '0 2px 8px rgba(239,68,68,0.3)',
            }}
            aria-label="Fold hand (F)"
          >
            Fold <span className="text-xs opacity-50 font-normal ml-1">[F]</span>
          </button>
        )}

        {canCheck && (
          <button
            onClick={() => { submitAction('CHECK', 0); setAllInConfirm(false); }}
            className={`${btnBase} flex-1 sm:flex-none focus:ring-green-500`}
            style={{
              background: 'linear-gradient(135deg, #22c55e, #16a34a)',
              color: '#fff',
              boxShadow: '0 2px 8px rgba(34,197,94,0.3)',
            }}
            aria-label="Check (C)"
          >
            Check <span className="text-xs opacity-50 font-normal ml-1">[C]</span>
          </button>
        )}

        {canCall && (
          <button
            onClick={() => { submitAction('CALL', callAmount); setAllInConfirm(false); }}
            className={`${btnBase} flex-1 sm:flex-none focus:ring-blue-500`}
            style={{
              background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
              color: '#fff',
              boxShadow: '0 2px 8px rgba(59,130,246,0.3)',
            }}
            aria-label={`Call ${formatAmount(callAmount, bb, displayMode)} (C)`}
          >
            Call {formatAmount(callAmount, bb, displayMode)}
            <span className="text-xs opacity-50 font-normal ml-1">[C]</span>
          </button>
        )}

        {canBetOrRaise && (
          <button
            onClick={() => handleBetOrRaise(currentRaiseAmt)}
            className={`${btnBase} flex-1 sm:flex-none focus:ring-yellow-500`}
            style={{
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              color: '#000',
              boxShadow: '0 2px 8px rgba(245,158,11,0.3)',
            }}
            aria-label={`${canRaise ? 'Raise' : 'Bet'} ${formatAmount(currentRaiseAmt, bb, displayMode)} (R)`}
          >
            {canRaise ? 'Raise' : 'Bet'} {formatAmount(currentRaiseAmt, bb, displayMode)}
            <span className="text-xs opacity-50 font-normal ml-1">[R]</span>
          </button>
        )}

        <button
          onClick={handleAllIn}
          className={`${btnBase} ml-auto disabled:opacity-40 disabled:cursor-not-allowed focus:ring-red-500`}
          style={{
            background: allInConfirm
              ? 'linear-gradient(135deg, #dc2626, #b91c1c)'
              : 'linear-gradient(135deg, #7f1d1d, #5b1111)',
            color: '#fff',
            border: allInConfirm ? '2px solid #ef4444' : '1px solid rgba(239,68,68,0.3)',
            boxShadow: allInConfirm ? '0 0 12px rgba(239,68,68,0.5)' : 'none',
          }}
          disabled={!canBetOrRaise && !canCall}
          aria-label={`All-in ${formatAmount(humanPlayer.chips, bb, displayMode)} (A)`}
        >
          {allInConfirm ? 'Confirm?' : `All-In ${formatAmount(humanPlayer.chips, bb, displayMode)}`}
          <span className="text-xs opacity-50 font-normal ml-1">[A]</span>
        </button>
      </div>

      {/* Bet/Raise slider and presets */}
      {canBetOrRaise && effectiveMax > effectiveMin && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={sliderMin}
              max={sliderMax}
              step={sliderStep}
              value={sliderValue}
              onChange={handleSliderChange}
              className="flex-1"
              style={{ height: '48px', cursor: 'pointer' }}
              aria-label="Bet amount slider"
            />
            <span
              className="text-sm w-20 text-right tabular-nums font-mono font-bold"
              style={{ color: '#f1f5f9' }}
            >
              {formatAmount(currentRaiseAmt, bb, displayMode)}
            </span>
          </div>

          <div className="flex gap-1.5 flex-wrap">
            {isBBMode ? (
              <>
                {bbPresets.map(({ label, bb: bbAmt }) => {
                  const chips = bbToChips(bbAmt, bb);
                  if (chips < effectiveMin || chips > effectiveMax) return null;
                  return (
                    <button
                      key={label}
                      onClick={() => setRaiseAmount(clampChips(chips))}
                      className={presetBtnClass}
                      style={{ background: '#1c2530', color: '#94a3b8', border: '1px solid rgba(100,116,139,0.3)' }}
                    >
                      {label}
                    </button>
                  );
                })}
                {pot > 0 && (
                  <>
                    <button
                      onClick={() => setRaiseAmount(clampChips(Math.floor(pot / 2)))}
                      className={presetBtnClass}
                      style={{ background: '#1c2530', color: '#94a3b8', border: '1px solid rgba(100,116,139,0.3)' }}
                    >
                      1/2
                    </button>
                    <button
                      onClick={() => setRaiseAmount(clampChips(pot))}
                      className={presetBtnClass}
                      style={{ background: '#1c2530', color: '#94a3b8', border: '1px solid rgba(100,116,139,0.3)' }}
                    >
                      Pot
                    </button>
                  </>
                )}
              </>
            ) : (
              pot > 0 && (
                <>
                  <button
                    onClick={() => setRaiseAmount(clampChips(Math.floor(pot / 2)))}
                    className={presetBtnClass}
                    style={{ background: '#1c2530', color: '#94a3b8', border: '1px solid rgba(100,116,139,0.3)' }}
                  >
                    1/2
                  </button>
                  <button
                    onClick={() => setRaiseAmount(clampChips(Math.floor((pot * 3) / 4)))}
                    className={presetBtnClass}
                    style={{ background: '#1c2530', color: '#94a3b8', border: '1px solid rgba(100,116,139,0.3)' }}
                  >
                    3/4
                  </button>
                  <button
                    onClick={() => setRaiseAmount(clampChips(pot))}
                    className={presetBtnClass}
                    style={{ background: '#1c2530', color: '#94a3b8', border: '1px solid rgba(100,116,139,0.3)' }}
                  >
                    Pot
                  </button>
                </>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
