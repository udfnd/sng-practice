import type { StorageEnvelope, TournamentState } from '@/types';
import { wrap } from './envelope';

const DB_NAME = 'holdem-sng';
const DB_VERSION = 1;
const HANDS_STORE = 'hands';
const SNAPSHOTS_STORE = 'snapshots';
const MAX_HANDS = 1000;

/**
 * Stored hand record.
 */
export interface StoredHand {
  handNumber: number;
  tournamentId: string;
  events: unknown[];
  timestamp: number;
}

/**
 * Open the IndexedDB database.
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(HANDS_STORE)) {
        const store = db.createObjectStore(HANDS_STORE, { keyPath: 'handNumber' });
        store.createIndex('tournamentId', 'tournamentId');
      }
      if (!db.objectStoreNames.contains(SNAPSHOTS_STORE)) {
        db.createObjectStore(SNAPSHOTS_STORE, { keyPath: 'tournamentId' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save a hand to IndexedDB. Enforces FIFO policy (max 1000 hands).
 */
export async function saveHand(hand: StoredHand): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(HANDS_STORE, 'readwrite');
  const store = tx.objectStore(HANDS_STORE);

  store.put(wrap(hand));

  // Enforce FIFO: count and delete oldest if over limit
  const countRequest = store.count();
  countRequest.onsuccess = () => {
    if (countRequest.result > MAX_HANDS) {
      const cursor = store.openCursor();
      let toDelete = countRequest.result - MAX_HANDS;
      cursor.onsuccess = () => {
        if (cursor.result && toDelete > 0) {
          cursor.result.delete();
          toDelete--;
          cursor.result.continue();
        }
      };
    }
  };

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Save a tournament snapshot for session resume.
 * One snapshot per tournament (overwritten each hand).
 */
export async function saveSnapshot(tournament: TournamentState): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(SNAPSHOTS_STORE, 'readwrite');
  const store = tx.objectStore(SNAPSHOTS_STORE);
  store.put(wrap(tournament));

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Load the latest tournament snapshot for session resume.
 */
export async function loadSnapshot(tournamentId: string): Promise<TournamentState | null> {
  const db = await openDB();
  const tx = db.transaction(SNAPSHOTS_STORE, 'readonly');
  const store = tx.objectStore(SNAPSHOTS_STORE);

  return new Promise((resolve, reject) => {
    const request = store.get(tournamentId);
    request.onsuccess = () => {
      const envelope = request.result as StorageEnvelope<TournamentState> | undefined;
      resolve(envelope?.data ?? null);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Export hand history as JSON.
 */
export async function exportHandHistory(): Promise<string> {
  const db = await openDB();
  const tx = db.transaction(HANDS_STORE, 'readonly');
  const store = tx.objectStore(HANDS_STORE);

  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => {
      resolve(JSON.stringify(request.result, null, 2));
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Clear all IndexedDB data.
 */
export async function clearAllDB(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction([HANDS_STORE, SNAPSHOTS_STORE], 'readwrite');
  tx.objectStore(HANDS_STORE).clear();
  tx.objectStore(SNAPSHOTS_STORE).clear();

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
