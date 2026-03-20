import type { StorageEnvelope } from '@/types';
import { wrap, unwrap } from './envelope';

const PREFIX = 'holdem-sng:';

/**
 * Save data to LocalStorage with StorageEnvelope wrapper.
 */
export function saveToLocal<T>(key: string, data: T): void {
  const envelope = wrap(data);
  localStorage.setItem(PREFIX + key, JSON.stringify(envelope));
}

/**
 * Load data from LocalStorage, unwrapping StorageEnvelope.
 * Returns null if not found.
 */
export function loadFromLocal<T>(key: string): T | null {
  const raw = localStorage.getItem(PREFIX + key);
  if (!raw) return null;

  try {
    const envelope: StorageEnvelope<T> = JSON.parse(raw);
    return unwrap(envelope);
  } catch {
    return null;
  }
}

/**
 * Remove a key from LocalStorage.
 */
export function removeFromLocal(key: string): void {
  localStorage.removeItem(PREFIX + key);
}

/**
 * Clear all app data from LocalStorage.
 */
export function clearAllLocal(): void {
  const keys = Object.keys(localStorage).filter((k) => k.startsWith(PREFIX));
  for (const key of keys) {
    localStorage.removeItem(key);
  }
}
