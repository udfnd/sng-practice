# SPEC-AI-011: Advanced Postflop Strategy

## Metadata

| Field    | Value                          |
| -------- | ------------------------------ |
| SPEC ID  | SPEC-AI-011                    |
| Title    | Advanced Postflop Strategy     |
| Created  | 2026-03-21                     |
| Status   | Planned                        |
| Priority | High                           |
| Related  | SPEC-AI-007, SPEC-AI-008, SPEC-AI-009, SPEC-AI-010 |

---

## Environment

- **AI Engine**: `src/ai/postflop.ts` (main decision), `src/ai/board-texture.ts`, `src/ai/hand-classifier.ts`, `src/ai/spr.ts`
- **Presets**: `src/ai/presets.ts` (6 AI profiles with postflop knobs: cBetFreq, cBetSize, turnBarrel, riverBarrel, checkRaiseFreq, bluffFreq, foldToCBet)
- **Action Resolution**: `src/ai/action-selector.ts` builds PostflopContext and translates decisions
- **Current Architecture**: Three-branch decision tree: `aggressorDecision` / `facingBetDecision` / `passiveDecision`
- **Board Texture**: 4 categories (dry/wet/monotone/paired), analyzed once on flop only
- **Hand Classification**: 4 made tiers + 4 draw tiers, no distinction between streets
- **RNG**: Seeded PRNG passed through all decision functions for deterministic replay

## Assumptions

- A1: Postflop improvements must be backward-compatible with existing AI preset parameter ranges (no new fields required for basic improvements; new fields are additive)
- A2: Board texture should be re-analyzed on turn and river as new cards change texture
- A3: Barrel planning (multi-street) should be deterministic given the same seed, hole cards, and board
- A4: Style differentiation emerges from existing preset parameters plus new strategy modifiers, not from hardcoded per-style logic
- A5: Performance constraint: postflop decision must complete in <5ms (current is <1ms)
- A6: All frequency-based decisions use the seeded RNG, never Math.random
- A7: Validation metrics come from batch simulation (1K+ SNGs), not single-hand analysis

## Requirements

### Ubiquitous Requirements

- R1: The system **shall** re-analyze board texture on every street (flop, turn, river) using all available community cards.
- R2: The system **shall** maintain the three-branch postflop decision architecture (aggressor / facing-bet / passive) while enhancing each branch.
- R3: The system **shall** use the seeded RNG for all probabilistic decisions to preserve deterministic replay.

### Event-Driven Requirements

#### Check-Raise Strategy

- R4: **When** a player is not the aggressor, is not facing a bet, and has a strong hand (madeTier 1-2) or strong draw (drawTier 1-2) on a wet/monotone board, **then** the system **shall** evaluate a check-raise line using board-dependent check-raise frequency.
- R5: **When** the board is dry, **then** check-raise frequency **shall** be reduced by 50% from the profile's `checkRaiseFreq` value.
- R6: **When** the board is wet or monotone, **then** check-raise frequency **shall** be increased by 30% from the profile's `checkRaiseFreq` value.

#### Multi-Street Barrel Planning

- R7: **When** the aggressor decides to c-bet the flop, **then** the system **shall** generate a barrel plan indicating the intended action for turn and river based on made hand tier, draw tier, and board texture category.
- R8: **When** the turn card arrives and the barrel plan exists, **then** the system **shall** re-evaluate the plan: continue barreling if board texture remains favorable, or abandon the plan if the turn card significantly improves the caller's range.
- R9: **When** the river card arrives with a barrel plan, **then** the system **shall** polarize the bet: bet large with strong value hands (madeTier 1) or strong bluffs, check medium-strength hands.

#### Board Texture Updates

- R10: **When** the turn card is dealt, **then** the system **shall** re-analyze board texture including all 4 community cards and adjust strategy accordingly.
- R11: **When** the river card is dealt, **then** the system **shall** re-analyze board texture including all 5 community cards.
- R12: **When** a turn/river card completes a flush draw (3+ same suit becomes 4+), **then** the texture **shall** update to reflect the completed draw, reducing aggressor barrel frequency.

#### Donk Betting

- R13: **When** the non-aggressor is first to act on a board that strongly favors the caller's range (rangeAdvantageScore < -0.3), **then** the system **shall** evaluate a donk bet at frequency proportional to `bluffFreq * 0.5` with strong hands (madeTier 1-2).
- R14: **When** donk betting, **then** the bet size **shall** be 33-50% of pot (smaller than standard c-bet sizing).

#### Delayed C-Bet

- R15: **When** the aggressor checks the flop and the turn card does not significantly improve the caller's range, **then** the system **shall** evaluate a delayed c-bet at `turnBarrel * 1.2` frequency.

### State-Driven Requirements

#### SPR-Based Pot Geometry

- R16: **While** SPR > 8, the system **shall** use small bet sizes (25-33% pot) to maintain stack-to-pot flexibility across multiple streets.
- R17: **While** SPR is 3-8, the system **shall** plan bet sizes to achieve pot commitment by river if holding a strong hand (target: 2-3 bets to commit).
- R18: **While** SPR < 3, the system **shall** prefer larger bets (66-100% pot) or all-in, as the stack is effectively committed.

#### BvB (Blind vs Blind) Adjustments

- R19: **While** in a heads-up pot between SB and BB postflop, the system **shall** widen both attack and defense ranges by 15-25% compared to standard positional play.
- R20: **While** the BB is the non-aggressor in a BvB pot, donk bet frequency **shall** increase by 20% compared to non-BvB pots.

### Style-Specific Requirements

- R21: **While** the AI profile is Nit, **then** the system **shall** use small c-bet sizing (33% pot), give up easily on wet turn/river cards, and rarely bluff the river.
- R22: **While** the AI profile is TAG, **then** the system **shall** c-bet at standard frequency, selectively barrel turns with strong hands and draws, and bet rivers primarily for value.
- R23: **While** the AI profile is LAG, **then** the system **shall** c-bet at high frequency, aggressively barrel turns including with draws, and polarize river bets between strong value and bluffs.
- R24: **While** the AI profile is Station, **then** the system **shall** rarely fold to bets, have weak checking ranges, play passively (low c-bet, low barrel).
- R25: **While** the AI profile is Maniac, **then** the system **shall** overbet (100%+ pot) at significant frequency, bluff triple-barrels often, and have high check-raise frequency.
- R26: **While** the AI profile is Shark, **then** the system **shall** implement mixed strategies (GTO-approximation), balanced ranges on all streets, and make exploitative adjustments based on position and board texture.

### Unwanted Behavior Requirements

- R27: The system **shall not** make postflop decisions that exceed 5ms execution time.
- R28: The system **shall not** introduce non-determinism by using `Math.random` directly; all randomness must flow through the provided seeded RNG.

## Specifications

### Extended PostflopContext

```typescript
interface PostflopContext {
  // ... existing fields ...
  /** Barrel plan from previous street (null if no plan) */
  barrelPlan?: BarrelPlan | null;
  /** Whether this is a BvB (blind vs blind) pot */
  isBvB?: boolean;
  /** Whether aggressor checked the previous street (for delayed c-bet) */
  aggressorCheckedPrevStreet?: boolean;
  /** Position: 'IP' (in position) | 'OOP' (out of position) */
  position?: 'IP' | 'OOP';
}

interface BarrelPlan {
  plannedTurnAction: 'bet' | 'check' | 'evaluate';
  plannedRiverAction: 'bet' | 'check' | 'evaluate';
  /** The made tier when plan was created */
  initialMadeTier: MadeHandTier;
  /** The draw tier when plan was created */
  initialDrawTier: DrawTier;
  /** Board texture when plan was created */
  initialTexture: BoardTexture;
}
```

### Enhanced Board Texture

```typescript
interface BoardTextureDetail {
  category: BoardTexture;          // dry | wet | monotone | paired
  flushComplete: boolean;          // 4+ of same suit on board
  straightComplete: boolean;       // 3+ connected within 2-gap
  highCardCount: number;           // Broadway cards (T+) on board
  pairedCount: number;             // Number of paired ranks
  maxSuitCount: number;            // Highest suit frequency
  connectivity: number;            // 0-4 scale of rank connectivity
}
```

### Pot Geometry Calculator

```typescript
function planBetSizing(
  spr: number,
  streetsRemaining: number,  // 3=flop, 2=turn, 1=river
  targetCommitment: boolean, // true for value hands wanting stacks in
): number[]  // returns pot-fraction bet sizes for each remaining street
```

### New AIProfile Fields (Additive)

```typescript
interface AIProfile {
  // ... existing fields ...
  /** Donk bet frequency base (0.0-0.3). Default: 0 for most presets */
  donkBetFreq?: number;
  /** Overbet frequency (0.0-0.3). Default: 0, except Maniac */
  overbetFreq?: number;
  /** River polarization factor (0.0-1.0). Higher = more polarized. Default: 0.5 */
  riverPolarization?: number;
}
```

### File Structure

| File | Changes |
| ---- | ------- |
| `src/ai/postflop.ts` | Major refactor: add barrel plan, donk bet, delayed c-bet, pot geometry |
| `src/ai/board-texture.ts` | Return `BoardTextureDetail` instead of simple category; support turn/river re-analysis |
| `src/ai/hand-classifier.ts` | No changes expected (classification already per-street) |
| `src/ai/spr.ts` | Add `planBetSizing()` for pot geometry |
| `src/ai/presets.ts` | Add optional new fields to preset definitions |
| `src/ai/action-selector.ts` | Pass barrel plan and BvB flag through PostflopContext |
| `src/types/index.ts` | Add optional fields to AIProfile interface |

---

## Traceability

| Requirement | Plan Reference       | Acceptance Reference |
| ----------- | -------------------- | -------------------- |
| R1-R3       | M1: Foundation       | AC-1, AC-2           |
| R4-R6       | M2: Check-Raise      | AC-3, AC-4           |
| R7-R9       | M3: Barrel Planning  | AC-5, AC-6, AC-7     |
| R10-R12     | M1: Board Texture    | AC-8                 |
| R13-R14     | M4: Donk Bet         | AC-9                 |
| R15         | M4: Delayed C-Bet    | AC-10                |
| R16-R18     | M3: Pot Geometry     | AC-11                |
| R19-R20     | M5: BvB              | AC-12                |
| R21-R26     | M5: Style Tuning     | AC-13, AC-14         |
| R27-R28     | All milestones       | AC-15, AC-16         |
