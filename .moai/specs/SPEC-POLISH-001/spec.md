# SPEC-POLISH-001: Storage & Persistence

## Status: Draft
## Phase: 4 (Polish)
## Priority: P1 (High)
## Dependencies: SPEC-ENGINE-006, SPEC-AI-004, SPEC-UI-004

---

## 1. Overview

Implement the persistence layer using LocalStorage for config/presets and IndexedDB for hand history and session snapshots. All data wrapped in StorageEnvelope with schema versioning and migration support.

## 2. Requirements (EARS Format)

### R1: StorageEnvelope
**The system shall** wrap all persisted data in:
```typescript
interface StorageEnvelope<T> {
  schemaVersion: number;
  data: T;
  savedAt: number; // timestamp
}
```
Migration via `migrate()` when schemaVersion mismatch detected.

### R2: LocalStorage (Config)
**The system shall** store in LocalStorage:
- Tournament configuration (starting chips, blind speed, payout structure)
- AI presets (custom fine-tuned profiles)
- UI preferences (theme, animation speed)
- Size limit: < 5MB total

### R3: IndexedDB (Hand History)
**The system shall** store in IndexedDB:
- Hand events + snapshots per hand (StorageEnvelope<StoredHand>)
- FIFO policy: max 1,000 hands (oldest deleted when exceeded)
- Write target: < 50ms per hand (async)

### R4: Session Snapshot
**The system shall** save a TournamentState snapshot:
- Saved after every hand completion
- One snapshot per tournament (overwritten each hand)
- Enables resume after browser restart

### R5: Session Resume
**When** the application starts and a session snapshot exists, **the system shall** offer to resume the tournament from the last completed hand.

### R6: Export/Import
**The system shall** support:
- Export hand history as JSON file
- Export tournament results as JSON
- Import not required for v1

### R7: Data Reset
**The system shall** provide a reset function:
- Confirmation dialog required
- Clears all LocalStorage and IndexedDB data

## 3. Acceptance Criteria

- [ ] AC1: StorageEnvelope wraps all stored data with schemaVersion
- [ ] AC2: Config saves to and loads from LocalStorage correctly
- [ ] AC3: Hand history writes to IndexedDB within 50ms
- [ ] AC4: FIFO policy: 1001st hand deletes the oldest
- [ ] AC5: Session snapshot enables tournament resume after page reload
- [ ] AC6: Export produces valid JSON file download
- [ ] AC7: Reset clears all data after confirmation
- [ ] AC8: Schema migration handles version 1→2 upgrade

## 4. Files to Create

```
src/storage/envelope.ts          - StorageEnvelope + migration
src/storage/local-storage.ts     - LocalStorage wrapper (config/presets)
src/storage/indexed-db.ts        - IndexedDB wrapper (hand history/snapshot)
src/storage/export.ts            - JSON export functionality
tests/storage/envelope.test.ts   - Envelope + migration tests
tests/storage/local-storage.test.ts - LocalStorage tests
tests/storage/indexed-db.test.ts - IndexedDB tests
```

## 5. Design Doc Reference

- Section 8: Storage & Persistence
- Section 8.2: Storage Envelope
- Section 8.3: Serialization Rules
- Section 8.4: Session Resume
- Section 8.5: Policy
