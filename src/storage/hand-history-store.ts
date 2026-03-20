// ============================================================
// Hand History Store — IndexedDB persistence
// DB: holdem-sng-db, Store: handHistory
// ============================================================

import type { StorageEnvelope } from '@/types';
import type { StoredHand } from '@/engine/replay';
import { wrap, unwrap } from './envelope';

const DB_NAME = 'holdem-sng-db';
export const DB_VERSION = 2;
const STORE_NAME = 'handHistory';
const MAX_HANDS = 1000;

// Extend StoredHand with storage metadata required for keyPath and sorting
export type PersistedHand = StoredHand & { id: string; savedAt: number };

export function openHandDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const oldVersion = event.oldVersion;

      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'data.id' });
          store.createIndex('savedAt', 'savedAt');
        }
      }
      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains('sessionSnapshot')) {
          db.createObjectStore('sessionSnapshot', { keyPath: 'id' });
        }
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save a hand to IndexedDB. Wraps in StorageEnvelope.
 * Enforces FIFO policy (max 1000 hands).
 */
export async function saveHand(hand: PersistedHand): Promise<void> {
  const db = await openHandDB();

  // First check count and delete oldest if needed
  const count = await getHandCount();
  if (count >= MAX_HANDS) {
    await deleteOldestHands(count - MAX_HANDS + 1);
  }

  const envelope = wrap(hand);
  // Copy savedAt to top level for index
  const record = Object.assign({}, envelope, { savedAt: hand.savedAt });

  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  store.put(record);

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Retrieve a single hand by its id. Returns null if not found.
 */
export async function getHand(handId: string): Promise<StoredHand | null> {
  const db = await openHandDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);

  return new Promise((resolve, reject) => {
    const request = store.get(handId);
    request.onsuccess = () => {
      const record = request.result as (StorageEnvelope<PersistedHand> & { savedAt: number }) | undefined;
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
 * Retrieve all stored hands, ordered by savedAt ascending.
 */
export async function getAllHands(): Promise<StoredHand[]> {
  const db = await openHandDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const index = store.index('savedAt');

  return new Promise((resolve, reject) => {
    const request = index.getAll();
    request.onsuccess = () => {
      const records = request.result as (StorageEnvelope<PersistedHand> & { savedAt: number })[];
      resolve(records.map((r) => unwrap(r)));
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get the total number of stored hands.
 */
export async function getHandCount(): Promise<number> {
  const db = await openHandDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);

  return new Promise((resolve, reject) => {
    const request = store.count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete the oldest `count` hands (by savedAt).
 */
export async function deleteOldestHands(count: number): Promise<void> {
  if (count <= 0) return;

  const db = await openHandDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  const index = store.index('savedAt');

  return new Promise((resolve, reject) => {
    let deleted = 0;
    const request = index.openCursor(null, 'next');

    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor || deleted >= count) {
        return;
      }
      cursor.delete();
      deleted++;
      cursor.continue();
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Remove all stored hands.
 */
export async function clearAllHands(): Promise<void> {
  const db = await openHandDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).clear();

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
