import { useGameStore } from '@/store/game-store';

interface TopBarProps {
  onToggleSidePanel?: () => void;
  sidePanelOpen?: boolean;
}

export function TopBar({ onToggleSidePanel, sidePanelOpen }: TopBarProps) {
  const handNumber = useGameStore((s) => s.gameState?.handNumber ?? 0);
  const activePlayers = useGameStore(
    (s) => s.gameState?.players.filter((p) => p.isActive).length ?? 0
  );
  const displayMode = useGameStore((s) => s.displayMode);
  const toggleDisplayMode = useGameStore((s) => s.toggleDisplayMode);

  return (
    <header
      role="banner"
      aria-label="Game status"
      className="topbar-responsive glass-panel-heavy"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0,
        borderRadius: 0,
      }}
    >
      {/* Left: hand number */}
      <span
        aria-label={`Hand number ${handNumber}`}
        style={{ color: '#8b949e', fontSize: '13px', fontWeight: 500 }}
      >
        Hand #{handNumber}
      </span>

      {/* Right: players + display mode + mobile toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span
          className="hidden sm:inline"
          aria-label={`${activePlayers} active players`}
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: '#8b949e',
            padding: '3px 10px',
            borderRadius: 'var(--radius-full)',
            background: 'rgba(110,118,129,0.12)',
            border: '1px solid rgba(110,118,129,0.15)',
          }}
        >
          {activePlayers}p
        </span>

        <button
          onClick={toggleDisplayMode}
          style={{
            height: '28px',
            minWidth: '38px',
            padding: '0 10px',
            borderRadius: 'var(--radius-md)',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
            border: '1px solid rgba(255,255,255,0.08)',
            transition: 'background 0.15s, transform 0.1s',
            background: displayMode === 'bb' ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.06)',
            color: displayMode === 'bb' ? '#fbbf24' : '#8b949e',
          }}
          aria-label="Toggle big blind display"
          aria-pressed={displayMode === 'bb'}
          title={displayMode === 'bb' ? 'Showing amounts in BB' : 'Showing amounts in chips'}
        >
          {displayMode === 'bb' ? 'BB' : '$'}
        </button>

        {onToggleSidePanel && (
          <button
            onClick={onToggleSidePanel}
            className="lg:hidden"
            style={{
              width: '30px',
              height: '30px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#8b949e',
            }}
            aria-label={sidePanelOpen ? 'Close stats panel' : 'Open stats panel'}
          >
            {sidePanelOpen ? (
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
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
