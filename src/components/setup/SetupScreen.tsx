import { useState } from 'react';
import type { PresetType } from '@/types';

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
  const [noLimp, setNoLimp] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  const handleStartGame = () => {
    onStart({
      startingChips,
      blindSpeed,
      payoutStructure,
      aiPresets: DEFAULT_PRESETS,
      customSeed: '',
      noLimp,
    });
  };

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100dvh',
        background: '#0a0e14',
        fontFamily: 'Helvetica, Arial, sans-serif',
      }}
    >
      {/* Left Panel */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '48px',
          width: '420px',
          minWidth: '320px',
          flexShrink: 0,
          zIndex: 2,
        }}
      >
        {/* Title */}
        <div style={{ marginBottom: '48px' }}>
          <h1
            style={{
              fontSize: '36px',
              fontWeight: 700,
              color: '#f1f5f9',
              lineHeight: 1.2,
              marginBottom: '8px',
            }}
          >
            8-Max Sit-and-Go
          </h1>
          <p style={{ fontSize: '14px', color: '#64748b' }}>
            Texas Hold'em Tournament Practice
          </p>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            onClick={handleStartGame}
            className="landing-start-btn"
          >
            Start Game
          </button>
          <button
            onClick={() => setShowSettings(true)}
            style={{
              padding: '14px 32px',
              fontSize: '15px',
              fontWeight: 600,
              color: '#94a3b8',
              background: 'rgba(30, 41, 59, 0.6)',
              border: '1px solid #334155',
              borderRadius: '12px',
              cursor: 'pointer',
              transition: 'all 150ms',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(30, 41, 59, 0.9)';
              e.currentTarget.style.color = '#e2e8f0';
              e.currentTarget.style.borderColor = '#475569';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(30, 41, 59, 0.6)';
              e.currentTarget.style.color = '#94a3b8';
              e.currentTarget.style.borderColor = '#334155';
            }}
          >
            Settings
          </button>
        </div>

        {/* Current settings summary */}
        <div style={{ marginTop: '32px', fontSize: '13px', color: '#94a3b8', lineHeight: 2.2 }}>
          <div><span style={{ color: '#64748b' }}>Chips</span>  <span style={{ color: '#e2e8f0', fontWeight: 500 }}>{startingChips.toLocaleString()}</span></div>
          <div><span style={{ color: '#64748b' }}>Blinds</span>  <span style={{ color: '#e2e8f0', fontWeight: 500 }}>{blindSpeed}</span></div>
          <div><span style={{ color: '#64748b' }}>Payout</span>  <span style={{ color: '#e2e8f0', fontWeight: 500 }}>{payoutStructure === 'top3' ? 'Top 3 (50/30/20)' : 'Top 2 (65/35)'}</span></div>
          <div><span style={{ color: '#64748b' }}>Limp</span>  <span style={{ color: '#e2e8f0', fontWeight: 500 }}>{noLimp ? 'No' : 'Yes'}</span></div>
        </div>
      </div>

      {/* Right Panel - Hero image with overlay */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background image */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'url("https://images.unsplash.com/photo-1511193311914-0346f16efe90?w=1200&q=80")',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'brightness(0.7)',
          }}
        />
        {/* Semi-transparent gray overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(135deg, rgba(10, 14, 20, 0.85) 0%, rgba(20, 27, 36, 0.6) 50%, rgba(10, 14, 20, 0.75) 100%)',
          }}
        />
        {/* Decorative content */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            padding: '48px',
            zIndex: 1,
          }}
        >
          <div style={{ textAlign: 'center', color: '#475569' }}>
            <div style={{ fontSize: '64px', marginBottom: '16px', opacity: 0.4 }}>
              ♠ ♥ ♦ ♣
            </div>
            <div style={{ fontSize: '14px', fontWeight: 500, letterSpacing: '4px', textTransform: 'uppercase', opacity: 0.5 }}>
              Practice &middot; Improve &middot; Win
            </div>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Backdrop */}
          <div
            onClick={() => setShowSettings(false)}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.6)',
              backdropFilter: 'blur(4px)',
            }}
          />
          {/* Modal content */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '440px',
              margin: '16px',
              background: '#141b24',
              border: '1px solid #334155',
              borderRadius: '16px',
              padding: '32px',
              zIndex: 1,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#f1f5f9' }}>Settings</h2>
              <button
                onClick={() => setShowSettings(false)}
                style={{
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(100, 116, 139, 0.2)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#94a3b8',
                  fontSize: '18px',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Starting Chips */}
              <div>
                <label style={{ fontSize: '13px', color: '#94a3b8', display: 'block', marginBottom: '8px' }}>
                  Starting Chips: <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{startingChips.toLocaleString()}</span>
                </label>
                <input
                  type="range"
                  min={500} max={10000} step={100}
                  value={startingChips}
                  onChange={(e) => setStartingChips(Number(e.target.value))}
                  className="w-full"
                  style={{ accentColor: '#3b82f6' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#475569', marginTop: '4px' }}>
                  <span>500</span>
                  <span>10,000</span>
                </div>
              </div>

              {/* Blind Speed */}
              <div>
                <label style={{ fontSize: '13px', color: '#94a3b8', display: 'block', marginBottom: '8px' }}>Blind Speed</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                  {(Object.keys(BLIND_SPEED_LABELS) as SetupConfig['blindSpeed'][]).map((speed) => (
                    <button
                      key={speed}
                      onClick={() => setBlindSpeed(speed)}
                      style={{
                        padding: '10px 4px',
                        fontSize: '12px',
                        fontWeight: speed === blindSpeed ? 600 : 400,
                        color: speed === blindSpeed ? '#ffffff' : '#94a3b8',
                        background: speed === blindSpeed ? '#3b82f6' : 'rgba(51, 65, 85, 0.4)',
                        border: `1px solid ${speed === blindSpeed ? '#3b82f6' : '#334155'}`,
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 150ms',
                        textAlign: 'center',
                      }}
                    >
                      {speed}
                      <br />
                      <span style={{ fontSize: '10px', opacity: 0.7 }}>{BLIND_SPEED_LABELS[speed]}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Payout Structure */}
              <div>
                <label style={{ fontSize: '13px', color: '#94a3b8', display: 'block', marginBottom: '8px' }}>Payout Structure</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {[
                    { value: 'top3' as const, label: 'Top 3', detail: '50 / 30 / 20' },
                    { value: 'top2' as const, label: 'Top 2', detail: '65 / 35' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setPayoutStructure(opt.value)}
                      style={{
                        padding: '10px',
                        fontSize: '13px',
                        fontWeight: payoutStructure === opt.value ? 600 : 400,
                        color: payoutStructure === opt.value ? '#ffffff' : '#94a3b8',
                        background: payoutStructure === opt.value ? '#3b82f6' : 'rgba(51, 65, 85, 0.4)',
                        border: `1px solid ${payoutStructure === opt.value ? '#3b82f6' : '#334155'}`,
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 150ms',
                        textAlign: 'center',
                      }}
                    >
                      {opt.label}
                      <br />
                      <span style={{ fontSize: '10px', opacity: 0.7 }}>{opt.detail}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Raise or Fold Only */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '13px', color: '#94a3b8' }}>Raise or Fold Only</div>
                  <div style={{ fontSize: '11px', color: '#475569' }}>AI never limps preflop</div>
                </div>
                <button
                  onClick={() => setNoLimp(!noLimp)}
                  style={{
                    width: '48px',
                    height: '26px',
                    borderRadius: '13px',
                    background: noLimp ? '#3b82f6' : '#334155',
                    border: 'none',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'background 150ms',
                  }}
                >
                  <span
                    style={{
                      display: 'block',
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      background: '#ffffff',
                      position: 'absolute',
                      top: '3px',
                      left: noLimp ? '25px' : '3px',
                      transition: 'left 150ms',
                    }}
                  />
                </button>
              </div>
            </div>

            {/* Done button */}
            <button
              onClick={() => setShowSettings(false)}
              style={{
                width: '100%',
                marginTop: '24px',
                padding: '12px',
                fontSize: '15px',
                fontWeight: 600,
                color: '#ffffff',
                background: '#3b82f6',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer',
                transition: 'background 150ms',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#2563eb'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#3b82f6'; }}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Mobile responsive — keep only layout overrides here, animations are in globals.css */}
      <style>{`
        @media (max-width: 768px) {
          div[style*="width: 420px"] {
            width: 100% !important;
            min-width: unset !important;
            padding: 32px 24px !important;
          }
          div[style*="flex: 1"][style*="overflow: hidden"] {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
