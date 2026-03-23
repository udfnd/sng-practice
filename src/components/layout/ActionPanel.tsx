import { useState, useEffect, useCallback } from 'react';
import { useGameStore } from '@/store/game-store';
import { formatAmount, bbToChips, chipsToBB } from '@/utils/format-chips';

// Custom slider styles injected once per page
const SLIDER_STYLE_ID = 'action-panel-slider-styles';
function ensureSliderStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(SLIDER_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = SLIDER_STYLE_ID;
  style.textContent = `
    .ap-slider {
      -webkit-appearance: none;
      appearance: none;
      width: 100%;
      height: 44px;
      background: transparent;
      cursor: pointer;
      outline: none;
    }
    @media (max-width: 640px) {
      .ap-slider { height: 48px; }
    }
    .ap-slider::-webkit-slider-runnable-track {
      height: 6px;
      border-radius: 3px;
      background: #334155;
    }
    .ap-slider::-moz-range-track {
      height: 6px;
      border-radius: 3px;
      background: #334155;
    }
    .ap-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #eab308;
      cursor: pointer;
      margin-top: -7px;
      box-shadow: 0 0 0 3px rgba(234,179,8,0.22);
      transition: box-shadow 0.15s ease;
    }
    .ap-slider::-moz-range-thumb {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #eab308;
      cursor: pointer;
      border: none;
      box-shadow: 0 0 0 3px rgba(234,179,8,0.22);
    }
    .ap-slider:focus::-webkit-slider-thumb {
      box-shadow: 0 0 0 4px rgba(234,179,8,0.4);
    }
    .ap-slider:focus::-moz-range-thumb {
      box-shadow: 0 0 0 4px rgba(234,179,8,0.4);
    }
  `;
  document.head.appendChild(style);
}

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

  // Inject slider styles on first render
  useEffect(() => { ensureSliderStyles(); }, []);

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

  // Shared button base styles — 48px min height for touch targets (WCAG 2.5.5)
  const btnStyle: React.CSSProperties = {
    height: '48px',
    minWidth: '88px',
    padding: '0 18px',
    borderRadius: '8px',
    fontWeight: 700,
    fontSize: '14px',
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

  // Pill-shaped preset buttons
  const presetBtnStyle: React.CSSProperties = {
    height: '28px',
    padding: '0 12px',
    borderRadius: '14px',
    fontSize: '11px',
    fontWeight: 600,
    cursor: 'pointer',
    border: '1px solid #334155',
    background: '#1c2230',
    color: '#94a3b8',
    transition: 'background 0.1s ease, color 0.1s ease',
    whiteSpace: 'nowrap',
  };

  return (
    <div
      className="action-panel-safe"
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
        boxSizing: 'border-box',
      }}
    >
      {/* Main action buttons row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {canFold && (
          <button
            onClick={() => { submitAction('FOLD', 0); setAllInConfirm(false); }}
            style={{ ...btnStyle, background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: '#fff' }}
            onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(1.12)')}
            onMouseLeave={(e) => (e.currentTarget.style.filter = '')}
            aria-label="Fold hand"
            title="Fold (F)"
            tabIndex={0}
          >
            Fold {keyHint('F')}
          </button>
        )}

        {canCheck && (
          <button
            onClick={() => { submitAction('CHECK', 0); setAllInConfirm(false); }}
            style={{ ...btnStyle, background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff' }}
            onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(1.12)')}
            onMouseLeave={(e) => (e.currentTarget.style.filter = '')}
            aria-label="Check"
            title="Check/Call (C)"
            tabIndex={0}
          >
            Check {keyHint('C')}
          </button>
        )}

        {canCall && (
          <button
            onClick={() => { submitAction('CALL', callAmount); setAllInConfirm(false); }}
            style={{ ...btnStyle, background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff' }}
            onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(1.12)')}
            onMouseLeave={(e) => (e.currentTarget.style.filter = '')}
            aria-label={`Call ${formatAmount(callAmount, bb, displayMode)} chips`}
            title="Check/Call (C)"
            tabIndex={0}
          >
            Call {formatAmount(callAmount, bb, displayMode)} {keyHint('C')}
          </button>
        )}

        {canBetOrRaise && (
          <button
            onClick={() => handleBetOrRaise(currentRaiseAmt)}
            style={{ ...btnStyle, background: 'linear-gradient(135deg, #eab308, #ca8a04)', color: '#0f172a' }}
            onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(1.1)')}
            onMouseLeave={(e) => (e.currentTarget.style.filter = '')}
            aria-label={`${canRaise ? 'Raise to' : 'Bet'} ${formatAmount(currentRaiseAmt, bb, displayMode)} chips`}
            title="Raise (R)"
            tabIndex={0}
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
              ? 'linear-gradient(135deg, #b91c1c, #991b1b)'
              : 'linear-gradient(135deg, #7f1d1d, #5a1414)',
            color: '#fff',
            border: allInConfirm ? '1.5px solid #ef4444' : '1px solid rgba(239,68,68,0.3)',
            boxShadow: allInConfirm ? '0 0 14px rgba(239,68,68,0.5)' : 'none',
            opacity: (!canBetOrRaise && !canCall) ? 0.38 : 1,
          }}
          onMouseEnter={(e) => { if (!(!canBetOrRaise && !canCall)) e.currentTarget.style.filter = 'brightness(1.15)'; }}
          onMouseLeave={(e) => (e.currentTarget.style.filter = '')}
          aria-label={`Go all-in with ${formatAmount(humanPlayer.chips, bb, displayMode)} chips`}
          title="All-in (A)"
          tabIndex={0}
        >
          {allInConfirm ? 'Confirm All-In?' : `All-In ${formatAmount(humanPlayer.chips, bb, displayMode)}`}
          {!allInConfirm && keyHint('A')}
        </button>
      </div>

      {/* Bet/Raise slider row */}
      {canBetOrRaise && effectiveMax > effectiveMin && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input
              type="range"
              className="ap-slider"
              min={sliderMin}
              max={sliderMax}
              step={sliderStep}
              value={sliderValue}
              onChange={handleSliderChange}
              style={{ flex: 1 }}
              aria-label="Bet amount"
              aria-valuemin={sliderMin}
              aria-valuemax={sliderMax}
              aria-valuenow={sliderValue}
              aria-valuetext={`Bet ${formatAmount(currentRaiseAmt, bb, displayMode)} chips`}
              tabIndex={0}
            />
            <span
              style={{
                fontSize: '16px',
                fontWeight: 700,
                color: '#eab308',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontVariantNumeric: 'tabular-nums',
                minWidth: '80px',
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
                      aria-label={`Set bet to ${label}`}
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
                      aria-label="Bet half pot"
                    >
                      1/2
                    </button>
                    <button
                      onClick={() => setRaiseAmount(clampChips(Math.floor((pot * 3) / 4)))}
                      style={presetBtnStyle}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#21262d')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '#1c2230')}
                      aria-label="Bet three-quarter pot"
                    >
                      3/4
                    </button>
                    <button
                      onClick={() => setRaiseAmount(clampChips(pot))}
                      style={presetBtnStyle}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#21262d')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '#1c2230')}
                      aria-label="Bet full pot"
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
                    aria-label="Bet half pot"
                  >
                    1/2
                  </button>
                  <button
                    onClick={() => setRaiseAmount(clampChips(Math.floor((pot * 3) / 4)))}
                    style={presetBtnStyle}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#21262d')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '#1c2230')}
                    aria-label="Bet three-quarter pot"
                  >
                    3/4
                  </button>
                  <button
                    onClick={() => setRaiseAmount(clampChips(pot))}
                    style={presetBtnStyle}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#21262d')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '#1c2230')}
                    aria-label="Bet full pot"
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
