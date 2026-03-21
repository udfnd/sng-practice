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

export function SidePanel({ mobileOpen = false, onClose }: SidePanelProps) {
  const actionLog = useGameStore((s) => s.actionLog);
  const players = useGameStore((s) => s.gameState?.players ?? []);
  const isPlaying = useGameStore((s) => s.isPlaying);

  const logEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new log entries arrive
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [actionLog.length]);

  const panelContent = (
    <div className="flex flex-col h-full">
      {/* Action Log header */}
      <div className="p-3 border-b border-gray-700 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          Action Log
        </h3>
        {/* Mobile close button */}
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden w-6 h-6 flex items-center justify-center text-gray-400 hover:text-white transition-colors touch-manipulation"
            aria-label="Close panel"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Log entries */}
      <div className="flex-1 overflow-y-auto p-3 text-xs text-gray-400 space-y-0.5 min-h-0">
        {actionLog.length === 0 ? (
          <p className="italic">{isPlaying ? 'Game starting...' : 'Game not started'}</p>
        ) : (
          actionLog.map((line, i) => (
            <div
              key={i}
              className={
                line.startsWith('---') || line.startsWith('===')
                  ? 'text-gray-500 font-semibold mt-1'
                  : 'text-gray-300'
              }
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
          <div className="p-3 border-t border-gray-700">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
              Stats
            </h3>
          </div>
          <div className="p-2 overflow-y-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-gray-700">
                  <th className="text-left py-1 pl-1">Player</th>
                  <th className="text-center py-1">VPIP</th>
                  <th className="text-center py-1">PFR</th>
                  <th className="text-center py-1">3B</th>
                </tr>
              </thead>
              <tbody>
                {players
                  .filter((p) => p.isActive)
                  .map((p) => (
                    <tr key={p.id} className="border-b border-gray-700/50">
                      <td
                        className={`py-1 pl-1 truncate max-w-[80px] ${
                          p.isHuman ? 'text-blue-400' : 'text-gray-300'
                        }`}
                      >
                        {p.name}
                      </td>
                      <td className="text-center text-gray-400">{calcVPIP(p.stats)}</td>
                      <td className="text-center text-gray-400">{calcPFR(p.stats)}</td>
                      <td className="text-center text-gray-400">{calc3Bet(p.stats)}</td>
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
      <aside className="hidden lg:flex flex-col w-72 bg-gray-800 border-l border-gray-700 overflow-y-auto">
        {panelContent}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <>
          {/* Backdrop */}
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black/60 animate-fade-in"
            onClick={onClose}
            aria-hidden="true"
          />
          {/* Slide-in panel */}
          <div className="lg:hidden fixed right-0 top-0 bottom-0 z-50 w-72 bg-gray-800 border-l border-gray-700 flex flex-col slide-in-right">
            {panelContent}
          </div>
        </>
      )}
    </>
  );
}
