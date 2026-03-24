import { useState, useEffect, useRef } from 'react';
import { TopBar } from './components/layout/TopBar';
import { TableArea } from './components/layout/TableArea';
import { ActionPanel } from './components/layout/ActionPanel';
import { SidePanel } from './components/layout/SidePanel';
import { SetupScreen } from './components/setup/SetupScreen';
import { ResultsScreen } from './components/results/ResultsScreen';
import { useGameStore } from './store/game-store';
import type { SetupConfig } from './components/setup/SetupScreen';
import { createDefaultConfig } from './engine/tournament';
import { BLIND_SPEEDS, PAYOUT_RATIOS, DEFAULT_BLIND_SCHEDULE } from './engine/tournament';
import { formatAmount } from './utils/format-chips';

export function App() {
  const isPlaying = useGameStore((s) => s.isPlaying);
  const gameState = useGameStore((s) => s.gameState);
  const standings = useGameStore((s) => s.standings);
  const error = useGameStore((s) => s.error);
  const startGame = useGameStore((s) => s.startGame);
  const resetGame = useGameStore((s) => s.resetGame);
  const isHumanTurn = useGameStore((s) => s.isHumanTurn);
  const validActions = useGameStore((s) => s.validActions);
  const callAmount = useGameStore((s) => s.callAmount);
  const actionLog = useGameStore((s) => s.actionLog);
  const displayMode = useGameStore((s) => s.displayMode);

  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [announceText, setAnnounceText] = useState('');
  const prevIsHumanTurn = useRef(false);
  const prevActionLogLength = useRef(0);
  const prevCommunityCardCount = useRef(0);

  // Announce when it becomes the human player's turn
  useEffect(() => {
    if (!isHumanTurn || prevIsHumanTurn.current === isHumanTurn) return;
    prevIsHumanTurn.current = isHumanTurn;
    const bb = gameState?.blindLevel.bb ?? 1;
    const canFold = validActions.includes('FOLD');
    const canCheck = validActions.includes('CHECK');
    const canCall = validActions.includes('CALL');
    const canBetOrRaise = validActions.includes('BET') || validActions.includes('RAISE');
    const parts: string[] = ['Your turn.'];
    if (canFold) parts.push('You can fold,');
    if (canCheck) parts.push('check,');
    if (canCall) parts.push(`call ${formatAmount(callAmount, bb, displayMode)},`);
    if (canBetOrRaise) parts.push('or raise.');
    setAnnounceText(parts.join(' '));
  }, [isHumanTurn, validActions, callAmount, gameState, displayMode]);

  useEffect(() => {
    if (!isHumanTurn) {
      prevIsHumanTurn.current = false;
    }
  }, [isHumanTurn]);

  // Announce new action log entries (opponent actions)
  useEffect(() => {
    if (actionLog.length > prevActionLogLength.current) {
      const newEntries = actionLog.slice(prevActionLogLength.current);
      prevActionLogLength.current = actionLog.length;
      const last = newEntries[newEntries.length - 1];
      if (last) setAnnounceText(last);
    }
  }, [actionLog]);

  // Announce community cards when revealed
  useEffect(() => {
    const cards = gameState?.communityCards ?? [];
    if (cards.length > prevCommunityCardCount.current && cards.length > 0) {
      prevCommunityCardCount.current = cards.length;
      const RANK_NAMES: Record<number, string> = {
        2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9',
        10: '10', 11: 'Jack', 12: 'Queen', 13: 'King', 14: 'Ace',
      };
      const SUIT_NAMES: Record<string, string> = {
        spades: 'spades', hearts: 'hearts', diamonds: 'diamonds', clubs: 'clubs',
      };
      if (cards.length === 3) {
        const described = cards.map((c) => `${RANK_NAMES[c.rank]} of ${SUIT_NAMES[c.suit]}`).join(', ');
        setAnnounceText(`Flop: ${described}`);
      } else if (cards.length === 4) {
        const c = cards[3];
        if (c) setAnnounceText(`Turn: ${RANK_NAMES[c.rank]} of ${SUIT_NAMES[c.suit]}`);
      } else if (cards.length === 5) {
        const c = cards[4];
        if (c) setAnnounceText(`River: ${RANK_NAMES[c.rank]} of ${SUIT_NAMES[c.suit]}`);
      }
    } else if (cards.length === 0) {
      prevCommunityCardCount.current = 0;
    }
  }, [gameState?.communityCards]);

  const handleStart = (setupConfig: SetupConfig) => {
    const handsPerLevel = BLIND_SPEEDS[setupConfig.blindSpeed];
    const payoutRatios = [...PAYOUT_RATIOS[setupConfig.payoutStructure]];

    const config = createDefaultConfig({
      startingChips: setupConfig.startingChips,
      handsPerLevel,
      payoutStructure: setupConfig.payoutStructure,
      payoutRatios,
      blindSchedule: DEFAULT_BLIND_SCHEDULE,
      initialSeed: setupConfig.customSeed || null,
      noLimp: setupConfig.noLimp,
    });

    // Build aiProfiles map: p1..p7 -> preset type string
    const aiProfiles: Record<string, string> = {};
    setupConfig.aiPresets.forEach((preset, i) => {
      aiProfiles[`p${i + 1}`] = preset;
    });

    startGame(config, aiProfiles);
  };

  const handlePlayAgain = () => {
    resetGame();
  };

  // Error screen
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 p-4">
        <div className="bg-red-900/50 border border-red-500 rounded-lg p-6 max-w-md w-full text-center space-y-4">
          <h2 className="text-xl font-bold text-red-400">Game Error</h2>
          <p className="text-gray-300 text-sm">{error}</p>
          <button
            onClick={handlePlayAgain}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded font-semibold transition-all duration-150 active:scale-95"
          >
            Back to Setup
          </button>
        </div>
      </div>
    );
  }

  // Setup screen: shown when not playing and no standings (fresh start)
  if (!isPlaying && !standings && !gameState) {
    return <SetupScreen onStart={handleStart} />;
  }

  // Results screen: shown when tournament is finished
  if (!isPlaying && standings) {
    return <ResultsScreen onPlayAgain={handlePlayAgain} />;
  }

  // Game table
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        overflow: 'hidden',
        background: '#0d1117',
      }}
    >
      {/* Screen-reader live region for game announcements */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announceText}
      </div>
      <TopBar
        onToggleSidePanel={() => setSidePanelOpen((v) => !v)}
        sidePanelOpen={sidePanelOpen}
      />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <main style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, minHeight: 0 }}>
          {/* Table — takes all remaining vertical space */}
          <div style={{ flex: 1, minHeight: 0 }}>
            <TableArea />
          </div>
          {/* Action panel — min-height so table position is stable; grows for safe area */}
          <div style={{ minHeight: '100px', flexShrink: 0 }}>
            <ActionPanel />
          </div>
        </main>
        <SidePanel
          mobileOpen={sidePanelOpen}
          onClose={() => setSidePanelOpen(false)}
        />
      </div>
    </div>
  );
}
