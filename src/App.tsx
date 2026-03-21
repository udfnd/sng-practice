import { useState } from 'react';
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

export function App() {
  const isPlaying = useGameStore((s) => s.isPlaying);
  const gameState = useGameStore((s) => s.gameState);
  const standings = useGameStore((s) => s.standings);
  const error = useGameStore((s) => s.error);
  const startGame = useGameStore((s) => s.startGame);
  const resetGame = useGameStore((s) => s.resetGame);

  const [sidePanelOpen, setSidePanelOpen] = useState(false);

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
    <div className="flex flex-col h-screen overflow-hidden">
      <TopBar
        onToggleSidePanel={() => setSidePanelOpen((v) => !v)}
        sidePanelOpen={sidePanelOpen}
      />
      <div className="flex flex-1 overflow-hidden">
        <main className="flex flex-col flex-1 items-center justify-center overflow-hidden">
          <TableArea />
          <ActionPanel />
        </main>
        <SidePanel
          mobileOpen={sidePanelOpen}
          onClose={() => setSidePanelOpen(false)}
        />
      </div>
    </div>
  );
}
