import { useGameStore } from '@/store/game-store';

interface TopBarProps {
  onToggleSidePanel?: () => void;
  sidePanelOpen?: boolean;
}

export function TopBar({ onToggleSidePanel, sidePanelOpen }: TopBarProps) {
  const blindLevel = useGameStore((s) => s.gameState?.blindLevel);
  const handNumber = useGameStore((s) => s.gameState?.handNumber ?? 0);
  const activePlayers = useGameStore(
    (s) => s.gameState?.players.filter((p) => p.isActive).length ?? 0
  );
  const displayMode = useGameStore((s) => s.displayMode);
  const toggleDisplayMode = useGameStore((s) => s.toggleDisplayMode);

  return (
    <header className="flex items-center justify-between px-3 sm:px-4 py-2 bg-gray-800 border-b border-gray-700 text-sm">
      <div className="flex gap-3 sm:gap-4">
        <span className="text-gray-400 text-xs sm:text-sm">
          Level {blindLevel?.level ?? 1}: {blindLevel?.sb ?? 10}/{blindLevel?.bb ?? 20}
          {blindLevel?.ante ? ` (${blindLevel.ante})` : ''}
        </span>
        <span className="text-gray-400 text-xs sm:text-sm">Hand #{handNumber}</span>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <span className="text-gray-400 text-xs sm:text-sm">{activePlayers} players</span>

        {/* BB / Chips display mode toggle */}
        <button
          onClick={toggleDisplayMode}
          className={`flex items-center justify-center min-w-[40px] h-7 px-2 rounded text-xs font-semibold transition-all duration-150 active:scale-95 touch-manipulation ${
            displayMode === 'bb'
              ? 'bg-yellow-500 text-black'
              : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
          }`}
          aria-label={displayMode === 'bb' ? 'Switch to chip display' : 'Switch to BB display'}
          title={displayMode === 'bb' ? 'Showing amounts in BB — click to switch to chips' : 'Showing amounts in chips — click to switch to BB'}
        >
          {displayMode === 'bb' ? 'BB' : '$'}
        </button>

        {/* Mobile side panel toggle */}
        {onToggleSidePanel && (
          <button
            onClick={onToggleSidePanel}
            className="lg:hidden flex items-center justify-center w-8 h-8 rounded bg-gray-700 hover:bg-gray-600 transition-colors duration-150 active:scale-95 touch-manipulation"
            aria-label={sidePanelOpen ? 'Close stats panel' : 'Open stats panel'}
          >
            {sidePanelOpen ? (
              // X icon
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              // Bar chart icon
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            )}
          </button>
        )}
      </div>
    </header>
  );
}
