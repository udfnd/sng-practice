import { describe, it, expect, beforeEach } from 'vitest';
import { saveConfig, loadConfig, saveCustomPresets, loadCustomPresets } from '@/storage/config-store';
import type { AppConfig } from '@/storage/config-store';
import type { AIProfile } from '@/types';

const defaultConfig: AppConfig = {
  playerName: 'Player',
  startingChips: 1500,
  blindSpeed: 'Normal',
  payoutStructure: 'top3',
  customSeed: null,
};

function makeAiProfile(): AIProfile {
  return {
    presetType: 'TAG',
    vpip: 0.25,
    pfr: 0.2,
    threeBetFreq: 0.08,
    foldTo3Bet: 0.6,
    fourBetRatio: 0.15,
    openRaiseSize: 2.5,
    openLimpFreq: 0.05,
    positionAwareness: 0.7,
    cBetFreq: 0.65,
    cBetSize: 0.6,
    turnBarrel: 0.45,
    riverBarrel: 0.35,
    foldToCBet: 0.45,
    checkRaiseFreq: 0.1,
    bluffFreq: 0.15,
    icmAwareness: 0.6,
    pushFoldAccuracy: 0.8,
    stackSizeAdjust: 0.5,
    bubbleTightness: 0.6,
    bbDefenseBase: 0.35,
  };
}

describe('config-store', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // AC-9: Config persistence round-trip
  it('saves and loads config correctly', () => {
    const config: AppConfig = {
      playerName: 'Alice',
      startingChips: 2000,
      blindSpeed: 'Turbo',
      payoutStructure: 'top2',
      customSeed: 'my-seed-123',
    };
    saveConfig(config);
    const loaded = loadConfig();
    expect(loaded).toEqual(config);
  });

  it('returns defaults when nothing stored', () => {
    const config = loadConfig();
    expect(config).toEqual(defaultConfig);
  });

  it('overwrites previous config', () => {
    saveConfig({ ...defaultConfig, playerName: 'Bob' });
    saveConfig({ ...defaultConfig, playerName: 'Charlie' });
    const loaded = loadConfig();
    expect(loaded.playerName).toBe('Charlie');
  });

  it('saves and loads custom presets', () => {
    const presets: Record<string, AIProfile> = {
      MyProfile: makeAiProfile(),
    };
    saveCustomPresets(presets);
    const loaded = loadCustomPresets();
    expect(loaded).toEqual(presets);
    expect(loaded['MyProfile']?.presetType).toBe('TAG');
  });

  it('returns empty object when no presets stored', () => {
    const loaded = loadCustomPresets();
    expect(loaded).toEqual({});
  });

  // AC-19: localStorage 5MB size guard
  it('throws when data exceeds 5MB size limit', () => {
    // Create a config-like object with a huge string
    const bigConfig: AppConfig = {
      ...defaultConfig,
      playerName: 'x'.repeat(6 * 1024 * 1024), // 6MB string
    };
    expect(() => saveConfig(bigConfig)).toThrow(/size limit/i);
  });

  it('does not throw when data is under 5MB', () => {
    const normalConfig: AppConfig = { ...defaultConfig, playerName: 'NormalName' };
    expect(() => saveConfig(normalConfig)).not.toThrow();
  });

  // AC-20: Schema version check
  it('handles corrupted localStorage gracefully', () => {
    localStorage.setItem('holdem-sng:config', 'not-valid-json{{{');
    const loaded = loadConfig();
    expect(loaded).toEqual(defaultConfig);
  });
});
