# SPEC-AI-010 Implementation Plan: Postflop Range Advantage & SPR-Based Sizing

## Milestone 1: SPR Calculator and Sizing (Primary Goal)

### Task 1.1: Create src/ai/spr.ts

- Implement `calculateSPR(effectiveStack: number, potSize: number): number`
  - Guard: if potSize <= 0, return Infinity
  - Return effectiveStack / potSize

- Implement `getSPRZone(spr: number): SPRZone`
  - < 2: 'ultra-low'
  - 2-4: 'low'
  - 4-7: 'medium-low'
  - 7-10: 'medium'
  - > 10: 'high'

- Implement `sprBetSize(spr: number, potSize: number, texture: BoardTexture, madeTier: MadeHandTier): number`
  - Base sizing by SPR zone:
    - ultra-low: `potSize * 1.5` (overbet/all-in)
    - low: `potSize * 0.80`
    - medium-low: `potSize * 0.60`
    - medium: `potSize * 0.45`
    - high: `potSize * 0.33`
  - Texture modifier:
    - dry: reduce by 10% (smaller on dry, less to protect against)
    - wet: increase by 10% (charge draws)
    - monotone: see polarization logic (R6)
    - paired: no modifier
  - Hand strength modifier:
    - tier 1 (strong): increase by 15%
    - tier 2 (decent): no modifier
    - tier 3 (weak): decrease by 20%
    - tier 4 (air/bluff): increase by 10% (bluff big)

### Task 1.2: SPR Unit Tests

- Create `tests/ai/spr.test.ts`
- Test SPR calculation: 3000 stack / 600 pot = 5.0
- Test SPR zones: verify boundary conditions
- Test bet sizing: verify each zone produces expected pot fractions
- Test pot=0 edge case: SPR = Infinity
- Test texture and tier modifiers change sizing directionally

**Files created**: `src/ai/spr.ts`, `tests/ai/spr.test.ts`

## Milestone 2: Range Advantage Scoring (Primary Goal)

### Task 2.1: Add computeRangeAdvantage to board-texture.ts

- `computeRangeAdvantage(communityCards: Card[], isAggressor: boolean): number`
- Returns a value in [-0.30, +0.30] added to c-bet frequency
- Scoring factors:
  - **High cards on board**: Count cards >= 10 (T, J, Q, K, A)
    - 0 high cards: -0.10 (low board, favors caller)
    - 1 high card: 0.00 (neutral)
    - 2+ high cards: +0.10 to +0.20 (high board, favors raiser)
  - **Board connectivity**: Count connected cards (gap <= 2)
    - 0 connections: +0.05 (disconnected, favors raiser)
    - 1 connection: 0.00
    - 2+ connections: -0.10 to -0.15 (connected, favors caller)
  - **Board pairing**: +0.05 per pair (raiser has more big pairs)
  - **Aggressor bonus**: if isAggressor, the advantage score is positive-biased (add +0.05)
  - **Non-aggressor**: invert sign of advantage (caller benefits from boards that hurt raiser)

### Task 2.2: Range Advantage Tests

- Test A-K-2 rainbow: high advantage for aggressor (> +0.15)
- Test 7-8-9 two-tone: negative advantage for aggressor (< -0.10)
- Test K-K-5: paired + high card, moderate advantage (> +0.10)
- Test 3-4-5-6: very connected, strong caller advantage (< -0.15)

**Files modified**: `src/ai/board-texture.ts`

## Milestone 3: Multiway Pot Penalty (Primary Goal)

### Task 3.1: Add Opponent Count to PostflopContext

- Add `numOpponents: number` to `PostflopContext` interface
- Update `buildPostflopContext` in `action-selector.ts`:
  - Count active non-folded players minus the acting player
  - `numOpponents = state.players.filter(p => p.isActive && !p.isFolded && p.id !== player.id).length`

### Task 3.2: Apply Multiway Penalty in aggressorDecision

- In `aggressorDecision` function:
  ```
  const multiWayPenalty = ctx.numOpponents <= 1 ? 1.0
    : ctx.numOpponents === 2 ? 0.65
    : ctx.numOpponents === 3 ? 0.40
    : 0.25;
  betFreq = clamp01(betFreq * multiWayPenalty);
  ```
- Apply AFTER texture and hand strength adjustments, BEFORE bluff logic

**Files modified**: `src/ai/postflop.ts`, `src/ai/action-selector.ts`

## Milestone 4: Delayed C-Bet (Secondary Goal)

### Task 4.1: Track Flop Check State

- Add `checkedFlop: boolean` to `PostflopContext`
- In `buildPostflopContext`:
  - Track whether the preflop aggressor checked (no bet action) on the flop
  - This requires checking the betting round history or tracking state across streets
  - Option: add `aggressorCheckedFlop: boolean` to orchestrator's per-hand state and pass through

### Task 4.2: Apply Delayed C-Bet Bonus

- In `aggressorDecision`, when `street === 'TURN'` and `ctx.checkedFlop === true`:
  ```
  betFreq = clamp01(betFreq + profile.cBetFreq * 0.4);
  ```
- Only applies to the preflop aggressor
- Does not apply on river (delayed c-bet is a turn concept)

### Task 4.3: Plumbing

- `orchestrator.ts`: track whether the aggressor checked the flop
  - After flop betting round, check if `preflopAggressor` has `actionType === 'CHECK'`
  - Pass this flag to postflop context for turn and river streets

**Files modified**: `src/ai/postflop.ts`, `src/ai/action-selector.ts`, `src/engine/orchestrator.ts`

## Milestone 5: SPR Integration into postflop.ts (Secondary Goal)

### Task 5.1: Add SPR to PostflopContext

- Add `spr: number` and `effectiveStack: number` to `PostflopContext`
- Compute in `buildPostflopContext`:
  - `effectiveStack = Math.min(player.chips, maxOpponentChips)`
  - `spr = effectiveStack / potSize`

### Task 5.2: Replace Fixed cBetSize with SPR-Based Sizing

- In `aggressorDecision`:
  - Replace `Math.round(potSize * profile.cBetSize)` with:
    ```
    const dynamicSize = sprBetSize(ctx.spr, ctx.potSize, texture, classification.madeTier);
    const betSize = Math.min(Math.max(dynamicSize, ctx.bb), ctx.chips);
    ```
- In `passiveDecision` (lead bets):
  - Use SPR-based sizing for lead bets too
- In `facingBetDecision`:
  - Use SPR to determine commitment threshold:
    - SPR < 3: calling a bet means committing (consider raising or folding, not flat-calling)
    - SPR > 8: flat-call more liberally (deep stack, implied odds)

### Task 5.3: Monotone Board Polarization

- In `aggressorDecision`, when `texture === 'monotone'`:
  - tier 1-2: bet large (use SPR sizing with +25% modifier)
  - tier 3: always check (do not bet medium hands on monotone)
  - tier 4 with drawTier >= 2: bet large (semi-bluff)
  - tier 4 with drawTier < 2: check/fold

**Files modified**: `src/ai/postflop.ts`, `src/ai/action-selector.ts`

## Milestone 6: Testing (Final Goal)

### Task 6.1: Postflop Integration Tests

- Create `tests/ai/postflop-enhanced.test.ts`
- Test SPR sizing: low SPR produces larger bets
- Test range advantage: dry A-high board -> higher c-bet frequency
- Test multiway penalty: 3-way pot -> much lower c-bet frequency
- Test delayed c-bet: turn barrel frequency increases after flop check
- Test monotone polarization: no medium bets on monotone boards

### Task 6.2: Regression Tests

- Run existing postflop tests to verify no regressions
- Compare output distributions before and after for basic scenarios
- Verify total c-bet frequency stays within calibration bounds (may need recalibration)

**Files created**: `tests/ai/postflop-enhanced.test.ts`

## Technical Approach

- **Incremental**: SPR sizing first (biggest impact), then range advantage, then multiway, then delayed c-bet
- **Non-breaking**: Existing `cBetSize` profile parameter becomes the "anchor" around which SPR adjusts
- **Testable**: Each component (SPR, range advantage, multiway penalty) is independently unit-testable

## Risks and Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| SPR sizing creates unrealistic bet sizes | Medium | Clamp to [minBet, chips]; test edge cases |
| Range advantage scoring is too simplistic | Low | Start simple, iterate; more accurate than nothing |
| Delayed c-bet tracking requires orchestrator changes | Medium | Minimal state addition; well-scoped change |
| Calibration targets break with new sizing | Medium | Re-calibrate; expect c-bet stats to shift |
| Multiway penalty over-nerfs c-betting | Low | Tune multipliers based on simulation results |
