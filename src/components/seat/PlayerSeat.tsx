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
      <div className="flex flex-col items-center opacity-30 transition-opacity duration-300">
        <div
          className="w-20 h-12 rounded flex items-center justify-center text-xs"
          style={{ background: '#141b24', color: '#64748b' }}
        >
          Out
        </div>
      </div>
    );
  }

  // Border and glow based on state
  let seatStyle: React.CSSProperties = {
    background: player.isFolded ? 'rgba(20,27,36,0.4)' : player.isAllIn ? 'rgba(127,29,29,0.4)' : 'rgba(20,27,36,0.6)',
    border: '1px solid rgba(100,116,139,0.2)',
    borderRadius: '12px',
    padding: '8px',
    position: 'relative' as const,
  };

  if (isHumanActive) {
    seatStyle = {
      ...seatStyle,
      border: '2px solid #3b82f6',
      transform: 'scale(1.02)',
    };
  } else if (isThinking) {
    seatStyle = {
      ...seatStyle,
      border: '2px solid #eab308',
      transform: 'scale(1.02)',
    };
  } else if (player.isFolded) {
    seatStyle = { ...seatStyle, opacity: 0.5 };
  } else if (player.isAllIn) {
    seatStyle = { ...seatStyle, border: '1px solid #ef4444' };
  }

  const activeRingClass = isHumanActive
    ? 'active-player-glow'
    : isThinking
    ? 'active-player-glow-yellow'
    : '';

  const cardSize = 'sm' as const;

  return (
    <div className="flex flex-col items-center gap-1 transition-all duration-200">
      {/* Hole Cards */}
      <div className="flex gap-0.5">
        {player.holeCards ? (
          player.isHuman ? (
            <>
              <PlayingCard card={player.holeCards[0]} size={cardSize} animate />
              <PlayingCard card={player.holeCards[1]} size={cardSize} animate />
            </>
          ) : (
            <>
              <PlayingCard card={player.holeCards[0]} size={cardSize} faceDown animate />
              <PlayingCard card={player.holeCards[1]} size={cardSize} faceDown animate />
            </>
          )
        ) : null}
      </div>

      {/* Player Info */}
      <div
        className={`flex flex-col items-center ${activeRingClass} transition-all duration-200`}
        style={seatStyle}
      >
        {/* Position badge */}
        {positionBadge && (
          <div
            className="absolute -top-2 -left-2 px-1 rounded text-[8px] font-bold"
            style={{
              background: positionBadge === 'BTN' ? '#eab308' : positionBadge === 'SB' ? '#ef4444' : '#3366cc',
              color: positionBadge === 'BTN' ? '#000' : '#fff',
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
              background: '#eab308',
              border: '2px solid #ca8a04',
              boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
            }}
          >
            D
          </div>
        )}

        <span
          className="text-xs font-semibold truncate max-w-[80px]"
          style={{ color: player.isHuman ? '#93c5fd' : '#f1f5f9' }}
        >
          {player.name}
        </span>
        <span className="text-xs font-mono tabular-nums" style={{ color: '#eab308' }}>
          {formatAmount(player.chips, bb, displayMode)}
        </span>

        {/* Current Bet */}
        {player.currentBet > 0 && (
          <span className="text-[10px] transition-all duration-150" style={{ color: '#22c55e' }}>
            {formatAmount(player.currentBet, bb, displayMode)}
          </span>
        )}

        {/* Status indicators */}
        {player.isAllIn && (
          <span className="text-[10px] font-bold" style={{ color: '#ef4444' }}>ALL IN</span>
        )}
        {player.isFolded && (
          <span className="text-[10px]" style={{ color: '#64748b' }}>FOLD</span>
        )}
        {isThinking && (
          <span className="text-[10px] animate-pulse" style={{ color: '#fde047' }}>thinking...</span>
        )}
        {isHumanActive && (
          <span className="text-[10px] font-bold animate-pulse" style={{ color: '#93c5fd' }}>YOUR TURN</span>
        )}
      </div>
    </div>
  );
});
