# SPEC-ENGINE-005: Game State Machine

## Status: Draft
## Phase: 1 (Engine + Worker)
## Priority: P0 (Critical)
## Dependencies: SPEC-ENGINE-001, SPEC-ENGINE-002, SPEC-ENGINE-003, SPEC-ENGINE-004

---

## 1. Overview

Implement the core game state machine (10 states) that orchestrates hand flow from WAITING through HAND_COMPLETE. Event-sourced architecture: all state changes occur through event emission → reducer application. Includes seat resolver with moving-button model.

## 2. Requirements (EARS Format)

### R1: State Machine States
**The system shall** implement 10 game states with valid transitions:
1. WAITING → RESOLVE_SEATS
2. RESOLVE_SEATS → POSTING_BLINDS
3. POSTING_BLINDS → DEALING
4. DEALING → PREFLOP
5. PREFLOP → FLOP | SHOWDOWN | HAND_COMPLETE (fold-win)
6. FLOP → TURN | SHOWDOWN | HAND_COMPLETE (fold-win)
7. TURN → RIVER | SHOWDOWN | HAND_COMPLETE (fold-win)
8. RIVER → SHOWDOWN | HAND_COMPLETE (fold-win)
9. SHOWDOWN → HAND_COMPLETE
10. HAND_COMPLETE → WAITING

### R2: Seat Resolver (Moving-Button)
**When** a new hand starts, **the system shall** resolve buttonSeat, sbSeat, bbSeat:
- Moving-button model: no dead button, BTN/SB/BB always on active players
- Button advances clockwise to next active seat each hand
- 3→2 transition: previous BB's clockwise next surviving player = BB, other = BTN/SB

### R3: Event-Sourced Reducer
**The system shall** apply state changes only through event dispatch:
- `dispatch(event)` → reducer produces new GameState
- GameState is derived (read-only cache), Event Log is canonical
- No direct GameState mutation allowed

### R4: Auto-Runout
**When** all remaining players are all-in or folded (no more betting possible), **the system shall**:
- Reveal all-in players' hands (early showdown)
- Deal remaining community cards without betting
- Proceed directly to SHOWDOWN

### R5: Fold-Win Fast Path
**When** all players except one have folded, **the system shall**:
- collectBets (remaining streetBets → pot)
- UNCALLED_RETURN (return excess to last bettor)
- AWARD_POT (give pot to winner)
- HAND_COMPLETE (no showdown, winner's hand not revealed)

### R6: Blind Posting
**The system shall** post blinds in order: SB → BB → BBA
- BBA posted by BB player as dead money → mainPot
- Chip shortage: BB prioritized over BBA (Section 3.7)

### R7: Dealing
**The system shall** deal 2 hole cards per active player using the seeded PRNG deck.

## 3. Acceptance Criteria

- [ ] AC1: Complete hand flows through all 10 states correctly
- [ ] AC2: Moving-button: button advances clockwise each hand
- [ ] AC3: 3→2 HU transition assigns BTN/SB and BB correctly (all 3 cases from design doc)
- [ ] AC4: Event-sourced: replaying events from HAND_START produces identical GameState
- [ ] AC5: Auto-runout deals remaining cards when all are all-in
- [ ] AC6: Fold-win fast path: collectBets → UNCALLED_RETURN → AWARD_POT → HAND_COMPLETE
- [ ] AC7: BBA posts as dead money to mainPot, not to player.currentBet
- [ ] AC8: BBA chip shortage: BB=90(all-in), BBA=0 when player has 90 chips
- [ ] AC9: 3-bucket invariant holds through entire hand

## 4. Files to Create

```
src/engine/state-machine.ts    - GameStateMachine + reducer
src/engine/seat-resolver.ts    - Seat resolution (moving-button)
tests/engine/state-machine.test.ts  - Full hand flow tests
tests/engine/seat-resolver.test.ts  - Seat resolution tests (HU transition)
```

## 5. Design Doc Reference

- Section 2.2: State Machine
- Section 3.5: Heads-Up Transition
- Section 3.7: BBA Rules
- Section 4.1: Source of Truth (Event Log)
