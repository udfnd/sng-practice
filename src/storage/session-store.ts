// ============================================================
// Session Snapshot Store — IndexedDB persistence
// DB: holdem-sng-db, Store: sessionSnapshot
// Fixed key: "current" — only one snapshot at a time
// ============================================================

import type { TournamentState } from '@/types';
import { wrap, unwrap } from './envelope';

const DB_NAME = 'holdem-sng-db';
const DB_VERSION = 2;
const STORE_NAME = 'sessionSnapshot';
const SNAPSHOT_KEY = 'current';

function openSessionDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const oldVersion = event.oldVersion;

      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains('handHistory')) {
          const store = db.createObjectStore('handHistory', { keyPath: 'data.id' });
          store.createIndex('savedAt', 'savedAt');
        }
      }
      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save (or overwrite) the session snapshot.
 */
export async function saveSnapshot(state: TournamentState): Promise<void> {
  const db = await openSessionDB();
  const envelope = wrap(state);
  // Add fixed key for single-record store
  const record = Object.assign({}, envelope, { id: SNAPSHOT_KEY });

  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).put(record);

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Load the current session snapshot. Returns null if none exists.
 */
export async function loadSnapshot(): Promise<TournamentState | null> {
  const db = await openSessionDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);

  return new Promise((resolve, reject) => {
    const request = store.get(SNAPSHOT_KEY);
    request.onsuccess = () => {
      const record = request.result as ({ id: string } & ReturnType<typeof wrap<TournamentState>>) | undefined;
      if (!record) {
        resolve(null);
        return;
      }
      resolve(unwrap(record));
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete the current session snapshot.
 */
export async function deleteSnapshot(): Promise<void> {
  const db = await openSessionDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).delete(SNAPSHOT_KEY);

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
