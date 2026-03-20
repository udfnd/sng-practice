import type { PresetType } from '@/types';

interface PresetSelectorProps {
  value: PresetType;
  onChange: (preset: PresetType) => void;
  label?: string;
}

const PRESET_DESCRIPTIONS: Record<PresetType, { style: string; trait: string }> = {
  Nit: { style: 'Tight-Passive', trait: 'Premium only' },
  TAG: { style: 'Tight-Aggressive', trait: 'Strong standard' },
  LAG: { style: 'Loose-Aggressive', trait: 'Wide + aggressive' },
  Station: { style: 'Loose-Passive', trait: 'Calls too much' },
  Maniac: { style: 'Hyper-Aggressive', trait: 'Ultra aggressive' },
  Shark: { style: 'Balanced', trait: 'GTO-ish, best opponent' },
};

const PRESET_NAMES: PresetType[] = ['Nit', 'TAG', 'LAG', 'Station', 'Maniac', 'Shark'];

export function PresetSelector({ value, onChange, label }: PresetSelectorProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs text-gray-400">{label}</label>}
      <div className="grid grid-cols-3 gap-2">
        {PRESET_NAMES.map((preset) => {
          const desc = PRESET_DESCRIPTIONS[preset];
          const isSelected = preset === value;
          return (
            <button
              key={preset}
              onClick={() => onChange(preset)}
              className={`flex flex-col items-center p-2 rounded border text-xs transition-colors ${
                isSelected
                  ? 'border-yellow-500 bg-yellow-500/10 text-yellow-400'
                  : 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500'
              }`}
            >
              <span className="font-semibold">{preset}</span>
              <span className="text-[10px] text-gray-400">{desc.style}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
