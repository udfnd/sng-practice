import { memo } from 'react';
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
        <div className="w-20 h-12 rounded bg-gray-700 flex items-center justify-center text-xs text-gray-500">
          Out
        </div>
      </div>
    );
  }

  const borderColor = isHumanActive
    ? 'border-blue-400 border-2'
    : isThinking
    ? 'border-yellow-400 border-2'
    : player.isFolded
    ? 'border-gray-600 opacity-50'
    : player.isAllIn
    ? 'border-red-500'
    : 'border-gray-600';

  const bgColor = player.isFolded
    ? 'bg-gray-800'
    : player.isAllIn
    ? 'bg-red-900'
    : 'bg-gray-800';

  // Active player glow ring
  const activeRingClass = isHumanActive
    ? 'ring-2 ring-blue-400 ring-offset-1 ring-offset-transparent active-player-glow'
    : isThinking
    ? 'ring-2 ring-yellow-400 ring-offset-1 ring-offset-transparent active-player-glow'
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
        className={`flex flex-col items-center px-3 py-1 rounded border ${bgColor} ${borderColor} ${activeRingClass} relative transition-all duration-200`}
      >
        {/* Position badge */}
        {positionBadge && (
          <div className="absolute -top-2 -left-2 px-1 rounded text-[8px] font-bold bg-amber-500 text-black">
            {positionBadge}
          </div>
        )}

        {/* Dealer Button */}
        {isButton && (
          <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-white text-black text-[10px] font-bold flex items-center justify-center shadow">
            D
          </div>
        )}

        <span
          className={`text-xs font-semibold truncate max-w-[80px] ${
            player.isHuman ? 'text-blue-300' : 'text-white'
          }`}
        >
          {player.name}
        </span>
        <span className="text-xs text-yellow-400">
          {formatAmount(player.chips, bb, displayMode)}
        </span>

        {/* Current Bet with slide animation */}
        {player.currentBet > 0 && (
          <span className="text-[10px] text-green-400 transition-all duration-150">
            {formatAmount(player.currentBet, bb, displayMode)}
          </span>
        )}

        {/* Status indicators */}
        {player.isAllIn && (
          <span className="text-[10px] text-red-400 font-bold">ALL IN</span>
        )}
        {player.isFolded && (
          <span className="text-[10px] text-gray-500">FOLD</span>
        )}
        {isThinking && (
          <span className="text-[10px] text-yellow-300 animate-pulse">thinking...</span>
        )}
        {isHumanActive && (
          <span className="text-[10px] text-blue-300 font-bold animate-pulse">YOUR TURN</span>
        )}
      </div>
    </div>
  );
});
