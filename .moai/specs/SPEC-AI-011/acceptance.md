# SPEC-AI-011: Acceptance Criteria

## AC-1: Board Texture Re-Analysis

**Given** community cards are [Ah, 8s, 3d] (dry flop)
**When** the turn card 7s is dealt making [Ah, 8s, 3d, 7s]
**Then** `analyzeBoardTexture()` re-analyzes and returns connectivity=1, category="dry" or "wet" depending on gap scoring

**Given** community cards are [Ks, Qs, 5s] (monotone flop)
**When** the turn card 2s is dealt making [Ks, Qs, 5s, 2s]
**Then** the texture detail shows `flushComplete: true`, `maxSuitCount: 4`

---

## AC-2: Board Texture Detail

**Given** community cards [Jh, Th, 9c]
**When** `analyzeBoardTexture()` is called
**Then** the result includes: category="wet", connectivity >= 2, highCardCount=3, maxSuitCount=2

**Given** community cards [Ah, Kd, 2c]
**When** `analyzeBoardTexture()` is called
**Then** the result includes: category="dry", highCardCount=2, connectivity <= 1

---

## AC-3: Check-Raise on Wet Board

**Given** an AI player (TAG, checkRaiseFreq=0.06) holds top pair on a wet board [Jh, Th, 5c]
**And** the player is not the aggressor and is facing a bet
**When** `facingBetDecision()` evaluates the check-raise
**Then** the effective check-raise frequency is approximately `0.06 * 1.3 = 0.078`

---

## AC-4: Check-Raise on Dry Board

**Given** an AI player (TAG, checkRaiseFreq=0.06) holds top pair on a dry board [Ah, 7d, 2c]
**And** the player is not the aggressor and is facing a bet
**When** `facingBetDecision()` evaluates the check-raise
**Then** the effective check-raise frequency is approximately `0.06 * 0.5 = 0.03`

---

## AC-5: Barrel Plan Creation

**Given** an AI player (LAG) c-bets the flop with madeTier=2, drawTier=2 (flush draw + pair)
**When** `createBarrelPlan()` is called
**Then** the plan indicates: `plannedTurnAction: 'bet'`, `plannedRiverAction: 'evaluate'`
**And** the plan stores the initial texture and hand tiers

---

## AC-6: Barrel Plan Abandonment

**Given** an AI player has a barrel plan from flop with `plannedTurnAction: 'bet'`
**And** the turn card completes a flush on the board (player does not hold the flush)
**When** the turn decision is made
**Then** the system re-evaluates and abandons the barrel plan (checks instead of betting)

---

## AC-7: River Polarization

**Given** an AI player (TAG, riverPolarization=0.5) reaches the river as aggressor
**And** the player holds madeTier=2 (top pair, weak kicker)
**When** the river decision is made
**Then** the system checks (does not bet) because medium-strength hands check in polarized strategy

**Given** the same scenario but with madeTier=1 (overpair)
**When** the river decision is made
**Then** the system bets at high frequency (value bet in polarized strategy)

---

## AC-8: Turn/River Texture Update

**Given** flop texture is "dry" on [Ah, 7d, 2c]
**When** turn card 6d is dealt
**Then** re-analyzed texture accounts for 2 diamonds (flush draw possible) and increased connectivity
**And** aggressor barrel frequency adjusts based on updated texture

---

## AC-9: Donk Bet

**Given** an AI player (Station, donkBetFreq=0.1) is BB, not the aggressor, holds madeTier=1
**And** board is [8h, 7h, 6c] (rangeAdvantageScore < -0.3, favors caller)
**When** `passiveDecision()` is called
**Then** the system considers a donk bet at approximately 10% frequency
**And** the donk bet size is 33-50% of pot

**Given** the same scenario but on a board [Ah, Kd, 2c] (rangeAdvantageScore > 0, favors aggressor)
**When** `passiveDecision()` is called
**Then** the system does NOT donk bet (checks)

---

## AC-10: Delayed C-Bet

**Given** an AI player (TAG) was the aggressor but checked the flop
**And** the turn card does not complete any draws on the board
**When** `aggressorDecision()` is called on the turn with `aggressorCheckedPrevStreet: true`
**Then** the delayed c-bet frequency is `turnBarrel * 1.2 = 0.55 * 1.2 = 0.66`

---

## AC-11: Pot Geometry Sizing

**Given** SPR is 10 and 3 streets remain (flop)
**When** `planBetSizing(10, 3, true)` is called
**Then** the result approximates [0.33, 0.50, 0.66] (small-medium-large sizing)

**Given** SPR is 2.5 and 2 streets remain (turn)
**When** `planBetSizing(2.5, 2, true)` is called
**Then** the result approximates [0.75, 1.0] or [1.0] (commit quickly)

---

## AC-12: BvB Adjustment

**Given** a heads-up pot between SB and BB (isBvB=true)
**When** the aggressor's c-bet frequency is normally 0.70
**Then** the effective c-bet frequency in BvB is approximately `0.70 * 1.20 = 0.84`

**Given** a BvB pot where BB is not the aggressor
**When** donk bet frequency is normally 0.05
**Then** effective donk bet frequency in BvB is approximately `0.05 * 1.20 = 0.06`

---

## AC-13: Style Differentiation - Nit vs LAG

**Given** a Nit AI player and a LAG AI player both face a wet turn board after c-betting the flop
**When** both hold madeTier=3 (marginal hand)
**Then** the Nit checks at high frequency (>70%)
**And** the LAG bets at moderate frequency (40-60%) as a semi-bluff / thin value

---

## AC-14: Style Differentiation - Simulation Metrics

**Given** a 1K SNG simulation with all preset types
**When** postflop statistics are collected
**Then** each preset's metrics fall within the target ranges:

| Preset  | C-bet% | Turn Barrel% | Check-Raise% | WTSD% |
| ------- | ------ | ------------ | ------------ | ----- |
| Nit     | 50-60  | 35-45        | 2-5          | 22-28 |
| TAG     | 65-75  | 50-60        | 5-8          | 26-32 |
| LAG     | 70-80  | 55-65        | 8-12         | 30-36 |
| Station | 30-40  | 20-30        | 1-3          | 38-45 |
| Maniac  | 80-90  | 65-75        | 12-18        | 35-42 |
| Shark   | 63-72  | 48-56        | 6-10         | 28-34 |

---

## AC-15: Performance

**Given** a postflop decision with all new features active (barrel plan, texture re-analysis, donk bet check, BvB check)
**When** `makePostflopDecision()` is called
**Then** the decision completes in less than 5ms

---

## AC-16: Determinism

**Given** the same seed, hole cards, community cards, and game state
**When** `makePostflopDecision()` is called twice
**Then** both calls return identical decisions (action type and amount)

---

## Quality Gate Criteria

- [ ] All existing postflop unit tests pass without modification (backward compatibility)
- [ ] New unit tests for each feature: check-raise, barrel plan, donk bet, delayed c-bet, pot geometry, BvB
- [ ] Board texture re-analysis tests cover 3, 4, and 5 card boards
- [ ] 1K SNG simulation validates per-preset metric ranges (AC-14)
- [ ] Performance benchmark: average postflop decision < 2ms, worst-case < 5ms
- [ ] Determinism test: same seed produces identical tournament outcomes
- [ ] Shark preset has closest-to-GTO frequencies among all presets
- [ ] No direct use of `Math.random` in any modified AI file
