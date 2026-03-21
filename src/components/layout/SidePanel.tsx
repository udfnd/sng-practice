import { useEffect, useRef } from 'react';
import { useGameStore } from '@/store/game-store';

function calcVPIP(stats: { vpipCount: number; handsEligible: number }): string {
  if (stats.handsEligible === 0) return '-';
  return `${Math.round((stats.vpipCount / stats.handsEligible) * 100)}%`;
}

function calcPFR(stats: { pfrCount: number; handsEligible: number }): string {
  if (stats.handsEligible === 0) return '-';
  return `${Math.round((stats.pfrCount / stats.handsEligible) * 100)}%`;
}

function calc3Bet(stats: {
  threeBetCount: number;
  threeBetOpportunities: number;
}): string {
  if (stats.threeBetOpportunities === 0) return '-';
  return `${Math.round((stats.threeBetCount / stats.threeBetOpportunities) * 100)}%`;
}

interface SidePanelProps {
  /** Controls mobile overlay visibility; desktop always visible via CSS */
  mobileOpen?: boolean;
  onClose?: () => void;
}

const EMPTY_PLAYERS: never[] = [];

export function SidePanel({ mobileOpen = false, onClose }: SidePanelProps) {
  const actionLog = useGameStore((s) => s.actionLog);
  const players = useGameStore((s) => s.gameState?.players) ?? EMPTY_PLAYERS;
  const isPlaying = useGameStore((s) => s.isPlaying);

  const logEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new log entries arrive
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [actionLog.length]);

  const panelContent = (
    <div className="flex flex-col h-full">
      {/* Action Log header */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid #30363d', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <h3 style={{ fontSize: '11px', fontWeight: 600, color: '#6e7681', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
          Action Log
        </h3>
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden"
            style={{ width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6e7681', cursor: 'pointer', background: 'none', border: 'none', borderRadius: '4px' }}
            aria-label="Close panel"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Log entries */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px', minHeight: 0 }}>
        {actionLog.length === 0 ? (
          <p style={{ color: '#6e7681', fontSize: '12px', fontStyle: 'italic', margin: 0 }}>
            {isPlaying ? 'Game starting...' : 'Game not started'}
          </p>
        ) : (
          actionLog.map((line, i) => (
            <div
              key={i}
              style={{
                fontSize: '12px',
                lineHeight: '1.5',
                color: (line.startsWith('---') || line.startsWith('===')) ? '#6e7681' : '#8b949e',
                fontWeight: (line.startsWith('---') || line.startsWith('===')) ? 600 : 400,
                marginTop: (line.startsWith('---') || line.startsWith('===')) ? '4px' : 0,
              }}
            >
              {line}
            </div>
          ))
        )}
        <div ref={logEndRef} />
      </div>

      {/* Player Stats */}
      {players.length > 0 && (
        <>
          <div style={{ padding: '8px 12px', borderTop: '1px solid #30363d', flexShrink: 0 }}>
            <h3 style={{ fontSize: '11px', fontWeight: 600, color: '#6e7681', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
              Stats
            </h3>
          </div>
          <div style={{ padding: '0 8px 8px', overflowY: 'auto', flexShrink: 0 }}>
            <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ color: '#6e7681', borderBottom: '1px solid #30363d' }}>
                  <th style={{ textAlign: 'left', padding: '3px 4px', fontWeight: 500 }}>Player</th>
                  <th style={{ textAlign: 'center', padding: '3px 4px', fontWeight: 500 }}>VPIP</th>
                  <th style={{ textAlign: 'center', padding: '3px 4px', fontWeight: 500 }}>PFR</th>
                  <th style={{ textAlign: 'center', padding: '3px 4px', fontWeight: 500 }}>3B</th>
                </tr>
              </thead>
              <tbody>
                {players
                  .filter((p) => p.isActive)
                  .map((p) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid rgba(48,54,61,0.5)' }}>
                      <td
                        style={{
                          padding: '3px 4px',
                          maxWidth: '80px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          color: p.isHuman ? '#58a6ff' : '#8b949e',
                        }}
                      >
                        {p.name}
                      </td>
                      <td style={{ textAlign: 'center', color: '#6e7681', padding: '3px 4px' }}>{calcVPIP(p.stats)}</td>
                      <td style={{ textAlign: 'center', color: '#6e7681', padding: '3px 4px' }}>{calcPFR(p.stats)}</td>
                      <td style={{ textAlign: 'center', color: '#6e7681', padding: '3px 4px' }}>{calc3Bet(p.stats)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop sidebar: always visible on lg+ */}
      <aside
        className="hidden lg:flex flex-col"
        style={{ width: '240px', background: '#161b22', borderLeft: '1px solid #30363d', overflow: 'hidden' }}
      >
        {panelContent}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-40 animate-fade-in"
            style={{ background: 'rgba(0,0,0,0.65)' }}
            onClick={onClose}
            aria-hidden="true"
          />
          <div
            className="lg:hidden fixed right-0 top-0 bottom-0 z-50 slide-in-right flex flex-col"
            style={{ width: '240px', background: '#161b22', borderLeft: '1px solid #30363d' }}
          >
            {panelContent}
          </div>
        </>
      )}
    </>
  );
}
