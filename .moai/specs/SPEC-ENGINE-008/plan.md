# SPEC-ENGINE-008 Implementation Plan

## Reference Documents

- `sng_tournament_rules_for_agent.md` — Section 4 (Action Rules), 5 (Betting End), 6 (Uncalled Bet), 7 (Pot Creation), 8 (Showdown)
- `sng_repo_audit_notes.md` — Issues 1-6 with file-level references

---

## Phase 1: P0 Betting Engine Fixes

### Task 1-A: Fix isAllInRunout() condition

**Files:** `src/engine/betting.ts`, `src/engine/orchestrator.ts`

**Current Problem:**
```typescript
// betting.ts:272-279
export function isAllInRunout(players: BettingPlayer[]): boolean {
  const nonFolded = players.filter((p) => !p.isFolded);
  if (nonFolded.length <= 1) return true;
  const active = nonFolded.filter((p) => !p.isAllIn);
  return active.length <= 1;  // BUG: 1 active player hasn't acted yet
}
```

**Fix:**
1. Change `isAllInRunout()` to return `true` ONLY when:
   - All non-folded players are all-in (active.length === 0), OR
   - Exactly 1 non-all-in player remains AND they have already matched the current bet (no facing decision)
2. In `orchestrator.ts` betting loop: move `isAllInRunout()` check AFTER `isBettingComplete()`, not before

**Approach:**
```typescript
export function isAllInRunout(players: BettingPlayer[], state: BettingRoundState): boolean {
  const nonFolded = players.filter((p) => !p.isFolded);
  if (nonFolded.length <= 1) return true;

  const withChips = nonFolded.filter((p) => !p.isAllIn);
  if (withChips.length === 0) return true; // all are all-in

  // 1 player with chips: only runout if they've matched the bet (no decision pending)
  if (withChips.length === 1) {
    const player = withChips[0]!;
    return player.currentBet >= state.currentBet && state.actedPlayerIds.includes(player.id);
  }

  return false; // 2+ players with chips = normal betting
}
```

**Regression Test:** `tests/engine/betting.test.ts`
- 3-player: UTG fold, SB shove → BB must get action before runout
- 2-player: A shove, B not acted → no runout until B acts

### Task 1-B: Fix short all-in no-reopen

**Files:** `src/engine/betting.ts`

**Current Problem:**
```typescript
// betting.ts:205-207
// A bet/raise reopens action for all previously acted players
// Clear acted list except current player
state.actedPlayerIds = [player.id];  // BUG: clears for ALL raises
```

**Fix:**
1. Only reset `actedPlayerIds` when the raise is a FULL raise (raiseIncrement >= lastFullRaiseSize)
2. For short all-in: only add the all-in player to actedPlayerIds, don't clear others

**Approach:**
```typescript
// After applying bet/raise:
if (result.raiseIncrement >= state.lastFullRaiseSize) {
  // Full raise: reopen betting for everyone
  state.lastFullRaiseSize = result.raiseIncrement;
  state.actedPlayerIds = [player.id];
} else {
  // Short all-in: do NOT reopen betting for already-acted players
  if (!state.actedPlayerIds.includes(player.id)) {
    state.actedPlayerIds.push(player.id);
  }
}
```

**Also fix `getValidActions()`** in `action-order.ts:198`:
```typescript
// Current: canRaise = facingBet > 0 && stack > 0;
// Fix: canRaise only if player hasn't acted OR faces a full raise
const canRaise = facingBet > 0 && stack > 0 && (
  !state.actedPlayerIds.includes(player.id) ||
  hasReopen(player.id, state)
);
```

Wait — `getValidActions()` doesn't currently receive `state` or player ID. Need to extend the signature.

**Revised approach for getValidActions():**
Add `playerId` and `bettingRound` state to enable reopen check:
```typescript
export function getValidActions(
  player: BettingPlayer,
  bettingRound: BettingRoundState,
  bb: number,
  hasReopenRight?: boolean,  // new param: caller computes this
): ValidActionsResult
```

Where `hasReopenRight = !actedPlayerIds.includes(playerId) || hasReopen(playerId, state)`

**Regression Test:** `tests/engine/betting.test.ts`
- A bets 100, B calls 100, C short all-in 150 → A can only call/fold (not raise)
- A bets 100, B short all-in 150, C (never acted) → C can still raise

### Task 1-C: Fix fold-win event sourcing parity

**Files:** `src/engine/orchestrator.ts`, `src/engine/event-reducer.ts`

**Current Problem:**
Fold-win flow: `handleFoldWin()` → `AWARD_POT(totalPot)` but `handleUncalledBet()` runs separately, causing AWARD_POT amount to not match the actual remaining pot after uncalled return.

**Fix — Unified hand settlement function:**

Create `settleHandEnd()` in orchestrator:
```typescript
function settleHandEnd(tournament, events): void {
  // 1. Return uncalled bet
  handleUncalledBet(tournament, events);

  // 2. Collect all outstanding bets into pots
  collectBetsIntoPots(gameState);

  // 3. If fold-win (single survivor)
  if (isFoldWin(gameState)) {
    const winner = gameState.players.find(p => p.isActive && !p.isFolded)!;
    const totalPot = gameState.mainPot + sidePots.total;
    winner.chips += totalPot;
    gameState.mainPot = 0;
    gameState.sidePots = [];
    events.push(awardPotEvent(handNumber, 0, [{ playerId: winner.id, amount: totalPot }]));
    return;
  }

  // 4. Otherwise: showdown (handled by runShowdown)
}
```

**Reducer fix:**
- Remove `collectOutstandingBets()` compensation in `applyAwardPot()` (line 284)
- Events should now be self-consistent; no need for reducer-side guessing

**Regression Test:** `tests/engine/orchestrator.test.ts`, `tests/engine/event-reducer.test.ts`
- BB walk: UNCALLED_RETURN + AWARD_POT amounts match, reducer parity exact
- Preflop fold-win: same parity check
- Multi-street fold-win: same check

### Task 1-D: Remove side-pot eligible fallback

**Files:** `src/engine/orchestrator.ts`

**Current Problem:**
```typescript
// orchestrator.ts:569-573
if (sidePotEligible.length === 0) {
  sidePotEligible = reveals;  // BUG: masks upstream errors
}
```

**Fix:**
```typescript
if (sidePotEligible.length === 0) {
  throw new Error(
    `Side pot ${potIndex} has no eligible players. ` +
    `Eligible IDs: [${sidePot.eligiblePlayerIds.join(',')}], ` +
    `Reveal IDs: [${reveals.map(r => r.playerId).join(',')}]`
  );
}
```

---

## Phase 2: P1 Showdown/Settlement Fixes

### Task 2-A: Reverse pot settlement order

**Files:** `src/engine/orchestrator.ts`

**Change:** In `runShowdown()`, settle side pots first (reverse order: last created = most restricted → first), then main pot.

```typescript
// Current: main pot → side pots
// Fix: side pots (reversed) → main pot
const reversedSidePots = [...gameState.sidePots].reverse();
for (const sidePot of reversedSidePots) { ... }
// Then main pot
```

### Task 2-B: Separate showdown reveal logic

**Files:** `src/engine/showdown.ts`

**Change:** Split into two functions:
- `getAllInReveals()`: returns all non-folded players (no ordering needed, all tabled)
- `getShowdownOrder()`: applies TDA ordering (last aggressor first, then button-left)

---

## Phase 3: Deterministic Regression Tests

### Required Test Fixtures

All tests use deterministic state (no randomness):

| # | Fixture | Validates |
|---|---------|-----------|
| 1 | BB walk (all fold to BB) | AWARD_POT amount, reducer parity |
| 2 | Preflop fold-win | Uncalled return + award sum |
| 3 | All-in facing decision | BB gets action after SB shove |
| 4 | Short all-in no-reopen | Previously-acted player can't raise |
| 5 | Single side-pot | Correct eligible sets, winner per pot |
| 6 | Multi side-pot | 3-tier pot with different winners |
| 7 | Split pot + odd chip | Odd chip to button-left winner |
| 8 | Simultaneous elimination | Ranking by start-of-hand stack |
| 9 | Event parity (every hand) | live state == replay(events) |

### Parity Assertion Helper

Create `assertEventParity(liveState, events)` that:
1. Replays all events through event-reducer
2. Compares every player's `chips` value
3. Verifies `mainPot === 0`, all `sidePots.amount === 0`, all `currentBet === 0`
4. Verifies total chip conservation

---

## Implementation Order

1. **Task 1-C** (fold-win parity) — foundational, enables parity testing
2. **Task 1-D** (remove fallback) — quick safety fix
3. **Task 1-A** (runout condition) — critical gameplay fix
4. **Task 1-B** (short all-in) — complex, needs careful testing
5. **Phase 3** (regression tests) — validates all P0 fixes
6. **Task 2-A** (pot order) — safe change after P0 validated
7. **Task 2-B** (showdown separation) — cleanup refactor

## Risk Analysis

| Risk | Impact | Mitigation |
|------|--------|------------|
| Changing betting loop breaks existing games | High | Run all 791 tests + 100-SNG simulation after each task |
| Event reducer changes break hand history replay | High | Parity test on every hand in simulation |
| Side-pot assertion kills games with upstream bugs | Medium | Fix upstream first (Task 1-C), then enable assertion |
| getValidActions signature change ripples | Medium | New optional param with backward-compatible default |
