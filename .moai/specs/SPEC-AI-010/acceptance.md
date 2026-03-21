# SPEC-AI-010 Acceptance Criteria: Postflop Range Advantage & SPR-Based Sizing

## AC-1: SPR Calculation Correctness

**Given** a player with 3000 chips and pot size 600
**When** `calculateSPR` is called
**Then** SPR = 5.0

**Given** pot size = 0
**When** `calculateSPR` is called
**Then** SPR = Infinity (not NaN, not error)

**Verification**: Unit test on `calculateSPR`.

---

## AC-2: SPR Zone Classification

**Given** SPR = 1.5
**When** `getSPRZone` is called
**Then** returns 'ultra-low'

**Given** SPR = 6.0
**When** `getSPRZone` is called
**Then** returns 'medium-low'

**Given** SPR = 15.0
**When** `getSPRZone` is called
**Then** returns 'high'

**Verification**: Unit test on zone boundaries.

---

## AC-3: SPR-Based Bet Sizing -- Low SPR Bets Large

**Given** SPR = 2.0 and pot = 1000
**When** `sprBetSize` is called
**Then** bet size >= 800 (80%+ pot, near commitment)

**Given** SPR = 12.0 and pot = 1000
**When** `sprBetSize` is called
**Then** bet size <= 400 (33-40% pot, smaller bets deep)

**Verification**: Unit test comparing sizing across SPR zones.

---

## AC-4: Range Advantage -- High Board Favors Raiser

**Given** board cards A-K-2 rainbow (all different suits)
**When** `computeRangeAdvantage` is called with `isAggressor = true`
**Then** advantage > +0.10 (raiser's range hits A-K boards hard)

**Given** board cards 7-8-9 two-tone
**When** `computeRangeAdvantage` is called with `isAggressor = true`
**Then** advantage < -0.05 (connected mid board favors caller's range)

**Verification**: Unit test on representative board textures.

---

## AC-5: Multiway Pot Penalty

**Given** aggressor with c-bet frequency 0.70 heads-up
**When** computing c-bet frequency in a 3-way pot
**Then** effective c-bet frequency <= 0.30 (0.70 * 0.40 penalty)

**Given** heads-up pot
**When** computing c-bet frequency
**Then** no multiway penalty applied (multiplier = 1.0)

**Verification**: Unit test on `aggressorDecision` with varying `numOpponents`.

---

## AC-6: Delayed C-Bet on Turn

**Given** the preflop aggressor checked the flop (no bet)
**And** it is now the turn with `street = 'TURN'`
**When** the aggressor's turn betting frequency is computed
**Then** turn barrel frequency is increased by approximately `cBetFreq * 0.4`
  (e.g., Shark: 0.52 base + 0.68 * 0.4 = 0.52 + 0.27 = ~0.79 turn barrel after flop check)

**Given** the aggressor bet the flop (normal c-bet)
**And** it is now the turn
**When** the turn betting frequency is computed
**Then** no delayed c-bet bonus is applied (standard turnBarrel frequency)

**Verification**: Unit test comparing turn barrel with and without `checkedFlop`.

---

## AC-7: Monotone Board Polarization

**Given** a monotone board (3+ cards of one suit)
**And** the AI has a tier 3 (medium) made hand
**When** the aggressor decision is computed
**Then** the decision is CHECK (not bet) -- no medium bets on monotone boards

**Given** a monotone board
**And** the AI has a tier 1 (strong) made hand
**When** the aggressor decision is computed
**Then** the bet size is large (75-100% pot using SPR sizing with +25% modifier)

**Verification**: Unit test on `aggressorDecision` with monotone texture and various hand tiers.

---

## AC-8: SPR Commitment in facingBetDecision

**Given** SPR < 3 and AI has a tier 2 (decent) made hand
**When** facing a bet
**Then** the AI either raises (commits) or folds (not worth calling to just see one card)
**And** flat-calling frequency is reduced compared to SPR > 8 scenario

**Given** SPR > 8 and AI has a tier 2 made hand
**When** facing a bet
**Then** the AI calls more liberally (implied odds, deep stack)

**Verification**: Integration test comparing call vs raise frequencies at different SPR levels.

---

## AC-9: Bet Size Never Exceeds Chips

**Given** any SPR zone and pot size
**When** bet sizing is computed
**Then** the final bet amount <= player's chip count
**And** the final bet amount >= minimum bet (1 BB)

**Verification**: Property-based test with random inputs.

---

## AC-10: PostflopContext Contains New Fields

**Given** a game state during postflop play
**When** `buildPostflopContext` is called
**Then** the context contains:
  - `numOpponents: number` (count of non-folded active opponents)
  - `spr: number` (effective stack / pot size)
  - `effectiveStack: number` (min of player stack and max opponent stack)
  - `checkedFlop: boolean` (whether aggressor checked the flop)

**Verification**: Integration test asserting context fields are populated.

---

## AC-11: No Regression in Existing Behavior

**Given** all existing postflop test scenarios
**When** run with the enhanced postflop engine
**Then** no test failures occur
**And** overall c-bet frequency across 10K simulated hands stays within 15% of previous values
  (some shift expected due to new features; large deviations indicate a bug)

**Verification**: Run existing test suite + calibration check.

---

## Quality Gate

- All existing postflop tests pass
- New tests: `spr.test.ts`, `postflop-enhanced.test.ts`
- SPR sizing produces bets in valid range [minBet, chips]
- Range advantage score is bounded in [-0.30, +0.30]
- Multiway penalty does not create negative c-bet frequencies
- Delayed c-bet only triggers on turn after flop check

## Definition of Done

- [ ] `src/ai/spr.ts` created with SPR calculator and bet sizing
- [ ] `computeRangeAdvantage` added to `board-texture.ts`
- [ ] `numOpponents` passed through PostflopContext and used for multiway penalty
- [ ] Delayed c-bet bonus implemented for turn after flop check
- [ ] SPR-based bet sizing replaces fixed `cBetSize` in aggressor/passive decisions
- [ ] Monotone board polarization logic implemented
- [ ] PostflopContext extended with `spr`, `effectiveStack`, `numOpponents`, `checkedFlop`
- [ ] facingBetDecision uses SPR for commitment threshold
- [ ] All acceptance criteria tests pass
- [ ] Existing test suite passes without regression
