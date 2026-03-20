import { useState } from 'react';
import type { PresetType } from '@/types';
import { PresetSelector } from '@/components/settings/PresetSelector';

interface SetupScreenProps {
  onStart: (config: SetupConfig) => void;
}

export interface SetupConfig {
  startingChips: number;
  blindSpeed: 'Slow' | 'Normal' | 'Turbo' | 'Hyper';
  payoutStructure: 'top2' | 'top3';
  aiPresets: PresetType[];
  customSeed: string;
}

const DEFAULT_PRESETS: PresetType[] = ['TAG', 'LAG', 'Nit', 'Station', 'Shark', 'Maniac', 'TAG'];
const BLIND_SPEED_LABELS = { Slow: '20 hands', Normal: '10 hands', Turbo: '6 hands', Hyper: '3 hands' };

export function SetupScreen({ onStart }: SetupScreenProps) {
  const [startingChips, setStartingChips] = useState(1500);
  const [blindSpeed, setBlindSpeed] = useState<SetupConfig['blindSpeed']>('Normal');
  const [payoutStructure, setPayoutStructure] = useState<'top2' | 'top3'>('top3');
  const [aiPresets, setAiPresets] = useState<PresetType[]>(DEFAULT_PRESETS);
  const [customSeed, setCustomSeed] = useState('');

  const handleStart = () => {
    onStart({ startingChips, blindSpeed, payoutStructure, aiPresets, customSeed });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 p-4">
      <div className="w-full max-w-lg bg-gray-800 rounded-lg p-6 space-y-6">
        <h1 className="text-2xl font-bold text-center">Texas Hold'em SNG</h1>
        <h2 className="text-sm text-gray-400 text-center">8-Max Practice Tool</h2>

        {/* Starting Chips */}
        <div>
          <label className="text-xs text-gray-400 block mb-1">Starting Chips: {startingChips}</label>
          <input
            type="range"
            min={500} max={10000} step={100}
            value={startingChips}
            onChange={(e) => setStartingChips(Number(e.target.value))}
            className="w-full"
          />
        </div>

        {/* Blind Speed */}
        <div>
          <label className="text-xs text-gray-400 block mb-1">Blind Speed</label>
          <div className="grid grid-cols-4 gap-2">
            {(Object.keys(BLIND_SPEED_LABELS) as SetupConfig['blindSpeed'][]).map((speed) => (
              <button
                key={speed}
                onClick={() => setBlindSpeed(speed)}
                className={`p-2 rounded text-xs ${
                  speed === blindSpeed ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
                }`}
              >
                {speed}
                <br />
                <span className="text-[10px]">{BLIND_SPEED_LABELS[speed]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Payout */}
        <div>
          <label className="text-xs text-gray-400 block mb-1">Payout Structure</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setPayoutStructure('top3')}
              className={`p-2 rounded text-xs ${payoutStructure === 'top3' ? 'bg-blue-600' : 'bg-gray-700'}`}
            >
              Top 3: 50/30/20
            </button>
            <button
              onClick={() => setPayoutStructure('top2')}
              className={`p-2 rounded text-xs ${payoutStructure === 'top2' ? 'bg-blue-600' : 'bg-gray-700'}`}
            >
              Top 2: 65/35
            </button>
          </div>
        </div>

        {/* AI Opponents */}
        <div>
          <label className="text-xs text-gray-400 block mb-2">AI Opponents (7 seats)</label>
          <div className="space-y-2">
            {aiPresets.map((preset, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-12">Seat {i + 1}:</span>
                <PresetSelector
                  value={preset}
                  onChange={(p) => {
                    const next = [...aiPresets];
                    next[i] = p;
                    setAiPresets(next);
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Custom Seed */}
        <div>
          <label className="text-xs text-gray-400 block mb-1">Custom Seed (optional)</label>
          <input
            type="text"
            value={customSeed}
            onChange={(e) => setCustomSeed(e.target.value)}
            placeholder="Leave empty for random"
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
          />
        </div>

        {/* Start Button */}
        <button
          onClick={handleStart}
          className="w-full py-3 bg-green-600 hover:bg-green-500 rounded-lg font-bold text-lg transition-colors"
        >
          Start Game
        </button>
      </div>
    </div>
  );
}
