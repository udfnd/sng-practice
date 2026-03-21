# SPEC-AI-010: Postflop Range Advantage & SPR-Based Sizing

## Status: Draft
## Priority: P3 (Lower)
## Dependencies: SPEC-AI-007 (deterministic RNG), SPEC-AI-008 (ICM for tournament context)
## Affected Files: src/ai/spr.ts (new), src/ai/postflop.ts, src/ai/board-texture.ts, src/ai/action-selector.ts

---

## 1. Overview

Enhance the postflop decision engine with Stack-to-Pot Ratio (SPR) awareness and range advantage concepts. Currently, postflop play uses a simple 4-tier hand classification with flat bet sizing (`cBetSize` constant). This SPEC introduces dynamic bet sizing based on SPR, range-advantage-aware c-bet frequency, multiway pot penalties, and delayed c-bet logic.

## 2. Problem Analysis

### P1: No SPR Awareness

SPR (effective stack / pot size at start of street) is the single most important factor for postflop bet sizing:
- Low SPR (<4): Players are committed. Bet large or all-in; medium bets make no sense.
- Medium SPR (4-10): Standard play. Position and hand strength matter most.
- High SPR (>10): Deep stacks. Smaller bets; wider range needed to continue.

Currently, `cBetSize` is a fixed constant per profile (e.g., Shark: 0.60 = 60% pot). A Shark with SPR 2 should be betting all-in, not 60% pot.

### P2: No Range Advantage Concept

The c-bet frequency adjustment is based solely on board texture (dry +12%, wet -12%). It does not consider WHO the board favors:
- Dry A-K-7 rainbow: favors the preflop raiser (has more AK, AQ, KK in range) -> high c-bet frequency
- Wet 8-7-6 two-tone: favors the caller (has more suited connectors, small pairs) -> low c-bet frequency
- Monotone K-J-9 all hearts: polarized board -> bet big or check (medium bets are exploitable)

The current texture adjustment partially captures this but does not distinguish raiser vs caller range advantage.

### P3: Flat C-Bet Frequency Regardless of Opponents

Current c-bet frequency is the same whether facing 1 opponent or 3. In reality:
- Heads-up: c-bet frequently (one opponent to fold)
- 3-way: c-bet rarely (need to get through two opponents)
- 4+ way: almost never c-bet without a strong hand

### P4: No Delayed C-Bet

If the aggressor checks the flop, they should bet the turn at a higher frequency (delayed c-bet). This is a fundamental poker concept missing from the current implementation. Checking flop with a strong range then betting turn is a balanced line.

### P5: No Bet Size Variation

Every bet is `potSize * cBetSize`. There is no:
- Small bet on dry boards (1/3 pot)
- Large bet on wet boards (3/4 pot)
- Overbet on polarized boards (>100% pot)
- All-in when SPR is very low

## 3. Requirements (EARS Format)

### R1: SPR Calculator (Ubiquitous)

**The system shall** provide a function `calculateSPR(effectiveStack: number, potSize: number): number` and use it to categorize the stack-to-pot relationship into zones:
- Ultra-low SPR (<2): Commitment zone
- Low SPR (2-4): Near-commitment
- Medium SPR (4-10): Standard play
- High SPR (>10): Deep-stacked

### R2: SPR-Based Bet Sizing (State-Driven)

**While** the AI decides to bet or raise on a postflop street, **the system shall** adjust bet size based on SPR:

| SPR Zone | Sizing Strategy | Pot Fraction |
|----------|----------------|-------------|
| < 2      | All-in or overbet | 100-150% pot or all-in |
| 2-4      | Large bet | 66-100% pot |
| 4-7      | Standard bet | 50-75% pot |
| 7-10     | Medium bet | 33-60% pot |
| > 10     | Small bet | 25-40% pot |

The exact fraction within each zone depends on board texture and hand strength.

### R3: Range Advantage Scoring (Event-Driven)

**When** the AI is the preflop aggressor deciding whether to c-bet, **the system shall** compute a range advantage score based on board characteristics:

- **High-card boards** (A, K, Q high, dry): advantage = +0.15 to +0.25 (raiser's range hits these boards more)
- **Connected low boards** (7-8-9, 5-6-7): advantage = -0.10 to -0.20 (caller's range hits these boards more)
- **Paired boards**: advantage = +0.05 to +0.10 (raiser has more big pairs)
- **Monotone boards**: advantage = 0 (neutral, but should polarize bet sizing)

Range advantage score is added to the base c-bet frequency.

### R4: Multiway Pot Penalty (State-Driven)

**While** there are multiple opponents (more than 1) in the pot, **the system shall** reduce c-bet frequency:
- 2 opponents: c-bet frequency * 0.65
- 3 opponents: c-bet frequency * 0.40
- 4+ opponents: c-bet frequency * 0.25

### R5: Delayed C-Bet (Event-Driven)

**When** the preflop aggressor checked the flop, **and when** the turn card is dealt, **the system shall** increase the turn betting frequency by a delayed c-bet bonus:
- `delayedCBetBonus = profile.cBetFreq * 0.4`
- This bonus is added to the turn barrel frequency
- Only applies if the aggressor checked flop (not if they bet and were called)

### R6: Monotone Board Polarization (State-Driven)

**While** the board is monotone (3+ cards of one suit), **the system shall** polarize bet sizing:
- Strong hands (tier 1-2) or flush: bet large (75-100% pot)
- Medium hands (tier 3): check (do not bet medium on monotone boards)
- Bluffs (tier 4 with flush draw): bet large (semi-bluff)
- This replaces the current flat texture adjustment of -10%

### R7: PostflopContext Enhancement (Ubiquitous)

**The system shall** extend `PostflopContext` with:
- `numOpponents: number` -- active opponents in the hand (not folded)
- `spr: number` -- stack-to-pot ratio at start of current street
- `checkedFlop: boolean` -- whether the aggressor checked the flop (for delayed c-bet)
- `effectiveStack: number` -- minimum of player's stack and largest opponent stack

## 4. Architecture Notes

### New File: src/ai/spr.ts

```
export function calculateSPR(effectiveStack: number, potSize: number): number
export type SPRZone = 'ultra-low' | 'low' | 'medium-low' | 'medium' | 'high'
export function getSPRZone(spr: number): SPRZone
export function sprBetSize(spr: number, potSize: number, texture: BoardTexture, madeTier: MadeHandTier): number
```

### Enhanced board-texture.ts

Add range advantage scoring to `analyzeBoardTexture` or create a new function:
```
export function computeRangeAdvantage(communityCards: Card[], isAggressor: boolean): number
```

Factors:
- Highest card rank on board (A/K/Q favor raiser)
- Board connectivity (connected low cards favor caller)
- Board pairing (paired boards slightly favor raiser)
- Board suits (monotone is neutral)

### Modified postflop.ts

- `aggressorDecision`: use SPR for sizing, range advantage for frequency, multiway penalty
- `facingBetDecision`: use SPR to determine commitment thresholds
- `passiveDecision`: use SPR for lead bet sizing
- New: track `checkedFlop` state for delayed c-bet

### Modified action-selector.ts

- `buildPostflopContext`: compute and pass SPR, numOpponents, checkedFlop, effectiveStack

## 5. Constraints

- SPR calculation must handle pot = 0 edge case (return Infinity)
- Bet sizing must never exceed player's chip count
- Bet sizing must meet minimum bet requirement (1 BB)
- Range advantage is an approximation (not a full equity simulation)
- Multiway penalty must not reduce c-bet frequency below 0
- Delayed c-bet bonus applies only on the turn, not on the river

## 6. Traceability

| Requirement | Source | Validates |
|------------|--------|-----------|
| R1 | Design Doc 6.4.5 | SPR-aware play |
| R2 | Poker theory | Dynamic sizing |
| R3 | Poker theory | Range advantage |
| R4 | Poker theory | Multiway adjustment |
| R5 | Poker theory | Delayed c-bet |
| R6 | board-texture.ts | Monotone strategy |
| R7 | postflop.ts | Context completeness |
