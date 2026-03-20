import type { Player } from '@/types';
import { PlayingCard } from '@/components/card/PlayingCard';
import { useGameStore } from '@/store/game-store';

interface PlayerSeatProps {
  player: Player;
  isButton: boolean;
}

export function PlayerSeat({ player, isButton }: PlayerSeatProps) {
  const thinkingPlayerId = useGameStore((s) => s.thinkingPlayerId);
  const isHumanTurn = useGameStore((s) => s.isHumanTurn);
  const sbSeat = useGameStore((s) => s.gameState?.sbSeatIndex ?? -1);
  const bbSeat = useGameStore((s) => s.gameState?.bbSeatIndex ?? -1);

  const isThinking = thinkingPlayerId === player.id;
  const isHumanActive = player.isHuman && isHumanTurn;
  const isActive = isThinking || isHumanActive;

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
      <div className="flex flex-col items-center opacity-30">
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

  return (
    <div className="flex flex-col items-center gap-1">
      {/* Hole Cards */}
      <div className="flex gap-0.5">
        {player.holeCards ? (
          player.isHuman ? (
            <>
              <PlayingCard card={player.holeCards[0]} size="sm" />
              <PlayingCard card={player.holeCards[1]} size="sm" />
            </>
          ) : (
            <>
              <PlayingCard card={player.holeCards[0]} size="sm" faceDown />
              <PlayingCard card={player.holeCards[1]} size="sm" faceDown />
            </>
          )
        ) : null}
      </div>

      {/* Player Info */}
      <div
        className={`flex flex-col items-center px-3 py-1 rounded border ${bgColor} ${borderColor} relative ${isActive ? 'ring-1 ring-opacity-50 ring-white' : ''}`}
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

        <span className={`text-xs font-semibold truncate max-w-[80px] ${player.isHuman ? 'text-blue-300' : 'text-white'}`}>
          {player.name}
        </span>
        <span className="text-xs text-yellow-400">{player.chips.toLocaleString()}</span>

        {/* Current Bet */}
        {player.currentBet > 0 && (
          <span className="text-[10px] text-green-400">{player.currentBet}</span>
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
          <span className="text-[10px] text-blue-300 font-bold">YOUR TURN</span>
        )}
      </div>
    </div>
  );
}
