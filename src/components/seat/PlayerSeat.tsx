import type { Player } from '@/types';
import { PlayingCard } from '@/components/card/PlayingCard';

interface PlayerSeatProps {
  player: Player;
  isButton: boolean;
}

export function PlayerSeat({ player, isButton }: PlayerSeatProps) {
  if (!player.isActive) {
    return (
      <div className="flex flex-col items-center opacity-30">
        <div className="w-20 h-12 rounded bg-gray-700 flex items-center justify-center text-xs text-gray-500">
          Out
        </div>
      </div>
    );
  }

  const statusColor = player.isFolded
    ? 'bg-gray-700 opacity-50'
    : player.isAllIn
    ? 'bg-red-900 border-red-500'
    : 'bg-gray-800 border-gray-600';

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
      <div className={`flex flex-col items-center px-3 py-1 rounded border ${statusColor} relative`}>
        <span className="text-xs font-semibold truncate max-w-[80px]">{player.name}</span>
        <span className="text-xs text-yellow-400">{player.chips.toLocaleString()}</span>

        {/* Dealer Button */}
        {isButton && (
          <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-white text-black text-[10px] font-bold flex items-center justify-center shadow">
            D
          </div>
        )}

        {/* Current Bet */}
        {player.currentBet > 0 && (
          <span className="text-[10px] text-green-400">{player.currentBet}</span>
        )}

        {/* Status */}
        {player.isAllIn && (
          <span className="text-[10px] text-red-400 font-bold">ALL IN</span>
        )}
        {player.isFolded && (
          <span className="text-[10px] text-gray-500">FOLD</span>
        )}
      </div>
    </div>
  );
}
