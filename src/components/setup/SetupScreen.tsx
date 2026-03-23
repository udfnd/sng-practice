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
  /** When true, AI players never limp — always raise or fold preflop. */
  noLimp: boolean;
}

const DEFAULT_PRESETS: PresetType[] = ['TAG', 'LAG', 'Nit', 'Station', 'Shark', 'Maniac', 'TAG'];
const BLIND_SPEED_LABELS = { Slow: '20 hands', Normal: '10 hands', Turbo: '6 hands', Hyper: '3 hands' };

export function SetupScreen({ onStart }: SetupScreenProps) {
  const [startingChips, setStartingChips] = useState(1500);
  const [blindSpeed, setBlindSpeed] = useState<SetupConfig['blindSpeed']>('Normal');
  const [payoutStructure, setPayoutStructure] = useState<'top2' | 'top3'>('top3');
  const [aiPresets, setAiPresets] = useState<PresetType[]>(DEFAULT_PRESETS);
  const [customSeed, setCustomSeed] = useState('');
  const [noLimp, setNoLimp] = useState(false);

  const handleStart = () => {
    onStart({ startingChips, blindSpeed, payoutStructure, aiPresets, customSeed, noLimp });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4" style={{ background: '#0d1117' }}>
      <div className="w-full max-w-lg rounded-lg p-6 space-y-6" style={{ background: '#161b22', border: '1px solid #30363d' }}>
        <h1 className="text-2xl font-bold text-center" style={{ color: '#e6edf3' }}>Texas Hold'em SNG</h1>
        <h2 className="text-sm text-center" style={{ color: '#8b949e' }}>8-Max Practice Tool</h2>

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

        {/* No Limp Mode */}
        <div className="flex items-center justify-between">
          <div>
            <label className="text-xs text-gray-400 block">Raise or Fold Only</label>
            <span className="text-[10px] text-gray-500">AI never limps — always raise or fold preflop</span>
          </div>
          <button
            onClick={() => setNoLimp(!noLimp)}
            className={`w-12 h-6 rounded-full transition-colors relative ${
              noLimp ? 'bg-blue-600' : 'bg-gray-600'
            }`}
          >
            <span
              className={`block w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${
                noLimp ? 'translate-x-6' : 'translate-x-0.5'
              }`}
            />
          </button>
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
