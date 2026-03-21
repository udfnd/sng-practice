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
    <header
      style={{
        height: '40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 14px',
        background: '#161b22',
        borderBottom: '1px solid #30363d',
        flexShrink: 0,
      }}
    >
      {/* Left: blind level info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            padding: '2px 8px',
            borderRadius: '5px',
            background: 'rgba(251,191,36,0.1)',
            border: '1px solid rgba(251,191,36,0.22)',
          }}
        >
          <span style={{ color: '#fbbf24', fontWeight: 700, fontSize: '12px' }}>
            Lv.{blindLevel?.level ?? 1}
          </span>
          <span style={{ color: '#8b949e', fontSize: '12px', fontWeight: 500 }}>
            {blindLevel?.sb ?? 10}/{blindLevel?.bb ?? 20}
          </span>
          {blindLevel?.ante ? (
            <span style={{ color: '#fb923c', fontSize: '12px' }}>· Ante {blindLevel.ante}</span>
          ) : null}
        </div>
      </div>

      {/* Center: hand number */}
      <span style={{ color: '#6e7681', fontSize: '12px', fontWeight: 500 }}>
        Hand #{handNumber}
      </span>

      {/* Right: players + display mode + mobile toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span
          style={{
            fontSize: '12px',
            fontWeight: 500,
            color: '#8b949e',
            padding: '2px 8px',
            borderRadius: '99px',
            background: 'rgba(110,118,129,0.12)',
          }}
        >
          {activePlayers}p
        </span>

        <button
          onClick={toggleDisplayMode}
          style={{
            height: '26px',
            minWidth: '36px',
            padding: '0 8px',
            borderRadius: '5px',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
            border: 'none',
            transition: 'background 0.1s',
            background: displayMode === 'bb' ? '#fbbf24' : '#21262d',
            color: displayMode === 'bb' ? '#000' : '#8b949e',
          }}
          aria-label={displayMode === 'bb' ? 'Switch to chip display' : 'Switch to BB display'}
          title={displayMode === 'bb' ? 'Showing amounts in BB — click to switch to chips' : 'Showing amounts in chips — click to switch to BB'}
        >
          {displayMode === 'bb' ? 'BB' : '$'}
        </button>

        {onToggleSidePanel && (
          <button
            onClick={onToggleSidePanel}
            className="lg:hidden"
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '5px',
              background: '#21262d',
              border: '1px solid #30363d',
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
