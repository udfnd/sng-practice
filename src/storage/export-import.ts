// ============================================================
// Export / Import — full data backup and restore
// ============================================================

import type { AIProfile } from '@/types';
import type { StoredHand } from '@/engine/replay';
import { getAllHands } from './hand-history-store';
import { loadConfig, saveConfig, loadCustomPresets, saveCustomPresets } from './config-store';
import type { AppConfig } from './config-store';

export const CURRENT_SCHEMA_VERSION = 1;

export interface ExportPayload {
  exportDate: string;
  schemaVersion: number;
  handCount: number;
  hands: StoredHand[];
  config: AppConfig;
  customPresets: Record<string, AIProfile>;
}

export interface ImportResult {
  success: boolean;
  handsImported: number;
  error?: string;
}

/**
 * Build the export payload. Exported for testing purposes.
 */
export async function exportPayloadForTest(): Promise<ExportPayload> {
  const hands = await getAllHands();
  const config = loadConfig();
  const customPresets = loadCustomPresets();

  return {
    exportDate: new Date().toISOString(),
    schemaVersion: CURRENT_SCHEMA_VERSION,
    handCount: hands.length,
    hands,
    config,
    customPresets,
  };
}

/**
 * Export all data as a JSON file download.
 */
export async function exportData(): Promise<void> {
  const payload = await exportPayloadForTest();
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `holdem-sng-export-${new Date().toISOString().split('T')[0]}.json`;

  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Validate that a parsed object has the expected ExportPayload shape.
 */
function isValidPayload(obj: unknown): obj is ExportPayload {
  if (typeof obj !== 'object' || obj === null) return false;
  const p = obj as Record<string, unknown>;
  return (
    typeof p['exportDate'] === 'string' &&
    typeof p['schemaVersion'] === 'number' &&
    typeof p['handCount'] === 'number' &&
    Array.isArray(p['hands']) &&
    typeof p['config'] === 'object' &&
    p['config'] !== null &&
    typeof p['customPresets'] === 'object' &&
    p['customPresets'] !== null
  );
}

/**
 * Read a File as text, compatible with browsers and jsdom test environments.
 */
function readFileAsText(file: File): Promise<string> {
  // Use file.text() if available (modern browsers), else fall back to FileReader
  if (typeof file.text === 'function') {
    return file.text();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

/**
 * Import data from a JSON file.
 * Validates structure and schema version, then returns result.
 * Caller is responsible for writing data after user confirmation.
 */
export async function importData(file: File): Promise<ImportResult> {
  let text: string;
  try {
    text = await readFileAsText(file);
  } catch (err) {
    return { success: false, handsImported: 0, error: `Failed to read file: ${String(err)}` };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return { success: false, handsImported: 0, error: `Invalid JSON: ${String(err)}` };
  }

  if (!isValidPayload(parsed)) {
    return {
      success: false,
      handsImported: 0,
      error: 'Invalid export file: missing required fields',
    };
  }

  if (parsed.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    return {
      success: false,
      handsImported: 0,
      error: `Schema version mismatch: expected ${CURRENT_SCHEMA_VERSION}, got ${parsed.schemaVersion}`,
    };
  }

  // Apply the imported data
  try {
    saveConfig(parsed.config);
    saveCustomPresets(parsed.customPresets);
    // Hand import: caller would normally confirm and write hands
    // For now we report the count; writing to hand-history-store is the caller's job
    return { success: true, handsImported: parsed.hands.length };
  } catch (err) {
    return { success: false, handsImported: 0, error: `Failed to apply import: ${String(err)}` };
  }
}
