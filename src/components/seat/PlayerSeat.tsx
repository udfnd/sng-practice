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

  // Determine position badge
  const positionBadge = isButton
    ? 'BTN'
    : player.seatIndex === sbSeat
    ? 'SB'
    : player.seatIndex === bbSeat
    ? 'BB'
    : null;

  if (!player.isActive) {
    return (
      <div className="flex flex-col items-center opacity-20 transition-opacity duration-300">
        <div
          className="w-20 h-10 rounded-xl flex items-center justify-center text-xs font-medium"
          style={{ background: '#0d1117', color: '#374151', border: '1px solid #1f2937' }}
        >
          Empty
        </div>
      </div>
    );
  }

  // Border color based on player state
  let borderColor = 'rgba(255,255,255,0.1)';
  let bgColor = player.isFolded
    ? 'rgba(13,17,23,0.7)'
    : player.isAllIn
    ? 'rgba(127,29,29,0.5)'
    : 'rgba(22,29,39,0.92)';
  let glowShadow = 'none';

  if (isHumanActive) {
    borderColor = '#3b82f6';
    glowShadow = '0 0 0 3px rgba(59,130,246,0.35), 0 4px 12px rgba(0,0,0,0.5)';
  } else if (isThinking) {
    borderColor = '#eab308';
    glowShadow = '0 0 0 3px rgba(234,179,8,0.35), 0 4px 12px rgba(0,0,0,0.5)';
  } else if (player.isAllIn) {
    borderColor = '#ef4444';
    glowShadow = '0 0 0 2px rgba(239,68,68,0.3), 0 4px 8px rgba(0,0,0,0.5)';
  }

  const seatStyle: React.CSSProperties = {
    background: bgColor,
    border: `1.5px solid ${borderColor}`,
    borderRadius: '14px',
    padding: '7px 10px',
    position: 'relative' as const,
    boxShadow: glowShadow !== 'none' ? glowShadow : '0 2px 8px rgba(0,0,0,0.5)',
    opacity: player.isFolded ? 0.45 : 1,
    transition: 'all 0.2s ease',
    minWidth: '76px',
  };

  const activeRingClass = isHumanActive
    ? 'active-player-glow'
    : isThinking
    ? 'active-player-glow-yellow'
    : '';

  const cardSize = 'sm' as const;

  return (
    <div className="flex flex-col items-center gap-1 transition-all duration-200">
      {/* Hole Cards */}
      <div className="flex gap-0.5" style={{ filter: 'drop-shadow(0 3px 5px rgba(0,0,0,0.6))' }}>
        {player.holeCards ? (() => {
          // Show cards face-up for: human player, showdown/hand_complete (all non-folded), all-in runout
          const isShowdown = phase === 'SHOWDOWN' || phase === 'HAND_COMPLETE';
          const showFaceUp = player.isHuman || (isShowdown && !player.isFolded) || (player.isAllIn && !player.isFolded);
          return (
            <>
              <PlayingCard card={player.holeCards[0]} size={cardSize} faceDown={!showFaceUp} animate />
              <PlayingCard card={player.holeCards[1]} size={cardSize} faceDown={!showFaceUp} animate />
            </>
          );
        })() : null}
      </div>

      {/* Player Info Badge */}
      <div
        className={`flex flex-col items-center ${activeRingClass} transition-all duration-200`}
        style={seatStyle}
      >
        {/* Position badge */}
        {positionBadge && (
          <div
            className="absolute -top-2 -left-2 px-1.5 py-0.5 rounded-md text-[9px] font-bold tracking-wide"
            style={{
              background: positionBadge === 'BTN' ? '#d97706' : positionBadge === 'SB' ? '#dc2626' : '#1d4ed8',
              color: '#fff',
              boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
            }}
          >
            {positionBadge}
          </div>
        )}

        {/* Dealer Button */}
        {isButton && (
          <div
            className="absolute -top-2 -right-2 w-5 h-5 rounded-full text-black text-[10px] font-bold flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #fcd34d, #d97706)',
              border: '1.5px solid #b45309',
              boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
            }}
          >
            D
          </div>
        )}

        {/* Avatar circle + Name */}
        <div className="flex items-center gap-1.5 w-full">
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
            style={{
              background: player.isHuman ? 'linear-gradient(135deg, #2563eb, #1d4ed8)' : 'linear-gradient(135deg, #374151, #1f2937)',
              color: '#fff',
            }}
          >
            {player.name.charAt(0).toUpperCase()}
          </div>
          <span
            className="text-xs font-semibold truncate"
            style={{ color: player.isHuman ? '#93c5fd' : '#e2e8f0', maxWidth: '52px' }}
          >
            {player.name}
          </span>
        </div>

        {/* Stack */}
        <span className="text-sm font-bold tabular-nums mt-0.5" style={{ color: '#fcd34d' }}>
          {formatAmount(player.chips, bb, displayMode)}
        </span>

        {/* Current Bet - prominent */}
        {player.currentBet > 0 && (
          <div
            className="flex items-center gap-1 px-2 py-0.5 rounded-full mt-0.5"
            style={{
              background: 'rgba(250,204,21,0.15)',
              border: '1px solid rgba(250,204,21,0.4)',
            }}
          >
            <span className="text-sm font-bold transition-all duration-150" style={{ color: '#facc15', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
              {formatAmount(player.currentBet, bb, displayMode)}
            </span>
          </div>
        )}

        {/* Status indicators */}
        {player.isAllIn && (
          <span
            className="text-[9px] font-bold tracking-widest px-1.5 py-0.5 rounded mt-0.5"
            style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171', border: '1px solid rgba(239,68,68,0.4)' }}
          >
            ALL IN
          </span>
        )}
        {player.isFolded && (
          <span className="text-[9px] font-medium mt-0.5" style={{ color: '#6b7280' }}>FOLDED</span>
        )}
        {isThinking && !player.isFolded && (
          <span className="text-[9px] animate-pulse mt-0.5" style={{ color: '#fde047' }}>thinking...</span>
        )}
        {isHumanActive && (
          <span className="text-[9px] font-bold animate-pulse mt-0.5" style={{ color: '#93c5fd' }}>YOUR TURN</span>
        )}
      </div>
    </div>
  );
});
