// ============================================================
// Config Store — localStorage persistence
// Uses StorageEnvelope wrapper with 5MB size guard
// ============================================================

import type { AIProfile } from '@/types';
import { wrap, unwrap } from './envelope';

export interface AppConfig {
  playerName: string;
  startingChips: number;
  blindSpeed: string;
  payoutStructure: string;
  customSeed: string | null;
}

const CONFIG_KEY = 'holdem-sng:config';
const PRESETS_KEY = 'holdem-sng:customPresets';
const SIZE_LIMIT_BYTES = 5 * 1024 * 1024; // 5MB

const DEFAULT_CONFIG: AppConfig = {
  playerName: 'Player',
  startingChips: 1500,
  blindSpeed: 'Normal',
  payoutStructure: 'top3',
  customSeed: null,
};

/**
 * Write a value to localStorage with StorageEnvelope and size guard.
 * Throws if the serialized value exceeds 5MB.
 */
function writeToLocal<T>(key: string, value: T): void {
  const envelope = wrap(value);
  const json = JSON.stringify(envelope);

  if (json.length > SIZE_LIMIT_BYTES) {
    throw new Error(
      `Storage size limit exceeded: data is ${json.length} bytes, limit is ${SIZE_LIMIT_BYTES} bytes`,
    );
  }

  localStorage.setItem(key, json);
}

/**
 * Read and unwrap a value from localStorage.
 * Returns null on any error (missing key, invalid JSON, etc.).
 */
function readFromLocal<T>(key: string): T | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;

  try {
    const envelope = JSON.parse(raw);
    return unwrap(envelope) as T;
  } catch {
    return null;
  }
}

/**
 * Save app configuration to localStorage.
 */
export function saveConfig(config: AppConfig): void {
  writeToLocal(CONFIG_KEY, config);
}

/**
 * Load app configuration. Returns defaults if nothing stored.
 */
export function loadConfig(): AppConfig {
  const stored = readFromLocal<AppConfig>(CONFIG_KEY);
  if (!stored) return { ...DEFAULT_CONFIG };
  return stored;
}

/**
 * Save custom AI presets to localStorage.
 */
export function saveCustomPresets(presets: Record<string, AIProfile>): void {
  writeToLocal(PRESETS_KEY, presets);
}

/**
 * Load custom AI presets. Returns empty object if nothing stored.
 */
export function loadCustomPresets(): Record<string, AIProfile> {
  return readFromLocal<Record<string, AIProfile>>(PRESETS_KEY) ?? {};
}
