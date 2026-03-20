# SPEC-ENGINE-006: Event System & Invariants

## Status: Draft
## Phase: 1 (Engine + Worker)
## Priority: P0 (Critical)
## Dependencies: SPEC-ENGINE-001, SPEC-ENGINE-005

---

## 1. Overview

Implement the event system with 11 event types, the GameEvent interface with common base fields, invariant assertions (chip conservation, action legality, event ordering), and deterministic replay capability.

## 2. Requirements (EARS Format)

### R1: Event Types
**The system shall** support 11 event types:
HAND_START, POST_BLIND, DEAL_HOLE, DEAL_COMMUNITY, PLAYER_ACTION, UNCALLED_RETURN, SHOWDOWN, AWARD_POT, PLAYER_ELIMINATED, BLIND_LEVEL_UP, TOURNAMENT_END

### R2: GameEvent Interface
**The system shall** define a common base for all events:
- `type`: GameEventType (discriminant)
- `timestamp`: number (non-canonical, debug/UI only, excluded from determinism comparison)
- `handNumber`: number
- `sequenceIndex`: number (monotonically increasing within hand, 0,1,2,...)
- `payload`: EventPayload (discriminated union by type)

### R3: Event Payloads
**The system shall** define payloads per design doc Section 4.3:
- HAND_START: handNumber, seed, blindLevel, buttonSeat, sbSeat, bbSeat, stacks[]
- POST_BLIND: playerId, amount, type(SB|BB|BBA)
- PLAYER_ACTION: playerId, action, amount, isAllIn
- AWARD_POT: potIndex, payouts[]{playerId, amount}
- (All other payloads as specified)

### R4: Chip Conservation Invariant
**After** every event is applied, **the system shall** assert:
`sum(player.chips) + sum(player.currentBet) + mainPot + sum(sidePots) === totalChips`
Failure = immediate error (not a warning).

### R5: Action Legality Invariant
**The system shall** verify that only the current player can emit PLAYER_ACTION events.

### R6: Event Ordering Invariant
**The system shall** verify that sequenceIndex is strictly monotonically increasing within each hand.

### R7: Deterministic Replay
**The system shall** support forward-only replay:
- Given HAND_START snapshot + event sequence → identical GameState
- Jump = replay from HAND_START
- Same seed + same actions = identical outcome

### R8: Showdown Procedure
**The system shall** implement showdown ordering per design doc Section 3.8:
- All-in players: hands revealed immediately
- Non-all-in: last aggressor reveals first
- No aggressor (check-through): first-to-act reveals first
- AI always shows (learning UX exception)

## 3. Acceptance Criteria

- [ ] AC1: All 11 event types can be created with correct payloads
- [ ] AC2: sequenceIndex is monotonically increasing in a complete hand
- [ ] AC3: Chip conservation invariant catches 1-chip discrepancy
- [ ] AC4: Illegal action (wrong player) is rejected
- [ ] AC5: Replay of 100 hands with fixed seed produces identical state
- [ ] AC6: timestamp excluded from determinism comparison
- [ ] AC7: AWARD_POT.potIndex 0=main, 1..N=side pots in correct order
- [ ] AC8: Showdown reveals in correct order (aggressor first)

## 4. Files to Create

```
src/engine/events.ts           - Event types, payloads, creation helpers
src/engine/invariants.ts       - Chip conservation, action legality assertions
src/engine/replay.ts           - Deterministic replay engine
src/engine/showdown.ts         - Showdown procedure (reveal order, muck rules)
tests/engine/events.test.ts    - Event creation and ordering tests
tests/engine/invariants.test.ts - Invariant assertion tests
tests/engine/replay.test.ts    - Deterministic replay tests
tests/engine/showdown.test.ts  - Showdown ordering tests
```

## 5. Design Doc Reference

- Section 4.1: Source of Truth
- Section 4.2: Chip Accounting Model
- Section 4.3: Event Types
- Section 4.5: Event Interface
- Section 4.6: Invariants
- Section 4.7: Replay
- Section 3.8: Showdown Procedure
