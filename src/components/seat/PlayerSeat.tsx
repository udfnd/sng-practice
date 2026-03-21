import React, { memo } from 'react';
import type { Player } from '@/types';
import { PlayingCard } from '@/components/card/PlayingCard';
import { useGameStore } from '@/store/game-store';
import { formatAmount } from '@/utils/format-chips';

interface PlayerSeatProps {
  player: Player;
  isButton: boolean;
}

export const PlayerSeat = memo(function PlayerSeat({
  player,
  isButton,
}: PlayerSeatProps) {
  const thinkingPlayerId = useGameStore((s) => s.thinkingPlayerId);
  const isHumanTurn = useGameStore((s) => s.isHumanTurn);
  const sbSeat = useGameStore((s) => s.gameState?.sbSeatIndex ?? -1);
  const bbSeat = useGameStore((s) => s.gameState?.bbSeatIndex ?? -1);
  const displayMode = useGameStore((s) => s.displayMode);
  const bb = useGameStore((s) => s.gameState?.blindLevel.bb ?? 1);
  const phase = useGameStore((s) => s.gameState?.phase);

  const isThinking = thinkingPlayerId === player.id;
  const isHumanActive = player.isHuman && isHumanTurn;

  const positionBadge = isButton
    ? 'BTN'
    : player.seatIndex === sbSeat
    ? 'SB'
    : player.seatIndex === bbSeat
    ? 'BB'
    : null;

  if (!player.isActive) {
    return (
      <div
        style={{
          width: '88px',
          height: '36px',
          borderRadius: '8px',
          background: '#0d1117',
          border: '1px solid #21262d',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0.25,
        }}
      >
        <span style={{ color: '#6e7681', fontSize: '11px' }}>Empty</span>
      </div>
    );
  }

  // Border & glow state
  let borderColor = '#30363d';
  let boxShadow = '0 2px 8px rgba(0,0,0,0.5)';
  let bgColor = '#161b22';

  if (player.isFolded) {
    bgColor = 'rgba(13,17,23,0.75)';
  } else if (player.isAllIn) {
    bgColor = 'rgba(127,29,29,0.45)';
    borderColor = '#ef4444';
    boxShadow = '0 0 0 2px rgba(239,68,68,0.25), 0 2px 8px rgba(0,0,0,0.5)';
  }

  if (isHumanActive) {
    borderColor = '#58a6ff';
    boxShadow = '0 0 0 3px rgba(88,166,255,0.3), 0 4px 12px rgba(0,0,0,0.5)';
  } else if (isThinking) {
    borderColor = '#fbbf24';
    boxShadow = '0 0 0 3px rgba(251,191,36,0.3), 0 4px 12px rgba(0,0,0,0.5)';
  }

  const animClass = isHumanActive
    ? 'active-player-glow'
    : isThinking
    ? 'active-player-glow-yellow'
    : '';

  const isShowdownPhase = phase === 'SHOWDOWN' || phase === 'HAND_COMPLETE';
  const isInHand = !player.isFolded;
  const showFaceUp = player.isHuman
    || (isShowdownPhase && isInHand)
    || (player.isAllIn && isInHand);

  const positionBadgeColor =
    positionBadge === 'BTN' ? '#d97706' :
    positionBadge === 'SB'  ? '#dc2626' :
    '#1d4ed8';

  const seatStyle: React.CSSProperties = {
    background: bgColor,
    border: `1.5px solid ${borderColor}`,
    borderRadius: '10px',
    padding: '5px 7px',
    position: 'relative',
    boxShadow,
    opacity: player.isFolded ? 0.42 : 1,
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease, opacity 0.2s ease',
    minWidth: '88px',
    maxWidth: '140px',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
      {/* Hole Cards */}
      {player.holeCards && (
        <div style={{ display: 'flex', gap: '2px', filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.65))' }}>
          <PlayingCard card={player.holeCards[0]} size="sm" faceDown={!showFaceUp} animate />
          <PlayingCard card={player.holeCards[1]} size="sm" faceDown={!showFaceUp} animate />
        </div>
      )}

      {/* Player Info Badge */}
      <div className={animClass} style={seatStyle}>
        {/* Position label pill */}
        {positionBadge && (
          <div
            style={{
              position: 'absolute',
              top: '-9px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: positionBadgeColor,
              color: '#fff',
              fontSize: '9px',
              fontWeight: 700,
              letterSpacing: '0.06em',
              padding: '1px 5px',
              borderRadius: '4px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
              whiteSpace: 'nowrap',
            }}
          >
            {positionBadge}
          </div>
        )}

        {/* Dealer button chip */}
        {isButton && (
          <div
            style={{
              position: 'absolute',
              top: '-9px',
              right: '-9px',
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #fcd34d, #d97706)',
              border: '1.5px solid #b45309',
              boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '9px',
              fontWeight: 700,
              color: '#000',
            }}
          >
            D
          </div>
        )}

        {/* Name row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', width: '100%' }}>
          <div
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              background: player.isHuman
                ? 'linear-gradient(135deg, #2563eb, #1d4ed8)'
                : 'linear-gradient(135deg, #374151, #1f2937)',
              color: '#fff',
              fontSize: '9px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {player.name.charAt(0).toUpperCase()}
          </div>
          <span
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: player.isHuman ? '#93c5fd' : '#e6edf3',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '68px',
            }}
          >
            {player.name}
          </span>
        </div>

        {/* Stack */}
        <span
          style={{
            fontSize: '13px',
            fontWeight: 700,
            color: '#fbbf24',
            fontVariantNumeric: 'tabular-nums',
            marginTop: '2px',
            display: 'block',
          }}
        >
          {formatAmount(player.chips, bb, displayMode)}
        </span>

        {/* Current bet badge */}
        {player.currentBet > 0 && (
          <div
            style={{
              marginTop: '2px',
              padding: '1px 7px',
              borderRadius: '99px',
              background: 'rgba(251,191,36,0.14)',
              border: '1px solid rgba(251,191,36,0.38)',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            <span
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: '#fbbf24',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {formatAmount(player.currentBet, bb, displayMode)}
            </span>
          </div>
        )}

        {/* Status badges — show at most one */}
        {player.isAllIn && (
          <span
            style={{
              marginTop: '2px',
              fontSize: '9px',
              fontWeight: 700,
              letterSpacing: '0.1em',
              padding: '1px 5px',
              borderRadius: '3px',
              background: 'rgba(239,68,68,0.18)',
              color: '#f87171',
              border: '1px solid rgba(239,68,68,0.35)',
              display: 'block',
              textAlign: 'center',
            }}
          >
            ALL IN
          </span>
        )}
        {!player.isAllIn && player.isFolded && (
          <span
            style={{
              marginTop: '2px',
              fontSize: '10px',
              color: '#6e7681',
              display: 'block',
              textAlign: 'center',
            }}
          >
            FOLDED
          </span>
        )}
        {!player.isAllIn && !player.isFolded && isThinking && (
          <span
            className="animate-pulse"
            style={{ marginTop: '2px', fontSize: '10px', color: '#fbbf24', display: 'block', textAlign: 'center' }}
          >
            thinking...
          </span>
        )}
        {!player.isAllIn && !player.isFolded && isHumanActive && (
          <span
            className="animate-pulse"
            style={{ marginTop: '2px', fontSize: '10px', fontWeight: 700, color: '#93c5fd', display: 'block', textAlign: 'center' }}
          >
            YOUR TURN
          </span>
        )}
      </div>
    </div>
  );
});
