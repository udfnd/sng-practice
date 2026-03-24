import { useState, useEffect, useCallback, useRef } from 'react';
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
      background: rgba(255,255,255,0.1);
    }
    .ap-slider::-moz-range-track {
      height: 6px;
      border-radius: 3px;
      background: rgba(255,255,255,0.1);
    }
    .ap-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: #eab308;
      cursor: pointer;
      margin-top: -8px;
      box-shadow: 0 0 0 3px rgba(234,179,8,0.2), 0 2px 8px rgba(0,0,0,0.3);
      transition: box-shadow 0.15s ease;
    }
    .ap-slider::-moz-range-thumb {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: #eab308;
      cursor: pointer;
      border: none;
      box-shadow: 0 0 0 3px rgba(234,179,8,0.2), 0 2px 8px rgba(0,0,0,0.3);
    }
    .ap-slider:focus::-webkit-slider-thumb {
      box-shadow: 0 0 0 4px rgba(234,179,8,0.4), 0 2px 8px rgba(0,0,0,0.3);
    }
    .ap-slider:focus::-moz-range-thumb {
      box-shadow: 0 0 0 4px rgba(234,179,8,0.4), 0 2px 8px rgba(0,0,0,0.3);
    }
    .ap-bet-input {
      width: 72px;
      height: 34px;
      padding: 0 10px;
      border-radius: var(--radius-md);
      border: 1px solid rgba(234,179,8,0.3);
      background: rgba(234,179,8,0.08);
      color: #eab308;
      font-size: 15px;
      font-weight: 700;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-variant-numeric: tabular-nums;
      text-align: center;
      outline: none;
      transition: border-color 0.15s;
    }
    .ap-bet-input:focus {
      border-color: rgba(234,179,8,0.6);
      box-shadow: 0 0 0 2px rgba(234,179,8,0.15);
    }
    .ap-bet-input::-webkit-inner-spin-button,
    .ap-bet-input::-webkit-outer-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
    .ap-bet-input[type=number] {
      -moz-appearance: textfield;
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
  // Bet input uses a separate string state so the user can freely type/delete digits.
  // The string is synced TO raiseAmount on blur/Enter, and FROM raiseAmount when not editing.
  const [betInputText, setBetInputText] = useState('');
  const [isEditingBetInput, setIsEditingBetInput] = useState(false);
  const betInputRef = useRef<HTMLInputElement>(null);

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

  // Reset raise amount when turn starts
  useEffect(() => {
    if (isHumanTurn) setRaiseAmount(effectiveMin);
  }, [isHumanTurn, effectiveMin]);

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

  // Sync betInputText FROM raiseAmount whenever raiseAmount changes and user is NOT editing.
  const isBBMode = displayMode === 'bb';
  useEffect(() => {
    if (isEditingBetInput) return;
    const display = isBBMode ? chipsToBB(currentRaiseAmt, bb) : currentRaiseAmt;
    setBetInputText(String(display));
  }, [currentRaiseAmt, isBBMode, bb, isEditingBetInput]);

  if (!isPlaying) return <div className="h-full" />;

  if (!isHumanTurn || !humanPlayer || !gameState) {
    return (
      <div
        className="flex items-center justify-center h-full glass-panel-heavy"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
      >
        <span style={{ color: '#6e7681', fontSize: '13px' }}>Waiting for action...</span>
      </div>
    );
  }

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

  const handleBetInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Allow free typing — no validation or clamping during editing
    setBetInputText(e.target.value);
  };

  const commitBetInput = () => {
    setIsEditingBetInput(false);
    const raw = parseFloat(betInputText);
    if (isNaN(raw) || raw <= 0) {
      // Invalid input — revert to current raise amount
      const display = isBBMode ? chipsToBB(currentRaiseAmt, bb) : currentRaiseAmt;
      setBetInputText(String(display));
      return;
    }
    const chips = isBBMode ? bbToChips(raw, bb) : raw;
    const clamped = clampChips(chips);
    setRaiseAmount(clamped);
    // Sync text to the final clamped value
    const display = isBBMode ? chipsToBB(clamped, bb) : clamped;
    setBetInputText(String(display));
  };

  const handleBetInputFocus = () => {
    setIsEditingBetInput(true);
    // Select all text for easy replacement
    setTimeout(() => betInputRef.current?.select(), 0);
  };

  const handleBetInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      commitBetInput();
      betInputRef.current?.blur();
    }
    // Allow Escape to cancel editing
    if (e.key === 'Escape') {
      setIsEditingBetInput(false);
      const display = isBBMode ? chipsToBB(currentRaiseAmt, bb) : currentRaiseAmt;
      setBetInputText(String(display));
      betInputRef.current?.blur();
    }
  };

  const bbPresets: { label: string; bb: number }[] = [
    { label: '2 BB', bb: 2 },
    { label: '2.5 BB', bb: 2.5 },
    { label: '3 BB', bb: 3 },
  ];

  // Glass button base styles — responsive sizes
  const btnStyle: React.CSSProperties = {
    height: '44px',
    minWidth: '64px',
    padding: '0 12px',
    borderRadius: 'var(--radius-md)',
    fontWeight: 700,
    fontSize: '13px',
    cursor: 'pointer',
    border: '1px solid rgba(255,255,255,0.1)',
    transition: 'filter 0.1s ease, transform 0.1s ease, box-shadow 0.15s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    whiteSpace: 'nowrap',
    flexShrink: 1,
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
  };

  // Preset buttons
  const presetBtnStyle: React.CSSProperties = {
    height: '30px',
    padding: '0 14px',
    borderRadius: 'var(--radius-full)',
    fontSize: '11px',
    fontWeight: 600,
    cursor: 'pointer',
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.05)',
    color: '#94a3b8',
    transition: 'background 0.15s ease, color 0.15s ease, border-color 0.15s ease',
    whiteSpace: 'nowrap',
  };

  const renderPresetButtons = () => {
    const buttons: React.ReactNode[] = [];

    if (isBBMode) {
      for (const { label, bb: bbAmt } of bbPresets) {
        const chips = bbToChips(bbAmt, bb);
        if (chips < effectiveMin || chips > effectiveMax) continue;
        buttons.push(
          <button
            key={label}
            onClick={() => setRaiseAmount(clampChips(chips))}
            style={presetBtnStyle}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
            aria-label={`Set bet to ${label}`}
          >
            {label}
          </button>
        );
      }
    }

    if (pot > 0) {
      const potPresets = [
        { label: '1/2', mult: 0.5 },
        { label: '3/4', mult: 0.75 },
        { label: 'Pot', mult: 1 },
      ];
      for (const { label, mult } of potPresets) {
        buttons.push(
          <button
            key={label}
            onClick={() => setRaiseAmount(clampChips(Math.floor(pot * mult)))}
            style={presetBtnStyle}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
            aria-label={`Bet ${label} pot`}
          >
            {label}
          </button>
        );
      }
    }

    return buttons;
  };

  return (
    <div
      className="action-panel-safe glass-panel-heavy"
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: '8px',
        padding: '6px 8px 6px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.3)',
        boxSizing: 'border-box',
      }}
    >
      {/* Main action buttons row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {canFold && (
          <button
            onClick={() => { submitAction('FOLD', 0); setAllInConfirm(false); }}
            style={{ ...btnStyle, background: 'rgba(239,68,68,0.2)', color: '#f87171', borderColor: 'rgba(239,68,68,0.3)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.3)'; e.currentTarget.style.boxShadow = '0 0 12px rgba(239,68,68,0.2)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.2)'; e.currentTarget.style.boxShadow = ''; }}
            aria-label="Fold hand"
            title="Fold (F)"
          >
            Fold          </button>
        )}

        {canCheck && (
          <button
            onClick={() => { submitAction('CHECK', 0); setAllInConfirm(false); }}
            style={{ ...btnStyle, background: 'rgba(34,197,94,0.2)', color: '#4ade80', borderColor: 'rgba(34,197,94,0.3)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(34,197,94,0.3)'; e.currentTarget.style.boxShadow = '0 0 12px rgba(34,197,94,0.2)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(34,197,94,0.2)'; e.currentTarget.style.boxShadow = ''; }}
            aria-label="Check"
            title="Check/Call (C)"
          >
            Check          </button>
        )}

        {canCall && (
          <button
            onClick={() => { submitAction('CALL', callAmount); setAllInConfirm(false); }}
            style={{ ...btnStyle, background: 'rgba(59,130,246,0.2)', color: '#60a5fa', borderColor: 'rgba(59,130,246,0.3)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(59,130,246,0.3)'; e.currentTarget.style.boxShadow = '0 0 12px rgba(59,130,246,0.2)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(59,130,246,0.2)'; e.currentTarget.style.boxShadow = ''; }}
            aria-label={`Call ${formatAmount(callAmount, bb, displayMode)} chips`}
            title="Check/Call (C)"
          >
            Call {formatAmount(callAmount, bb, displayMode)}          </button>
        )}

        {canBetOrRaise && (
          <button
            onClick={() => handleBetOrRaise(currentRaiseAmt)}
            style={{ ...btnStyle, background: 'rgba(234,179,8,0.2)', color: '#fbbf24', borderColor: 'rgba(234,179,8,0.3)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(234,179,8,0.3)'; e.currentTarget.style.boxShadow = '0 0 12px rgba(234,179,8,0.2)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(234,179,8,0.2)'; e.currentTarget.style.boxShadow = ''; }}
            aria-label={`${canRaise ? 'Raise to' : 'Bet'} ${formatAmount(currentRaiseAmt, bb, displayMode)} chips`}
            title="Raise (R)"
          >
            {canRaise ? 'Raise' : 'Bet'} {formatAmount(currentRaiseAmt, bb, displayMode)}          </button>
        )}

        {/* All-in button */}
        <button
          onClick={handleAllIn}
          disabled={!canBetOrRaise && !canCall}
          style={{
            ...btnStyle,
            marginLeft: 'auto',
            background: allInConfirm ? 'rgba(185,28,28,0.4)' : 'rgba(127,29,29,0.3)',
            color: allInConfirm ? '#fca5a5' : '#f87171',
            borderColor: allInConfirm ? 'rgba(239,68,68,0.5)' : 'rgba(239,68,68,0.2)',
            boxShadow: allInConfirm ? '0 0 16px rgba(239,68,68,0.3)' : 'none',
            opacity: (!canBetOrRaise && !canCall) ? 0.35 : 1,
          }}
          onMouseEnter={(e) => { if (canBetOrRaise || canCall) { e.currentTarget.style.background = 'rgba(185,28,28,0.4)'; e.currentTarget.style.boxShadow = '0 0 12px rgba(239,68,68,0.2)'; } }}
          onMouseLeave={(e) => { e.currentTarget.style.background = allInConfirm ? 'rgba(185,28,28,0.4)' : 'rgba(127,29,29,0.3)'; if (!allInConfirm) e.currentTarget.style.boxShadow = ''; }}
          aria-label={`Go all-in with ${formatAmount(humanPlayer.chips, bb, displayMode)} chips`}
          title="All-in (A)"
        >
          {allInConfirm ? 'Confirm All-In?' : `All-In ${formatAmount(humanPlayer.chips, bb, displayMode)}`}
        </button>
      </div>

      {/* Bet/Raise slider + input row */}
      {canBetOrRaise && effectiveMax > effectiveMin && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
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
            />
            {/* Direct input for custom bet sizing */}
            <input
              ref={betInputRef}
              type="text"
              inputMode="decimal"
              className="ap-bet-input"
              value={betInputText}
              onChange={handleBetInputChange}
              onFocus={handleBetInputFocus}
              onBlur={commitBetInput}
              onKeyDown={handleBetInputKeyDown}
              aria-label="Custom bet amount"
            />
          </div>

          {/* Preset buttons */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {renderPresetButtons()}
          </div>
        </div>
      )}
    </div>
  );
}
