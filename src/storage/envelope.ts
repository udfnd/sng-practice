import type { StorageEnvelope } from '@/types';

const CURRENT_SCHEMA_VERSION = 1;

/**
 * Wrap data in a StorageEnvelope for persistence.
 */
export function wrap<T>(data: T): StorageEnvelope<T> {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    data,
    savedAt: Date.now(),
  };
}

/**
 * Unwrap a StorageEnvelope, running migrations if needed.
 */
export function unwrap<T>(envelope: StorageEnvelope<T>): T {
  if (envelope.schemaVersion < CURRENT_SCHEMA_VERSION) {
    return migrate(envelope);
  }
  return envelope.data;
}

/**
 * Migrate data from older schema versions.
 */
function migrate<T>(envelope: StorageEnvelope<T>): T {
  // Future: add migration logic per version
  // For now, return data as-is
  return envelope.data;
}
