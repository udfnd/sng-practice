import { describe, it, expect } from 'vitest';
import { PRESETS, validateConstraints, getPreset, createFineTunedProfile } from '@/ai/presets';
import type { PresetType } from '@/types';

const PRESET_NAMES: PresetType[] = ['Nit', 'TAG', 'LAG', 'Station', 'Maniac', 'Shark'];

describe('AI Presets', () => {
  it('should define all 6 presets', () => {
    expect(Object.keys(PRESETS)).toHaveLength(6);
    for (const name of PRESET_NAMES) {
      expect(PRESETS[name]).toBeDefined();
    }
  });

  it.each(PRESET_NAMES)('%s should have correct presetType', (name) => {
    expect(PRESETS[name].presetType).toBe(name);
  });

  it.each(PRESET_NAMES)('%s should pass constraint validation', (name) => {
    const errors = validateConstraints(PRESETS[name]);
    expect(errors).toHaveLength(0);
  });

  it('should have expected VPIP values', () => {
    expect(PRESETS.Nit.vpip).toBe(0.10);
    expect(PRESETS.TAG.vpip).toBe(0.19);
    expect(PRESETS.LAG.vpip).toBe(0.30);
    expect(PRESETS.Station.vpip).toBe(0.45);
    expect(PRESETS.Maniac.vpip).toBe(0.55);
    expect(PRESETS.Shark.vpip).toBe(0.23);
  });

  it('all presets should have PFR ≤ VPIP', () => {
    for (const name of PRESET_NAMES) {
      expect(PRESETS[name].pfr).toBeLessThanOrEqual(PRESETS[name].vpip);
    }
  });

  it('all presets should have cBetFreq ≥ turnBarrel ≥ riverBarrel', () => {
    for (const name of PRESET_NAMES) {
      const p = PRESETS[name];
      expect(p.cBetFreq).toBeGreaterThanOrEqual(p.turnBarrel);
      expect(p.turnBarrel).toBeGreaterThanOrEqual(p.riverBarrel);
    }
  });

  it('all parameters should be in 0.0–1.0 range (except openRaiseSize and cBetSize)', () => {
    for (const name of PRESET_NAMES) {
      const p = PRESETS[name];
      expect(p.vpip).toBeGreaterThanOrEqual(0);
      expect(p.vpip).toBeLessThanOrEqual(1);
      expect(p.pfr).toBeGreaterThanOrEqual(0);
      expect(p.pfr).toBeLessThanOrEqual(1);
      expect(p.openRaiseSize).toBeGreaterThanOrEqual(2.0);
      expect(p.openRaiseSize).toBeLessThanOrEqual(4.0);
    }
  });
});

describe('validateConstraints', () => {
  it('should reject PFR > VPIP', () => {
    const profile = { ...getPreset('TAG'), pfr: 0.25, vpip: 0.19 };
    const errors = validateConstraints(profile);
    expect(errors.some((e) => e.field === 'pfr')).toBe(true);
  });

  it('should reject openLimpFreq + PFR > VPIP', () => {
    const profile = { ...getPreset('TAG'), openLimpFreq: 0.10, pfr: 0.16, vpip: 0.19 };
    const errors = validateConstraints(profile);
    expect(errors.some((e) => e.field === 'openLimpFreq')).toBe(true);
  });

  it('should reject turnBarrel > cBetFreq', () => {
    const profile = { ...getPreset('TAG'), turnBarrel: 0.90, cBetFreq: 0.70 };
    const errors = validateConstraints(profile);
    expect(errors.some((e) => e.field === 'turnBarrel')).toBe(true);
  });

  it('should accept valid custom profile', () => {
    const profile = { ...getPreset('TAG'), vpip: 0.22, pfr: 0.18 };
    expect(validateConstraints(profile)).toHaveLength(0);
  });
});

describe('getPreset', () => {
  it('should return a deep copy', () => {
    const copy = getPreset('TAG');
    copy.vpip = 0.99;
    expect(PRESETS.TAG.vpip).toBe(0.19); // original unchanged
  });
});

describe('createFineTunedProfile', () => {
  it('should apply overrides to preset base', () => {
    const { profile, errors } = createFineTunedProfile('TAG', { vpip: 0.22, pfr: 0.18 });
    expect(profile.vpip).toBe(0.22);
    expect(profile.pfr).toBe(0.18);
    expect(profile.presetType).toBe('TAG');
    expect(errors).toHaveLength(0);
  });

  it('should report constraint errors', () => {
    const { errors } = createFineTunedProfile('TAG', { pfr: 0.50 });
    expect(errors.length).toBeGreaterThan(0);
  });
});
