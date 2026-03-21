# SPEC-AI-008 Implementation Plan: ICM Calculation Engine & Bubble Factor

## Milestone 1: ICM Core Calculator (Primary Goal)

### Task 1.1: Create src/ai/icm.ts -- Malmuth-Harville ICM

- Implement `calculateICM(stacks: number[], payouts: number[]): number[]`
- Malmuth-Harville recursive formula:
  - P(player i finishes 1st) = stack_i / totalChips
  - P(player i finishes kth) = sum over all j != i: P(j finishes 1st) * P(i finishes kth | j already placed, remove j's stack)
  - Equity_i = sum over all positions k: P(i finishes kth) * payout[k]
- Handle edge cases: single player remaining, zero stacks, empty payout array
- Optimize: for 8 players / 3 payouts, precompute permutations

### Task 1.2: ICM Unit Tests

- Create `tests/ai/icm.test.ts`
- Test cases:
  - Equal stacks (4 players, equal chips): each gets 25% equity
  - One dominant stack: chip leader gets disproportionately more equity
  - One micro stack near bubble: very low equity despite having chips
  - 2 players remaining: equity proportional to stacks (no bubble effect)
  - Known reference values from poker ICM calculators (e.g., ICMIZER reference)
  - Sum of equities equals total prize pool (invariant)

**Files created**: `src/ai/icm.ts`, `tests/ai/icm.test.ts`

## Milestone 2: Bubble Factor (Primary Goal)

### Task 2.1: Implement computeBubbleFactor

- `computeBubbleFactor(stacks, payouts, playerIndex, effectiveOpponentStack)`
- Calculate:
  - `currentEquity = calculateICM(stacks, payouts)[playerIndex]`
  - `stacksAfterLoss`: player loses effectiveStack, opponent gains it
  - `stacksAfterWin`: player gains effectiveStack, opponent loses it
  - `equityAfterLoss = calculateICM(stacksAfterLoss, payouts)[playerIndex]` (0 if busted)
  - `equityAfterWin = calculateICM(stacksAfterWin, payouts)[playerIndex]`
  - `bubbleFactor = (currentEquity - equityAfterLoss) / (equityAfterWin - currentEquity)`
- Clamp to minimum 1.0

### Task 2.2: Bubble Factor Unit Tests

- Test bubble factor = ~1.0 for 8 players early tournament (far from bubble)
- Test bubble factor > 1.5 for medium stack when 4 players remain (3 paid)
- Test bubble factor > 2.0 for short stack on exact bubble (4 players, 3 paid)
- Test chip leader has lower bubble factor than short stack
- Test heads-up: bubble factor = 1.0

**Files modified**: `src/ai/icm.ts`
**Files created**: test cases added to `tests/ai/icm.test.ts`

## Milestone 3: Push/Fold Integration (Primary Goal)

### Task 3.1: Extend PreflopContext

- Add to `PreflopContext` interface:
  - `allStacks: number[]` -- all active player stack sizes
  - `payoutAmounts: number[]` -- payout structure in chips
  - `playerStackIndex: number` -- index of acting player in allStacks
- Update `buildPreflopContext` in `action-selector.ts` to populate these fields from `GameState` and `TournamentConfig`

### Task 3.2: Integrate ICM into pushFoldDecision

- In `preflop.ts` `pushFoldDecision`:
  - Call `computeBubbleFactor(ctx.allStacks, ctx.payoutAmounts, ctx.playerStackIndex, effectiveStack)`
  - Apply `bubbleTightness` scaling: `effectiveBF = 1 + (rawBF - 1) * profile.bubbleTightness`
  - Apply `icmAwareness` interpolation:
    - `chipEVThreshold = pushThreshold` (current formula)
    - `icmThreshold = pushThreshold / effectiveBF`
    - `finalThreshold = chipEVThreshold * (1 - profile.icmAwareness) + icmThreshold * profile.icmAwareness`
  - Also adjust call threshold similarly

### Task 3.3: Chip Leader Loosening

- If player's stack is the largest at the table by >30%, and bubble factor for the shortest stack > 1.5:
  - Widen push threshold by 15%: `finalThreshold *= 1.15`
  - This simulates the chip leader exploiting ICM pressure on others

**Files modified**: `src/ai/preflop.ts`, `src/ai/action-selector.ts`

## Milestone 4: Preflop Situation Adjustments (Secondary Goal)

### Task 4.1: Situation C/D/E ICM Integration

- Pass bubble factor through PreflopContext to situation functions
- Situation C: `callingCutoff *= (1 / effectiveBF)` scaled by icmAwareness
- Situation D: `foldTo3Bet += bubbleTightness * (effectiveBF - 1) * 0.3` scaled by icmAwareness
- Situation E: `bbDefenseCutoff *= (1 - bubbleTightness * (effectiveBF - 1) * 0.2)` scaled by icmAwareness

### Task 4.2: Integration Tests

- Create `tests/ai/icm-integration.test.ts`
- Test that Shark preset (icmAwareness=0.9) plays tighter than Maniac (icmAwareness=0.2) near bubble
- Test that bubble factor changes push/fold ranges measurably
- Test that icmAwareness=0 produces identical results to pre-ICM behavior

**Files modified**: `src/ai/preflop.ts`
**Files created**: `tests/ai/icm-integration.test.ts`

## Milestone 5: Tournament Context Plumbing (Secondary Goal)

### Task 5.1: Pass Payout Info to AI

- The AI currently has no access to payout structure
- Option A: Add `payoutRatios` to `GameState` (simpler, small state bloat)
- Option B: Pass through `PreflopContext`/`PostflopContext` only (cleaner but more plumbing)
- Recommendation: Option B -- add to PreflopContext since postflop ICM is less critical

**Files modified**: `src/ai/action-selector.ts`, `src/ai/preflop.ts` (PreflopContext type)

## Technical Approach

- **Pure functional**: ICM calculator is stateless, testable in isolation
- **Backward compatible**: icmAwareness=0 produces exactly current behavior
- **Incremental**: Push/fold integration first (highest impact), situation adjustments second

## Risks and Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| ICM calculation too slow for 8 players | Low (336 permutations) | Cache per hand; profile in tests |
| Bubble factor distorts play unrealistically | Medium | Calibrate against known SNG solver outputs |
| PreflopContext grows too large | Low | Only add fields needed for ICM |
| Existing calibration targets break | Medium | Re-run calibration after ICM integration; adjust targets if needed |
