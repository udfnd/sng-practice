import React, { memo } from 'react';
import type { Player } from '@/types';
import { PlayingCard } from '@/components/card/PlayingCard';
import { useGameStore } from '@/store/game-store';
import { formatAmount } from '@/utils/format-chips';

interface PlayerSeatProps {
  player: Player;
  isButton: boolean;
  /** Whether this seat belongs to the human player */
  isHero?: boolean;
}

export const PlayerSeat = memo(function PlayerSeat({
  player,
  isButton,
  isHero = false,
}: PlayerSeatProps) {
  const thinkingPlayerId = useGameStore((s) => s.thinkingPlayerId);
  const isHumanTurn = useGameStore((s) => s.isHumanTurn);
  const sbSeat = useGameStore((s) => s.gameState?.sbSeatIndex ?? -1);
  const bbSeat = useGameStore((s) => s.gameState?.bbSeatIndex ?? -1);
  const displayMode = useGameStore((s) => s.displayMode);
  const bb = useGameStore((s) => s.gameState?.blindLevel.bb ?? 1);
  const phase = useGameStore((s) => s.gameState?.phase);
  const showdownWinners = useGameStore((s) => s.showdownWinners);
  const lastAction = useGameStore((s) => s.playerLastAction[player.id]);

  const isThinking = thinkingPlayerId === player.id;
  const isHumanActive = player.isHuman && isHumanTurn;
  const isPotWinner = showdownWinners.includes(player.id);

  const positionBadge = isButton
    ? 'BTN'
    : player.seatIndex === sbSeat
    ? 'SB'
    : player.seatIndex === bbSeat
    ? 'BB'
    : null;

  const badgeClass = isHero ? 'player-seat-badge-hero' : 'player-seat-badge';

  if (!player.isActive) {
    return (
      <div
        className={badgeClass}
        style={{
          minHeight: '36px',
          borderRadius: 'var(--radius-lg)',
          background: 'rgba(13,17,23,0.4)',
          border: '1px solid rgba(255,255,255,0.04)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0.2,
        }}
        aria-hidden="true"
      >
        <span style={{ color: '#6e7681', fontSize: '11px' }}>Empty</span>
      </div>
    );
  }

  // Border & glow state
  let borderColor = isHero ? 'rgba(30,64,175,0.6)' : 'rgba(255,255,255,0.08)';
  let boxShadow = '0 4px 16px rgba(0,0,0,0.4)';
  let bgColor = 'var(--glass-bg)';

  if (player.isFolded) {
    bgColor = 'rgba(13,17,23,0.5)';
    borderColor = 'rgba(255,255,255,0.04)';
  } else if (player.isAllIn) {
    bgColor = 'rgba(127,29,29,0.35)';
    borderColor = 'rgba(239,68,68,0.5)';
    boxShadow = '0 0 0 2px rgba(239,68,68,0.2), 0 4px 16px rgba(0,0,0,0.4)';
  }

  if (isHumanActive) {
    borderColor = 'rgba(88,166,255,0.5)';
    boxShadow = '0 0 0 3px rgba(88,166,255,0.25), 0 4px 16px rgba(0,0,0,0.4)';
  } else if (isThinking) {
    borderColor = 'rgba(251,191,36,0.5)';
    boxShadow = '0 0 0 3px rgba(251,191,36,0.25), 0 4px 16px rgba(0,0,0,0.4)';
  }

  const animClass = isHumanActive
    ? 'active-player-glow'
    : isThinking
    ? 'active-player-glow-yellow'
    : isPotWinner
    ? 'pot-winner-glow'
    : '';

  // Cards face-up rules:
  // 1. Hero always sees their own cards
  // 2. During SHOWDOWN or HAND_COMPLETE: all non-folded players' cards are revealed
  // 3. During all-in runout (all remaining players are all-in, no more betting):
  //    cards are revealed as community cards are dealt
  // Note: a single all-in player does NOT have cards revealed if other players can still act.
  const isShowdownPhase = phase === 'SHOWDOWN' || phase === 'HAND_COMPLETE';
  const isAllInRunout = useGameStore((s) => {
    const ps = s.gameState?.players;
    if (!ps) return false;
    const inHand = ps.filter((p) => p.isActive && !p.isFolded);
    return inHand.length >= 2 && inHand.every((p) => p.isAllIn);
  });
  const showFaceUp = player.isHuman
    || (isShowdownPhase && !player.isFolded)
    || (isAllInRunout && !player.isFolded);

  const positionBadgeColor =
    positionBadge === 'BTN' ? '#d97706' :
    positionBadge === 'SB'  ? '#dc2626' :
    '#1d4ed8';

  const seatStyle: React.CSSProperties = {
    background: bgColor,
    backdropFilter: player.isFolded ? 'none' : 'blur(var(--glass-blur))',
    WebkitBackdropFilter: player.isFolded ? 'none' : 'blur(var(--glass-blur))',
    border: `1.5px solid ${borderColor}`,
    borderRadius: 'var(--radius-lg)',
    padding: isHero ? '4px 6px' : '3px 5px',
    position: 'relative',
    boxShadow,
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease, filter 0.3s ease, opacity 0.3s ease',
    textAlign: 'center',
  };

  // Folded wrapper class
  const foldedClass = player.isFolded ? 'player-folded' : '';

  const positionLabel = positionBadge ? `, ${positionBadge}` : '';
  const seatAriaLabel = player.isHuman
    ? `You, ${player.chips} chips${positionLabel}`
    : `${player.name}, ${player.chips} chips${positionLabel}`;

  return (
    <div
      role="region"
      aria-label={seatAriaLabel}
      className={foldedClass}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}
    >
      {/* Hole Cards */}
      {player.holeCards && (
        <div className="seat-hole-card" style={{ display: 'flex', gap: '2px', filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.65))' }}>
          <PlayingCard card={player.holeCards[0]} size="xs" faceDown={!showFaceUp} animate animationDelay={0} />
          <PlayingCard card={player.holeCards[1]} size="xs" faceDown={!showFaceUp} animate animationDelay={100} />
        </div>
      )}

      {/* Player Info Badge */}
      <div className={`${animClass} ${badgeClass}`} style={seatStyle}>
        {/* Position label pill */}
        {positionBadge && (
          <div
            style={{
              position: 'absolute',
              top: '-10px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: positionBadgeColor,
              color: '#fff',
              fontSize: '9px',
              fontWeight: 700,
              letterSpacing: '0.06em',
              padding: '2px 7px',
              borderRadius: 'var(--radius-sm)',
              boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
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

        {/* Name — centered, avatar hidden on small screens */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px', width: '100%' }}>
          <div
            className="hidden sm:flex"
            style={{
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              background: player.isHuman
                ? 'linear-gradient(135deg, #2563eb, #1d4ed8)'
                : 'linear-gradient(135deg, #374151, #1f2937)',
              color: '#fff',
              fontSize: '8px',
              fontWeight: 700,
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {player.name.charAt(0).toUpperCase()}
          </div>
          <span
            className="seat-name-text"
            style={{
              fontWeight: 600,
              color: player.isHuman ? '#93c5fd' : '#e6edf3',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '52px',
            }}
          >
            {player.name}
          </span>
        </div>

        {/* Stack — centered */}
        <div style={{ textAlign: 'center', marginTop: '2px' }}>
          <span
            className="seat-stack-text"
            style={{
              fontWeight: 700,
              color: '#fbbf24',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatAmount(player.chips, bb, displayMode)}
          </span>
        </div>

        {/* Current bet badge — centered */}
        {player.currentBet > 0 && (
          <div style={{ textAlign: 'center', marginTop: '2px' }}>
            <span
              style={{
                display: 'inline-block',
                padding: '1px 8px',
                borderRadius: 'var(--radius-full)',
                background: 'rgba(251,191,36,0.12)',
                border: '1px solid rgba(251,191,36,0.3)',
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

        {/* Last action label (CHECK, CALL, RAISE, BET) — shown when not in a special state */}
        {lastAction && !player.isAllIn && !player.isFolded && !isThinking && !isHumanActive && !isPotWinner && (
          <div style={{ textAlign: 'center', marginTop: '2px' }}>
            <span
              style={{
                display: 'inline-block',
                fontSize: '9px',
                fontWeight: 600,
                letterSpacing: '0.05em',
                color: lastAction.action === 'CHECK' ? '#8b949e'
                  : lastAction.action === 'CALL' ? '#60a5fa'
                  : lastAction.action === 'RAISE' || lastAction.action === 'BET' ? '#fbbf24'
                  : '#8b949e',
              }}
            >
              {lastAction.action}
            </span>
          </div>
        )}

        {/* Status badges */}
        {player.isAllIn && (
          <div style={{ textAlign: 'center', marginTop: '3px' }}>
            <span
              style={{
                display: 'inline-block',
                fontSize: '9px',
                fontWeight: 700,
                letterSpacing: '0.1em',
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(239,68,68,0.18)',
                color: '#f87171',
                border: '1px solid rgba(239,68,68,0.35)',
              }}
            >
              ALL IN
            </span>
          </div>
        )}
        {!player.isAllIn && player.isFolded && (
          <div style={{ textAlign: 'center', marginTop: '3px' }}>
            <span
              style={{
                display: 'inline-block',
                fontSize: '9px',
                fontWeight: 700,
                letterSpacing: '0.1em',
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(110,118,129,0.15)',
                color: '#8b949e',
                border: '1px solid rgba(110,118,129,0.2)',
              }}
            >
              FOLD
            </span>
          </div>
        )}
        {!player.isAllIn && !player.isFolded && isPotWinner && (
          <div style={{ textAlign: 'center', marginTop: '3px' }}>
            <span
              style={{
                display: 'inline-block',
                fontSize: '9px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(34,197,94,0.18)',
                color: '#4ade80',
                border: '1px solid rgba(34,197,94,0.35)',
              }}
            >
              WINNER
            </span>
          </div>
        )}
        {!player.isAllIn && !player.isFolded && !isPotWinner && isThinking && (
          <span
            className="animate-pulse"
            style={{ marginTop: '2px', fontSize: '10px', color: '#fbbf24', display: 'block', textAlign: 'center' }}
          >
            thinking...
          </span>
        )}
        {!player.isAllIn && !player.isFolded && !isPotWinner && isHumanActive && (
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
