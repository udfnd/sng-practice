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
      if (canRaise) {
        submitAction('RAISE', totalChips);
      } else if (canBet) {
        submitAction('BET', totalChips);
      } else {
        submitAction('CALL', callAmount);
      }
      setAllInConfirm(false);
    } else {
      setAllInConfirm(true);
      setTimeout(() => setAllInConfirm(false), 3000);
    }
  }, [allInConfirm, canRaise, canBet, submitAction, totalChips, callAmount]);

  useEffect(() => {
    if (!isHumanTurn) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      switch (e.key.toUpperCase()) {
        case 'F': if (canFold) submitAction('FOLD', 0); break;
        case 'C':
          if (canCheck) submitAction('CHECK', 0);
          else if (canCall) submitAction('CALL', callAmount);
          break;
        case 'R': if (canBetOrRaise) handleBetOrRaise(currentRaiseAmt); break;
        case 'A': if (canBetOrRaise || canCall) handleAllIn(); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isHumanTurn, canFold, canCheck, canCall, canBetOrRaise, currentRaiseAmt, callAmount, allInConfirm, submitAction, handleBetOrRaise, handleAllIn]);

  if (!isPlaying) return <div className="h-full" />;

  if (!isHumanTurn || !humanPlayer || !gameState) {
    return (
      <div
        className="flex items-center justify-center h-full"
        style={{
          background: 'linear-gradient(180deg, #161b22 0%, #0d1117 100%)',
          borderTop: '1px solid #30363d',
        }}
      >
        <span style={{ color: '#6e7681', fontSize: '13px' }}>Waiting for action...</span>
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

  // Shared button base styles
  const btnStyle: React.CSSProperties = {
    height: '44px',
    minWidth: '80px',
    padding: '0 16px',
    borderRadius: '8px',
    fontWeight: 700,
    fontSize: '13px',
    cursor: 'pointer',
    border: 'none',
    transition: 'filter 0.1s ease, transform 0.1s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  };

  const keyHint = (key: string) => (
    <span style={{ fontSize: '10px', opacity: 0.45, fontWeight: 400 }}>[{key}]</span>
  );

  const presetBtnStyle: React.CSSProperties = {
    height: '28px',
    padding: '0 10px',
    borderRadius: '5px',
    fontSize: '11px',
    fontWeight: 500,
    cursor: 'pointer',
    border: '1px solid #30363d',
    background: '#1c2230',
    color: '#8b949e',
    transition: 'background 0.1s ease',
    whiteSpace: 'nowrap',
  };

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: '8px',
        padding: '6px 16px 8px',
        background: 'linear-gradient(180deg, #161b22 0%, #0d1117 100%)',
        borderTop: '1px solid #30363d',
        boxShadow: '0 -4px 16px rgba(0,0,0,0.35)',
      }}
    >
      {/* Main action buttons row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {canFold && (
          <button
            onClick={() => { submitAction('FOLD', 0); setAllInConfirm(false); }}
            style={{ ...btnStyle, background: 'linear-gradient(135deg, #c0392b, #a93226)', color: '#fff' }}
            onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(1.12)')}
            onMouseLeave={(e) => (e.currentTarget.style.filter = '')}
            aria-label="Fold hand (F)"
          >
            Fold {keyHint('F')}
          </button>
        )}

        {canCheck && (
          <button
            onClick={() => { submitAction('CHECK', 0); setAllInConfirm(false); }}
            style={{ ...btnStyle, background: 'linear-gradient(135deg, #27ae60, #1e8449)', color: '#fff' }}
            onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(1.12)')}
            onMouseLeave={(e) => (e.currentTarget.style.filter = '')}
            aria-label="Check (C)"
          >
            Check {keyHint('C')}
          </button>
        )}

        {canCall && (
          <button
            onClick={() => { submitAction('CALL', callAmount); setAllInConfirm(false); }}
            style={{ ...btnStyle, background: 'linear-gradient(135deg, #2980b9, #2471a3)', color: '#fff' }}
            onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(1.12)')}
            onMouseLeave={(e) => (e.currentTarget.style.filter = '')}
            aria-label={`Call ${formatAmount(callAmount, bb, displayMode)} (C)`}
          >
            Call {formatAmount(callAmount, bb, displayMode)} {keyHint('C')}
          </button>
        )}

        {canBetOrRaise && (
          <button
            onClick={() => handleBetOrRaise(currentRaiseAmt)}
            style={{ ...btnStyle, background: 'linear-gradient(135deg, #e67e22, #ca6f1e)', color: '#fff' }}
            onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(1.12)')}
            onMouseLeave={(e) => (e.currentTarget.style.filter = '')}
            aria-label={`${canRaise ? 'Raise' : 'Bet'} ${formatAmount(currentRaiseAmt, bb, displayMode)} (R)`}
          >
            {canRaise ? 'Raise' : 'Bet'} {formatAmount(currentRaiseAmt, bb, displayMode)} {keyHint('R')}
          </button>
        )}

        {/* All-in — always last, right-aligned */}
        <button
          onClick={handleAllIn}
          disabled={!canBetOrRaise && !canCall}
          style={{
            ...btnStyle,
            marginLeft: 'auto',
            background: allInConfirm
              ? 'linear-gradient(135deg, #922b21, #7b241c)'
              : 'linear-gradient(135deg, #641e16, #4a1311)',
            color: '#fff',
            border: allInConfirm ? '1.5px solid #ef4444' : '1px solid rgba(239,68,68,0.25)',
            boxShadow: allInConfirm ? '0 0 12px rgba(239,68,68,0.45)' : 'none',
            opacity: (!canBetOrRaise && !canCall) ? 0.38 : 1,
          }}
          onMouseEnter={(e) => { if (!(!canBetOrRaise && !canCall)) e.currentTarget.style.filter = 'brightness(1.15)'; }}
          onMouseLeave={(e) => (e.currentTarget.style.filter = '')}
          aria-label={`All-in ${formatAmount(humanPlayer.chips, bb, displayMode)} (A)`}
        >
          {allInConfirm ? 'Confirm?' : `All-In ${formatAmount(humanPlayer.chips, bb, displayMode)}`}
          {!allInConfirm && keyHint('A')}
        </button>
      </div>

      {/* Bet/Raise slider row */}
      {canBetOrRaise && effectiveMax > effectiveMin && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input
              type="range"
              min={sliderMin}
              max={sliderMax}
              step={sliderStep}
              value={sliderValue}
              onChange={handleSliderChange}
              style={{ flex: 1, cursor: 'pointer' }}
              aria-label="Bet amount slider"
            />
            <span
              style={{
                fontSize: '13px',
                fontWeight: 700,
                color: '#e6edf3',
                fontVariantNumeric: 'tabular-nums',
                minWidth: '72px',
                textAlign: 'right',
              }}
            >
              {formatAmount(currentRaiseAmt, bb, displayMode)}
            </span>
          </div>

          {/* Preset buttons */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {isBBMode ? (
              <>
                {bbPresets.map(({ label, bb: bbAmt }) => {
                  const chips = bbToChips(bbAmt, bb);
                  if (chips < effectiveMin || chips > effectiveMax) return null;
                  return (
                    <button
                      key={label}
                      onClick={() => setRaiseAmount(clampChips(chips))}
                      style={presetBtnStyle}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#21262d')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '#1c2230')}
                    >
                      {label}
                    </button>
                  );
                })}
                {pot > 0 && (
                  <>
                    <button
                      onClick={() => setRaiseAmount(clampChips(Math.floor(pot / 2)))}
                      style={presetBtnStyle}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#21262d')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '#1c2230')}
                    >
                      1/2
                    </button>
                    <button
                      onClick={() => setRaiseAmount(clampChips(pot))}
                      style={presetBtnStyle}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#21262d')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '#1c2230')}
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
                    style={presetBtnStyle}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#21262d')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '#1c2230')}
                  >
                    1/2
                  </button>
                  <button
                    onClick={() => setRaiseAmount(clampChips(Math.floor((pot * 3) / 4)))}
                    style={presetBtnStyle}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#21262d')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '#1c2230')}
                  >
                    3/4
                  </button>
                  <button
                    onClick={() => setRaiseAmount(clampChips(pot))}
                    style={presetBtnStyle}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#21262d')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '#1c2230')}
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
