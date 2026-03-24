---
id: SPEC-ENGINE-008
version: "1.0.0"
status: draft
created: "2026-03-24"
updated: "2026-03-24"
author: seungmok
priority: P0
issue_number: 0
---

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-03-24 | seungmok | Initial SPEC creation |

---

# SPEC-ENGINE-008: TDA-Compliant Tournament Engine Refactoring

## Overview

Refactor the tournament engine to comply with Poker TDA (Tournament Directors Association) rules and GG Poker-style online tournament standards. This addresses 6 critical bugs identified in a comprehensive code audit, focusing on betting round logic, pot settlement, event sourcing parity, and showdown procedures.

**Reference Documents:**
- `sng_tournament_rules_for_agent.md` — Authoritative rules specification
- `sng_repo_audit_notes.md` — Detailed code audit findings

---

## Requirements

### REQ-1: All-In Runout Condition (P0)

**EARS Type: Unwanted Behavior**

**IF** a player goes all-in during a betting round **AND** one or more non-folded players with remaining chips have not yet acted on the current bet,
**THEN** the system **SHALL NOT** transition to all-in runout mode,
**AND** the system **SHALL** continue the betting round until all non-folded players with chips have acted.

**Current Bug:** `isAllInRunout()` in `betting.ts:272-279` returns `true` when `active.length <= 1`, which triggers runout even when players still need to call/fold. The check at `orchestrator.ts:448` breaks the betting loop prematurely.

**Fix Target Files:** `src/engine/betting.ts`, `src/engine/orchestrator.ts`

### REQ-2: Short All-In No-Reopen (P0)

**EARS Type: Unwanted Behavior**

**IF** a player goes all-in for an amount that increases the current bet by less than the `lastFullRaiseSize`,
**THEN** the system **SHALL NOT** reopen betting for players who have already acted in this round,
**AND** previously-acted players **SHALL** only have fold/call options (not raise),
**BUT** players who have not yet acted this round **SHALL** retain full action rights including raise.

**Current Bug:** `betting.ts:207` clears `actedPlayerIds` to `[player.id]` on ALL raises, not just full raises. Combined with `isBettingComplete()` checking `actedPlayerIds`, this forces previously-acted players to act again even after a short all-in.

**Fix Target Files:** `src/engine/betting.ts`, `src/engine/action-order.ts`

### REQ-3: Fold-Win Event Sourcing Parity (P0)

**EARS Type: Unwanted Behavior**

**WHEN** a hand ends by all opponents folding (fold-win),
**THEN** the system **SHALL** process in this exact order:
1. Return uncalled bet portion to the winner (UNCALLED_RETURN event)
2. Collect remaining matched bets into pot
3. Award the pot to the sole survivor (AWARD_POT event with correct amount)

**AND** replaying the event sequence through the reducer **SHALL** produce a state identical to the live engine state (chips per player, mainPot=0, sidePots empty, currentBet=0 for all).

**Current Bug:** `orchestrator.ts:198-210` creates AWARD_POT with `totalPot` (pre-uncalled-return amount), while `handleUncalledBet()` at line 460 processes separately. The reducer at `event-reducer.ts:281-317` attempts compensation via `collectOutstandingBets()` but produces mismatched state.

**Fix Target Files:** `src/engine/orchestrator.ts`, `src/engine/event-reducer.ts`

### REQ-4: Side-Pot Fallback Removal (P0)

**EARS Type: Unwanted Behavior**

**IF** a side pot's eligible player set is empty during showdown resolution,
**THEN** the system **SHALL** throw an assertion error (not silently fallback),
**AND** the system **SHALL NOT** fall back to the full reveals list.

**Current Bug:** `orchestrator.ts:569-573` falls back to all reveals when `sidePotEligible.length === 0`, potentially awarding the pot to ineligible players.

**Fix Target Files:** `src/engine/orchestrator.ts`

### REQ-5: Side-Pot Settlement Order (P1)

**EARS Type: State-Driven**

**WHEN** the system distributes pots at showdown,
**THEN** the system **SHALL** settle side pots first (largest to smallest), then the main pot last,
**AND** each pot **SHALL** be evaluated independently with its own eligible player set.

**Current Implementation:** Main pot is settled first, then side pots. While mathematically equivalent for chip totals, this diverges from TDA standard presentation and makes debugging harder.

**Fix Target Files:** `src/engine/orchestrator.ts`

### REQ-6: Showdown Reveal Logic Separation (P1)

**EARS Type: State-Driven**

**WHEN** a hand reaches showdown,
**THEN** the system **SHALL** distinguish between:
- **All-in showdown:** All live (non-folded) hands are revealed simultaneously
- **Non-all-in showdown:** Last aggressor reveals first; if no aggressor on final street, first player left of button reveals first

**AND** the reveal order determination **SHALL** be separated from UI animation concerns.

**Fix Target Files:** `src/engine/showdown.ts`

---

## Constraints

- All 791 existing tests must continue to pass
- Chip conservation invariant must hold at all times
- Event sourcing parity (live state == replay state) must be verified for every hand
- No changes to the AI decision engine (src/ai/)
- No changes to the UI layer (src/components/)
- TypeScript strict mode compliance required

## Dependencies

- No external library changes required
- All changes are internal to `src/engine/` and `tests/`

## Scope Exclusions

- P2 items: sat-out/disconnect policy, dead button rules, BBA variant
- HU action order (already correct per audit)
- Odd chip handling (already correct per audit)
- UI-level showdown animation timing
