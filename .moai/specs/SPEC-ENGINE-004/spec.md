# SPEC-ENGINE-004: Betting Round

## Status: Draft
## Phase: 1 (Engine + Worker)
## Priority: P0 (Critical)
## Dependencies: SPEC-ENGINE-001, SPEC-ENGINE-003

---

## 1. Overview

Implement betting round logic including min-raise tracking, short all-in with cumulative re-open detection, action validation, and heads-up blind structure. Covers TDA 2024 betting rules with moving-button house rule simplifications.

## 2. Requirements (EARS Format)

### R1: Action Types
**The system shall** support exactly 5 action types: FOLD, CHECK, CALL, BET, RAISE.
- ALL_IN is not a separate type; it is indicated by `isAllIn: boolean`
- FOLD/CHECK: amount = 0
- CALL: amount = min(facingBet, stack + currentBet)
- BET: total bet amount (first bet on a street)
- RAISE: raise-to total amount (includes call portion)

### R2: Minimum Raise
**The system shall** enforce minimum raise rules:
- Preflop: increment = BB, first raise minimum = 2×BB
- Postflop: first bet minimum = BB, min-raise = 2× current bet
- Track `lastFullRaiseSize` for re-open determination

### R3: Short All-in
**When** a player goes all-in for less than the minimum raise, **the system shall**:
- Accept the action as legal (isAllIn = true)
- NOT re-open betting for a single short all-in alone
- Track cumulative short all-ins

### R4: Cumulative Re-open
**When** multiple short all-ins accumulate such that a previously-acted player faces a total increment ≥ lastFullRaiseSize, **the system shall** re-open betting for that player.
- Track `playerLastFacedBet` per player for comparison
- Example: BB=100, A raises to 300 (increment=200). B all-in 380, C all-in 520. A faces 520-300=220 ≥ 200 → re-open

### R5: Heads-Up Blind Structure
**When** exactly 2 players remain, **the system shall** apply HU rules:
- Dealer/Button = SB, Non-dealer = BB
- Preflop: Dealer(SB) acts first
- Postflop: Non-dealer(BB) acts first

### R6: Action Validation
**The system shall** reject illegal actions:
- Action from non-current player
- CHECK when facing a bet
- BET when a bet already exists on the street
- RAISE below minimum (unless all-in)

### R7: Betting Round Completion
**The system shall** detect betting round completion when:
- All active (non-folded, non-all-in) players have acted and bets are equal
- Only one player remains (all others folded)
- All remaining players are all-in

## 3. Acceptance Criteria

- [ ] AC1: Standard preflop betting round (open, call, check) works correctly
- [ ] AC2: Min-raise tracking: raise after raise enforces correct minimum
- [ ] AC3: Short all-in accepted without re-opening for single occurrence
- [ ] AC4: Cumulative re-open triggers correctly (design doc example verified)
- [ ] AC5: HU preflop: SB(dealer) acts first
- [ ] AC6: HU postflop: BB(non-dealer) acts first
- [ ] AC7: Invalid actions are rejected with clear error messages
- [ ] AC8: Betting round completes when all bets equalized
- [ ] AC9: All-fold detection (only 1 player remains)
- [ ] AC10: All-in runout detection (no more betting possible)

## 4. Files to Create

```
src/engine/betting.ts              - BettingRound class
tests/engine/betting.test.ts       - Betting round tests (table-driven)
```

## 5. Design Doc Reference

- Section 3.1: Minimum Raise
- Section 3.2: Short All-in & Re-open
- Section 3.5: Heads-Up Blind & Transition
- Section 4.4: Action Semantics
- Section 7.2: Action & Betting types
